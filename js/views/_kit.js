// Small shared helpers for the Barber Shop and Car Rental screens.
import { esc, money, num, fmtDate, pill, empty, openModal, fail, ok, todayEAT, addDays } from '../ui.js';

export const kpi = (ico, lbl, val, sub = '', color = 'var(--primary)') => `<div class="col-6 col-xl-3"><div class="kpi" style="--c:${color}"><div class="ico"><i class="bi ${ico}"></i></div><div class="lbl">${lbl}</div><div class="val">${val}</div>${sub ? `<div class="sub small muted">${sub}</div>` : ''}</div></div>`;
export const hhmm = t => (t ? String(t).slice(0, 5) : '');
export const time12 = t => { if (!t) return ''; const [h, m] = String(t).split(':'); const H = Number(h); return `${((H + 11) % 12) + 1}:${m} ${H >= 12 ? 'PM' : 'AM'}`; };
export const monthStart = () => todayEAT().slice(0, 8) + '01';
export const waLink = (phone, text) => { const d = String(phone || '').replace(/[^0-9]/g, ''); return d ? `https://wa.me/${d}?text=${encodeURIComponent(text || '')}` : ''; };
export const telLink = phone => phone ? `<a href="tel:${esc(phone)}" class="text-decoration-none">${esc(phone)}</a>` : '—';

/** Runs an async button action with a spinner and prevents double clicks. */
export async function busy(btn, label, fn) {
  const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${label}`;
  try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = old; }
}
/** Date range filter row: returns state object and calls onChange when it changes. */
export function rangeBar(el, st, onChange, extra = '') {
  el.innerHTML = `<input type="date" class="form-control" id="rf" value="${st.from}"><input type="date" class="form-control" id="rt" value="${st.to}">
    <div class="btn-group" role="group"><button class="btn btn-soft" data-r="today">Today</button><button class="btn btn-soft" data-r="week">7 days</button><button class="btn btn-soft" data-r="month">Month</button></div>${extra}`;
  const set = (f, t) => { st.from = f; st.to = t; el.querySelector('#rf').value = f; el.querySelector('#rt').value = t; onChange(); };
  el.querySelector('#rf').onchange = e => { st.from = e.target.value; onChange(); }; el.querySelector('#rt').onchange = e => { st.to = e.target.value; onChange(); };
  el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { const t = todayEAT(); set(b.dataset.r === 'today' ? t : b.dataset.r === 'week' ? addDays(t, -6) : monthStart(), t); });
}
export const sum = (rows, k) => rows.reduce((a, r) => a + Number(r[k] || 0), 0);
export const bar = (pct, color = 'var(--primary)') => `<div style="height:6px;border-radius:4px;background:rgba(128,128,128,.2);overflow:hidden"><div style="height:100%;width:${Math.max(0, Math.min(100, pct))}%;background:${color}"></div></div>`;
export { esc, money, num, fmtDate, pill, empty, openModal, fail, ok };
