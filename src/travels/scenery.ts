import * as THREE from 'three';
import { FULLSCREEN_VERT, NOISE } from '../gl/glsl';
import { InkField, type Splat } from '../gl/inkField';

/**
 * 游历页背景：把地点照片实时「水墨化」。
 * 处理（每张图只做一次，结果缓存）：Kuwahara 平滑成画意色块 → 高斯差分勾线 → 墨分五色的分层墨调。
 * 显示（每帧）：新图先出线条再染墨色、旧图像墨一样洇散退去；叠宣纸纹理、鼠标墨痕。
 */

const KUWAHARA = /* glsl */ `
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uTexel;
varying vec2 vUv;
#define R 5
void main() {
  vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0);
  vec3 s0 = vec3(0.0), s1 = vec3(0.0), s2 = vec3(0.0), s3 = vec3(0.0);
  for (int j = 0; j <= R; j++) {
    for (int i = 0; i <= R; i++) {
      float fi = float(i);
      float fj = float(j);
      vec3 c;
      c = texture2D(uSrc, vUv + vec2(-fi, -fj) * uTexel).rgb; m0 += c; s0 += c * c;
      c = texture2D(uSrc, vUv + vec2( fi, -fj) * uTexel).rgb; m1 += c; s1 += c * c;
      c = texture2D(uSrc, vUv + vec2( fi,  fj) * uTexel).rgb; m2 += c; s2 += c * c;
      c = texture2D(uSrc, vUv + vec2(-fi,  fj) * uTexel).rgb; m3 += c; s3 += c * c;
    }
  }
  float n = float((R + 1) * (R + 1));
  m0 /= n; m1 /= n; m2 /= n; m3 /= n;
  vec3 v0 = abs(s0 / n - m0 * m0), v1 = abs(s1 / n - m1 * m1), v2 = abs(s2 / n - m2 * m2), v3 = abs(s3 / n - m3 * m3);
  float a0 = v0.r + v0.g + v0.b, a1 = v1.r + v1.g + v1.b, a2 = v2.r + v2.g + v2.b, a3 = v3.r + v3.g + v3.b;
  vec3 col = m0; float best = a0;
  if (a1 < best) { best = a1; col = m1; }
  if (a2 < best) { best = a2; col = m2; }
  if (a3 < best) { best = a3; col = m3; }
  gl_FragColor = vec4(col, 1.0);
}
`;

const INK = /* glsl */ `
precision highp float;
uniform sampler2D uK;
uniform vec2 uTexel;
uniform float uSeed;
varying vec2 vUv;
${NOISE}
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
void main() {
  // 高斯差分勾线
  float g1 = 0.0, g2 = 0.0, w1 = 0.0, w2 = 0.0;
  for (int j = -5; j <= 5; j++) {
    for (int i = -5; i <= 5; i++) {
      vec2 o = vec2(float(i), float(j));
      float d2 = dot(o, o);
      float l = lum(texture2D(uK, vUv + o * uTexel).rgb);
      float a = exp(-d2 / 3.4);
      float b = exp(-d2 / 8.8);
      g1 += l * a; w1 += a;
      g2 += l * b; w2 += b;
    }
  }
  g1 /= w1;
  g2 /= w2;
  float d = g1 - 0.985 * g2;
  float edge = smoothstep(-0.004, -0.04, d);

  // 墨分五色：亮处留白，暗处分层积墨
  vec3 k = texture2D(uK, vUv).rgb;
  // 取幂让中间调也吃墨；只有很亮的天空、雪、水光才留白
  float t = smoothstep(0.06, 0.82, 1.0 - pow(lum(k), 1.5));
  float lv = floor(t * 4.0 + 0.55 * noise2(vUv * vec2(60.0, 40.0) + uSeed)) / 4.0;
  t = mix(t, lv, 0.5);
  t *= 0.78 + 0.4 * fbm2(vUv * vec2(7.0, 5.0) + uSeed);
  float warm = clamp(0.5 + (k.r - k.b) * 1.4, 0.0, 1.0);
  gl_FragColor = vec4(edge, clamp(t, 0.0, 1.0), warm, 1.0);
}
`;

const DISPLAY = /* glsl */ `
precision highp float;
uniform sampler2D uCur;
uniform sampler2D uPrev;
uniform sampler2D uInk;
uniform float uCurAspect;
uniform float uPrevAspect;
uniform float uCurZoom;
uniform float uPrevZoom;
uniform float uT;
uniform float uHasCur;
uniform float uHasPrev;
uniform vec4 uRegion;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uTime;
uniform vec2 uInkTexel;
varying vec2 vUv;
${NOISE}

vec2 coverUV(vec2 uv, float imgAspect, float zoom) {
  vec2 r = (uv - uRegion.xy) / (uRegion.zw - uRegion.xy);
  float ra = ((uRegion.z - uRegion.x) * uRes.x) / ((uRegion.w - uRegion.y) * uRes.y);
  vec2 s = ra > imgAspect ? vec2(1.0, imgAspect / ra) : vec2(ra / imgAspect, 1.0);
  return (r - 0.5) * s / zoom + 0.5 + uMouse * vec2(0.012, 0.008);
}

float inside(vec2 p) {
  return step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0);
}

float pig(vec4 c) { return c.r + c.b; }

void main() {
  vec2 uv = vUv;
  float n = fbm2(uv * vec2(3.2, 2.4) + 7.0);
  float n2 = fbm2(uv * vec2(9.0, 7.0) - 3.0);

  // 画面区域：边缘像墨洇开一样不规则地融进纸里
  vec2 r = (uv - uRegion.xy) / (uRegion.zw - uRegion.xy);
  float wob = (fbm2(uv * vec2(4.0, 7.0) + uTime * 0.01) - 0.5);
  float mask = smoothstep(0.0, 0.26, r.x + wob * 0.16) * smoothstep(1.02, 0.95, r.x)
             * smoothstep(0.0, 0.18, r.y + wob * 0.12) * smoothstep(1.0, 0.82, r.y - wob * 0.1);

  float ink = 0.0;
  float warm = 0.5;

  if (uHasPrev > 0.5) {
    vec2 p = coverUV(uv, uPrevAspect, uPrevZoom);
    vec4 a = texture2D(uPrev, p) * inside(p);
    float out_ = 1.0 - smoothstep(n - 0.18, n + 0.18, uT * 1.35);
    float ia = max(a.r * 0.9, a.g) * out_;
    ink = ia;
    warm = a.b;
  }
  if (uHasCur > 0.5) {
    vec2 p = coverUV(uv, uCurAspect, uCurZoom);
    vec4 b = texture2D(uCur, p) * inside(p);
    float inEdge = smoothstep(n2 - 0.2, n2 + 0.2, uT * 1.5);
    float inTone = smoothstep(n - 0.2, n + 0.2, uT * 1.45 - 0.35);
    float ib = max(b.r * 0.9 * inEdge, b.g * inTone);
    warm = mix(warm, b.b, step(ink, ib));
    ink = 1.0 - (1.0 - ink) * (1.0 - ib);
  }
  ink *= mask;

  // 鼠标墨痕（带边缘加深）
  vec4 c = texture2D(uInk, uv);
  float pm = pig(c);
  float blur = 0.0;
  vec2 rr = uInkTexel * 2.5;
  blur += pig(texture2D(uInk, uv + vec2(rr.x, 0.0)));
  blur += pig(texture2D(uInk, uv - vec2(rr.x, 0.0)));
  blur += pig(texture2D(uInk, uv + vec2(0.0, rr.y)));
  blur += pig(texture2D(uInk, uv - vec2(0.0, rr.y)));
  blur *= 0.25;
  float trail = 1.0 - exp(-(pm + max(pm - blur, 0.0) * 3.0) * 1.8);

  vec3 paper = vec3(0.937, 0.906, 0.839);
  vec3 inkC = mix(vec3(0.09, 0.1, 0.12), vec3(0.15, 0.12, 0.09), warm);
  vec3 col = mix(paper, inkC, clamp(ink * 0.93, 0.0, 1.0));
  col = mix(col, vec3(0.055, 0.055, 0.07), trail);
  col *= 1.0 - 0.035 * clamp(c.g, 0.0, 1.0);

  // 宣纸纹理与暗角
  vec2 px = uv * uRes;
  float grain = noise2(px * 0.9) - 0.5;
  float fib = max(noise2(vec2(px.x * 0.02, px.y * 0.35)), noise2(vec2(px.x * 0.35 + 9.0, px.y * 0.02)));
  float cloud = fbm2(uv * vec2(uRes.x / uRes.y, 1.0) * 3.0) - 0.5;
  col *= 1.0 + grain * 0.035 + (fib - 0.5) * 0.03 + cloud * 0.05;
  vec2 q = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  col *= 1.0 - 0.2 * smoothstep(0.4, 1.3, length(q));
  gl_FragColor = vec4(col, 1.0);
}
`;

type Entry = { rt: THREE.WebGLRenderTarget; aspect: number; used: number };

export type SceneryOptions = { lowPower: boolean; reducedMotion: boolean };

export class Scenery {
  readonly renderer: THREE.WebGLRenderer;
  readonly ink: InkField;
  /** 当前停留点内的滚动进度（0..1），用于缓慢推镜 */
  local = 0;
  /** 画面在屏幕上的区域（uv）：x0, y0, x1, y1 */
  region = new THREE.Vector4(0.3, 0, 1, 1);

  private quadScene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private kuwahara: THREE.ShaderMaterial;
  private inkMat: THREE.ShaderMaterial;
  private display: THREE.ShaderMaterial;
  private tmp: THREE.WebGLRenderTarget;
  private cache = new Map<number, Entry>();
  private pending = new Map<number, Promise<void>>();
  private cur = -1;
  private prev = -1;
  private t = 1;
  private mouse = new THREE.Vector2();
  private mouseSmooth = new THREE.Vector2();
  private start = performance.now();
  private last = performance.now();
  private tick = 0;
  private w = 1;
  private h = 1;
  private lastPtr: { x: number; y: number; t: number } | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private sources: (i: number) => Promise<TexImageSource>,
    private opts: SceneryOptions,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.lowPower ? 1 : 1.5));
    this.ink = new InkField(this.renderer, opts.lowPower ? 256 : 400);
    this.ink.fadeSlow = 0.997;

    const mk = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.kuwahara = mk(KUWAHARA, { uSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.inkMat = mk(INK, { uK: { value: null }, uTexel: { value: new THREE.Vector2() }, uSeed: { value: 0 } });
    this.display = mk(DISPLAY, {
      uCur: { value: null },
      uPrev: { value: null },
      uInk: { value: this.ink.texture },
      uCurAspect: { value: 1.5 },
      uPrevAspect: { value: 1.5 },
      uCurZoom: { value: 1 },
      uPrevZoom: { value: 1 },
      uT: { value: 1 },
      uHasCur: { value: 0 },
      uHasPrev: { value: 0 },
      uRegion: { value: this.region },
      uRes: { value: new THREE.Vector2() },
      uMouse: { value: this.mouseSmooth },
      uTime: { value: 0 },
      uInkTexel: { value: new THREE.Vector2() },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.display);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    this.tmp = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', (e) => this.onPointer(e), { passive: true });
    this.loop();
  }

  private resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.renderer.setSize(this.w, this.h, false);
    this.ink.resize(this.w, this.h);
    const pr = this.renderer.getPixelRatio();
    this.display.uniforms.uRes.value.set(this.w * pr, this.h * pr);
    this.display.uniforms.uInkTexel.value.set(1 / this.ink.width, 1 / this.ink.height);
  }

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
    if (this.opts.reducedMotion) return;
    const now = performance.now();
    const last = this.lastPtr;
    this.lastPtr = { x: e.clientX, y: e.clientY, t: now };
    if (!last || now - last.t > 120) return;
    const dist = Math.hypot(e.clientX - last.x, e.clientY - last.y);
    if (dist < 2) return;
    const k = Math.min(dist / Math.max(now - last.t, 1) / 3, 1);
    const radius = Math.max(THREE.MathUtils.lerp(10, 5, k) * (this.h / 900), 4);
    this.splatPx(last.x, last.y, radius, { fast: THREE.MathUtils.lerp(0.24, 0.09, k), water: 0.45 }, e.clientX, e.clientY);
  }

  /** 切换到第 i 个地点（图没处理好之前保持旧图） */
  show(i: number) {
    if (i === this.cur) return;
    this.ensure(i).then(() => {
      if (this.cur === i) return;
      this.prev = this.cur;
      this.cur = i;
      this.t = this.opts.reducedMotion ? 1 : 0;
    });
    // 预处理相邻地点
    this.ensure(i + 1);
    this.ensure(i - 1);
  }

  private ensure(i: number): Promise<void> {
    if (i < 0) return Promise.resolve();
    const hit = this.cache.get(i);
    if (hit) {
      hit.used = ++this.tick;
      return Promise.resolve();
    }
    const p0 = this.pending.get(i);
    if (p0) return p0;
    const p = this.sources(i)
      .then((img) => this.process(i, img))
      .catch((err) => console.warn('scenery', i, err))
      .finally(() => this.pending.delete(i));
    this.pending.set(i, p);
    return p;
  }

  private process(i: number, img: TexImageSource) {
    const iw = 'naturalWidth' in img ? img.naturalWidth : (img as { width: number }).width;
    const ih = 'naturalHeight' in img ? img.naturalHeight : (img as { height: number }).height;
    const long = this.opts.lowPower ? 900 : 1280;
    const s = Math.min(1, long / Math.max(iw, ih));
    const w = Math.round(iw * s);
    const h = Math.round(ih * s);

    const tex = new THREE.Texture(img as HTMLImageElement);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;

    this.tmp.setSize(w, h);
    const rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });

    this.quad.material = this.kuwahara;
    this.kuwahara.uniforms.uSrc.value = tex;
    this.kuwahara.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.renderer.setRenderTarget(this.tmp);
    this.renderer.render(this.quadScene, this.cam);

    this.quad.material = this.inkMat;
    this.inkMat.uniforms.uK.value = this.tmp.texture;
    this.inkMat.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.inkMat.uniforms.uSeed.value = i * 13.1;
    this.renderer.setRenderTarget(rt);
    this.renderer.render(this.quadScene, this.cam);

    this.renderer.setRenderTarget(null);
    this.quad.material = this.display;
    tex.dispose();

    this.cache.set(i, { rt, aspect: w / h, used: ++this.tick });
    // 最多缓存 5 张，淘汰最久没用的（当前与上一张除外）
    while (this.cache.size > 5) {
      let oldest = -1;
      let min = Infinity;
      for (const [k, e] of this.cache) if (k !== this.cur && k !== this.prev && e.used < min) (min = e.used), (oldest = k);
      if (oldest < 0) break;
      this.cache.get(oldest)!.rt.dispose();
      this.cache.delete(oldest);
    }
  }

  private loop = () => {
    requestAnimationFrame(this.loop);
    this.frame();
  };

  frame() {
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.t = Math.min(1, this.t + dt / 2.2);
    this.mouseSmooth.lerp(this.mouse, Math.min(dt * 2, 1));
    this.ink.step((now - this.start) / 1000);

    const u = this.display.uniforms;
    const cur = this.cache.get(this.cur);
    const prev = this.cache.get(this.prev);
    u.uHasCur.value = cur ? 1 : 0;
    u.uHasPrev.value = prev && this.t < 1 ? 1 : 0;
    if (cur) {
      u.uCur.value = cur.rt.texture;
      u.uCurAspect.value = cur.aspect;
      u.uCurZoom.value = 1.08 - this.local * 0.08;
    }
    if (prev) {
      u.uPrev.value = prev.rt.texture;
      u.uPrevAspect.value = prev.aspect;
      u.uPrevZoom.value = 1.0 + (1 - this.t) * 0.02;
    }
    u.uT.value = this.t;
    u.uTime.value = (now - this.start) / 1000;
    u.uInk.value = this.ink.texture;
    this.renderer.render(this.quadScene, this.cam);
  }
}
