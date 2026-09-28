import { regions, type Place } from '../content';
import { bind } from '../i18n';

/**
 * 游历页的主视觉：一条竖向蜿蜒的墨线，随滚动由笔尖一路画下去。
 * 笔尖经过哪个地点，哪个墨点落下、题字浮现。
 */

const NS = 'http://www.w3.org/2000/svg';
const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

export function cnIndex(n: number) {
  if (n <= 10) return CN_NUM[n - 1];
  if (n < 20) return '十' + CN_NUM[n - 11];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return CN_NUM[t - 1] + '十' + (o ? CN_NUM[o - 1] : '');
}

function dms(v: number) {
  const d = Math.floor(Math.abs(v));
  const m = Math.round((Math.abs(v) - d) * 60);
  return `${d}°${String(m).padStart(2, '0')}′`;
}

export function coordText(p: Place) {
  return {
    zh: `北纬 ${dms(p.lat)} · 东经 ${dms(p.lon)}`,
    en: `${dms(p.lat)}N · ${dms(p.lon)}E`,
  };
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Route = ReturnType<typeof buildRoute>;

export function buildRoute(track: HTMLElement, places: Place[], onReveal?: (i: number, x: number, y: number) => void) {
  const svg = document.createElementNS(NS, 'svg');
  svg.classList.add('route-svg');
  svg.setAttribute('aria-hidden', 'true');
  const mk = (cls: string) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('class', cls);
    svg.append(p);
    return p;
  };
  const ghost = mk('route-ghost');
  const wash = mk('route-wash');
  const line = mk('route-line');
  const tip = document.createElement('i');
  tip.className = 'route-tip';

  const stops = places.map((p, i) => {
    const el = document.createElement('article');
    el.className = 'stop';
    el.id = `stop-${p.id}`;
    const first = i === 0 || places[i - 1].region !== p.region;
    if (first) el.classList.add('is-region-start');
    const dot = document.createElement('i');
    dot.className = 'stop-dot';
    const card = document.createElement('div');
    card.className = 'stop-card';
    const idx = document.createElement('span');
    idx.className = 'stop-idx';
    bind(idx, { zh: `其${cnIndex(i + 1)}`, en: String(i + 1).padStart(2, '0') });
    const region = bind(document.createElement('span'), regions[p.region]);
    region.className = 'stop-region';
    const name = bind(document.createElement('h2'), p.name);
    name.className = 'stop-name';
    const alt = bind(document.createElement('p'), { zh: p.name.en, en: p.name.zh });
    alt.className = 'stop-alt';
    const coord = bind(document.createElement('p'), coordText(p));
    coord.className = 'stop-coord';
    card.append(idx, region, name, alt, coord);
    el.append(dot, card);
    track.append(el);
    return el;
  });
  track.append(svg, tip);

  let pts: [number, number][] = [];
  let total = 1;
  let samples: { len: number; x: number; y: number }[] = [];
  let stopLen: number[] = [];
  let drawn = 0;
  const on = new Set<number>();

  function layout() {
    const W = track.clientWidth;
    const vh = window.innerHeight;
    const mobile = W < 760;
    const step = Math.max(vh * (mobile ? 0.82 : 0.95), 520);
    const H = step * (places.length + 0.6);
    track.style.height = `${H}px`;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', String(W));
    svg.setAttribute('height', String(H));

    const rand = mulberry32(99);
    const xa = mobile ? 0.12 : 0.1;
    const xb = mobile ? 0.3 : 0.34;
    pts = places.map((_, i) => {
      const side = i % 2 === 0 ? xa : xb;
      return [W * (side + (rand() - 0.5) * 0.05), step * (i + 0.55)];
    });

    // 起笔：从页面顶部斜斜落下
    let d = `M ${W * 0.2} 0 C ${W * 0.26} ${step * 0.2}, ${pts[0][0] + 60} ${pts[0][1] - step * 0.3}, ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const dy = y1 - y0;
      const regionJump = places[i].region !== places[i + 1].region;
      const swing = W * (regionJump ? 0.16 : 0.07) * (rand() * 0.6 + 0.7) * (i % 2 ? -1 : 1);
      d += ` C ${x0 + swing} ${y0 + dy * 0.38}, ${x1 - swing * 0.7} ${y1 - dy * 0.42}, ${x1} ${y1}`;
    }
    // 收笔：未完待续
    const [lx, ly] = pts[pts.length - 1];
    d += ` C ${lx + 40} ${ly + step * 0.15}, ${lx - 30} ${ly + step * 0.3}, ${lx + 10} ${ly + step * 0.42}`;
    for (const p of [line, wash, ghost]) p.setAttribute('d', d);
    total = line.getTotalLength();
    line.style.strokeDasharray = wash.style.strokeDasharray = `${total} ${total}`;

    // 采样：长度 → 坐标，用来把「笔尖所在高度」换算成墨线长度
    samples = [];
    const n = Math.ceil(total / 6);
    for (let k = 0; k <= n; k++) {
      const len = (total * k) / n;
      const p = line.getPointAtLength(len);
      samples.push({ len, x: p.x, y: p.y });
    }
    stopLen = pts.map(([, y]) => lengthAtY(y));

    stops.forEach((s, i) => {
      s.style.left = `${pts[i][0]}px`;
      s.style.top = `${pts[i][1]}px`;
    });
  }

  function lengthAtY(y: number) {
    // 每段贝塞尔的控制点纵坐标递增，整条墨线的 y 随长度单调增加，可以二分
    let lo = 0;
    let hi = samples.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (samples[mid].y < y) lo = mid + 1;
      else hi = mid;
    }
    return samples[lo]?.len ?? total;
  }

  function pointAtLen(len: number) {
    const i = Math.min(samples.length - 1, Math.max(0, Math.round((len / total) * (samples.length - 1))));
    return samples[i];
  }

  /** penY：笔尖在轨道内的纵坐标（px） */
  function update(penY: number, emit = true) {
    drawn = Math.min(total, Math.max(0, lengthAtY(penY)));
    const off = String(total - drawn);
    line.style.strokeDashoffset = off;
    wash.style.strokeDashoffset = off;
    const p = pointAtLen(drawn);
    if (p) tip.style.transform = `translate(${p.x}px, ${p.y}px)`;
    tip.classList.toggle('is-hidden', drawn <= 1 || drawn >= total - 1);

    stops.forEach((s, i) => {
      const reached = drawn >= stopLen[i] - 1;
      s.classList.toggle('is-on', reached);
      if (reached && !on.has(i)) {
        on.add(i);
        if (emit && onReveal) {
          const r = s.getBoundingClientRect();
          onReveal(i, r.left, r.top);
        }
      } else if (!reached) on.delete(i);
    });
    track.classList.toggle('is-done', drawn >= total - 2);
  }

  /** 离笔尖最近的地点 */
  function nearest(penY: number) {
    let best = 0;
    let bd = Infinity;
    pts.forEach(([, y], i) => {
      const d = Math.abs(y - penY);
      if (d < bd) (bd = d), (best = i);
    });
    return best;
  }

  /** 当前地点内的进度（-0.5..0.5 映射到 0..1） */
  function localProgress(penY: number, i: number) {
    const step = pts.length > 1 ? pts[1][1] - pts[0][1] : window.innerHeight;
    return Math.min(1, Math.max(0, (penY - pts[i][1]) / step + 0.5));
  }

  function stopY(i: number) {
    return pts[i]?.[1] ?? 0;
  }

  layout();
  return { layout, update, nearest, localProgress, stopY, stops };
}
