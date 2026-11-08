import { get } from '../api.js';
import { esc, money, num, greeting, shortDay, chartTheme, PALETTE, empty, pill, skeleton } from '../ui.js';
import { kpi, time12, bar } from './_kit.js';

let chart = null;
export async function render(el, ctx) {
  const g = greeting(ctx.profile.name);
  el.innerHTML = `<div class="hero"><div class="d-flex flex-wrap justify-content-between align-items-center gap-3"><div><h1>${esc(g.title)}</h1><p>${esc(g.sub)}</p></div>
    <div class="d-flex gap-2 flex-wrap">${ctx.can('appointments.manage') ? '<a class="btn btn-fb" href="#/appointments"><i class="bi bi-person-plus me-1"></i>Walk-in / appointment</a>' : ''}${ctx.can('sales.create') ? '<a class="btn btn-soft" href="#/pos"><i class="bi bi-bag-plus me-1"></i>Sell a product</a>' : ''}</div></div></div><div id="d">${skeleton(5, 70)}</div>`;
  const load = async () => { try { draw(el.querySelector('#d'), await get('/b/barber/dashboard'), ctx); } catch (e) { el.querySelector('#d').innerHTML = empty('bi-exclamation-triangle', 'Could not load the dashboard', e.message); } };
  await load(); let t; const soon = () => { clearTimeout(t); t = setTimeout(load, 600); };
  ['sale.new', 'sale.voided', 'appointment.changed', 'expense.new', 'product.changed', 'visible'].forEach(e => ctx.on(e, soon));
  const iv = setInterval(load, 60000); ctx.cleanup = () => { clearInterval(iv); clearTimeout(t); if (chart) { chart.destroy(); chart = null; } };
}

function draw(box, d, ctx) {
  if (chart) { chart.destroy(); chart = null; }
  const k = d.kpi; const q = d.queue;
  box.innerHTML = `${d.unpriced ? `<div class="alert-fb warn mb-3"><i class="bi bi-tag"></i><span><b>${d.unpriced}</b> service${d.unpriced > 1 ? 's have' : ' has'} no price yet. <a href="#/services">Set the prices</a> so visits can be completed.</span></div>` : ''}
  <div class="row g-3 mb-3">
    ${k ? kpi('bi-cash-stack', "Today's sales", money(k.sales_today), `${num(k.customers_today)} customer${k.customers_today === 1 ? '' : 's'} served`, 'var(--primary)') : ''}
    ${k ? kpi('bi-people-fill', "Today's customers", num(k.customers_today), `${num(q.waiting)} waiting · ${num(q.in_service)} in the chair`, 'var(--info)') : kpi('bi-people-fill', 'Waiting now', num(q.waiting), `${num(q.in_service)} in the chair`, 'var(--info)')}
    ${k ? kpi('bi-wallet2', "Today's expenses", money(k.expenses_today), `Commissions today: ${money(k.commission_today)}`, 'var(--danger)') : ''}
    ${k ? kpi('bi-graph-up-arrow', 'Daily profit estimate', money(k.profit_today), 'Sales − expenses − commissions', k.profit_today >= 0 ? 'var(--success)' : 'var(--danger)') : ''}
    ${k ? kpi('bi-calendar3', 'Monthly revenue', money(k.revenue_month), `Profit est. ${money(k.profit_month)}`, 'var(--success)') : ''}
    ${k ? kpi('bi-receipt-cutoff', 'Monthly expenses', money(k.expenses_month), `Commissions ${money(d.kpi.commission_today)} today`, '#b07cff') : ''}
    ${k ? kpi('bi-scissors', 'Most popular service', k.popular ? esc(k.popular.name) : '—', k.popular ? `${num(k.popular.times)} times · ${money(k.popular.revenue)}` : 'No services completed yet', 'var(--primary)') : ''}
    ${kpi('bi-calendar2-check', 'Today at a glance', `${num(q.completed)} done`, `${num(q.booked)} booked · ${num(q.cancelled)} cancelled · ${num(q.missed)} missed`, 'var(--info)')}
  </div>
  <div class="row g-3">
    <div class="col-lg-7">${k ? `<div class="fb-card mb-3"><h3>Sales vs expenses</h3><div class="card-sub">Last 14 days</div><div style="height:240px"><canvas id="cs"></canvas></div></div>` : ''}
      ${d.barbers_today && d.barbers_today.length ? `<div class="fb-card mb-3"><h3>Barbers today</h3><div class="card-sub">Services, revenue and commission earned</div>${d.barbers_today.map(b => `<div class="feed-item"><span class="avatar"><i class="bi bi-person"></i></span><div class="flex-grow-1"><div class="fw-semibold">${esc(b.name)}</div><div class="small muted">${num(b.services)} service${b.services == 1 ? '' : 's'} · ${money(b.revenue)}</div></div><b>${money(b.commission)}</b></div>`).join('')}</div>` : ''}</div>
    <div class="col-lg-5"><div class="fb-card mb-3"><div class="d-flex justify-content-between"><h3>Queue now</h3><a href="#/appointments" class="small">Open</a></div><div class="card-sub">Waiting, in the chair and booked for today</div>
      ${d.next.length ? d.next.map(a => `<div class="feed-item"><span class="avatar">${a.queue_no ? '#' + a.queue_no : '<i class="bi bi-clock"></i>'}</span><div class="flex-grow-1"><div class="fw-semibold">${esc(a.customer_name)} ${a.status === 'in_service' ? pill('In the chair', 'success') : a.status === 'waiting' ? pill('Waiting', 'warning') : pill('Booked ' + time12(a.appt_time), 'info')}</div><div class="small muted">${esc(a.service_name)}${a.barber_name ? ' · ' + esc(a.barber_name) : ''}</div></div></div>`).join('') : empty('bi-emoji-smile', 'Nobody in the queue', 'Walk-ins and today’s appointments appear here.')}</div>
      <div class="fb-card"><h3>Low supplies</h3><div class="card-sub">Restock before they run out</div>${d.low_stock.length ? d.low_stock.map(p => `<div class="feed-item"><div class="flex-grow-1"><div class="fw-semibold">${esc(p.name)}</div>${bar(p.low_stock_at ? p.stock_qty / p.low_stock_at * 100 : 0, 'var(--danger)')}</div>${pill(p.stock_qty + ' left', p.stock_qty <= 0 ? 'danger' : 'warning')}</div>`).join('') : empty('bi-check2-circle', 'Stock looks fine')}</div></div></div>`;
  const c = box.querySelector('#cs'); if (c && window.Chart) { const th = chartTheme(); chart = new Chart(c, { type: 'bar', data: { labels: d.series.map(s => shortDay(s.d)), datasets: [{ label: 'Sales', data: d.series.map(s => s.revenue), backgroundColor: PALETTE[0], borderRadius: 4 }, { label: 'Expenses', data: d.series.map(s => s.expenses), backgroundColor: PALETTE[3], borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: th.text } } }, scales: { x: { ticks: { color: th.text }, grid: { display: false } }, y: { ticks: { color: th.text }, grid: { color: th.grid } } } } }); }
}
