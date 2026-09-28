import * as THREE from 'three';
import type { Anchor } from '../gl/props';
import { bind } from '../i18n';

/**
 * 场景式导航：山水里的亭、竹林、渡口、石碑、驿站上方浮着一枚小题签，
 * 跟着 3D 位置走；点一下就飞到对应版块。
 */
export function buildHotspots(anchors: Anchor[], camera: THREE.PerspectiveCamera, onGo: (id: Anchor['id']) => void, onHover: (id: string | null) => void) {
  const layer = document.createElement('div');
  layer.className = 'hotspots';
  const tmp = new THREE.Vector3();
  const items = anchors.map((a) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hotspot no-ink';
    const dot = document.createElement('i');
    dot.className = 'hotspot-dot';
    const label = bind(document.createElement('span'), a.label);
    label.className = 'hotspot-label';
    b.append(label, dot);
    b.addEventListener('click', () => onGo(a.id));
    b.addEventListener('pointerenter', () => onHover(a.id));
    b.addEventListener('pointerleave', () => onHover(null));
    b.addEventListener('focus', () => onHover(a.id));
    b.addEventListener('blur', () => onHover(null));
    layer.append(b);
    return { a, b };
  });

  /** 每帧调用：投影到屏幕；离得太远、在身后或出屏就隐藏 */
  function update(active: string | null, enabled: boolean) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const { a, b } of items) {
      tmp.copy(a.pos).project(camera);
      const dist = camera.position.distanceTo(a.pos);
      const onScreen = tmp.z < 1 && tmp.x > -0.95 && tmp.x < 0.95 && tmp.y > -0.9 && tmp.y < 0.85;
      const show = enabled && onScreen && dist < 170 && a.id !== active;
      b.classList.toggle('is-shown', show);
      if (!show) continue;
      const x = (tmp.x * 0.5 + 0.5) * w;
      const y = (-tmp.y * 0.5 + 0.5) * h;
      b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      b.style.setProperty('--near', String(Math.max(0.6, Math.min(1, 60 / dist))));
    }
  }

  return { layer, update };
}
