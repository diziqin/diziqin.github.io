import { leisureSeals, profile, ui, type T } from '../content';
import { bind, onLang } from '../i18n';
import { leisureSeal, mainSeal } from '../hero/seal';
import { clearStampsIn, makeStampable } from './stamps';

/**
 * 书房案头：研墨 → 提笔蘸墨 → 在宣纸上写字（运笔快细慢粗、墨尽飞白）→ 拖印章盖印。
 */

const HINTS: Record<string, T> = {
  grind: { zh: '按住墨锭，在砚台里画圈研墨', en: 'Hold the ink stick and circle it on the inkstone' },
  brush: { zh: '墨已研好 · 点毛笔提笔，再点砚台蘸墨', en: 'Ink ready · pick up the brush, then dip it in the inkstone' },
  dip: { zh: '点砚台蘸墨', en: 'Dip the brush in the inkstone' },
  write: { zh: '在纸上书写 · 墨尽时回砚台蘸墨', en: 'Write on the paper · dip again when the ink runs dry' },
  stamp: { zh: '写好了？拖一方印章盖上', en: 'Done? Drag a seal onto your work' },
  done: { zh: '落款成章 · 印章也能盖在页面任何地方', en: 'Signed and sealed · seals work anywhere on the page' },
};

const BRUSH_SVG = `<svg viewBox="0 0 40 220" aria-hidden="true"><defs><linearGradient id="bh" x1="0" x2="1"><stop offset="0" stop-color="#6b4a2c"/><stop offset=".5" stop-color="#9a7048"/><stop offset="1" stop-color="#5a3c22"/></linearGradient></defs>
<rect x="15" y="4" width="10" height="150" rx="3" fill="url(#bh)"/><rect x="13" y="148" width="14" height="14" rx="2" fill="#2b2620"/>
<path class="brush-tip" d="M13 160 C 11 180, 16 204, 20 216 C 24 204, 29 180, 27 160 Z"/></svg>`;

export function buildStudy() {
  const el = (tag: string, cls: string, children: (Node | string)[] = []) => {
    const e = document.createElement(tag);
    e.className = cls;
    e.append(...children);
    return e;
  };

  /* 宣纸 */
  const canvas = document.createElement('canvas');
  canvas.className = 'sheet-canvas';
  const roles = el('div', 'sheet-roles', [bind(el('h3', 'sheet-roles-title'), ui.rolesTitle)]);
  profile.roles.forEach((r) => roles.append(bind(el('p', 'sheet-role'), r)));
  const hint = el('p', 'sheet-hint');
  const clearBtn = bind(el('button', 'desk-btn sheet-clear'), { zh: '换纸', en: 'New sheet' }) as HTMLButtonElement;
  clearBtn.type = 'button';
  const sheet = el('div', 'sheet no-ink', [canvas, roles, hint, clearBtn]);

  /* 砚台与墨锭 */
  const stone = el('div', 'inkstone no-ink');
  stone.innerHTML = `<svg viewBox="0 0 220 140" aria-hidden="true">
    <defs><radialGradient id="st" cx=".4" cy=".35"><stop offset="0" stop-color="#55524b"/><stop offset="1" stop-color="#23211d"/></radialGradient></defs>
    <rect x="6" y="10" width="208" height="124" rx="26" fill="url(#st)"/>
    <rect x="20" y="22" width="180" height="100" rx="18" fill="#2c2a25"/>
    <ellipse class="ink-well" cx="110" cy="96" rx="68" ry="18" fill="#0d0c0a"/>
    <ellipse class="ink-sheen" cx="92" cy="90" rx="22" ry="4" fill="#fff" opacity="0"/>
  </svg>`;
  const stick = el('div', 'ink-stick', [el('span', 'ink-stick-gold')]);
  stick.tabIndex = 0;
  stick.setAttribute('role', 'button');
  bind(stick, { zh: '墨锭（拖动研墨）', en: 'Ink stick (drag to grind)' }, 'aria-label');
  stone.append(stick);
  bind(stone, { zh: '砚台', en: 'Inkstone' }, 'aria-label');

  /* 笔搁上的毛笔 */
  const brushBtn = el('button', 'brush-rest no-ink') as HTMLButtonElement;
  brushBtn.type = 'button';
  brushBtn.innerHTML = BRUSH_SVG;
  bind(brushBtn, { zh: '毛笔（点击提笔 / 放下）', en: 'Brush (click to pick up / put down)' }, 'aria-label');
  const held = el('div', 'held-brush');
  held.innerHTML = BRUSH_SVG;
  document.body.append(held);

  /* 印章盘 */
  const tray = el('div', 'seal-tray');
  const main = el('div', 'tray-seal tray-main no-ink');
  main.innerHTML = mainSeal(profile.seal);
  main.tabIndex = 0;
  bind(main, { zh: '無限進步（拖出来盖印）', en: 'Endless progress (drag to stamp)' }, 'data-note');
  tray.append(main);
  makeStampable(main, () => mainSeal(profile.seal), 84, () => setHint('done', true));
  leisureSeals.forEach((s) => {
    const d = el('div', `tray-seal tray-${s.shape} no-ink`);
    d.innerHTML = leisureSeal(s.text, s.shape);
    d.tabIndex = 0;
    bind(d, s.note, 'data-note');
    tray.append(d);
    makeStampable(d, () => leisureSeal(s.text, s.shape), s.shape === 'tall' ? 46 : 72);
  });

  const tools = el('div', 'desk-tools', [stone, brushBtn, tray]);
  const desk = el('div', 'desk', [sheet, tools]);

  /* ---------- 状态 ---------- */
  let inkLevel = 0; // 砚中墨量
  let load = 0; // 笔上墨量
  let holding = false;
  let hintKey = 'grind';
  let wrote = false;

  function setHint(k: string, force = false) {
    if (!force && k === hintKey) return;
    hintKey = k;
    hint.textContent = HINTS[k][document.documentElement.lang === 'en' ? 'en' : 'zh'];
    hint.classList.remove('is-pulse');
    void hint.offsetWidth;
    hint.classList.add('is-pulse');
  }
  onLang(() => setHint(hintKey, true));
  setHint('grind', true);

  function renderInk() {
    const well = stone.querySelector('.ink-well') as SVGEllipseElement;
    well.setAttribute('fill', `rgb(${Math.round(60 - inkLevel * 50)},${Math.round(56 - inkLevel * 47)},${Math.round(50 - inkLevel * 42)})`);
    (stone.querySelector('.ink-sheen') as SVGElement).setAttribute('opacity', String(inkLevel * 0.35));
    held.style.setProperty('--load', String(load));
    brushBtn.style.setProperty('--load', String(load));
  }
  renderInk();

  /* ---------- 研墨 ---------- */
  let grinding = false;
  let last: { x: number; y: number } | null = null;
  stick.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    grinding = true;
    last = { x: e.clientX, y: e.clientY };
    stick.setPointerCapture(e.pointerId);
    stick.classList.add('is-grinding');
  });
  stick.addEventListener('pointermove', (e) => {
    if (!grinding || !last) return;
    const r = stone.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - r.left, 30), r.width - 30);
    const y = Math.min(Math.max(e.clientY - r.top, 30), r.height - 20);
    stick.style.left = `${x}px`;
    stick.style.top = `${y}px`;
    const d = Math.hypot(e.clientX - last.x, e.clientY - last.y);
    stick.style.setProperty('--tilt', `${Math.max(-18, Math.min(18, (e.clientX - last.x) * 1.2))}deg`);
    last = { x: e.clientX, y: e.clientY };
    inkLevel = Math.min(1, inkLevel + d / 1000);
    renderInk();
    if (inkLevel > 0.35 && hintKey === 'grind') setHint('brush');
  });
  const endGrind = () => {
    grinding = false;
    last = null;
    stick.classList.remove('is-grinding');
    stick.style.left = '';
    stick.style.top = '';
    stick.style.removeProperty('--tilt');
  };
  stick.addEventListener('pointerup', endGrind);
  stick.addEventListener('pointercancel', endGrind);
  stick.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    inkLevel = Math.min(1, inkLevel + 0.25);
    renderInk();
    if (inkLevel > 0.35 && hintKey === 'grind') setHint('brush');
  });

  /* ---------- 提笔 / 蘸墨 ---------- */
  function setHolding(v: boolean) {
    holding = v;
    document.body.classList.toggle('is-holding-brush', v);
    brushBtn.classList.toggle('is-empty', v);
    canvas.style.touchAction = v ? 'none' : '';
    if (v) setHint(load > 0.05 ? 'write' : inkLevel > 0.05 ? 'dip' : 'grind');
  }
  brushBtn.addEventListener('click', () => setHolding(!holding));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && holding && setHolding(false));
  window.addEventListener('pointermove', (e) => {
    if (!holding) return;
    held.style.transform = `translate(${e.clientX - 10}px, ${e.clientY - 212}px) rotate(12deg)`;
  });
  stone.addEventListener('click', (e) => {
    if (!holding || e.target === stick || stick.contains(e.target as Node)) return;
    if (inkLevel < 0.05) return setHint('grind', true);
    load = Math.min(1, inkLevel * 1.3);
    inkLevel = Math.max(0, inkLevel - 0.1);
    renderInk();
    stone.classList.remove('is-dip');
    void stone.offsetWidth;
    stone.classList.add('is-dip');
    setHint('write');
  });

  /* ---------- 书写 ---------- */
  const ctx = canvas.getContext('2d')!;
  let dpr = 1;
  function resizeCanvas() {
    const r = sheet.getBoundingClientRect();
    if (!r.width) return;
    const old = document.createElement('canvas');
    old.width = canvas.width;
    old.height = canvas.height;
    if (canvas.width) old.getContext('2d')!.drawImage(canvas, 0, 0);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    if (old.width) ctx.drawImage(old, 0, 0, canvas.width, canvas.height);
  }
  new ResizeObserver(resizeCanvas).observe(sheet);

  let drawing = false;
  let prev: { x: number; y: number; t: number; r: number } | null = null;
  function dab(x: number, y: number, r: number) {
    const n = 16;
    ctx.fillStyle = '#15130f';
    for (let i = 0; i < n; i++) {
      // 墨少时部分笔毫不着纸 → 飞白
      if (load < 0.4 && Math.random() > load * 2.3 + 0.05) continue;
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r * 0.75;
      ctx.globalAlpha = 0.12 + load * 0.45;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.22 + Math.random() * 0.25), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (!holding) return;
    if (load <= 0.02) return setHint(inkLevel > 0.05 ? 'dip' : 'grind', true);
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    drawing = true;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * dpr;
    const y = (e.clientY - r.top) * dpr;
    const base = r.width * dpr * 0.018;
    prev = { x, y, t: performance.now(), r: base * 0.6 };
    dab(x, y, prev.r);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing || !prev) return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * dpr;
    const y = (e.clientY - r.top) * dpr;
    const now = performance.now();
    const dist = Math.hypot(x - prev.x, y - prev.y);
    const speed = dist / dpr / Math.max(now - prev.t, 1);
    const base = r.width * dpr * 0.018;
    const pressure = e.pointerType === 'pen' && e.pressure > 0 ? 0.4 + e.pressure : 1;
    // 运笔慢则粗、快则细；墨少则细
    const target = base * (1.1 - Math.min(speed / 2.2, 0.8)) * (0.55 + load * 0.45) * pressure;
    const step = Math.max(1, prev.r * 0.3);
    const steps = Math.ceil(dist / step);
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      const rr = prev.r + (target - prev.r) * k * 0.35;
      dab(prev.x + (x - prev.x) * k, prev.y + (y - prev.y) * k, rr);
    }
    load = Math.max(0, load - (dist / dpr) * 0.00032 * (0.6 + target / base));
    renderInk();
    prev = { x, y, t: now, r: prev.r + (target - prev.r) * 0.35 };
    if (load <= 0.02) {
      drawing = false;
      setHint(inkLevel > 0.05 ? 'dip' : 'grind', true);
    }
  });
  const endStroke = () => {
    if (drawing && !wrote) {
      wrote = true;
      setTimeout(() => setHint('stamp'), 1200);
    }
    drawing = false;
    prev = null;
  };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  clearBtn.addEventListener('click', () => {
    canvas.classList.add('is-clearing');
    clearStampsIn(sheet.getBoundingClientRect());
    setTimeout(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.classList.remove('is-clearing');
    }, 450);
    wrote = false;
  });

  return desk;
}
