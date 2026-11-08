import { get, post, put } from '../api.js';
import { esc, money, num, fmtDate, todayEAT, addDays, openModal, confirmBox, fail, ok, pill, empty, skeleton, debounce, PAY, debounce as deb } from '../ui.js';
import { busy, hhmm, time12, waLink, telLink } from './_kit.js';
import { showReceipt } from './pos.js';

const ST = { booked: ['Booked', 'info'], waiting: ['Waiting', 'warning'], in_service: ['In the chair', 'success'], completed: ['Completed', 'success'], cancelled: ['Cancelled', 'danger'], missed: ['Missed', 'danger'] };
const METHODS = ['cash', 'bank', 'qr', 'ewallet', 'card', 'mobile_money'];

export async function render(el, ctx) {
  const st = { date: todayEAT(), tab: 'queue' }; const canWork = ctx.can('appointments.manage');
  let services = [], barbers = [], data = null;
  el.innerHTML = `<div class="page-head"><div><h1>Queue & appointments</h1><p>Walk-ins, booked appointments and today’s customer queue.</p></div>${canWork ? '<div class="d-flex gap-2"><button class="btn btn-fb" id="walk"><i class="bi bi-person-plus me-1"></i>Walk-in</button><button class="btn btn-soft" id="appt"><i class="bi bi-calendar-plus me-1"></i>Appointment</button></div>' : ''}</div>
  <div class="filters"><div class="btn-group"><button class="btn btn-soft" id="prev"><i class="bi bi-chevron-left"></i></button><button class="btn btn-soft" id="today">Today</button><button class="btn btn-soft" id="next"><i class="bi bi-chevron-right"></i></button></div><input type="date" id="dt" class="form-control" value="${st.date}" style="max-width:170px">
    <div class="btn-group ms-auto"><button class="btn btn-soft active" data-t="queue">Queue</button><button class="btn btn-soft" data-t="cal">Day calendar</button><button class="btn btn-soft" data-t="hist">History</button></div></div>
  <div id="sum" class="d-flex gap-2 flex-wrap mb-3"></div><div id="v">${skeleton(4, 70)}</div>`;
  const $ = s => el.querySelector(s);
  const load = async () => {
    try {
      [services, barbers] = services.length ? [services, barbers] : await Promise.all([get('/b/barber/services'), get('/b/barber/barbers')]);
      if (st.tab === 'hist') return hist();
      data = await get('/b/barber/queue', { date: st.date }); const s = data.summary;
      $('#sum').innerHTML = [['Waiting', s.waiting, 'warning'], ['In the chair', s.in_service, 'success'], ['Booked', s.booked, 'info'], ['Completed', s.completed, 'success'], ['Cancelled', s.cancelled, 'danger'], ['Missed', s.missed, 'danger']].map(([l, n, k]) => `<span class="pill ${k}">${l}: <b>${n}</b></span>`).join('');
      st.tab === 'cal' ? cal() : queue();
    } catch (e) { $('#v').innerHTML = empty('bi-exclamation-triangle', 'Could not load', e.message); }
  };
  const actions = a => {
    if (!canWork) return '';
    const b = (act, label, ico, cls = 'btn-soft') => `<button class="btn btn-sm ${cls}" data-a="${act}" data-id="${a.id}"><i class="bi ${ico} me-1"></i>${label}</button>`;
    if (a.status === 'booked') return b('checkin', 'Arrived', 'bi-box-arrow-in-right', 'btn-fb') + b('edit', 'Edit', 'bi-pencil') + b('missed', 'Missed', 'bi-person-x') + b('cancel', 'Cancel', 'bi-x-lg', 'btn-danger-soft');
    if (a.status === 'waiting') return b('start', 'Start', 'bi-play-fill', 'btn-fb') + b('edit', 'Edit', 'bi-pencil') + b('missed', 'Missed', 'bi-person-x') + b('cancel', 'Cancel', 'bi-x-lg', 'btn-danger-soft');
    if (a.status === 'in_service') return b('complete', 'Complete & pay', 'bi-check2-circle', 'btn-fb') + b('back', 'Back to queue', 'bi-arrow-counterclockwise') + b('cancel', 'Cancel', 'bi-x-lg', 'btn-danger-soft');
    if (a.status === 'completed' && a.sale_id) return `<button class="btn btn-sm btn-soft" data-a="receipt" data-sale="${a.sale_id}"><i class="bi bi-receipt me-1"></i>${esc(a.receipt_no || 'Receipt')}</button>`;
    return '';
  };
  const card = a => `<div class="col-md-6 col-xl-4"><div class="fb-card h-100"><div class="d-flex gap-3"><div class="avatar" style="width:46px;height:46px;font-size:1rem">${a.queue_no ? '#' + a.queue_no : '<i class="bi bi-clock"></i>'}</div><div class="flex-grow-1"><div class="d-flex justify-content-between align-items-start gap-2"><a href="#" class="fw-bold text-decoration-none" data-cust="${a.customer_id || ''}" data-name="${esc(a.customer_name)}">${esc(a.customer_name)}</a>${pill(...ST[a.status])}</div>
    <div class="small muted">${a.kind === 'walkin' ? 'Walk-in' : 'Appointment'}${a.appt_time ? ' · ' + time12(a.appt_time) : ''}${a.customer_phone ? ' · ' + telLink(a.customer_phone) : ''}</div>
    <div class="mt-1"><b>${esc(a.service_name)}</b> · ${Number(a.price) > 0 ? money(a.price) : '<span class="text-warning">no price</span>'} · ${a.duration_min} min</div><div class="small muted">${a.barber_name ? '<i class="bi bi-person me-1"></i>' + esc(a.barber_name) : 'No barber chosen'}</div>
    ${a.customer_notes ? `<div class="small mt-1" style="color:var(--warning)"><i class="bi bi-sticky me-1"></i>${esc(a.customer_notes)}</div>` : ''}${a.notes ? `<div class="small muted">${esc(a.notes)}</div>` : ''}</div></div>
    <div class="d-flex gap-2 flex-wrap mt-3">${actions(a)}${a.customer_phone && ['booked', 'waiting'].includes(a.status) ? `<a class="btn btn-sm btn-soft" target="_blank" rel="noopener" href="${waLink(a.customer_phone, `Hello ${a.customer_name}, this is ${ctx.biz.name}. ${a.status === 'booked' ? `Reminder: your ${a.service_name} appointment is on ${fmtDate(a.appt_date)} at ${time12(a.appt_time)}.` : 'We are ready for you.'}`)}"><i class="bi bi-whatsapp"></i></a>` : ''}</div></div></div>`;
  const wire = root => {
    root.querySelectorAll('[data-a]').forEach(b => b.onclick = () => act(b.dataset.a, b));
    root.querySelectorAll('[data-cust]').forEach(a => a.onclick = e => { e.preventDefault(); a.dataset.cust ? history(Number(a.dataset.cust)) : fail(new Error('This customer has no phone number on record, so there is no history to show.')); });
  };
  const queue = () => { $('#v').innerHTML = data.rows.length ? `<div class="row g-3">${data.rows.map(card).join('')}</div>` : empty('bi-emoji-smile', 'Nothing for this day', canWork ? 'Register a walk-in or book an appointment.' : ''); wire($('#v')); };
  const cal = () => {
    const hours = Array.from({ length: 15 }, (_, i) => i + 7); const by = h => data.rows.filter(a => a.appt_time && Number(String(a.appt_time).slice(0, 2)) === h);
    const noTime = data.rows.filter(a => !a.appt_time);
    $('#v').innerHTML = `<div class="fb-card">${hours.map(h => `<div class="d-flex gap-3 py-2 border-bottom" style="border-color:var(--border)!important"><div class="muted" style="width:64px">${time12(h + ':00')}</div><div class="flex-grow-1 d-flex flex-wrap gap-2">${by(h).map(a => `<div class="fb-card py-2 px-3" style="min-width:210px;border-left:3px solid var(--primary)"><div class="fw-semibold">${hhmm(a.appt_time)} · ${esc(a.customer_name)} ${pill(...ST[a.status])}</div><div class="small muted">${esc(a.service_name)}${a.barber_name ? ' · ' + esc(a.barber_name) : ''}</div><div class="d-flex gap-1 flex-wrap mt-1">${actions(a)}</div></div>`).join('') || '<span class="small muted">—</span>'}</div></div>`).join('')}
      ${noTime.length ? `<div class="pt-3"><div class="fw-semibold mb-2">Walk-ins (no time)</div><div class="d-flex flex-wrap gap-2">${noTime.map(a => `<div class="fb-card py-2 px-3"><b>#${a.queue_no || ''} ${esc(a.customer_name)}</b> ${pill(...ST[a.status])}<div class="small muted">${esc(a.service_name)}</div><div class="d-flex gap-1 flex-wrap mt-1">${actions(a)}</div></div>`).join('')}</div></div>` : ''}</div>`; wire($('#v'));
  };
  async function hist() {
    $('#sum').innerHTML = ''; const h = { q: '', status: '', page: 1 };
    $('#v').innerHTML = `<div class="filters"><div class="search"><i class="bi bi-search"></i><input id="hq" class="form-control" placeholder="Customer, phone or service…"></div><select id="hs" class="form-select" style="max-width:170px"><option value="">All statuses</option>${Object.entries(ST).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></div><div class="tbl-wrap"><table class="fb-table stack"><thead><tr><th>Date</th><th>Customer</th><th>Service</th><th>Barber</th><th>Status</th><th class="num">Price</th><th></th></tr></thead><tbody id="hr"></tbody></table></div>`;
    const go = async () => { const r = await get('/b/barber/appointments', { q: h.q, status: h.status, limit: 60 }); $('#hr').innerHTML = r.rows.length ? r.rows.map(a => `<tr><td data-label="Date">${fmtDate(a.appt_date)}${a.appt_time ? ' ' + time12(a.appt_time) : ''}</td><td data-label="Customer"><b>${esc(a.customer_name)}</b><br><small class="muted">${esc(a.customer_phone || '')}</small></td><td data-label="Service">${esc(a.service_name)}</td><td data-label="Barber">${esc(a.barber_name || '—')}</td><td data-label="Status">${pill(...ST[a.status])}</td><td data-label="Price" class="num">${money(a.sale_total ?? a.price)}</td><td class="nolabel">${a.sale_id ? `<button class="btn btn-sm btn-soft" data-a="receipt" data-sale="${a.sale_id}"><i class="bi bi-receipt"></i></button>` : ''}</td></tr>`).join('') : `<tr><td colspan="7">${empty('bi-calendar-x', 'No visits found')}</td></tr>`; wire($('#hr')); };
    $('#hq').oninput = deb(e => { h.q = e.target.value; go(); }, 300); $('#hs').onchange = e => { h.status = e.target.value; go(); }; await go();
  }

  async function act(a, btn) {
    const id = Number(btn.dataset.id); const row = data && data.rows.find(r => r.id === id);
    try {
      if (a === 'receipt') return showReceipt(Number(btn.dataset.sale), ctx);
      if (a === 'edit') return form(row.kind, row);
      if (a === 'complete') return complete(row);
      if (a === 'start' && !row.barber_id && barbers.length) return pickBarber(row);
      if (a === 'cancel') { const reason = await confirmBox({ title: 'Cancel this visit?', message: `${esc(row.customer_name)} · ${esc(row.service_name)}`, confirmText: 'Cancel visit', danger: true, input: { label: 'Reason (optional)', placeholder: 'e.g. customer called' } }); if (reason === false) return; await post(`/b/barber/appointments/${id}/status`, { status: 'cancelled', reason: reason === true ? '' : reason }); ok('Visit cancelled'); return load(); }
      if (a === 'missed') { if (!(await confirmBox({ title: 'Mark as missed?', message: `${esc(row.customer_name)} did not show up.`, confirmText: 'Mark missed', danger: true }))) return; await busy(btn, 'Saving…', () => post(`/b/barber/appointments/${id}/status`, { status: 'missed' })); return load(); }
      const to = { checkin: 'waiting', start: 'in_service', back: 'waiting' }[a];
      await busy(btn, 'Saving…', () => post(`/b/barber/appointments/${id}/status`, { status: to })); load();
    } catch (e) { fail(e); }
  }
  function pickBarber(row) {
    const m = openModal({ size: 'modal-sm', title: 'Who is cutting?', body: `<select class="form-select" id="b"><option value="">— choose barber —</option>${barbers.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select><div class="small muted mt-2">Commission is calculated for the barber who completes the service.</div>`, footer: '<button class="btn btn-soft" id="sk">Skip</button><button class="btn btn-fb" id="go">Start</button>' });
    const go = async (bid, btn) => busy(btn, 'Starting…', async () => { try { await post(`/b/barber/appointments/${row.id}/status`, { status: 'in_service', barber_id: bid || undefined }); m.close(); load(); } catch (e) { fail(e); } });
    m.el.querySelector('#go').onclick = e => go(m.el.querySelector('#b').value, e.currentTarget); m.el.querySelector('#sk').onclick = e => go('', e.currentTarget);
  }

  function form(kind, row) {
    const isAppt = kind === 'appointment'; const act = services.filter(s => s.status === 'active' || (row && s.id === row.service_id));
    const m = openModal({ title: row ? 'Edit visit' : isAppt ? 'Book an appointment' : 'Register walk-in', body: `
      <div class="mb-3 position-relative"><label class="form-label">Customer name *</label><input class="form-control" id="cn" autocomplete="off" value="${esc(row ? row.customer_name : '')}" placeholder="Type a name or phone to find a returning customer"><div id="sg" class="list-group position-absolute w-100 shadow" style="z-index:20"></div></div>
      <div class="row g-2 mb-3"><div class="col-sm-6"><label class="form-label">Phone</label><input class="form-control" id="cp" inputmode="tel" value="${esc(row ? row.customer_phone || '' : '')}" placeholder="+60…"></div><div class="col-sm-6"><label class="form-label">Service *</label><select class="form-select" id="sv"><option value="">— choose —</option>${act.map(s => `<option value="${s.id}" ${row && row.service_id === s.id ? 'selected' : ''}>${esc(s.name)} · ${Number(s.price) > 0 ? money(s.price) : 'no price'} · ${s.duration_min}m</option>`).join('')}</select></div></div>
      <div class="row g-2 mb-3"><div class="col-sm-${isAppt ? 4 : 12}"><label class="form-label">Barber</label><select class="form-select" id="br"><option value="">Any / decide later</option>${barbers.map(b => `<option value="${b.id}" ${row && row.barber_id === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></div>
      ${isAppt ? `<div class="col-sm-4"><label class="form-label">Date *</label><input type="date" class="form-control" id="ad" min="${todayEAT()}" value="${row ? row.appt_date : st.date < todayEAT() ? todayEAT() : st.date}"></div><div class="col-sm-4"><label class="form-label">Time *</label><input type="time" class="form-control" id="at" value="${row && row.appt_time ? hhmm(row.appt_time) : ''}"></div>` : ''}</div>
      <label class="form-label">Note</label><input class="form-control" id="nt" maxlength="255" value="${esc(row ? row.notes || '' : '')}" placeholder="Optional">`, footer: `<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-fb" id="go">${row ? 'Save' : isAppt ? 'Book' : 'Add to queue'}</button>` });
    const f = s => m.el.querySelector(s); let custId = row ? row.customer_id : null;
    f('#cn').oninput = deb(async () => { custId = null; const v = f('#cn').value.trim(); if (v.length < 2) { f('#sg').innerHTML = ''; return; } try { const r = await get('/b/barber/customers/search', { q: v }); f('#sg').innerHTML = r.map(c => `<button type="button" class="list-group-item list-group-item-action" data-c="${c.id}" data-n="${esc(c.name)}" data-p="${esc(c.phone || '')}">${esc(c.name)} <small class="muted">${esc(c.phone || '')} · ${c.visits} visit${c.visits == 1 ? '' : 's'}</small></button>`).join(''); f('#sg').querySelectorAll('[data-c]').forEach(b => b.onclick = () => { custId = Number(b.dataset.c); f('#cn').value = b.dataset.n; f('#cp').value = b.dataset.p; f('#sg').innerHTML = ''; }); } catch (_) { /* ignore */ } }, 250);
    f('#go').onclick = e => busy(e.currentTarget, 'Saving…', async () => {
      try { const body = { kind, customer_id: custId || undefined, customer_name: f('#cn').value, customer_phone: f('#cp').value, service_id: f('#sv').value, barber_id: f('#br').value || undefined, notes: f('#nt').value }; if (isAppt) { body.appt_date = f('#ad').value; body.appt_time = f('#at').value; }
        if (row) await put('/b/barber/appointments/' + row.id, { ...body, barber_id: f('#br').value || null }); else { const r = await post('/b/barber/appointments', body); ok(isAppt ? 'Appointment booked' : `Added to the queue as #${r.queue_no}`); }
        m.close(); if (isAppt && body.appt_date) { st.date = body.appt_date; $('#dt').value = st.date; } load(); } catch (er) { fail(er); } });
  }

  async function complete(row) {
    let supplies = []; try { if (ctx.can('appointments.manage') || ctx.can('stock.adjust')) supplies = await get('/b/barber/supplies'); } catch (_) { /* optional */ }
    const canPrice = ctx.isSuper || ctx.can('sales.price_override') || Number(row.price) <= 0; const canDisc = ctx.isSuper || ctx.can('sales.discount'); const used = [];
    const m = openModal({ title: `Complete · ${esc(row.customer_name)}`, body: `<div class="fb-card mb-3 py-2"><b>${esc(row.service_name)}</b></div>
      <div class="row g-2 mb-3"><div class="col-6"><label class="form-label">Price (${esc(ctx.biz.currency)})</label><input class="form-control" id="pr" type="number" min="0" step="0.01" inputmode="decimal" value="${Number(row.price) || ''}" ${canPrice ? '' : 'disabled'}></div><div class="col-6"><label class="form-label">Discount</label><input class="form-control" id="ds" type="number" min="0" step="0.01" inputmode="decimal" value="0" ${canDisc ? '' : 'disabled'}></div></div>
      <div class="row g-2 mb-3"><div class="col-sm-6"><label class="form-label">Paid by *</label><select class="form-select" id="pm">${METHODS.map(k => `<option value="${k}">${esc(PAY[k][0])}</option>`).join('')}</select></div><div class="col-sm-6"><label class="form-label">Reference (QR / transfer)</label><input class="form-control" id="rf" maxlength="80" placeholder="Optional"></div></div>
      <div class="mb-3"><label class="form-label">Barber (commission)</label><select class="form-select" id="br"><option value="">No barber</option>${barbers.map(b => `<option value="${b.id}" ${row.barber_id === b.id ? 'selected' : ''}>${esc(b.name)} · ${num(b.commission_pct)}%</option>`).join('')}</select></div>
      ${supplies.length ? `<div class="mb-2"><label class="form-label">Supplies used in this service (optional)</label><div id="us"></div><button class="btn btn-sm btn-soft" id="au"><i class="bi bi-plus-lg me-1"></i>Add supply</button></div>` : ''}
      <div class="fb-card py-2 d-flex justify-content-between"><span>Total to collect</span><b id="tt"></b></div>`, footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-fb" id="go"><i class="bi bi-check2-circle me-1"></i>Complete & record sale</button>' });
    const f = s => m.el.querySelector(s); const tot = () => { f('#tt').textContent = money(Math.max(0, (Number(f('#pr').value) || 0) - (Number(f('#ds').value) || 0))); }; ['#pr', '#ds'].forEach(s => f(s).oninput = tot); tot();
    const drawUsed = () => { f('#us').innerHTML = used.map((u, i) => `<div class="input-group input-group-sm mb-1"><select class="form-select" data-up="${i}">${supplies.map(p => `<option value="${p.id}" ${p.id == u.product_id ? 'selected' : ''}>${esc(p.name)} (${p.stock_qty})</option>`).join('')}</select><input class="form-control" type="number" min="1" style="max-width:80px" data-uq="${i}" value="${u.qty}"><button class="btn btn-soft" data-ux="${i}">×</button></div>`).join(''); f('#us').querySelectorAll('[data-up]').forEach(s => s.onchange = () => { used[s.dataset.up].product_id = s.value; }); f('#us').querySelectorAll('[data-uq]').forEach(s => s.oninput = () => { used[s.dataset.uq].qty = s.value; }); f('#us').querySelectorAll('[data-ux]').forEach(s => s.onclick = () => { used.splice(Number(s.dataset.ux), 1); drawUsed(); }); };
    if (supplies.length) f('#au').onclick = () => { used.push({ product_id: supplies[0].id, qty: 1 }); drawUsed(); };
    f('#go').onclick = e => busy(e.currentTarget, 'Recording…', async () => {
      try { const r = await post(`/b/barber/appointments/${row.id}/complete`, { price: f('#pr').value, discount: f('#ds').value || 0, payment_method: f('#pm').value, reference: f('#rf').value, barber_id: f('#br').value || undefined, products_used: used.filter(u => Number(u.qty) > 0) }); m.close(); ok('Sale recorded 🎉', `${r.receipt_no} · ${money(r.total)}`); load(); done(row, r); } catch (er) { fail(er); } });
  }
  function done(row, r) {
    const text = `Thank you for visiting ${ctx.biz.name}!\nReceipt ${r.receipt_no}\n${row.service_name}: ${money(r.total)}\nWe look forward to seeing you again.`;
    const m = openModal({ size: 'modal-sm', title: 'Visit complete ✅', body: `<div class="text-center"><div class="fs-2 fw-bold" style="color:var(--primary)">${money(r.total)}</div><div class="muted">${esc(r.receipt_no)}${r.barber ? ' · ' + esc(r.barber) : ''}</div>${r.commission ? `<div class="small mt-1">Commission earned: <b>${money(r.commission)}</b></div>` : ''}</div>`, footer: `<button class="btn btn-soft" id="rc"><i class="bi bi-receipt me-1"></i>Digital receipt</button>${row.customer_phone ? `<a class="btn btn-soft" target="_blank" rel="noopener" href="${waLink(row.customer_phone, text)}"><i class="bi bi-whatsapp me-1"></i>WhatsApp</a>` : ''}<button class="btn btn-fb" data-bs-dismiss="modal">Done</button>` });
    m.el.querySelector('#rc').onclick = () => { m.close(); showReceipt(r.id, ctx).catch(fail); };
  }

  async function history(id) {
    const m = openModal({ size: 'modal-lg', title: 'Customer history', body: skeleton(4, 40) });
    try {
      const d = await get('/b/barber/customers/' + id); const c = d.customer;
      m.el.querySelector('.modal-body').innerHTML = `<div class="d-flex justify-content-between flex-wrap gap-2 mb-3"><div><div class="fs-5 fw-bold">${esc(c.name)}</div><div class="muted">${telLink(c.phone)}</div></div><div class="text-end"><div class="fw-bold">${money(d.total_spent)}</div><div class="small muted">${d.visit_count} visit${d.visit_count === 1 ? '' : 's'}${d.last_visit ? ' · last ' + fmtDate(d.last_visit) : ''}</div></div></div>
        <div class="mb-3"><label class="form-label">Preferences & notes</label><textarea class="form-control" id="nt" rows="2" maxlength="500" placeholder="e.g. Low fade, number 2 on the sides, no talking">${esc(c.notes || '')}</textarea>${canWork ? '<button class="btn btn-sm btn-soft mt-2" id="sn">Save notes</button>' : ''}</div>
        ${d.by_service.length ? `<div class="mb-3">${d.by_service.map(s => pill(`${s.name} ×${s.times}`, 'gold')).join(' ')}</div>` : ''}${d.missed || d.cancelled ? `<div class="small muted mb-2">Missed: ${d.missed} · Cancelled: ${d.cancelled}</div>` : ''}
        <div class="tbl-wrap"><table class="fb-table"><thead><tr><th>Date</th><th>Services received</th><th>Barber</th><th>Paid by</th><th class="num">Amount</th></tr></thead><tbody>${d.visits.map(v => `<tr><td>${fmtDate(v.sale_date)}</td><td>${esc(v.services || '')}</td><td>${esc(v.barber || '—')}</td><td>${esc((PAY[v.payment_method] || [v.payment_method])[0])}</td><td class="num">${money(v.total)}</td></tr>`).join('') || `<tr><td colspan="5" class="muted text-center">No visits yet</td></tr>`}</tbody></table></div>`;
      const sn = m.el.querySelector('#sn'); if (sn) sn.onclick = e => busy(e.currentTarget, 'Saving…', async () => { try { await put(`/b/barber/customers/${id}/notes`, { notes: m.el.querySelector('#nt').value }); ok('Notes saved'); load(); } catch (er) { fail(er); } });
    } catch (e) { m.close(); fail(e); }
  }

  $('#dt').onchange = e => { st.date = e.target.value || todayEAT(); load(); }; $('#prev').onclick = () => { st.date = addDays(st.date, -1); $('#dt').value = st.date; load(); }; $('#next').onclick = () => { st.date = addDays(st.date, 1); $('#dt').value = st.date; load(); }; $('#today').onclick = () => { st.date = todayEAT(); $('#dt').value = st.date; load(); };
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { st.tab = b.dataset.t; el.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('active', x === b)); load(); });
  if (canWork) { $('#walk').onclick = () => form('walkin'); $('#appt').onclick = () => form('appointment'); }
  ['appointment.changed', 'sale.new'].forEach(e => ctx.on(e, deb(() => { if (st.tab !== 'hist') load(); }, 500))); const iv = setInterval(() => { if (st.tab !== 'hist' && !document.querySelector('.modal.show')) load(); }, 45000); ctx.cleanup = () => clearInterval(iv);
  await load();
}
