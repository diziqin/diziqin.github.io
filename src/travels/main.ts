import '../fonts';
import '../base.css';
import './travels.css';
import { profile, travels, ui } from '../content';
import { bind, getLang, onLang, setLang } from '../i18n';
import { installFilters } from '../hero/calligraphy';
import { mainSeal } from '../hero/seal';
import { Scenery } from './scenery';
import { placeholderImage } from './placeholder';
import { buildRoute } from './route';
import { buildMinimap } from './minimap';
import photosJson from '../data/photos.json';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower = matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 8) <= 4;
// 照片与署名由 scripts/fetch-photos.mjs 生成；没有照片的地点用占位景色
type Photo = { id: string; file: string; author: string; license: string; url: string };
const photos = new Map((photosJson as Photo[]).map((p) => [p.id, p]));
const places = travels.places.map((p) => {
  const ph = photos.get(p.id);
  return ph ? { ...p, photo: ph.file, credit: { author: ph.author, license: ph.license, url: ph.url } } : p;
});

installFilters();
const app = document.getElementById('app')!;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', children: (Node | string)[] = []) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  el.append(...children);
  return el;
}

/* ---------- 顶栏 ---------- */
const mark = h('a', 'mark');
mark.href = './';
mark.setAttribute('aria-label', 'Home');
mark.innerHTML = mainSeal(profile.seal);
const back = bind(h('a', 'back-link'), { zh: '← 回到山中', en: '← Back home' });
back.href = './';
const langBtn = bind(h('button', 'lang-toggle'), ui.langToggle);
langBtn.type = 'button';
langBtn.addEventListener('click', () => setLang(getLang() === 'zh' ? 'en' : 'zh'));
const topbar = h('header', 'topbar', [mark, back, langBtn]);

/* ---------- 卷首 ---------- */
const count = {
  zh: ui.travelCount.zh.replace('{n}', String(places.length)),
  en: ui.travelCount.en.replace('{n}', String(places.length)),
};
const intro = h('section', 'tv-intro', [
  bind(h('h1', 'tv-title'), ui.nav.travels),
  h('div', 'tv-intro-text', [
    bind(h('p', 'tv-lead'), travels.lead),
    bind(h('p', 'tv-count'), count),
    bind(h('p', 'tv-hint'), { zh: '向下 · 随墨线出发', en: 'Scroll · follow the ink' }),
  ]),
]);

/* ---------- 墨线 ---------- */
const track = h('div', 'tv-track');

/* ---------- 卷尾 ---------- */
const credits = h('ul', 'tv-credits');
places.forEach((p) => {
  if (!p.credit) return;
  const a = h('a', '', [`${p.credit.author} · ${p.credit.license}`]);
  a.href = p.credit.url;
  a.target = '_blank';
  a.rel = 'noopener';
  const li = h('li', '', [bind(h('span'), p.name), ' — ', a]);
  credits.append(li);
});
const homeLink = bind(h('a', 'tv-home'), { zh: '回到山中', en: 'Back to the mountains' });
homeLink.href = './';
const outro = h('section', 'tv-outro', [
  bind(h('p', 'tv-end'), { zh: '未完待续', en: 'To be continued' }),
  bind(h('p', 'tv-end-sub'), { zh: '下一站，也许就在路上。', en: 'The next stop may already be on the way.' }),
  homeLink,
]);
if (credits.children.length) {
  outro.append(bind(h('p', 'tv-credits-title'), { zh: '图片来源（经水墨化处理）', en: 'Photo credits (ink-wash adaptations)' }), credits);
}

/* ---------- 舆图与上下站 ---------- */
const mapRoot = h('aside', 'minimap');
const prevBtn = bind(h('button', 'hop hop-prev'), { zh: '上一站', en: 'Previous' });
const nextBtn = bind(h('button', 'hop hop-next'), { zh: '下一站', en: 'Next' });
prevBtn.type = nextBtn.type = 'button';
const hops = h('div', 'hops', [prevBtn, nextBtn]);

app.append(topbar, h('main', 'tv-main', [intro, track, outro]), mapRoot, hops);

/* ---------- 背景：水墨化景色 ---------- */
function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`load ${src}`));
    img.src = src;
  });
}
const source = (i: number) => {
  const p = places[i];
  if (!p) return Promise.reject(new Error('no place'));
  if (p.photo) return loadImage(`travels/${p.photo}`).catch(() => placeholderImage(p.id, i));
  return Promise.resolve(placeholderImage(p.id, i));
};

let scenery: Scenery | null = null;
try {
  scenery = new Scenery(document.getElementById('gl') as HTMLCanvasElement, source, { lowPower, reducedMotion: reduced });
  if (import.meta.env.DEV) Object.assign(window, { __scenery: scenery });
} catch (err) {
  console.warn('WebGL 不可用', err);
  document.documentElement.classList.add('no-webgl');
}

const route = buildRoute(track, places, (_i, x, y) => {
  scenery?.splatPx(x, y, 16 * (window.innerHeight / 900), { fast: 0.4, water: 1 });
});

let trackTop = 0;
const measure = () => {
  trackTop = track.getBoundingClientRect().top + window.scrollY;
};

function setRegion() {
  if (!scenery) return;
  const mobile = window.innerWidth < 760;
  // 桌面：画面在右侧，左侧留给墨线与题字；手机：画面在上半部
  if (mobile) scenery.region.set(0, 0.28, 1, 1);
  else scenery.region.set(0.34, 0, 1, 1);
}

const map = buildMinimap(mapRoot, places, (i) => jump(i));

let current = -1;
function jump(i: number) {
  const k = Math.max(0, Math.min(places.length - 1, i));
  window.scrollTo({ top: trackTop + route.stopY(k) - window.innerHeight * 0.55 + 2, behavior: reduced ? 'auto' : 'smooth' });
}
prevBtn.addEventListener('click', () => jump(current - 1));
nextBtn.addEventListener('click', () => jump(current + 1));

let queued = false;
function onScroll() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    const penY = window.scrollY + window.innerHeight * 0.55 - trackTop;
    route.update(penY, !reduced);
    const i = route.nearest(penY);
    if (i !== current) {
      current = i;
      scenery?.show(i);
      map.setCurrent(i, getLang() === 'en' ? places[i].name.en : places[i].name.zh);
    }
    if (scenery) scenery.local = route.localProgress(penY, i);
    prevBtn.disabled = current <= 0;
    nextBtn.disabled = current >= places.length - 1;
    topbar.classList.toggle('is-scrolled', window.scrollY > 40);
  });
}

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => {
  route.layout();
  measure();
  setRegion();
  onScroll();
});
onLang(() => {
  if (current >= 0) map.setCurrent(current, getLang() === 'en' ? places[current].name.en : places[current].name.zh);
});

document.fonts.ready.then(() => {
  route.layout();
  measure();
  onScroll();
});
measure();
setRegion();
onScroll();
document.documentElement.classList.add('is-ready');
