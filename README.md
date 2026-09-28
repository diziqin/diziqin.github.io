# 小狄 · Xborn 个人网站

水墨风个人网站，两个页面：

- **主页 `index.html`**：墨滴晕染 → 毛笔逐笔书写 → 盖印 → 沿山谷飞行（书房、竹林、江上、石碑、驿站），草坡一丛丛长出直到漫山遍野（Xborn · 万物生长）→ 升空俯瞰。
  - 书房：拖墨锭研墨、提笔蘸墨、在宣纸上写字（运笔快细慢粗、墨尽飞白）、拖印章盖在任何地方
  - 竹林：竹简从右往左展开，可拖动（带惯性）翻阅
  - 江上：船随滚动顺流而下
  - 驿站：八行笺，可「封缄」装入信封
  - 山水里的题签可直接点击跳到对应版块；鼠标划过草坡会把草拨开
- **游历页 `travels.html`**：一条竖向墨线按地理顺序串起走过的地方，背景是实时水墨化的当地照片，角落有墨点舆图（只画点与路线）。

技术栈：Vite + TypeScript + Three.js（着色器）+ GSAP（ScrollTrigger）。打包结果是纯静态文件。

## 本地开发

```bash
npm install
npm run dev      # http://localhost:5173
```

## 改内容

| 要改什么 | 改哪里 |
|---|---|
| 所有文字（名字、签名、身份、技术栈、履历、游历地点、联系方式、中英文） | `src/content.ts` |
| 微信二维码 | 把图片放进 `public/`，再改 `content.ts` 里的 `wechatQR` 文件名 |
| 网站标题、分享描述 | `index.html` |
| 配色、字号、版式 | `src/style.css` 顶部的 CSS 变量 |

- 经历里 `placeholder: true` 的条目会以半透明的「待补充」样式显示，补完内容后删掉这个字段即可。
- 游历地点在 `travels.places` 里（含经纬度），按顺序串成墨线；增删地点后墨线、舆图和「足迹 N 处」会自动更新。
- 游历照片：运行 `node scripts/fetch-photos.mjs` 从 Wikimedia Commons 下载到 `public/travels/`，署名自动写入 `src/data/photos.json` 并显示在游历页卷尾。想换图就改脚本里的列表；也可以直接放自己的照片（`public/travels/<地点id>.jpg`）并在 photos.json 里登记。没有照片的地点会用程序画的占位景色。
- 字体会根据 `content.ts` 里用到的字自动裁剪（`scripts/subset-fonts.mjs`），加了新字不用手动处理。
- 首屏的名字按真实笔顺书写，笔画数据在 `src/data/strokes/`。如果改成别的汉字，把 `node_modules/hanzi-writer-data/<字>.json` 复制过去即可；缺数据时会自动改用毛笔字体书写。

## 构建与部署

```bash
npm run build    # 输出到 dist/
npm run preview  # 本地预览打包结果
```

把 `dist/` 里的全部文件上传到服务器，例如 `/var/www/xborn`。Nginx 配置示例：

```nginx
server {
    listen 80;
    server_name example.com;          # 换成你的域名
    root /var/www/xborn;
    index index.html;

    # 带哈希的静态资源长期缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/css application/javascript image/svg+xml;
}
```

建议配上 HTTPS，比如用 certbot 申请免费证书。

## 性能与兼容

- 触屏设备和低核数设备会自动降低模拟精度并减少山层；前两秒帧率过低时还会逐级降低渲染分辨率。
- 系统开启了「减少动态效果」时，会跳过开场动画和鼠标墨痕。
- 不支持 WebGL 时退回静态纸色背景，内容照常显示。

## 目录结构

```
src/
  content.ts        全部文字内容（中英双语）
  main.ts           开场时序、滚动、语言切换
  ui.ts             页面结构
  style.css         样式
  gl/engine.ts      渲染循环、墨迹合成、宣纸纹理、鼠标墨痕
  gl/inkField.ts    宣纸晕墨模拟（GPU ping-pong）
  gl/landscape.ts   山水世界总装：远山、云雾、朱砂日、各版块机位与镜头曲线
  gl/terrain.ts     山谷地形、高度图、跟随镜头的 3D 草场（生长 / 风 / 鼠标拨草）
  gl/props.ts       亭、松、竹林、江与乌篷船、石碑、驿站、鸿雁（Canvas 手绘水墨贴图）
  home/study.ts     书房：研墨、提笔、书写、换纸
  home/stamps.ts    拖印章盖印
  home/slips.ts     竹简
  home/letter.ts    八行笺与封缄
  home/hotspots.ts  山水里的题签（场景式导航）
  travels/          游历页：墨线路线、照片水墨化（Kuwahara + 高斯差分 + 墨分五色）、舆图、占位景色
  hero/calligraphy.ts  毛笔逐笔书写 + 笔触滤镜
  hero/seal.ts      主印与闲章
scripts/subset-fonts.mjs  字体按需裁剪
```

## 致谢

- 汉字笔画数据：[Make Me a Hanzi](https://github.com/skishore/makemeahanzi) / hanzi-writer-data（Arphic Public License）
- 字体：Noto Serif SC/TC、马善政毛笔楷书、志莽行书、Cormorant Garamond（SIL Open Font License）
