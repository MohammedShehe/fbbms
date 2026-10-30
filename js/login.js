import { api, session } from './api.js';
import { applyTheme, $ } from './ui.js';

$('#yr').textContent = new Date().getFullYear();
if (session.token) location.replace('app.html');
if (new URLSearchParams(location.search).has('expired')) showErr('Your session ended. Please sign in again.');

api('/auth/theme', { auth: false }).then(t => { applyTheme(t); $('#platName').textContent = t.name || 'FBBMS'; }).catch(() => {});

function showErr(m, n = '') { const b = $('#err' + n); $('#errText' + n).textContent = m; b.classList.remove('d-none'); }
function hideErr() { $('#err').classList.add('d-none'); $('#err2').classList.add('d-none'); }
function busy(btn, on) { btn.disabled = on; btn.querySelector('.label').innerHTML = on ? '<span class="spinner-border spinner-border-sm me-2"></span>Please wait…' : btn.dataset.label; }
['loginBtn', 'otpBtn'].forEach(id => { const b = $('#' + id); b.dataset.label = b.querySelector('.label').textContent; });

$('#eye').onclick = () => { const p = $('#pw'); const s = p.type === 'password'; p.type = s ? 'text' : 'password'; $('#eye i').className = 'bi ' + (s ? 'bi-eye-slash' : 'bi-eye'); };

let challenge = null;
async function finish(res) {
  session.token = res.token;
  const prev = session.biz; const list = res.profile.memberships.map(m => m.business.id);
  session.biz = list.includes(prev) ? prev : (list[0] || null);
  location.replace('app.html');
}

$('#loginForm').onsubmit = async e => {
  e.preventDefault(); hideErr();
  const email = $('#email').value.trim(), password = $('#pw').value;
  if (!email || !password) return showErr('Enter your email and password');
  busy($('#loginBtn'), true);
  try {
    const r = await api('/auth/login', { method: 'POST', body: { email, password }, auth: false });
    if (r.otp_required) { challenge = r.challenge; $('#otpEmail').textContent = r.email; $('#stepLogin').classList.add('d-none'); $('#stepOtp').classList.remove('d-none'); $('#otpBoxes input')?.focus(); }
    else await finish(r);
  } catch (err) { showErr(err.message); } finally { busy($('#loginBtn'), false); }
};

// 6 OTP boxes with paste support
const boxes = $('#otpBoxes');
boxes.innerHTML = Array.from({ length: 6 }, () => '<input inputmode="numeric" maxlength="1" autocomplete="one-time-code">').join('');
const ins = [...boxes.children];
ins.forEach((el, i) => {
  el.oninput = () => { el.value = el.value.replace(/\D/g, ''); if (el.value && ins[i + 1]) ins[i + 1].focus(); if (ins.every(x => x.value)) verify(); };
  el.onkeydown = e => { if (e.key === 'Backspace' && !el.value && ins[i - 1]) ins[i - 1].focus(); };
  el.onpaste = e => { const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6); if (!t) return; e.preventDefault(); t.split('').forEach((c, j) => { ins[j].value = c; }); (ins[t.length] || ins[5]).focus(); if (t.length === 6) verify(); };
});
async function verify() {
  hideErr(); const otp = ins.map(i => i.value).join(''); if (otp.length < 6) return showErr('Enter all 6 digits', '2');
  busy($('#otpBtn'), true);
  try { await finish(await api('/auth/verify-otp', { method: 'POST', body: { challenge, otp }, auth: false })); }
  catch (err) { showErr(err.message, '2'); ins.forEach(i => { i.value = ''; }); ins[0].focus(); } finally { busy($('#otpBtn'), false); }
}
$('#otpBtn').onclick = verify;
$('#backLink').onclick = e => { e.preventDefault(); $('#stepOtp').classList.add('d-none'); $('#stepLogin').classList.remove('d-none'); };
let cool = 0;
$('#resend').onclick = async e => {
  e.preventDefault(); if (cool) return;
  try { const r = await api('/auth/resend-otp', { method: 'POST', body: { challenge }, auth: false }); challenge = r.challenge; cool = 30; const t = setInterval(() => { cool--; $('#resend').textContent = cool ? `Resend in ${cool}s` : 'Resend code'; if (!cool) clearInterval(t); }, 1000); }
  catch (err) { showErr(err.message, '2'); }
};
