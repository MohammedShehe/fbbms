import { get, post } from '../api.js';
import { esc, money, num, openModal, fail, ok, toast, debounce, empty, PAY, fmtDateTime, pill } from '../ui.js';

const rnd = n => Math.round((Number(n) || 0) * 100) / 100;
const PAYKEYS = Object.keys(PAY);

export async function render(el, ctx) {
  const [cats, prod] = await Promise.all([get('/b/categories'), get('/b/products', { limit: 500, status: 'active' })]);
  let products = prod.rows; let cart = []; let cat = ''; let search = '';
  const S = ctx.biz.settings || {}; const mods = ctx.biz.modules || {};
  const canDisc = ctx.can('sales.discount'); const canPrice = ctx.can('sales.price_override'); const maxPct = ctx.isSuper ? 100 : (S.max_discount_pct ?? 15);
  const canBackdate = ctx.isSuper || ctx.can('sales.backdate');
  const useCust = !!mods.customers; const canCredit = (ctx.isSuper || ctx.can('sales.credit')) && S.allow_credit !== false && useCust;
  const loyaltyOn = useCust && !!S.loyalty_enabled; const ptValue = Number(S.loyalty_point_value) || 0;
  const taxRate = Math.max(0, Number(S.tax_rate_pct) || 0); const taxIncl = S.tax_inclusive !== false; const taxName = S.tax_name || 'Tax';
  let customer = null; let redeem = 0; let pays = [{ method: 'cash', amount: '' }];
  const holdKey = `fbbms_hold_${ctx.biz.id}`;
  const holds = () => { try { return JSON.parse(localStorage.getItem(holdKey) || '[]'); } catch { return []; } };
  const saveHolds = h => { try { localStorage.setItem(holdKey, JSON.stringify(h.slice(0, 20))); } catch { /* storage unavailable */ } };
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const minPastStr = () => { const d = new Date(); d.setDate(d.getDate() - 730); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  el.innerHTML = `<div class="page-head"><div><h1>New sale</h1><p>Tap products or scan a barcode. Stock is checked and deducted automatically.${canBackdate ? ' You can also record past sales by changing the sale date.' : ''}</p></div>
    <div class="d-flex gap-2"><button class="btn btn-soft" id="holdBtn"><i class="bi bi-pause-circle me-1"></i>Hold</button><button class="btn btn-soft" id="resumeBtn"><i class="bi bi-play-circle me-1"></i>Held <span class="pill" id="holdN">0</span></button></div></div>
  <div class="pos"><div><div class="filters"><div class="search"><i class="bi bi-search"></i><input id="q" class="form-control" placeholder="Search name, brand, SKU or barcode…" autofocus></div>${'BarcodeDetector' in window ? '<button class="btn btn-soft" id="cam" title="Scan with camera"><i class="bi bi-camera"></i></button>' : ''}</div>
    <div class="chips" id="chips"></div><div class="pgrid" id="grid"></div></div>
  <div class="cart"><div class="fb-card"><div class="d-flex justify-content-between align-items-center mb-2"><h3 class="m-0"><i class="bi bi-cart3 me-2"></i>Current sale</h3><button class="btn btn-sm btn-soft" id="clear">Clear</button></div>
    <div id="lines"></div><div id="totals" class="mt-2"></div>
    ${useCust ? '<div class="mt-2" id="custBox"></div>' : ''}
    <div class="row g-2 mt-1">${useCust ? '' : '<div class="col-6"><label class="form-label">Customer (optional)</label><input id="cName" class="form-control" placeholder="Name"></div><div class="col-6"><label class="form-label">Phone (optional)</label><input id="cPhone" class="form-control" placeholder="07…" inputmode="tel"></div>'}
      ${canDisc ? `<div class="col-6"><label class="form-label">Discount (${esc(ctx.biz.currency)})${ctx.isSuper ? '' : ` · max ${maxPct}%`}</label><input id="disc" type="number" min="0" class="form-control" placeholder="0"></div>` : ''}
      <div class="col-${canDisc ? 6 : 12}" id="redeemBox"></div>
      ${canBackdate ? `<div class="col-6"><label class="form-label">Sale date <span class="muted small">(past allowed)</span></label><input id="saleDate" type="date" class="form-control" value="${todayStr()}" max="${todayStr()}" min="${minPastStr()}"></div><div class="col-6" id="backdateHint" style="display:none"><label class="form-label">&nbsp;</label><div class="form-control-plaintext small text-warning"><i class="bi bi-clock-history me-1"></i>Backdated — stock deducted from current levels</div></div>` : ''}
      <div class="col-12"><input id="notes" class="form-control" placeholder="Note (optional)" maxlength="200"></div></div>
    <div class="mt-3" id="paySec"></div>
    <button class="btn btn-fb btn-lg w-100 mt-3" id="pay-btn" disabled><i class="bi bi-check2-circle me-1"></i>Complete sale</button></div></div></div>`;
  const $ = s => el.querySelector(s);
  if (canBackdate && $('#saleDate')) {
    $('#saleDate').onchange = () => {
      const hint = $('#backdateHint');
      if (hint) hint.style.display = ($('#saleDate').value && $('#saleDate').value < todayStr()) ? '' : 'none';
    };
  }

  /* ---------- catalogue ---------- */
  const chips = () => { $('#chips').innerHTML = `<span class="chip ${cat === '' ? 'active' : ''}" data-c="">All</span>` + cats.filter(c => c.product_count).map(c => `<span class="chip ${cat == c.id ? 'active' : ''}" data-c="${c.id}">${esc(c.name)} <small>${c.product_count}</small></span>`).join(''); $('#chips').querySelectorAll('.chip').forEach(c => c.onclick = () => { cat = c.dataset.c; chips(); grid(); }); };
  const grid = () => {
    const s = search.toLowerCase(); const list = products.filter(p => (!cat || p.category_id == cat) && (!s || (p.name + ' ' + (p.brand || '') + ' ' + p.sku + ' ' + (p.barcode || '')).toLowerCase().includes(s)));
    $('#grid').innerHTML = list.length ? list.map(p => { const out = p.track_stock && p.stock_qty <= 0; return `<button class="pcard ${out ? 'out' : ''}" data-id="${p.id}"><div class="img">${p.image_url ? `<img src="${esc(p.image_url)}" loading="lazy" alt="">` : '<i class="bi bi-image"></i>'}</div><div class="b"><div class="n">${esc(p.name)}</div><div class="s">${esc([p.brand, p.size].filter(Boolean).join(' · '))}</div><div class="p">${money(p.price)}</div><div class="st">${p.track_stock ? (out ? 'Out of stock' : p.stock_qty + ' left') : 'Service'}</div></div></button>`; }).join('') : empty('bi-search', 'No products match', 'Try another search or category.');
    $('#grid').querySelectorAll('.pcard').forEach(b => b.onclick = () => add(Number(b.dataset.id)));
  };
  const add = id => {
    const p = products.find(x => x.id === id); if (!p) return;
    const l = cart.find(x => x.id === id);
    if (p.track_stock && p.stock_qty <= 0) return toast('warn', 'Out of stock', p.name);
    if (l) { if (p.track_stock && l.qty >= p.stock_qty) return toast('warn', 'Not enough stock', `Only ${p.stock_qty} of ${p.name}`); l.qty++; } else cart.push({ id, qty: 1, price: p.price });
    draw();
  };

  /* ---------- money maths (mirrors the server; the server is the authority) ---------- */
  const sub = () => rnd(cart.reduce((s, l) => s + l.price * l.qty, 0));
  const discount = () => canDisc ? Math.max(0, Number($('#disc')?.value) || 0) : 0;
  const maxRedeem = () => { if (!customer || !loyaltyOn || !ptValue) return 0; return Math.max(0, Math.min(customer.loyalty_points || 0, Math.floor((sub() - discount()) / ptValue))); };
  const calc = () => {
    const s = sub(); const d = Math.min(discount(), s); const r = Math.min(redeem, maxRedeem()); const rv = rnd(r * ptValue);
    const taxable = Math.max(0, rnd(s - d - rv)); let tax = 0, total = taxable;
    if (taxRate) { if (taxIncl) tax = rnd(taxable * taxRate / (100 + taxRate)); else { tax = rnd(taxable * taxRate / 100); total = rnd(taxable + tax); } }
    return { s, d, r, rv, tax, total };
  };
  const paidNow = t => (pays.length === 1 && pays[0].amount === '') ? t.total : rnd(pays.reduce((a, p) => a + (Number(p.amount) || 0), 0));

  /* ---------- drawing ---------- */
  const drawCustomer = () => {
    const box = $('#custBox'); if (!box) return;
    box.innerHTML = customer ? `<div class="d-flex align-items-center gap-2 p-2 rounded" style="border:1px solid var(--border)"><span class="avatar"><i class="bi bi-person"></i></span><div class="flex-grow-1"><div class="fw-semibold small">${esc(customer.name)}</div><div class="small muted">${esc(customer.phone || '')}${loyaltyOn ? ` · <b>${num(customer.loyalty_points || 0)}</b> pts` : ''}${Number(customer.balance) > 0 ? ` · <span class="text-danger">owes ${money(customer.balance)}</span>` : ''}</div></div><button class="btn btn-sm btn-soft" id="custX" title="Remove"><i class="bi bi-x-lg"></i></button></div>`
      : '<button class="btn btn-soft w-100" id="custPick"><i class="bi bi-person-plus me-1"></i>Add customer (optional)</button>';
    const x = $('#custX'); if (x) x.onclick = () => { customer = null; redeem = 0; draw(); };
    const pk = $('#custPick'); if (pk) pk.onclick = async () => {
      try { const mod = await import('./customers.js'); await mod.pickCustomer(ctx, { onPick: c => { customer = c; redeem = 0; draw(); } }); }
      catch (e) { fail(new Error('The customer list is not available right now.')); }
    };
  };
  const drawRedeem = () => {
    const box = $('#redeemBox'); const mx = maxRedeem();
    if (!loyaltyOn || !customer || !(customer.loyalty_points > 0) || !ptValue) { box.innerHTML = ''; redeem = 0; return; }
    box.innerHTML = `<label class="form-label">Use points <small class="muted">(1 pt = ${money(ptValue)})</small></label><div class="input-group"><input id="redeem" type="number" min="0" max="${mx}" class="form-control" value="${redeem || ''}" placeholder="max ${mx}"><button class="btn btn-soft" id="redeemMax" type="button">Max</button></div>`;
    $('#redeem').oninput = e => { redeem = Math.max(0, Math.min(mx, parseInt(e.target.value) || 0)); drawTotals(); drawPay(); };
    $('#redeemMax').onclick = () => { redeem = mx; $('#redeem').value = mx; drawTotals(); drawPay(); };
  };
  const drawTotals = () => {
    const t = calc();
    $('#totals').innerHTML = `<div class="total-row"><span>Subtotal</span><span>${money(t.s)}</span></div>${t.d ? `<div class="total-row"><span>Discount</span><span>− ${money(t.d)}</span></div>` : ''}${t.rv ? `<div class="total-row"><span>Points (${num(t.r)})</span><span>− ${money(t.rv)}</span></div>` : ''}${t.tax ? `<div class="total-row"><span>${esc(taxName)} ${taxRate}%${taxIncl ? ' (included)' : ''}</span><span>${taxIncl ? '' : '+ '}${money(t.tax)}</span></div>` : ''}<div class="total-row big"><span>Total</span><span>${money(t.total)}</span></div>${loyaltyOn && customer && S.loyalty_spend_per_point ? `<div class="small muted text-end">Earns ${num(Math.floor(t.total / (Number(S.loyalty_spend_per_point) || 1000)))} points</div>` : ''}`;
  };
  const drawPay = () => {
    const t = calc(); const paid = paidNow(t); const due = rnd(t.total - paid); const split = pays.length > 1;
    const short = due > 0.009; const over = due < -0.009;
    $('#paySec').innerHTML = `<label class="form-label d-flex justify-content-between"><span>Payment</span>${t.total > 0 ? `<a href="#" id="split" class="small">${split ? '' : '+ Split / part-pay'}</a>` : ''}</label>
      ${pays.map((p, i) => `<div class="input-group mb-2"><select class="form-select" data-pm="${i}" style="max-width:150px">${PAYKEYS.map(k => `<option value="${k}" ${p.method === k ? 'selected' : ''}>${PAY[k][0]}</option>`).join('')}</select><input type="number" min="0" class="form-control" data-pa="${i}" value="${p.amount}" placeholder="${pays.length === 1 ? 'Full amount' : 'Amount'}">${pays.length > 1 ? `<button class="btn btn-soft" data-px="${i}"><i class="bi bi-x"></i></button>` : ''}</div>`).join('')}
      ${(split || pays[0].amount !== '') ? `<div class="d-flex justify-content-between small"><span>Paid <b>${money(paid)}</b></span><span class="${short ? 'text-danger' : over ? 'text-danger' : 'text-success'}">${short ? 'Balance due ' + money(due) : over ? 'Over by ' + money(-due) : 'Fully paid'}</span></div>` : ''}
      ${short ? `<div class="small mt-1 ${canCredit && customer ? 'text-warning' : 'text-danger'}">${!canCredit ? 'Credit sales are not allowed for you.' : !customer ? 'Choose the customer to sell on credit.' : 'This sale will be recorded as owed by ' + esc(customer.name) + '.'}</div>` : ''}`;
    const sp = $('#split'); if (sp) sp.onclick = e => { e.preventDefault(); if (pays.length === 1 && pays[0].amount === '') pays[0].amount = t.total; pays.push({ method: 'mobile_money', amount: '' }); drawPay(); };
    $('#paySec').querySelectorAll('[data-pm]').forEach(s => s.onchange = () => { pays[+s.dataset.pm].method = s.value; });
    $('#paySec').querySelectorAll('[data-pa]').forEach(i => i.oninput = () => { pays[+i.dataset.pa].amount = i.value; drawPayStatusOnly(); });
    $('#paySec').querySelectorAll('[data-px]').forEach(b => b.onclick = () => { pays.splice(+b.dataset.px, 1); if (pays.length === 1 && Number(pays[0].amount) === calc().total) pays[0].amount = ''; drawPay(); });
    updateBtn();
  };
  const drawPayStatusOnly = debounce(() => { const act = document.activeElement; const idx = act && act.dataset ? act.dataset.pa : null; drawPay(); if (idx !== null && idx !== undefined) { const n = $(`[data-pa="${idx}"]`); if (n) { n.focus(); n.setSelectionRange?.(n.value.length, n.value.length); } } }, 350);
  const updateBtn = () => {
    const t = calc(); const paid = paidNow(t); const due = rnd(t.total - paid); const b = $('#pay-btn');
    const blocked = !cart.length || due < -0.009 || (due > 0.009 && !(canCredit && customer));
    b.disabled = blocked;
  };
  const draw = () => {
    $('#lines').innerHTML = cart.length ? cart.map(l => { const p = products.find(x => x.id === l.id); return `<div class="cart-line"><div><div class="fw-semibold small">${esc(p.name)}</div><div class="small muted">${canPrice ? `<input type="number" min="0" class="form-control form-control-sm d-inline-block" style="width:110px" data-price="${l.id}" value="${l.price}">` : money(l.price)}</div></div>
      <div class="text-end"><div class="qty"><button data-m="${l.id}">−</button><input value="${l.qty}" data-q="${l.id}" inputmode="numeric"><button data-p="${l.id}">+</button></div><div class="fw-bold small mt-1">${money(l.price * l.qty)}</div></div></div>`; }).join('') : empty('bi-cart', 'Cart is empty', 'Pick products or scan a barcode.');
    drawCustomer(); drawRedeem(); drawTotals(); drawPay();
    $('#lines').querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const l = cart.find(x => x.id == b.dataset.m); l.qty--; if (l.qty < 1) cart = cart.filter(x => x !== l); draw(); });
    $('#lines').querySelectorAll('[data-p]').forEach(b => b.onclick = () => add(Number(b.dataset.p)));
    $('#lines').querySelectorAll('[data-q]').forEach(i => i.onchange = () => { const l = cart.find(x => x.id == i.dataset.q); const p = products.find(x => x.id === l.id); let n = Math.max(1, parseInt(i.value) || 1); if (p.track_stock && n > p.stock_qty) { n = p.stock_qty; toast('warn', 'Limited stock', `Only ${n} available`); } l.qty = n; draw(); });
    $('#lines').querySelectorAll('[data-price]').forEach(i => i.onchange = () => { cart.find(x => x.id == i.dataset.price).price = Math.max(0, Number(i.value) || 0); draw(); });
    holdUi();
  };

  /* ---------- hold / resume ---------- */
  const holdUi = () => { const n = holds().length; $('#holdN').textContent = n; $('#resumeBtn').style.display = n ? '' : 'none'; $('#holdBtn').disabled = !cart.length; };
  $('#holdBtn').onclick = () => {
    if (!cart.length) return;
    const h = holds(); h.unshift({ at: Date.now(), cart, customer, redeem, disc: $('#disc')?.value || '', notes: $('#notes').value }); saveHolds(h);
    toast('info', 'Sale put on hold', 'Resume it from “Held”.'); reset(); 
  };
  $('#resumeBtn').onclick = () => {
    const h = holds(); if (!h.length) return;
    const m = openModal({ title: 'Held sales', size: 'modal-sm', body: h.map((x, i) => `<div class="feed-item"><div class="flex-grow-1"><div class="fw-semibold small">${x.cart.length} item(s) · ${money(x.cart.reduce((s, l) => s + l.price * l.qty, 0))}</div><div class="small muted">${new Date(x.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${x.customer ? ' · ' + esc(x.customer.name) : ''}</div></div><button class="btn btn-sm btn-fb" data-r="${i}">Resume</button><button class="btn btn-sm btn-danger-soft" data-d="${i}"><i class="bi bi-trash"></i></button></div>`).join('') });
    m.el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
      const x = h[+b.dataset.r]; if (cart.length && !confirm('Replace the current sale with the held one?')) return;
      cart = x.cart.filter(l => products.some(p => p.id === l.id)); customer = x.customer || null; redeem = x.redeem || 0; pays = [{ method: 'cash', amount: '' }];
      h.splice(+b.dataset.r, 1); saveHolds(h); draw(); if ($('#disc')) $('#disc').value = x.disc || ''; $('#notes').value = x.notes || ''; drawTotals(); drawPay(); m.close();
    });
    m.el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { h.splice(+b.dataset.d, 1); saveHolds(h); m.close(); holdUi(); });
  };
  const reset = () => { cart = []; customer = null; redeem = 0; pays = [{ method: 'cash', amount: '' }]; ['#cName', '#cPhone', '#notes', '#disc'].forEach(s => { if ($(s)) $(s).value = ''; }); if ($('#saleDate')) { $('#saleDate').value = todayStr(); if ($('#backdateHint')) $('#backdateHint').style.display = 'none'; } draw(); };

  /* ---------- barcode scanning ---------- */
  const scanCode = async code => {
    code = String(code || '').trim(); if (!code) return;
    const local = products.find(p => p.barcode === code || p.sku === code.toUpperCase());
    try { const p = local || await get('/b/products/by-code/' + encodeURIComponent(code)); if (!products.some(x => x.id === p.id)) products.push(p); add(p.id); toast('success', 'Scanned', p.name, 1500); }
    catch (e) { toast('warn', 'Unknown code', code); }
  };
  let buf = '', last = 0;
  const onKey = e => {
    if (!el.isConnected) return document.removeEventListener('keydown', onKey, true);
    const t = e.target; const typing = t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t.id !== 'q';
    const now = Date.now(); if (now - last > 60) buf = ''; last = now;
    if (e.key === 'Enter') { if (buf.length >= 4) { e.preventDefault(); const c = buf; buf = ''; if (t && t.id === 'q') { $('#q').value = ''; search = ''; grid(); } scanCode(c); } buf = ''; return; }
    if (e.key.length === 1 && !typing) buf += e.key; else if (e.key.length === 1 && t.id === 'q') buf += e.key;
  };
  document.addEventListener('keydown', onKey, true); const prev = ctx.cleanup; ctx.cleanup = () => { document.removeEventListener('keydown', onKey, true); if (prev) prev(); };
  const cam = $('#cam');
  if (cam) cam.onclick = async () => {
    let stream, stop = false; const det = new window.BarcodeDetector();
    const m = openModal({ title: 'Scan barcode', body: '<video id="vid" playsinline muted style="width:100%;border-radius:12px;background:#000"></video><div class="small muted mt-2">Point the camera at the barcode.</div>', footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Close</button>' });
    m.el.addEventListener('hidden.bs.modal', () => { stop = true; if (stream) stream.getTracks().forEach(t => t.stop()); });
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); const v = m.el.querySelector('#vid'); v.srcObject = stream; await v.play();
      const loop = async () => { if (stop) return; try { const r = await det.detect(v); if (r.length) { await scanCode(r[0].rawValue); await new Promise(res => setTimeout(res, 1200)); } } catch { /* keep scanning */ } requestAnimationFrame(loop); };
      loop();
    } catch { m.close(); fail(new Error('Could not open the camera. Allow camera access and try again.')); }
  };

  /* ---------- events ---------- */
  $('#q').oninput = debounce(e => { search = e.target.value; grid(); }, 150);
  $('#clear').onclick = reset;
  if ($('#disc')) $('#disc').oninput = () => { drawRedeem(); drawTotals(); drawPay(); };
  $('#pay-btn').onclick = async () => {
    const btn = $('#pay-btn'); btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving…';
    const t = calc(); const body = { items: cart.map(l => ({ product_id: l.id, qty: l.qty, unit_price: l.price })), discount: canDisc ? Number($('#disc').value) || 0 : 0, notes: $('#notes').value };
    if (customer) body.customer_id = customer.id; else if (!useCust) { body.customer_name = $('#cName').value; body.customer_phone = $('#cPhone').value; }
    if (t.r > 0) body.redeem_points = t.r;
    if (pays.length === 1 && pays[0].amount === '') body.payment_method = pays[0].method; else body.payments = pays.filter(p => Number(p.amount) > 0).map(p => ({ method: p.method, amount: Number(p.amount) }));
    if (canBackdate && $('#saleDate') && $('#saleDate').value) body.sale_date = $('#saleDate').value;
    try {
      const r = await post('/b/sales', body);
      ok('Sale complete 🎉', `${r.receipt_no} · ${money(r.total)}${r.balance_due > 0 ? ' · owed ' + money(r.balance_due) : ''}`);
      showReceipt(r.id, ctx); reset();
      const fresh = await get('/b/products', { limit: 500, status: 'active' }); products = fresh.rows; grid(); draw();
    } catch (e) { fail(e); if (e.status === 409) { const fresh = await get('/b/products', { limit: 500, status: 'active' }); products = fresh.rows; grid(); } }
    btn.innerHTML = '<i class="bi bi-check2-circle me-1"></i>Complete sale'; updateBtn();
  };
  ctx.on('product.changed', debounce(async () => { const f = await get('/b/products', { limit: 500, status: 'active' }); products = f.rows; grid(); }, 800));
  chips(); grid(); draw();
}

/* ---------------- receipt (screen + 80mm thermal print) ---------------- */
const PRINT_CSS = `@media print{@page{size:80mm auto;margin:0}body *{visibility:hidden}#rc,#rc *{visibility:visible}#rc{position:absolute;left:0;top:0;width:72mm!important;max-width:72mm!important;margin:0!important;padding:3mm!important;border-radius:0!important;font-size:11px!important;box-shadow:none!important}.modal-backdrop{display:none!important}}`;
export async function showReceipt(id, ctx) {
  if (!document.getElementById('rcPrintCss')) { const st = document.createElement('style'); st.id = 'rcPrintCss'; st.textContent = PRINT_CSS; document.head.appendChild(st); }
  const s = await get('/b/sales/' + id); const b = ctx.biz; const st = b.settings || {}; const cur = esc(b.currency);
  const pays = (s.payments || []).filter(p => Number(p.amount) > 0);
  const payHtml = pays.length ? pays.map(p => `<div class="r"><span>${esc(p.method === 'credit_note' ? 'Exchange credit' : (PAY[p.method] || [p.method])[0])}</span><span>${num(p.amount)}</span></div>`).join('') : `<div class="r"><span>Paid by</span><span>${(PAY[s.payment_method] || [s.payment_method])[0]}</span></div>`;
  const due = Number(s.balance_due) || 0;
  const m = openModal({ title: 'Receipt', size: 'modal-sm', body: `<div class="receipt" id="rc"><div style="text-align:center"><b style="font-size:1.1em">${esc(b.name)}</b><br>${esc(b.tagline || '')}<br>${esc([st.location, st.address].filter(Boolean).join(', '))}<br>${esc(st.phone || '')}${st.tin ? `<br>TIN: ${esc(st.tin)}` : ''}</div><hr>
    <div class="r"><span>Receipt</span><b>${esc(s.receipt_no)}</b></div><div class="r"><span>Date</span><span>${fmtDateTime(s.sold_at)}</span></div><div class="r"><span>Served by</span><span>${esc(s.seller)}</span></div>${s.customer_name ? `<div class="r"><span>Customer</span><span>${esc(s.customer_name)}</span></div>` : ''}<hr>
    ${s.items.map(i => `<div>${esc(i.name)}</div><div class="r"><span>${i.qty} × ${num(i.unit_price)}</span><span>${num(i.line_total)}</span></div>`).join('')}<hr>
    <div class="r"><span>Subtotal</span><span>${num(s.subtotal)}</span></div>${s.discount ? `<div class="r"><span>Discount${s.points_redeemed ? ` (incl. ${s.points_redeemed} pts)` : ''}</span><span>-${num(s.discount)}</span></div>` : ''}${Number(s.tax_amount) ? `<div class="r"><span>${esc(st.tax_name || 'Tax')} ${st.tax_rate_pct ? st.tax_rate_pct + '%' : ''}${st.tax_inclusive === false ? '' : ' (incl.)'}</span><span>${num(s.tax_amount)}</span></div>` : ''}<div class="r"><b>TOTAL ${cur}</b><b>${num(s.total)}</b></div><hr>
    ${payHtml}${due > 0 ? `<div class="r"><b>BALANCE DUE</b><b>${num(due)}</b></div>` : ''}${(s.refunds || []).length ? `<hr>${s.refunds.map(r => `<div class="r"><span>${r.type === 'exchange' ? 'Exchange' : 'Refund'} ${esc(r.refund_no)}</span><span>-${num(r.amount)}</span></div>`).join('')}` : ''}
    ${s.points_earned || s.points_redeemed ? `<hr><div class="r"><span>Points earned</span><span>${num(s.points_earned || 0)}</span></div>` : ''}
    <hr><div style="text-align:center">${esc(st.receipt_footer || 'Thank you for shopping with us!')}</div></div>`,
    footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Close</button><button class="btn btn-fb" id="prt"><i class="bi bi-printer me-1"></i>Print</button>' });
  m.el.querySelector('#prt').onclick = () => window.print();
}
