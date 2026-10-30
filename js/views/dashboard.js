import { get } from '../api.js';
import { esc, money, num, compact, greeting, delta, fmtTime, ago, shortDay, payLabel, thumb, chartTheme, PALETTE, empty, pill, skeleton } from '../ui.js';

let charts = [];
const kill = () => { charts.forEach(c => c.destroy()); charts = []; };

export async function render(el, ctx) {
  const g = greeting(ctx.profile.name);
  el.innerHTML = `<div class="hero"><div class="d-flex flex-wrap justify-content-between align-items-center gap-3"><div><h1>${esc(g.title)}</h1><p>${esc(g.sub)}</p></div>
    <div class="d-flex gap-2 flex-wrap">${ctx.can('sales.create') ? '<a class="btn btn-fb" href="#/pos"><i class="bi bi-bag-plus me-1"></i>New sale</a>' : ''}${ctx.can('products.manage') ? '<a class="btn btn-soft" href="#/products"><i class="bi bi-box-seam me-1"></i>Products</a>' : ''}</div></div></div>
    <div id="dash">${skeleton(6, 70)}</div>`;
  ctx.cleanup = kill;
  const load = async () => { try { draw(el.querySelector('#dash'), await get('/b/dashboard'), ctx); } catch (e) { el.querySelector('#dash').innerHTML = empty('bi-exclamation-triangle', 'Could not load dashboard', e.message); } };
  await load();
  let t; const soon = () => { clearTimeout(t); t = setTimeout(load, 600); };
  ['sale.new', 'sale.voided', 'product.changed', 'order.new', 'order.updated', 'expense.new', 'visible', 'theme'].forEach(e => ctx.on(e, soon));
  const iv = setInterval(load, 60000); const prev = ctx.cleanup; ctx.cleanup = () => { clearInterval(iv); clearTimeout(t); prev(); };
}

function kpi(ico, lbl, val, sub, color, extra = '') { return `<div class="col-6 col-xl-3"><div class="kpi" style="--c:${color || 'var(--primary)'}"><div class="ico"><i class="bi ${ico}"></i></div><div class="lbl">${lbl}</div><div class="val">${val}</div><div class="sub">${sub} ${extra}</div></div></div>`; }

function draw(box, d, ctx) {
  kill(); const k = d.kpi; const own = d.scope === 'own';
  const net = d.expenses ? k.month.profit - d.expenses.month : null;
  box.innerHTML = `${own ? '<div class="alert-fb ok mb-3"><i class="bi bi-person-check"></i><span>You are viewing <b>your own</b> sales. Whole-shop numbers are visible to the Super Admin.</span></div>' : ''}
  <div class="row g-3 mb-3">
    ${kpi('bi-cash-stack', 'Sales today', money(k.today.revenue), `${num(k.today.sales)} sales · ${num(k.today.units)} items`, 'var(--primary)', delta(k.today.revenue, k.yesterday.revenue))}
    ${kpi('bi-calendar-week', 'Last 7 days', money(k.week.revenue), `${num(k.week.sales)} sales`, 'var(--info)')}
    ${kpi('bi-calendar3', 'This month', money(k.month.revenue), `${num(k.month.sales)} sales`, 'var(--success)', delta(k.month.revenue, k.prev_month.revenue))}
    ${d.see_cost ? kpi('bi-graph-up-arrow', own ? 'Profit this month' : 'Gross profit (month)', money(k.month.profit), net !== null ? `Net after expenses: <b>${money(net)}</b>` : `Today: ${money(k.today.profit)}`, '#b07cff') : kpi('bi-percent', 'Discounts (month)', money(k.month.discounts), 'Given to customers', '#b07cff')}
  </div>
  ${!own ? `<div class="row g-3 mb-3">
    ${kpi('bi-box-seam', 'Stock on hand', num(d.inventory.units) + ' units', `${num(d.inventory.products)} products`, 'var(--info)')}
    ${d.see_cost ? kpi('bi-safe2', 'Stock value (cost)', money(d.inventory.cost_value), `Retail value ${money(d.inventory.retail_value)}`, 'var(--success)') : kpi('bi-tag', 'Stock retail value', money(d.inventory.retail_value), 'If all sold at list price', 'var(--success)')}
    ${kpi('bi-exclamation-triangle', 'Needs restock', `${num(+d.inventory.low + +d.inventory.out_of_stock)}`, `${num(d.inventory.low)} low · ${num(d.inventory.out_of_stock)} out`, 'var(--warning)')}
    ${d.orders ? kpi('bi-globe2', 'Website orders', `${num(d.orders.open_orders)} open`, `${num(d.orders.new_orders)} new · worth ${money(d.orders.open_value)}`, '#4fd1c5') : kpi('bi-globe2', 'Published online', num(d.inventory.published), 'Products on website', '#4fd1c5')}
  </div>` : ''}
  ${d.flags && (d.flags.voids_30d > 0 || d.flags.discounted_30d > 0) ? `<div class="alert-fb mb-3"><i class="bi bi-shield-exclamation fs-5"></i><div><b>Watchlist (30 days):</b> ${num(d.flags.voids_30d)} voided sale(s) worth ${money(d.flags.voided_value_30d)}, ${num(d.flags.discounted_30d)} discounted sale(s). <a href="#/reports">Review in reports</a> · <a href="#/audit">audit trail</a></div></div>` : ''}
  <div class="row g-3 mb-3">
    <div class="col-lg-8"><div class="fb-card"><div class="d-flex justify-content-between flex-wrap"><div><h3>Revenue trend</h3><div class="card-sub">Last 30 days${d.see_cost ? ' · revenue vs profit' : ''}</div></div></div><div class="chart-box"><canvas id="cTrend"></canvas></div></div></div>
    <div class="col-lg-4"><div class="fb-card h-100"><h3>Payment methods</h3><div class="card-sub">Share of revenue, 30 days</div><div class="chart-box sm"><canvas id="cPay"></canvas></div></div></div>
  </div>
  <div class="row g-3 mb-3">
    <div class="col-lg-4"><div class="fb-card h-100"><h3>Top products</h3><div class="card-sub">By revenue, 30 days</div>${d.top_products.length ? d.top_products.map((p, i) => { const mx = d.top_products[0].revenue || 1; return `<div class="mb-3"><div class="d-flex justify-content-between small"><span class="fw-semibold">${i + 1}. ${esc(p.name)}</span><span>${money(p.revenue)}</span></div><div class="progress-thin mt-1"><div style="width:${p.revenue / mx * 100}%"></div></div><div class="small muted">${num(p.units)} sold</div></div>`; }).join('') : empty('bi-bar-chart', 'No sales yet', 'Top sellers appear after the first sale.')}</div></div>
    <div class="col-lg-4"><div class="fb-card h-100"><h3>By category</h3><div class="card-sub">Revenue split, 30 days</div><div class="chart-box sm"><canvas id="cCat"></canvas></div></div></div>
    <div class="col-lg-4"><div class="fb-card h-100"><h3>Busiest hours</h3><div class="card-sub">When customers buy (East Africa Time)</div><div class="heat mb-2" id="heat"></div><div class="d-flex justify-content-between small muted"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span></div><div id="peak" class="mt-3 small"></div></div></div>
  </div>
  <div class="row g-3">
    <div class="col-lg-${own ? 12 : 5}"><div class="fb-card h-100"><div class="d-flex justify-content-between"><div><h3>Live sales feed</h3><div class="card-sub">Newest first · updates in real time</div></div>${ctx.can('sales.create') || ctx.can('sales.view_all') ? '<a href="#/sales" class="small">View all</a>' : ''}</div>
      ${d.recent.length ? d.recent.map(s => `<div class="feed-item"><div class="avatar"><i class="bi bi-receipt"></i></div><div class="flex-grow-1"><div class="fw-semibold">${esc(s.receipt_no)} ${s.status === 'voided' ? pill('Voided', 'danger') : ''} ${s.source === 'website' ? pill('Website', 'info') : ''}</div><div class="small muted">${esc(s.seller)} · ${payLabel(s.payment_method)} · ${ago(s.sold_at)}</div></div><div class="fw-bold ${s.status === 'voided' ? 'text-decoration-line-through muted' : ''}">${money(s.total)}</div></div>`).join('') : empty('bi-receipt', 'No sales yet')}</div></div>
    ${!own ? `<div class="col-lg-4"><div class="fb-card h-100"><h3>Shopkeeper performance</h3><div class="card-sub">Last 30 days — who is selling what</div>${d.sellers.length ? d.sellers.map(s => `<div class="feed-item"><span class="avatar">${esc(s.name.split(' ').map(w => w[0]).slice(0, 2).join(''))}</span><div class="flex-grow-1"><div class="fw-semibold">${esc(s.name)}</div><div class="small muted">${num(s.sales)} sales${s.voids ? ` · <span class="text-warning">${s.voids} void(s)</span>` : ''}${s.discounts ? ` · ${money(s.discounts)} discounts` : ''}</div></div><div class="fw-bold">${money(s.revenue)}</div></div>`).join('') : empty('bi-people', 'No activity yet')}</div></div>
    <div class="col-lg-3"><div class="fb-card h-100"><h3>Low stock alerts</h3><div class="card-sub">Restock soon</div>${d.low_stock.length ? d.low_stock.map(p => `<div class="feed-item">${thumb(p.image_url, p.name)}<div class="flex-grow-1"><div class="fw-semibold small">${esc(p.name)}</div><div class="small muted">${esc(p.sku)}</div></div>${p.stock_qty <= 0 ? pill('Out', 'danger') : pill(p.stock_qty + ' left', 'warning')}</div>`).join('') : empty('bi-check2-circle', 'All stocked up', 'Nothing is running low.')}</div></div>` : ''}
  </div>`;
  charts_(d); heat(d);
}

function heat(d) {
  const mx = Math.max(1, ...d.hourly.map(h => h.sales)); const h = document.getElementById('heat'); if (!h) return;
  h.innerHTML = d.hourly.map(x => `<div style="--i:${(x.sales / mx).toFixed(2)}" title="${x.hour}:00 — ${x.sales} sales"></div>`).join('');
  const best = d.hourly.reduce((a, b) => b.sales > a.sales ? b : a, d.hourly[0]);
  document.getElementById('peak').innerHTML = best.sales ? `🔥 Peak hour: <b>${(best.hour % 12) || 12}:00 ${best.hour < 12 ? 'AM' : 'PM'}</b> (${best.sales} sales)` : 'Not enough data yet.';
}

function charts_(d) {
  const t = chartTheme(); Chart.defaults.color = t.text; Chart.defaults.font.family = 'Inter, sans-serif';
  const grid = { color: t.grid, drawBorder: false };
  const ctxT = document.getElementById('cTrend'); if (!ctxT) return;
  const g = ctxT.getContext('2d').createLinearGradient(0, 0, 0, 290); g.addColorStop(0, t.primary + '66'); g.addColorStop(1, t.primary + '00');
  const ds = [{ label: 'Revenue', data: d.daily.map(x => x.revenue), borderColor: t.primary, backgroundColor: g, fill: true, tension: .38, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2.5 }];
  if (d.see_cost) ds.push({ label: 'Profit', data: d.daily.map(x => x.profit), borderColor: '#2fd18b', tension: .38, pointRadius: 0, borderWidth: 2, borderDash: [5, 4] });
  charts.push(new Chart(ctxT, { type: 'line', data: { labels: d.daily.map(x => shortDay(x.date)), datasets: ds }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: d.see_cost, labels: { usePointStyle: true } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${money(c.raw)}` } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: { grid, ticks: { callback: v => compact(v) }, beginAtZero: true } } } }));
  const donut = (id, rows, label) => { const c = document.getElementById(id); if (!c) return; if (!rows.length) { c.parentElement.innerHTML = empty('bi-pie-chart', 'No data yet'); return; }
    charts.push(new Chart(c, { type: 'doughnut', data: { labels: rows.map(label), datasets: [{ data: rows.map(r => r.revenue), backgroundColor: PALETTE, borderColor: t.surface, borderWidth: 3 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '66%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 12 } }, tooltip: { callbacks: { label: c => `${c.label}: ${money(c.raw)}` } } } } })); };
  donut('cPay', d.by_payment, r => payLabel(r.name)); donut('cCat', d.by_category, r => r.name);
}
