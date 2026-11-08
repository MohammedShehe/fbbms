import { get } from '../api.js';
import { esc, money, num, fmtDate, todayEAT, empty, skeleton, pill, chartTheme, PALETTE } from '../ui.js';
import { rangeBar, monthStart, kpi, bar } from './_kit.js';
import { statusPill } from './_rental.js';
import { exportButtons } from '../export.js';

const TABS = [['summary', 'Summary'], ['vehicle', 'Rental history by vehicle'], ['outstanding', 'Outstanding payments'], ['maintenance', 'Maintenance expenses']];
let chart = null;

export async function render(el, ctx) {
  const st = { from: monthStart(), to: todayEAT(), tab: 'summary', vehicle: '' }; let d = null;
  el.innerHTML = `<div class="page-head"><div><h1>Rental reports</h1><p>Bookings, revenue, balances and costs — export to PDF or Excel.</p></div><div class="d-flex gap-2" id="act"></div></div><div class="filters" id="rb"></div><div class="d-flex gap-2 flex-wrap mb-3">${TABS.map(([k, l]) => `<button class="btn btn-soft ${k === st.tab ? 'active' : ''}" data-t="${k}">${l}</button>`).join('')}</div><div class="row g-3 mb-3" id="k"></div><div id="v">${skeleton(4, 50)}</div>`;
  const $ = s => el.querySelector(s); rangeBar($('#rb'), st, () => load());
  const tbl = (cols, rows) => `<div class="tbl-wrap"><table class="fb-table"><thead><tr>${cols.map((c, i) => `<th class="${i > 1 ? 'num' : ''}">${c}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr>${r.map((c, i) => `<td class="${i > 1 ? 'num' : ''}">${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="muted text-center">No data in this period</td></tr>`}</tbody></table></div>`;
  const view = () => {
    if (chart) { chart.destroy(); chart = null; } const t = st.tab; let plain, cols;
    if (t === 'summary') {
      const b = d.bookings; $('#v').innerHTML = `<div class="row g-3"><div class="col-lg-6"><div class="fb-card h-100"><h3>Bookings by status</h3><div class="card-sub">Pickups in this period</div>${[['Confirmed', b.confirmed, 'gold'], ['Out on rental', b.ongoing, 'warning'], ['Completed', b.completed, 'success'], ['Pending', b.pending, 'info'], ['Cancelled', b.cancelled, 'danger']].map(([l, n, k]) => `<div class="d-flex justify-content-between py-1"><span>${l}</span><b>${num(n)}</b></div>${bar(b.total ? n / b.total * 100 : 0, `var(--${k === 'gold' ? 'primary' : k === 'info' ? 'info' : k === 'success' ? 'success' : k === 'warning' ? 'warning' : 'danger'})`)}`).join('')}</div></div><div class="col-lg-6"><div class="fb-card h-100"><h3>Monthly rental revenue</h3><div class="card-sub">Last 12 months</div><div style="height:230px"><canvas id="cm"></canvas></div></div></div></div>`;
      const c = $('#cm'); if (c && window.Chart) { const th = chartTheme(); chart = new Chart(c, { type: 'bar', data: { labels: d.months.map(m => m.month), datasets: [{ label: 'Revenue', data: d.months.map(m => m.revenue), backgroundColor: PALETTE[0], borderRadius: 4 }, { label: 'Collected', data: d.months.map(m => m.collected), backgroundColor: PALETTE[2], borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: th.text } } }, scales: { x: { ticks: { color: th.text }, grid: { display: false } }, y: { ticks: { color: th.text }, grid: { color: th.grid } } } } }); }
      cols = ['Month', 'Bookings', 'Revenue', 'Collected']; plain = d.months.map(m => [m.month, m.bookings, m.revenue, m.collected]);
    } else if (t === 'vehicle') {
      cols = ['Vehicle', 'Plate', 'Bookings', 'Days rented', 'Utilisation', 'Revenue', 'Maintenance', 'Profit']; plain = d.by_vehicle.map(v => [`${v.make} ${v.model}`, v.plate, v.bookings, v.days_booked, v.utilisation_pct + '%', v.revenue, v.maintenance, v.profit]);
      $('#v').innerHTML = `<div class="fb-card mb-3"><div class="tbl-wrap"><table class="fb-table"><thead><tr><th>Vehicle</th><th>Plate</th><th class="num">Bookings</th><th class="num">Days</th><th class="num">Used</th><th class="num">Revenue</th><th class="num">Maintenance</th><th class="num">Profit</th></tr></thead><tbody>${d.by_vehicle.map(v => `<tr style="cursor:pointer" data-v="${v.id}"><td><b>${esc(v.make)} ${esc(v.model)}</b></td><td>${esc(v.plate)}</td><td class="num">${num(v.bookings)}</td><td class="num">${num(v.days_booked)}</td><td class="num">${v.utilisation_pct}%</td><td class="num">${money(v.revenue)}</td><td class="num">${money(v.maintenance)}</td><td class="num">${money(v.profit)}</td></tr>`).join('') || '<tr><td colspan="8" class="muted text-center">No vehicles</td></tr>'}</tbody></table></div><div class="small muted mt-2">Tap a vehicle to see its full rental history.</div></div>
        ${d.history.length ? `<div class="fb-card"><h3>Rental history</h3><div class="tbl-wrap"><table class="fb-table"><thead><tr><th>Booking</th><th>Customer</th><th>Dates</th><th>Status</th><th class="num">Total</th><th class="num">Paid</th></tr></thead><tbody>${d.history.map(b => `<tr><td>${esc(b.booking_no)}</td><td>${esc(b.customer_name)}</td><td>${fmtDate(b.pickup_date)} → ${fmtDate(b.return_date)}</td><td>${statusPill(b)}</td><td class="num">${money(b.total)}</td><td class="num">${money(b.paid)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
      $('#v').querySelectorAll('[data-v]').forEach(r => r.onclick = () => { st.vehicle = r.dataset.v; load(); });
    } else if (t === 'outstanding') {
      cols = ['Booking', 'Customer', 'Vehicle', 'Total', 'Paid', 'Balance']; plain = d.outstanding.map(b => [b.booking_no, b.customer_name, `${b.make} ${b.model} ${b.plate}`, b.total, b.paid, b.balance]);
      $('#v').innerHTML = `<div class="fb-card">${tbl(['Booking', 'Customer', 'Vehicle', 'Total', 'Paid', 'Balance'], d.outstanding.map(b => [esc(b.booking_no), esc(b.customer_name) + `<br><small class="muted">${esc(b.customer_phone)}</small>`, esc(`${b.make} ${b.model}`), money(b.total), money(b.paid), `<b style="color:var(--danger)">${money(b.balance)}</b>`]))}<div class="text-end fw-bold mt-2">Total outstanding: ${money(d.outstanding_total)}</div></div>`;
    } else {
      cols = ['Date', 'Vehicle', 'Type', 'Cost', 'Details']; plain = d.maintenance.rows.map(r => [r.service_date, `${r.make} ${r.model} ${r.plate}`, r.kind, r.cost, r.description || '']);
      $('#v').innerHTML = `<div class="fb-card">${tbl(['Date', 'Vehicle', 'Mileage', 'Cost', 'Details'], d.maintenance.rows.map(r => [fmtDate(r.service_date), esc(`${r.make} ${r.model} (${r.plate})`), r.mileage !== null ? num(r.mileage) : '—', money(r.cost), esc(`${r.kind}${r.description ? ' · ' + r.description : ''}`)]))}<div class="text-end fw-bold mt-2">Total: ${money(d.maintenance.total)}</div></div>`;
    }
    view.cur = { cols, plain };
  };
  const load = async () => {
    try {
      d = await get('/b/rentals/reports', { from: st.from, to: st.to, vehicle_id: st.vehicle || undefined }); const r = d.revenue;
      $('#k').innerHTML = [kpi('bi-journal-check', 'Total bookings', num(d.bookings.total), `${num(d.bookings.cancelled)} cancelled`), kpi('bi-cash-stack', 'Rental revenue', money(r.billed), 'Billed in this period', 'var(--success)'), kpi('bi-hourglass-split', 'Outstanding payments', money(d.outstanding_total), `${d.outstanding.length} booking(s), all time`, d.outstanding_total > 0 ? 'var(--danger)' : 'var(--success)'), kpi('bi-wrench', 'Maintenance expenses', money(d.maintenance.total), 'In this period', 'var(--info)')].join('');
      view();
    } catch (e) { $('#v').innerHTML = empty('bi-exclamation-triangle', 'Could not load', e.message); }
  };
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { st.tab = b.dataset.t; el.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('active', x === b)); if (d) view(); });
  exportButtons($('#act'), async () => { const l = TABS.find(x => x[0] === st.tab)[1]; return { filename: `rental_${st.tab}_${st.from}_${st.to}`, title: `${ctx.biz.short_name} – ${l}`, subtitle: `${st.from} to ${st.to} · ${ctx.biz.currency}`, columns: view.cur.cols, rows: view.cur.plain, landscape: view.cur.cols.length > 5, footer: 'Generated by FBBMS' }; });
  ctx.cleanup = () => { if (chart) { chart.destroy(); chart = null; } };
  await load();
}
