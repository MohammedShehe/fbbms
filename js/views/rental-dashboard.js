import { get } from '../api.js';
import { esc, money, num, greeting, fmtDate, shortDay, chartTheme, PALETTE, empty, pill, skeleton } from '../ui.js';
import { kpi, time12 } from './_kit.js';
import { bookingForm, bookingDetail, statusPill } from './_rental.js';

let chart = null;
export async function render(el, ctx) {
  const g = greeting(ctx.profile.name);
  el.innerHTML = `<div class="hero"><div class="d-flex flex-wrap justify-content-between align-items-center gap-3"><div><h1>${esc(g.title)}</h1><p>${esc(g.sub)}</p></div><div class="d-flex gap-2 flex-wrap">${ctx.can('bookings.manage') ? '<button class="btn btn-fb" id="nb"><i class="bi bi-plus-lg me-1"></i>New booking</button>' : ''}<a class="btn btn-soft" href="#/rental-calendar"><i class="bi bi-calendar3 me-1"></i>Calendar</a></div></div></div><div id="d">${skeleton(5, 70)}</div>`;
  const load = async () => { try { draw(el.querySelector('#d'), await get('/b/rentals/dashboard')); } catch (e) { el.querySelector('#d').innerHTML = empty('bi-exclamation-triangle', 'Could not load the dashboard', e.message); } };
  const nb = el.querySelector('#nb'); if (nb) nb.onclick = () => bookingForm(ctx, { onDone: load });
  await load(); let t; const soon = () => { clearTimeout(t); t = setTimeout(load, 600); };
  ['booking.changed', 'vehicle.changed', 'sale.new', 'expense.new', 'visible'].forEach(e => ctx.on(e, soon));
  const iv = setInterval(load, 60000); ctx.cleanup = () => { clearInterval(iv); clearTimeout(t); if (chart) { chart.destroy(); chart = null; } };

  function draw(box, d) {
    if (chart) { chart.destroy(); chart = null; } const f = d.fleet; const k = d.kpi;
    const bk = b => `<div class="feed-item" style="cursor:pointer" data-b="${b.id}"><div class="flex-grow-1"><div class="fw-semibold small">${esc(b.make)} ${esc(b.model)} · ${esc(b.plate)}</div><div class="small muted">${esc(b.customer_name)}</div></div><div class="text-end small"><div>${fmtDate(b.pickup_date)} ${time12(b.pickup_time)}</div>${statusPill(b)}</div></div>`;
    const rt = b => `<div class="feed-item" style="cursor:pointer" data-b="${b.id}"><div class="flex-grow-1"><div class="fw-semibold small">${esc(b.make)} ${esc(b.model)} · ${esc(b.plate)}</div><div class="small muted">${esc(b.customer_name)}${b.balance > 0 ? ' · owes ' + money(b.balance) : ''}</div></div><div class="text-end small"><div>${fmtDate(b.return_date)} ${time12(b.return_time)}</div>${b.overdue ? pill('Overdue', 'danger') : ''}</div></div>`;
    box.innerHTML = `<div class="row g-3 mb-3">
      ${kpi('bi-car-front-fill', 'Total vehicles', num(f.total), 'In your fleet', 'var(--primary)')}${kpi('bi-check2-circle', 'Available vehicles', num(f.available), 'Ready to rent', 'var(--success)')}${kpi('bi-key-fill', 'Rented vehicles', num(f.rented), 'Out with customers', 'var(--warning)')}${kpi('bi-wrench-adjustable', 'Under maintenance', num(f.maintenance), `${d.reminders_count} reminder${d.reminders_count === 1 ? '' : 's'}`, 'var(--danger)')}
      ${kpi('bi-calendar-event', 'Upcoming bookings', num(d.upcoming_count), `${d.pickups_today.length} pickup${d.pickups_today.length === 1 ? '' : 's'} today`, 'var(--info)')}
      ${k ? kpi('bi-cash-stack', 'Monthly rental revenue', money(k.revenue_month), `${num(k.bookings_month)} booking(s) · collected ${money(k.collected_month)}`, 'var(--success)') : ''}${k ? kpi('bi-hourglass-split', 'Outstanding payments', money(k.outstanding), `${num(k.outstanding_count)} booking(s)`, k.outstanding > 0 ? 'var(--danger)' : 'var(--success)') : ''}${k ? kpi('bi-tools', 'Maintenance this month', money(k.maintenance_month), '', '#b07cff') : ''}</div>
    <div class="row g-3"><div class="col-lg-7">${k ? '<div class="fb-card mb-3"><h3>Rental revenue</h3><div class="card-sub">Last 14 days</div><div style="height:220px"><canvas id="cr"></canvas></div></div>' : ''}
      <div class="fb-card mb-3"><div class="d-flex justify-content-between"><h3>Upcoming bookings</h3><a href="#/bookings" class="small">All bookings</a></div><div class="card-sub">Next pickups</div>${d.upcoming.length ? d.upcoming.map(bk).join('') : empty('bi-calendar-x', 'No upcoming bookings')}</div></div>
      <div class="col-lg-5"><div class="fb-card mb-3"><h3>Vehicles out · returns due</h3><div class="card-sub">Earliest return first</div>${d.returns.length ? d.returns.map(rt).join('') : empty('bi-car-front', 'No vehicles are out right now')}</div>
      <div class="fb-card"><div class="d-flex justify-content-between"><h3>Reminders</h3><a href="#/maintenance" class="small">Maintenance</a></div><div class="card-sub">Servicing, insurance and road tax</div>${d.reminders.length ? d.reminders.map(r => `<div class="feed-item"><div class="flex-grow-1"><div class="fw-semibold small">${esc(r.vehicle)} · ${esc(r.plate)}</div><div class="small muted">${esc(r.label)}${r.due ? ' · ' + fmtDate(r.due) : r.due_text ? ' · ' + esc(r.due_text) : ''}</div></div>${r.overdue ? pill('Overdue', 'danger') : pill(r.days_left !== null ? r.days_left + ' d' : 'Soon', 'warning')}</div>`).join('') : empty('bi-check2-circle', 'All up to date')}</div></div></div>`;
    box.querySelectorAll('[data-b]').forEach(c => c.onclick = () => bookingDetail(ctx, Number(c.dataset.b), load));
    const c = box.querySelector('#cr'); if (c && window.Chart && d.series) { const th = chartTheme(); chart = new Chart(c, { type: 'bar', data: { labels: d.series.map(s => shortDay(s.d)), datasets: [{ label: 'Revenue', data: d.series.map(s => s.revenue), backgroundColor: PALETTE[1], borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: th.text }, grid: { display: false } }, y: { ticks: { color: th.text }, grid: { color: th.grid } } } } }); }
  }
}
