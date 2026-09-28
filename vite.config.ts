import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { generateFontCss } from './scripts/subset-fonts.mjs';

/** 启动、构建、修改 content.ts 时自动重新裁剪字体 */
function fontSubset(): Plugin {
  return {
    name: 'font-subset',
    buildStart() {
      const { kept, total } = generateFontCss();
      this.info?.(`font subsets: ${kept}/${total}`);
    },
    handleHotUpdate({ file }) {
      if (/(content.ts|index.html|travels.html)$/.test(file)) generateFontCss();
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [fontSubset()],
  server: { host: true, port: 5173 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      // 多页面：主页 + 游历页
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        travels: resolve(import.meta.dirname, 'travels.html'),
      },
    },
  },
});
