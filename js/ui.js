import { TZ as DEFAULT_TZ, BIZ_LOGOS, DEFAULT_LOGO } from './config.js';
import { loc, t } from './i18n.js';

/* Regional settings come from the business (timezone, date format). Set once after the business loads. */
let TZ = DEFAULT_TZ, DFMT = 'DD/MM/YYYY';
export const setRegion = ({ timezone, date_format } = {}) => { if (timezone) { try { new Intl.DateTimeFormat('en', { timeZone: timezone }); TZ = timezone; } catch (_) { /* keep */ } } if (date_format) DFMT = date_format; };
export const getTz = () => TZ;

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

let CUR = 'TZS';
export const setCurrency = c => { CUR = c || 'TZS'; };
export const num = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
export const money = n => `${CUR} ${num(n)}`;
export const compact = n => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n || 0));
export const pct = (a, b) => b ? ((a - b) / b * 100) : (a > 0 ? 100 : 0);

const isDay = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const asDate = v => (v instanceof Date ? v : new Date(isDay(v) ? v + 'T12:00:00Z' : v));
// plain dates (YYYY-MM-DD) are calendar days: never shifted by timezone
export const fmtDate = v => { if (!v) return '—'; const d = asDate(v); const tz = isDay(v) ? 'UTC' : TZ; if (DFMT === 'YYYY-MM-DD') return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d); if (DFMT === 'MM/DD/YYYY') return new Intl.DateTimeFormat('en-US', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d); return new Intl.DateTimeFormat(loc('en-GB'), { timeZone: tz, day: '2-digit', month: 'short', year: 'numeric' }).format(d); };
export const fmtTime = v => v ? new Intl.DateTimeFormat(loc('en-GB'), { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true }).format(asDate(v)) : '';
export const fmtDateTime = v => v ? `${fmtDate(v)}, ${fmtTime(v)}` : '—';
export const shortDay = v => new Intl.DateTimeFormat(loc('en-GB'), { timeZone: isDay(v) ? 'UTC' : TZ, day: 'numeric', month: 'short' }).format(asDate(v));
export const todayEAT = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
export const addDays = (ds, n) => { const d = new Date(ds + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const eatHour = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date())) % 24;
export const ago = v => {
  const s = Math.max(0, (Date.now() - new Date(v).getTime()) / 1000);
  if (s < 45) return t('just now'); if (s < 3600) return t(Math.round(s / 60) + ' min ago'); if (s < 86400) return t(Math.round(s / 3600) + ' hr ago');
  if (s < 604800) return t(Math.round(s / 86400) + ' d ago'); return fmtDate(v);
};
export const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
export const phoneLink = p => esc(p || '');

export function greeting(name) {
  const h = eatHour(); const first = String(name || '').split(' ')[0];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  if (h < 5) return { title: `Still up, ${first}? 🌙`, sub: pick(['Night owls run the best shops. Don’t forget to rest 😴', 'Late-night hustle detected 🦉 — stay hydrated 💧']) };
  if (h < 12) return { title: `Good morning, ${first} ☀️`, sub: pick(['Fresh day, fresh sales. Let’s get it 🚀', 'Rise & shine — the shop is waiting ✨', 'Coffee first, then conquer ☕💪']) };
  if (h < 17) return { title: `Good afternoon, ${first} 🌤️`, sub: pick(['Hope the sales are rolling in 💸', 'Midday check-in: you’re doing great 🔥', 'Keep that energy up — customers love it ⚡']) };
  if (h < 21) return { title: `Good evening, ${first} 🌆`, sub: pick(['Almost wrap-up time — let’s count the wins 🏆', 'Golden hour for sales ✨ finish strong 💫', 'Evening vibes 😎 here’s how the day went']) };
  return { title: `Good night, ${first} 🌙`, sub: pick(['Day’s nearly done — proud of the hustle 🙌', 'Review the numbers, then rest well 😌']) };
}

/* ---------- toast ---------- */
let toastWrap;
export function toast(type, title, msg = '', ms = 4500) {
  if (!toastWrap) { toastWrap = document.createElement('div'); toastWrap.className = 'toast-wrap'; document.body.appendChild(toastWrap); }
  const icon = { success: 'bi-check-circle-fill text-success', error: 'bi-x-octagon-fill text-danger', warn: 'bi-exclamation-triangle-fill text-warning', info: 'bi-stars' }[type] || 'bi-info-circle-fill';
  const el = document.createElement('div'); el.className = `fb-toast ${type}`;
  el.innerHTML = `<i class="bi ${icon} fs-5"></i><div class="flex-grow-1"><div class="t">${esc(title)}</div>${msg ? `<div class="m">${esc(msg)}</div>` : ''}</div>`;
  toastWrap.appendChild(el); setTimeout(() => { el.style.opacity = 0; el.style.transition = '.3s'; setTimeout(() => el.remove(), 300); }, ms);
}
export const ok = (t, m) => toast('success', t, m);
export const fail = e => toast('error', 'Something went wrong', e && e.message ? e.message : String(e));

/* ---------- modal ---------- */
export function openModal({ title, body, footer = '', size = '', onShown }) {
  const el = document.createElement('div'); el.className = 'modal fade'; el.tabIndex = -1;
  el.innerHTML = `<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable ${size}"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">${title}</h5><button class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body">${body}</div>${footer ? `<div class="modal-footer">${footer}</div>` : ''}</div></div>`;
  document.body.appendChild(el);
  const m = new bootstrap.Modal(el); el.addEventListener('hidden.bs.modal', () => { m.dispose(); el.remove(); });
  el.addEventListener('shown.bs.modal', () => onShown && onShown(el));
  m.show(); return { el, close: () => m.hide(), modal: m };
}

export function confirmBox({ title = 'Are you sure?', message = '', confirmText = 'Confirm', danger = false, input = null }) {
  return new Promise(res => {
    let done = false;
    const mm = openModal({ title: esc(title), size: 'modal-sm',
      body: `<p class="mb-3">${message}</p>${input ? `<label class="form-label">${esc(input.label)}</label><input class="form-control" id="cbInput" placeholder="${esc(input.placeholder || '')}" maxlength="255">` : ''}`,
      footer: `<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn ${danger ? 'btn-danger-soft' : 'btn-fb'}" id="cbOk">${esc(confirmText)}</button>` });
    mm.el.querySelector('#cbOk').onclick = () => {
      const v = input ? mm.el.querySelector('#cbInput').value.trim() : true;
      if (input && input.required && v.length < 3) { mm.el.querySelector('#cbInput').classList.add('is-invalid'); return; }
      done = true; res(v); mm.close();
    };
    mm.el.addEventListener('hidden.bs.modal', () => { if (!done) res(false); });
  });
}

/* ---------- html helpers ---------- */
export const skeleton = (n = 4, h = 18) => Array.from({ length: n }, () => `<div class="skeleton mb-2" style="height:${h}px"></div>`).join('');
export const empty = (icon, title, text = '') => `<div class="empty"><i class="bi ${icon}"></i><div class="fw-bold text-body">${esc(title)}</div><div>${esc(text)}</div></div>`;
export const pill = (text, kind = '') => `<span class="pill ${kind}">${esc(text)}</span>`;
export const PAY = { cash: ['Cash', 'bi-cash-coin'], mobile_money: ['Mobile money', 'bi-phone'], card: ['Card', 'bi-credit-card'], bank: ['Bank', 'bi-bank'], other: ['Other', 'bi-three-dots'] };
export const payLabel = k => (PAY[k] || [k])[0];
export const ORDER_STATUS = { new: ['New', 'info'], contacted: ['Contacted', 'warning'], confirmed: ['Confirmed', 'gold'], completed: ['Completed', 'success'], cancelled: ['Cancelled', 'danger'] };
export const statusPill = s => { const [t, k] = ORDER_STATUS[s] || [s, '']; return pill(t, k); };
export const stockPill = p => !p.track_stock ? pill('Service', 'info') : p.stock_qty <= 0 ? pill('Out of stock', 'danger') : p.stock_qty <= p.low_stock_at ? pill(`Low · ${p.stock_qty}`, 'warning') : pill(`${p.stock_qty} in stock`, 'success');
export const thumb = (url, name = '') => `<div class="thumb">${url ? `<img src="${esc(url)}" alt="${esc(name)}" loading="lazy">` : '<i class="bi bi-image"></i>'}</div>`;
export const delta = (cur, prev) => { const d = pct(cur, prev); const k = Math.abs(d) < 0.5 ? 'flat' : d > 0 ? 'up' : 'down'; return `<span class="delta ${k}"><i class="bi bi-${k === 'up' ? 'arrow-up-right' : k === 'down' ? 'arrow-down-right' : 'dash'}"></i>${Math.abs(d).toFixed(0)}%</span>`; };

export function pager(el, { total, page, limit }, go) {
  const pages = Math.max(1, Math.ceil(total / limit));
  el.innerHTML = `<div>${total ? `Showing ${(page - 1) * limit + 1}–${Math.min(total, page * limit)} of ${num(total)}` : 'No results'}</div>
    <div class="d-flex gap-2"><button class="btn btn-soft btn-sm" ${page <= 1 ? 'disabled' : ''} data-p="${page - 1}"><i class="bi bi-chevron-left"></i> Prev</button><span class="align-self-center">${page} / ${pages}</span><button class="btn btn-soft btn-sm" ${page >= pages ? 'disabled' : ''} data-p="${page + 1}">Next <i class="bi bi-chevron-right"></i></button></div>`;
  el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => go(Number(b.dataset.p)));
}

export function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(c => { const s = String(c ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Shrinks a photo in the browser to a JPEG data-URL (keeps uploads small and fast). */
export function resizeImage(file, max = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error('Please choose an image'));
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas');
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Could not read that image')); img.src = url;
  });
}

export function applyTheme({ primary, accent, mode } = {}) {
  const r = document.documentElement;
  if (mode) { r.dataset.theme = mode; r.dataset.bsTheme = mode; }
  if (primary) { r.style.setProperty('--primary', primary); r.style.setProperty('--on-primary', luminance(primary) > 0.55 ? '#17130a' : '#ffffff'); }
  if (accent) r.style.setProperty('--accent', accent);
}
function luminance(hex) { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }

export function chartTheme() {
  const cs = getComputedStyle(document.documentElement);
  return { primary: cs.getPropertyValue('--primary').trim(), accent: cs.getPropertyValue('--accent').trim(), text: cs.getPropertyValue('--muted').trim(), grid: cs.getPropertyValue('--border').trim(), surface: cs.getPropertyValue('--surface').trim() };
}
export const PALETTE = ['#d4af55', '#56a8ff', '#2fd18b', '#ff7a8a', '#b07cff', '#ffb84d', '#4fd1c5', '#f472b6'];


/* ---------- business logo ---------- */
/** The logo to show for a business: its own uploaded logo, else a bundled emblem, else the FBBMS mark. */
export const bizLogo = b => (b && b.theme && b.theme.logo_url) || (b && BIZ_LOGOS[b.slug]) || DEFAULT_LOGO;
export const hasCustomLogo = b => !!(b && b.theme && b.theme.logo_url);

/**
 * Prepares a logo in the browser: checks the file, scales it down (max 600 px) and keeps transparency.
 * PNG/WebP stay PNG (transparent background is preserved), JPEG stays JPEG. Resolves { data, width, height, bytes }.
 */
export function prepareLogo(file, { max = 600, minSide = 64, maxBytes = 1.8 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Choose an image first'));
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error('Choose a PNG, JPG or WebP image'));
    if (file.size > 15 * 1024 * 1024) return reject(new Error('That file is too big (max 15 MB)'));
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (Math.min(img.width, img.height) < minSide) return reject(new Error(`Image is too small (at least ${minSide}×${minSide} pixels)`));
      const jpeg = file.type === 'image/jpeg'; let scale = Math.min(1, max / Math.max(img.width, img.height));
      for (let i = 0; i < 6; i++) {
        const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
        const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
        if (jpeg) { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
        x.drawImage(img, 0, 0, c.width, c.height);
        const data = jpeg ? c.toDataURL('image/jpeg', 0.9) : c.toDataURL('image/png');
        const bytes = Math.round((data.length - data.indexOf(',') - 1) * 0.75);
        if (bytes <= maxBytes) return resolve({ data, width: c.width, height: c.height, bytes });
        scale *= 0.75;
      }
      reject(new Error('Could not shrink that image enough. Try a simpler or smaller file.'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')); };
    img.src = url;
  });
}
