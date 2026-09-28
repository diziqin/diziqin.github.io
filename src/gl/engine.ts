import * as THREE from 'three';
import { InkField, type Splat } from './inkField';
import { Landscape } from './landscape';
import { NOISE } from './glsl';

/** 合成层：把墨迹以「正片叠底」压到山水上，并加宣纸纹理与暗角 */
const OVERLAY_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const OVERLAY_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uInk;
uniform vec2 uInkTexel;
uniform vec2 uRes;
uniform float uHeroInk;
varying vec2 vUv;

${NOISE}

float pig(vec4 c) { return c.r + c.b * uHeroInk; }

void main() {
  vec4 c = texture2D(uInk, vUv);
  float p = pig(c);

  // 边缘加深：比周围平均更浓的地方（墨迹边缘内侧）再加一层
  float blur = 0.0;
  vec2 r = uInkTexel * 2.5;
  blur += pig(texture2D(uInk, vUv + vec2( r.x, 0.0)));
  blur += pig(texture2D(uInk, vUv + vec2(-r.x, 0.0)));
  blur += pig(texture2D(uInk, vUv + vec2(0.0,  r.y)));
  blur += pig(texture2D(uInk, vUv + vec2(0.0, -r.y)));
  blur += pig(texture2D(uInk, vUv + r * 0.7));
  blur += pig(texture2D(uInk, vUv - r * 0.7));
  blur += pig(texture2D(uInk, vUv + vec2(r.x, -r.y) * 0.7));
  blur += pig(texture2D(uInk, vUv + vec2(-r.x, r.y) * 0.7));
  blur *= 0.125;
  float d = p + max(p - blur, 0.0) * 3.0;

  float density = 1.0 - exp(-d * 1.8);
  vec3 inkCol = vec3(0.055, 0.055, 0.07);
  vec3 T = mix(vec3(1.0), inkCol, density);
  // 湿纸略暗
  T *= 1.0 - 0.035 * clamp(c.g, 0.0, 1.0);

  // 宣纸：细颗粒 + 纤维 + 大块云纹
  vec2 px = vUv * uRes;
  float grain = noise2(px * 0.9) - 0.5;
  float fib = max(noise2(vec2(px.x * 0.02, px.y * 0.35)), noise2(vec2(px.x * 0.35 + 9.0, px.y * 0.02)));
  float cloud = fbm2(vUv * vec2(uRes.x / uRes.y, 1.0) * 3.0) - 0.5;
  T *= 1.0 + grain * 0.035 + (fib - 0.5) * 0.03 + cloud * 0.05;

  // 暗角
  vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  T *= 1.0 - 0.22 * smoothstep(0.35, 1.25, length(q));

  gl_FragColor = vec4(T, 1.0);
}
`;

export type EngineOptions = { lowPower: boolean; reducedMotion: boolean };

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly ink: InkField;
  readonly land: Landscape;

  /** 0..1 滚动进度（外部写入，内部平滑） */
  targetProgress = 0;
  /** 山水显现程度 0..1 */
  reveal = 0;
  /** 首屏慢墨可见度 */
  heroInk = 1;
  /** 每帧渲染后回调（用于把地标热点贴到屏幕上） */
  onFrame: (() => void) | null = null;

  private progress = 0;
  private mouse = new THREE.Vector2();
  private mouseSmooth = new THREE.Vector2();
  private mouseInside = false;
  private raycaster = new THREE.Raycaster();
  private overlay: THREE.ShaderMaterial;
  private startTime = performance.now();
  private lastTime = performance.now();
  private lastPointer: { x: number; y: number; t: number } | null = null;
  private pixelRatio: number;
  private frameTimes: number[] = [];
  private running = true;
  private w = 1;
  private h = 1;

  constructor(canvas: HTMLCanvasElement, private opts: EngineOptions) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, opts.lowPower ? 1 : 1.5);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.autoClear = true;

    this.ink = new InkField(this.renderer, opts.lowPower ? 320 : 512);
    this.land = new Landscape({ lowPower: opts.lowPower });

    this.overlay = new THREE.ShaderMaterial({
      vertexShader: OVERLAY_VERT,
      fragmentShader: OVERLAY_FRAG,
      uniforms: {
        uInk: { value: this.ink.texture },
        uInkTexel: { value: new THREE.Vector2() },
        uRes: { value: new THREE.Vector2() },
        uHeroInk: { value: 1 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.ZeroFactor,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.overlay);
    quad.frustumCulled = false;
    quad.renderOrder = 1000;
    this.land.scene.add(quad);

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', (e) => this.onPointer(e), { passive: true });
    window.addEventListener('pointerdown', (e) => this.onPointerDown(e), { passive: true });
    document.addEventListener('pointerleave', () => (this.mouseInside = false));
    document.addEventListener('visibilitychange', () => {
      this.running = !document.hidden;
      if (this.running) {
        this.lastTime = performance.now();
        this.loop();
      }
    });
    this.loop();
  }

  private resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.renderer.setSize(this.w, this.h, false);
    this.ink.resize(this.w, this.h);
    this.land.resize(this.w, this.h);
    const u = this.overlay.uniforms;
    u.uInkTexel.value.set(1 / this.ink.width, 1 / this.ink.height);
    u.uRes.value.set(this.w * this.pixelRatio, this.h * this.pixelRatio);
  }

  /** 以页面像素坐标落墨 */
  splatPx(x: number, y: number, radiusPx: number, v: { fast?: number; water?: number; slow?: number }, x2 = x, y2 = y) {
    const s: Splat = {
      ax: x / this.w,
      ay: 1 - y / this.h,
      bx: x2 / this.w,
      by: 1 - y2 / this.h,
      radius: radiusPx / this.h,
      fast: v.fast ?? 0,
      water: v.water ?? 0,
      slow: v.slow ?? 0,
    };
    this.ink.splat(s);
  }

  private onPointer(e: PointerEvent) {
    this.mouse.set((e.clientX / this.w) * 2 - 1, -((e.clientY / this.h) * 2 - 1));
    this.mouseInside = true;
    if (this.opts.reducedMotion) return;
    const now = performance.now();
    const last = this.lastPointer;
    this.lastPointer = { x: e.clientX, y: e.clientY, t: now };
    if (!last || now - last.t > 120) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) return;
    const speed = dist / Math.max(now - last.t, 1); // px/ms
    // 运笔越快，墨越淡越细（飞白）
    const k = Math.min(speed / 3, 1);
    const radius = Math.max(THREE.MathUtils.lerp(10, 5, k) * (this.h / 900), 4);
    this.splatPx(last.x, last.y, radius, { fast: THREE.MathUtils.lerp(0.26, 0.1, k), water: 0.45 }, e.clientX, e.clientY);
  }

  private onPointerDown(e: PointerEvent) {
    if (this.opts.reducedMotion) return;
    const t = e.target as HTMLElement | null;
    if (t && t.closest('a, button, .no-ink')) return;
    // 点击：落一滴墨
    this.splatPx(e.clientX, e.clientY, 16 * (this.h / 900), { fast: 0.7, water: 1.0 });
  }

  private loop = () => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    this.tick();
  };

  /** 渲染一帧（开发时也可在 rAF 被暂停的情况下手动驱动） */
  tick() {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    const time = (now - this.startTime) / 1000;
    this.adaptQuality(dt);

    this.progress += (this.targetProgress - this.progress) * Math.min(dt * 3.5, 1);
    this.mouseSmooth.lerp(this.mouse, Math.min(dt * 2.5, 1));

    this.ink.step(time);
    // 鼠标在地面上的落点（用来拨草），用上一帧的镜头即可
    let mouseWorld: THREE.Vector3 | null = null;
    if (this.mouseInside && !this.opts.reducedMotion) {
      this.raycaster.setFromCamera(this.mouse, this.land.camera);
      mouseWorld = this.land.terrain.pick(this.raycaster.ray);
    }
    this.land.update(time, this.progress, this.mouseSmooth.x, this.mouseSmooth.y, this.reveal, mouseWorld);

    const u = this.overlay.uniforms;
    u.uInk.value = this.ink.texture;
    u.uHeroInk.value = this.heroInk;
    this.renderer.render(this.land.scene, this.land.camera);
    this.onFrame?.();
  }

  /** 前 2 秒若帧时间过长，逐级降低分辨率 */
  private adaptQuality(dt: number) {
    if (this.frameTimes.length > 240) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length % 60 === 0 && this.frameTimes.length >= 120) {
      const recent = this.frameTimes.slice(-60);
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      if (avg > 1 / 40 && this.pixelRatio > 0.75) {
        this.pixelRatio = Math.max(0.75, this.pixelRatio - 0.25);
        this.renderer.setPixelRatio(this.pixelRatio);
        this.resize();
      }
    }
  }
}
