/**
 * 下载游历页的地点照片（Wikimedia Commons，均为 CC0 / 公有领域 / CC BY / CC BY-SA），
 * 保存到 public/travels/<id>.jpg，并把署名信息写入 src/data/photos.json（页面卷尾会列出）。
 * 用法：node scripts/fetch-photos.mjs
 * 想换某张图：改下面列表里的 url / 署名，再运行一次。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(root, 'public/travels');
const META = path.join(root, 'src/data/photos.json');

const PHOTOS = [
  {
    "id": "kashgar",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Kashgar_Id_Kah_Moschee.jpg/1280px-Kashgar_Id_Kah_Moschee.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "Kashgar Id Kah Moschee.jpg",
    "author": "See58",
    "license": "CC BY-SA 3.0",
    "page": "https://commons.wikimedia.org/wiki/File:Kashgar_Id_Kah_Moschee.jpg"
  },
  {
    "id": "urumqi",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f1/View_of_Urumqi_from_Hongshan_%28red_mountain%29_park.jpg/1280px-View_of_Urumqi_from_Hongshan_%28red_mountain%29_park.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "View of Urumqi from Hongshan (red mountain) park.jpg",
    "author": "Josesan (Wikivoyage)",
    "license": "Public domain",
    "page": "https://commons.wikimedia.org/wiki/File:View_of_Urumqi_from_Hongshan_(red_mountain)_park.jpg"
  },
  {
    "id": "altay",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a0/Lake_Kanas.jpg/1280px-Lake_Kanas.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "Lake Kanas.jpg",
    "author": "Wang Xiaozhe & Meng Jie",
    "license": "CC BY-SA 3.0",
    "page": "https://commons.wikimedia.org/wiki/File:Lake_Kanas.jpg"
  },
  {
    "id": "harbin",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c3/Saint_Sophia_Cathedral%2C_Harbin_8.jpg/1280px-Saint_Sophia_Cathedral%2C_Harbin_8.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "Saint Sophia Cathedral, Harbin 8.jpg",
    "author": "闫恩铭 / Enming Yan",
    "license": "CC BY-SA 4.0",
    "page": "https://commons.wikimedia.org/wiki/File:Saint_Sophia_Cathedral,_Harbin_8.jpg"
  },
  {
    "id": "changchun",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d1/%E5%87%80%E6%9C%88%E6%BD%AD_jing_yue_tan_-_panoramio_%281%29.jpg/1280px-%E5%87%80%E6%9C%88%E6%BD%AD_jing_yue_tan_-_panoramio_%281%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "净月潭 jing yue tan - panoramio (1).jpg",
    "author": "wanghongliu",
    "license": "CC BY-SA 3.0",
    "page": "https://commons.wikimedia.org/wiki/File:%E5%87%80%E6%9C%88%E6%BD%AD_jing_yue_tan_-_panoramio_(1).jpg"
  },
  {
    "id": "dalian",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Xinghai_square_middle.JPG/1280px-Xinghai_square_middle.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "Xinghai square middle.JPG",
    "author": "JesseW900",
    "license": "CC BY-SA 4.0",
    "page": "https://commons.wikimedia.org/wiki/File:Xinghai_square_middle.JPG"
  },
  {
    "id": "tianjin",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c3/Tianjin_Eye_3.jpg/1280px-Tianjin_Eye_3.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "Tianjin Eye 3.jpg",
    "author": "Erick Pessoa",
    "license": "CC BY 2.0",
    "page": "https://commons.wikimedia.org/wiki/File:Tianjin_Eye_3.jpg"
  },
  {
    "id": "beijing",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4d/20200110_Temple_of_Heaven-11.jpg/1280px-20200110_Temple_of_Heaven-11.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "20200110 Temple of Heaven-11.jpg",
    "author": "Balon Greyjoy",
    "license": "CC0",
    "page": "https://commons.wikimedia.org/wiki/File:20200110_Temple_of_Heaven-11.jpg"
  },
  {
    "id": "shijiazhuang",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/Zhaozhou_Bridge.jpg/1280px-Zhaozhou_Bridge.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "Zhaozhou Bridge.jpg",
    "author": "Zhao 1974 (English Wikipedia)",
    "license": "Public domain",
    "page": "https://commons.wikimedia.org/wiki/File:Zhaozhou_Bridge.jpg"
  },
  {
    "id": "dezhou",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/Dezhou6.jpg/1280px-Dezhou6.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "Dezhou6.jpg",
    "author": "Fanghong",
    "license": "CC BY 2.5",
    "page": "https://commons.wikimedia.org/wiki/File:Dezhou6.jpg"
  },
  {
    "id": "jinan",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/Jinan_Baotu_Spring_pond-20150519-RM-174132.jpg/1280px-Jinan_Baotu_Spring_pond-20150519-RM-174132.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "Jinan Baotu Spring pond-20150519-RM-174132.jpg",
    "author": "Ermell",
    "license": "CC BY-SA 4.0",
    "page": "https://commons.wikimedia.org/wiki/File:Jinan_Baotu_Spring_pond-20150519-RM-174132.jpg"
  },
  {
    "id": "zibo",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/88/%E4%BA%9C%E7%B4%B0%E4%BA%9C%E5%A4%A7%E8%A6%B3_06_110_%22%E5%B1%B1%E6%9D%B1%E3%81%AE%E9%95%B7%E5%9F%8E_%EF%BC%88%E5%8D%9A%E5%B1%B1%E5%9F%8E%E5%A4%96%EF%BC%89%22.jpg/1280px-%E4%BA%9C%E7%B4%B0%E4%BA%9C%E5%A4%A7%E8%A6%B3_06_110_%22%E5%B1%B1%E6%9D%B1%E3%81%AE%E9%95%B7%E5%9F%8E_%EF%BC%88%E5%8D%9A%E5%B1%B1%E5%9F%8E%E5%A4%96%EF%BC%89%22.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "亜細亜大観 06 110 \"山東の長城 （博山城外）\".jpg",
    "author": "Black Dragon Society",
    "license": "Public domain",
    "page": "https://commons.wikimedia.org/wiki/File:%E4%BA%9C%E7%B4%B0%E4%BA%9C%E5%A4%A7%E8%A6%B3_06_110_%22%E5%B1%B1%E6%9D%B1%E3%81%AE%E9%95%B7%E5%9F%8E_%EF%BC%88%E5%8D%9A%E5%B1%B1%E5%9F%8E%E5%A4%96%EF%BC%89%22.jpg"
  },
  {
    "id": "weihai",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c7/%E5%88%98%E5%85%AC%E5%B2%9B%E4%BD%99%E6%99%96_-_panoramio.jpg/1280px-%E5%88%98%E5%85%AC%E5%B2%9B%E4%BD%99%E6%99%96_-_panoramio.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "刘公岛余晖 - panoramio.jpg",
    "author": "chp13579753",
    "license": "CC BY-SA 3.0",
    "page": "https://commons.wikimedia.org/wiki/File:%E5%88%98%E5%85%AC%E5%B2%9B%E4%BD%99%E6%99%96_-_panoramio.jpg"
  },
  {
    "id": "qingdao",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c7/Zhan_Qiao.JPG/1280px-Zhan_Qiao.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "Zhan Qiao.JPG",
    "author": "Regina800809",
    "license": "CC BY-SA 3.0",
    "page": "https://commons.wikimedia.org/wiki/File:Zhan_Qiao.JPG"
  },
  {
    "id": "xuzhou",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/aa/Buildings_near_Yunlong_Lake%2C_Xuzhou.JPG/1280px-Buildings_near_Yunlong_Lake%2C_Xuzhou.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "Buildings near Yunlong Lake, Xuzhou.JPG",
    "author": "彭鹏",
    "license": "CC BY-SA 3.0",
    "page": "https://commons.wikimedia.org/wiki/File:Buildings_near_Yunlong_Lake,_Xuzhou.JPG"
  },
  {
    "id": "nanjing",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/Sun_Yat-sen_Mausoleum%2C_Nanjing_%282789677299%29.jpg/1280px-Sun_Yat-sen_Mausoleum%2C_Nanjing_%282789677299%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "Sun Yat-sen Mausoleum, Nanjing (2789677299).jpg",
    "author": "Peter Dowley",
    "license": "CC BY 2.0",
    "page": "https://commons.wikimedia.org/wiki/File:Sun_Yat-sen_Mausoleum,_Nanjing_(2789677299).jpg"
  },
  {
    "id": "shanghai",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4f/The_Bund%2C_Shanghai%2C_1.jpg/1280px-The_Bund%2C_Shanghai%2C_1.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "The Bund, Shanghai, 1.jpg",
    "author": "Nikolamikovic82",
    "license": "CC0",
    "page": "https://commons.wikimedia.org/wiki/File:The_Bund,_Shanghai,_1.jpg"
  },
  {
    "id": "hangzhou",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/07/20090524_Hangzhou_West_Lake_7531.jpg/1280px-20090524_Hangzhou_West_Lake_7531.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "20090524 Hangzhou West Lake 7531.jpg",
    "author": "Jakub Hałun",
    "license": "CC BY-SA 3.0",
    "page": "https://commons.wikimedia.org/wiki/File:20090524_Hangzhou_West_Lake_7531.jpg"
  },
  {
    "id": "xiamen",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2d/Gulangyu_mansion_2011_12.jpg/1280px-Gulangyu_mansion_2011_12.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "Gulangyu mansion 2011 12.jpg",
    "author": "Rolfmueller",
    "license": "CC BY-SA 3.0",
    "page": "https://commons.wikimedia.org/wiki/File:Gulangyu_mansion_2011_12.jpg"
  },
  {
    "id": "shenzhen",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/TOP_OF_THE_DIWANG_BUILDING_SEE_SHENZHEN_SKYLINE_%2835%29.jpg/1280px-TOP_OF_THE_DIWANG_BUILDING_SEE_SHENZHEN_SKYLINE_%2835%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "TOP OF THE DIWANG BUILDING SEE SHENZHEN SKYLINE (35).jpg",
    "author": "Dinkun Chen",
    "license": "CC BY-SA 4.0",
    "page": "https://commons.wikimedia.org/wiki/File:TOP_OF_THE_DIWANG_BUILDING_SEE_SHENZHEN_SKYLINE_(35).jpg"
  },
  {
    "id": "hongkong",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e3/Hong_Kong_Sunset_Black_and_White.jpg/1280px-Hong_Kong_Sunset_Black_and_White.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "Hong Kong Sunset Black and White.jpg",
    "author": "Wilfredor",
    "license": "CC0",
    "page": "https://commons.wikimedia.org/wiki/File:Hong_Kong_Sunset_Black_and_White.jpg"
  },
  {
    "id": "guizhou",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/72/Huangguoshu_Waterfall_-_Pixabay.jpg/1280px-Huangguoshu_Waterfall_-_Pixabay.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "Huangguoshu Waterfall - Pixabay.jpg",
    "author": "Robinliu",
    "license": "CC0",
    "page": "https://commons.wikimedia.org/wiki/File:Huangguoshu_Waterfall_-_Pixabay.jpg"
  },
  {
    "id": "singapore",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7e/Cricket_match_and_Marina_Bay_Sands_Hotel_in_Singapore.jpg/1280px-Cricket_match_and_Marina_Bay_Sands_Hotel_in_Singapore.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "title": "Cricket match and Marina Bay Sands Hotel in Singapore.jpg",
    "author": "Basile Morin",
    "license": "CC BY-SA 4.0",
    "page": "https://commons.wikimedia.org/wiki/File:Cricket_match_and_Marina_Bay_Sands_Hotel_in_Singapore.jpg"
  }
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT_DIR, { recursive: true });
const ok = [];
const UA = { 'User-Agent': 'xborn-site/1.0 (personal website; photo credits shown on page)' };
// thumb.wikimedia.org 不通时退回 upload.wikimedia.org
const candidates = (url) => [url, url.replace('://thumb.wikimedia.org/', '://upload.wikimedia.org/').replace(/\?.*$/, '')];
async function download(url) {
  let err;
  for (const u of candidates(url)) {
    try {
      const r = await fetch(u, { headers: UA });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (!(r.headers.get('content-type') ?? '').startsWith('image/')) throw new Error(`not an image: ${r.headers.get('content-type')}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      err = e;
    }
  }
  throw err;
}

for (const p of PHOTOS) {
  try {
    const buf = await download(p.url);
    writeFileSync(path.join(OUT_DIR, `${p.id}.jpg`), buf);
    ok.push({ id: p.id, file: `${p.id}.jpg`, author: p.author, license: p.license, url: p.page, title: p.title });
    console.log('✓', p.id, (buf.length / 1024).toFixed(0) + ' KB');
  } catch (e) {
    console.log('✗', p.id, e.message);
  }
  await sleep(600);
}
writeFileSync(META, JSON.stringify(ok, null, 2) + '\n');
console.log(`完成 ${ok.length}/${PHOTOS.length}，署名已写入 src/data/photos.json`);
