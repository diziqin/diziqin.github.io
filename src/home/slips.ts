import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { stack } from '../content';
import { bind } from '../i18n';

gsap.registerPlugin(Draggable, InertiaPlugin);

/**
 * 竹简：技术栈一片片写在竹简上，按古书习惯从右往左读。
 * 进入视野时从右向左展开；拖动（带惯性）或横向滚轮翻阅。
 */
export function buildSlips() {
  const wrap = document.createElement('div');
  wrap.className = 'slips-wrap no-ink';
  const track = document.createElement('div');
  track.className = 'slips-track';
  wrap.append(track);

  stack.forEach((g, gi) => {
    const title = document.createElement('div');
    title.className = `slip slip-title${gi === stack.length - 1 ? ' is-ai' : ''}`;
    title.append(bind(document.createElement('span'), g.title));
    track.append(title);
    g.items.forEach((it) => {
      const s = document.createElement('div');
      s.className = `slip${gi === stack.length - 1 ? ' is-ai' : ''}`;
      const t = document.createElement('span');
      t.textContent = it;
      s.append(t);
      track.append(s);
    });
    if (gi < stack.length - 1) {
      const gap = document.createElement('div');
      gap.className = 'slip-gap';
      track.append(gap);
    }
  });

  const prev = document.createElement('button');
  const next = document.createElement('button');
  prev.type = next.type = 'button';
  prev.className = 'slips-nav slips-older';
  next.className = 'slips-nav slips-newer';
  bind(prev, { zh: '往后翻', en: 'Read on' }, 'aria-label');
  bind(next, { zh: '往回翻', en: 'Back' }, 'aria-label');
  prev.textContent = '‹';
  next.textContent = '›';
  const hint = bind(document.createElement('p'), { zh: '拖动竹简 · 从右往左翻阅', en: 'Drag the scroll · read right to left' });
  hint.className = 'slips-hint';
  const root = document.createElement('div');
  root.className = 'slips';
  root.append(wrap, prev, next, hint);

  let maxX = 0;
  const [drag] = Draggable.create(track, {
    type: 'x',
    inertia: true,
    edgeResistance: 0.85,
    bounds: { minX: 0, maxX: 0 },
    dragClickables: true,
    onPress() {
      track.classList.add('is-dragging');
    },
    onRelease() {
      track.classList.remove('is-dragging');
    },
  });

  function measure() {
    maxX = Math.max(0, track.offsetWidth - wrap.clientWidth);
    drag.applyBounds({ minX: 0, maxX });
  }
  new ResizeObserver(measure).observe(wrap);

  const nudge = (dir: number) => {
    const x = gsap.getProperty(track, 'x') as number;
    gsap.to(track, { x: Math.min(maxX, Math.max(0, x + dir * wrap.clientWidth * 0.6)), duration: 0.8, ease: 'power3.out', onUpdate: () => drag.update() });
  };
  prev.addEventListener('click', () => nudge(1));
  next.addEventListener('click', () => nudge(-1));

  // 触控板横向滑动
  wrap.addEventListener(
    'wheel',
    (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      const x = gsap.getProperty(track, 'x') as number;
      gsap.set(track, { x: Math.min(maxX, Math.max(0, x - e.deltaX)) });
      drag.update();
    },
    { passive: false },
  );

  /** 展开动画（进入视野时调用） */
  function unroll() {
    measure();
    const slips = track.querySelectorAll('.slip');
    gsap.fromTo(
      slips,
      { rotationY: -80, opacity: 0, transformOrigin: '100% 50%' },
      { rotationY: 0, opacity: 1, duration: 0.7, ease: 'power3.out', stagger: 0.025 },
    );
  }

  return { root, unroll, measure };
}
