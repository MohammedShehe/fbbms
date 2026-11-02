import { get } from '../api.js';
import { esc, money, num, fmtDate, empty, skeleton, todayEAT, addDays, pill } from '../ui.js';
import { exportButtons } from '../export.js';

const row = (l, v, o = {}) => `<div class="total-row ${o.big ? 'big' : ''}"><span>${o.indent ? '&nbsp;&nbsp;' : ''}${l}</span><span class="${v < 0 && !o.nored ? 'text-danger' : ''}">${money(v)}</span></div>`;
const cap = s => String(s).replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

export async function render(el, ctx) {
  const t = todayEAT(); const st = { from: t.slice(0, 8) + '01', to: t };
  el.innerHTML = `<div class="page-head"><div><h1>Finance & tax</h1><p>Income statement, cash flow, tax and a snapshot of what you own and owe.</p></div><div class="d-flex gap-2" id="xb"></div></div>
  <div class="filters"><select id="pr" class="form-select" style="max-width:180px"><option value="month">This month</option><option value="last">Last month</option><option value="30">Last 30 days</option><option value="year">This year</option><option value="custom">Custom…</option></select><input type="date" id="from" class="form-control" value="${st.from}"><input type="date" id="to" class="form-control" value="${st.to}"></div><div id="b">${skeleton(6, 36)}</div>`;
  const $ = s => el.querySelector(s); let d = null;
  const load = async () => {
    $('#b').innerHTML = skeleton(6, 36);
    try {
      d = await get('/b/finance/statements', st); const I = d.income_statement, C = d.cash_flow, T = d.tax, P = d.position;
      $('#b').innerHTML = `<div class="row g-3"><div class="col-lg-6"><div class="fb-card h-100"><h3>Income statement</h3><div class="card-sub">${fmtDate(d.from)} – ${fmtDate(d.to)}</div>
        ${row('Gross sales', I.gross_sales)}${row('Discounts', I.discounts)}${row('Refunds', I.refunds)}${row('Net revenue', I.net_revenue, { big: 1 })}${row('Cost of goods sold', -I.cost_of_goods)}${row('Gross profit', I.gross_profit, { big: 1 })}
        ${row('Expenses', -I.expenses)}${I.expenses_by_category.map(c => row(esc(c.name), -c.total, { indent: 1, nored: 1 })).join('')}${row('Net profit', I.net_profit, { big: 1 })}<div class="small muted mt-2">Net margin ${num(I.net_margin_pct)}% · includes ${money(I.tax_included)} tax collected</div><div class="small muted">${esc(I.note)}</div></div></div>
      <div class="col-lg-6"><div class="fb-card h-100"><h3>Cash flow</h3><div class="card-sub">Money actually received and paid</div>
        ${C.received_by_method.map(m => row(`Received · ${esc(cap(m.method))}${m.refunded ? ` (refunded ${num(m.refunded)})` : ''}`, m.received - m.refunded)).join('') || '<div class="small muted">No payments in this period</div>'}${row('Total received', C.total_received)}${row('Refunds paid', -C.refunds_paid)}${row('Supplier payments', -C.supplier_payments)}${row('Expenses', -C.expenses)}${row('Net cash flow', C.net_cash_flow, { big: 1 })}<div class="small muted mt-2">${esc(C.note)}</div></div></div>
      <div class="col-lg-6"><div class="fb-card h-100"><h3>${esc(T.name)} report</h3><div class="card-sub">Rate ${num(T.rate_pct)}% · prices ${T.prices_include_tax ? 'include' : 'exclude'} tax${T.tin ? ' · TIN ' + esc(T.tin) : ''}</div>
        ${T.months.length ? `<div class="tbl-wrap"><table class="fb-table"><thead><tr><th>Month</th><th class="num">Net sales</th><th class="num">Collected</th><th class="num">Refunded</th><th class="num">Payable</th></tr></thead><tbody>${T.months.map(m => `<tr><td>${esc(m.month)}</td><td class="num">${num(m.net_sales)}</td><td class="num">${num(m.tax_collected)}</td><td class="num">${num(m.tax_refunded)}</td><td class="num"><b>${num(m.tax_payable)}</b></td></tr>`).join('')}</tbody></table></div>` : empty('bi-percent', 'No taxable sales', T.rate_pct ? '' : 'Set a tax rate in Shop settings to track tax.')}${row('Total payable', T.total_payable, { big: 1 })}</div></div>
      <div class="col-lg-6"><div class="fb-card h-100"><h3>Position snapshot</h3><div class="card-sub">What you hold and what is owed</div>${row('Stock at cost', P.inventory_at_cost)}${row('Stock at selling price', P.inventory_at_retail)}${row('Customers owe you', P.customer_debts)}${row('You owe suppliers', -P.owed_to_suppliers)}<div class="small muted mt-2">${esc(P.note)}</div></div></div></div>`;
    } catch (e) { $('#b').innerHTML = `<div class="fb-card text-danger">${esc(e.message)}</div>`; }
  };
  const preset = v => { const n = new Date(t + 'T00:00:00Z'); if (v === 'month') st.from = t.slice(0, 8) + '01', st.to = t; else if (v === 'last') { const f = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - 1, 1)); st.from = f.toISOString().slice(0, 10); st.to = addDays(t.slice(0, 8) + '01', -1); } else if (v === '30') st.from = addDays(t, -29), st.to = t; else if (v === 'year') st.from = t.slice(0, 4) + '-01-01', st.to = t; $('#from').value = st.from; $('#to').value = st.to; };
  $('#pr').onchange = e => { if (e.target.value !== 'custom') { preset(e.target.value); load(); } };
  ['from', 'to'].forEach(k => $('#' + k).onchange = e => { st[k] = e.target.value; $('#pr').value = 'custom'; load(); });
  exportButtons($('#xb'), async () => {
    if (!d) throw new Error('Nothing to export yet'); const I = d.income_statement, C = d.cash_flow, T = d.tax, P = d.position; const n = v => Number(v || 0);
    const inc = [['Gross sales', I.gross_sales], ['Discounts', I.discounts], ['Refunds', I.refunds], ['Net revenue', I.net_revenue], ['Cost of goods sold', -I.cost_of_goods], ['Gross profit', I.gross_profit], ['Expenses', -I.expenses], ...I.expenses_by_category.map(c => ['  ' + c.name, -c.total]), ['Net profit', I.net_profit]];
    const cf = [...C.received_by_method.map(m => ['Received · ' + m.method, m.received - m.refunded]), ['Total received', C.total_received], ['Refunds paid', -C.refunds_paid], ['Supplier payments', -C.supplier_payments], ['Expenses', -C.expenses], ['Net cash flow', C.net_cash_flow]];
    const tx = T.months.map(m => [m.month, m.net_sales, m.tax_collected, m.tax_refunded, m.tax_payable]);
    const pos = [['Stock at cost', P.inventory_at_cost], ['Stock at selling price', P.inventory_at_retail], ['Customers owe you', P.customer_debts], ['You owe suppliers', -P.owed_to_suppliers]];
    return { filename: `finance-${d.from}_${d.to}`, title: `Finance ${d.from} to ${d.to}`, subtitle: `${ctx.biz.name} · ${d.currency}`, footer: 'Generated by FBBMS',
      sheets: [{ name: 'Income statement', rows: [['Item', d.currency], ...inc] }, { name: 'Cash flow', rows: [['Item', d.currency], ...cf] }, { name: 'Tax', rows: [['Month', 'Net sales', 'Collected', 'Refunded', 'Payable'], ...tx] }, { name: 'Position', rows: [['Item', d.currency], ...pos] }],
      sections: [{ heading: 'Income statement', columns: ['Item', d.currency], rows: inc.map(r => [r[0], num(r[1])]) }, { heading: 'Cash flow', columns: ['Item', d.currency], rows: cf.map(r => [r[0], num(r[1])]) }, { heading: T.name + ' report', columns: ['Month', 'Net sales', 'Collected', 'Refunded', 'Payable'], rows: tx.map(r => [r[0], ...r.slice(1).map(num)]) }, { heading: 'Position', columns: ['Item', d.currency], rows: pos.map(r => [r[0], num(r[1])]) }] };
  });
  await load();
}
