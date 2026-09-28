import * as THREE from 'three';
import { NOISE } from './glsl';
import { pathX, RIVER, terrainH } from './terrain';

/**
 * 山谷里的景物：亭（书房）、竹林、江与乌篷船、石碑（游历）、驿站与鸿雁、几株松。
 * 全部用 Canvas 画成水墨贴图，再作为面朝镜头的立牌放进 3D 场景。
 */

type Ctx = CanvasRenderingContext2D;
const INK = '#1c1b18';
const PAPER = 'rgba(239,231,214,1)';

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** 墨色晕边：先画一层模糊的淡墨，再画实形 */
function inkShape(c: Ctx, draw: () => void, fill: string | CanvasGradient, bleed = 6) {
  c.save();
  c.filter = `blur(${bleed}px)`;
  c.globalAlpha = 0.35;
  c.fillStyle = fill;
  draw();
  c.fill();
  c.restore();
  c.fillStyle = fill;
  draw();
  c.fill();
}

function groundWash(c: Ctx, cx: number, cy: number, rx: number, ry: number, a = 0.28) {
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, `rgba(28,27,24,${a})`);
  g.addColorStop(1, 'rgba(28,27,24,0)');
  c.save();
  c.scale(1, ry / rx);
  c.fillStyle = g;
  c.beginPath();
  c.arc(cx, (cy * rx) / ry, rx, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/* ---------------- 亭 ---------------- */
function drawPavilion() {
  const [cv, c] = canvas(512, 512);
  groundWash(c, 256, 468, 240, 30);
  c.fillStyle = '#3b3934';
  c.fillRect(92, 432, 328, 20);
  c.fillRect(206, 452, 100, 12);
  // 后柱（淡）与前柱（浓）
  c.fillStyle = 'rgba(58,56,51,0.5)';
  c.fillRect(178, 262, 9, 170);
  c.fillRect(325, 262, 9, 170);
  c.fillStyle = '#24221e';
  c.fillRect(126, 252, 15, 182);
  c.fillRect(371, 252, 15, 182);
  // 栏杆
  c.strokeStyle = '#2d2b26';
  c.lineWidth = 3;
  for (const y of [392, 412]) {
    c.beginPath();
    c.moveTo(141, y);
    c.lineTo(371, y);
    c.stroke();
  }
  c.lineWidth = 2;
  for (let x = 156; x < 371; x += 18) {
    c.beginPath();
    c.moveTo(x, 392);
    c.lineTo(x, 432);
    c.stroke();
  }
  c.fillStyle = '#2a2824';
  c.fillRect(116, 242, 280, 12);
  // 攒尖顶，檐角起翘
  const roof = () => {
    c.beginPath();
    c.moveTo(20, 206);
    c.quadraticCurveTo(118, 240, 256, 238);
    c.quadraticCurveTo(394, 240, 492, 206);
    c.lineTo(478, 198);
    c.quadraticCurveTo(362, 196, 302, 118);
    c.lineTo(256, 78);
    c.lineTo(210, 118);
    c.quadraticCurveTo(150, 196, 34, 198);
    c.closePath();
  };
  const g = c.createLinearGradient(0, 80, 0, 240);
  g.addColorStop(0, '#171613');
  g.addColorStop(1, '#4b4841');
  inkShape(c, roof, g, 5);
  c.strokeStyle = 'rgba(239,231,214,0.16)';
  c.lineWidth = 2;
  for (let i = -4; i <= 4; i++) {
    c.beginPath();
    c.moveTo(256, 84);
    c.quadraticCurveTo(256 + i * 26, 150, 256 + i * 54, 234 - Math.abs(i) * 5);
    c.stroke();
  }
  c.fillStyle = INK;
  c.beginPath();
  c.arc(256, 70, 9, 0, Math.PI * 2);
  c.fill();
  c.fillRect(254, 44, 4, 26);
  return cv;
}

/* ---------------- 松 ---------------- */
function drawPine(seed: number) {
  const [cv, c] = canvas(256, 512);
  const r = rng(seed);
  groundWash(c, 128, 496, 90, 12, 0.2);
  c.strokeStyle = '#2b2721';
  c.lineCap = 'round';
  c.lineWidth = 14;
  c.beginPath();
  c.moveTo(128, 505);
  c.bezierCurveTo(110, 400, 160, 300, 118, 120);
  c.stroke();
  // 枝：从主干斜伸出去
  c.lineWidth = 4;
  const clusters: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const y = 120 + i * 42 + r() * 14;
    const side = i % 2 ? 1 : -1;
    const x0 = 118 + (128 - y / 4) * 0.05;
    const x1 = x0 + side * (40 + r() * 50);
    const y1 = y - 10 - r() * 20;
    c.beginPath();
    c.moveTo(x0, y);
    c.quadraticCurveTo((x0 + x1) / 2, y - 18, x1, y1);
    c.stroke();
    clusters.push([x1, y1], [(x0 + x1) / 2, y - 8]);
  }
  // 松针：一簇簇放射状的墨线，底下衬一层淡墨
  for (const [x, y] of clusters) {
    c.fillStyle = 'rgba(40,58,44,0.22)';
    c.beginPath();
    c.ellipse(x, y - 4, 34, 12, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = `rgba(${18 + r() * 10},${26 + r() * 10},${20 + r() * 8},0.85)`;
    c.lineWidth = 1.8;
    for (let k = 0; k < 26; k++) {
      const a = Math.PI * (1.05 + (k / 25) * 0.9) + (r() - 0.5) * 0.12;
      const len = 16 + r() * 18;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * 0.55);
      c.stroke();
    }
  }
  return cv;
}

/* ---------------- 墨竹（三种） ---------------- */
function drawBamboo(variant: number) {
  const [cv, c] = canvas(160, 1024);
  const r = rng(40 + variant * 7);
  const lean = (r() - 0.5) * 40;
  const top = 60;
  const x = (y: number) => 80 + lean * Math.pow(1 - y / 1024, 2);
  // 竹竿：一节节
  let y = 1024;
  while (y > top) {
    const seg = 70 + r() * 30;
    const y2 = Math.max(top, y - seg);
    const w = 5 + (y / 1024) * 6;
    c.fillStyle = '#34432f';
    c.beginPath();
    c.moveTo(x(y) - w, y);
    c.lineTo(x(y2) - w * 0.9, y2 + 4);
    c.lineTo(x(y2) + w * 0.9, y2 + 4);
    c.lineTo(x(y) + w, y);
    c.fill();
    c.fillStyle = '#141a12';
    c.fillRect(x(y2) - w - 2, y2, w * 2 + 4, 4);
    y = y2;
  }
  // 竹叶：个字、介字形的簇
  for (let i = 0; i < 16; i++) {
    const yy = top + 40 + r() * 560;
    const xx = x(yy) + (r() - 0.5) * 20;
    const n = 3 + Math.floor(r() * 3);
    const baseA = (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.9) + Math.PI / 2;
    for (let k = 0; k < n; k++) {
      const a = baseA + (k - n / 2) * 0.32 + (r() - 0.5) * 0.2;
      const len = 44 + r() * 38;
      c.fillStyle = `rgba(${20 + r() * 16},${34 + r() * 18},${22 + r() * 10},${0.78 + r() * 0.2})`;
      c.beginPath();
      c.moveTo(xx, yy);
      const tx = xx + Math.cos(a) * len;
      const ty = yy + Math.sin(a) * len;
      const nx = -Math.sin(a) * 7;
      const ny = Math.cos(a) * 7;
      c.quadraticCurveTo((xx + tx) / 2 + nx, (yy + ty) / 2 + ny, tx, ty);
      c.quadraticCurveTo((xx + tx) / 2 - nx * 0.4, (yy + ty) / 2 - ny * 0.4, xx, yy);
      c.fill();
    }
  }
  return cv;
}

/* ---------------- 乌篷船 ---------------- */
function drawBoat() {
  const [cv, c] = canvas(512, 256);
  inkShape(
    c,
    () => {
      c.beginPath();
      c.moveTo(24, 150);
      c.quadraticCurveTo(80, 176, 256, 178);
      c.quadraticCurveTo(430, 176, 492, 146);
      c.quadraticCurveTo(470, 206, 256, 212);
      c.quadraticCurveTo(60, 208, 24, 150);
    },
    '#23211d',
    4,
  );
  inkShape(
    c,
    () => {
      c.beginPath();
      c.moveTo(170, 176);
      c.bezierCurveTo(176, 96, 322, 92, 330, 176);
      c.closePath();
    },
    '#16150f',
    4,
  );
  c.strokeStyle = 'rgba(239,231,214,0.22)';
  c.lineWidth = 2;
  for (let i = 1; i < 5; i++) {
    c.beginPath();
    c.moveTo(170 + i * 32, 176);
    c.quadraticCurveTo(170 + i * 32, 110, 250, 104);
    c.stroke();
  }
  // 船夫与竹篙
  c.strokeStyle = INK;
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(430, 40);
  c.lineTo(350, 240);
  c.stroke();
  c.fillStyle = '#1e1c18';
  c.beginPath();
  c.moveTo(396, 170);
  c.lineTo(412, 104);
  c.lineTo(428, 170);
  c.fill();
  c.beginPath();
  c.moveTo(390, 106);
  c.lineTo(412, 84);
  c.lineTo(434, 106);
  c.fill();
  return cv;
}

/* ---------------- 石碑 ---------------- */
function drawStele(font: string) {
  const [cv, c] = canvas(256, 512);
  groundWash(c, 128, 488, 120, 16, 0.3);
  c.fillStyle = '#3a3731';
  c.beginPath();
  c.ellipse(128, 470, 96, 26, 0, 0, Math.PI * 2);
  c.fill();
  const body = () => {
    c.beginPath();
    c.moveTo(62, 462);
    c.lineTo(62, 150);
    c.quadraticCurveTo(62, 96, 128, 90);
    c.quadraticCurveTo(194, 96, 194, 150);
    c.lineTo(194, 462);
    c.closePath();
  };
  const g = c.createLinearGradient(62, 0, 194, 0);
  g.addColorStop(0, '#2c2a25');
  g.addColorStop(0.6, '#4a463e');
  g.addColorStop(1, '#2a2823');
  inkShape(c, body, g, 3);
  c.strokeStyle = 'rgba(239,231,214,0.25)';
  c.lineWidth = 2;
  c.strokeRect(82, 170, 92, 260);
  c.fillStyle = 'rgba(239,231,214,0.86)';
  c.font = `76px ${font}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('游', 128, 238);
  c.fillText('历', 128, 346);
  return cv;
}

/* ---------------- 驿站 ---------------- */
function drawPostHouse(font: string) {
  const [cv, c] = canvas(512, 384);
  groundWash(c, 250, 356, 240, 20, 0.28);
  // 白墙：纸色打底，墨线勾边，墙脚淡墨
  c.fillStyle = '#ebe2cf';
  c.fillRect(120, 226, 262, 124);
  const foot = c.createLinearGradient(0, 300, 0, 350);
  foot.addColorStop(0, 'rgba(40,36,30,0)');
  foot.addColorStop(1, 'rgba(40,36,30,0.35)');
  c.fillStyle = foot;
  c.fillRect(120, 300, 262, 50);
  c.strokeStyle = '#2a2722';
  c.lineWidth = 3;
  c.strokeRect(120, 226, 262, 124);
  // 门与花窗
  c.fillStyle = '#1b1915';
  c.fillRect(226, 266, 52, 84);
  c.strokeStyle = '#2a2722';
  c.lineWidth = 2;
  for (const x of [146, 308]) {
    c.strokeRect(x, 258, 50, 36);
    for (let k = 1; k < 4; k++) {
      c.beginPath();
      c.moveTo(x + k * 12.5, 258);
      c.lineTo(x + k * 12.5, 294);
      c.stroke();
    }
  }
  const roof = () => {
    c.beginPath();
    c.moveTo(78, 214);
    c.quadraticCurveTo(160, 236, 251, 234);
    c.quadraticCurveTo(342, 236, 424, 214);
    c.lineTo(410, 206);
    c.quadraticCurveTo(360, 198, 330, 150);
    c.lineTo(172, 150);
    c.quadraticCurveTo(142, 198, 92, 206);
    c.closePath();
  };
  inkShape(c, roof, '#1d1b17', 4);
  // 瓦垄
  c.strokeStyle = 'rgba(239,231,214,0.18)';
  c.lineWidth = 2;
  for (let x = 180; x <= 324; x += 12) {
    c.beginPath();
    c.moveTo(x, 152);
    c.lineTo(x + (x - 251) * 0.35, 228);
    c.stroke();
  }
  // 旗杆与「驿」字旗
  c.fillStyle = '#26231e';
  c.fillRect(448, 40, 6, 312);
  c.fillStyle = '#a82a20';
  c.beginPath();
  c.moveTo(454, 52);
  c.lineTo(506, 58);
  c.lineTo(500, 176);
  c.lineTo(454, 170);
  c.closePath();
  c.fill();
  c.fillStyle = PAPER;
  c.font = `40px ${font}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('驿', 479, 114);
  // 门前一棵树：枝干 + 点叶法（一团团横点）
  const r = rng(11);
  c.strokeStyle = '#26221c';
  c.lineCap = 'round';
  c.lineWidth = 10;
  c.beginPath();
  c.moveTo(62, 352);
  c.bezierCurveTo(56, 280, 74, 230, 60, 150);
  c.stroke();
  c.lineWidth = 4;
  for (const [x, y, dx, dy] of [
    [62, 250, -36, -40],
    [64, 215, 34, -46],
    [60, 180, -20, -50],
  ]) {
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + dx * 0.4, y + dy * 0.6, x + dx, y + dy);
    c.stroke();
  }
  for (let i = 0; i < 140; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 62;
    const x = 62 + Math.cos(a) * d * 1.1;
    const y = 150 + Math.sin(a) * d * 0.75;
    c.fillStyle = `rgba(${22 + r() * 16},${30 + r() * 20},${22 + r() * 10},${0.55 + r() * 0.35})`;
    c.beginPath();
    c.ellipse(x, y, 7 + r() * 5, 3 + r() * 2, (r() - 0.5) * 0.6, 0, Math.PI * 2);
    c.fill();
  }
  return cv;
}

/* ---------------- 鸿雁（两帧） ---------------- */
function drawGoose() {
  const [cv, c] = canvas(128, 40);
  c.strokeStyle = INK;
  c.lineWidth = 3.2;
  c.lineCap = 'round';
  // 翅上扬
  c.beginPath();
  c.moveTo(6, 10);
  c.quadraticCurveTo(22, 20, 32, 24);
  c.quadraticCurveTo(42, 20, 58, 8);
  c.stroke();
  // 翅下压
  c.beginPath();
  c.moveTo(70, 26);
  c.quadraticCurveTo(84, 18, 96, 22);
  c.quadraticCurveTo(108, 18, 122, 28);
  c.stroke();
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(32, 24, 5, 3, 0, 0, Math.PI * 2);
  c.ellipse(96, 22, 5, 3, 0, 0, Math.PI * 2);
  c.fill();
  return cv;
}

/* ---------------- 材质 ---------------- */

const BILL_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vW;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const BILL_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform vec3 uCam;
uniform vec3 uPaper;
uniform float uReveal;
uniform float uHi;
uniform float uVis;
varying vec2 vUv;
varying vec3 vW;
${NOISE}
void main() {
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.02) discard;
  float fog = smoothstep(40.0, 380.0, length(uCam - vW));
  float grain = 0.88 + 0.24 * noise2(vUv * vec2(90.0, 120.0));
  vec3 col = mix(t.rgb, uPaper, fog * 0.85);
  col = mix(col, vec3(0.69, 0.16, 0.12), uHi * 0.25);
  gl_FragColor = vec4(col, t.a * grain * (1.0 - fog * 0.4) * uReveal * uVis);
}
`;

const BAMBOO_VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec3 aInfo; // x: 宽, y: 高, z: 变体
attribute float aPhase;
uniform vec3 uCam;
uniform float uTime;
varying vec2 vUv;
varying vec3 vW;
void main() {
  vec3 toCam = uCam - aPos;
  toCam.y = 0.0;
  vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x));
  float sway = sin(uTime * 0.9 + aPhase) * 0.6 + sin(uTime * 2.1 + aPhase * 3.0) * 0.15;
  vec3 p = aPos + right * position.x * aInfo.x + vec3(0.0, position.y * aInfo.y, 0.0);
  p.xz += vec2(0.7, 0.3) * sway * position.y * position.y * 2.0;
  vUv = vec2((uv.x + aInfo.z) / 3.0, uv.y);
  vW = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const WATER_VERT = BILL_VERT;
const WATER_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uCam;
uniform vec3 uPaper;
uniform float uTime;
uniform float uReveal;
uniform float uVis;
uniform vec3 uBoat;
varying vec2 vUv;
varying vec3 vW;
${NOISE}
void main() {
  float bank = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
  float fog = smoothstep(30.0, 300.0, length(uCam - vW));
  // 水纹：一道道横向的淡墨线，随流缓慢移动
  float z = vW.z + noise2(vW.xz * 0.2) * 2.5 - uTime * 0.6;
  float wave = smoothstep(0.86, 1.0, sin(z * 1.3)) * (0.35 + 0.65 * noise2(vW.xz * vec2(0.35, 0.8) + uTime * 0.05));
  // 船尾的人字形涟漪
  vec2 d = vW.xz - uBoat.xz;
  float wake = smoothstep(0.9, 1.0, sin(length(d) * 2.2 - uTime * 3.0)) * smoothstep(9.0, 1.0, length(d)) * step(0.0, d.y);
  vec3 col = mix(uPaper * vec3(0.93, 0.96, 0.98), vec3(0.2, 0.24, 0.26), (wave * 0.5 + wake * 0.6) * (1.0 - fog));
  gl_FragColor = vec4(col, bank * 0.95 * uReveal * uVis);
}
`;

export type Anchor = { id: 'about' | 'stack' | 'journey' | 'travels' | 'contact'; label: { zh: string; en: string }; pos: THREE.Vector3 };

type Shared = { uCam: THREE.IUniform; uPaper: THREE.IUniform; uReveal: THREE.IUniform; uTime: THREE.IUniform };

export class Props {
  readonly group = new THREE.Group();
  readonly anchors: Anchor[] = [];
  /** 船在江上的位置 0..1（由履历段的滚动控制） */
  boatT = 0;
  /** 封缄后雁阵加速（0..1） */
  geeseBoost = 0;
  private geeseX = 0;
  private lastTime = 0;
  /** 景物整体可见度（首屏时隐去） */
  readonly vis = { value: 0 };
  private boat: THREE.Mesh;
  private boatMat: THREE.ShaderMaterial;
  private water: THREE.ShaderMaterial;
  private geese: THREE.Mesh;
  private geeseMat: THREE.ShaderMaterial;
  private billboards: THREE.Mesh[] = [];
  private hiMats = new Map<string, THREE.ShaderMaterial>();
  private redraw: (() => void)[] = [];

  constructor(private shared: Shared) {
    const at = (x: number, z: number, lift = 0) => new THREE.Vector3(x, terrainH(x, z) + lift, z);

    // 亭（书房）与松
    const pav = this.billboard(drawPavilion(), 13, 13, at(pathX(-54) + 17, -54, -0.6), 'about');
    this.anchors.push({ id: 'about', label: { zh: '书房', en: 'Study' }, pos: pav.position.clone().add(new THREE.Vector3(0, 12, 0)) });
    [
      [pathX(-60) + 26, -60, 1],
      [pathX(-47) + 9, -47, 2],
      [pathX(-40) - 16, -40, 3],
    ].forEach(([x, z, s]) => this.billboard(drawPine(s), 7, 14, at(x, z, -0.4)));

    // 竹林：谷底两侧
    this.buildBamboo(at);
    this.anchors.push({ id: 'stack', label: { zh: '竹林', en: 'Bamboo' }, pos: at(pathX(-122) + 7, -122, 13) });

    // 江与船
    this.water = new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uCam: shared.uCam, uPaper: shared.uPaper, uTime: shared.uTime, uReveal: shared.uReveal, uVis: this.vis, uBoat: { value: new THREE.Vector3() } },
    });
    this.group.add(this.buildRiver());
    this.boatMat = this.billboardMat(drawBoat(), 'journey');
    this.boat = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), this.boatMat);
    this.group.add(this.boat);
    this.billboards.push(this.boat);
    this.anchors.push({ id: 'journey', label: { zh: '渡口', en: 'Ferry' }, pos: new THREE.Vector3() });

    // 石碑（游历）
    const font = "'Ma Shan Zheng', 'KaiTi', serif";
    const stTex = new THREE.CanvasTexture(drawStele(font));
    const stele = this.billboardFromTex(stTex, 4.2, 8.4, at(pathX(-270) - 10, -270, -0.3), 'travels');
    this.redraw.push(() => {
      stTex.image = drawStele(font);
      stTex.needsUpdate = true;
    });
    this.anchors.push({ id: 'travels', label: { zh: '游历', en: 'Travels' }, pos: stele.position.clone().add(new THREE.Vector3(0, 6, 0)) });

    // 驿站
    const phTex = new THREE.CanvasTexture(drawPostHouse(font));
    const post = this.billboardFromTex(phTex, 16, 12, at(pathX(-318) + 15, -318, -0.5), 'contact');
    this.redraw.push(() => {
      phTex.image = drawPostHouse(font);
      phTex.needsUpdate = true;
    });
    this.anchors.push({ id: 'contact', label: { zh: '驿站', en: 'Post' }, pos: post.position.clone().add(new THREE.Vector3(0, 9, 0)) });

    // 鸿雁
    this.geeseMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute vec3 aOff;
        attribute float aPhase;
        uniform vec3 uFlock;
        uniform vec3 uCam;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vW;
        void main() {
          vec3 c = uFlock + aOff;
          c.y += sin(uTime * 1.3 + aPhase) * 0.3;
          vec3 toCam = normalize(uCam - c);
          vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
          vec3 up = cross(toCam, right);
          vec3 p = c + right * position.x * 2.4 + up * position.y * 0.75;
          float frame = mod(floor(uTime * 5.0 + aPhase * 3.0), 2.0);
          vUv = vec2((uv.x + frame) * 0.5, uv.y);
          vW = p;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: BILL_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uMap: { value: new THREE.CanvasTexture(drawGoose()) },
        uFlock: { value: new THREE.Vector3() },
        uCam: shared.uCam,
        uPaper: shared.uPaper,
        uReveal: shared.uReveal,
        uTime: shared.uTime,
        uHi: { value: 0 },
        uVis: this.vis,
      },
    });
    const gg = new THREE.InstancedBufferGeometry();
    const plane = new THREE.PlaneGeometry(1, 1);
    gg.index = plane.index;
    gg.setAttribute('position', plane.attributes.position);
    gg.setAttribute('uv', plane.attributes.uv);
    // 人字形雁阵（从侧面看得见）
    const offs: number[] = [];
    const phases: number[] = [];
    for (let i = 0; i < 9; i++) {
      const row = Math.ceil(i / 2);
      const side = i === 0 ? 0 : i % 2 ? 1 : -1;
      offs.push(-row * 2.8, side * row * 1.1, side * row * 0.6);
      phases.push(Math.random() * 6);
    }
    gg.setAttribute('aOff', new THREE.InstancedBufferAttribute(new Float32Array(offs), 3));
    gg.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(phases), 1));
    gg.instanceCount = 9;
    this.geese = new THREE.Mesh(gg, this.geeseMat);
    this.geese.frustumCulled = false;
    this.group.add(this.geese);
  }

  private billboardMat(src: HTMLCanvasElement, hiKey?: string) {
    return this.matFromTex(new THREE.CanvasTexture(src), hiKey);
  }

  private matFromTex(tex: THREE.Texture, hiKey?: string) {
    tex.colorSpace = THREE.NoColorSpace;
    const m = new THREE.ShaderMaterial({
      vertexShader: BILL_VERT,
      fragmentShader: BILL_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: { uMap: { value: tex }, uCam: this.shared.uCam, uPaper: this.shared.uPaper, uReveal: this.shared.uReveal, uHi: { value: 0 }, uVis: this.vis },
    });
    if (hiKey) this.hiMats.set(hiKey, m);
    return m;
  }

  private billboard(src: HTMLCanvasElement, w: number, h: number, pos: THREE.Vector3, hiKey?: string) {
    return this.billboardFromTex(new THREE.CanvasTexture(src), w, h, pos, hiKey);
  }

  private billboardFromTex(tex: THREE.Texture, w: number, h: number, pos: THREE.Vector3, hiKey?: string) {
    const geo = new THREE.PlaneGeometry(w, h);
    geo.translate(0, h / 2, 0);
    const m = new THREE.Mesh(geo, this.matFromTex(tex, hiKey));
    m.position.copy(pos);
    this.group.add(m);
    this.billboards.push(m);
    return m;
  }

  private buildBamboo(at: (x: number, z: number, lift?: number) => THREE.Vector3) {
    const atlas = document.createElement('canvas');
    atlas.width = 480;
    atlas.height = 1024;
    const ac = atlas.getContext('2d')!;
    for (let v = 0; v < 3; v++) ac.drawImage(drawBamboo(v), v * 160, 0);
    const tex = new THREE.CanvasTexture(atlas);
    tex.colorSpace = THREE.NoColorSpace;

    const r = rng(7);
    const pos: number[] = [];
    const info: number[] = [];
    const phase: number[] = [];
    let n = 0;
    for (let i = 0; i < 90; i++) {
      const z = -92 - r() * 58;
      const side = r() < 0.5 ? -1 : 1;
      const x = pathX(z) + side * (4.5 + r() * 26);
      const p = at(x, z, -0.3);
      pos.push(p.x, p.y, p.z);
      const hh = 12 + r() * 9;
      info.push(hh * 0.16, hh, Math.floor(r() * 3));
      phase.push(r() * 6.28);
      n++;
    }
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    base.translate(0, 0.5, 0);
    g.index = base.index;
    g.setAttribute('position', base.attributes.position);
    g.setAttribute('uv', base.attributes.uv);
    g.setAttribute('aPos', new THREE.InstancedBufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('aInfo', new THREE.InstancedBufferAttribute(new Float32Array(info), 3));
    g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(phase), 1));
    g.instanceCount = n;
    const mat = new THREE.ShaderMaterial({
      vertexShader: BAMBOO_VERT,
      fragmentShader: BILL_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: { uMap: { value: tex }, uCam: this.shared.uCam, uPaper: this.shared.uPaper, uReveal: this.shared.uReveal, uTime: this.shared.uTime, uHi: { value: 0 }, uVis: this.vis },
    });
    this.hiMats.set('stack', mat);
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    this.group.add(mesh);
  }

  private buildRiver() {
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const z0 = RIVER.z0 + 8;
    const z1 = RIVER.z1 - 8;
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const z = z0 + ((z1 - z0) * i) / steps;
      const cx = pathX(z);
      pos.push(cx - 10, RIVER.level, z, cx + 10, RIVER.level, z);
      uv.push(0, i / steps, 1, i / steps);
      if (i < steps) {
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return new THREE.Mesh(g, this.water);
  }

  /** 字体加载后重画带字的贴图 */
  refreshText() {
    this.redraw.forEach((f) => f());
  }

  highlight(id: string | null) {
    for (const [k, m] of this.hiMats) m.uniforms.uHi.value = k === id ? 1 : 0;
  }

  update(camera: THREE.PerspectiveCamera, time: number) {
    // 立牌只绕竖轴转向镜头
    for (const b of this.billboards) {
      const dx = camera.position.x - b.position.x;
      const dz = camera.position.z - b.position.z;
      b.rotation.y = Math.atan2(dx, dz);
    }
    // 船顺流而下，随波起伏
    const z = THREE.MathUtils.lerp(RIVER.z0 - 16, RIVER.z1 + 22, this.boatT);
    this.boat.position.set(pathX(z) + 1.5, RIVER.level - 0.35 + Math.sin(time * 1.4) * 0.08, z);
    this.boat.rotation.z = Math.sin(time * 1.1) * 0.02;
    this.water.uniforms.uBoat.value.copy(this.boat.position);
    const a = this.anchors.find((k) => k.id === 'journey');
    if (a) a.pos.copy(this.boat.position).add(new THREE.Vector3(0, 5, 0));
    // 雁阵：从左往右掠过驿站上空，循环；封缄后飞得更快
    const dt = Math.min(0.1, Math.max(0, time - this.lastTime));
    this.lastTime = time;
    const span = 260;
    this.geeseX = (this.geeseX + dt * 5 * (1 + this.geeseBoost * 5)) % span;
    const x = this.geeseX - span / 2;
    this.geeseMat.uniforms.uFlock.value.set(pathX(-330) + x, terrainH(pathX(-330), -330) + 30, -336);
  }
}
