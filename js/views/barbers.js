import { get, post, put } from '../api.js';
import { esc, money, num, fmtDate, todayEAT, openModal, fail, ok, pill, empty, skeleton, downloadCSV } from '../ui.js';
import { busy, rangeBar, monthStart, kpi, telLink } from './_kit.js';
import { exportButtons } from '../export.js';

export async function render(el, ctx) {
  const st = { from: monthStart(), to: todayEAT() }; const canManage = ctx.can('services.manage'); const canSee = ctx.canAny(['commissions.view', 'reports.view']); let data = null, barbers = [];
  el.innerHTML = `<div class="page-head"><div><h1>Barbers & commissions</h1><p>Who cut what, what each barber earned and what is still owed.</p></div><div class="d-flex gap-2 flex-wrap" id="act">${canManage ? '<button class="btn btn-fb" id="add"><i class="bi bi-person-plus me-1"></i>Add barber</button>' : ''}</div></div>
  <div class="filters" id="rb"></div><div class="row g-3 mb-3" id="k"></div><div id="v">${skeleton(4, 80)}</div>`;
  const $ = s => el.querySelector(s);
  rangeBar($('#rb'), st, () => load());
  const load = async () => {
    try {
      if (canSee) { data = await get('/b/barber/commissions', st); barbers = data.rows; $('#k').innerHTML = [kpi('bi-scissors', 'Services', num(data.totals.services), 'In this period'), kpi('bi-cash-stack', 'Revenue (before tax)', money(data.totals.revenue), 'From services'), kpi('bi-percent', 'Commission earned', money(data.totals.earned), 'This period', 'var(--success)'), kpi('bi-hourglass-split', 'Owed to barbers', money(data.totals.owing), 'All time, not yet paid', data.totals.owing > 0 ? 'var(--warning)' : 'var(--success)')].join(''); }
      else barbers = await get('/b/barber/barbers', { all: 1 });
      draw();
    } catch (e) { $('#v').innerHTML = empty('bi-exclamation-triangle', 'Could not load', e.message); }
  };
  const draw = () => {
    $('#v').innerHTML = barbers.length ? `<div class="row g-3">${barbers.map(b => `<div class="col-md-6 col-xl-4"><div class="fb-card h-100 ${b.status === 'inactive' ? 'opacity-50' : ''}"><div class="d-flex gap-3 align-items-center mb-2"><span class="avatar" style="width:46px;height:46px"><i class="bi bi-person-badge"></i></span><div class="flex-grow-1"><div class="fw-bold">${esc(b.name)} ${b.status === 'inactive' ? pill('Inactive', 'danger') : ''}</div><div class="small muted">${num(b.commission_pct)}% commission</div></div></div>
      ${canSee ? `<div class="row text-center g-2 mb-3"><div class="col-4"><div class="fw-bold">${num(b.services)}</div><div class="small muted">Services</div></div><div class="col-4"><div class="fw-bold">${money(b.earned)}</div><div class="small muted">Earned</div></div><div class="col-4"><div class="fw-bold" style="color:${b.owing > 0 ? 'var(--warning)' : 'var(--success)'}">${money(b.owing)}</div><div class="small muted">Owed</div></div></div>` : ''}
      <div class="d-flex gap-2 flex-wrap">${canSee ? `<button class="btn btn-sm btn-soft" data-d="${b.id}"><i class="bi bi-list-ul me-1"></i>Details</button>` : ''}${canManage ? `<button class="btn btn-sm btn-soft" data-e="${b.id}"><i class="bi bi-pencil"></i></button>${canSee && b.owing > 0 ? `<button class="btn btn-sm btn-fb" data-p="${b.id}"><i class="bi bi-cash me-1"></i>Pay</button>` : ''}` : ''}</div></div></div>`).join('')}</div>
      ${canSee && data.unassigned.services ? `<div class="small muted mt-3">${data.unassigned.services} service(s) worth ${money(data.unassigned.revenue)} had no barber assigned, so no commission was calculated.</div>` : ''}` : empty('bi-person-badge', 'No barbers yet', 'Add your barbers and their commission rate.');
    $('#v').querySelectorAll('[data-e]').forEach(b => b.onclick = () => form(barbers.find(x => x.id == b.dataset.e)));
    $('#v').querySelectorAll('[data-d]').forEach(b => b.onclick = () => detail(Number(b.dataset.d)));
    $('#v').querySelectorAll('[data-p]').forEach(b => b.onclick = () => payout(barbers.find(x => x.id == b.dataset.p)));
  };
  function form(b) {
    const m = openModal({ size: 'modal-sm', title: b ? 'Edit barber' : 'Add barber', body: `<div class="mb-3"><label class="form-label">Name *</label><input class="form-control" id="n" value="${esc(b ? b.name : '')}"></div><div class="row g-2"><div class="col-6"><label class="form-label">Phone</label><input class="form-control" id="p" value="${esc(b ? b.phone || '' : '')}"></div><div class="col-6"><label class="form-label">Commission %</label><input class="form-control" id="c" type="number" min="0" max="100" step="0.5" value="${b ? b.commission_pct : (ctx.biz.settings.default_commission_pct ?? 30)}"></div></div><div class="small muted mt-2">Commission is calculated automatically on every service this barber completes. Changing the rate affects new services only.</div>${b ? `<div class="form-check form-switch mt-3"><input class="form-check-input" type="checkbox" id="a" ${b.status === 'active' ? 'checked' : ''}><label class="form-check-label">Active</label></div>` : ''}`, footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-fb" id="go">Save</button>' });
    m.el.querySelector('#go').onclick = e => busy(e.currentTarget, 'Saving…', async () => { try { const body = { name: m.el.querySelector('#n').value, phone: m.el.querySelector('#p').value, commission_pct: m.el.querySelector('#c').value }; if (b) { body.status = m.el.querySelector('#a').checked ? 'active' : 'inactive'; await put('/b/barber/barbers/' + b.id, body); } else await post('/b/barber/barbers', body); ok('Barber saved'); m.close(); load(); } catch (er) { fail(er); } });
  }
  async function detail(id) {
    const m = openModal({ size: 'modal-lg', title: 'Commission details', body: skeleton(4, 40) });
    try {
      const d = await get('/b/barber/commissions/' + id, st); const earned = d.sales.reduce((a, s) => a + Number(s.commission_amount), 0);
      m.el.querySelector('.modal-body').innerHTML = `<div class="d-flex justify-content-between mb-3"><div><div class="fs-5 fw-bold">${esc(d.barber.name)}</div><div class="muted">${fmtDate(d.from)} – ${fmtDate(d.to)}</div></div><div class="text-end"><div class="fw-bold">${money(earned)}</div><div class="small muted">${d.sales.length} service(s)</div></div></div>
        <div class="tbl-wrap mb-3"><table class="fb-table"><thead><tr><th>Date</th><th>Receipt</th><th>Customer</th><th>Service</th><th class="num">Amount</th><th class="num">%</th><th class="num">Commission</th></tr></thead><tbody>${d.sales.map(s => `<tr><td>${fmtDate(s.sale_date)}</td><td>${esc(s.receipt_no)}</td><td>${esc(s.customer_name || '—')}</td><td>${esc(s.service || '')}</td><td class="num">${money(Number(s.total) - Number(s.tax_amount))}</td><td class="num">${num(s.commission_pct)}</td><td class="num">${money(s.commission_amount)}</td></tr>`).join('') || '<tr><td colspan="7" class="muted text-center">No services in this period</td></tr>'}</tbody></table></div>
        <h6>Payments to ${esc(d.barber.name)}</h6>${d.payouts.length ? d.payouts.map(p => `<div class="feed-item"><div class="flex-grow-1"><b>${money(p.amount)}</b> <span class="muted">· ${fmtDate(p.paid_on)} · ${esc(p.method)}</span>${p.note ? `<div class="small muted">${esc(p.note)}</div>` : ''}</div><small class="muted">${esc(p.by_name || '')}</small></div>`).join('') : '<div class="small muted">Nothing paid out yet.</div>'}`;
    } catch (e) { m.close(); fail(e); }
  }
  function payout(b) {
    const m = openModal({ size: 'modal-sm', title: `Pay ${esc(b.name)}`, body: `<div class="mb-2 small muted">Currently owed: <b>${money(b.owing)}</b></div><div class="mb-3"><label class="form-label">Amount *</label><input class="form-control" id="a" type="number" min="0" step="0.01" value="${b.owing}"></div><div class="row g-2"><div class="col-6"><label class="form-label">Method</label><select class="form-select" id="m"><option value="cash">Cash</option><option value="bank">Bank transfer</option><option value="ewallet">E-wallet</option></select></div><div class="col-6"><label class="form-label">Date</label><input class="form-control" type="date" id="d" value="${todayEAT()}" max="${todayEAT()}"></div></div><input class="form-control mt-2" id="nt" placeholder="Note (optional)">`, footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-fb" id="go">Record payment</button>' });
    m.el.querySelector('#go').onclick = e => busy(e.currentTarget, 'Saving…', async () => { try { await post('/b/barber/commissions/payout', { barber_id: b.id, amount: m.el.querySelector('#a').value, method: m.el.querySelector('#m').value, paid_on: m.el.querySelector('#d').value, note: m.el.querySelector('#nt').value }); ok('Payout recorded'); m.close(); load(); } catch (er) { fail(er); } });
  }
  if (canManage) $('#add').onclick = () => form(null);
  if (canSee) exportButtons($('#act'), async () => ({ filename: `commissions_${st.from}_${st.to}`, title: 'Barber commissions', subtitle: `${st.from} to ${st.to}`, columns: ['Barber', 'Rate %', 'Services', 'Revenue', 'Commission', 'Paid (all time)', 'Owed'], rows: data.rows.map(r => [r.name, r.commission_pct, r.services, r.revenue, r.earned, r.paid_all, r.owing]) }));
  await load();
}
