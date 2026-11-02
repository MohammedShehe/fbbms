// Suppliers, purchase orders (create / edit draft / place / receive / cancel), supplier payments and payables.
import { get, post, put } from '../api.js';
import { esc, money, num, fmtDate, openModal, confirmBox, fail, ok, pill, empty, skeleton, debounce, downloadCSV, PAY, payLabel, todayEAT } from '../ui.js';
import { exportButtons } from '../export.js';

const PO_STATUS = { draft: ['Draft', ''], ordered: ['Ordered', 'info'], partial: ['Part-received', 'warning'], received: ['Received', 'success'], cancelled: ['Cancelled', 'danger'] };
const poPill = s => { const [t, k] = PO_STATUS[s] || [s, '']; return pill(t, k); };
const pickPay = (id = 'pm') => `<select class="form-select" id="${id}">${Object.entries(PAY).map(([k, v]) => `<option value="${k}">${esc(v[0])}</option>`).join('')}</select>`;

export async function render(el, ctx) {
  const can = ctx.can('suppliers.manage');
  const st = { tab: 'suppliers', q: '', status: 'active', poStatus: '' };
  let suppliers = [], pos = [], payables = null, products = null;
  const cur = ctx.biz.currency;

  el.innerHTML = `<div class="page-head"><div><h1>Suppliers & purchases</h1><p>Who you buy from, what you ordered, what arrived and what you still owe.</p></div>
    <div class="d-flex gap-2 flex-wrap" id="hdr"><span class="d-flex gap-2" id="exp"></span>${can ? '<button class="btn btn-soft" id="addSup"><i class="bi bi-person-plus me-1"></i>Supplier</button><button class="btn btn-fb" id="addPo"><i class="bi bi-plus-lg me-1"></i>Purchase order</button>' : ''}</div></div>
    <div id="kpis" class="row g-3 mb-3"></div>
    <div class="chips mb-3" id="tabs"><span class="chip" data-t="suppliers">Suppliers</span><span class="chip" data-t="pos">Purchase orders</span><span class="chip" data-t="payables">Payables</span></div>
    <div id="body">${skeleton(5, 24)}</div>`;
  const $ = s => el.querySelector(s);

  const loadProducts = async () => { if (!products) { const r = await get('/b/products', { limit: 500, status: 'active' }); products = r.rows.filter(p => p.track_stock); } return products; };
  const loadAll = async () => {
    [suppliers, pos, payables] = await Promise.all([get('/b/suppliers', { status: st.status }), get('/b/purchase-orders', st.poStatus ? { status: st.poStatus } : {}), get('/b/payables')]);
    kpis(); draw();
  };
  const kpis = () => {
    const open = pos.filter(p => ['ordered', 'partial'].includes(p.status)).length;
    $('#kpis').innerHTML = [['Total owed to suppliers', money(payables.total), 'var(--danger)'], ['Suppliers owed', payables.rows.length, 'var(--primary)'], ['Open orders', open, 'var(--info,#56a8ff)'], ['Active suppliers', suppliers.filter(s => s.status === 'active').length, 'var(--success)']]
      .map(([l, v, c]) => `<div class="col-6 col-lg-3"><div class="kpi" style="--c:${c}"><div class="lbl">${l}</div><div class="val">${v}</div></div></div>`).join('');
  };
  const tabs = () => $('#tabs').querySelectorAll('.chip').forEach(c => { c.classList.toggle('active', c.dataset.t === st.tab); c.onclick = () => { st.tab = c.dataset.t; draw(); }; });

  /* ---------- export (changes with the tab) ---------- */
  const exportData = () => {
    if (st.tab === 'pos') return { filename: 'purchase-orders', title: 'Purchase orders', columns: ['PO', 'Supplier', 'Status', 'Ordered total', 'Received value', 'Paid', 'Created'], rows: pos.map(p => [p.po_no, p.supplier_name, p.status, p.total, p.received_value, p.paid, fmtDate(p.created_at)]) };
    if (st.tab === 'payables') return { filename: 'supplier-payables', title: 'Supplier payables', subtitle: `Total owed: ${money(payables.total)}`, columns: ['Supplier', 'Phone', 'Balance owed'], rows: payables.rows.map(r => [r.name, r.phone || '', r.balance]) };
    return { filename: 'suppliers', title: 'Suppliers', columns: ['Supplier', 'Contact', 'Phone', 'Orders', 'Total purchased', 'Balance owed', 'Last received'], rows: suppliers.map(s => [s.name, s.contact_person || '', s.phone || '', s.po_count, s.total_purchased, s.balance, s.last_received ? fmtDate(s.last_received) : '']) };
  };
  $('#exp').innerHTML = '<button class="btn btn-soft" id="csv"><i class="bi bi-download me-1"></i>CSV</button>';
  $('#csv').onclick = () => { const d = exportData(); downloadCSV(d.filename + '.csv', [d.columns, ...d.rows]); };
  exportButtons($('#exp'), async () => exportData());

  /* ---------- tabs ---------- */
  const draw = () => {
    tabs(); const b = $('#body');
    if (st.tab === 'suppliers') drawSuppliers(b); else if (st.tab === 'pos') drawPos(b); else drawPayables(b);
  };

  function drawSuppliers(b) {
    b.innerHTML = `<div class="filters"><div class="search"><i class="bi bi-search"></i><input id="q" class="form-control" placeholder="Search supplier, phone or contact…" value="${esc(st.q)}"></div>
      <select id="sf" class="form-select"><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></select></div>
      <div class="tbl-wrap"><table class="fb-table stack"><thead><tr><th>Supplier</th><th>Phone</th><th class="num">Orders</th><th class="num">Purchased</th><th class="num">We owe</th><th>Last delivery</th><th></th></tr></thead><tbody id="r"></tbody></table></div>`;
    b.querySelector('#sf').value = st.status;
    const rows = () => { const s = st.q.toLowerCase(); const list = suppliers.filter(x => !s || (x.name + ' ' + (x.phone || '') + ' ' + (x.contact_person || '')).toLowerCase().includes(s));
      b.querySelector('#r').innerHTML = list.length ? list.map(x => `<tr class="${x.status === 'archived' ? 'voided' : ''}"><td data-label="Supplier"><b>${esc(x.name)}</b>${x.contact_person ? `<br><small class="muted">${esc(x.contact_person)}</small>` : ''}</td><td data-label="Phone">${esc(x.phone || '—')}</td><td class="num" data-label="Orders">${num(x.po_count)}</td><td class="num" data-label="Purchased">${money(x.total_purchased)}</td><td class="num" data-label="We owe">${x.balance > 0.009 ? `<b class="text-danger">${money(x.balance)}</b>` : money(0)}</td><td data-label="Last delivery">${x.last_received ? fmtDate(x.last_received) : '—'}</td>
        <td class="text-end"><button class="btn btn-sm btn-soft" data-v="${x.id}">Open</button></td></tr>`).join('') : `<tr><td colspan="7">${empty('bi-truck', 'No suppliers yet', can ? 'Add your first supplier to start raising purchase orders.' : '')}</td></tr>`;
      b.querySelectorAll('[data-v]').forEach(btn => btn.onclick = () => supplierDetail(Number(btn.dataset.v))); };
    rows(); b.querySelector('#q').oninput = debounce(e => { st.q = e.target.value; rows(); }, 150);
    b.querySelector('#sf').onchange = async e => { st.status = e.target.value; suppliers = await get('/b/suppliers', { status: st.status }); rows(); };
  }

  function drawPos(b) {
    b.innerHTML = `<div class="filters"><select id="ps" class="form-select"><option value="">All statuses</option><option value="open">Waiting for stock</option>${Object.entries(PO_STATUS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></div>
      <div class="tbl-wrap"><table class="fb-table stack"><thead><tr><th>PO</th><th>Supplier</th><th>Status</th><th class="num">Ordered</th><th class="num">Received</th><th class="num">Paid</th><th>Expected</th><th></th></tr></thead><tbody>${pos.length ? pos.map(p => `<tr><td data-label="PO"><b>${esc(p.po_no)}</b><br><small class="muted">${fmtDate(p.created_at)} · ${p.line_count} line${p.line_count === 1 ? '' : 's'}</small></td><td data-label="Supplier">${esc(p.supplier_name)}</td><td data-label="Status">${poPill(p.status)}</td><td class="num" data-label="Ordered">${money(p.total)}</td><td class="num" data-label="Received">${money(p.received_value)}</td><td class="num" data-label="Paid">${money(p.paid)}</td><td data-label="Expected">${p.expected_date ? fmtDate(p.expected_date) : '—'}</td><td class="text-end"><button class="btn btn-sm btn-soft" data-o="${p.id}">Open</button></td></tr>`).join('') : `<tr><td colspan="8">${empty('bi-clipboard2', 'No purchase orders', 'Create one to order stock from a supplier.')}</td></tr>`}</tbody></table></div>`;
    b.querySelector('#ps').value = st.poStatus;
    b.querySelector('#ps').onchange = async e => { st.poStatus = e.target.value; pos = await get('/b/purchase-orders', st.poStatus ? { status: st.poStatus } : {}); draw(); };
    b.querySelectorAll('[data-o]').forEach(x => x.onclick = () => poDetail(Number(x.dataset.o)));
  }

  function drawPayables(b) {
    b.innerHTML = `<div class="fb-card mb-3"><h3>Money owed to suppliers</h3><div class="card-sub">Received goods minus payments made. Total <b>${money(payables.total)}</b>.</div></div>
      <div class="tbl-wrap"><table class="fb-table stack"><thead><tr><th>Supplier</th><th>Phone</th><th class="num">Balance owed</th><th></th></tr></thead><tbody>${payables.rows.length ? payables.rows.map(r => `<tr><td data-label="Supplier"><b>${esc(r.name)}</b></td><td data-label="Phone">${esc(r.phone || '—')}</td><td class="num" data-label="Owed"><b class="text-danger">${money(r.balance)}</b></td><td class="text-end">${can ? `<button class="btn btn-sm btn-fb" data-p="${r.id}">Pay</button> ` : ''}<button class="btn btn-sm btn-soft" data-v="${r.id}">Open</button></td></tr>`).join('') : `<tr><td colspan="4">${empty('bi-check2-circle', 'You owe nothing', 'All supplier balances are settled.')}</td></tr>`}</tbody></table></div>`;
    b.querySelectorAll('[data-v]').forEach(x => x.onclick = () => supplierDetail(Number(x.dataset.v)));
    b.querySelectorAll('[data-p]').forEach(x => x.onclick = () => payModal(Number(x.dataset.p)));
  }

  /* ---------- supplier add/edit ---------- */
  function supplierForm(s) {
    const m = openModal({ title: s ? `Edit · ${esc(s.name)}` : 'Add supplier', body: `<div class="row g-3"><div class="col-md-6"><label class="form-label">Name *</label><input class="form-control" id="n" value="${esc(s?.name || '')}"></div><div class="col-md-6"><label class="form-label">Contact person</label><input class="form-control" id="cp" value="${esc(s?.contact_person || '')}"></div>
      <div class="col-md-6"><label class="form-label">Phone</label><input class="form-control" id="ph" inputmode="tel" value="${esc(s?.phone || '')}"></div><div class="col-md-6"><label class="form-label">Email</label><input class="form-control" id="em" type="email" value="${esc(s?.email || '')}"></div>
      <div class="col-12"><label class="form-label">Address</label><input class="form-control" id="ad" value="${esc(s?.address || '')}"></div><div class="col-12"><label class="form-label">Notes</label><textarea class="form-control" id="nt" rows="2">${esc(s?.notes || '')}</textarea></div></div>`,
      footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-fb" id="go">Save</button>' });
    const v = id => m.el.querySelector('#' + id).value;
    m.el.querySelector('#go').onclick = async () => { try { const body = { name: v('n'), contact_person: v('cp'), phone: v('ph'), email: v('em'), address: v('ad'), notes: v('nt') }; if (s) await put('/b/suppliers/' + s.id, body); else await post('/b/suppliers', body); ok('Supplier saved'); m.close(); loadAll(); } catch (e) { fail(e); } };
  }

  /* ---------- supplier detail ---------- */
  async function supplierDetail(id) {
    const m = openModal({ size: 'modal-xl', title: 'Supplier', body: skeleton(5, 30) });
    const draw2 = async () => {
      let s; try { s = await get('/b/suppliers/' + id); } catch (e) { m.close(); return fail(e); }
      const pf = s.performance || {};
      m.el.querySelector('.modal-title').innerHTML = `${esc(s.name)} ${s.status === 'archived' ? pill('Archived') : ''}`;
      m.el.querySelector('.modal-body').innerHTML = `<div class="row g-3 mb-3"><div class="col-md-5"><div class="small muted">${esc(s.contact_person || '')}</div><div>${s.phone ? `<i class="bi bi-telephone me-1"></i>${esc(s.phone)}` : ''} ${s.email ? `<i class="bi bi-envelope ms-2 me-1"></i>${esc(s.email)}` : ''}</div><div class="small muted">${esc(s.address || '')}</div>${s.notes ? `<div class="small mt-2">${esc(s.notes)}</div>` : ''}</div>
        <div class="col-6 col-md-3"><div class="kpi" style="--c:var(--danger)"><div class="lbl">We owe</div><div class="val">${money(s.balance)}</div></div></div>
        <div class="col-6 col-md-4"><div class="small muted">Orders <b>${num(pf.orders || 0)}</b> · fully received <b>${num(pf.fully_received || 0)}</b> · partial <b>${num(pf.partial || 0)}</b><br>Avg delivery <b>${pf.avg_days_to_receive ?? '—'}</b> days · late <b>${num(pf.late || 0)}</b></div></div></div>
        ${can ? `<div class="d-flex flex-wrap gap-2 mb-3"><button class="btn btn-fb btn-sm" id="pay"><i class="bi bi-cash-coin me-1"></i>Record payment</button><button class="btn btn-soft btn-sm" id="newpo"><i class="bi bi-plus-lg me-1"></i>New order</button><button class="btn btn-soft btn-sm" id="ed"><i class="bi bi-pencil me-1"></i>Edit</button><button class="btn btn-soft btn-sm" id="ar">${s.status === 'archived' ? 'Restore' : 'Archive'}</button></div>` : ''}
        <div class="row g-3"><div class="col-lg-7"><h6>Purchase orders</h6><div class="tbl-wrap"><table class="fb-table"><thead><tr><th>PO</th><th>Status</th><th class="num">Received</th><th class="num">Paid</th></tr></thead><tbody>${s.orders.length ? s.orders.map(o => `<tr style="cursor:pointer" data-o="${o.id}"><td>${esc(o.po_no)}<br><small class="muted">${fmtDate(o.created_at)}</small></td><td>${poPill(o.status)}</td><td class="num">${money(o.received_value)}</td><td class="num">${money(o.paid)}</td></tr>`).join('') : '<tr><td colspan="4" class="muted">No orders yet</td></tr>'}</tbody></table></div></div>
        <div class="col-lg-5"><h6>Payments</h6><div class="tbl-wrap"><table class="fb-table"><thead><tr><th>Date</th><th>Method</th><th class="num">Amount</th></tr></thead><tbody>${s.payments.length ? s.payments.map(p => `<tr><td>${fmtDate(p.paid_date)}<br><small class="muted">${esc(p.user_name)}${p.po_no ? ' · ' + esc(p.po_no) : ''}${p.reference ? ' · ' + esc(p.reference) : ''}</small></td><td>${esc(payLabel(p.method))}</td><td class="num">${money(p.amount)}</td></tr>`).join('') : '<tr><td colspan="3" class="muted">No payments yet</td></tr>'}</tbody></table></div></div></div>`;
      const q = x => m.el.querySelector(x);
      m.el.querySelectorAll('[data-o]').forEach(x => x.onclick = () => poDetail(Number(x.dataset.o)));
      if (can) {
        q('#pay').onclick = () => payModal(id, s, async () => { await draw2(); loadAll(); });
        q('#newpo').onclick = () => { m.close(); poForm(null, id); };
        q('#ed').onclick = () => { m.close(); supplierForm(s); };
        q('#ar').onclick = async () => { try { await post(`/b/suppliers/${id}/archive`, { restore: s.status === 'archived' }); ok(s.status === 'archived' ? 'Supplier restored' : 'Supplier archived'); m.close(); loadAll(); } catch (e) { fail(e); } };
      }
    };
    await draw2();
  }

  /* ---------- supplier payment ---------- */
  async function payModal(id, sup, after) {
    if (!sup) sup = await get('/b/suppliers/' + id);
    const open = sup.orders.filter(o => o.status !== 'cancelled' && o.received_value - o.paid > 0.009);
    const m = openModal({ size: 'modal-sm', title: `Pay ${esc(sup.name)}`, body: `<div class="mb-2 small muted">Currently owed: <b>${money(sup.balance)}</b></div>
      <div class="mb-3"><label class="form-label">Amount (${esc(cur)})</label><input class="form-control" id="am" type="number" min="0" step="any" value="${sup.balance > 0 ? sup.balance : ''}"></div>
      <div class="mb-3"><label class="form-label">Method</label>${pickPay()}</div>
      <div class="mb-3"><label class="form-label">For order (optional)</label><select class="form-select" id="po"><option value="">General payment</option>${open.map(o => `<option value="${o.id}">${esc(o.po_no)} · owed ${money(o.received_value - o.paid)}</option>`).join('')}</select></div>
      <div class="mb-3"><label class="form-label">Date</label><input type="date" class="form-control" id="dt" value="${todayEAT()}"></div>
      <div class="mb-3"><label class="form-label">Reference / note</label><input class="form-control" id="rf" maxlength="80"></div>
      <div class="form-check"><input class="form-check-input" type="checkbox" id="ov"><label class="form-check-label small" for="ov">Advance payment (more than owed)</label></div>`,
      footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-fb" id="go">Record payment</button>' });
    const v = x => m.el.querySelector('#' + x);
    v('go').onclick = async () => { try { await post(`/b/suppliers/${id}/payments`, { amount: v('am').value, method: v('pm').value, po_id: v('po').value || undefined, paid_date: v('dt').value, reference: v('rf').value, allow_overpay: v('ov').checked }); ok('Payment recorded'); m.close(); after ? after() : loadAll(); } catch (e) { fail(e); } };
  }

  /* ---------- purchase order form (create / edit draft) ---------- */
  async function poForm(po, supplierId) {
    await loadProducts(); const sups = suppliers.filter(s => s.status === 'active').length ? suppliers.filter(s => s.status === 'active') : await get('/b/suppliers', { status: 'active' });
    if (!sups.length) return fail(new Error('Add a supplier first'));
    let lines = po ? po.items.map(i => ({ product_id: i.product_id, qty: i.qty_ordered, unit_cost: i.unit_cost })) : [{ product_id: '', qty: 1, unit_cost: '' }];
    const m = openModal({ size: 'modal-xl', title: po ? `Edit ${esc(po.po_no)}` : 'New purchase order', body: `<div class="row g-3 mb-3"><div class="col-md-5"><label class="form-label">Supplier *</label><select class="form-select" id="sp" ${po ? 'disabled' : ''}>${sups.map(s => `<option value="${s.id}" ${(po ? po.supplier_id : supplierId) === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div class="col-md-3"><label class="form-label">Expected date</label><input type="date" class="form-control" id="ex" value="${esc(po?.expected_date ? String(po.expected_date).slice(0, 10) : '')}"></div><div class="col-md-4"><label class="form-label">Notes</label><input class="form-control" id="nt" maxlength="500" value="${esc(po?.notes || '')}"></div></div>
      <div id="ln"></div><button class="btn btn-soft btn-sm mt-2" id="addl"><i class="bi bi-plus me-1"></i>Add line</button><div class="text-end fs-5 mt-3">Total <b id="tot"></b></div>`,
      footer: `<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-soft" id="sv">Save as draft</button>${po ? '' : '<button class="btn btn-fb" id="sp2">Save & place order</button>'}` });
    const q = s => m.el.querySelector(s);
    const total = () => lines.reduce((t, l) => t + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0);
    const dl = () => {
      q('#ln').innerHTML = lines.map((l, i) => `<div class="row g-2 align-items-end mb-2"><div class="col-12 col-md-6">${i === 0 ? '<label class="form-label">Product</label>' : ''}<select class="form-select" data-p="${i}"><option value="">Choose product…</option>${products.map(p => `<option value="${p.id}" ${Number(l.product_id) === p.id ? 'selected' : ''}>${esc(p.name)}${p.sku ? ' · ' + esc(p.sku) : ''} (stock ${p.stock_qty})</option>`).join('')}</select></div>
        <div class="col-4 col-md-2">${i === 0 ? '<label class="form-label">Qty</label>' : ''}<input type="number" min="1" class="form-control" data-q="${i}" value="${esc(l.qty)}"></div><div class="col-5 col-md-3">${i === 0 ? '<label class="form-label">Unit cost</label>' : ''}<input type="number" min="0" step="any" class="form-control" data-c="${i}" value="${esc(l.unit_cost)}"></div>
        <div class="col-3 col-md-1 text-end"><button class="btn btn-sm btn-soft" data-x="${i}" ${lines.length < 2 ? 'disabled' : ''}><i class="bi bi-trash"></i></button></div></div>`).join('');
      q('#tot').textContent = money(total());
      q('#ln').querySelectorAll('[data-p]').forEach(s => s.onchange = () => { const l = lines[s.dataset.p]; l.product_id = s.value; const p = products.find(x => x.id === Number(s.value)); if (p && p.cost_price !== undefined && !Number(l.unit_cost)) l.unit_cost = p.cost_price; dl(); });
      q('#ln').querySelectorAll('[data-q]').forEach(s => s.oninput = () => { lines[s.dataset.q].qty = s.value; q('#tot').textContent = money(total()); });
      q('#ln').querySelectorAll('[data-c]').forEach(s => s.oninput = () => { lines[s.dataset.c].unit_cost = s.value; q('#tot').textContent = money(total()); });
      q('#ln').querySelectorAll('[data-x]').forEach(s => s.onclick = () => { lines.splice(s.dataset.x, 1); dl(); });
    };
    dl(); q('#addl').onclick = () => { lines.push({ product_id: '', qty: 1, unit_cost: '' }); dl(); };
    const save = async place => {
      const items = lines.filter(l => l.product_id).map(l => ({ product_id: Number(l.product_id), qty: Number(l.qty), unit_cost: Number(l.unit_cost) || 0 }));
      try { const body = { supplier_id: Number(q('#sp').value), expected_date: q('#ex').value || undefined, notes: q('#nt').value, items };
        if (po) await put('/b/purchase-orders/' + po.id, body); else await post('/b/purchase-orders', { ...body, status: place ? 'ordered' : 'draft' });
        ok(place ? 'Order placed' : 'Order saved'); m.close(); loadAll(); } catch (e) { fail(e); }
    };
    q('#sv').onclick = () => save(false); if (q('#sp2')) q('#sp2').onclick = () => save(true);
  }

  /* ---------- PO detail & actions ---------- */
  async function poDetail(id) {
    const m = openModal({ size: 'modal-lg', title: 'Purchase order', body: skeleton(4, 28) });
    let po; try { po = await get('/b/purchase-orders/' + id); } catch (e) { m.close(); return fail(e); }
    m.el.querySelector('.modal-title').innerHTML = `${esc(po.po_no)} ${poPill(po.status)}`;
    const canRecv = can && ['ordered', 'partial'].includes(po.status);
    m.el.querySelector('.modal-body').innerHTML = `<div class="small muted mb-3">${esc(po.supplier_name)}${po.supplier_phone ? ' · ' + esc(po.supplier_phone) : ''} · created ${fmtDate(po.created_at)}${po.expected_date ? ' · expected ' + fmtDate(po.expected_date) : ''}</div>
      <div class="tbl-wrap"><table class="fb-table"><thead><tr><th>Product</th><th class="num">Ordered</th><th class="num">Received</th><th class="num">Unit cost</th><th class="num">Line total</th></tr></thead><tbody>${po.items.map(i => `<tr><td>${esc(i.name)}${i.sku ? `<br><small class="muted">${esc(i.sku)}</small>` : ''}</td><td class="num">${num(i.qty_ordered)}</td><td class="num">${num(i.qty_received)}</td><td class="num">${money(i.unit_cost)}</td><td class="num">${money(i.qty_ordered * i.unit_cost)}</td></tr>`).join('')}</tbody></table></div>
      <div class="d-flex justify-content-between mt-2"><span>Ordered total</span><b>${money(po.total)}</b></div><div class="d-flex justify-content-between"><span>Received value</span><b>${money(po.received_value)}</b></div>
      ${po.payments.length ? `<hr><h6>Payments</h6>${po.payments.map(p => `<div class="d-flex justify-content-between small"><span>${fmtDate(p.paid_date)} · ${esc(payLabel(p.method))}${p.reference ? ' · ' + esc(p.reference) : ''}</span><b>${money(p.amount)}</b></div>`).join('')}` : ''}
      ${po.notes ? `<hr><div class="small muted">${esc(po.notes)}</div>` : ''}
      ${can ? `<div class="d-flex flex-wrap gap-2 mt-3">${po.status === 'draft' ? '<button class="btn btn-soft btn-sm" id="ed">Edit</button><button class="btn btn-fb btn-sm" id="pl">Place order</button>' : ''}${canRecv ? '<button class="btn btn-fb btn-sm" id="rc"><i class="bi bi-box-arrow-in-down me-1"></i>Receive stock</button>' : ''}${['draft', 'ordered'].includes(po.status) ? '<button class="btn btn-danger-soft btn-sm" id="cn">Cancel order</button>' : ''}</div>` : ''}`;
    const q = s => m.el.querySelector(s);
    if (q('#ed')) q('#ed').onclick = () => { m.close(); poForm(po); };
    if (q('#pl')) q('#pl').onclick = async () => { try { await post(`/b/purchase-orders/${id}/order`); ok('Order placed'); m.close(); loadAll(); } catch (e) { fail(e); } };
    if (q('#cn')) q('#cn').onclick = async () => { const reason = await confirmBox({ title: 'Cancel this order?', message: 'Nothing has been received yet.', confirmText: 'Cancel order', danger: true, input: { label: 'Reason', required: true } }); if (!reason) return; try { await post(`/b/purchase-orders/${id}/cancel`, { reason }); ok('Order cancelled'); m.close(); loadAll(); } catch (e) { fail(e); } };
    if (q('#rc')) q('#rc').onclick = () => { m.close(); receiveModal(po); };
  }

  function receiveModal(po) {
    const items = po.items.filter(i => i.qty_received < i.qty_ordered);
    const m = openModal({ size: 'modal-lg', title: `Receive stock · ${esc(po.po_no)}`, body: `<p class="small muted">Enter what actually arrived. Leave a line at 0 if nothing came. Stock and average cost update automatically; change the unit cost if the invoice differs.</p>
      ${items.map(i => `<div class="row g-2 align-items-end mb-3" data-i="${i.id}"><div class="col-12"><b>${esc(i.name)}</b> <small class="muted">· ordered ${i.qty_ordered}, still expected ${i.qty_ordered - i.qty_received}</small></div>
        <div class="col-4"><label class="form-label small">Received now</label><input type="number" min="0" max="${i.qty_ordered - i.qty_received}" class="form-control" data-q value="${i.qty_ordered - i.qty_received}"></div>
        <div class="col-4"><label class="form-label small">Unit cost</label><input type="number" min="0" step="any" class="form-control" data-c value="${esc(i.unit_cost)}"></div>
        <div class="col-4"><label class="form-label small">Expiry (optional)</label><input type="date" class="form-control" data-e value="${esc(i.expiry_date ? String(i.expiry_date).slice(0, 10) : '')}"></div></div>`).join('')}`,
      footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-fb" id="go">Confirm received</button>' });
    m.el.querySelector('#go').onclick = async () => {
      const lines = [...m.el.querySelectorAll('[data-i]')].map(r => ({ item_id: Number(r.dataset.i), qty: Number(r.querySelector('[data-q]').value) || 0, unit_cost: r.querySelector('[data-c]').value, expiry_date: r.querySelector('[data-e]').value || undefined })).filter(l => l.qty > 0);
      if (!lines.length) return fail(new Error('Enter at least one received quantity'));
      try { const r = await post(`/b/purchase-orders/${po.id}/receive`, { items: lines }); ok(r.status === 'received' ? 'Order fully received' : 'Part delivery recorded', `${num(r.units)} units · ${money(r.value)}`); products = null; m.close(); loadAll(); } catch (e) { fail(e); }
    };
  }

  if (can) { $('#addSup').onclick = () => supplierForm(); $('#addPo').onclick = () => poForm(); }
  ctx.on('product.changed', () => { products = null; });
  await loadAll();
}
