import * as THREE from 'three';
import { FULLSCREEN_VERT, NOISE } from './glsl';

/**
 * 宣纸上的墨迹模拟（低分辨率 ping-pong）。
 * 通道：R = 快褪的墨（鼠标墨痕），G = 水分，B = 慢褪的墨（首屏墨滴与书写洇墨）。
 * 水从湿处流向干处，墨随水走但稍慢；水分摊开的地方墨变淡，前沿处墨堆积 → 自然形成边缘加深。
 * 宣纸纤维决定渗透率，边缘因此毛糙不规则。
 */

const MAX_SPLATS = 24;

export type Splat = {
  ax: number; ay: number; bx: number; by: number; // 线段端点（uv，y 向上）
  radius: number; // 以屏幕高度为单位
  fast: number; // 快褪墨量
  water: number;
  slow: number; // 慢褪墨量
};

const STEP_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform float uAspect;
uniform float uTime;
uniform float uFadeFast;
uniform float uFadeSlow;
uniform float uEvap;
uniform int uSplatCount;
uniform vec4 uSplatSeg[${MAX_SPLATS}];
uniform vec4 uSplatVal[${MAX_SPLATS}];
varying vec2 vUv;

${NOISE}

float permeability(vec2 uv) {
  vec2 p = uv * vec2(uAspect, 1.0);
  // 纤维：两个方向的细长噪声
  float f1 = noise2(vec2(p.x * 30.0, p.y * 260.0));
  float f2 = noise2(vec2(p.x * 260.0 + 31.0, p.y * 30.0));
  float fib = max(f1, f2);
  float blot = fbm2(p * 9.0);
  return clamp(0.15 + 0.75 * blot + 0.35 * fib * fib, 0.12, 1.0);
}

void main() {
  vec2 uv = vUv;
  vec4 C = texture2D(uPrev, uv);
  vec4 L = texture2D(uPrev, uv - vec2(uTexel.x, 0.0));
  vec4 R = texture2D(uPrev, uv + vec2(uTexel.x, 0.0));
  vec4 B = texture2D(uPrev, uv - vec2(0.0, uTexel.y));
  vec4 T = texture2D(uPrev, uv + vec2(0.0, uTexel.y));

  float perm = permeability(uv);
  vec2 gradW = vec2(R.g - L.g, T.g - B.g) * 0.5;
  float lapW = L.g + R.g + T.g + B.g - 4.0 * C.g;

  // 水从湿处流向干处
  vec2 vel = -gradW * 7.0 * perm;
  vec2 q = uv * vec2(uAspect, 1.0) * 6.0;
  vel += (vec2(noise2(q + uTime * 0.07), noise2(q + 7.3 - uTime * 0.07)) - 0.5) * 0.9 * min(C.g, 1.0);
  float vl = length(vel);
  if (vl > 1.6) vel *= 1.6 / vl;

  vec4 Aw = texture2D(uPrev, uv - vel * uTexel);
  vec4 Ap = texture2D(uPrev, uv - vel * 0.75 * uTexel);
  vec4 N = (L + R + T + B) * 0.25;

  // 散度：水摊开处墨变淡，前沿收拢处墨堆积
  float div = -7.0 * perm * lapW;
  float conc = clamp(1.0 - div * 0.6, 0.92, 1.07);

  float water = mix(Aw.g, N.g, 0.3 * perm);
  water = max(water * uEvap - 0.0005, 0.0);

  float wet = clamp(C.g * 2.5, 0.0, 1.0);
  float kd = 0.25 * wet * perm;
  float pf = mix(Ap.r, N.r, kd) * mix(1.0, conc, wet) * uFadeFast;
  float ps = mix(Ap.b, N.b, kd) * mix(1.0, conc, wet) * uFadeSlow;

  vec2 pa0 = uv * vec2(uAspect, 1.0);
  for (int i = 0; i < ${MAX_SPLATS}; i++) {
    if (i >= uSplatCount) break;
    vec4 seg = uSplatSeg[i];
    vec4 val = uSplatVal[i];
    vec2 a = seg.xy * vec2(uAspect, 1.0);
    vec2 b = seg.zw * vec2(uAspect, 1.0);
    vec2 pa = pa0 - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
    float d = length(pa - ba * h);
    float r = val.x * (0.75 + 0.5 * noise2(pa0 * 60.0 + float(i)));
    float f = 1.0 - smoothstep(r * 0.55, r, d);
    pf += val.y * f;
    ps += val.w * f;
    water = max(water, val.z * f);
  }

  gl_FragColor = vec4(min(pf, 3.0), min(water, 1.5), min(ps, 3.0), 1.0);
}
`;

export class InkField {
  texture: THREE.Texture;
  width = 1;
  height = 1;
  fadeFast = 0.997;
  fadeSlow = 0.9996;
  evap = 0.985;

  private targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private read = 0;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: THREE.ShaderMaterial;
  private pending: Splat[] = [];
  private segs = Array.from({ length: MAX_SPLATS }, () => new THREE.Vector4());
  private vals = Array.from({ length: MAX_SPLATS }, () => new THREE.Vector4());

  constructor(private renderer: THREE.WebGLRenderer, private longSide: number) {
    const opts: THREE.RenderTargetOptions = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
    };
    this.targets = [new THREE.WebGLRenderTarget(1, 1, opts), new THREE.WebGLRenderTarget(1, 1, opts)];
    this.texture = this.targets[0].texture;

    this.material = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: STEP_FRAG,
      uniforms: {
        uPrev: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uAspect: { value: 1 },
        uTime: { value: 0 },
        uFadeFast: { value: this.fadeFast },
        uFadeSlow: { value: this.fadeSlow },
        uEvap: { value: this.evap },
        uSplatCount: { value: 0 },
        uSplatSeg: { value: this.segs },
        uSplatVal: { value: this.vals },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  resize(viewW: number, viewH: number) {
    const aspect = viewW / viewH;
    const w = aspect >= 1 ? this.longSide : Math.round(this.longSide * aspect);
    const h = aspect >= 1 ? Math.round(this.longSide / aspect) : this.longSide;
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    // 尺寸变化时清空（墨迹是氛围，丢掉无妨）
    for (const t of this.targets) {
      t.setSize(w, h);
      this.renderer.setRenderTarget(t);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.clear(true, false, false);
    }
    this.renderer.setRenderTarget(null);
    const u = this.material.uniforms;
    u.uTexel.value.set(1 / w, 1 / h);
    u.uAspect.value = aspect;
  }

  splat(s: Splat) {
    this.pending.push(s);
    // 太多就丢掉最早的，保证每帧上限
    if (this.pending.length > MAX_SPLATS * 4) this.pending.splice(0, this.pending.length - MAX_SPLATS * 4);
  }

  step(time: number) {
    const u = this.material.uniforms;
    const batch = this.pending.splice(0, MAX_SPLATS);
    batch.forEach((s, i) => {
      this.segs[i].set(s.ax, s.ay, s.bx, s.by);
      this.vals[i].set(s.radius, s.fast, s.water, s.slow);
    });
    u.uSplatCount.value = batch.length;
    u.uTime.value = time;
    u.uFadeFast.value = this.fadeFast;
    u.uFadeSlow.value = this.fadeSlow;
    u.uEvap.value = this.evap;

    const src = this.targets[this.read];
    const dst = this.targets[1 - this.read];
    u.uPrev.value = src.texture;
    this.renderer.setRenderTarget(dst);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.read = 1 - this.read;
    this.texture = dst.texture;
  }

  dispose() {
    this.targets.forEach((t) => t.dispose());
    this.material.dispose();
  }
}
