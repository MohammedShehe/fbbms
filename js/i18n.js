/* ─────────────────────────────────────────────────────────────────────────────
   FBBMS i18n — English (default) + Kiswahili

   How it works
   • The app is written in English. When the active language is Swahili, every piece of text that reaches the
     page (text, placeholders, tooltips, toasts, modals, charts, native dialogs, printed receipts, exports) is
     looked up in the dictionary (js/i18n.sw.js) and replaced. Anything not in the dictionary simply stays English,
     so a missing word can never break the app.
   • Dictionary keys may contain {0} {1} … placeholders so sentences with numbers / names translate too
     ("Only {0} of {1}" → "Zimebaki {0} tu kati ya {1}").
   • Which language is used (first match wins):
        1. the person's own choice (saved on their account)         users.language
        2. their business default, set by the Super Admin           businesses.settings.language
        3. the platform default, set by the Developer               platform_settings.platform.default_language
        4. English
   • The resolved language is cached in localStorage ("fbbms_lang") so the page paints in the right language
     immediately. Switching language reloads the page once so every screen is re-rendered cleanly.
   ───────────────────────────────────────────────────────────────────────────── */
import { PAIRS } from './i18n.sw.js';

const KEY = 'fbbms_lang';
export const LANGS = [{ code: 'en', name: 'English', native: 'English', short: 'EN' }, { code: 'sw', name: 'Swahili', native: 'Kiswahili', short: 'SW' }];
const valid = v => v === 'en' || v === 'sw';

let LANG = (() => { try { const v = localStorage.getItem(KEY); return valid(v) ? v : 'en'; } catch (_) { return 'en'; } })();
export const getLang = () => LANG;
export const isSw = () => LANG === 'sw';
/** Locale to hand to Intl / toLocaleString so month and day names follow the language. */
export const loc = (fallback = 'en-GB') => (LANG === 'sw' ? 'sw-TZ' : fallback);

/** Saves the resolved language. Returns true when it changed (the caller normally reloads the page). */
export function setResolved(lang) {
  const next = valid(lang) ? lang : 'en';
  const changed = next !== LANG;
  try { localStorage.setItem(KEY, next); } catch (_) { /* private mode */ }
  return changed;
}
/** Picks the language to use from the three levels described above. */
export const resolve = ({ personal, business, platform } = {}) => [personal, business, platform].find(valid) || 'en';

/* ---------------- dictionary ---------------- */
const norm = s => String(s).replace(/\s+/g, ' ').trim();
const exact = new Map(); const patterns = [];
(function build() {
  for (const [en, sw] of PAIRS) {
    const key = norm(en);
    if (!/\{\d+\}/.test(key)) { if (!exact.has(key)) exact.set(key, sw); continue; }
    const names = []; let re = '';
    key.split(/(\{\d+\})/).forEach(part => { const m = /^\{(\d+)\}$/.exec(part); if (m) { names.push(m[1]); re += '(.+?)'; } else re += part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    const lits = key.split(/\{\d+\}/).map(x => x.trim()).filter(Boolean).sort((a, b) => b.length - a.length);
    patterns.push({ re: new RegExp('^' + re + '$', 's'), names, sw, anchor: lits[0] || '', weight: lits.join('').length });
  }
  patterns.sort((a, b) => b.weight - a.weight); // most specific sentence first
})();

const cache = new Map();
const hasLetters = s => /[A-Za-z]/.test(s);
function lookup(s) {
  if (exact.has(s)) return exact.get(s);
  for (const p of patterns) {
    if (p.anchor && !s.includes(p.anchor)) continue;
    const m = p.re.exec(s); if (!m) continue;
    const vars = {}; p.names.forEach((n, i) => { vars[n] = m[i + 1]; }); // captured names / numbers are never translated
    return p.sw.replace(/\{(\d+)\}/g, (_, n) => (n in vars ? vars[n] : `{${n}}`));
  }
  return null;
}

/** Translates one string. Unknown text is returned unchanged. */
export function t(text, vars) {
  let s = String(text ?? '');
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
  if (LANG !== 'sw' || !s || !hasLetters(s)) return s;
  const n = norm(s);
  let r = cache.get(n);
  if (r === undefined) { r = lookup(n); if (cache.size > 6000) cache.clear(); cache.set(n, r); }
  if (r === null) return s;
  const lead = /^\s*/.exec(s)[0], trail = /\s*$/.exec(s)[0];
  return lead + r + trail;
}
/** Same as t() but returns null when there is no translation (used internally and by tests). */
export const has = text => LANG === 'sw' && lookup(norm(text)) !== null;

/** Translates the visible text and attributes inside an HTML string (receipts, print windows, exports). */
export function translateHtml(html) {
  if (LANG !== 'sw') return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  walk(doc.body); return doc.body.innerHTML;
}

/* ---------------- DOM translation ---------------- */
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT', 'CANVAS']);
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'data-bs-original-title'];
const skipEl = el => !el || SKIP.has(el.tagName) || (el.closest && el.closest('[data-no-i18n]'));

function textNode(n) {
  const v = n.nodeValue; if (!v || !hasLetters(v)) return;
  const r = t(v); if (r !== v && !skipEl(n.parentNode)) n.nodeValue = r;
}
function attrs(el) {
  if (skipEl(el)) return;
  for (const a of ATTRS) { const v = el.getAttribute && el.getAttribute(a); if (v && hasLetters(v)) { const r = t(v); if (r !== v) el.setAttribute(a, r); } }
  if (el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) && el.value) { const r = t(el.value); if (r !== el.value) el.value = r; }
}
function walk(root) {
  if (!root) return;
  if (root.nodeType === 3) return textNode(root);
  if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
  if (root.nodeType === 1) attrs(root);
  const tw = document.createTreeWalker(root, 1 | 4); // elements + text
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (n.nodeType === 3) textNode(n); else attrs(n); }
}

let observer;
function startObserver() {
  if (observer || LANG !== 'sw') return;
  observer = new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'childList') m.addedNodes.forEach(n => walk(n));
      else if (m.type === 'characterData') textNode(m.target);
      else if (m.type === 'attributes') attrs(m.target);
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat('value') });
}

/* Native dialogs and charts are not part of the DOM, so they are wrapped once. */
function patchGlobals() {
  if (LANG !== 'sw') return;
  const w = window;
  if (!w.__i18nDialogs) {
    w.__i18nDialogs = true;
    const c = w.confirm.bind(w), a = w.alert.bind(w), p = w.prompt.bind(w);
    w.confirm = m => c(t(m)); w.alert = m => a(t(m)); w.prompt = (m, d) => p(t(m), d);
  }
  if (w.Chart && !w.Chart.__i18n) {
    const Base = w.Chart;
    const tr = cfg => {
      try {
        const d = cfg && cfg.data; if (d) { if (Array.isArray(d.labels)) d.labels = d.labels.map(l => (typeof l === 'string' ? t(l) : l)); (d.datasets || []).forEach(s => { if (typeof s.label === 'string') s.label = t(s.label); }); }
        const pl = cfg && cfg.options && cfg.options.plugins; if (pl && pl.title && typeof pl.title.text === 'string') pl.title.text = t(pl.title.text);
      } catch (_) { /* never block a chart */ }
      return cfg;
    };
    class TChart extends Base { constructor(item, cfg) { super(item, tr(cfg)); } }
    TChart.__i18n = true; w.Chart = TChart;
  }
}

/** Call once per page, after the DOM exists. Sets <html lang>, translates what is there and keeps watching. */
export function init() {
  document.documentElement.lang = LANG;
  if (LANG !== 'sw') return;
  patchGlobals();
  walk(document.documentElement);
  startObserver();
}

/** Translates a whole row/array of cells (used by the Excel / PDF export). Non-strings are left alone. */
export const tAll = a => (Array.isArray(a) ? a.map(x => (typeof x === 'string' ? t(x) : x)) : a);
