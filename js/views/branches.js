// Branches: head-office view for businesses grouped under one company (compare performance, move stock between branches).
import { get, post } from '../api.js';
import { esc, money, num, openModal, fail, ok, empty, skeleton, chartTheme, PALETTE, todayEAT, fmtDate, pill } from '../ui.js';

let charts = [];
const kill = () => { charts.forEach(c => { try { c.destroy(); } catch (_) { /* gone */ } }); charts = []; };

export async function render(el, ctx) {
  ctx.cleanup = kill;
  const groups = await get('/group/mine');
  if (!groups.length) { el.innerHTML = `<div class="page-head"><div><h1>Branches</h1></div></div>${empty('bi-diagram-3', 'No branch group', 'The platform Developer can link your businesses as branches of one company.')}`; return; }
  let gid = groups[0].id; const day1 = todayEAT().slice(0, 8) + '01'; const st = { from: day1, to: todayEAT() };
  el.innerHTML = `<div class="page-head"><div><h1>Branches</h1><p>Compare branches side by side and move stock between them.</p></div><div class="d-flex gap-2 flex-wrap">${groups.length > 1 ? `<select id="gs" class="form-select" style="width:auto">${groups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select>` : `<span class="pill gold align-self-center">${esc(groups[0].name)}</span>`}<button class="btn btn-fb" id="tr"><i class="bi bi-arrow-left-right me-1"></i>Transfer stock</button></div></div>
    <div class="filters"><label class="small muted align-self-center">From</label><input type="date" id="from" class="form-control" value="${st.from}"><label class="small muted align-self-center">To</label><input type="date" id="to" class="form-control" value="${st.to}"></div><div id="o">${skeleton(4, 80)}</div>`;
  const $ = s => el.querySelector(s); let data = null;
  const load = async () => {
    kill(); $('#o').innerHTML = skeleton(4, 80);
    try { data = await get(`/group/${gid}/compare`, st); } catch (e) { $('#o').innerHTML = ''; return fail(e); }
    const B = data.branches, t = data.totals; const cur = c => `${c} `;
    const best = k => B.length > 1 ? B.reduce((a, b) => b[k] > a[k] ? b : a).id : null;
    const cols = [['Revenue (net)', 'revenue', 1], ['Gross profit', 'profit', 1], ['Expenses', 'expenses', 0], ['Net profit', 'net_profit', 1], ['Margin %', 'margin_pct', 1, 1], ['Sales', 'sales', 1, 1], ['Avg sale', 'avg_sale', 1], ['Refunds', 'refunds', 0], ['Stock value (cost)', 'stock_value_cost', 0], ['Low / out of stock', 'low_stock', 0, 1], ['Customer debts', 'customer_debts', 0]];
    $('#o').innerHTML = `${t ? `<div class="row g-3 mb-3">${[['Combined revenue', t.revenue], ['Combined net profit', t.net_profit]].map(([l, v]) => `<div class="col-6"><div class="kpi" style="--c:var(--primary)"><div class="lbl">${l}</div><div class="val">${cur(t.currency)}${num(v)}</div></div></div>`).join('')}</div>` : data.note ? `<div class="alert alert-info">${esc(data.note)}</div>` : ''}
      <div class="fb-card mb-3"><h3>Branch comparison</h3><div class="card-sub">${fmtDate(data.from)} → ${fmtDate(data.to)} · figures are net of refunds</div><div class="tbl-wrap"><table class="fb-table"><thead><tr><th>Measure</th>${B.map(b => `<th class="num">${esc(b.short_name)}</th>`).join('')}</tr></thead><tbody>
        ${cols.map(([l, k, hi, plain]) => { const bid = hi ? best(k) : null; return `<tr><td>${l}</td>${B.map(b => `<td class="num ${bid === b.id ? 'fw-bold' : ''}" style="${bid === b.id ? 'color:var(--success)' : ''}">${plain ? num(b[k]) : cur(b.currency) + num(b[k])}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div></div>
      <div class="row g-3 mb-3"><div class="col-lg-7"><div class="fb-card h-100"><h3>Revenue, profit & expenses</h3><div class="chart-box"><canvas id="c1"></canvas></div></div></div><div class="col-lg-5"><div class="fb-card h-100"><h3>Stock value by branch</h3><div class="chart-box"><canvas id="c2"></canvas></div></div></div></div>`;
    const th = chartTheme(); Chart.defaults.color = th.text;
    charts.push(new Chart($('#c1'), { type: 'bar', data: { labels: B.map(b => b.short_name), datasets: [['Revenue', 'revenue', 0], ['Net profit', 'net_profit', 2], ['Expenses', 'expenses', 3]].map(([l, k, i]) => ({ label: l, data: B.map(b => b[k]), backgroundColor: PALETTE[i] })) }, options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: th.grid } }, x: { grid: { display: false } } } } }));
    charts.push(new Chart($('#c2'), { type: 'doughnut', data: { labels: B.map(b => b.short_name), datasets: [{ data: B.map(b => b.stock_value_cost), backgroundColor: PALETTE, borderWidth: 0 }] }, options: { maintainAspectRatio: false, cutout: '62%' } }));
  };
  $('#from').onchange = e => { st.from = e.target.value; load(); }; $('#to').onchange = e => { st.to = e.target.value; load(); };
  const gs = $('#gs'); if (gs) gs.onchange = () => { gid = Number(gs.value); load(); };

  $('#tr').onclick = async () => {
    if (!data || data.branches.length < 2) return fail(new Error('You need access to at least two branches to transfer stock.'));
    const B = data.branches; let prods = [];
    const m = openModal({ size: 'modal-lg', title: 'Transfer stock between branches', body: `<div class="row g-2 mb-3"><div class="col-md-6"><label class="form-label">From</label><select class="form-select" id="f">${B.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div><div class="col-md-6"><label class="form-label">To</label><select class="form-select" id="t">${B.map((b, i) => `<option value="${b.id}" ${i === 1 ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></div></div>
      <div id="pl">${skeleton(3, 28)}</div><div class="form-check my-3"><input class="form-check-input" type="checkbox" id="cm"><label class="form-check-label" for="cm">Create the product in the receiving branch if it does not exist there (matched by SKU)</label></div><label class="form-label">Note (optional)</label><input class="form-control" id="nt" maxlength="200" placeholder="e.g. Weekly restock">`,
      footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-fb" id="go">Transfer</button>' });
    const q = s => m.el.querySelector(s);
    const loadP = async () => { q('#pl').innerHTML = skeleton(3, 28); try { prods = await get(`/group/${gid}/products`, { business: q('#f').value }); } catch (e) { q('#pl').innerHTML = ''; return fail(e); }
      q('#pl').innerHTML = prods.length ? `<div class="tbl-wrap" style="max-height:300px;overflow:auto"><table class="fb-table"><thead><tr><th>Product</th><th>SKU</th><th class="num">In stock</th><th style="width:110px">Move</th></tr></thead><tbody>${prods.map(p => `<tr><td>${esc(p.name)}</td><td><code>${esc(p.sku)}</code></td><td class="num">${num(p.stock_qty)}</td><td><input type="number" min="0" max="${p.stock_qty}" class="form-control form-control-sm" data-p="${p.id}" placeholder="0"></td></tr>`).join('')}</tbody></table></div>` : empty('bi-box', 'No stock to move in this branch'); };
    q('#f').onchange = loadP; await loadP();
    q('#go').onclick = async () => {
      const items = [...m.el.querySelectorAll('[data-p]')].map(i => ({ product_id: Number(i.dataset.p), qty: Number(i.value) || 0 })).filter(i => i.qty > 0);
      if (!items.length) return fail(new Error('Enter a quantity for at least one product'));
      const b = q('#go'); b.disabled = true;
      try { const r = await post(`/group/${gid}/transfer`, { from_business: Number(q('#f').value), to_business: Number(q('#t').value), items, create_missing: q('#cm').checked, note: q('#nt').value }); ok('Stock transferred', r.moved.map(x => `${x.qty} × ${x.name}`).join(', ')); m.close(); load(); }
      catch (e) { fail(e); b.disabled = false; }
    };
  };
  await load();
}
