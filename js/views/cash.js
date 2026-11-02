import { get, post } from '../api.js';
import { esc, money, fmtDateTime, fmtDate, openModal, fail, ok, empty, skeleton, pill, todayEAT } from '../ui.js';

const LINES = [['opening_float', 'Opening float', 1], ['cash_sales', 'Cash sales received', 1], ['cash_refunds', 'Cash refunds paid out', -1], ['supplier_payments', 'Supplier payments (cash)', -1], ['expenses_from_till', 'Expenses paid from till', -1], ['cash_in', 'Cash added to till', 1], ['cash_out', 'Cash taken out of till', -1]];
const rowsOf = b => LINES.map(([k, l, s]) => `<div class="total-row"><span>${l}</span><span class="${s < 0 && b[k] ? 'text-danger' : ''}">${s < 0 && b[k] ? '− ' : ''}${money(b[k])}</span></div>`).join('') + `<div class="total-row big"><span>Expected in till</span><span>${money(b.expected)}</span></div>`;
const varPill = v => v === null || v === undefined ? '' : Number(v) === 0 ? pill('Balanced', 'success') : pill(`${v < 0 ? 'Short' : 'Over'} ${money(Math.abs(v))}`, v < 0 ? 'danger' : 'warning');

export async function render(el, ctx) {
  el.innerHTML = `<div class="page-head"><div><h1>Cash & till</h1><p>Open the till, track cash in and out, then close and compare with what you counted.</p></div><button class="btn btn-soft" id="zr"><i class="bi bi-printer me-1"></i>Closing report</button></div><div id="body">${skeleton(5, 40)}</div>`;
  const $ = s => el.querySelector(s); let hist = [];
  const load = async () => {
    const [cur, h] = await Promise.all([get('/b/cash/session'), get('/b/cash/sessions')]); hist = h; const s = cur.session; const last = cur.last_closed;
    let top;
    if (!s) top = `<div class="fb-card mb-3"><h3><i class="bi bi-door-closed me-2"></i>The till is closed</h3><div class="card-sub">Count the cash you are starting with and open it.${last ? ` Last closed ${fmtDateTime(last.closed_at)} — ${varPill(last.variance)}` : ''}</div>
      <div class="row g-2 align-items-end"><div class="col-sm-6 col-md-4"><label class="form-label">Opening float (${esc(ctx.biz.currency)})</label><input id="fl" type="number" min="0" class="form-control" placeholder="0" inputmode="decimal"></div><div class="col-auto"><button class="btn btn-fb" id="open"><i class="bi bi-unlock me-1"></i>Open till</button></div></div></div>`;
    else top = `<div class="row g-3 mb-3"><div class="col-lg-6"><div class="fb-card h-100"><div class="d-flex justify-content-between align-items-start"><div><h3><i class="bi bi-door-open me-2"></i>Till is open</h3><div class="card-sub">Opened ${fmtDateTime(s.opened_at)} by ${esc(s.opened_by_name)}</div></div>${pill('Live', 'success')}</div>${rowsOf(s.live)}
      <button class="btn btn-fb w-100 mt-3" id="close"><i class="bi bi-lock me-1"></i>Count & close till</button></div></div>
      <div class="col-lg-6"><div class="fb-card h-100"><h3>Cash in / out</h3><div class="card-sub">Money added to or taken from the till that is not a sale or expense.</div>
      <div class="row g-2 mb-3"><div class="col-4"><select id="mt" class="form-select"><option value="in">Cash in</option><option value="out">Cash out</option></select></div><div class="col-8"><input id="ma" type="number" min="0" class="form-control" placeholder="Amount" inputmode="decimal"></div><div class="col-12"><input id="mr" class="form-control" placeholder="Reason (e.g. bank deposit, change)" maxlength="200"></div><div class="col-12"><button class="btn btn-soft w-100" id="mv"><i class="bi bi-plus-lg me-1"></i>Record</button></div></div>
      ${s.movements.length ? s.movements.map(m => `<div class="feed-item"><i class="bi ${m.type === 'in' ? 'bi-arrow-down-circle text-success' : 'bi-arrow-up-circle text-danger'} fs-5"></i><div class="flex-grow-1"><div class="small fw-semibold">${esc(m.reason)}</div><div class="small muted">${esc(m.user_name)} · ${fmtDateTime(m.created_at)}</div></div><b>${m.type === 'in' ? '+' : '−'} ${money(m.amount)}</b></div>`).join('') : '<div class="small muted">No movements yet.</div>'}</div></div></div>`;
    const histHtml = `<div class="fb-card"><h3>Till history</h3><div class="card-sub">Latest 60 sessions</div>${hist.filter(x => x.status === 'closed').length ? `<div class="tbl-wrap"><table class="fb-table stack"><thead><tr><th>Opened</th><th>Closed</th><th>By</th><th class="num">Expected</th><th class="num">Counted</th><th>Result</th></tr></thead><tbody>${hist.filter(x => x.status === 'closed').map(x => `<tr data-s="${x.id}" style="cursor:pointer"><td data-label="Opened">${fmtDateTime(x.opened_at)}</td><td data-label="Closed">${fmtDateTime(x.closed_at)}</td><td data-label="By">${esc(x.closed_by_name || '')}</td><td class="num" data-label="Expected">${money(x.expected_cash)}</td><td class="num" data-label="Counted">${money(x.counted_cash)}</td><td data-label="Result">${varPill(x.variance)}</td></tr>`).join('')}</tbody></table></div>` : empty('bi-safe2', 'No closed sessions yet')}</div>`;
    $('#body').innerHTML = top + histHtml;
    if ($('#open')) $('#open').onclick = async () => { try { await post('/b/cash/open', { opening_float: $('#fl').value || 0 }); ok('Till opened'); load(); } catch (e) { fail(e); } };
    if ($('#mv')) $('#mv').onclick = async () => { try { await post('/b/cash/movements', { type: $('#mt').value, amount: $('#ma').value, reason: $('#mr').value }); ok('Recorded'); load(); } catch (e) { fail(e); } };
    if ($('#close')) $('#close').onclick = () => closeTill(s);
    el.querySelectorAll('[data-s]').forEach(r => r.onclick = () => detail(hist.find(x => x.id == r.dataset.s)));
  };
  function closeTill(s) {
    const m = openModal({ size: 'modal-sm', title: 'Close the till', body: `<div class="small muted mb-2">Count all the cash in the drawer and enter the total.</div><label class="form-label">Cash counted (${esc(ctx.biz.currency)})</label><input id="cc" type="number" min="0" class="form-control mb-3" inputmode="decimal" autofocus><label class="form-label">Note (optional)</label><input id="cn" class="form-control" maxlength="300">`, footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-fb" id="go">Close till</button>' });
    m.el.querySelector('#go').onclick = async () => {
      const v = m.el.querySelector('#cc').value; if (v === '') return fail(new Error('Enter the cash you counted'));
      try { const r = await post('/b/cash/close', { counted_cash: v, notes: m.el.querySelector('#cn').value }); m.close(); result(r); load(); } catch (e) { fail(e); }
    };
  }
  function result(r) { openModal({ title: r.variance === 0 ? '✅ Till balanced' : '⚠️ Till closed with a difference', body: `${rowsOf(r.breakdown)}<div class="total-row"><span>Counted</span><span>${money(r.counted)}</span></div><div class="total-row big"><span>Difference</span><span class="${r.variance < 0 ? 'text-danger' : r.variance > 0 ? 'text-warning' : 'text-success'}">${r.variance > 0 ? '+' : ''}${money(r.variance)}</span></div><div class="small muted mt-2">${r.variance === 0 ? 'Everything adds up.' : r.variance < 0 ? 'There is less cash than expected. Super Admins have been alerted.' : 'There is more cash than expected. Check for unrecorded sales or cash-in.'}</div>` }); }
  function detail(x) { openModal({ title: `Till session · ${fmtDate(x.session_date)}`, body: `${x.breakdown ? rowsOf(x.breakdown) : ''}<div class="total-row"><span>Counted</span><span>${money(x.counted_cash)}</span></div><div class="total-row big"><span>Difference</span><span>${varPill(x.variance)}</span></div>${x.notes ? `<div class="small mt-2">Note: ${esc(x.notes)}</div>` : ''}` }); }
  $('#zr').onclick = () => closingReport(ctx);
  await load();
}

export async function closingReport(ctx, date) {
  const d = date || todayEAT();
  const m = openModal({ size: 'modal-lg', title: 'Daily closing report', body: `<div class="d-flex gap-2 mb-3 d-print-none"><input type="date" id="rd" class="form-control" style="max-width:190px" value="${d}"></div><div id="rp">${skeleton(5, 24)}</div>`, footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Close</button><button class="btn btn-fb" id="pr"><i class="bi bi-printer me-1"></i>Print</button>' });
  const draw = async () => {
    try {
      const r = await get('/b/closing-report', { date: m.el.querySelector('#rd').value }); const s = r.summary; const c = esc(r.currency);
      m.el.querySelector('#rp').innerHTML = `<div id="zrep"><div class="text-center mb-3"><b style="font-size:1.2em">${esc(r.business)}</b><div class="muted">Closing report · ${fmtDate(r.date)}</div></div>
      <div class="row g-2 mb-3">${[['Sales', s.sales], ['Revenue', money(s.net_revenue)], ['Gross profit', money(s.gross_profit)], ['Net profit', money(s.net_profit)]].map(([l, v]) => `<div class="col-6 col-md-3"><div class="kpi"><div class="lbl">${l}</div><div class="val" style="font-size:1.1rem">${v}</div></div></div>`).join('')}</div>
      <div class="total-row"><span>Gross sales</span><span>${money(s.gross)}</span></div><div class="total-row"><span>Discounts</span><span>− ${money(s.discounts)}</span></div><div class="total-row"><span>Refunds (${s.refunds.count})</span><span>− ${money(s.refunds.amount)}</span></div><div class="total-row"><span>Expenses</span><span>− ${money(s.expenses)}</span></div><div class="total-row"><span>Voided sales (${s.voids.count})</span><span>${money(s.voids.value)}</span></div><div class="total-row"><span>Credit given (${r.credit_given.sales})</span><span>${money(r.credit_given.amount)}</span></div>
      <h6 class="mt-3">Money received by method (net of refunds)</h6>${r.payments_by_method.map(p => `<div class="total-row"><span>${esc(p.method.replace('_', ' '))}</span><span>${money(p.net)}</span></div>`).join('') || '<div class="small muted">None</div>'}
      <h6 class="mt-3">Till sessions</h6>${r.cash_sessions.map(x => `<div class="total-row"><span>Float ${money(x.opening_float)} → ${x.status === 'closed' ? `expected ${money(x.expected_cash)}, counted ${money(x.counted_cash)}` : 'still open'}</span><span>${varPill(x.variance)}</span></div>`).join('') || '<div class="small muted">No till session that day</div>'}
      <h6 class="mt-3">By seller</h6>${r.by_seller.map(x => `<div class="total-row"><span>${esc(x.name)} · ${x.sales} sales${x.voids ? ` · ${x.voids} void(s)` : ''}</span><span>${money(x.revenue)}</span></div>`).join('') || '<div class="small muted">No sales</div>'}
      ${r.expenses.length ? `<h6 class="mt-3">Expenses</h6>${r.expenses.map(x => `<div class="total-row"><span>${esc(x.category)}${x.description ? ' · ' + esc(x.description) : ''}</span><span>${money(x.amount)}</span></div>`).join('')}` : ''}
      ${(r.low_stock || []).length ? `<h6 class="mt-3">Low stock</h6><div class="small">${r.low_stock.map(p => `${esc(p.name)} (${p.stock_qty})`).join(', ')}</div>` : ''}</div>`;
    } catch (e) { m.el.querySelector('#rp').innerHTML = `<div class="text-danger">${esc(e.message)}</div>`; }
  };
  m.el.querySelector('#rd').onchange = draw; m.el.querySelector('#pr').onclick = () => { const w = window.open('', '_blank'); w.document.write(`<html><head><title>Closing report</title><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:20px auto;color:#111}.total-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dotted #bbb}.kpi{border:1px solid #ccc;padding:6px;border-radius:6px}.lbl{font-size:.75em;color:#666}.row{display:flex;flex-wrap:wrap;gap:8px}.col-6,.col-md-3{flex:1 1 22%}.pill{font-weight:700}.muted{color:#666}h6{margin:14px 0 4px}</style></head><body>${m.el.querySelector('#zrep').innerHTML}</body></html>`); w.document.close(); w.print(); };
  await draw();
}
