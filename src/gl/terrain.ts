import * as THREE from 'three';
import { NOISE } from './glsl';

/**
 * 地形与 3D 草。
 * 镜头沿着一条蜿蜒的山谷前进：谷底平缓，两侧起伏成草坡，履历一段谷底是江。
 * 草是「跟着镜头走」的一片无限草场：固定数量的草丛在镜头前方的方块里循环平铺，
 * 高度从高度图里取；随风摆动、鼠标拨开、随 uGrow 一丛丛冒出来直到漫山遍野。
 */

/* ---------------- 高度函数（CPU 与 GPU 共用一张高度图） ---------------- */

function hash(x: number, y: number) {
  let h = Math.imul(Math.floor(x) | 0, 374761393) + Math.imul(Math.floor(y) | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, oct = 4) {
  let v = 0;
  let a = 0.5;
  for (let i = 0; i < oct; i++) {
    v += a * vnoise(x, y);
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 9.2;
    a *= 0.5;
  }
  return v;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 山谷中线（镜头大致沿着它走） */
export function pathX(z: number) {
  return 9 * Math.sin(z * 0.013) + 5 * Math.sin(z * 0.029 + 1.3);
}

/** 江段：z 在这个范围里谷底下陷成河道 */
export const RIVER = { z0: -148, z1: -238, level: -8.4 };

export function riverWeight(z: number) {
  return smooth(RIVER.z0 + 14, RIVER.z0 - 6, z) * smooth(RIVER.z1 - 14, RIVER.z1 + 6, z);
}

export function terrainH(x: number, z: number) {
  const d = Math.abs(x - pathX(z));
  const hills = smooth(9, 75, d) * (4 + 22 * fbm(x * 0.011 + 3, z * 0.011));
  const rise = smooth(120, 240, Math.abs(x)) * 30;
  let h = -6 + hills + rise + 1.3 * (fbm(x * 0.07, z * 0.07 + 5) - 0.5);
  h -= riverWeight(z) * 4.2 * (1 - smooth(3, 11, d));
  return h;
}

export const EXTENT = { x0: -280, x1: 280, z0: 90, z1: -560 };

/* ---------------- 地形网格 ---------------- */

const TERRAIN_VERT = /* glsl */ `
varying vec3 vW;
varying vec3 vN;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const GROW = /* glsl */ `
// 生长前沿：与草共用，保证草与地面的绿意同步
float growAt(vec2 xz, float grow) {
  float front = 0.12 + 0.62 * noise2(xz * 0.018 + 3.0) + 0.2 * noise2(xz * 0.07);
  return smoothstep(front - 0.06, front + 0.1, grow * 1.18);
}
`;

const TERRAIN_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uCam;
uniform vec3 uPaper;
uniform float uGrow;
uniform float uReveal;
uniform float uHaze;
varying vec3 vW;
varying vec3 vN;
${NOISE}
${GROW}
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(uCam - vW);
  float dist = length(uCam - vW);
  float fog = smoothstep(30.0, 420.0, dist);

  // 地面以留白为主：只在背光坡与山形轮廓处着一点淡墨，外加少许皴擦
  float shade = smoothstep(0.35, 0.85, 1.0 - dot(n, normalize(vec3(-0.45, 0.8, 0.35))));
  float rim = 1.0 - abs(dot(n, v));
  float cun = fbm2(vW.xz * vec2(0.09, 0.025) + vW.y * 0.05);
  float ink = shade * 0.16 * (0.5 + cun) + smoothstep(0.8, 0.98, rim) * 0.5 + smoothstep(0.62, 0.8, cun) * 0.06;
  ink *= 1.0 - fog;

  float g = growAt(vW.xz, uGrow);
  vec3 green = mix(vec3(0.36, 0.56, 0.34), vec3(0.5, 0.64, 0.33), noise2(vW.xz * 0.03));
  green = mix(green, vec3(0.5, 0.64, 0.64), fog * 0.7);

  vec3 col = mix(uPaper, vec3(0.1, 0.1, 0.11), ink);
  col = mix(col, green * (1.0 - ink * 0.6), g * (0.6 - fog * 0.25));
  col = mix(col, uPaper, fog * 0.9 * (1.0 - g * 0.3));
  // 首屏：山谷笼在薄雾里，只留山坡轮廓
  float edgeInk = smoothstep(0.8, 0.98, rim) * (1.0 - fog);
  col = mix(col, mix(uPaper, vec3(0.1, 0.1, 0.11), edgeInk * 0.35), uHaze * 0.85);
  col = mix(uPaper, col, uReveal);
  gl_FragColor = vec4(col, 1.0);
}
`;

/* ---------------- 草 ---------------- */

const GRASS_VERT = /* glsl */ `
attribute vec2 aLocal;   // 草丛在方块内的位置（0..S）
attribute vec4 aRand;    // 随机数
attribute vec4 aBlade;   // 单根草叶：x/z 偏移、朝向、高度比例
attribute vec2 aT;       // x: 沿叶片 0..1，y: 左右 -1..1
uniform sampler2D uHeight;
uniform vec4 uExtent;    // x0, z0, x1, z1
uniform vec2 uCenter;
uniform float uSize;
uniform float uTime;
uniform float uGrow;
uniform vec3 uMouse;
uniform float uMouseOn;
uniform vec3 uCam;
uniform float uRiver;
varying float vT;
varying float vSide;
varying float vFog;
varying vec3 vTint;
varying float vDark;
${NOISE}
${GROW}
void main() {
  // 循环平铺：取离中心最近的那个周期
  vec2 xz = aLocal + uSize * floor((uCenter - aLocal) / uSize + 0.5);
  vec2 huv = (xz - uExtent.xy) / (uExtent.zw - uExtent.xy);
  float ground = texture2D(uHeight, huv).r;

  float edge = smoothstep(uSize * 0.5, uSize * 0.5 - 14.0, length(xz - uCenter));
  float g = growAt(xz, uGrow);
  float pop = smoothstep(aRand.x * 0.8, aRand.x * 0.8 + 0.2, g); // 同一片里也有先后
  float wet = step(uRiver, ground);                              // 江里不长草
  float h = (0.55 + aRand.y * 0.85) * aBlade.w * pop * edge * wet;

  float t = aT.x;
  float ang = aBlade.z + aRand.z * 6.2831;
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 perp = vec2(-dir.y, dir.x);
  float width = (0.05 + aRand.w * 0.04) * (1.0 - t * 0.85) * pop;

  // 风：成片的阵风波 + 细碎抖动
  float gust = sin(dot(xz, vec2(0.12, 0.07)) - uTime * 1.7) * 0.5 + 0.5;
  float flutter = sin(uTime * 4.0 + aRand.y * 20.0) * 0.08;
  float bend = (0.25 + aRand.w * 0.3 + gust * 0.55 + flutter) * t * t;
  vec2 windDir = normalize(vec2(0.8, 0.35));

  // 鼠标拨草
  vec2 away = xz - uMouse.xz;
  float md = length(away);
  float push = uMouseOn * smoothstep(3.6, 0.3, md);
  vec2 pushDir = away / max(md, 1e-3);

  vec3 base = vec3(xz.x + aBlade.x, ground, xz.y + aBlade.y);
  vec2 lean = dir * 0.2 * t + windDir * bend * 0.55 + pushDir * push * t * 1.1;
  vec3 p = base + vec3(perp.x * width * aT.y, t * h * (1.0 - push * 0.45), perp.y * width * aT.y) + vec3(lean.x, 0.0, lean.y) * h;

  vT = t;
  vSide = aT.y;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vFog = smoothstep(18.0, uSize * 0.62, length(uCam - p));
  float hue = noise2(xz * 0.05) * 0.7 + aRand.z * 0.3;
  vTint = mix(vec3(0.15, 0.28, 0.17), vec3(0.38, 0.52, 0.27), hue);
  vDark = aRand.y;
  gl_Position = projectionMatrix * mv;
}
`;

const GRASS_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uPaper;
varying float vT;
varying float vSide;
varying float vFog;
varying vec3 vTint;
varying float vDark;
void main() {
  // 叶根墨绿、叶尖石绿，中脉略深
  vec3 root = vec3(0.06, 0.09, 0.07);
  vec3 col = mix(root, vTint * (1.15 - vDark * 0.3), smoothstep(0.0, 0.75, vT));
  col *= 0.86 + 0.14 * abs(vSide);
  col = mix(col, uPaper, vFog * 0.85);
  gl_FragColor = vec4(col, 1.0);
}
`;

export type GrassOptions = { tufts: number; size: number };

export class Terrain {
  /** 首屏薄雾（1 = 地面几乎隐去） */
  readonly haze = { value: 1 };
  readonly mesh: THREE.Mesh;
  readonly grass: THREE.Mesh;
  readonly heightTex: THREE.DataTexture;
  private tMat: THREE.ShaderMaterial;
  private gMat: THREE.ShaderMaterial;
  private size: number;

  constructor(shared: { uCam: THREE.IUniform; uPaper: THREE.IUniform; uGrow: THREE.IUniform; uReveal: THREE.IUniform; uTime: THREE.IUniform }, opts: GrassOptions) {
    this.size = opts.size;
    const { x0, x1, z0, z1 } = EXTENT;
    const W = x1 - x0;
    const D = z0 - z1;

    // 地形网格
    const geo = new THREE.PlaneGeometry(W, D, Math.round(W / 4), Math.round(D / 4));
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + cx;
      const z = pos.getZ(i) + cz;
      pos.setY(i, terrainH(x, z));
    }
    geo.computeVertexNormals();
    this.tMat = new THREE.ShaderMaterial({
      vertexShader: TERRAIN_VERT,
      fragmentShader: TERRAIN_FRAG,
      uniforms: { uCam: shared.uCam, uPaper: shared.uPaper, uGrow: shared.uGrow, uReveal: shared.uReveal, uHaze: this.haze },
    });
    this.mesh = new THREE.Mesh(geo, this.tMat);
    this.mesh.position.set(cx, 0, cz);

    // 高度图（半浮点，可线性插值）
    const HW = 256;
    const HD = 300;
    const data = new Uint16Array(HW * HD);
    for (let j = 0; j < HD; j++) {
      for (let i = 0; i < HW; i++) {
        const x = x0 + (i / (HW - 1)) * W;
        const z = z0 + (j / (HD - 1)) * (z1 - z0);
        data[j * HW + i] = THREE.DataUtils.toHalfFloat(terrainH(x, z));
      }
    }
    this.heightTex = new THREE.DataTexture(data, HW, HD, THREE.RedFormat, THREE.HalfFloatType);
    this.heightTex.minFilter = this.heightTex.magFilter = THREE.LinearFilter;
    this.heightTex.needsUpdate = true;

    // 一丛 4 根草叶，每根 3 段
    const BLADES = 4;
    const SEG = 3;
    const aT: number[] = [];
    const aBlade: number[] = [];
    const index: number[] = [];
    const posArr: number[] = [];
    let v = 0;
    for (let b = 0; b < BLADES; b++) {
      const ox = (Math.random() - 0.5) * 0.5;
      const oz = (Math.random() - 0.5) * 0.5;
      const ang = Math.random() * Math.PI * 2;
      const hs = 0.7 + Math.random() * 0.5;
      const start = v;
      for (let s = 0; s <= SEG; s++) {
        const t = s / SEG;
        for (const side of [-1, 1]) {
          aT.push(t, side);
          aBlade.push(ox, oz, ang, hs);
          posArr.push(0, 0, 0);
          v++;
        }
      }
      // 叶尖
      aT.push(1.04, 0);
      aBlade.push(ox, oz, ang, hs);
      posArr.push(0, 0, 0);
      v++;
      for (let s = 0; s < SEG; s++) {
        const a = start + s * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      const last = start + SEG * 2;
      index.push(last, last + 1, v - 1);
    }
    const g = new THREE.InstancedBufferGeometry();
    g.setIndex(index);
    g.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 2));
    g.setAttribute('aBlade', new THREE.Float32BufferAttribute(aBlade, 4));
    const local = new Float32Array(opts.tufts * 2);
    const rand = new Float32Array(opts.tufts * 4);
    for (let i = 0; i < opts.tufts; i++) {
      local[i * 2] = Math.random() * opts.size;
      local[i * 2 + 1] = Math.random() * opts.size;
      for (let k = 0; k < 4; k++) rand[i * 4 + k] = Math.random();
    }
    g.setAttribute('aLocal', new THREE.InstancedBufferAttribute(local, 2));
    g.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 4));
    g.instanceCount = opts.tufts;

    this.gMat = new THREE.ShaderMaterial({
      vertexShader: GRASS_VERT,
      fragmentShader: GRASS_FRAG,
      side: THREE.DoubleSide,
      uniforms: {
        uHeight: { value: this.heightTex },
        uExtent: { value: new THREE.Vector4(x0, z0, x1, z1) },
        uCenter: { value: new THREE.Vector2() },
        uSize: { value: opts.size },
        uTime: shared.uTime,
        uGrow: shared.uGrow,
        uMouse: { value: new THREE.Vector3(0, -999, 0) },
        uMouseOn: { value: 0 },
        uCam: shared.uCam,
        uPaper: shared.uPaper,
        uRiver: { value: RIVER.level + 0.4 },
      },
    });
    this.grass = new THREE.Mesh(g, this.gMat);
    this.grass.frustumCulled = false;
  }

  /** 草场跟着镜头：中心放在镜头前方 */
  update(camera: THREE.PerspectiveCamera, mouse: THREE.Vector3 | null) {
    const f = new THREE.Vector3();
    camera.getWorldDirection(f);
    f.y = 0;
    if (f.lengthSq() < 1e-4) f.set(0, 0, -1);
    f.normalize();
    const ahead = Math.min(this.size * 0.38, 12 + Math.max(0, camera.position.y - terrainH(camera.position.x, camera.position.z)) * 1.2);
    const u = this.gMat.uniforms;
    u.uCenter.value.set(camera.position.x + f.x * ahead, camera.position.z + f.z * ahead);
    if (mouse) {
      u.uMouse.value.copy(mouse);
      u.uMouseOn.value = Math.min(1, u.uMouseOn.value + 0.15);
    } else u.uMouseOn.value = Math.max(0, u.uMouseOn.value - 0.05);
  }

  /** 屏幕射线与地面求交（几次迭代逼近） */
  pick(ray: THREE.Ray): THREE.Vector3 | null {
    if (ray.direction.y > -0.02) return null;
    let t = (-6 - ray.origin.y) / ray.direction.y;
    const p = new THREE.Vector3();
    for (let i = 0; i < 6; i++) {
      ray.at(t, p);
      const h = terrainH(p.x, p.z);
      t += (h - p.y) / ray.direction.y;
    }
    ray.at(t, p);
    return t > 0 && t < 200 ? p : null;
  }
}
