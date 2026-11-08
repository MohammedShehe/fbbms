import { get } from '../api.js';
import { esc, money, num, fmtDate, todayEAT, empty, skeleton, pill, PAY, debounce } from '../ui.js';
import { rangeBar, monthStart, kpi, waLink } from './_kit.js';
import { bookingDetail, statusPill, waText } from './_rental.js';
import { exportButtons } from '../export.js';

export async function render(el, ctx) {
  const st = { from: monthStart(), to: todayEAT(), type: '', method: '', q: '' }; let d = null;
  el.innerHTML = `<div class="page-head"><div><h1>Payments & balances</h1><p>Every payment, refund and deduction, and who still owes money.</p></div><div class="d-flex gap-2" id="act"></div></div><div class="row g-3 mb-3" id="k"></div>
  <div class="fb-card mb-3"><div class="d-flex justify-content-between"><h3>Outstanding balances</h3><b id="ot"></b></div><div class="card-sub">Bookings that are not fully paid</div><div id="ob">${skeleton(3, 30)}</div></div>
  <div class="filters" id="rb"></div><div class="filters"><select id="ty" class="form-select" style="max-width:170px"><option value="">All types</option><option value="payment">Payments</option><option value="refund">Refunds</option><option value="deduction">Deductions</option></select><select id="me" class="form-select" style="max-width:170px"><option value="">All methods</option>${['cash', 'bank', 'ewallet'].map(k => `<option value="${k}">${esc(PAY[k][0])}</option>`).join('')}</select><div class="search"><i class="bi bi-search"></i><input id="q" class="form-control" placeholder="Booking, customer or plate…"></div></div>
  <div class="tbl-wrap"><table class="fb-table stack"><thead><tr><th>Date</th><th>Booking</th><th>Customer</th><th>Type</th><th>Method</th><th class="num">Amount</th><th>By</th></tr></thead><tbody id="r"></tbody></table></div>`;
  const $ = s => el.querySelector(s); rangeBar($('#rb'), st, () => load());
  const load = async () => {
    try {
      d = await get('/b/rentals/payments', st); const T = d.totals;
      $('#k').innerHTML = [kpi('bi-box-arrow-in-down', 'Received', money(T.received), 'In this period', 'var(--success)'), kpi('bi-arrow-counterclockwise', 'Refunded', money(T.refunded), '', 'var(--warning)'), kpi('bi-dash-circle', 'Deductions', money(T.deductions), 'Reduced what customers owe', 'var(--info)'), kpi('bi-hourglass-split', 'Outstanding', money(d.outstanding_total), `${d.outstanding.length} booking(s)`, d.outstanding_total > 0 ? 'var(--danger)' : 'var(--success)')].join('');
      $('#ot').textContent = money(d.outstanding_total);
      $('#ob').innerHTML = d.outstanding.length ? d.outstanding.map(b => `<div class="feed-item" style="cursor:pointer" data-b="${b.id}"><div class="flex-grow-1"><div class="fw-semibold">${esc(b.customer_name)} · ${esc(b.booking_no)}</div><div class="small muted">${esc(b.make)} ${esc(b.model)} · returns ${fmtDate(b.return_date)} ${statusPill(b)}</div></div><b style="color:var(--danger)">${money(b.balance)}</b>${b.customer_phone ? `<a class="btn btn-sm btn-soft ms-2" target="_blank" rel="noopener" href="${waLink(b.customer_phone, waText(ctx, b))}" onclick="event.stopPropagation()"><i class="bi bi-whatsapp"></i></a>` : ''}</div>`).join('') : empty('bi-check2-circle', 'Everyone is paid up');
      $('#ob').querySelectorAll('[data-b]').forEach(c => c.onclick = () => bookingDetail(ctx, Number(c.dataset.b), load));
      $('#r').innerHTML = d.rows.length ? d.rows.map(p => `<tr><td data-label="Date">${fmtDate(p.created_at)}</td><td data-label="Booking"><a href="#" data-b="${p.booking_id}"><b>${esc(p.booking_no)}</b></a><br><small class="muted">${esc(p.make)} ${esc(p.model)}</small></td><td data-label="Customer">${esc(p.customer_name)}</td><td data-label="Type">${pill(p.type, p.type === 'payment' ? 'success' : p.type === 'refund' ? 'warning' : 'info')}</td><td data-label="Method">${p.method ? esc((PAY[p.method] || [p.method])[0]) : '—'}${p.reference ? `<br><small class="muted">${esc(p.reference)}</small>` : ''}</td><td data-label="Amount" class="num">${p.type === 'refund' ? '−' : ''}${money(p.amount)}</td><td data-label="By">${esc(p.by_name || '')}</td></tr>`).join('') : `<tr><td colspan="7">${empty('bi-cash', 'No payments in this period')}</td></tr>`;
      $('#r').querySelectorAll('[data-b]').forEach(a => a.onclick = e => { e.preventDefault(); bookingDetail(ctx, Number(a.dataset.b), load); });
    } catch (e) { $('#r').innerHTML = `<tr><td colspan="7">${empty('bi-exclamation-triangle', 'Could not load', e.message)}</td></tr>`; }
  };
  $('#ty').onchange = e => { st.type = e.target.value; load(); }; $('#me').onchange = e => { st.method = e.target.value; load(); }; $('#q').oninput = debounce(e => { st.q = e.target.value; load(); }, 300);
  exportButtons($('#act'), async () => ({ filename: `rental_payments_${st.from}_${st.to}`, title: 'Rental payments', subtitle: `${st.from} to ${st.to}`, columns: ['Date', 'Booking', 'Customer', 'Type', 'Method', 'Amount'], rows: d.rows.map(p => [String(p.created_at).slice(0, 10), p.booking_no, p.customer_name, p.type, p.method || '', (p.type === 'refund' ? '-' : '') + p.amount]) }));
  ['booking.changed'].forEach(e => ctx.on(e, debounce(load, 600))); await load();
}
