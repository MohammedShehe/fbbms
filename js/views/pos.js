import { get, post } from '../api.js';
import { esc, money, num, openModal, fail, ok, toast, thumb, debounce, empty, skeleton, PAY, fmtDateTime } from '../ui.js';

export async function render(el, ctx) {
  const [cats, prod] = await Promise.all([get('/b/categories'), get('/b/products', { limit: 500, status: 'active' })]);
  let products = prod.rows; let cart = []; let cat = ''; let search = '';
  const canDisc = ctx.can('sales.discount'); const canPrice = ctx.can('sales.price_override'); const maxPct = ctx.isSuper ? 100 : (ctx.biz.settings.max_discount_pct ?? 15);

  el.innerHTML = `<div class="page-head"><div><h1>New sale</h1><p>Tap products to add them. Stock is checked and deducted automatically.</p></div></div>
  <div class="pos"><div><div class="filters"><div class="search"><i class="bi bi-search"></i><input id="q" class="form-control" placeholder="Search name, brand or SKU…" autofocus></div></div>
    <div class="chips" id="chips"></div><div class="pgrid" id="grid"></div></div>
  <div class="cart"><div class="fb-card"><div class="d-flex justify-content-between align-items-center mb-2"><h3 class="m-0"><i class="bi bi-cart3 me-2"></i>Current sale</h3><button class="btn btn-sm btn-soft" id="clear">Clear</button></div>
    <div id="lines"></div><div id="totals" class="mt-2"></div>
    <div class="row g-2 mt-2"><div class="col-6"><label class="form-label">Customer (optional)</label><input id="cName" class="form-control" placeholder="Name"></div><div class="col-6"><label class="form-label">Phone (optional)</label><input id="cPhone" class="form-control" placeholder="07…" inputmode="tel"></div>
      <div class="col-6"><label class="form-label">Payment</label><select id="pay" class="form-select">${Object.entries(PAY).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></div>
      ${canDisc ? `<div class="col-6"><label class="form-label">Discount (${ctx.biz.currency})${ctx.isSuper ? '' : ` · max ${maxPct}%`}</label><input id="disc" type="number" min="0" class="form-control" placeholder="0"></div>` : ''}
      <div class="col-12"><input id="notes" class="form-control" placeholder="Note (optional)" maxlength="200"></div></div>
    <button class="btn btn-fb btn-lg w-100 mt-3" id="pay-btn" disabled><i class="bi bi-check2-circle me-1"></i>Complete sale</button></div></div></div>`;
  const $ = s => el.querySelector(s);

  const chips = () => { $('#chips').innerHTML = `<span class="chip ${cat === '' ? 'active' : ''}" data-c="">All</span>` + cats.filter(c => c.product_count).map(c => `<span class="chip ${cat == c.id ? 'active' : ''}" data-c="${c.id}">${esc(c.name)} <small>${c.product_count}</small></span>`).join(''); $('#chips').querySelectorAll('.chip').forEach(c => c.onclick = () => { cat = c.dataset.c; chips(); grid(); }); };
  const grid = () => {
    const s = search.toLowerCase(); const list = products.filter(p => (!cat || p.category_id == cat) && (!s || (p.name + ' ' + (p.brand || '') + ' ' + p.sku).toLowerCase().includes(s)));
    $('#grid').innerHTML = list.length ? list.map(p => { const out = p.track_stock && p.stock_qty <= 0; return `<button class="pcard ${out ? 'out' : ''}" data-id="${p.id}"><div class="img">${p.image_url ? `<img src="${esc(p.image_url)}" loading="lazy" alt="">` : '<i class="bi bi-image"></i>'}</div><div class="b"><div class="n">${esc(p.name)}</div><div class="p">${money(p.price)}</div><div class="s">${p.track_stock ? (out ? 'Out of stock' : p.stock_qty + ' left') : 'Service'}</div></div></button>`; }).join('') : empty('bi-search', 'No products found');
    $('#grid').querySelectorAll('.pcard').forEach(b => b.onclick = () => add(Number(b.dataset.id)));
  };
  const add = id => { const p = products.find(x => x.id === id); const l = cart.find(x => x.id === id); if (l) { if (p.track_stock && l.qty >= p.stock_qty) return toast('warn', 'Not enough stock', `Only ${p.stock_qty} of ${p.name}`); l.qty++; } else cart.push({ id, qty: 1, price: p.price }); draw(); };
  const sub = () => cart.reduce((s, l) => s + l.price * l.qty, 0);
  const draw = () => {
    $('#lines').innerHTML = cart.length ? cart.map(l => { const p = products.find(x => x.id === l.id); return `<div class="cart-line"><div><div class="fw-semibold small">${esc(p.name)}</div><div class="small muted">${canPrice ? `<input type="number" min="0" class="form-control form-control-sm d-inline-block" style="width:110px" data-price="${l.id}" value="${l.price}">` : money(l.price)}</div></div>
      <div class="text-end"><div class="qty"><button data-m="${l.id}">−</button><input value="${l.qty}" data-q="${l.id}" inputmode="numeric"><button data-p="${l.id}">+</button></div><div class="fw-bold small mt-1">${money(l.price * l.qty)}</div></div></div>`; }).join('') : empty('bi-cart', 'Cart is empty', 'Pick products on the left.');
    const d = canDisc ? Math.max(0, Number($('#disc')?.value) || 0) : 0; const s = sub();
    $('#totals').innerHTML = `<div class="total-row"><span>Subtotal</span><span>${money(s)}</span></div>${d ? `<div class="total-row"><span>Discount</span><span>− ${money(d)}</span></div>` : ''}<div class="total-row big"><span>Total</span><span>${money(Math.max(0, s - d))}</span></div>`;
    $('#pay-btn').disabled = !cart.length;
    $('#lines').querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const l = cart.find(x => x.id == b.dataset.m); l.qty--; if (l.qty < 1) cart = cart.filter(x => x !== l); draw(); });
    $('#lines').querySelectorAll('[data-p]').forEach(b => b.onclick = () => add(Number(b.dataset.p)));
    $('#lines').querySelectorAll('[data-q]').forEach(i => i.onchange = () => { const l = cart.find(x => x.id == i.dataset.q); const p = products.find(x => x.id === l.id); let n = Math.max(1, parseInt(i.value) || 1); if (p.track_stock && n > p.stock_qty) { n = p.stock_qty; toast('warn', 'Limited stock', `Only ${n} available`); } l.qty = n; draw(); });
    $('#lines').querySelectorAll('[data-price]').forEach(i => i.onchange = () => { cart.find(x => x.id == i.dataset.price).price = Math.max(0, Number(i.value) || 0); draw(); });
  };
  $('#q').oninput = debounce(e => { search = e.target.value; grid(); }, 150);
  $('#clear').onclick = () => { cart = []; draw(); };
  $('#disc') && ($('#disc').oninput = draw);
  $('#pay-btn').onclick = async () => {
    const btn = $('#pay-btn'); btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving…';
    try {
      const r = await post('/b/sales', { items: cart.map(l => ({ product_id: l.id, qty: l.qty, unit_price: l.price })), customer_name: $('#cName').value, customer_phone: $('#cPhone').value, payment_method: $('#pay').value, discount: canDisc ? Number($('#disc').value) || 0 : 0, notes: $('#notes').value });
      ok('Sale complete 🎉', `${r.receipt_no} · ${money(r.total)}`);
      showReceipt(r.id, ctx); cart = []; ['#cName', '#cPhone', '#notes', '#disc'].forEach(s => { if ($(s)) $(s).value = ''; });
      const fresh = await get('/b/products', { limit: 500, status: 'active' }); products = fresh.rows; grid(); draw();
    } catch (e) { fail(e); if (e.status === 409) { const fresh = await get('/b/products', { limit: 500, status: 'active' }); products = fresh.rows; grid(); } }
    btn.innerHTML = '<i class="bi bi-check2-circle me-1"></i>Complete sale'; btn.disabled = !cart.length;
  };
  ctx.on('product.changed', debounce(async () => { const f = await get('/b/products', { limit: 500, status: 'active' }); products = f.rows; grid(); }, 800));
  chips(); grid(); draw();
}

export async function showReceipt(id, ctx) {
  const s = await get('/b/sales/' + id); const b = ctx.biz; const st = b.settings;
  const m = openModal({ title: 'Receipt', size: 'modal-sm', body: `<div class="receipt" id="rc"><div style="text-align:center"><b style="font-size:1.1em">${esc(b.name)}</b><br>${esc(b.tagline || '')}<br>${esc([st.location, st.address].filter(Boolean).join(', '))}<br>${esc(st.phone || '')}</div><hr>
    <div class="r"><span>Receipt</span><b>${esc(s.receipt_no)}</b></div><div class="r"><span>Date</span><span>${fmtDateTime(s.sold_at)}</span></div><div class="r"><span>Served by</span><span>${esc(s.seller)}</span></div>${s.customer_name ? `<div class="r"><span>Customer</span><span>${esc(s.customer_name)}</span></div>` : ''}<hr>
    ${s.items.map(i => `<div>${esc(i.name)}</div><div class="r"><span>${i.qty} × ${num(i.unit_price)}</span><span>${num(i.line_total)}</span></div>`).join('')}<hr>
    <div class="r"><span>Subtotal</span><span>${num(s.subtotal)}</span></div>${s.discount ? `<div class="r"><span>Discount</span><span>-${num(s.discount)}</span></div>` : ''}<div class="r"><b>TOTAL ${esc(b.currency)}</b><b>${num(s.total)}</b></div><div class="r"><span>Paid by</span><span>${(PAY[s.payment_method] || [s.payment_method])[0]}</span></div>${s.status === 'voided' ? '<div style="text-align:center;color:#c00"><b>*** VOIDED ***</b></div>' : ''}<hr><div style="text-align:center">Thank you for shopping with us!<br>${esc(st.website || '')}</div></div>`,
    footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Close</button><button class="btn btn-fb" id="prt"><i class="bi bi-printer me-1"></i>Print</button>' });
  m.el.querySelector('#prt').onclick = () => window.print();
}
