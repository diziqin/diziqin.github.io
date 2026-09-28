/**
 * 印章生成。
 * 主印：白文（字刻空、底为朱砂），四字 2×2，按传统从右列到左列、自上而下。
 * 闲章：朱文（字与边框为朱砂），圆印 / 方印 / 长条引首章。
 */

let uid = 0;

export function mainSeal(text: string) {
  const c = [...text];
  const id = `sm${uid++}`;
  // 右列：c[0] c[1]，左列：c[2] c[3]
  const cells = [
    { ch: c[0], x: 146, y: 56 },
    { ch: c[1], x: 146, y: 146 },
    { ch: c[2], x: 54, y: 56 },
    { ch: c[3], x: 54, y: 146 },
  ];
  const texts = cells
    .map((k) => `<text x="${k.x}" y="${k.y}">${k.ch ?? ''}</text>`)
    .join('');
  return `
<svg class="seal seal-main" viewBox="0 0 200 200" role="img" aria-label="${text}">
  <defs>
    <mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
      <rect width="200" height="200" fill="#fff"/>
      <g fill="#000" font-family="'Noto Serif TC', serif" font-weight="900" font-size="86"
         text-anchor="middle" dominant-baseline="central">${texts}</g>
    </mask>
  </defs>
  <g filter="url(#seal-rough)">
    <rect x="6" y="6" width="188" height="188" rx="8" fill="currentColor" mask="url(#${id})"/>
  </g>
</svg>`;
}

export function leisureSeal(text: string, shape: 'round' | 'square' | 'tall') {
  const c = [...text];
  const font = `font-family="'Noto Serif SC', serif" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="currentColor"`;
  if (shape === 'round') {
    const t = c.map((ch, i) => `<text x="100" y="${100 + (i - (c.length - 1) / 2) * 62}">${ch}</text>`).join('');
    return `<svg class="seal seal-leisure" viewBox="0 0 200 200" role="img" aria-label="${text}">
  <g filter="url(#seal-rough)">
    <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" stroke-width="9"/>
    <g ${font} font-size="60">${t}</g>
  </g></svg>`;
  }
  if (shape === 'square') {
    const rows = Math.ceil(c.length / 2);
    const h = rows * 78 + 28;
    const t = c
      .map((ch, i) => {
        const col = i < rows ? 0 : 1; // 先右列
        const row = i % rows;
        return `<text x="${col === 0 ? 132 : 50}" y="${54 + row * 78}">${ch}</text>`;
      })
      .join('');
    return `<svg class="seal seal-leisure" viewBox="0 0 182 ${h}" role="img" aria-label="${text}">
  <g filter="url(#seal-rough)">
    <rect x="6" y="6" width="170" height="${h - 12}" rx="6" fill="none" stroke="currentColor" stroke-width="9"/>
    <line x1="91" y1="16" x2="91" y2="${h - 16}" stroke="currentColor" stroke-width="4"/>
    <g ${font} font-size="66">${t}</g>
  </g></svg>`;
  }
  const h = c.length * 64 + 36;
  const t = c.map((ch, i) => `<text x="46" y="${50 + i * 64}">${ch}</text>`).join('');
  return `<svg class="seal seal-leisure seal-tall" viewBox="0 0 92 ${h}" role="img" aria-label="${text}">
  <g filter="url(#seal-rough)">
    <rect x="5" y="5" width="82" height="${h - 10}" rx="40" fill="none" stroke="currentColor" stroke-width="7"/>
    <g ${font} font-size="54">${t}</g>
  </g></svg>`;
}
