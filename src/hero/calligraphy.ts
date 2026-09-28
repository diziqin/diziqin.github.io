import gsap from 'gsap';

/**
 * 毛笔逐笔书写。
 * 汉字：用 Make Me a Hanzi 的笔画轮廓 + 中线数据，按真实笔顺描出（src/data/strokes/<字>.json）。
 * 缺数据的字或拉丁字母：用毛笔字体 + 从左到右的笔刷遮罩揭开。
 */

type HanziData = { strokes: string[]; medians: [number, number][][] };

const files = import.meta.glob<HanziData>('../data/strokes/*.json', { eager: true, import: 'default' });
const HANZI: Record<string, HanziData> = {};
for (const [path, data] of Object.entries(files)) {
  const ch = decodeURIComponent(path.split('/').pop()!.replace('.json', ''));
  HANZI[ch] = data;
}

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** 落笔回调：页面像素坐标 + 当前笔画进度 */
export type BrushCallback = (x: number, y: number, t: number) => void;

export function canWriteHanzi(text: string) {
  return [...text].every((c) => HANZI[c]);
}

type Median = { pts: [number, number][]; cum: number[]; len: number };

function prepareMedian(raw: [number, number][]): Median {
  const pts = raw.map((p) => [p[0], p[1]] as [number, number]);
  // 起笔向后延伸，保证笔头圆角被完整覆盖
  if (pts.length >= 2) {
    const [x0, y0] = pts[0];
    const [x1, y1] = pts[1];
    const d = Math.hypot(x0 - x1, y0 - y1) || 1;
    pts.unshift([x0 + ((x0 - x1) / d) * 80, y0 + ((y0 - y1) / d) * 80]);
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return { pts, cum, len: cum[cum.length - 1] };
}

function pointAt(m: Median, s: number): [number, number] {
  for (let i = 1; i < m.pts.length; i++) {
    if (m.cum[i] >= s) {
      const t = (s - m.cum[i - 1]) / Math.max(m.cum[i] - m.cum[i - 1], 1e-6);
      return [
        m.pts[i - 1][0] + (m.pts[i][0] - m.pts[i - 1][0]) * t,
        m.pts[i - 1][1] + (m.pts[i][1] - m.pts[i - 1][1]) * t,
      ];
    }
  }
  return m.pts[m.pts.length - 1];
}

/** 汉字逐笔书写，返回时间线（未开始播放） */
export function writeHanzi(container: HTMLElement, text: string, onBrush?: BrushCallback, speed = 1) {
  container.innerHTML = '';
  const tl = gsap.timeline({ paused: true });

  [...text].forEach((ch, ci) => {
    const data = HANZI[ch];
    const svg = svgEl('svg', { viewBox: '0 0 1024 1024', class: 'glyph', 'aria-hidden': 'true' });
    const defs = svgEl('defs');
    const brush = svgEl('g', { filter: 'url(#ink-brush)' });
    const flip = svgEl('g', { transform: 'translate(0 900) scale(1 -1)' });
    svg.append(defs, brush);
    brush.append(flip);
    container.append(svg);

    data.strokes.forEach((d, si) => {
      const id = `cp${uid++}`;
      const clip = svgEl('clipPath', { id });
      clip.append(svgEl('path', { d }));
      defs.append(clip);

      const m = prepareMedian(data.medians[si]);
      const path = svgEl('path', {
        d: 'M ' + m.pts.map((p) => `${p[0]} ${p[1]}`).join(' L '),
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 200,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'clip-path': `url(#${id})`,
        'stroke-dasharray': `${m.len} ${m.len}`,
        'stroke-dashoffset': m.len,
        visibility: 'hidden', // 圆头线帽在长度为 0 时也会画出一个点，先藏起来
      });
      flip.append(path);

      const state = { s: 0 };
      const dur = (0.16 + m.len / 1500) / speed;
      tl.to(
        state,
        {
          s: m.len,
          duration: dur,
          ease: 'sine.inOut',
          onUpdate: () => {
            path.setAttribute('visibility', state.s > 0 ? 'visible' : 'hidden');
            path.setAttribute('stroke-dashoffset', String(m.len - state.s));
            if (onBrush) {
              const [x, y] = pointAt(m, state.s);
              const r = svg.getBoundingClientRect();
              onBrush(r.left + (x / 1024) * r.width, r.top + ((900 - y) / 1024) * r.height, state.s / m.len);
            }
          },
        },
        si === 0 ? (ci === 0 ? 0 : `+=${0.28 / speed}`) : `+=${0.07 / speed}`,
      );
    });
  });
  return tl;
}

/** 字体书写（拉丁字母或缺笔画数据的字）：笔刷遮罩从左往右揭开 */
export function writeFont(container: HTMLElement, text: string, onBrush?: BrushCallback, speed = 1) {
  container.innerHTML = '';
  const span = document.createElement('span');
  span.className = 'font-name';
  span.textContent = text;
  container.append(span);
  const state = { p: 0 };
  span.style.setProperty('--p', '0');
  const tl = gsap.timeline({ paused: true });
  const letters = [...text].length;
  tl.to(state, {
    p: 1,
    duration: (0.5 + letters * 0.32) / speed,
    ease: 'power1.inOut',
    onUpdate: () => {
      span.style.setProperty('--p', state.p.toFixed(4));
      if (onBrush) {
        const r = span.getBoundingClientRect();
        const x = r.left + r.width * state.p;
        const y = r.top + r.height * (0.55 + Math.sin(state.p * letters * Math.PI * 2) * 0.18);
        onBrush(x, y, state.p);
      }
    },
  });
  return tl;
}

export function writeName(container: HTMLElement, text: string, onBrush?: BrushCallback, speed = 1) {
  container.classList.toggle('is-hanzi', canWriteHanzi(text));
  container.classList.toggle('is-font', !canWriteHanzi(text));
  return canWriteHanzi(text) ? writeHanzi(container, text, onBrush, speed) : writeFont(container, text, onBrush, speed);
}

/** 全局 SVG 滤镜：毛笔边缘 + 飞白；印章做旧 */
export function installFilters() {
  const holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  holder.setAttribute('aria-hidden', 'true');
  holder.innerHTML = `
<svg width="0" height="0">
  <defs>
    <filter id="ink-brush" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="3" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="16" xChannelSelector="R" yChannelSelector="G" result="rough"/>
      <feGaussianBlur in="rough" stdDeviation="4" result="bleed"/>
      <feComponentTransfer in="bleed" result="bleedA"><feFuncA type="linear" slope="0.3"/></feComponentTransfer>
      <feMerge><feMergeNode in="bleedA"/><feMergeNode in="rough"/></feMerge>
    </filter>
    <filter id="ink-brush-px" x="-5%" y="-10%" width="110%" height="120%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="5" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="seal-rough" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="4" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="2" seed="11" result="speck"/>
      <feColorMatrix in="speck" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -10 6.6" result="speckA"/>
      <feComposite in="d" in2="speckA" operator="in"/>
    </filter>
  </defs>
</svg>`;
  document.body.prepend(holder);
}
