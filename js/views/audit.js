import { get } from '../api.js';
import { esc, fmtDateTime, pill, pager, debounce, empty, skeleton, todayEAT, addDays } from '../ui.js';

const KIND = a => a.startsWith('sale.void') || a.includes('cancel') || a.includes('failed') || a.includes('disable') ? 'danger' : a.includes('override') || a.includes('discount') || a.includes('adjust') || a.includes('damage') ? 'warning' : a.startsWith('sale') || a.startsWith('order') ? 'info' : 'gold';
export const detailText = d => d ? Object.entries(d).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ') : '';

export async function render(el, ctx) {
  const team = await get('/b/team').catch(() => []); const st = { page: 1, limit: 50, q: '', user: '', action: '', from: addDays(todayEAT(), -13), to: todayEAT() };
  el.innerHTML = `<div class="page-head"><div><h1>Audit trail</h1><p>A tamper-proof diary of who did what, and when — sales, voids, discounts, price changes, stock and access.</p></div></div>
  <div class="filters"><div class="search"><i class="bi bi-search"></i><input id="q" class="form-control" placeholder="Search details…"></div><input type="date" id="from" class="form-control" value="${st.from}"><input type="date" id="to" class="form-control" value="${st.to}">
  <select id="user" class="form-select"><option value="">Everyone</option>${team.map(t => `<option value="${t.user_id}">${esc(t.name)}</option>`).join('')}</select>
  <select id="action" class="form-select"><option value="">All actions</option><option value="sale.void">Voided sales</option><option value="sale.price_override">Price overrides</option><option value="sale.create">Sales</option><option value="stock">Stock changes</option><option value="product">Product edits</option><option value="order">Orders</option><option value="team">Team changes</option><option value="login">Sign-ins</option><option value="expense">Expenses</option></select></div>
  <div class="tbl-wrap"><table class="fb-table stack"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th><th>IP</th></tr></thead><tbody id="rows"></tbody></table></div><div class="pager" id="pg"></div>`;
  const $ = s => el.querySelector(s);
  const load = async () => { $('#rows').innerHTML = `<tr><td colspan="5">${skeleton(6, 22)}</td></tr>`; try { const r = await get('/b/audit', st);
    $('#rows').innerHTML = r.rows.length ? r.rows.map(a => `<tr><td data-label="When">${fmtDateTime(a.created_at)}</td><td data-label="Who">${esc(a.user_name || 'Customer / system')}</td><td data-label="Action">${pill(a.action, KIND(a.action))}</td><td data-label="Details" class="small" style="max-width:420px;word-break:break-word">${esc(detailText(a.details))}</td><td data-label="IP" class="small muted">${esc(a.ip || '')}</td></tr>`).join('') : `<tr><td colspan="5">${empty('bi-shield-check', 'Nothing recorded for these filters')}</td></tr>`;
    pager($('#pg'), r, p => { st.page = p; load(); }); } catch (e) { $('#rows').innerHTML = `<tr><td colspan="5">${empty('bi-exclamation-triangle', 'Error', e.message)}</td></tr>`; } };
  ['from', 'to', 'user', 'action'].forEach(k => $('#' + k).onchange = e => { st[k] = e.target.value; st.page = 1; load(); }); $('#q').oninput = debounce(e => { st.q = e.target.value; st.page = 1; load(); }, 350); load();
}
