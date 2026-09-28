/**
 * 没有照片时的占位景色：用 Canvas 画一张带当地特征的「假照片」，再交给水墨化管线处理。
 * 照片放进 public/travels/ 并在 src/data/photos.json 里登记后会自动替换（fetch-photos.mjs 会自动登记）。
 */

type Ctx = CanvasRenderingContext2D;

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const W = 1600;
const H = 1000;

function sky(c: Ctx, top = '#9fb8cf', bottom = '#e9e4d6') {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(0.65, bottom);
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
}

function range(c: Ctx, r: () => number, base: number, amp: number, color: string, rough = 0.5, sharp = 1) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(0, H);
  let y = base;
  for (let x = 0; x <= W; x += 8) {
    const t = x / W;
    const peaks = Math.pow(Math.abs(Math.sin(t * Math.PI * (1.5 + rough * 2) + r() * 0.05)), sharp) * amp;
    y = base - peaks - Math.sin(t * 17 + rough * 9) * amp * 0.08 - r() * amp * 0.04;
    c.lineTo(x, y);
  }
  c.lineTo(W, H);
  c.closePath();
  c.fill();
}

function water(c: Ctx, y: number, color = '#7f98a8') {
  const g = c.createLinearGradient(0, y, 0, H);
  g.addColorStop(0, color);
  g.addColorStop(1, '#4d6270');
  c.fillStyle = g;
  c.fillRect(0, y, W, H - y);
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const yy = y + 10 + i * i * 0.4;
    c.beginPath();
    c.moveTo((i * 97) % W, yy);
    c.lineTo(((i * 97) % W) + 60 + i * 3, yy);
    c.stroke();
  }
}

function skyline(c: Ctx, r: () => number, base: number, n: number, maxH: number, color = '#3c4652') {
  c.fillStyle = color;
  let x = 0;
  for (let i = 0; i < n && x < W; i++) {
    const w = 30 + r() * 70;
    const h = maxH * (0.25 + r() * 0.75);
    c.fillRect(x, base - h, w, h);
    x += w + r() * 12;
  }
}

function trees(c: Ctx, r: () => number, base: number, n: number, color = '#2f4a32') {
  c.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const s = 20 + r() * 40;
    c.beginPath();
    c.moveTo(x, base - s * 2.2);
    c.lineTo(x - s * 0.6, base);
    c.lineTo(x + s * 0.6, base);
    c.fill();
  }
}

function pagoda(c: Ctx, x: number, base: number, levels: number, s: number, color = '#2b2b2b') {
  c.fillStyle = color;
  let y = base;
  for (let i = 0; i < levels; i++) {
    const w = s * (1 - i * 0.08);
    c.fillRect(x - w * 0.35, y - s * 0.5, w * 0.7, s * 0.5);
    c.beginPath();
    c.moveTo(x - w * 0.7, y - s * 0.5);
    c.quadraticCurveTo(x, y - s * 0.75, x + w * 0.7, y - s * 0.5);
    c.lineTo(x + w * 0.5, y - s * 0.62);
    c.lineTo(x - w * 0.5, y - s * 0.62);
    c.fill();
    y -= s * 0.62;
  }
  c.fillRect(x - 3, y - s * 0.5, 6, s * 0.5);
}

function dome(c: Ctx, x: number, base: number, s: number, color = '#3a3530', onion = false) {
  c.fillStyle = color;
  c.fillRect(x - s * 0.5, base - s, s, s);
  c.beginPath();
  if (onion) {
    c.moveTo(x - s * 0.5, base - s);
    c.bezierCurveTo(x - s * 0.8, base - s * 1.5, x - s * 0.1, base - s * 1.7, x, base - s * 2.1);
    c.bezierCurveTo(x + s * 0.1, base - s * 1.7, x + s * 0.8, base - s * 1.5, x + s * 0.5, base - s);
  } else c.arc(x, base - s, s * 0.5, Math.PI, 0);
  c.fill();
}

function arch(c: Ctx, x0: number, x1: number, y: number, rise: number, color = '#5b5b58') {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x0 - 40, y - rise * 0.2);
  c.quadraticCurveTo((x0 + x1) / 2, y - rise * 1.4, x1 + 40, y - rise * 0.2);
  c.lineTo(x1 + 40, y - rise * 0.05);
  c.lineTo(x1, y + 20);
  c.quadraticCurveTo((x0 + x1) / 2, y - rise, x0, y + 20);
  c.lineTo(x0 - 40, y - rise * 0.05);
  c.fill();
}

function wheel(c: Ctx, x: number, y: number, rad: number, color = '#333') {
  c.strokeStyle = color;
  c.lineWidth = 6;
  c.beginPath();
  c.arc(x, y, rad, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = 2;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    c.stroke();
  }
  c.lineWidth = 10;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x - rad * 0.5, y + rad * 1.3);
  c.moveTo(x, y);
  c.lineTo(x + rad * 0.5, y + rad * 1.3);
  c.stroke();
}

function tower(c: Ctx, x: number, base: number, h: number, color = '#2e3640') {
  c.fillStyle = color;
  c.fillRect(x - 8, base - h, 16, h);
  c.beginPath();
  c.arc(x, base - h * 0.35, h * 0.08, 0, Math.PI * 2);
  c.arc(x, base - h * 0.72, h * 0.055, 0, Math.PI * 2);
  c.fill();
}

function karst(c: Ctx, r: () => number, base: number, n: number, color: string) {
  c.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const w = 80 + r() * 120;
    const h = 180 + r() * 320;
    c.beginPath();
    c.moveTo(x - w, base);
    c.bezierCurveTo(x - w * 0.8, base - h * 0.8, x - w * 0.3, base - h, x, base - h);
    c.bezierCurveTo(x + w * 0.3, base - h, x + w * 0.8, base - h * 0.8, x + w, base);
    c.fill();
  }
}

type Kind =
  | 'desert' | 'snowpeak' | 'alpine' | 'cathedral' | 'city' | 'coast' | 'wheel' | 'temple' | 'bridge'
  | 'plain' | 'willowlake' | 'hills' | 'wall' | 'skyline' | 'pagodalake' | 'harbor' | 'karst' | 'marina';

const KIND: Record<string, Kind> = {
  kashgar: 'desert', urumqi: 'snowpeak', altay: 'alpine', harbin: 'cathedral', changchun: 'city', dalian: 'coast',
  tianjin: 'wheel', beijing: 'temple', shijiazhuang: 'bridge', dezhou: 'plain', jinan: 'willowlake', zibo: 'plain',
  weihai: 'coast', qingdao: 'coast', xuzhou: 'hills', nanjing: 'wall', shanghai: 'skyline', hangzhou: 'pagodalake',
  xiamen: 'coast', shenzhen: 'skyline', hongkong: 'harbor', guizhou: 'karst', singapore: 'marina',
};

export function placeholderImage(id: string, seed: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  const r = rng(seed * 7919 + 17);
  const kind = KIND[id] ?? 'hills';

  switch (kind) {
    case 'desert':
      sky(c, '#b9c7d2', '#efe0c4');
      range(c, r, 560, 120, '#b7a58b', 0.3, 1.4);
      for (let i = 0; i < 5; i++) dome(c, 380 + i * 190, 720, 70 + (i % 2) * 40, '#5a4a3c');
      c.fillStyle = '#4a3c30';
      c.fillRect(300, 380, 36, 340);
      c.fillRect(1250, 380, 36, 340);
      c.fillStyle = '#d6c09a';
      c.fillRect(0, 720, W, H - 720);
      break;
    case 'snowpeak':
      sky(c, '#7fa3c4', '#e6ecef');
      range(c, r, 520, 320, '#8c9aa8', 0.6, 3);
      range(c, r, 540, 200, '#f4f6f8', 0.6, 4);
      skyline(c, r, 860, 40, 220, '#48525c');
      break;
    case 'alpine':
      sky(c, '#86a9c8', '#eef0ea');
      range(c, r, 470, 260, '#7d8d97', 0.5, 2);
      range(c, r, 600, 160, '#3e5a44', 0.8, 1.2);
      trees(c, r, 690, 70, '#27402b');
      water(c, 690, '#6f9aa0');
      break;
    case 'cathedral':
      sky(c, '#9fb0bf', '#f1f1ee');
      skyline(c, r, 820, 20, 160, '#7b7f86');
      dome(c, 800, 700, 180, '#3b3531', true);
      dome(c, 620, 740, 90, '#3b3531', true);
      dome(c, 980, 740, 90, '#3b3531', true);
      c.fillStyle = '#f6f6f4';
      c.fillRect(0, 820, W, H - 820);
      break;
    case 'city':
      sky(c);
      range(c, r, 640, 90, '#98a39a', 0.4, 1);
      skyline(c, r, 780, 50, 320);
      water(c, 780);
      break;
    case 'coast':
      sky(c, '#8fb2cf', '#eef0ec');
      range(c, r, 560, 140, '#6c7d74', 0.7, 1.4);
      skyline(c, r, 600, 16, 120, '#51606a');
      water(c, 600, '#6b93ab');
      pagoda(c, 1180, 640, 1, 90, '#3a3a3a');
      break;
    case 'wheel':
      sky(c);
      skyline(c, r, 760, 40, 260, '#56606a');
      wheel(c, 820, 470, 230, '#2d3136');
      water(c, 760);
      break;
    case 'temple':
      sky(c, '#9db7d3', '#efe8d8');
      trees(c, r, 820, 60, '#35523a');
      c.fillStyle = '#2d2d33';
      for (let i = 0; i < 3; i++) {
        const w = 380 - i * 90;
        const y = 720 - i * 130;
        c.beginPath();
        c.ellipse(800, y, w, 46, 0, Math.PI, 0);
        c.fill();
        c.fillStyle = i % 2 ? '#2d2d33' : '#6d3a32';
        c.fillRect(800 - w * 0.6, y, w * 1.2, 80);
        c.fillStyle = '#2d2d33';
      }
      c.fillStyle = '#d8d2c6';
      c.fillRect(300, 800, 1000, 60);
      break;
    case 'bridge':
      sky(c);
      range(c, r, 560, 80, '#9aa597', 0.3, 1);
      trees(c, r, 660, 40, '#3b563f');
      water(c, 700, '#7b949a');
      arch(c, 480, 1120, 700, 180, '#5a5954');
      break;
    case 'plain':
      sky(c, '#a6bccc', '#efe9da');
      range(c, r, 640, 50, '#a6ad9a', 0.2, 1);
      trees(c, r, 700, 90, '#445d40');
      c.fillStyle = '#b9b48f';
      c.fillRect(0, 700, W, H - 700);
      for (let i = 0; i < 12; i++) {
        c.strokeStyle = 'rgba(70,80,50,0.4)';
        c.beginPath();
        c.moveTo(800, 700);
        c.lineTo(i * 150 - 100, H);
        c.stroke();
      }
      break;
    case 'willowlake':
      sky(c);
      range(c, r, 560, 150, '#7c8c80', 0.6, 1.5);
      water(c, 640, '#86a0a2');
      c.strokeStyle = '#3d5536';
      c.lineWidth = 3;
      for (let i = 0; i < 60; i++) {
        const x = 1000 + r() * 500;
        c.beginPath();
        c.moveTo(x, 300 + r() * 60);
        c.quadraticCurveTo(x + 20, 450, x + 5 - r() * 20, 560 + r() * 120);
        c.stroke();
      }
      pagoda(c, 380, 640, 1, 120, '#3a3432');
      break;
    case 'hills':
      sky(c);
      range(c, r, 540, 180, '#8a998c', 0.7, 1.3);
      range(c, r, 660, 120, '#56705a', 0.9, 1.1);
      water(c, 740, '#7d99a0');
      pagoda(c, 1100, 520, 3, 70, '#353331');
      break;
    case 'wall':
      sky(c);
      range(c, r, 520, 200, '#6d7f73', 0.5, 1.4);
      c.fillStyle = '#5c5850';
      c.fillRect(0, 620, W, 130);
      c.fillStyle = '#4a463f';
      for (let x = 0; x < W; x += 40) c.fillRect(x, 596, 24, 24);
      c.fillStyle = '#26221f';
      c.beginPath();
      c.moveTo(700, 750);
      c.lineTo(700, 680);
      c.arc(800, 680, 100, Math.PI, 0);
      c.lineTo(900, 750);
      c.fill();
      pagoda(c, 800, 596, 2, 120, '#2e2b28');
      water(c, 750, '#72898d');
      break;
    case 'skyline':
      sky(c, '#9ab3c9', '#ece9e0');
      skyline(c, r, 760, 60, 380, '#4d5864');
      tower(c, 520, 760, 560, '#27303a');
      c.fillStyle = '#27303a';
      c.fillRect(980, 190, 80, 570);
      c.fillRect(1180, 260, 70, 500);
      water(c, 760);
      break;
    case 'pagodalake':
      sky(c, '#a9bfd0', '#efeae0');
      range(c, r, 560, 160, '#7a8a80', 0.5, 1.2);
      pagoda(c, 1050, 560, 5, 80, '#3a302b');
      water(c, 600, '#8fa6a8');
      c.fillStyle = '#4f5a4c';
      c.fillRect(0, 610, 700, 14);
      break;
    case 'harbor':
      sky(c, '#8fa7bf', '#ebe8e0');
      range(c, r, 480, 260, '#5e7166', 0.6, 1.2);
      skyline(c, r, 700, 70, 330, '#3e4853');
      water(c, 700, '#5e8298');
      break;
    case 'karst':
      sky(c, '#b2c2cc', '#eef0ea');
      karst(c, r, 760, 9, '#8c9c90');
      karst(c, r, 840, 7, '#4e6a52');
      c.fillStyle = '#f2f4f2';
      c.fillRect(760, 420, 70, 360);
      water(c, 820, '#7d9aa0');
      break;
    case 'marina':
      sky(c, '#96b4cc', '#eeece4');
      skyline(c, r, 700, 40, 300, '#4c5864');
      c.fillStyle = '#2a323c';
      for (let i = 0; i < 3; i++) c.fillRect(620 + i * 170, 330, 90, 370);
      c.fillRect(580, 300, 600, 40);
      c.beginPath();
      c.ellipse(1300, 700, 160, 60, 0, Math.PI, 0);
      c.fill();
      water(c, 700, '#6891a8');
      break;
  }
  return cv;
}
