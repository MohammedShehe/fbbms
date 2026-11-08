import { get } from '../api.js';
import { esc, money, num, fmtDate, openModal, fail, empty, skeleton, debounce, pager, pill, thumb, downloadCSV } from '../ui.js';
import { time12, waLink } from './_kit.js';
import { BK, statusPill, bookingForm, bookingDetail, vehName } from './_rental.js';

export async function render(el, ctx) {
  const st = { scope: 'upcoming', q: '', page: 1, limit: 25, unpaid: '' }; const canBook = ctx.can('bookings.manage'); let last = null;
  el.innerHTML = `<div class="page-head"><div><h1>Bookings</h1><p>Create bookings, hand over and take back vehicles. Double bookings are blocked automatically.</p></div><div class="d-flex gap-2">${canBook ? '<button class="btn btn-fb" id="add"><i class="bi bi-plus-lg me-1"></i>New booking</button>' : ''}<button class="btn btn-soft" id="csv"><i class="bi bi-download me-1"></i>CSV</button></div></div>
  <div class="filters"><div class="btn-group" id="sc">${[['upcoming', 'Upcoming'], ['ongoing', 'Out now'], ['previous', 'Previous'], ['', 'All']].map(([k, l]) => `<button class="btn btn-soft ${k === st.scope ? 'active' : ''}" data-s="${k}">${l}</button>`).join('')}</div><div class="search"><i class="bi bi-search"></i><input id="q" class="form-control" placeholder="Booking no, customer, phone or plate…"></div><div class="form-check form-switch ms-2"><input class="form-check-input" type="checkbox" id="up"><label class="form-check-label small">With balance due</label></div></div>
  <div class="tbl-wrap"><table class="fb-table stack"><thead><tr><th>Booking</th><th>Vehicle</th><th>Customer</th><th>Pickup → Return</th><th>Status</th><th class="num">Total</th><th class="num">Balance</th></tr></thead><tbody id="r"></tbody></table></div><div class="pager" id="pg"></div>`;
  const $ = s => el.querySelector(s);
  const load = async () => {
    $('#r').innerHTML = `<tr><td colspan="7">${skeleton(5, 28)}</td></tr>`;
    try { last = await get('/b/rentals/bookings', st); $('#r').innerHTML = last.rows.length ? last.rows.map(b => `<tr data-id="${b.id}" style="cursor:pointer"><td data-label="Booking"><b>${esc(b.booking_no)}</b></td><td data-label="Vehicle">${esc(b.make)} ${esc(b.model)}<br><small class="muted">${esc(b.plate)}</small></td><td data-label="Customer">${esc(b.customer_name)}<br><small class="muted">${esc(b.customer_phone)}</small></td><td data-label="Dates">${fmtDate(b.pickup_date)} ${time12(b.pickup_time)}<br><small class="muted">→ ${fmtDate(b.return_date)} ${time12(b.return_time)} · ${b.days}d</small></td><td data-label="Status">${statusPill(b)}</td><td data-label="Total" class="num">${money(b.total)}</td><td data-label="Balance" class="num" style="color:${b.balance > 0 ? 'var(--danger)' : 'inherit'}">${b.balance > 0 ? money(b.balance) : '—'}</td></tr>`).join('') : `<tr><td colspan="7">${empty('bi-journal-x', 'No bookings here', canBook ? 'Create a booking to get started.' : '')}</td></tr>`;
      $('#r').querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => bookingDetail(ctx, Number(tr.dataset.id), load)); pager($('#pg'), last, p => { st.page = p; load(); });
    } catch (e) { $('#r').innerHTML = `<tr><td colspan="7">${empty('bi-exclamation-triangle', 'Could not load', e.message)}</td></tr>`; }
  };
  $('#sc').querySelectorAll('[data-s]').forEach(b => b.onclick = () => { st.scope = b.dataset.s; st.page = 1; $('#sc').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b)); load(); });
  $('#q').oninput = debounce(e => { st.q = e.target.value; st.page = 1; load(); }, 300); $('#up').onchange = e => { st.unpaid = e.target.checked ? '1' : ''; st.page = 1; load(); };
  if (canBook) $('#add').onclick = () => bookingForm(ctx, { onDone: load });
  $('#csv').onclick = async () => { try { const r = await get('/b/rentals/bookings', { ...st, page: 1, limit: 200 }); downloadCSV('bookings.csv', [['Booking', 'Vehicle', 'Plate', 'Customer', 'Phone', 'Pickup', 'Return', 'Days', 'Status', 'Total', 'Paid', 'Balance'], ...r.rows.map(b => [b.booking_no, `${b.make} ${b.model}`, b.plate, b.customer_name, b.customer_phone, b.pickup_date, b.return_date, b.days, b.status, b.total, b.paid, b.balance])]); } catch (e) { fail(e); } };
  ['booking.changed'].forEach(e => ctx.on(e, debounce(load, 500))); await load();
}
