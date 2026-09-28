import type { Place } from '../content';
import { bind } from '../i18n';

/**
 * 墨点舆图：按经纬度摆放各地（只画点和路线，不画疆界），
 * 已走过的路线浓墨、未走的淡墨虚线，当前位置朱砂圈；点击地名跳转。
 */

const NS = 'http://www.w3.org/2000/svg';
const W = 220;
const H = 200;
const LON = [72, 128];
const LAT = [50, 0];

const proj = (p: Place): [number, number] => [
  12 + ((p.lon - LON[0]) / (LON[1] - LON[0])) * (W - 24),
  12 + ((p.lat - LAT[0]) / (LAT[1] - LAT[0])) * (H - 24),
];

export function buildMinimap(root: HTMLElement, places: Place[], onPick: (i: number) => void) {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'map-toggle';
  bind(toggle, { zh: '舆图', en: 'Map' });
  toggle.setAttribute('aria-expanded', 'false');

  const card = document.createElement('div');
  card.className = 'map-card';
  const title = bind(document.createElement('p'), { zh: '舆图 · 行迹所至', en: 'Map · where I have been' });
  title.className = 'map-title';

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.classList.add('map-svg');

  const pts = places.map(proj);
  const d = 'M ' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ');
  const all = document.createElementNS(NS, 'path');
  all.setAttribute('d', d);
  all.setAttribute('class', 'map-route-all');
  const done = document.createElementNS(NS, 'path');
  done.setAttribute('class', 'map-route-done');
  svg.append(all, done);

  // 指北
  const north = document.createElementNS(NS, 'text');
  north.setAttribute('x', String(W - 16));
  north.setAttribute('y', '22');
  north.setAttribute('class', 'map-north');
  north.textContent = '北';
  svg.append(north);

  const dots = places.map((p, i) => {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'map-dot');
    g.setAttribute('transform', `translate(${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)})`);
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    const hit = document.createElementNS(NS, 'circle');
    hit.setAttribute('r', '8');
    hit.setAttribute('class', 'map-hit');
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('r', '2.6');
    const ring = document.createElementNS(NS, 'circle');
    ring.setAttribute('r', '6');
    ring.setAttribute('class', 'map-ring');
    const t = document.createElementNS(NS, 'title');
    g.append(hit, ring, c, t);
    const setTitle = () => (t.textContent = document.documentElement.lang === 'en' ? p.name.en : p.name.zh);
    setTitle();
    new MutationObserver(setTitle).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    const go = () => onPick(i);
    g.addEventListener('click', go);
    g.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), go()));
    svg.append(g);
    return g;
  });

  const label = document.createElement('p');
  label.className = 'map-label';

  card.append(title, svg, label);
  root.append(toggle, card);
  toggle.addEventListener('click', () => {
    const open = root.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  function setCurrent(i: number, name: string) {
    dots.forEach((g, k) => {
      g.classList.toggle('is-visited', k <= i);
      g.classList.toggle('is-current', k === i);
    });
    done.setAttribute('d', 'M ' + pts.slice(0, i + 1).map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L '));
    label.textContent = name;
  }

  return { setCurrent };
}
