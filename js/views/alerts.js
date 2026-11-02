import { get, post } from '../api.js';
import { esc, ago, empty, skeleton, fail, ok, pill } from '../ui.js';

const SEV = { critical: ['bi-exclamation-octagon-fill', 'danger', 'Critical'], warn: ['bi-exclamation-triangle-fill', 'warning', 'Warning'], info: ['bi-info-circle-fill', 'info', 'Info'] };
const LINK = t => t.startsWith('stock') ? 'products' : t.startsWith('cash') ? 'cash' : t.startsWith('refund') ? 'refunds' : t.startsWith('order') ? 'orders' : t.startsWith('sale') ? 'sales' : t.startsWith('expense') ? 'expenses' : t.startsWith('po') || t.startsWith('supplier') ? 'suppliers' : t.startsWith('customer') ? 'customers' : t.startsWith('health') ? 'health' : null;

export async function render(el, ctx) {
  const st = { unread: false };
  el.innerHTML = `<div class="page-head"><div><h1>Alerts</h1><p>Low stock, large discounts, voids, cash differences and daily summaries.</p></div><div class="d-flex gap-2"><button class="btn btn-soft" id="mark"><i class="bi bi-check2-all me-1"></i>Mark all read</button></div></div>
  <div class="chips mb-3"><span class="chip active" data-f="all">All</span><span class="chip" data-f="unread">Unread <small id="uc"></small></span></div><div id="l">${skeleton(5, 56)}</div>`;
  const $ = s => el.querySelector(s); let rows = [];
  const load = async () => {
    try {
      const r = await get('/b/notifications', { limit: 100, unread: st.unread ? 1 : undefined }); rows = r.rows; ctx.alerts = r.unread;
      $('#uc').textContent = r.unread || ''; document.querySelectorAll('#nav .badge-dot').forEach(() => {});
      $('#l').innerHTML = rows.length ? rows.map(n => { const [ic, k] = SEV[n.severity] || SEV.info; const link = LINK(n.type); return `<div class="fb-card mb-2 d-flex gap-3 align-items-start" style="padding:12px 14px;${n.is_read ? 'opacity:.7' : `border-left:3px solid var(--bs-${k})`}"><i class="bi ${ic} fs-4 text-${k}"></i><div class="flex-grow-1"><div class="fw-semibold">${esc(n.title)} ${n.is_read ? '' : pill('New', k)}</div>${n.body ? `<div class="small muted">${esc(n.body)}</div>` : ''}<div class="small muted mt-1">${ago(n.created_at)}${link && ctx.can ? ` · <a href="#/${link}">Open ${link}</a>` : ''}</div></div>${n.is_read ? '' : `<button class="btn btn-sm btn-soft" data-r="${n.id}" title="Mark read"><i class="bi bi-check2"></i></button>`}</div>`; }).join('') : empty('bi-bell-slash', st.unread ? 'No unread alerts' : 'No alerts yet', 'Important events will appear here.');
      el.querySelectorAll('[data-r]').forEach(b => b.onclick = async () => { try { await post('/b/notifications/read', { ids: [Number(b.dataset.r)] }); load(); } catch (e) { fail(e); } });
    } catch (e) { $('#l').innerHTML = `<div class="text-danger">${esc(e.message)}</div>`; }
  };
  el.querySelectorAll('[data-f]').forEach(c => c.onclick = () => { st.unread = c.dataset.f === 'unread'; el.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('active', x === c)); load(); });
  $('#mark').onclick = async () => { try { await post('/b/notifications/read', {}); ok('All marked as read'); ctx.alerts = 0; load(); } catch (e) { fail(e); } };
  ctx.on('notification', () => load());
  await load();
}
