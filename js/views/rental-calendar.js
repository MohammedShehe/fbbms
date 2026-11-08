import { get } from '../api.js';
import { esc, money, fmtDate, todayEAT, addDays, empty, skeleton, pill, fail } from '../ui.js';
import { time12, hhmm } from './_kit.js';
import { bookingForm, bookingDetail, vehName, VS, BK } from './_rental.js';

const COLOR = { pending: '#56a8ff', confirmed: '#d4af55', ongoing: '#ff9f43', completed: '#2fd18b' };
const dow = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
const monthStartOf = d => d.slice(0, 8) + '01';
const monthDays = d => { const t = new Date(d + 'T00:00:00Z'); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); };

export async function render(el, ctx) {
  const canBook = ctx.can('bookings.manage'); const st = { view: 'month', anchor: todayEAT() }; let data = null;
  el.innerHTML = `<div class="page-head"><div><h1>Rental calendar</h1><p>See which vehicles are free, booked, out on rental or due back.</p></div>${canBook ? '<button class="btn btn-fb" id="add"><i class="bi bi-plus-lg me-1"></i>New booking</button>' : ''}</div>
  <div class="filters"><div class="btn-group"><button class="btn btn-soft" id="pv"><i class="bi bi-chevron-left"></i></button><button class="btn btn-soft" id="td">Today</button><button class="btn btn-soft" id="nx"><i class="bi bi-chevron-right"></i></button></div><b id="ttl" class="px-2"></b>
    <div class="btn-group ms-auto">${[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([k, l]) => `<button class="btn btn-soft ${k === st.view ? 'active' : ''}" data-v="${k}">${l}</button>`).join('')}</div></div>
  <div class="d-flex gap-3 flex-wrap small mb-2">${Object.entries(COLOR).map(([k, c]) => `<span><i class="bi bi-square-fill me-1" style="color:${c}"></i>${BK[k][0]}</span>`).join('')}<span><i class="bi bi-square me-1 muted"></i>Free</span></div>
  <div id="cal">${skeleton(5, 40)}</div><div class="row g-3 mt-1" id="side"></div>`;
  const $ = s => el.querySelector(s);
  const range = () => { const a = st.anchor; if (st.view === 'day') return [a, a]; if (st.view === 'week') { const t = new Date(a + 'T00:00:00Z'); const off = (t.getUTCDay() + 6) % 7; const s = addDays(a, -off); return [s, addDays(s, 6)]; } const s = monthStartOf(a); return [s, addDays(s, monthDays(a) - 1)]; };
  const load = async () => {
    const [from, to] = range();
    $('#ttl').textContent = st.view === 'day' ? fmtDate(from) : st.view === 'week' ? `${fmtDate(from)} – ${fmtDate(to)}` : new Date(from + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    try { data = await get('/b/rentals/calendar', { from, to }); draw(from, to); side(); } catch (e) { $('#cal').innerHTML = empty('bi-exclamation-triangle', 'Could not load', e.message); }
  };
  const cover = (b, d) => b.pickup_date <= d && b.return_date >= d && b.status !== 'cancelled';
  const draw = (from, to) => {
    const days = []; for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
    if (!data.vehicles.length) { $('#cal').innerHTML = empty('bi-car-front', 'No vehicles yet', 'Add vehicles to see the calendar.'); return; }
    if (st.view === 'day') {
      const d = from; $('#cal').innerHTML = `<div class="row g-3">${data.vehicles.map(v => { const bs = data.bookings.filter(b => b.vehicle_id === v.id && cover(b, d)); const free = !bs.length && v.status !== 'maintenance';
        return `<div class="col-md-6 col-xl-4"><div class="fb-card h-100"><div class="d-flex justify-content-between"><div><b>${esc(vehName(v))}</b><div class="small muted">${esc(v.plate)} · ${money(v.daily_rate)}/day</div></div>${v.status === 'maintenance' ? pill('Maintenance', 'danger') : free ? pill('Available', 'success') : pill('Booked', 'warning')}</div>
        ${bs.map(b => `<div class="mt-2 p-2 rounded" style="border-left:4px solid ${COLOR[b.status]};background:rgba(128,128,128,.08);cursor:pointer" data-b="${b.id}"><div class="fw-semibold small">${esc(b.customer_name)} · ${esc(b.booking_no)}</div><div class="small muted">${fmtDate(b.pickup_date)} ${time12(b.pickup_time)} → ${fmtDate(b.return_date)} ${time12(b.return_time)}</div></div>`).join('')}${free && canBook ? `<button class="btn btn-sm btn-soft mt-2" data-n="${v.id}"><i class="bi bi-plus me-1"></i>Book this day</button>` : ''}</div></div>`; }).join('')}</div>`;
    } else {
      const w = st.view === 'month' ? 34 : 70;
      $('#cal').innerHTML = `<div class="tbl-wrap" style="overflow-x:auto"><table class="fb-table" style="min-width:${days.length * w + 180}px"><thead><tr><th style="position:sticky;left:0;background:var(--surface);z-index:2;min-width:170px">Vehicle</th>${days.map(d => `<th class="text-center ${d === data.today ? 'text-warning' : ''}" style="min-width:${w}px;padding:6px 2px"><div class="small">${dow(d)}</div><div>${Number(d.slice(8))}</div></th>`).join('')}</tr></thead><tbody>
        ${data.vehicles.map(v => `<tr><td style="position:sticky;left:0;background:var(--surface);z-index:1"><b class="small">${esc(vehName(v))}</b><br><small class="muted">${esc(v.plate)}</small>${v.status === 'maintenance' ? ' <i class="bi bi-wrench text-danger"></i>' : ''}</td>${days.map(d => { const b = data.bookings.find(x => x.vehicle_id === v.id && cover(x, d)); return b ? `<td class="p-0" data-b="${b.id}" title="${esc(b.customer_name)} · ${esc(b.booking_no)}" style="cursor:pointer;background:${COLOR[b.status]};opacity:${b.status === 'completed' ? .55 : 1};border-left:${b.pickup_date === d ? '3px solid rgba(0,0,0,.35)' : '0'}"><div class="small text-center text-dark fw-semibold" style="overflow:hidden;white-space:nowrap;font-size:.68rem">${b.pickup_date === d || d === from ? esc(b.customer_name.split(' ')[0]) : '&nbsp;'}</div></td>` : `<td class="p-0 text-center" ${canBook && v.status !== 'maintenance' ? `data-n="${v.id}" data-d="${d}" style="cursor:pointer"` : ''}>${v.status === 'maintenance' && d >= data.today ? '<i class="bi bi-wrench small muted"></i>' : '<span class="muted" style="opacity:.25">·</span>'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    $('#cal').querySelectorAll('[data-b]').forEach(c => c.onclick = () => bookingDetail(ctx, Number(c.dataset.b), load));
    $('#cal').querySelectorAll('[data-n]').forEach(c => c.onclick = () => bookingForm(ctx, { vehicleId: Number(c.dataset.n), date: c.dataset.d || st.anchor, onDone: load }));
  };
  const side = () => {
    const row = b => `<div class="feed-item" style="cursor:pointer" data-b="${b.id}"><div class="flex-grow-1"><div class="fw-semibold small">${esc(b.make)} ${esc(b.model)} · ${esc(b.plate)}</div><div class="small muted">${esc(b.customer_name)} · ${fmtDate(b.return_date)} ${time12(b.return_time)}</div></div>${b.overdue ? pill('Overdue', 'danger') : pill(BK[b.status][0], BK[b.status][1])}</div>`;
    $('#side').innerHTML = `<div class="col-lg-4"><div class="fb-card h-100"><h3>Upcoming returns</h3><div class="card-sub">Next 7 days</div>${data.upcoming_returns.length ? data.upcoming_returns.map(row).join('') : empty('bi-check2-circle', 'No returns due')}</div></div>
      <div class="col-lg-4"><div class="fb-card h-100"><h3>Overdue returns</h3><div class="card-sub">Should already be back</div>${data.overdue_returns.length ? data.overdue_returns.map(row).join('') : empty('bi-emoji-smile', 'Nothing overdue')}</div></div>
      <div class="col-lg-4"><div class="fb-card h-100"><h3>Vehicle reminders</h3><div class="card-sub">Servicing, insurance, road tax</div>${data.reminders.length ? data.reminders.slice(0, 6).map(r => `<div class="feed-item"><div class="flex-grow-1"><div class="fw-semibold small">${esc(r.vehicle)} · ${esc(r.plate)}</div><div class="small muted">${esc(r.label)}${r.due ? ' · ' + fmtDate(r.due) : r.due_text ? ' · ' + esc(r.due_text) : ''}</div></div>${r.overdue ? pill('Overdue', 'danger') : pill(r.days_left !== null ? r.days_left + ' d' : 'Soon', 'warning')}</div>`).join('') : empty('bi-check2-circle', 'All up to date')}</div></div>`;
    $('#side').querySelectorAll('[data-b]').forEach(c => c.onclick = () => bookingDetail(ctx, Number(c.dataset.b), load));
  };
  const step = dir => { st.anchor = st.view === 'day' ? addDays(st.anchor, dir) : st.view === 'week' ? addDays(st.anchor, 7 * dir) : addDays(monthStartOf(st.anchor), dir > 0 ? monthDays(st.anchor) : -1); load(); };
  $('#pv').onclick = () => step(-1); $('#nx').onclick = () => step(1); $('#td').onclick = () => { st.anchor = todayEAT(); load(); };
  el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { st.view = b.dataset.v; el.querySelectorAll('[data-v]').forEach(x => x.classList.toggle('active', x === b)); load(); });
  if (canBook) $('#add').onclick = () => bookingForm(ctx, { onDone: load });
  ['booking.changed', 'vehicle.changed'].forEach(e => ctx.on(e, () => load())); await load();
}
