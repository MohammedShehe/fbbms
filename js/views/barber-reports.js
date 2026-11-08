import { get } from '../api.js';
import { esc, money, num, fmtDate, todayEAT, empty, skeleton, pill, PAY } from '../ui.js';
import { rangeBar, monthStart, kpi } from './_kit.js';
import { exportButtons } from '../export.js';

const TABS = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['service', 'By service'], ['barber', 'By barber'], ['visits', 'Customer visits'], ['inventory', 'Inventory'], ['expenses', 'Expenses'], ['pnl', 'Profit & loss']];
const weekKey = d => { const t = new Date(d + 'T00:00:00Z'); const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day); return t.toISOString().slice(0, 10); };
const group = (days, keyFn) => { const m = new Map(); days.forEach(r => { const k = keyFn(r.d); const o = m.get(k) || { k, sales: 0, services: 0, service_revenue: 0, product_revenue: 0, discounts: 0, revenue: 0, commission: 0, expenses: 0, profit: 0 }; ['sales', 'services', 'service_revenue', 'product_revenue', 'discounts', 'revenue', 'commission', 'expenses', 'profit'].forEach(f => { o[f] += Number(r[f] || 0); }); m.set(k, o); }); return [...m.values()].sort((a, b) => a.k < b.k ? -1 : 1); };

export async function render(el, ctx) {
  const st = { from: monthStart(), to: todayEAT(), tab: 'daily' }; let d = null;
  el.innerHTML = `<div class="page-head"><div><h1>Barber reports</h1><p>Sales, services, customers, stock, expenses and profit — export to PDF or Excel.</p></div><div class="d-flex gap-2" id="act"></div></div><div class="filters" id="rb"></div><div class="d-flex gap-2 flex-wrap mb-3" id="tabs">${TABS.map(([k, l]) => `<button class="btn btn-soft ${k === st.tab ? 'active' : ''}" data-t="${k}">${l}</button>`).join('')}</div><div class="row g-3 mb-3" id="k"></div><div id="v">${skeleton(5, 40)}</div>`;
  const $ = s => el.querySelector(s); rangeBar($('#rb'), st, () => load());
  const tbl = (cols, rows, totals) => `<div class="tbl-wrap"><table class="fb-table"><thead><tr>${cols.map((c, i) => `<th class="${i ? 'num' : ''}">${c}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr>${r.map((c, i) => `<td class="${i ? 'num' : ''}">${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="muted text-center">No data in this period</td></tr>`}${totals ? `<tr class="fw-bold">${totals.map((c, i) => `<td class="${i ? 'num' : ''}">${c}</td>`).join('')}</tr>` : ''}</tbody></table></div>`;
  const view = () => {
    const t = st.tab; let cols, rows, tot = null, plain; const days = d.days;
    const periodRows = list => list.map(r => [r.k, num(r.services), money(r.service_revenue), money(r.product_revenue), money(r.discounts), money(r.revenue), money(r.commission), money(r.expenses), money(r.profit)]);
    const pCols = ['Period', 'Services', 'Service sales', 'Product sales', 'Discounts', 'Total sales', 'Commissions', 'Expenses', 'Profit est.'];
    if (t === 'daily') { const g = group(days, x => x); cols = pCols.map((c, i) => i === 0 ? 'Date' : c); rows = g.map(r => [fmtDate(r.k), ...periodRows([r])[0].slice(1)]); plain = g.map(r => [r.k, r.services, r.service_revenue, r.product_revenue, r.discounts, r.revenue, r.commission, r.expenses, r.profit]); }
    else if (t === 'weekly' || t === 'monthly') { const g = group(days, t === 'weekly' ? weekKey : x => x.slice(0, 7)); cols = pCols.map((c, i) => i === 0 ? (t === 'weekly' ? 'Week starting' : 'Month') : c); rows = g.map(r => [t === 'weekly' ? fmtDate(r.k) : r.k, ...periodRows([r])[0].slice(1)]); plain = g.map(r => [r.k, r.services, r.service_revenue, r.product_revenue, r.discounts, r.revenue, r.commission, r.expenses, r.profit]); }
    else if (t === 'service') { cols = ['Service', 'Times', 'Revenue', 'Avg price']; rows = d.by_service.map(r => [esc(r.name), num(r.times), money(r.revenue), money(r.avg_price)]); plain = d.by_service.map(r => [r.name, r.times, r.revenue, r.avg_price]); }
    else if (t === 'barber') { cols = ['Barber', 'Services', 'Revenue', 'Commission']; rows = d.by_barber.map(r => [esc(r.name), num(r.services), money(r.revenue), money(r.commission)]); plain = d.by_barber.map(r => [r.name, r.services, r.revenue, r.commission]); }
    else if (t === 'visits') { cols = ['Customer', 'Phone', 'Visits', 'Spent', 'Last visit']; rows = d.visits.map(r => [esc(r.name), esc(r.phone || '—'), num(r.visits), money(r.spent), fmtDate(r.last_visit)]); plain = d.visits.map(r => [r.name, r.phone || '', r.visits, r.spent, r.last_visit]); }
    else if (t === 'inventory') { cols = ['Item', 'In stock', 'Restocked', 'Used', 'Sold', 'Stock value']; rows = d.inventory.map(r => [esc(r.name) + (r.stock_qty <= r.low_stock_at ? ' ' + pill('Low', 'warning') : ''), num(r.stock_qty), num(r.restocked), num(r.used), num(r.sold), money(r.stock_qty * r.cost_price)]); plain = d.inventory.map(r => [r.name, r.stock_qty, r.restocked, r.used, r.sold, r.stock_qty * r.cost_price]); }
    else if (t === 'expenses') { cols = ['Date', 'Category', 'Description', 'By', 'Amount']; rows = d.expense_rows.map(r => [fmtDate(r.expense_date), esc(r.category), esc(r.description || ''), esc(r.by_name || ''), money(r.amount)]); plain = d.expense_rows.map(r => [r.expense_date, r.category, r.description || '', r.by_name || '', r.amount]); tot = ['Total', '', '', '', money(d.pnl.expenses)]; }
    else { const p = d.pnl; const lines = [['Service sales', p.revenue_services], ['Product sales', p.revenue_products], ['Total revenue', p.revenue, 1], ['Cost of products sold', p.cost_of_goods ? -p.cost_of_goods : 0], ['Gross profit', p.gross_profit, 1], ['Barber commissions', p.commissions ? -p.commissions : 0], ...p.expense_breakdown.map(e => ['Expense: ' + e.category, e.total ? -e.total : 0]), ['Total expenses', p.expenses ? -p.expenses : 0, 1], ['NET PROFIT', p.net_profit, 1]]; cols = ['Item', 'Amount']; rows = lines.map(([l, v, b]) => [b ? `<b>${l}</b>` : l, b ? `<b>${money(v)}</b>` : money(v)]); plain = lines.map(([l, v]) => [l, v]); }
    $('#v').innerHTML = `<div class="fb-card">${tbl(cols, rows, tot)}</div>`; view.cur = { cols, plain };
  };
  const load = async () => {
    try {
      d = await get('/b/barber/reports', { from: st.from, to: st.to }); const t = d.totals || {}; const a = d.appointments;
      $('#k').innerHTML = [kpi('bi-cash-stack', 'Total sales', money(t.revenue || 0), `${num(t.services || 0)} services`), kpi('bi-wallet2', 'Expenses', money(d.pnl.expenses), `Commissions ${money(d.pnl.commissions)}`, 'var(--danger)'), kpi('bi-graph-up-arrow', 'Net profit', money(d.pnl.net_profit), 'After commissions & expenses', d.pnl.net_profit >= 0 ? 'var(--success)' : 'var(--danger)'), kpi('bi-calendar2-check', 'Visits', `${num(a.completed)} done`, `${num(a.walkins)} walk-ins · ${num(a.cancelled)} cancelled · ${num(a.missed)} missed`, 'var(--info)')].join('');
      view();
    } catch (e) { $('#v').innerHTML = empty('bi-exclamation-triangle', 'Could not load', e.message); }
  };
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { st.tab = b.dataset.t; el.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('active', x === b)); if (d) view(); });
  exportButtons($('#act'), async () => { const lbl = TABS.find(x => x[0] === st.tab)[1]; return { filename: `barber_${st.tab}_${st.from}_${st.to}`, title: `${ctx.biz.short_name} – ${lbl} report`, subtitle: `${st.from} to ${st.to} · ${ctx.biz.currency}`, columns: view.cur.cols.map(c => String(c).replace(/<[^>]+>/g, '')), rows: view.cur.plain, landscape: view.cur.cols.length > 6, footer: 'Generated by FBBMS' }; });
  await load();
}
