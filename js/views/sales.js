import { get, post } from '../api.js';
import { esc, money, num, fmtDateTime, pill, payLabel, pager, debounce, empty, fail, ok, confirmBox, PAY, downloadCSV, todayEAT, addDays, skeleton } from '../ui.js';
import { showReceipt } from './pos.js';

export async function render(el, ctx) {
  const all = ctx.can('sales.view_all'); const st = { page: 1, limit: 25, from: addDays(todayEAT(), -29), to: todayEAT(), q: '', payment: '', status: '', source: '', seller: '', sort: '' };
  const team = ctx.isSuper ? await get('/b/team').catch(() => []) : [];
  el.innerHTML = `<div class="page-head"><div><h1>Sales</h1><p>${all ? 'Every sale in this shop' : 'Your sales'} — receipts are permanent; mistakes are voided, never deleted.</p></div><div class="d-flex gap-2"><button class="btn btn-soft" id="csv"><i class="bi bi-download me-1"></i>Export CSV</button>${ctx.can('sales.create') ? '<a href="#/pos" class="btn btn-fb"><i class="bi bi-plus-lg me-1"></i>New sale</a>' : ''}</div></div>
  <div class="row g-3 mb-3" id="sum"></div>
  <div class="filters"><div class="search"><i class="bi bi-search"></i><input class="form-control" id="q" placeholder="Receipt, customer, phone or item…"></div>
    <input type="date" class="form-control" id="from" value="${st.from}"><input type="date" class="form-control" id="to" value="${st.to}">
    <select class="form-select" id="payment"><option value="">All payments</option>${Object.entries(PAY).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select>
    <select class="form-select" id="status"><option value="">All statuses</option><option value="completed">Completed</option><option value="voided">Voided</option></select>
    <select class="form-select" id="source"><option value="">All sources</option><option value="pos">In-shop</option><option value="website">Website</option></select>
    ${all && team.length ? `<select class="form-select" id="seller"><option value="">All sellers</option>${team.map(t => `<option value="${t.user_id}">${esc(t.name)}</option>`).join('')}</select>` : ''}
    <select class="form-select" id="sort"><option value="">Newest</option><option value="oldest">Oldest</option><option value="highest">Highest</option><option value="lowest">Lowest</option></select></div>
  <div class="tbl-wrap"><table class="fb-table stack"><thead><tr><th>Receipt</th><th>Date & time</th><th>Items</th><th>Customer</th>${all ? '<th>Seller</th>' : ''}<th>Payment</th><th class="num">Total</th><th></th></tr></thead><tbody id="rows"></tbody></table></div><div class="pager" id="pg"></div>`;
  const $ = s => el.querySelector(s); let last = null;
  const load = async () => {
    $('#rows').innerHTML = `<tr><td colspan="9">${skeleton(5, 22)}</td></tr>`;
    try {
      const r = await get('/b/sales', st); last = r; const s = r.summary;
      $('#sum').innerHTML = [['Revenue', money(s.revenue), 'bi-cash-stack', 'var(--primary)', `${num(s.completed)} completed sales`], ['Discounts given', money(s.discounts), 'bi-percent', '#b07cff', 'in this period'], s.profit !== undefined ? ['Profit', money(s.profit), 'bi-graph-up-arrow', 'var(--success)', 'after cost of goods'] : null, ['Voided', num(s.voided), 'bi-x-octagon', 'var(--danger)', money(s.voided_value) + ' reversed']].filter(Boolean)
        .map(([l, v, i, c, sub]) => `<div class="col-6 col-lg-3"><div class="kpi" style="--c:${c}"><div class="ico"><i class="bi ${i}"></i></div><div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${sub}</div></div></div>`).join('');
      $('#rows').innerHTML = r.rows.length ? r.rows.map(s => `<tr class="${s.status === 'voided' ? 'voided' : ''}"><td data-label="Receipt"><b>${esc(s.receipt_no)}</b> ${s.source === 'website' ? pill('Web', 'info') : ''}</td><td data-label="When">${fmtDateTime(s.sold_at)}</td><td data-label="Items" style="max-width:240px"><div class="text-truncate">${esc(s.item_names)}</div><small class="muted">${num(s.units)} unit(s)</small></td><td data-label="Customer">${esc(s.customer_name || '—')}</td>${all ? `<td data-label="Seller">${esc(s.seller)}</td>` : ''}<td data-label="Payment">${payLabel(s.payment_method)}</td><td class="num" data-label="Total"><b>${money(s.total)}</b>${s.discount ? `<br><small class="muted keep">−${num(s.discount)} disc.</small>` : ''}</td>
        <td class="nolabel keep"><div class="d-flex gap-1 justify-content-end"><button class="btn btn-sm btn-soft" data-r="${s.id}" title="Receipt"><i class="bi bi-receipt"></i></button>${ctx.can('sales.void') && s.status === 'completed' ? `<button class="btn btn-sm btn-danger-soft" data-v="${s.id}" data-n="${esc(s.receipt_no)}" title="Void"><i class="bi bi-x-octagon"></i></button>` : s.status === 'voided' ? `<span class="keep" title="${esc(s.void_reason || '')}">${pill('Voided', 'danger')}</span>` : ''}</div></td></tr>`).join('') : `<tr><td colspan="9">${empty('bi-receipt', 'No sales found', 'Try a wider date range or different filters.')}</td></tr>`;
      $('#rows').querySelectorAll('[data-r]').forEach(b => b.onclick = () => showReceipt(b.dataset.r, ctx));
      $('#rows').querySelectorAll('[data-v]').forEach(b => b.onclick = async () => { const reason = await confirmBox({ title: `Void ${b.dataset.n}?`, message: 'The stock goes back on the shelf and the sale stops counting as income. The Super Admin sees who voided it and why.', confirmText: 'Void sale', danger: true, input: { label: 'Reason (required)', placeholder: 'e.g. wrong item rung up', required: true } }); if (!reason) return; try { await post(`/b/sales/${b.dataset.v}/void`, { reason }); ok('Sale voided'); load(); } catch (e) { fail(e); } });
      pager($('#pg'), r, p => { st.page = p; load(); });
    } catch (e) { $('#rows').innerHTML = `<tr><td colspan="9">${empty('bi-exclamation-triangle', 'Could not load sales', e.message)}</td></tr>`; }
  };
  ['from', 'to', 'payment', 'status', 'source', 'seller', 'sort'].forEach(k => { const n = $('#' + k); if (n) n.onchange = () => { st[k] = n.value; st.page = 1; load(); }; });
  $('#q').oninput = debounce(e => { st.q = e.target.value; st.page = 1; load(); }, 350);
  $('#csv').onclick = async () => { const r = await get('/b/sales', { ...st, page: 1, limit: 200 }); downloadCSV(`sales_${st.from}_${st.to}.csv`, [['Receipt', 'Date', 'Customer', 'Phone', 'Seller', 'Payment', 'Source', 'Subtotal', 'Discount', 'Total', 'Status'], ...r.rows.map(s => [s.receipt_no, s.sale_date, s.customer_name, s.customer_phone, s.seller, s.payment_method, s.source, s.subtotal, s.discount, s.total, s.status])]); };
  ctx.on('sale.new', debounce(load, 500)); ctx.on('sale.voided', debounce(load, 500));
  load();
}
