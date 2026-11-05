// Billing & plan: status, plans, mobile-money checkout, auto-renew, payment history, developer support.
import { get, put } from '../api.js';
import { esc, fmtDate, fmtDateTime, empty, skeleton, fail, ok, pill, num } from '../ui.js';
import { payModal, refreshBilling, tzs, contact, waLink, networkOf, phoneValid, PLAN_ICON, PLAN_NAME } from '../billing.js';
import { getBilling } from '../billing-state.js';

const STATE = {
  trial: ['Free trial', 'info', 'bi-gift-fill'], active: ['Active', 'success', 'bi-patch-check-fill'], grace: ['Payment overdue', 'warning', 'bi-hourglass-split'],
  expired: ['Read-only', 'danger', 'bi-lock-fill'], lifetime: ['Lifetime access', 'success', 'bi-infinity'], exempt: ['Complimentary', 'success', 'bi-gift-fill']
};
const PSTATUS = { completed: ['Paid', 'success'], pending: ['Waiting', 'warning'], failed: ['Failed', 'danger'], expired: ['Expired', 'danger'], voided: ['Cancelled', 'danger'] };

function ring(b) {
  const total = b.state === 'trial' ? Math.max(30, b.days_left || 0) : (b.plan === 'daily' ? 1 : b.plan === 'yearly' ? 365 : 30);
  const left = b.days_left || 0; const pct = b.locked ? 0 : (b.state === 'lifetime' || b.state === 'exempt') ? 100 : Math.max(4, Math.min(100, Math.round(left / total * 100)));
  const r = 54, c = 2 * Math.PI * r; const col = b.locked ? 'var(--danger,#F0555A)' : left <= 3 && b.access_until ? 'var(--warning,#E0A64C)' : 'var(--primary,#18E0A6)';
  const big = b.state === 'lifetime' ? '∞' : b.state === 'exempt' ? '✓' : b.locked ? '0' : (b.days_left <= 1 && b.hours_left && b.hours_left < 24 ? b.hours_left : b.days_left);
  const unit = b.state === 'lifetime' || b.state === 'exempt' ? 'forever' : b.locked ? 'days left' : (b.days_left <= 1 && b.hours_left && b.hours_left < 24 ? 'hours left' : (b.days_left === 1 ? 'day left' : 'days left'));
  return `<div class="bill-ring"><svg viewBox="0 0 128 128"><circle cx="64" cy="64" r="${r}" class="bg"/><circle cx="64" cy="64" r="${r}" class="fg" style="stroke:${col};stroke-dasharray:${c.toFixed(1)};stroke-dashoffset:${c.toFixed(1)}" data-to="${(c * (1 - pct / 100)).toFixed(1)}"/></svg><div class="mid"><div class="n">${big}</div><div class="u">${unit}</div></div></div>`;
}

export async function render(el, ctx) {
  el.innerHTML = `<div class="page-head"><div><h1>Billing &amp; plan</h1><p>Your subscription, payments and auto-renew.</p></div></div><div id="bb">${skeleton(6, 70)}</div>`;
  const host = el.querySelector('#bb');
  const sup = ctx.isSuper && !ctx.isDev;
  const c = contact();

  const draw = async () => {
    let plansRes, hist = [];
    try { await refreshBilling(); plansRes = await get('/b/billing/plans'); if (ctx.isSuper) hist = await get('/b/billing/payments'); }
    catch (e) { host.innerHTML = `<div class="text-danger">${esc(e.message)}</div>`; return; }
    const b = getBilling(); const st = STATE[b.state] || STATE.active; const lock = b.locked || b.devView;
    const sb = b.devView ? 'expired' : b.state;
    const until = b.state === 'lifetime' ? 'Never expires' : b.state === 'exempt' ? 'Complimentary access' : b.access_until ? fmtDateTime(b.access_until) : '—';
    const pendingId = b.pending_payment_id;

    const plans = plansRes.plans.map(p => `<div class="col-12 col-md-6 col-xl-3"><div class="plan-card ${p.popular ? 'pop' : ''} ${p.one_time ? 'life' : ''}" data-plan="${p.key}">
        ${p.popular ? '<span class="plan-badge">Most popular</span>' : p.saving_amount ? `<span class="plan-badge alt">Save ${tzs(p.saving_amount)}</span>` : p.one_time ? '<span class="plan-badge life">Best long-term</span>' : ''}
        <div class="plan-ic"><i class="bi ${PLAN_ICON[p.key] || 'bi-star'}"></i></div>
        <div class="plan-name">${esc(PLAN_NAME[p.key] || p.label)}</div>
        <div class="plan-price"><span>${esc(plansRes.currency)}</span> ${num(p.price)}</div>
        <div class="plan-per">${p.one_time ? 'one-time payment' : p.key === 'daily' ? 'per day' : p.key === 'monthly' ? 'per month (30 days)' : 'per year (365 days)'}</div>
        <ul class="plan-list"><li><i class="bi bi-check2"></i>Everything unlocked</li><li><i class="bi bi-check2"></i>${p.one_time ? 'No renewals, ever' : p.key === 'daily' ? 'Pay only on days you need' : p.key === 'yearly' ? `Just ${tzs(p.per_month)} per month` : 'Auto-renew available'}</li><li><i class="bi bi-check2"></i>Support from ${esc(c.name)}</li></ul>
        <button class="btn ${p.popular ? 'btn-fb' : 'btn-soft'} w-100" data-pay="${p.key}" ${sup && !b.lifetime ? '' : 'disabled'}>${b.lifetime ? 'You have this' : p.one_time ? 'Pay once' : 'Choose plan'}</button></div></div>`).join('');

    const ap = b.autopay || {};
    host.innerHTML = `
      <div class="fb-card bill-hero ${lock ? 'is-lock' : ''}"><div class="row g-3 align-items-center">
        <div class="col-auto">${ring(b.devView ? { ...b, state: 'expired', locked: true } : b)}</div>
        <div class="col"><div class="d-flex align-items-center gap-2 flex-wrap mb-1"><span class="bill-state ${b.devView ? 'danger' : st[1]}"><i class="bi ${b.devView ? 'bi-lock-fill' : st[2]} me-1"></i>${b.devView ? 'Read-only (developer bypass)' : st[0]}</span>${b.plan && !b.lifetime ? pill(`Last plan: ${PLAN_NAME[b.plan] || b.plan}`) : ''}${ap.enabled ? '<span class="bill-state success"><i class="bi bi-arrow-repeat me-1"></i>Auto-renew on</span>' : ''}</div>
          <div class="h4 mb-1">${sb === 'expired' ? (b.was_trial ? 'Your free trial has ended' : 'Your subscription has expired') : sb === 'grace' ? 'Please renew now' : b.state === 'trial' ? 'You are on the free trial' : b.state === 'lifetime' ? 'You have lifetime access 🎉' : b.state === 'exempt' ? 'Complimentary access' : 'Your plan is active'}</div>
          <div class="muted">${b.state === 'lifetime' || b.state === 'exempt' ? until : `${lock ? 'Ended' : 'Access until'} <b>${until}</b>`}</div>
          ${lock ? '<div class="small mt-2 text-danger-emphasis"><i class="bi bi-eye me-1"></i>You can still view all your data. Adding, editing, exporting and downloading are paused until you renew.</div>' : ''}
          ${pendingId && sup ? `<button class="btn btn-sm btn-soft mt-2" id="fp"><i class="bi bi-phone-vibrate me-1"></i>A payment is waiting for approval. Open it</button>` : ''}
          ${!sup && !ctx.isDev ? `<div class="alert-fb small mt-2"><i class="bi bi-info-circle me-1"></i>Only the Super Admin can pay. Please ask them to renew.</div>` : ''}</div>
      </div></div>

      ${b.lifetime ? '' : `<div class="d-flex align-items-end justify-content-between mt-4 mb-2"><div><h5 class="mb-0">Choose a plan</h5><div class="small muted">Pay with M-Pesa, Mixx by Yas, Airtel Money or HaloPesa. Paying early never wastes time, it is added on top of what you have left.</div></div></div>
      ${plansRes.payments_ready ? '' : '<div class="alert-fb mb-2"><i class="bi bi-exclamation-triangle me-1"></i>Online payment is being set up. Please pay through the developer below for now.</div>'}
      <div class="row g-3">${plans}</div>`}

      ${sup && plansRes.autopay_available && !b.lifetime ? `<div class="fb-card mt-4" id="apCard"><div class="d-flex align-items-start gap-3"><div class="pm-ic"><i class="bi bi-arrow-repeat"></i></div><div class="flex-grow-1">
        <div class="d-flex justify-content-between align-items-center"><div><h5 class="mb-0">Auto-renew</h5><div class="small muted">We send the payment request to your phone just before your plan ends. You only enter your PIN.</div></div>
        <div class="form-check form-switch fs-4 mb-0"><input class="form-check-input" type="checkbox" id="apOn" ${ap.enabled ? 'checked' : ''}></div></div>
        <div id="apForm" class="row g-2 mt-2 ${ap.enabled ? '' : 'd-none'}"><div class="col-12 col-md-4"><label class="form-label small">Renew with</label><select class="form-select" id="apPlan">${plansRes.plans.filter(p => !p.one_time).map(p => `<option value="${p.key}" ${ap.plan === p.key || (!ap.plan && p.key === 'monthly') ? 'selected' : ''}>${esc(PLAN_NAME[p.key])} · ${tzs(p.price)}</option>`).join('')}</select></div>
        <div class="col-12 col-md-5"><label class="form-label small">Mobile-money number</label><input class="form-control" id="apPhone" inputmode="tel" placeholder="${ap.phone ? esc(ap.phone) : '07XX XXX XXX'}"><div class="small mt-1" id="apNet" style="min-height:18px"></div></div>
        <div class="col-12 col-md-3 d-flex align-items-end"><button class="btn btn-fb w-100" id="apSave"><i class="bi bi-check2-circle me-1"></i>Save</button></div></div>
        ${ap.enabled ? `<div class="small mt-2"><i class="bi bi-check-circle-fill text-success me-1"></i>Auto-renew is on: ${esc(PLAN_NAME[ap.plan] || '')} plan, prompt to ${esc(ap.phone || '')}. Mobile networks need your PIN for every payment, so keep your phone nearby.</div>` : ''}
      </div></div></div>` : ''}

      ${sup ? `<div class="fb-card mt-4"><h5 class="mb-3">Payment history</h5>${hist.length ? `<div class="table-responsive"><table class="table-fb"><thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Phone</th><th>Status</th><th>Covers until</th></tr></thead><tbody>${hist.map(h => { const s = PSTATUS[h.status] || [h.status, '']; return `<tr><td>${fmtDateTime(h.paid_at || h.created_at)}</td><td>${esc(PLAN_NAME[h.plan] || h.plan)}${h.autopay ? ' <span class="muted small">(auto)</span>' : ''}${h.method === 'manual' ? ' <span class="muted small">(recorded)</span>' : h.method === 'grant' ? ' <span class="muted small">(gift)</span>' : ''}</td><td>${h.method === 'grant' ? '—' : tzs(h.amount)}</td><td>${esc(h.phone || '—')}${h.network ? `<div class="small muted">${esc(h.network)}</div>` : ''}</td><td>${pill(s[0], s[1])}${h.failure_reason && h.status !== 'completed' ? `<div class="small muted">${esc(h.failure_reason)}</div>` : ''}</td><td>${h.plan === 'lifetime' && h.status === 'completed' ? 'Forever' : h.period_end ? fmtDate(h.period_end) : '—'}</td></tr>`; }).join('')}</tbody></table></div>` : empty('bi-receipt', 'No payments yet', 'Your payments will appear here.')}</div>` : ''}

      <div class="fb-card mt-4 bill-support"><div class="d-flex align-items-center gap-3 flex-wrap"><div class="pm-ic"><i class="bi bi-headset"></i></div><div class="flex-grow-1"><div class="fw-bold">Need help, want to pay by cash, or have a question?</div><div class="muted small">Talk to the developer, ${esc(c.name)}. Cash and bank payments are recorded for you on the spot.</div></div>
        <div class="d-flex gap-2 flex-wrap"><a class="btn btn-soft" href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ''))}"><i class="bi bi-telephone me-1"></i>${esc(c.phone)}</a><a class="btn btn-soft" target="_blank" rel="noopener" href="${waLink('Hello ' + c.name + ', I need help with my FBBMS subscription.')}"><i class="bi bi-whatsapp me-1"></i>WhatsApp</a>${c.email ? `<a class="btn btn-soft" href="mailto:${esc(c.email)}"><i class="bi bi-envelope me-1"></i>Email</a>` : ''}</div></div></div>`;

    // animate the ring
    requestAnimationFrame(() => requestAnimationFrame(() => host.querySelectorAll('.bill-ring .fg').forEach(f => { f.style.strokeDashoffset = f.dataset.to; })));
    const open = (key, follow) => { const p = plansRes.plans.find(x => x.key === key); payModal({ plan: p || { key: 'monthly', price: 0, days: 30 }, follow, onDone: () => setTimeout(draw, 400) }); };
    host.querySelectorAll('[data-pay]').forEach(btn => btn.onclick = () => open(btn.dataset.pay));
    const fp = host.querySelector('#fp'); if (fp) fp.onclick = () => open('monthly', pendingId);

    const on = host.querySelector('#apOn');
    if (on) {
      const form = host.querySelector('#apForm'); const phone = host.querySelector('#apPhone'); const net = host.querySelector('#apNet');
      phone.oninput = () => { net.innerHTML = phoneValid(phone.value) ? `<i class="bi bi-check-circle-fill text-success me-1"></i>${esc(networkOf(phone.value) || 'Mobile money')}` : ''; };
      on.onchange = async () => {
        if (!on.checked) { try { await put('/b/billing/autopay', { enabled: false }); ok('Auto-renew is off'); draw(); } catch (e) { fail(e); on.checked = true; } return; }
        form.classList.remove('d-none'); phone.focus();
      };
      host.querySelector('#apSave').onclick = async () => {
        if (!phoneValid(phone.value)) { fail({ message: 'Enter a valid Tanzanian mobile-money number' }); return; }
        try { await put('/b/billing/autopay', { enabled: true, plan: host.querySelector('#apPlan').value, phone: phone.value }); ok('Auto-renew is on', 'We will send the request to your phone before your plan ends.'); draw(); } catch (e) { fail(e); }
      };
    }
  };

  const off = ctx.on ? (() => { ctx.on('billing.changed', () => draw()); })() : null; void off;
  await draw();
}
