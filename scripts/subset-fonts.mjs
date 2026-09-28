/**
 * 字体按需裁剪：扫描 content.ts / index.html 里实际用到的字符，
 * 只保留覆盖这些字符的 @font-face 分片（fontsource 已按 unicode 切好片），并只用 woff2。
 * 结果写入 src/fonts.generated.css，由 vite.config.ts 里的插件在启动/构建/修改内容时自动调用。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const OUT = path.join(root, 'src/fonts.generated.css');

const SOURCES = ['src/content.ts', 'index.html', 'travels.html'];

const FONTS = [
  '@fontsource/noto-serif-sc/400.css',
  '@fontsource/noto-serif-sc/700.css',
  '@fontsource/noto-serif-tc/900.css',
  '@fontsource/ma-shan-zheng/400.css',
  '@fontsource/zhi-mang-xing/400.css',
  '@fontsource/cormorant-garamond/400.css',
  '@fontsource/cormorant-garamond/400-italic.css',
  '@fontsource/cormorant-garamond/600.css',
];

function parseRanges(s) {
  return s.split(',').map((tok) => {
    const t = tok.trim().replace(/^U\+/i, '');
    if (t.includes('-')) {
      const [a, b] = t.split('-');
      return [parseInt(a, 16), parseInt(b, 16)];
    }
    if (t.includes('?')) return [parseInt(t.replace(/\?/g, '0'), 16), parseInt(t.replace(/\?/g, 'f'), 16)];
    const v = parseInt(t, 16);
    return [v, v];
  });
}

export function generateFontCss() {
  const used = new Set();
  for (const f of SOURCES) {
    for (const ch of readFileSync(path.join(root, f), 'utf8')) used.add(ch.codePointAt(0));
  }
  for (let c = 0x20; c < 0x7f; c++) used.add(c);
  const cps = [...used];

  let out = '/* 自动生成，请勿手改：scripts/subset-fonts.mjs */\n';
  let kept = 0;
  let total = 0;
  for (const f of FONTS) {
    const cssPath = path.join(root, 'node_modules', f);
    const dir = path.dirname(cssPath);
    const css = readFileSync(cssPath, 'utf8');
    for (const block of css.match(/@font-face\s*{[^}]*}/g) ?? []) {
      total++;
      const m = block.match(/unicode-range:\s*([^;]+);/);
      const ranges = m ? parseRanges(m[1]) : [[0, 0x10ffff]];
      if (!cps.some((cp) => ranges.some(([a, b]) => cp >= a && cp <= b))) continue;
      const woff2 = block.match(/url\(([^)]+?\.woff2)\)/);
      if (!woff2) continue;
      const rel = path.relative(path.join(root, 'src'), path.join(dir, woff2[1])).split(path.sep).join('/');
      out += block.replace(/src:\s*[^;]+;/, `src: url(${rel}) format('woff2');`) + '\n';
      kept++;
    }
  }
  const prev = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (prev !== out) writeFileSync(OUT, out);
  return { kept, total };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const { kept, total } = generateFontCss();
  console.log(`fonts: kept ${kept}/${total} @font-face blocks`);
}
