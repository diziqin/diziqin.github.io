import { contact, journey, profile, travels, ui, type T } from './content';
import { bind } from './i18n';
import { mainSeal } from './hero/seal';
import { buildStudy } from './home/study';
import { buildSlips } from './home/slips';
import { buildLetter } from './home/letter';

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', children: (Node | string)[] = []) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  el.append(...children);
  return el;
}
const tx = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, t: T) => bind(h(tag, cls), t);

/** 每个版块：左上角题头（序号章 + 标题 + 场景名），下面是场景内容 */
function scene(id: keyof typeof ui.nav, idx: number, place: T, body: Node[]) {
  const s = h('section', `scene scene-${id}`);
  s.id = id;
  const head = h('header', 'scene-head reveal', [
    h('span', 'scene-no', [ui.sectionNo[idx]]),
    tx('h2', 'scene-title', ui.nav[id]),
    tx('span', 'scene-place', place),
  ]);
  s.append(head, h('div', 'scene-body', body));
  return s;
}

export function buildUI(root: HTMLElement, hooks: { onSeal: (sealed: boolean) => void }) {
  /* ---------- 顶栏 ---------- */
  const mark = h('a', 'mark no-ink');
  mark.href = '#hero';
  mark.setAttribute('aria-label', 'Top');
  mark.innerHTML = mainSeal(profile.seal);
  const nav = h('nav', 'nav');
  (Object.keys(ui.nav) as (keyof typeof ui.nav)[]).forEach((k) => {
    const a = tx('a', 'nav-link', ui.nav[k]);
    a.href = k === 'travels' ? '#travels' : `#${k}`;
    nav.append(a);
  });
  const langBtn = tx('button', 'lang-toggle', ui.langToggle);
  langBtn.type = 'button';
  const topbar = h('header', 'topbar', [mark, nav, langBtn]);

  /* ---------- 首屏 ---------- */
  const name = h('div', 'hero-name');
  name.setAttribute('role', 'heading');
  name.setAttribute('aria-level', '1');
  bind(name, profile.name, 'aria-label');
  const seal = h('div', 'hero-seal');
  seal.innerHTML = mainSeal(profile.seal);
  const motto = tx('p', 'hero-motto', profile.motto);
  const side = h('div', 'hero-side', [motto, seal]);
  const stage = h('div', 'hero-stage', [side, name]);
  const sub = h('div', 'hero-sub', [
    tx('p', 'hero-alias', { zh: profile.name.en, en: profile.name.zh }),
    tx('p', 'hero-tagline', profile.tagline),
  ]);
  const hint = h('a', 'scroll-hint no-ink', [tx('span', '', ui.scrollHint), h('i', 'hint-line')]);
  hint.href = '#about';
  const drop = h('i', 'ink-drop');
  const hero = h('section', 'hero', [drop, stage, sub, hint]);
  hero.id = 'hero';

  /* ---------- 自序 · 书房 ---------- */
  const about = scene('about', 0, { zh: '书房 · 研墨写字', en: 'The study · grind ink, write, stamp' }, [buildStudy()]);

  /* ---------- 所学 · 竹林 ---------- */
  const slips = buildSlips();
  const stackScene = scene('stack', 1, { zh: '竹林 · 展卷竹简', en: 'Bamboo grove · unroll the slips' }, [slips.root]);

  /* ---------- 履历 · 江上 ---------- */
  const ferries = h('ol', 'ferries');
  journey.forEach((j, i) => {
    const card = h('li', 'ferry reveal', [
      tx('span', 'ferry-time', j.time),
      tx('h3', 'ferry-org', j.org),
      tx('p', 'ferry-role', j.role),
    ]);
    if (j.desc) card.append(tx('p', 'ferry-desc', j.desc));
    card.style.setProperty('--i', String(i));
    ferries.append(card);
  });
  const journeyScene = scene('journey', 2, { zh: '江上 · 一叶扁舟', en: 'On the river · a small boat' }, [ferries]);

  /* ---------- 游历 · 石碑（通往游历页） ---------- */
  const places = travels.places;
  const W = 220;
  const H = 180;
  const proj = (lat: number, lon: number) => [12 + ((lon - 72) / 56) * (W - 24), 10 + ((50 - lat) / 50) * (H - 20)];
  const pts = places.map((p) => proj(p.lat, p.lon));
  const mapSvg = `<svg class="portal-map" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <path d="M ${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')}" class="portal-route"/>
    ${pts.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i === 0 || i === pts.length - 1 ? 3.4 : 2.2}" class="${i === 0 || i === pts.length - 1 ? 'is-end' : ''}"/>`).join('')}
  </svg>`;
  const count = {
    zh: `足迹 ${places.length} 处 · 自${places[0].name.zh}至${places[places.length - 1].name.zh}`,
    en: `${places.length} places · from ${places[0].name.en} to ${places[places.length - 1].name.en}`,
  };
  const go = tx('a', 'portal-go no-ink', { zh: '展卷 · 游历', en: 'Open the travel scroll' });
  go.href = 'travels.html';
  const mapBox = h('div', 'portal-mapbox');
  mapBox.innerHTML = mapSvg;
  const portal = h('div', 'portal reveal', [tx('p', 'portal-lead', travels.lead), tx('p', 'portal-count', count), mapBox, go]);
  const travelsScene = scene('travels', 3, { zh: '石碑 · 行万里路', en: 'The stele · ten thousand miles' }, [portal]);

  /* ---------- 尺素 · 驿站 ---------- */
  const letter = buildLetter(hooks.onSeal);
  const contactScene = scene('contact', 4, { zh: '驿站 · 八行笺', en: 'Post station · a letter' }, [letter.root]);

  /* ---------- 尾声 ---------- */
  const outro = h('section', 'scene-outro', [
    tx('p', 'outro-line', { zh: '万物生长', en: 'All things grow' }),
    tx('p', 'outro-sub', { zh: 'Xborn · 無限進步', en: 'Xborn · endless progress' }),
  ]);
  outro.id = 'outro';

  const footer = h('footer', 'footer', [h('span', '', [`© ${new Date().getFullYear()} ${profile.name.en} · `]), tx('span', '', ui.footer)]);

  /* ---------- 微信弹窗 ---------- */
  const qr = h('img', 'qr');
  qr.src = contact.wechatQR;
  qr.alt = 'WeChat QR';
  const closeBtn = tx('button', 'modal-close', ui.close);
  closeBtn.type = 'button';
  const modal = h('div', 'modal no-ink', [h('div', 'modal-card', [qr, tx('p', 'modal-tip', ui.wechatTip), closeBtn])]);
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  const openModal = () => {
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('is-open'));
    closeBtn.focus();
  };
  const closeModal = () => {
    modal.classList.remove('is-open');
    setTimeout(() => (modal.hidden = true), 300);
    letter.wechat.focus();
  };
  letter.wechat.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => e.target === modal && closeModal());
  document.addEventListener('keydown', (e) => e.key === 'Escape' && !modal.hidden && closeModal());

  // 过场：点「展卷」时一滴墨铺满屏幕再跳转
  const wipe = h('div', 'ink-wipe');
  const scenes = [about, stackScene, journeyScene, travelsScene, contactScene];
  const main = h('main', 'content', [hero, ...scenes, outro, footer]);
  root.append(topbar, main, modal, wipe);

  return { topbar, hero, name, seal, side, sub, hint, drop, langBtn, scenes, outro, slips, go, wipe };
}
