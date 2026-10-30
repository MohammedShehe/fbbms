import { get, post, put } from '../api.js';
import { esc, money, num, openModal, fail, ok, statusPill, pager, debounce, empty, skeleton, pill, fmtDateTime, ago, confirmBox, thumb, PAY, ORDER_STATUS } from '../ui.js';

export async function render(el, ctx) {
  const manage = ctx.can('orders.manage'); const st = { page: 1, limit: 20, status: 'open', q: '' };
  el.innerHTML = `<div class="page-head"><div><h1>Website orders</h1><p>Customers who ordered online. Contact them, confirm, then complete to record the sale and deduct stock.</p></div></div>
    <div class="chips" id="chips"></div><div class="filters"><div class="search"><i class="bi bi-search"></i><input id="q" class="form-control" placeholder="Order no., customer name or phone…"></div></div><div id="list"></div><div class="pager" id="pg"></div>`;
  const $ = s => el.querySelector(s); let counts = [];
  const tabs = () => { const n = s => (counts.find(c => c.status === s) || { n: 0 }).n; const open = n('new') + n('contacted') + n('confirmed');
    $('#chips').innerHTML = [['open', `Open (${open})`], ['new', `New (${n('new')})`], ['contacted', 'Contacted'], ['confirmed', 'Confirmed'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['', 'All']].map(([k, l]) => `<span class="chip ${st.status === k ? 'active' : ''}" data-s="${k}">${l}</span>`).join('');
    $('#chips').querySelectorAll('.chip').forEach(c => c.onclick = () => { st.status = c.dataset.s; st.page = 1; load(); }); };
  const wa = (p, text) => `https://wa.me/${String(p).replace(/\D/g, '').replace(/^0/, '255')}?text=${encodeURIComponent(text)}`;
  const load = async () => {
    $('#list').innerHTML = skeleton(4, 80);
    try {
      const r = await get('/b/orders', st); counts = r.counts; tabs();
      $('#list').innerHTML = r.rows.length ? r.rows.map(o => `<div class="fb-card mb-3 ${o.status === 'new' ? 'border-info' : ''}" style="${o.status === 'new' ? 'border-color:var(--info)' : ''}"><div class="d-flex flex-wrap justify-content-between gap-2">
        <div><div class="fw-bold fs-6">${esc(o.order_no)} ${statusPill(o.status)} ${o.delivery_method === 'delivery' ? pill('Delivery', 'gold') : pill('Pickup')}</div><div class="small muted">${fmtDateTime(o.created_at)} · ${ago(o.created_at)}</div></div><div class="fs-5 fw-bold">${money(o.items_total)}</div></div>
        <div class="row g-3 mt-1"><div class="col-md-5"><div class="fw-semibold"><i class="bi bi-person me-1"></i>${esc(o.customer_name)}</div><div><a href="tel:${esc(o.customer_phone)}"><i class="bi bi-telephone me-1"></i>${esc(o.customer_phone)}</a></div>${o.customer_email ? `<div class="small muted">${esc(o.customer_email)}</div>` : ''}${o.address ? `<div class="small mt-1"><i class="bi bi-geo-alt me-1"></i>${esc(o.address)}${o.city ? ', ' + esc(o.city) : ''}</div>` : ''}${o.notes ? `<div class="small mt-1 fst-italic muted">“${esc(o.notes)}”</div>` : ''}</div>
        <div class="col-md-7">${o.items.map(i => `<div class="d-flex justify-content-between small py-1 border-bottom" style="border-color:var(--border)!important"><span>${i.qty} × ${esc(i.name)}</span><span>${money(i.line_total)}</span></div>`).join('')}</div></div>
        <div class="d-flex flex-wrap gap-2 mt-3 align-items-center"><a class="btn btn-sm btn-soft" href="tel:${esc(o.customer_phone)}"><i class="bi bi-telephone me-1"></i>Call</a><a class="btn btn-sm btn-soft" target="_blank" rel="noopener" href="${wa(o.customer_phone, `Hello ${o.customer_name}, this is ${ctx.biz.short_name} about your order ${o.order_no}.`)}"><i class="bi bi-whatsapp me-1"></i>WhatsApp</a>
          ${manage && !['completed', 'cancelled'].includes(o.status) ? `${o.status === 'new' ? `<button class="btn btn-sm btn-soft" data-st="contacted" data-id="${o.id}"><i class="bi bi-telephone-outbound me-1"></i>Mark contacted</button>` : ''}${o.status !== 'confirmed' ? `<button class="btn btn-sm btn-soft" data-st="confirmed" data-id="${o.id}"><i class="bi bi-check2 me-1"></i>Confirm</button>` : ''}<button class="btn btn-sm btn-fb" data-done="${o.id}"><i class="bi bi-bag-check me-1"></i>Complete & record sale</button><button class="btn btn-sm btn-danger-soft ms-auto" data-cx="${o.id}">Cancel order</button>` : ''}
          ${o.status === 'completed' ? `<span class="small muted">Receipt ${esc(o.receipt_no || '')} · by ${esc(o.handled_by_name || '—')}</span>` : ''}${o.status === 'cancelled' ? `<span class="small muted">Reason: ${esc(o.cancel_reason || '—')}</span>` : ''}</div></div>`).join('') : `<div class="fb-card">${empty('bi-globe2', 'No orders here', 'New website orders appear instantly.')}</div>`;
      pager($('#pg'), r, p => { st.page = p; load(); });
      $('#list').querySelectorAll('[data-st]').forEach(b => b.onclick = async () => { try { await put('/b/orders/' + b.dataset.id, { status: b.dataset.st }); ok('Order updated'); load(); } catch (e) { fail(e); } });
      $('#list').querySelectorAll('[data-cx]').forEach(b => b.onclick = async () => { const reason = await confirmBox({ title: 'Cancel this order?', message: 'The customer is not charged and no stock changes.', confirmText: 'Cancel order', danger: true, input: { label: 'Reason', placeholder: 'e.g. customer unreachable', required: true } }); if (!reason) return; try { await put('/b/orders/' + b.dataset.cx, { status: 'cancelled', cancel_reason: reason }); ok('Order cancelled'); load(); } catch (e) { fail(e); } });
      $('#list').querySelectorAll('[data-done]').forEach(b => b.onclick = () => complete(r.rows.find(o => o.id == b.dataset.done)));
    } catch (e) { $('#list').innerHTML = `<div class="fb-card">${empty('bi-exclamation-triangle', 'Could not load orders', e.message)}</div>`; }
  };
  async function complete(o) {
    const full = await get('/b/orders/' + o.id); const short = full.items.filter(i => i.track_stock && i.stock_qty < i.qty);
    const m = openModal({ title: `Complete ${esc(o.order_no)}`, size: 'modal-sm', body: `${short.length ? `<div class="alert-fb bad mb-3"><i class="bi bi-exclamation-octagon"></i><div>Not enough stock for: ${short.map(i => esc(i.name) + ' (' + i.stock_qty + ' left)').join(', ')}. Restock first.</div></div>` : ''}
      <div class="mb-3 text-center"><div class="muted small">Amount to collect</div><div class="display-6 fw-bold">${money(o.items_total)}</div></div>
      <div class="mb-3"><label class="form-label">Payment received by</label><select class="form-select" id="pm">${Object.entries(PAY).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></div>
      ${ctx.can('sales.discount') ? '<div class="mb-1"><label class="form-label">Discount (optional)</label><input type="number" min="0" class="form-control" id="dc"></div>' : ''}<div class="small muted mt-2">This records the sale under your name and deducts stock.</div>`,
      footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Back</button><button class="btn btn-fb" id="ok">Record sale</button>' });
    m.el.querySelector('#ok').onclick = async () => { try { const r = await post(`/b/orders/${o.id}/complete`, { payment_method: m.el.querySelector('#pm').value, discount: m.el.querySelector('#dc')?.value || 0 }); ok('Order completed 🎉', `${r.receipt_no} · ${money(r.total)}`); m.close(); load(); } catch (e) { fail(e); } };
  }
  $('#q').oninput = debounce(e => { st.q = e.target.value; st.page = 1; load(); }, 350);
  ['order.new', 'order.updated', 'visible'].forEach(e => ctx.on(e, debounce(load, 500)));
  load();
}
