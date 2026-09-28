/**
 * 拖印章、到处盖：按住印章拖到页面任意位置松手，就在那里留下一方朱红印迹。
 * 印迹带做旧纹理、随机微斜；不挡住下面的点击（pointer-events: none）。
 */

let layer: HTMLDivElement | null = null;
const MAX = 40;

function ensureLayer() {
  if (layer) return layer;
  layer = document.createElement('div');
  layer.className = 'stamps-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  return layer;
}

/** 在页面坐标 (pageX, pageY) 盖一方印 */
export function stampAt(svg: string, pageX: number, pageY: number, size: number, onStamp?: (x: number, y: number) => void) {
  const l = ensureLayer();
  const el = document.createElement('div');
  el.className = 'stamp-mark';
  el.innerHTML = svg;
  el.style.left = `${pageX}px`;
  el.style.top = `${pageY}px`;
  el.style.width = `${size}px`;
  el.style.setProperty('--rot', `${(Math.random() - 0.5) * 12}deg`);
  el.style.setProperty('--ink', String(0.78 + Math.random() * 0.2));
  l.append(el);
  while (l.children.length > MAX) l.firstElementChild?.remove();
  onStamp?.(pageX - window.scrollX, pageY - window.scrollY);
  return el;
}

export function clearStampsIn(rect: DOMRect) {
  if (!layer) return;
  for (const el of [...layer.children] as HTMLElement[]) {
    const x = parseFloat(el.style.left) - window.scrollX;
    const y = parseFloat(el.style.top) - window.scrollY;
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) el.remove();
  }
}

/**
 * 让一个印章元素可以拖出来盖印。
 * getSvg：盖出来的印面（通常与印章本身相同）
 */
export function makeStampable(handle: HTMLElement, getSvg: () => string, size: number, onStamp?: (x: number, y: number) => void) {
  handle.classList.add('stampable');
  handle.setAttribute('title', handle.getAttribute('data-note') ?? '');
  let ghost: HTMLDivElement | null = null;
  let start: { x: number; y: number } | null = null;
  let moved = false;

  const onMove = (e: PointerEvent) => {
    if (!start) return;
    if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) return;
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.className = 'stamp-ghost';
      ghost.innerHTML = getSvg();
      ghost.style.width = `${size}px`;
      document.body.append(ghost);
      handle.classList.add('is-lifted');
    }
    moved = true;
    ghost.style.transform = `translate(${e.clientX - size / 2}px, ${e.clientY - size / 2}px) rotate(-6deg) scale(1.08)`;
  };
  const onUp = (e: PointerEvent) => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    handle.classList.remove('is-lifted');
    if (ghost && moved && e.type === 'pointerup') {
      stampAt(getSvg(), e.clientX + window.scrollX, e.clientY + window.scrollY, size, onStamp);
    }
    ghost?.remove();
    ghost = null;
    start = null;
  };
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    start = { x: e.clientX, y: e.clientY };
    moved = false;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  });
  // 键盘：回车在印章旁边盖一方
  handle.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const r = handle.getBoundingClientRect();
    stampAt(getSvg(), r.left + window.scrollX - size * 0.8, r.top + window.scrollY + r.height / 2, size, onStamp);
  });
}
