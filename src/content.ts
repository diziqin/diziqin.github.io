/**
 * 网站所有文字内容都在这里。改内容只需要改这个文件。
 * 每个 { zh, en } 分别是中文 / 英文。
 */

export type Lang = 'zh' | 'en';
export type T = { zh: string; en: string };

export const profile = {
  // 首屏毛笔书写的名字：中文模式写 zh，英文模式写 en
  name: { zh: '小狄', en: 'Xborn' } as T,
  // 主印章（繁体，2×2 排布，从右往左读）
  seal: '無限進步',
  // 首屏名字下方的一行简介
  tagline: {
    zh: '端侧智驾算法 · 预训练 / 后训练 · FDE',
    en: 'On-device driving AI · Pre- / Post-training · FDE',
  } as T,
  motto: {
    zh: '我始终认为技术是掌握世界的根本。',
    en: 'To master the world, master technology first.',
  } as T,
  roles: [
    { zh: '某车企 HMI 与 VLA/VLM 端侧智驾算法工程师', en: 'HMI & On-device VLA/VLM Autonomous Driving Algorithm Engineer at an automaker' },
    { zh: '预训练 / 后训练工程师', en: 'Pre-training / Post-training Engineer' },
    { zh: 'FDE 工程师', en: 'Forward Deployed Engineer' },
  ] as T[],
};

/** 闲章：散落在页面各处，鼠标悬停显示注释 */
export const leisureSeals: { text: string; shape: 'round' | 'square' | 'tall'; note: T }[] = [
  { text: '朵友', shape: 'round', note: { zh: '朵友', en: 'Atour regular' } },
  { text: '亚朵深度依赖', shape: 'square', note: { zh: '亚朵深度依赖', en: 'Deeply hooked on Atour hotels' } },
  { text: '亚朵深睡体验官', shape: 'tall', note: { zh: '亚朵深睡体验官', en: 'Atour deep-sleep tester' } },
];

/** 技术栈 */
export const stack: { title: T; items: string[] }[] = [
  {
    title: { zh: '模型与算法', en: 'Models & Algorithms' },
    items: ['Transformer', 'ViT', 'VLM', 'VLA', 'BEV / Occupancy', 'MoE', 'Diffusion Policy', 'World Model', 'Multimodal Fusion'],
  },
  {
    title: { zh: '预训练 · 后训练', en: 'Pre- & Post-training' },
    items: ['PyTorch', 'DeepSpeed', 'Megatron-LM', 'FSDP', 'FlashAttention', 'SFT', 'RLHF / DPO / GRPO', 'LoRA / QLoRA', 'Hugging Face'],
  },
  {
    title: { zh: '端侧部署', en: 'On-device Inference' },
    items: ['TensorRT', 'TensorRT-LLM', 'ONNX', 'CUDA', 'AWQ / GPTQ', 'INT8 / FP8', 'DRIVE Orin / Thor', 'Qualcomm QNN', 'vLLM'],
  },
  {
    title: { zh: 'HMI 与工程', en: 'HMI & Engineering' },
    items: ['C++', 'Python', 'Qt / QML', 'Android Automotive', 'ROS 2', 'Linux', 'Docker', 'Kubernetes'],
  },
  {
    title: { zh: 'AI 同行', en: 'AI Companions' },
    items: ['ChatGPT', 'Claude', 'Grok', 'Gemini'],
  },
];

/** 经历时间线（placeholder: true 的条目是待补充的占位） */
export const journey: { time: T; org: T; role: T; desc?: T; placeholder?: boolean }[] = [
  {
    time: { zh: '至今', en: 'Present' },
    org: { zh: '某车企', en: 'An automaker' },
    role: { zh: 'HMI 与 VLA/VLM 端侧智驾算法工程师', en: 'HMI & On-device VLA/VLM Algorithm Engineer' },
    desc: {
      zh: '把多模态大模型压进车端芯片，让智驾与座舱真正理解人与路。',
      en: 'Squeezing multimodal foundation models onto in-car chips so the car truly understands people and roads.',
    },
  },
  {
    time: { zh: '在读', en: 'Now' },
    org: { zh: '高中', en: 'High school' },
    role: { zh: '高中在读 · 正在游历世界', en: 'Student · Traveling the world' },
  },
];

/** 游历：按地理位置串成一条路线（游历页 travels.html 与主页共用） */
export type Place = {
  id: string;
  name: T;
  region: keyof typeof regions;
  lat: number;
  lon: number;
  /** 背景照片（public/travels/ 下的文件名），没有时用程序生成的水墨山水代替 */
  photo?: string;
  /** 照片署名：作者 · 授权 · 来源链接 */
  credit?: { author: string; license: string; url: string };
};

export const regions = {
  xinjiang: { zh: '新疆', en: 'Xinjiang' },
  northeast: { zh: '东北', en: 'The Northeast' },
  north: { zh: '京津冀', en: 'Beijing · Tianjin · Hebei' },
  shandong: { zh: '山东', en: 'Shandong' },
  east: { zh: '江浙沪', en: 'Jiangsu · Zhejiang · Shanghai' },
  south: { zh: '闽粤港', en: 'Fujian · Guangdong · Hong Kong' },
  southwest: { zh: '西南', en: 'The Southwest' },
  overseas: { zh: '海外', en: 'Overseas' },
} satisfies Record<string, T>;

export const travels = {
  lead: { zh: '行万里路，正在游历世界。', en: 'Walking ten thousand miles, one city at a time.' } as T,
  places: [
    { id: 'kashgar', name: { zh: '喀什', en: 'Kashgar' }, region: 'xinjiang', lat: 39.47, lon: 75.99 },
    { id: 'urumqi', name: { zh: '乌鲁木齐', en: 'Ürümqi' }, region: 'xinjiang', lat: 43.83, lon: 87.62 },
    { id: 'altay', name: { zh: '阿勒泰', en: 'Altay' }, region: 'xinjiang', lat: 47.84, lon: 88.14 },
    { id: 'harbin', name: { zh: '哈尔滨', en: 'Harbin' }, region: 'northeast', lat: 45.8, lon: 126.53 },
    { id: 'changchun', name: { zh: '长春', en: 'Changchun' }, region: 'northeast', lat: 43.88, lon: 125.32 },
    { id: 'dalian', name: { zh: '大连', en: 'Dalian' }, region: 'northeast', lat: 38.91, lon: 121.6 },
    { id: 'tianjin', name: { zh: '天津', en: 'Tianjin' }, region: 'north', lat: 39.13, lon: 117.2 },
    { id: 'beijing', name: { zh: '北京', en: 'Beijing' }, region: 'north', lat: 39.9, lon: 116.4 },
    { id: 'shijiazhuang', name: { zh: '石家庄', en: 'Shijiazhuang' }, region: 'north', lat: 38.04, lon: 114.51 },
    { id: 'dezhou', name: { zh: '德州', en: 'Dezhou' }, region: 'shandong', lat: 37.44, lon: 116.36 },
    { id: 'jinan', name: { zh: '济南', en: 'Jinan' }, region: 'shandong', lat: 36.67, lon: 117.0 },
    { id: 'zibo', name: { zh: '淄博', en: 'Zibo' }, region: 'shandong', lat: 36.81, lon: 118.05 },
    { id: 'weihai', name: { zh: '威海', en: 'Weihai' }, region: 'shandong', lat: 37.51, lon: 122.12 },
    { id: 'qingdao', name: { zh: '青岛', en: 'Qingdao' }, region: 'shandong', lat: 36.07, lon: 120.38 },
    { id: 'xuzhou', name: { zh: '徐州', en: 'Xuzhou' }, region: 'east', lat: 34.26, lon: 117.18 },
    { id: 'nanjing', name: { zh: '南京', en: 'Nanjing' }, region: 'east', lat: 32.06, lon: 118.8 },
    { id: 'shanghai', name: { zh: '上海', en: 'Shanghai' }, region: 'east', lat: 31.23, lon: 121.47 },
    { id: 'hangzhou', name: { zh: '杭州', en: 'Hangzhou' }, region: 'east', lat: 30.27, lon: 120.15 },
    { id: 'xiamen', name: { zh: '厦门', en: 'Xiamen' }, region: 'south', lat: 24.48, lon: 118.09 },
    { id: 'shenzhen', name: { zh: '深圳', en: 'Shenzhen' }, region: 'south', lat: 22.54, lon: 114.06 },
    { id: 'hongkong', name: { zh: '香港', en: 'Hong Kong' }, region: 'south', lat: 22.32, lon: 114.17 },
    { id: 'guizhou', name: { zh: '贵州', en: 'Guizhou' }, region: 'southwest', lat: 26.65, lon: 106.63 },
    { id: 'singapore', name: { zh: '新加坡', en: 'Singapore' }, region: 'overseas', lat: 1.35, lon: 103.82 },
  ] as Place[],
};

/** 联系方式 */
export const contact = {
  email: '2394934145@qq.com',
  links: [
    { label: 'GitHub', url: 'https://github.com/diziqin' },
  ],
  // 微信二维码：把图片放到 public/ 目录，然后改这里的文件名
  wechatQR: 'wechat-qr.svg',
};

/** 界面文字 */
export const ui = {
  nav: {
    about: { zh: '自序', en: 'About' },
    stack: { zh: '所学', en: 'Stack' },
    journey: { zh: '履历', en: 'Experience' },
    travels: { zh: '游历', en: 'Travels' },
    contact: { zh: '尺素', en: 'Contact' },
  } as Record<'about' | 'stack' | 'journey' | 'travels' | 'contact', T>,
  sectionNo: ['壹', '贰', '叁', '肆', '伍'],
  // {n} 会替换成地点数量
  travelCount: { zh: '足迹 {n} 处 · 未完待续', en: '{n} places so far · to be continued' } as T,
  scrollHint: { zh: '向下滚动 · 入山', en: 'Scroll to enter the mountains' } as T,
  rolesTitle: { zh: '身份', en: 'Roles' } as T,
  emailLabel: { zh: '邮箱', en: 'Email' } as T,
  wechatLabel: { zh: '微信', en: 'WeChat' } as T,
  wechatTip: { zh: '扫码添加微信', en: 'Scan to add me on WeChat' } as T,
  contactLead: {
    zh: '山高水长，来信必复。',
    en: 'However far the mountains, every letter gets a reply.',
  } as T,
  close: { zh: '关闭', en: 'Close' } as T,
  langToggle: { zh: 'EN', en: '中' } as T,
  footer: { zh: '無限進步', en: 'Endless progress' } as T,
};
