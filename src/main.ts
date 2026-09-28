import './fonts';
import './base.css';
import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { profile } from './content';
import { getLang, onLang, setLang } from './i18n';
import { buildUI } from './ui';
import { installFilters, writeName, type BrushCallback } from './hero/calligraphy';
import { Engine } from './gl/engine';
import { buildHotspots } from './home/hotspots';

gsap.registerPlugin(ScrollTrigger);

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower = matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 8) <= 4;

// 开场叙事从顶部开始（带锚点访问时除外）
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const toTop = () => !location.hash && window.scrollTo({ top: 0, behavior: 'instant' });
toTop();

installFilters();
let sealed = false;
const els = buildUI(document.getElementById('app')!, { onSeal: (v) => (sealed = v) });

/* ---------- WebGL ---------- */
let engine: Engine | null = null;
try {
  engine = new Engine(document.getElementById('gl') as HTMLCanvasElement, { lowPower, reducedMotion: reduced });
  if (import.meta.env.DEV) {
    const e = engine;
    Object.assign(window, { __engine: e, __gsap: gsap, __ST: ScrollTrigger });
    // 开发时预览面板被隐藏会暂停 rAF，用定时器顶上，方便调试
    let lastRaf = performance.now();
    const mark = () => {
      lastRaf = performance.now();
      requestAnimationFrame(mark);
    };
    requestAnimationFrame(mark);
    setInterval(() => {
      if (performance.now() - lastRaf > 100) {
        gsap.ticker.tick();
        e.tick();
      }
    }, 16);
  }
} catch (err) {
  console.warn('WebGL 不可用，使用静态背景', err);
  document.documentElement.classList.add('no-webgl');
}

/* ---------- 书写时笔下洇墨 ---------- */
let lastBrush: { x: number; y: number } | null = null;
const onBrush: BrushCallback = (x, y, t) => {
  if (!engine) return;
  const glyph = els.name.firstElementChild as HTMLElement | null;
  const size = glyph ? glyph.getBoundingClientRect().height : 200;
  const r = Math.max(size * 0.05, 5);
  if (!lastBrush || t < 0.03 || Math.hypot(x - lastBrush.x, y - lastBrush.y) > size * 0.3) lastBrush = { x, y };
  engine.splatPx(lastBrush.x, lastBrush.y, r, { slow: 0.018, water: 0.65 }, x, y);
  lastBrush = { x, y };
};

/* ---------- 开场 ---------- */
let nameTl: gsap.core.Timeline | null = null;
let introTl: gsap.core.Timeline | null = null;
const heroBits = [els.side.querySelector('.hero-motto')!, ...els.sub.children, els.hint];

function waitFonts() {
  return Promise.race([
    Promise.all([
      document.fonts.load('900 80px "Noto Serif TC"', profile.seal),
      document.fonts.load('400 40px "Zhi Mang Xing"', profile.motto.zh),
      document.fonts.load('400 80px "Ma Shan Zheng"', profile.name.en),
    ]),
    new Promise((r) => setTimeout(r, 2000)),
  ]);
}

async function intro() {
  await waitFonts();
  toTop();
  document.documentElement.classList.add('is-ready');
  nameTl = writeName(els.name, profile.name[getLang()], onBrush);

  if (reduced) {
    nameTl.progress(1);
    if (engine) engine.reveal = 1;
    return;
  }

  gsap.set([els.topbar, els.seal, ...heroBits], { autoAlpha: 0 });
  gsap.set(els.side.querySelector('.hero-motto'), { '--p': 0, autoAlpha: 1 });

  const tl = gsap.timeline({ delay: 0.35 });
  introTl = tl;

  // 1. 一滴墨落下
  const r = els.name.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height * 0.5;
  gsap.set(els.drop, { x: cx, y: -40, autoAlpha: 1, scaleY: 1.4 });
  tl.to(els.drop, { y: cy, scaleY: 1.8, duration: 0.75, ease: 'power2.in' });
  tl.call(() => {
    gsap.set(els.drop, { autoAlpha: 0 });
    if (!engine) return;
    const s = window.innerHeight / 900;
    engine.splatPx(cx, cy, 34 * s, { slow: 0.55, water: 1.2 });
    engine.splatPx(cx, cy, 120 * s, { water: 0.9 });
    // 溅出的小墨点
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = (60 + Math.random() * 90) * s;
      engine.splatPx(cx + Math.cos(a) * d, cy + Math.sin(a) * d, (4 + Math.random() * 6) * s, { slow: 0.5, water: 0.6 });
    }
  });

  // 2. 逐笔书写名字
  tl.add(nameTl.paused(false), '+=0.7');

  // 3. 山水从雾中显现
  if (engine) tl.to(engine, { reveal: 1, duration: 4.5, ease: 'power2.inOut' }, '<+=1');

  // 4. 题款与盖印
  tl.to(els.side.querySelector('.hero-motto'), { '--p': 1, duration: 1.6, ease: 'power1.inOut' }, '>-0.4');
  tl.fromTo(
    els.seal,
    { autoAlpha: 0, scale: 1.9, rotate: -10 },
    { autoAlpha: 1, scale: 1, rotate: -2, duration: 0.32, ease: 'power4.in' },
    '>-0.1',
  );
  tl.to('.hero-stage', { y: 2, duration: 0.05, yoyo: true, repeat: 1, ease: 'none' });

  // 5. 其余信息
  tl.to([...els.sub.children, els.hint, els.topbar], { autoAlpha: 1, y: 0, duration: 1, stagger: 0.12, ease: 'power2.out' }, '>+0.1');

  // 用户开始滚动/点击，就加速把开场播完
  const hurry = () => {
    if (tl.progress() < 1) tl.timeScale(4);
    window.removeEventListener('wheel', hurry);
    window.removeEventListener('touchstart', hurry);
    window.removeEventListener('keydown', hurry);
  };
  window.addEventListener('wheel', hurry, { passive: true });
  window.addEventListener('touchstart', hurry, { passive: true });
  window.addEventListener('keydown', hurry);
}

/* ---------- 滚动：镜头在各站之间飞行 ---------- */
function computeStops() {
  if (!engine) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const center = (el: HTMLElement) => {
    const top = el.getBoundingClientRect().top + window.scrollY;
    return Math.min(1, Math.max(0, (top + el.offsetHeight / 2 - window.innerHeight / 2) / max));
  };
  const stops = [0, ...els.scenes.map(center), 1];
  // 保证严格递增
  for (let i = 1; i < stops.length; i++) stops[i] = Math.max(stops[i], stops[i - 1] + 0.01);
  engine.land.setStops(stops.map((v) => Math.min(v, 1)));
}

function setupScroll() {
  if (engine) {
    const e = engine;
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (s) => (e.targetProgress = s.progress),
    });
    ScrollTrigger.create({
      trigger: els.hero,
      start: 'top top',
      end: 'bottom top',
      onUpdate: (s) => (e.heroInk = 1 - s.progress),
    });
    // 履历：船随滚动顺流而下
    ScrollTrigger.create({
      trigger: els.scenes[2],
      start: 'top 80%',
      end: 'bottom 20%',
      onUpdate: (s) => (e.land.props.boatT = s.progress),
    });
    ScrollTrigger.addEventListener('refresh', computeStops);
  }

  if (!reduced) {
    gsap.to('.hero-stage, .hero-sub', {
      yPercent: -18,
      opacity: 0,
      ease: 'none',
      scrollTrigger: { trigger: els.hero, start: 'top top', end: 'bottom 15%', scrub: true },
    });
  }

  els.scenes.forEach((sc) => {
    const items = sc.querySelectorAll('.reveal');
    if (reduced) return;
    gsap.from(items, {
      autoAlpha: 0,
      y: 36,
      filter: 'blur(6px)',
      duration: 1.1,
      stagger: 0.1,
      ease: 'power3.out',
      scrollTrigger: { trigger: sc, start: 'top 70%' },
    });
  });
  // 竹简：进入视野时展开
  ScrollTrigger.create({ trigger: els.scenes[1], start: 'top 65%', once: true, onEnter: () => (reduced ? els.slips.measure() : els.slips.unroll()) });

  // 导航高亮
  els.scenes.forEach((p) => {
    const link = els.topbar.querySelector(`a[href="#${p.id}"]`);
    ScrollTrigger.create({
      trigger: p,
      start: 'top center',
      end: 'bottom center',
      onToggle: (s) => link?.classList.toggle('is-active', s.isActive),
    });
  });
  ScrollTrigger.create({
    start: 40,
    end: 'max',
    onToggle: (s) => els.topbar.classList.toggle('is-scrolled', s.isActive),
  });

  // 游历入口：一滴墨铺满屏幕后翻页
  els.go.addEventListener('click', (ev) => {
    if (reduced) return;
    ev.preventDefault();
    const r = els.go.getBoundingClientRect();
    els.wipe.style.setProperty('--x', `${r.left + r.width / 2}px`);
    els.wipe.style.setProperty('--y', `${r.top + r.height / 2}px`);
    els.wipe.classList.add('is-on');
    engine?.splatPx(r.left + r.width / 2, r.top + r.height / 2, 60, { fast: 1.2, water: 1.4 });
    setTimeout(() => (location.href = els.go.href), 900);
  });
  window.addEventListener('pageshow', () => els.wipe.classList.remove('is-on'));
}

/* ---------- 场景式导航：山水里的题签 ---------- */
function setupHotspots() {
  if (!engine) return;
  const e = engine;
  const hs = buildHotspots(
    e.land.props.anchors,
    e.land.camera,
    (id) => document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }),
    (id) => e.land.props.highlight(id),
  );
  document.body.append(hs.layer);
  let active: string | null = null;
  els.scenes.forEach((sc) =>
    ScrollTrigger.create({ trigger: sc, start: 'top 60%', end: 'bottom 40%', onToggle: (s) => s.isActive && (active = sc.id) }),
  );
  ScrollTrigger.create({ trigger: els.hero, start: 'top top', end: 'bottom 40%', onToggle: (s) => s.isActive && (active = null) });
  e.onFrame = () => hs.update(active, e.reveal > 0.6 && e.land.props.vis.value > 0.6);
  // 封缄后，雁阵飞得更快
  let boost = 0;
  gsap.ticker.add(() => {
    boost += ((sealed ? 1 : 0) - boost) * 0.02;
    e.land.props.geeseBoost = boost;
  });
}

/* ---------- 语言切换 ---------- */
els.langBtn.addEventListener('click', () => setLang(getLang() === 'zh' ? 'en' : 'zh'));
onLang((l) => {
  introTl?.progress(1);
  nameTl?.kill();
  nameTl = writeName(els.name, profile.name[l], onBrush, 1.7);
  if (reduced) nameTl.progress(1);
  else nameTl.paused(false);
  requestAnimationFrame(() => ScrollTrigger.refresh());
});

setupScroll();
setupHotspots();
intro();
document.fonts.ready.then(() => {
  engine?.land.props.refreshText();
  ScrollTrigger.refresh();
});
