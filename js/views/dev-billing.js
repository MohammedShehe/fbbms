// Developer console: revenue, every payment, pricing settings, and per-business billing controls.
import { get, post, put } from '../api.js';
import { esc, num, openModal, fail, ok, pill, fmtDate, fmtDateTime, empty, skeleton, confirmBox, pager } from '../ui.js';

const PN = { daily: 'Daily', monthly: 'Monthly', yearly: 'Yearly', lifetime: 'One-time' };
const ST = { trial: ['Trial', 'info'], active: ['Paid', 'success'], grace: ['Overdue', 'warning'], expired: ['Locked', 'danger'], lifetime: ['Lifetime', 'success'], exempt: ['Complimentary', 'success'] };
const PS = { completed: ['Paid', 'success'], pending: ['Waiting', 'warning'], failed: ['Failed', 'danger'], expired: ['Expired', 'danger'], voided: ['Cancelled', 'danger'] };
const tzs = n => `TZS ${num(n)}`;
export const billChip = s => { if (!s) return ''; const [t, k] = ST[s.state] || [s.state, '']; const extra = s.state === 'trial' || s.state === 'active' ? ` · ${s.days_left}d` : ''; return pill(t + extra, k); };

/* -------- per-business billing modal -------- */
export function billingModal(biz, onChange) {
  const m = openModal({ size: 'modal-lg', title: `<span><i class="bi bi-cash-coin me-2"></i>Billing · ${esc(biz.name)}</span>`, body: skeleton(5, 40) });
  const body = m.el.querySelector('.modal-body');
  const draw = async () => {
    let d; try { d = await get(`/developer/businesses/${biz.id}/billing`); } catch (e) { body.innerHTML = `<div class="text-danger">${esc(e.message)}</div>`; return; }
    const s = d.state; const [t, k] = ST[s.state] || [s.state, ''];
    body.innerHTML = `<div class="fb-card mb-3 d-flex flex-wrap gap-3 align-items-center justify-content-between"><div><div class="mb-1">${pill(t, k)} ${d.autopay.enabled ? pill('Auto-renew ' + (PN[d.autopay.plan] || ''), 'gold') : ''}</div><div class="fw-bold fs-5">${s.state === 'lifetime' ? 'Lifetime access' : s.state === 'exempt' ? 'Complimentary (never billed)' : s.access_until ? `${s.locked ? 'Ended' : 'Access until'} ${fmtDateTime(s.access_until)}` : '—'}</div><div class="small muted">Trial ends ${fmtDate(s.trial_ends_at)} · Paid until ${s.paid_until ? fmtDate(s.paid_until) : '—'}</div></div></div>
      <div class="row g-3">
        <div class="col-md-6"><div class="fb-card h-100"><h6><i class="bi bi-cash-stack me-1"></i>Record a payment (cash, bank…)</h6>
          <select class="form-select mb-2" id="rp">${['daily', 'monthly', 'yearly', 'lifetime'].map(p => `<option value="${p}" data-price="${d.plans[p].price}">${PN[p]} · ${tzs(d.plans[p].price)}</option>`).join('')}</select>
          <input class="form-control mb-2" id="ra" type="number" min="0" placeholder="Amount received (default = plan price)">
          <input class="form-control mb-2" id="rr" placeholder="Reference / receipt no. (optional)">
          <input class="form-control mb-2" id="rn" placeholder="Note (optional)">
          <button class="btn btn-fb w-100" id="rg"><i class="bi bi-check2-circle me-1"></i>Record &amp; activate</button></div></div>
        <div class="col-md-6"><div class="fb-card h-100"><h6><i class="bi bi-gift me-1"></i>Give free days</h6>
          <div class="input-group mb-2"><input class="form-control" id="gd" type="number" min="1" placeholder="Days"><span class="input-group-text">days</span></div>
          <input class="form-control mb-2" id="gn" placeholder="Reason (promo, compensation…)">
          <button class="btn btn-soft w-100 mb-3" id="gg">Add days</button>
          <h6><i class="bi bi-arrow-counterclockwise me-1"></i>Restart trial</h6>
          <div class="input-group"><input class="form-control" id="td" type="number" min="0" max="365" value="30"><span class="input-group-text">days from today</span><button class="btn btn-soft" id="tg">Set</button></div></div></div>
        <div class="col-12"><div class="fb-card"><h6><i class="bi bi-toggles me-1"></i>Special access</h6>
          <div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" id="ex" ${s.exempt ? 'checked' : ''}><label class="form-check-label">Complimentary: never billed, never locked (e.g. your own shops)</label></div>
          <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="lf" ${s.lifetime ? 'checked' : ''}><label class="form-check-label">Lifetime access (one-time plan)</label></div></div></div>
        <div class="col-12"><div class="fb-card"><h6>History</h6>${d.payments.length ? `<div class="table-responsive"><table class="table-fb"><thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>How</th><th>Status</th><th>Until</th></tr></thead><tbody>${d.payments.map(p => `<tr><td>${fmtDateTime(p.paid_at || p.created_at)}</td><td>${PN[p.plan] || p.plan}</td><td>${p.method === 'grant' ? `+${p.note ? '' : ''}gift` : tzs(p.amount)}</td><td>${p.method === 'mobile' ? esc(p.network || 'Mobile money') : p.method === 'manual' ? `Recorded${p.recorder ? ' by ' + esc(p.recorder) : ''}` : 'Gift'}${p.note ? `<div class="small muted">${esc(p.note)}</div>` : ''}</td><td>${pill(...(PS[p.status] || [p.status, '']))}</td><td>${p.plan === 'lifetime' && p.status === 'completed' ? 'Forever' : p.period_end ? fmtDate(p.period_end) : '—'}</td></tr>`).join('')}</tbody></table></div>` : empty('bi-receipt', 'No payments yet')}</div></div>
      </div>`;
    const q = s => body.querySelector(s); const done = () => { onChange && onChange(); draw(); };
    q('#rg').onclick = async () => { const plan = q('#rp').value; if (!await confirmBox({ title: 'Record payment', message: `Activate the <b>${PN[plan]}</b> plan for <b>${esc(biz.name)}</b>?`, confirmText: 'Record' })) return; try { await post(`/developer/businesses/${biz.id}/billing/payment`, { plan, amount: q('#ra').value, reference: q('#rr').value, note: q('#rn').value }); ok('Payment recorded', 'The business is unlocked.'); done(); } catch (e) { fail(e); } };
    q('#gg').onclick = async () => { try { await post(`/developer/businesses/${biz.id}/billing/grant`, { days: q('#gd').value, note: q('#gn').value }); ok('Days added'); done(); } catch (e) { fail(e); } };
    q('#tg').onclick = async () => { try { await put(`/developer/businesses/${biz.id}/billing`, { trial_days: q('#td').value }); ok('Trial updated'); done(); } catch (e) { fail(e); } };
    q('#ex').onchange = async e => { try { await put(`/developer/businesses/${biz.id}/billing`, { billing_exempt: e.target.checked }); ok(e.target.checked ? 'Marked complimentary' : 'Billing resumed'); done(); } catch (er) { fail(er); } };
    q('#lf').onchange = async e => { try { await put(`/developer/businesses/${biz.id}/billing`, { lifetime: e.target.checked }); ok(e.target.checked ? 'Lifetime granted' : 'Lifetime removed'); done(); } catch (er) { fail(er); } };
  };
  draw(); return m;
}

/* -------- Billing & revenue page -------- */
export async function devBilling(el) {
  el.innerHTML = `<div class="page-head"><div><h1>Billing &amp; revenue</h1><p>Subscriptions, Snippe payments, pricing and who is paying.</p></div><button class="btn btn-soft" id="rf"><i class="bi bi-arrow-clockwise me-1"></i>Refresh</button></div><div id="bo">${skeleton(6, 80)}</div>`;
  const host = el.querySelector('#bo'); const f = { status: '', page: 1 };
  const draw = async () => {
    let o, pays;
    try { [o, pays] = await Promise.all([get('/developer/billing/overview'), get('/developer/billing/payments', { status: f.status || undefined, page: f.page, limit: 15 })]); }
    catch (e) { host.innerHTML = `<div class="text-danger">${esc(e.message)}</div>`; return; }
    const cfg = o.config; const max = Math.max(1, ...o.series.map(s => Number(s.total)));
    const kpi = (ic, l, v, sub = '') => `<div class="col-6 col-xl-3"><div class="fb-card h-100"><div class="d-flex align-items-center gap-3"><div class="pm-ic"><i class="bi ${ic}"></i></div><div><div class="small muted">${l}</div><div class="fw-bold fs-5">${v}</div>${sub ? `<div class="small muted">${sub}</div>` : ''}</div></div></div></div>`;
    host.innerHTML = `
      ${o.payments_ready ? '' : '<div class="alert-fb mb-3"><i class="bi bi-exclamation-triangle me-1"></i><b>Snippe is not connected.</b> Add <code>SNIPPE_API_KEY</code> (and <code>SNIPPE_WEBHOOK_SECRET</code>, <code>PUBLIC_API_URL</code>) to the backend <code>.env</code> and restart. Trials keep working meanwhile; you can still record cash payments.</div>'}
      <div class="row g-3 mb-3">${kpi('bi-calendar-month', 'This month', tzs(o.revenue.month))}${kpi('bi-clock-history', 'Last 24 hours', tzs(o.revenue.last_24h))}${kpi('bi-bank', 'All time', tzs(o.revenue.all_time), `${num(o.revenue.paid_count || 0)} payments`)}${kpi('bi-hourglass-split', 'Waiting for approval', num(o.revenue.pending || 0), `${num(o.revenue.failed_count || 0)} failed/expired`)}</div>
      <div class="row g-3 mb-3"><div class="col-lg-7"><div class="fb-card h-100"><h6>Last 30 days</h6>${o.series.length ? `<div class="bar30">${o.series.map(s => `<div class="b" title="${esc(String(s.d).slice(0, 10))}: ${tzs(s.total)}"><i style="height:${Math.max(6, Math.round(Number(s.total) / max * 100))}%"></i></div>`).join('')}</div>` : empty('bi-graph-up', 'No payments yet')}</div></div>
        <div class="col-lg-5"><div class="fb-card h-100"><h6>Businesses</h6><div class="d-flex flex-wrap gap-2 mb-2">${Object.entries(o.counts).map(([k, n]) => `${pill(`${(ST[k] || [k])[0]}: ${n}`, (ST[k] || [])[1])}`).join('')}</div><h6 class="mt-3">By plan</h6>${o.by_plan.length ? o.by_plan.map(p => `<div class="d-flex justify-content-between small py-1 border-bottom"><span>${PN[p.plan] || p.plan} <span class="muted">(${p.n})</span></span><b>${tzs(p.total)}</b></div>`).join('') : '<div class="muted small">Nothing yet</div>'}</div></div></div>
      <div class="fb-card mb-3"><h6>Who is paying</h6><div class="table-responsive"><table class="table-fb"><thead><tr><th>Business</th><th>Status</th><th>Access until</th><th>Auto-renew</th><th></th></tr></thead><tbody>${o.businesses.map(b => `<tr><td class="fw-semibold">${esc(b.name)}</td><td>${billChip(b)}</td><td>${b.lifetime ? 'Forever' : b.exempt ? '—' : fmtDate(b.access_until)}</td><td>${b.autopay ? PN[b.autopay_plan] || 'On' : '—'}</td><td class="text-end"><button class="btn btn-sm btn-soft" data-m="${b.id}">Manage</button></td></tr>`).join('')}</tbody></table></div></div>
      <div class="fb-card mb-3"><div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2"><h6 class="mb-0">Payments</h6><div class="chips">${['', 'completed', 'pending', 'failed'].map(s => `<span class="chip ${f.status === s ? 'active' : ''}" data-s="${s}">${s ? (PS[s] || [s])[0] : 'All'}</span>`).join('')}</div></div>
        ${pays.rows.length ? `<div class="table-responsive"><table class="table-fb"><thead><tr><th>Date</th><th>Business</th><th>Plan</th><th>Amount</th><th>Phone</th><th>Status</th><th>Ref</th><th></th></tr></thead><tbody>${pays.rows.map(p => `<tr><td>${fmtDateTime(p.paid_at || p.created_at)}</td><td>${esc(p.business)}</td><td>${PN[p.plan] || p.plan}${p.autopay ? ' <span class="muted small">(auto)</span>' : ''}</td><td>${p.method === 'grant' ? 'gift' : tzs(p.amount)}</td><td>${esc(p.phone_full || '—')}${p.network ? `<div class="small muted">${esc(p.network)}</div>` : ''}</td><td>${pill(...(PS[p.status] || [p.status, '']))}${p.failure_reason && p.status !== 'completed' ? `<div class="small muted">${esc(p.failure_reason)}</div>` : ''}</td><td class="mono">${esc(p.reference || '—')}</td><td>${p.status !== 'completed' && p.reference && p.method === 'mobile' ? `<button class="btn btn-sm btn-soft" data-rc="${p.id}" title="Ask Snippe again">Re-check</button>` : ''}</td></tr>`).join('')}</tbody></table></div><div id="pg"></div>` : empty('bi-receipt', 'No payments')}</div>
      <div class="fb-card"><h6><i class="bi bi-sliders me-1"></i>Pricing &amp; rules</h6>
        <div class="row g-3">${['daily', 'monthly', 'yearly', 'lifetime'].map(k => `<div class="col-6 col-lg-3"><label class="form-label small">${PN[k]} price (TZS)</label><input class="form-control" type="number" min="500" step="500" data-pr="${k}" value="${cfg.plans[k].price}"><div class="form-check form-switch mt-1"><input class="form-check-input" type="checkbox" data-en="${k}" ${cfg.plans[k].enabled ? 'checked' : ''}><label class="form-check-label small">Offer this plan</label></div></div>`).join('')}
          <div class="col-6 col-lg-3"><label class="form-label small">Free trial (days)</label><input class="form-control" type="number" min="0" max="365" id="sTrial" value="${cfg.trial_days}"><div class="small muted">Applies to businesses registered from now on.</div></div>
          <div class="col-6 col-lg-3"><label class="form-label small">Grace after expiry (days)</label><input class="form-control" type="number" min="0" max="30" id="sGrace" value="${cfg.grace_days}"><div class="small muted">Full access, with warnings. 0 = lock immediately.</div></div>
          <div class="col-12 col-lg-6"><label class="form-label small">Support contact shown to businesses</label><div class="row g-2"><div class="col-4"><input class="form-control" id="cN" value="${esc(cfg.contact.name)}"></div><div class="col-4"><input class="form-control" id="cP" value="${esc(cfg.contact.phone)}"></div><div class="col-4"><input class="form-control" id="cE" value="${esc(cfg.contact.email || '')}"></div></div></div>
          <div class="col-12 d-flex flex-wrap gap-4"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="sAuto" ${cfg.autopay_enabled ? 'checked' : ''}><label class="form-check-label">Allow auto-renew</label></div><div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="sPub" ${cfg.block_public_when_locked ? 'checked' : ''}><label class="form-check-label">Also stop website orders while a business is locked</label></div></div>
          <div class="col-12"><button class="btn btn-fb" id="sv"><i class="bi bi-check2 me-1"></i>Save pricing &amp; rules</button></div></div>
        <hr><h6 class="small"><i class="bi bi-plug me-1"></i>Snippe connection</h6><div class="small">${o.payments_ready ? '<i class="bi bi-check-circle-fill text-success me-1"></i>API key set' : '<i class="bi bi-x-circle-fill text-danger me-1"></i>API key missing'} · ${o.webhook_secret_set ? '<i class="bi bi-check-circle-fill text-success me-1"></i>Webhook secret set' : '<i class="bi bi-exclamation-circle-fill text-warning me-1"></i>Webhook secret not set (payments are still verified with Snippe)'}<br>Webhook URL to register in Snippe: <code>${esc(o.webhook_url || 'Set PUBLIC_API_URL in .env, e.g. https://api.fourbrothers.online/api/billing/webhook/snippe')}</code></div></div>`;
    host.querySelectorAll('[data-m]').forEach(b => b.onclick = () => billingModal(o.businesses.find(x => x.id == b.dataset.m), draw));
    host.querySelectorAll('[data-s]').forEach(c => c.onclick = () => { f.status = c.dataset.s; f.page = 1; draw(); });
    host.querySelectorAll('[data-rc]').forEach(b => b.onclick = async () => { b.disabled = true; try { const r = await post(`/developer/billing/payments/${b.dataset.rc}/recheck`, {}); ok('Checked with Snippe', `Status: ${r.payment.status}`); draw(); } catch (e) { fail(e); b.disabled = false; } });
    const pg = host.querySelector('#pg'); if (pg) { pg.className = 'd-flex justify-content-between align-items-center mt-2 small muted'; pager(pg, { total: pays.total, page: pays.page, limit: pays.limit }, n => { f.page = n; draw(); }); }
    host.querySelector('#sv').onclick = async () => {
      const plans = {}; ['daily', 'monthly', 'yearly', 'lifetime'].forEach(k => { plans[k] = { price: host.querySelector(`[data-pr="${k}"]`).value, enabled: host.querySelector(`[data-en="${k}"]`).checked }; });
      try { await put('/developer/billing/settings', { plans, trial_days: host.querySelector('#sTrial').value, grace_days: host.querySelector('#sGrace').value, autopay_enabled: host.querySelector('#sAuto').checked, block_public_when_locked: host.querySelector('#sPub').checked, contact: { name: host.querySelector('#cN').value, phone: host.querySelector('#cP').value, email: host.querySelector('#cE').value } }); ok('Saved', 'New prices apply to the next payment.'); draw(); } catch (e) { fail(e); }
    };
  };
  el.querySelector('#rf').onclick = draw; await draw();
}
