import type { Lang, T } from './content';

type Binding = { el: HTMLElement; t: T; attr?: string };

const KEY = 'xborn-lang';
const bindings: Binding[] = [];
const listeners: ((l: Lang) => void)[] = [];

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {
    /* 无痕模式等情况下 localStorage 不可用 */
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

let lang: Lang = initial();

function apply(b: Binding) {
  const v = b.t[lang];
  if (b.attr) b.el.setAttribute(b.attr, v);
  else b.el.textContent = v;
}

export const getLang = () => lang;

/** 绑定一个元素的文字（或属性）到双语文本 */
export function bind<E extends HTMLElement>(el: E, t: T, attr?: string): E {
  const b = { el, t, attr };
  bindings.push(b);
  apply(b);
  return el;
}

export function onLang(fn: (l: Lang) => void) {
  listeners.push(fn);
}

export function setLang(l: Lang) {
  lang = l;
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
  bindings.forEach(apply);
  listeners.forEach((fn) => fn(l));
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* 忽略 */
  }
}

document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
