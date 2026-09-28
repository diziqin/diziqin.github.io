import { contact, profile, ui } from '../content';
import { bind, onLang } from '../i18n';
import { mainSeal } from '../hero/seal';

/**
 * 尺素：一页八行笺，写着联系方式。
 * 「封缄」：信纸折起装入信封、盖印，鸿雁衔去；「展信」再打开。
 */
export function buildLetter(onSeal: (sealed: boolean) => void) {
  const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', children: (Node | string)[] = []) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    e.append(...children);
    return e;
  };

  const lead = bind(h('p', 'letter-lead'), ui.contactLead);
  const rows = h('ul', 'letter-rows');
  const mail = h('a', 'letter-value', [contact.email]);
  mail.href = `mailto:${contact.email}`;
  rows.append(h('li', 'letter-row', [bind(h('span', 'letter-label'), ui.emailLabel), mail]));
  contact.links.forEach((l) => {
    const a = h('a', 'letter-value', [l.url.replace(/^https?:\/\//, '').replace(/\/$/, '') || l.label]);
    a.href = l.url;
    a.target = '_blank';
    a.rel = 'noopener';
    rows.append(h('li', 'letter-row', [h('span', 'letter-label', [l.label]), a]));
  });
  const wechat = bind(h('button', 'letter-value as-link'), ui.wechatTip);
  wechat.type = 'button';
  rows.append(h('li', 'letter-row', [bind(h('span', 'letter-label'), ui.wechatLabel), wechat]));
  const sign = bind(h('p', 'letter-sign'), { zh: `${profile.name.zh} 敬上`, en: `— ${profile.name.en}` });

  const paper = h('div', 'letter-paper', [lead, rows, sign]);
  const envelope = h('div', 'envelope');
  const envSeal = h('div', 'envelope-seal');
  envSeal.innerHTML = mainSeal(profile.seal);
  envelope.append(bind(h('span', 'envelope-to'), { zh: '寄 · 山外', en: 'To · beyond the mountains' }), envSeal);
  const stage = h('div', 'letter-stage no-ink', [paper, envelope]);

  const btn = h('button', 'letter-btn');
  btn.type = 'button';
  const status = h('p', 'letter-status');
  const root = h('div', 'letter', [stage, h('div', 'letter-actions', [btn, status])]);

  let sealed = false;
  const render = () => {
    const en = document.documentElement.lang === 'en';
    btn.textContent = sealed ? (en ? 'Open' : '展信') : en ? 'Seal it' : '封缄';
    status.textContent = sealed ? (en ? 'Sealed. The wild geese will carry it.' : '已封缄 · 托鸿雁寄往山外') : '';
  };
  render();
  onLang(render);
  btn.addEventListener('click', () => {
    sealed = !sealed;
    root.classList.toggle('is-sealed', sealed);
    render();
    onSeal(sealed);
  });

  return { root, wechat };
}
