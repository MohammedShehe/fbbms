import { get, post } from '../api.js';
import { esc, money, num, fmtDateTime, openModal, fail, ok, empty, skeleton, pill, todayEAT, addDays, debounce, PAY } from '../ui.js';

const METHODS = Object.entries(PAY).filter(([k]) => k !== 'other' || true);

export async function render(el, ctx) {
  const t = todayEAT(); const st = { from: addDays(t, -29), to: t };
  el.innerHTML = `<div class="page-head"><div><h1>Refunds & exchanges</h1><p>Goods returned against sales. To start one, open a sale in <a href="#/sales">Sales</a> and choose Return.</p></div></div>
  <div class="filters"><input type="date" id="from" class="form-control" value="${st.from}"><input type="date" id="to" class="form-control" value="${st.to}"><select id="ty" class="form-select" style="max-width:160px"><option value="">All types</option><option value="refund">Refunds</option><option value="exchange">Exchanges</option></select></div>
  <div class="row g-3 mb-3" id="k"></div><div class="tbl-wrap"><table class="fb-table stack"><thead><tr><th>When</th><th>Ref</th><th>Sale</th><th>Items</th><th>Reason</th><th>By</th><th class="num">Value</th><th class="num">Paid out</th></tr></thead><tbody id="r"><tr><td colspan="8">${skeleton(4, 22)}</td></tr></tbody></table></div>`;
  const $ = s => el.querySelector(s); let ty = '';
  const load = async () => {
    try {
      let rows = await get('/b/refunds', st); if (ty) rows = rows.filter(r => r.type === ty);
      const tot = rows.reduce((s, r) => s + Number(r.amount), 0), out = rows.reduce((s, r) => s + Number(r.cash_out), 0);
      $('#k').innerHTML = [['Returns', rows.length, 'var(--primary)'], ['Value returned', money(tot), 'var(--danger)'], ['Money paid out', money(out), 'var(--warning)']].map(([l, v, c]) => `<div class="col-6 col-md-4"><div class="kpi" style="--c:${c}"><div class="lbl">${l}</div><div class="val">${v}</div></div></div>`).join('');
      $('#r').innerHTML = rows.length ? rows.map(r => `<tr><td data-label="When">${fmtDateTime(r.created_at)}</td><td data-label="Ref"><b>${esc(r.refund_no)}</b><br>${pill(r.type === 'exchange' ? 'Exchange' : 'Refund', r.type === 'exchange' ? 'info' : 'warning')}</td><td data-label="Sale">${esc(r.receipt_no)}${r.new_receipt_no ? `<br><small class="muted">→ ${esc(r.new_receipt_no)}</small>` : ''}${r.customer_name ? `<br><small class="muted">${esc(r.customer_name)}</small>` : ''}</td><td data-label="Items">${r.items.map(i => `${i.qty}× ${esc(i.name)}${i.restocked ? '' : ' <small class="muted">(not restocked)</small>'}`).join('<br>')}</td><td data-label="Reason">${esc(r.reason)}</td><td data-label="By">${esc(r.user_name)}</td><td class="num" data-label="Value">${money(r.amount)}</td><td class="num" data-label="Paid out">${Number(r.cash_out) ? money(r.cash_out) + `<br><small class="muted">${esc((PAY[r.method] || [r.method])[0])}</small>` : '<span class="muted">credit</span>'}</td></tr>`).join('') : `<tr><td colspan="8">${empty('bi-arrow-return-left', 'No returns in this period')}</td></tr>`;
    } catch (e) { $('#r').innerHTML = `<tr><td colspan="8" class="text-danger">${esc(e.message)}</td></tr>`; }
  };
  ['from', 'to'].forEach(k => $('#' + k).onchange = e => { st[k] = e.target.value; load(); }); $('#ty').onchange = e => { ty = e.target.value; load(); };
  await load();
}

/** Opens the return/exchange dialog for a sale. onDone() is called after a successful return. */
export async function openRefund(ctx, saleId, onDone) {
  let info;
  try { info = await get(`/b/sales/${saleId}/refundable`); } catch (e) { return fail(e); }
  const { sale, ratio, items } = info; const sel = {}; let type = 'refund'; let repl = []; let results = [];
  if (!items.some(i => i.available > 0)) return fail(new Error('Everything on this sale has already been returned'));
  const m = openModal({ size: 'modal-lg', title: `Return · ${esc(sale.receipt_no)}`, body: `<div class="btn-group mb-3 w-100"><button class="btn btn-fb" data-t="refund">Refund</button><button class="btn btn-soft" data-t="exchange">Exchange</button></div>
    <h6>Items coming back</h6><div id="its">${items.map(i => `<div class="cart-line"><div><div class="fw-semibold small">${esc(i.name)}</div><div class="small muted">${num(i.unit_price)} each · sold ${i.qty}${i.returned ? ` · already returned ${i.returned}` : ''}</div></div>${i.available > 0 ? `<div class="d-flex align-items-center gap-2"><label class="small d-flex align-items-center gap-1"><input type="checkbox" data-rs="${i.id}" checked> restock</label><input type="number" min="0" max="${i.available}" value="0" data-q="${i.id}" class="form-control form-control-sm" style="width:72px"><span class="small muted">/ ${i.available}</span></div>` : '<span class="small muted">fully returned</span>'}</div>`).join('')}</div>
    <div id="ex" class="d-none mt-3"><h6>Replacement items</h6><input id="ps" class="form-control mb-2" placeholder="Search product, SKU or barcode…"><div id="pr" class="mb-2"></div><div id="rl"></div></div>
    <div class="row g-2 mt-2"><div class="col-md-5"><label class="form-label">Money back via</label><select id="mt" class="form-select">${METHODS.map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></div><div class="col-md-7"><label class="form-label">Reason *</label><input id="rs" class="form-control" maxlength="200" placeholder="e.g. wrong size, faulty, changed mind"></div></div>
    <div id="sum" class="mt-3"></div>`, footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-fb" id="go">Process return</button>' });
  const $ = s => m.el.querySelector(s);
  const calc = () => {
    const picks = items.map(i => ({ i, q: Number(sel[i.id]) || 0 })).filter(p => p.q > 0); const gross = picks.reduce((s, p) => s + p.i.unit_price * p.q, 0);
    const allBack = items.every(i => i.returned + (Number(sel[i.id]) || 0) >= i.qty); const left = sale.total - sale.refunded_total;
    const amount = !picks.length ? 0 : allBack ? left : Math.min(gross * ratio, left); const credit = Math.max(0, sale.amount_paid - (sale.total - (sale.refunded_total + amount)));
    const newTotal = repl.reduce((s, r) => s + r.price * r.qty, 0); return { picks, amount: Math.round(amount * 100) / 100, credit: Math.round(credit * 100) / 100, newTotal };
  };
  const draw = () => {
    const c = calc(); const diff = type === 'exchange' ? c.newTotal - c.credit : 0;
    $('#sum').innerHTML = `<div class="fb-card" style="padding:12px"><div class="total-row"><span>Value of returned goods</span><span>${money(c.amount)}</span></div><div class="total-row"><span>Refundable to customer (what they have paid)</span><span>${money(c.credit)}</span></div>${type === 'exchange' ? `<div class="total-row"><span>Replacement items</span><span>${money(c.newTotal)}</span></div><div class="total-row big"><span>${diff > 0 ? 'Customer pays extra' : 'Money back to customer'}</span><span>${money(Math.abs(diff))}</span></div>` : `<div class="total-row big"><span>Money back to customer</span><span>${money(c.credit)}</span></div>`}<div class="small muted mt-1">Final amounts are confirmed by the server (discounts and tax are shared proportionally).</div></div>`;
    $('#rl').innerHTML = repl.map(r => `<div class="cart-line"><div class="small fw-semibold">${esc(r.name)} <span class="muted">${num(r.price)}</span></div><div class="d-flex gap-2 align-items-center"><input type="number" min="1" value="${r.qty}" data-rq="${r.id}" class="form-control form-control-sm" style="width:72px"><button class="btn btn-sm btn-soft" data-rx="${r.id}"><i class="bi bi-x"></i></button></div></div>`).join('');
    m.el.querySelectorAll('[data-rq]').forEach(i => i.onchange = () => { repl.find(r => r.id == i.dataset.rq).qty = Math.max(1, parseInt(i.value) || 1); draw(); });
    m.el.querySelectorAll('[data-rx]').forEach(b => b.onclick = () => { repl = repl.filter(r => r.id != b.dataset.rx); draw(); });
  };
  m.el.querySelectorAll('[data-q]').forEach(i => i.oninput = () => { const it = items.find(x => x.id == i.dataset.q); let v = Math.max(0, Math.min(it.available, parseInt(i.value) || 0)); sel[it.id] = v; draw(); });
  m.el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { type = b.dataset.t; m.el.querySelectorAll('[data-t]').forEach(x => { x.className = 'btn ' + (x === b ? 'btn-fb' : 'btn-soft'); }); $('#ex').classList.toggle('d-none', type !== 'exchange'); $('#go').textContent = type === 'exchange' ? 'Process exchange' : 'Process return'; draw(); });
  $('#ps').oninput = debounce(async e => {
    const s = e.target.value.trim(); if (s.length < 2) { $('#pr').innerHTML = ''; return; }
    try { const r = await get('/b/products', { search: s, limit: 8, status: 'active' }); results = r.rows; $('#pr').innerHTML = results.map(p => `<button class="btn btn-sm btn-soft me-1 mb-1" data-ap="${p.id}">${esc(p.name)} · ${num(p.price)}${p.track_stock ? ` (${p.stock_qty})` : ''}</button>`).join('') || '<span class="small muted">No match</span>';
      m.el.querySelectorAll('[data-ap]').forEach(b => b.onclick = () => { const p = results.find(x => x.id == b.dataset.ap); const e2 = repl.find(x => x.id === p.id); if (e2) e2.qty++; else repl.push({ id: p.id, name: p.name, price: p.price, qty: 1 }); draw(); }); } catch (er) { fail(er); }
  }, 250);
  $('#go').onclick = async () => {
    const c = calc(); const reason = $('#rs').value.trim();
    if (!c.picks.length) return fail(new Error('Choose how many of each item are coming back')); if (reason.length < 3) return fail(new Error('Give a reason for the return'));
    if (type === 'exchange' && !repl.length) return fail(new Error('Choose the replacement items'));
    const body = { type, reason, method: $('#mt').value, items: c.picks.map(p => ({ sale_item_id: p.i.id, qty: p.q, restock: !!m.el.querySelector(`[data-rs="${p.i.id}"]`).checked })) };
    if (type === 'exchange') { body.new_items = repl.map(r => ({ product_id: r.id, qty: r.qty })); const diff = Math.round((c.newTotal - c.credit) * 100) / 100; if (diff > 0) body.payments = [{ method: $('#mt').value, amount: diff }]; }
    const b = $('#go'); b.disabled = true;
    try { const r = await post(`/b/sales/${saleId}/refund`, body); m.close(); ok(`${r.type === 'exchange' ? 'Exchange' : 'Refund'} ${r.refund_no} done`, r.cash_out > 0 ? `Give the customer ${money(r.cash_out)}` : r.new_sale && r.new_sale.balance_due > 0 ? `Customer still owes ${money(r.new_sale.balance_due)}` : ''); if (onDone) onDone(r); }
    catch (e) { fail(e); b.disabled = false; }
  };
  draw();
}
