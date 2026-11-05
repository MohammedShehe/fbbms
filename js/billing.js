// Billing UI shared by the whole app: status bar, "renew" popup, and the animated mobile-money payment flow.
import { get, post } from './api.js';
import { esc, openModal, toast, ok, fail, fmtDate, fmtDateTime, num } from './ui.js';
import { getBilling, setBilling, isLocked, setBlockHandler, onBilling } from './billing-state.js';

const cur = () => (getBilling() && getBilling().currency) || 'TZS';
export const tzs = n => `${cur()} ${num(n)}`;
export const contact = () => (getBilling() && getBilling().contact) || { name: 'MO11', phone: '+255 677 532 140', email: 'developer@fourbrothers.online' };
const tel = p => String(p || '').replace(/[^\d+]/g, '');
const waLink = (txt = '') => `https://wa.me/${tel(contact().phone).replace('+', '')}${txt ? `?text=${encodeURIComponent(txt)}` : ''}`;

export const PLAN_ICON = { daily: 'bi-sun', monthly: 'bi-calendar2-check', yearly: 'bi-calendar-heart', lifetime: 'bi-infinity' };
export const PLAN_NAME = { daily: 'Daily', monthly: 'Monthly', yearly: 'Yearly', lifetime: 'One-time' };

export function networkOf(raw) {
  let d = String(raw || '').replace(/\D/g, ''); if (d.startsWith('255')) d = d.slice(3); else if (d.startsWith('0')) d = d.slice(1);
  if (d.length < 2) return ''; const p = d.slice(0, 2);
  if (['74', '75', '76'].includes(p)) return 'M-Pesa'; if (['71', '65', '67', '77'].includes(p)) return 'Mixx by Yas';
  if (['68', '69', '78'].includes(p)) return 'Airtel Money'; if (p === '62') return 'HaloPesa'; if (p === '73') return 'T-Pesa'; return '';
}
export const phoneValid = raw => { let d = String(raw || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('255')) d = d.slice(3); else if (d.startsWith('0')) d = d.slice(1); return /^[67]\d{8}$/.test(d); };

/* ---------------- state refresh ---------------- */
let ctxRef = null;
export async function refreshBilling() {
  if (!ctxRef || !ctxRef.biz) return null;
  try {
    const b = await get('/b/billing/status');
    setBilling(ctxRef.isDev ? { ...b, locked: false, devView: b.locked } : b);
    if (ctxRef.biz) ctxRef.biz.billing = b;
    renderBar(); return b;
  } catch (_) { return null; }
}

/* ---------------- top status bar ---------------- */
const dayWord = n => `${n} day${n === 1 ? '' : 's'}`;
export function renderBar() {
  const el = document.getElementById('billBar'); if (!el || !ctxRef) return;
  const b = getBilling(); const sup = ctxRef.isSuper && !ctxRef.isDev; const c = contact();
  if (!ctxRef.biz || !b) { el.innerHTML = ''; el.className = 'bill-bar'; return; }
  const btn = sup ? '<button class="btn btn-sm bill-cta" data-bill-go><i class="bi bi-lightning-charge-fill me-1"></i>Renew now</button>' : '';
  const help = `<a class="bill-help" href="tel:${tel(c.phone)}"><i class="bi bi-telephone-fill me-1"></i>${esc(c.name)} ${esc(c.phone)}</a>`;
  let cls = '', html = '';
  if (b.devView || (ctxRef.isDev && b.state === 'expired')) { cls = 'danger'; html = `<i class="bi bi-eye-fill"></i><div class="flex-grow-1"><b>Developer view:</b> this business is unpaid, so its admins are read-only. You are not blocked.</div>`; }
  else if (b.state === 'expired') { cls = 'danger'; html = `<i class="bi bi-lock-fill bill-lock"></i><div class="flex-grow-1"><b>Read-only mode.</b> ${b.was_trial ? 'Your free trial has ended' : 'Your subscription has expired'}. You can view everything, but adding, editing, exporting and downloading are paused. ${sup ? '' : 'Ask your Super Admin to renew. '}${help}</div>${btn}`; }
  else if (b.state === 'grace') { cls = 'warn'; html = `<i class="bi bi-hourglass-split"></i><div class="flex-grow-1"><b>Payment overdue.</b> You have about ${dayWord(Math.max(1, Math.ceil((b.grace_hours_left || 24) / 24)))} left before the shop becomes read-only. ${sup ? '' : 'Ask your Super Admin to renew. '}${help}</div>${btn}`; }
  else if ((b.state === 'trial' || b.state === 'active') && b.days_left <= 7) { cls = b.days_left <= 3 ? 'warn' : 'info'; html = `<i class="bi bi-clock-history"></i><div class="flex-grow-1"><b>${b.state === 'trial' ? 'Free trial' : 'Your plan'} ends in ${dayWord(b.days_left)}</b> (${fmtDate(b.access_until)}). ${sup ? 'Renew to keep everything running.' : 'Remind your Super Admin to renew.'}</div>${btn}`; }
  else if (b.state === 'trial' && sup && !sessionStorage.getItem('fb_trial_hide_' + b.days_left)) { cls = 'info slim'; html = `<i class="bi bi-gift-fill"></i><div class="flex-grow-1">Free trial: <b>${dayWord(b.days_left)}</b> left. Everything is unlocked.</div><a href="#/billing" class="bill-link">See plans</a><button class="bill-x" data-bill-x aria-label="Dismiss"><i class="bi bi-x-lg"></i></button>`; }
  el.className = 'bill-bar ' + cls + (html ? ' show' : ''); el.innerHTML = html;
  const go = el.querySelector('[data-bill-go]'); if (go) go.onclick = () => { location.hash = '#/billing'; };
  const x = el.querySelector('[data-bill-x]'); if (x) x.onclick = () => { sessionStorage.setItem('fb_trial_hide_' + b.days_left, '1'); renderBar(); };
}

/* ---------------- "renew" popup (shown when someone tries to add / export while locked) ---------------- */
let paywallOpen = false;
export function openPaywall(kind = 'write') {
  if (paywallOpen || !ctxRef) return; paywallOpen = true;
  const b = getBilling() || {}; const sup = ctxRef.isSuper; const c = contact();
  const what = kind === 'export' ? 'Exporting and downloading data' : 'Adding or changing data';
  const m = openModal({ title: '<span class="pw-title"><i class="bi bi-lock-fill me-2"></i>Subscription needed</span>', size: 'modal-sm', body: `
    <div class="pw-hero"><div class="pw-lock"><i class="bi bi-lock-fill"></i></div></div>
    <p class="text-center mb-1"><b>${what} is paused</b></p>
    <p class="text-center muted small mb-3">${b.was_trial ? 'Your free trial has ended.' : 'Your subscription has expired.'} Your data is safe and you can still view everything.</p>
    ${sup ? '<button class="btn btn-fb w-100 mb-2" id="pwPay"><i class="bi bi-lightning-charge-fill me-1"></i>Renew with mobile money</button>' : '<div class="alert-fb small mb-2">Please ask your Super Admin to renew the subscription.</div>'}
    <div class="d-flex gap-2"><a class="btn btn-soft flex-fill" href="tel:${tel(c.phone)}"><i class="bi bi-telephone me-1"></i>Call</a><a class="btn btn-soft flex-fill" target="_blank" rel="noopener" href="${waLink('Hello ' + c.name + ', I need help with my FBBMS subscription.')}"><i class="bi bi-whatsapp me-1"></i>WhatsApp</a></div>
    <div class="text-center small muted mt-2">${esc(c.name)} · ${esc(c.phone)}</div>` });
  m.el.addEventListener('hidden.bs.modal', () => { paywallOpen = false; });
  const p = m.el.querySelector('#pwPay'); if (p) p.onclick = () => { m.close(); location.hash = '#/billing'; };
}

/* ---------------- animated payment flow ---------------- */
function confetti(host) {
  const colors = ['#18E0A6', '#E0A64C', '#7C6FF0', '#F0555A', '#4cc9f0', '#f1d98a'];
  host.insertAdjacentHTML('beforeend', `<div class="confetti">${Array.from({ length: 36 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${(Math.random() * .5).toFixed(2)}s;animation-duration:${(1.6 + Math.random() * 1.4).toFixed(2)}s;transform:rotate(${Math.floor(Math.random() * 360)}deg)"></i>`).join('')}</div>`);
}

/** Opens the pay modal for a plan. If `follow` is a payment id, goes straight to the "waiting" screen for it. */
export function payModal({ plan, onDone, follow = null, defaultPhone = '' }) {
  let timer = null, tick = null, closed = false, pay = null;
  const m = openModal({ title: '<span><i class="bi bi-phone-fill me-2"></i>Pay with mobile money</span>', body: '<div id="pmBody"></div>' });
  const body = m.el.querySelector('#pmBody');
  m.el.addEventListener('hidden.bs.modal', () => { closed = true; clearTimeout(timer); clearInterval(tick); });
  const stopAll = () => { clearTimeout(timer); clearInterval(tick); };

  const form = (err = '') => {
    stopAll(); const p = plan;
    body.innerHTML = `<div class="pm-sum"><div class="pm-ic"><i class="bi ${PLAN_ICON[p.key] || 'bi-star'}"></i></div><div class="flex-grow-1"><div class="fw-bold">${esc(PLAN_NAME[p.key] || p.label)} plan</div><div class="small muted">${p.one_time ? 'Pay once, use forever' : p.days === 1 ? 'Access for 1 day' : `Access for ${p.days} days`}</div></div><div class="pm-amt">${tzs(p.price)}</div></div>
      <label class="form-label mt-3">Mobile-money number</label>
      <div class="input-group"><span class="input-group-text">+255</span><input class="form-control" id="pmPhone" inputmode="tel" placeholder="7XX XXX XXX" autocomplete="tel" value="${esc(defaultPhone)}"></div>
      <div class="small mt-1" style="min-height:20px"><span id="pmNet" class="pm-net"></span></div>
      ${err ? `<div class="alert-fb small mt-2 pm-shake"><i class="bi bi-exclamation-triangle me-1"></i>${esc(err)}</div>` : ''}
      <div class="pm-brands mt-2"><span>M-Pesa</span><span>Mixx by Yas</span><span>Airtel Money</span><span>HaloPesa</span></div>
      <div class="small muted mt-3"><i class="bi bi-shield-lock me-1"></i>We send a payment request to your phone. Enter your mobile-money PIN to approve. We never see your PIN.</div>
      <button class="btn btn-fb w-100 mt-3" id="pmGo"><i class="bi bi-send-fill me-1"></i>Send payment request</button>`;
    const inp = body.querySelector('#pmPhone'); const net = body.querySelector('#pmNet');
    const upd = () => { const n = networkOf(inp.value); net.innerHTML = phoneValid(inp.value) ? `<i class="bi bi-check-circle-fill text-success me-1"></i>${esc(n || 'Mobile money')}` : (inp.value ? '<span class="muted">Enter a valid number, e.g. 0712 345 678</span>' : ''); };
    inp.oninput = upd; upd(); setTimeout(() => inp.focus(), 250);
    inp.onkeydown = e => { if (e.key === 'Enter') body.querySelector('#pmGo').click(); };
    body.querySelector('#pmGo').onclick = async () => {
      if (!phoneValid(inp.value)) { form('Enter a valid Tanzanian mobile-money number'); return; }
      const go = body.querySelector('#pmGo'); go.disabled = true; go.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Contacting your network…';
      try { const r = await post('/b/billing/checkout', { plan: plan.key, phone: inp.value }); pay = r.payment; waiting(); }
      catch (e) { form(e.message); }
    };
  };

  const waiting = () => {
    stopAll(); const exp = pay.expires_at ? new Date(pay.expires_at).getTime() : Date.now() + 4 * 3600e3; const started = Date.now();
    body.innerHTML = `<div class="pm-wait"><div class="pm-phone"><span class="ring r1"></span><span class="ring r2"></span><span class="ring r3"></span><div class="ph"><i class="bi bi-phone-vibrate-fill"></i></div></div>
      <h5 class="mt-3 mb-1">Check your phone</h5>
      <div class="muted">Approve <b>${tzs(pay.amount)}</b> on <b>${esc(pay.phone || '')}</b>${pay.network ? ` (${esc(pay.network)})` : ''} by entering your PIN.</div>
      <ul class="pm-steps"><li class="done"><i class="bi bi-check-circle-fill"></i>Request sent</li><li class="now"><span class="spinner-border spinner-border-sm"></span>Waiting for your approval<small id="pmT"></small></li><li><i class="bi bi-circle"></i>Payment confirmed</li></ul>
      <div class="d-flex gap-2 justify-content-center flex-wrap"><button class="btn btn-soft btn-sm" id="pmResend"><i class="bi bi-arrow-repeat me-1"></i>Resend prompt</button><button class="btn btn-soft btn-sm" id="pmChange"><i class="bi bi-pencil me-1"></i>Change number</button></div>
      <div class="small muted mt-3" id="pmHint">No prompt? Dial your network’s menu (e.g. *150*00#) and check “Pending payments”.</div></div>`;
    tick = setInterval(() => { const s = Math.floor((Date.now() - started) / 1000); const el = body.querySelector('#pmT'); if (el) el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 1000);
    body.querySelector('#pmResend').onclick = async e => { const b = e.currentTarget; b.disabled = true; try { await post(`/b/billing/payments/${pay.id}/resend`, {}); ok('Prompt sent again', 'Check your phone.'); } catch (er) { fail(er); } setTimeout(() => { b.disabled = false; }, 15000); };
    body.querySelector('#pmChange').onclick = () => form();
    const poll = async () => {
      if (closed) return;
      try {
        const r = await get(`/b/billing/payments/${pay.id}`); pay = r.payment;
        if (pay.status === 'completed') { await success(r.summary); return; }
        if (['failed', 'expired', 'voided'].includes(pay.status)) { failed(); return; }
        if (Date.now() > exp) { failed('The payment request expired. Please try again.'); return; }
      } catch (_) { /* keep trying */ }
      timer = setTimeout(poll, 3000);
    };
    timer = setTimeout(poll, 2500);
  };

  const success = async summary => {
    stopAll(); if (summary) setBilling(ctxRef && ctxRef.isDev ? { ...summary, locked: false } : summary); else await refreshBilling(); renderBar();
    const until = pay.plan === 'lifetime' ? 'Forever' : fmtDate(pay.period_end);
    body.innerHTML = `<div class="pm-done"><div class="pm-check"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" fill="none"/><path fill="none" d="M14 27l8 8 16-17"/></svg></div>
      <h4 class="mt-3 mb-1">Payment received 🎉</h4><div class="muted">Thank you! Your shop is fully unlocked.</div>
      <div class="pm-recap"><div><span>Plan</span><b>${esc(PLAN_NAME[pay.plan] || pay.plan)}</b></div><div><span>Paid</span><b>${tzs(pay.amount)}</b></div><div><span>Access until</span><b>${until}</b></div>${pay.reference ? `<div><span>Reference</span><b class="mono">${esc(pay.reference)}</b></div>` : ''}</div>
      <button class="btn btn-fb w-100 mt-3" id="pmClose">Continue</button></div>`;
    confetti(body.querySelector('.pm-done')); body.querySelector('#pmClose').onclick = () => m.close();
    if (onDone) onDone();
  };
  const failed = reason => {
    stopAll();
    body.innerHTML = `<div class="pm-fail"><div class="pm-x"><i class="bi bi-x-lg"></i></div><h5 class="mt-3 mb-1">Payment not completed</h5><div class="muted">${esc(reason || (pay && pay.failure_reason) || 'The request was declined, cancelled or timed out.')}</div><div class="small muted mt-2">If money left your account, it will be confirmed automatically within a few minutes. Questions? ${esc(contact().name)} ${esc(contact().phone)}</div><button class="btn btn-fb w-100 mt-3" id="pmAgain"><i class="bi bi-arrow-repeat me-1"></i>Try again</button></div>`;
    body.querySelector('#pmAgain').onclick = () => form();
  };

  if (follow) { get(`/b/billing/payments/${follow}`).then(r => { pay = r.payment; if (pay.status === 'pending') waiting(); else if (pay.status === 'completed') success(r.summary); else form(); }).catch(() => form()); }
  else form();
  return m;
}

/* ---------------- wiring ---------------- */
let inited = false;
export function initBilling(ctx) {
  ctxRef = ctx;
  if (inited) return; inited = true;
  setBlockHandler(kind => openPaywall(kind));
  document.addEventListener('billing:refresh', () => refreshBilling());
  onBilling(() => renderBar());
  // plans can end while the app is open: re-check regularly
  setInterval(() => { if (ctxRef && ctxRef.biz && !document.hidden) refreshBilling(); }, 5 * 60 * 1000);
  // printing is also a way of getting data out: blocked while locked
  window.__origPrint = window.print.bind(window);
  window.print = () => { if (isLocked()) { openPaywall('export'); return; } window.__origPrint(); };
}
export const setBillingFromBusiness = (ctx, b) => { setBilling(ctx.isDev ? { ...b, locked: false, devView: b.locked } : b); renderBar(); };
export { contact as billingContact, waLink };
