import * as THREE from 'three';
import { NOISE } from './glsl';
import { Terrain, pathX, terrainH, RIVER } from './terrain';
import { Props } from './props';

/**
 * 山水世界：
 * - 镜头沿山谷前进，谷里有草坡（3D 草）、亭、竹林、江与船、石碑、驿站；
 * - 远山退到两侧与尽头，作层层叠叠的背景（程序化山脊 + 皴法 + 云雾，近浓远淡）；
 * - 滚动时镜头在各版块的「站」之间沿平滑曲线飞行，最后升空俯瞰。
 */

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const MOUNTAIN_FRAG = /* glsl */ `
precision highp float;
uniform float uSeed;
uniform float uAmp;
uniform float uBase;
uniform float uFreq;
uniform float uReveal;
uniform float uStrength;
uniform float uGrow;
uniform vec3 uCam;
varying vec2 vUv;
varying vec3 vWorld;
${NOISE}

float ridgeH(float x) {
  float n = fbm1(x * uFreq + uSeed);
  float peaks = pow(clamp((n - 0.22) / 0.56, 0.0, 1.0), 2.1);
  float roll = fbm1(x * uFreq * 3.0 + uSeed * 1.7);
  float h = uBase * (0.5 + roll) + uAmp * peaks;
  return h * smoothstep(0.0, 0.2, x) * smoothstep(1.0, 0.8, x);
}

void main() {
  float x = vUv.x;
  float y = vUv.y;
  float h = ridgeH(x) + (noise1(x * 420.0 + uSeed) - 0.5) * 0.005;
  float dy = h - y;
  if (dy < -0.01) discard;
  float inside = smoothstep(-0.002, 0.004, dy);
  float body = exp(-dy * 7.0);
  float cun = fbm2(vec2(x * 70.0, y * 16.0) + uSeed * 3.1);
  float cun2 = fbm2(vec2(x * 14.0, y * 5.0) - uSeed);
  float ink = inside * (0.08 + 0.92 * body) * (0.7 + 0.45 * cun) * (0.6 + 0.6 * cun2);
  ink += inside * smoothstep(0.014, 0.0, dy) * 0.22;
  ink *= smoothstep(0.02, 0.55, y);
  ink = clamp(ink, 0.0, 1.0);

  float dist = length(vWorld - uCam);
  float far = smoothstep(60.0, 700.0, dist);
  vec3 inkC = mix(vec3(0.07, 0.07, 0.085), vec3(0.5, 0.52, 0.54), far);
  // 青绿罩染：随「万物生长」从山脚往上漫
  float g = smoothstep(y / max(h, 0.02) * 0.7 + 0.1, y / max(h, 0.02) * 0.7 + 0.3, uGrow * 1.1) * inside;
  vec3 greenC = mix(vec3(0.38, 0.56, 0.4), vec3(0.46, 0.6, 0.62), far);
  float wash = g * (0.25 + 0.5 * exp(-dy * 2.5)) * smoothstep(0.0, 0.4, y) * mix(0.7, 0.35, far);
  float inkA = ink * mix(0.85, 0.2, far) * (1.0 - 0.35 * g);
  float a = inkA + wash * (1.0 - inkA);
  vec3 col = (inkC * inkA + greenC * wash * (1.0 - inkA)) / max(a, 1e-4);
  gl_FragColor = vec4(col, a * uReveal * uStrength);
}
`;

const MIST_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uSeed;
uniform float uReveal;
uniform float uDensity;
uniform vec3 uPaper;
uniform vec3 uCam;
varying vec2 vUv;
varying vec3 vWorld;
${NOISE}
void main() {
  float edge = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
  float band = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
  if (edge * band < 0.001) discard;
  vec2 p = vUv * vec2(5.0, 1.4) + vec2(uTime * 0.012 + uSeed, 0.0);
  float n = fbm2(p + (fbm2(p * 1.6 - uTime * 0.008) - 0.5) * 1.2);
  float a = smoothstep(0.32, 0.72, n) * band * edge;
  float near = smoothstep(6.0, 40.0, length(vWorld - uCam));
  gl_FragColor = vec4(uPaper, a * near * uDensity * mix(1.0, 0.65, uReveal));
}
`;

const SUN_FRAG = /* glsl */ `
precision highp float;
uniform float uReveal;
varying vec2 vUv;
${NOISE}
void main() {
  vec2 q = vUv - 0.5;
  float d = length(q) * 2.0 / 0.7;
  float wob = (fbm2(q * 9.0) - 0.5) * 0.05;
  float disc = smoothstep(1.0, 0.95, d + wob);
  float tex = 0.82 + 0.18 * fbm2(q * 24.0);
  float glow = smoothstep(1.42, 0.95, d) * 0.1;
  gl_FragColor = vec4(vec3(0.72, 0.2, 0.14) * tex, (disc * 0.78 + glow) * uReveal);
}
`;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PAPER = new THREE.Color('#efe7d6');

export type StationId = 'hero' | 'about' | 'stack' | 'journey' | 'travels' | 'contact' | 'end';
type Station = { id: StationId; pos: THREE.Vector3; look: THREE.Vector3 };

/** 各版块的机位（世界坐标） */
function stations(): Station[] {
  const g = (x: number, z: number) => terrainH(x, z);
  const S = (id: StationId, px: number, pz: number, py: number, lx: number, lz: number, ly: number): Station => ({
    id,
    pos: new THREE.Vector3(px, py, pz),
    look: new THREE.Vector3(lx, ly, lz),
  });
  const pv = { x: pathX(-54) + 17, z: -54 };
  const st = { x: pathX(-270) - 10, z: -270 };
  const ph = { x: pathX(-318) + 15, z: -318 };
  return [
    S('hero', pathX(46), 46, 7, 0, -90, 11),
    S('about', pathX(-20) - 4, -20, g(pathX(-20), -20) + 3.6, pv.x - 7, pv.z, g(pv.x, pv.z) + 5),
    S('stack', pathX(-92), -92, g(pathX(-92), -92) + 2.4, pathX(-135), -135, g(pathX(-135), -135) + 7),
    S('journey', pathX(-150) - 9, -150, RIVER.level + 8, pathX(-205) + 4, -205, RIVER.level + 0.5),
    S('travels', pathX(-247) + 4, -247, g(pathX(-247), -247) + 3.4, st.x + 2.5, st.z, g(st.x, st.z) + 3.5),
    S('contact', pathX(-292) - 2, -292, g(pathX(-292), -292) + 3.4, ph.x - 7, ph.z, g(ph.x, ph.z) + 7),
    S('end', pathX(-285), -285, 52, pathX(-420), -420, 4),
  ];
}

export class Landscape {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly terrain: Terrain;
  readonly props: Props;

  readonly shared = {
    uCam: { value: new THREE.Vector3() },
    uReveal: { value: 0 },
    uGrow: { value: 0 },
    uTime: { value: 0 },
    uPaper: { value: PAPER.clone() },
  };
  private sunMat: THREE.ShaderMaterial;
  private sun: THREE.Mesh;
  private st = stations();
  private posCurve: THREE.CatmullRomCurve3;
  private lookCurve: THREE.CatmullRomCurve3;
  /** 各站在页面滚动中的位置（0..1），由页面布局决定 */
  private stops: number[] = [];
  private tmpPos = new THREE.Vector3();
  private tmpLook = new THREE.Vector3();

  constructor(opts: { lowPower: boolean }) {
    this.scene.background = PAPER.clone();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.3, 1600);
    const rand = mulberry32(20260927);
    const geo = new THREE.PlaneGeometry(1, 1);

    // 尽头的远山（层层叠叠）
    const far: [number, number, number, number, number][] = [
      [0, -420, 700, 150, 0.9],
      [-120, -480, 800, 190, 0.85],
      [140, -540, 900, 230, 0.8],
      [0, -640, 1200, 300, 0.75],
      [0, -760, 1500, 360, 0.7],
    ];
    far.forEach(([x, z, w, h, s]) =>
      this.addRange(geo, { x, z, w, h, rotY: 0, seed: rand() * 100, freq: 3 + rand() * 3, amp: 0.6 + rand() * 0.3, base: 0.12, strength: s }),
    );
    // 两侧的山，斜对着山谷
    for (let i = 0; i < 7; i++) {
      for (const side of [-1, 1]) {
        const z = 30 - i * 62 - rand() * 20;
        this.addRange(geo, {
          x: side * (150 + rand() * 60),
          z,
          w: 260 + rand() * 80,
          h: 110 + rand() * 70,
          rotY: side * -0.95,
          seed: rand() * 100,
          freq: 2 + rand() * 1.6,
          amp: 0.6 + rand() * 0.3,
          base: 0.1,
          strength: 1,
        });
      }
    }
    // 谷中云雾
    for (let i = 0; i < 14; i++) {
      const z = 20 - i * 34 - rand() * 12;
      const mist = new THREE.Mesh(
        geo,
        new THREE.ShaderMaterial({
          vertexShader: VERT,
          fragmentShader: MIST_FRAG,
          uniforms: { ...this.shared, uSeed: { value: rand() * 50 }, uDensity: { value: 0.55 + rand() * 0.3 } },
          transparent: true,
          depthWrite: false,
        }),
      );
      mist.scale.set(260 + rand() * 120, 26 + rand() * 20, 1);
      mist.position.set(pathX(z) + (rand() - 0.5) * 60, terrainH(pathX(z), z) + 4 + rand() * 10, z);
      this.scene.add(mist);
    }
    // 远方云雾带
    for (const z of [-400, -470, -560]) {
      const mist = new THREE.Mesh(
        geo,
        new THREE.ShaderMaterial({
          vertexShader: VERT,
          fragmentShader: MIST_FRAG,
          uniforms: { ...this.shared, uSeed: { value: z * 0.1 }, uDensity: { value: 0.85 } },
          transparent: true,
          depthWrite: false,
        }),
      );
      mist.scale.set(900, 90, 1);
      mist.position.set(0, 0, z);
      this.scene.add(mist);
    }

    // 朱砂日
    this.sunMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: SUN_FRAG,
      uniforms: { uReveal: { value: 0 } },
      transparent: true,
      depthWrite: false,
    });
    this.sun = new THREE.Mesh(geo, this.sunMat);
    this.sun.scale.set(80, 80, 1);
    this.scene.add(this.sun);

    // 地形与草
    this.terrain = new Terrain(this.shared, { tufts: opts.lowPower ? 9000 : 32000, size: opts.lowPower ? 60 : 84 });
    this.scene.add(this.terrain.mesh, this.terrain.grass);

    // 景物
    this.props = new Props(this.shared);
    this.scene.add(this.props.group);

    this.posCurve = new THREE.CatmullRomCurve3(this.st.map((s) => s.pos), false, 'centripetal');
    this.lookCurve = new THREE.CatmullRomCurve3(this.st.map((s) => s.look), false, 'centripetal');
    this.stops = this.st.map((_, i) => i / (this.st.length - 1));
  }

  private addRange(
    geo: THREE.PlaneGeometry,
    p: { x: number; z: number; w: number; h: number; rotY: number; seed: number; freq: number; amp: number; base: number; strength: number },
  ) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: MOUNTAIN_FRAG,
      uniforms: {
        uCam: this.shared.uCam,
        uReveal: this.shared.uReveal,
        uGrow: this.shared.uGrow,
        uSeed: { value: p.seed },
        uFreq: { value: p.freq },
        uAmp: { value: p.amp },
        uBase: { value: p.base },
        uStrength: { value: p.strength },
      },
      transparent: true,
      depthWrite: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(p.w, p.h, 1);
    m.rotation.y = p.rotY;
    m.position.set(p.x, -40 + p.h / 2, p.z);
    this.scene.add(m);
  }

  /** 各站对应的滚动进度（与 stations() 顺序一致） */
  setStops(stops: number[]) {
    if (stops.length === this.st.length) this.stops = stops;
  }

  get stationIds() {
    return this.st.map((s) => s.id);
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 62 : 44;
    this.camera.updateProjectionMatrix();
    const k = Math.min(1, w / h / 1.6);
    this.sun.position.set(90 + 190 * k, 190 + (1 - k) * 90, -820);
  }

  /** 滚动进度 → 曲线参数（按站分段线性，段内再做缓动） */
  private curveT(progress: number) {
    const s = this.stops;
    const n = s.length - 1;
    if (progress <= s[0]) return 0;
    for (let i = 0; i < n; i++) {
      if (progress <= s[i + 1]) {
        const k = (progress - s[i]) / Math.max(s[i + 1] - s[i], 1e-6);
        const e = k * k * (3 - 2 * k);
        return (i + e) / n;
      }
    }
    return 1;
  }

  update(time: number, progress: number, mx: number, my: number, reveal: number, mouseWorld: THREE.Vector3 | null) {
    const t = this.curveT(progress);
    this.posCurve.getPoint(t, this.tmpPos);
    this.lookCurve.getPoint(t, this.tmpLook);
    // 鼠标视差
    this.camera.position.set(this.tmpPos.x + mx * 1.2, this.tmpPos.y + my * 0.6, this.tmpPos.z);
    this.tmpLook.x += mx * 4;
    this.tmpLook.y += my * 2;
    // 镜头不钻进地面
    const ground = terrainH(this.camera.position.x, this.camera.position.z);
    if (this.camera.position.y < ground + 1.2) this.camera.position.y = ground + 1.2;
    this.camera.lookAt(this.tmpLook);

    this.shared.uCam.value.copy(this.camera.position);
    this.shared.uTime.value = time;
    this.shared.uReveal.value = reveal;
    // 首屏纯水墨；过了首屏，草一丛丛冒出来，到结尾漫山遍野
    const aboutAt = this.stops[1] ?? 0.15;
    this.props.vis.value = THREE.MathUtils.smoothstep(progress, aboutAt * 0.15, aboutAt * 0.7);
    this.terrain.haze.value = 1 - THREE.MathUtils.smoothstep(progress, aboutAt * 0.1, aboutAt * 0.8);
    this.shared.uGrow.value = THREE.MathUtils.smoothstep(progress, aboutAt * 0.55, 1.0);
    const portrait = this.camera.aspect < 1;
    const sm = THREE.MathUtils.smoothstep;
    const sunVis = portrait ? Math.max(1 - sm(progress, 0.04, 0.12), sm(progress, 0.85, 0.97)) : 1;
    this.sunMat.uniforms.uReveal.value = reveal * sunVis;

    this.terrain.update(this.camera, mouseWorld);
    this.props.update(this.camera, time);
  }
}
