// AI assistant. Answers come from read-only data tools on the server; nothing is invented by the browser.
import { get, post } from '../api.js';
import { esc, empty } from '../ui.js';

const TOOL_LABEL = { get_period_summary: 'Sales summary', compare_periods: 'Period comparison', top_products: 'Top products', sales_by_employee: 'Sales by employee', low_stock: 'Low stock', expenses_breakdown: 'Expenses', business_health: 'Business health', sales_forecast: 'Forecast', top_customers: 'Top customers', supplier_payables: 'Supplier balances' };
const SUGGEST = ['How are sales this week compared with last week?', 'Which products are selling best this month?', 'What is running low on stock?', 'Who owes us money?', 'Where are my expenses going?', 'How healthy is the business?'];

// minimal, safe markdown: escape first, then apply **bold**, `code`, bullet/numbered lists, simple tables
function md(text) {
  const lines = esc(text).split('\n'); let out = '', list = null, tbl = [];
  const inline = s => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const closeList = () => { if (list) { out += `</${list}>`; list = null; } };
  const flushTbl = () => { if (!tbl.length) return; const rows = tbl.filter(r => !/^\s*\|?\s*:?-{2,}/.test(r)).map(r => r.replace(/^\s*\||\|\s*$/g, '').split('|').map(c => inline(c.trim())));
    out += `<div class="tbl-wrap my-2"><table class="fb-table"><thead><tr>${(rows[0] || []).map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; tbl = []; };
  for (const l of lines) {
    if (/^\s*\|.*\|\s*$/.test(l)) { closeList(); tbl.push(l); continue; } flushTbl();
    let m;
    if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { if (list !== 'ul') { closeList(); out += '<ul class="mb-1">'; list = 'ul'; } out += `<li>${inline(m[1])}</li>`; }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { closeList(); out += '<ol class="mb-1">'; list = 'ol'; } out += `<li>${inline(m[1])}</li>`; }
    else if ((m = l.match(/^#{1,4}\s+(.*)/))) { closeList(); out += `<div class="fw-bold mt-2">${inline(m[1])}</div>`; }
    else if (!l.trim()) closeList();
    else { closeList(); out += `<p class="mb-1">${inline(l)}</p>`; }
  }
  closeList(); flushTbl(); return out;
}

export async function render(el, ctx) {
  let st; try { st = await get('/b/ai/status'); } catch (e) { st = { available: false, error: e.message }; }
  if (!document.getElementById('aiCss')) document.head.insertAdjacentHTML('beforeend', `<style id="aiCss">.ai-wrap{display:flex;flex-direction:column;height:calc(100vh - 230px);min-height:420px}.ai-log{flex:1;overflow-y:auto;padding:4px 2px}.ai-msg{max-width:88%;margin:8px 0;padding:10px 14px;border-radius:14px;line-height:1.5;word-break:break-word}.ai-msg.u{margin-left:auto;background:var(--primary);color:var(--on-primary)}.ai-msg.a{background:var(--surface-2,rgba(127,127,127,.12))}.ai-msg.err{background:rgba(220,53,69,.15)}.ai-dots span{display:inline-block;width:7px;height:7px;margin:0 2px;border-radius:50%;background:var(--muted);animation:aiB 1s infinite}.ai-dots span:nth-child(2){animation-delay:.15s}.ai-dots span:nth-child(3){animation-delay:.3s}@keyframes aiB{0%,80%,100%{opacity:.25}40%{opacity:1}}</style>`);
  el.innerHTML = `<div class="page-head"><div><h1>AI assistant</h1><p>Ask about your sales, stock, expenses and customers in plain language. Answers are built only from your authorised business data.</p></div><div class="d-flex gap-2"><button class="btn btn-soft" id="sum"${st.available ? '' : ' disabled'}><i class="bi bi-journal-text me-1"></i>Generate summary</button><button class="btn btn-soft" id="new"><i class="bi bi-eraser me-1"></i>New chat</button></div></div><div id="body"></div>`;
  const body = el.querySelector('#body');
  if (!st.available) { body.innerHTML = `<div class="fb-card">${empty('bi-robot', 'The AI assistant is not set up yet', 'The platform Developer needs to add the AI connection. Until then, the Business health page gives you a score from fixed formulas.')}<div class="text-center"><a class="btn btn-fb" href="#/health">Open business health</a></div></div>`; return; }
  body.innerHTML = `<div class="fb-card ai-wrap"><div class="ai-log" id="log" aria-live="polite"></div><div class="chips my-2" id="sg">${SUGGEST.map(s => `<span class="chip" data-s="${esc(s)}">${esc(s)}</span>`).join('')}</div>
    <form id="f" class="d-flex gap-2"><input class="form-control" id="in" maxlength="1000" placeholder="Ask a question about your business…" autocomplete="off"><button class="btn btn-fb" id="go" type="submit"><i class="bi bi-send-fill"></i></button></form>
    <div class="small muted mt-2"><i class="bi bi-shield-check me-1"></i>The assistant only reads data you are allowed to see. Check important figures in Reports. Model: ${esc(st.model || '')}</div></div>`;
  const log = el.querySelector('#log'), input = el.querySelector('#in'), go = el.querySelector('#go');
  let hist = [], busy = false;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (cls, html) => { const d = document.createElement('div'); d.className = 'ai-msg ' + cls; d.innerHTML = html; log.appendChild(d); scroll(); return d; };
  const welcome = () => { log.innerHTML = ''; bubble('a', `Hi ${esc((ctx.profile.name || '').split(' ')[0])} 👋 Ask me anything about <b>${esc(ctx.biz.name)}</b>. I look up real figures before I answer.`); };
  async function ask(text, kind = 'chat') {
    if (busy) return; text = text.trim(); if (!text && kind === 'chat') return; busy = true; go.disabled = true; el.querySelector('#sg').style.display = 'none';
    const q = kind === 'summary' ? 'Give me a business briefing.' : text; bubble('u', esc(q)); input.value = '';
    const typing = bubble('a', '<span class="ai-dots"><span></span><span></span><span></span></span> <span class="small muted">Checking your data…</span>');
    try {
      const r = kind === 'summary' ? await post('/b/ai/summary') : await post('/b/ai/chat', { messages: [...hist, { role: 'user', content: text }].slice(-12) });
      if (kind === 'summary') hist.push({ role: 'user', content: q }); else hist.push({ role: 'user', content: text });
      hist.push({ role: 'assistant', content: r.answer });
      typing.innerHTML = md(r.answer) + (r.tools_used && r.tools_used.length ? `<div class="small muted mt-2"><i class="bi bi-database me-1"></i>Data used: ${r.tools_used.map(t => esc(TOOL_LABEL[t] || t)).join(' · ')}</div>` : '');
    } catch (e) {
      typing.className = 'ai-msg err'; typing.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i>${esc(e.status === 429 ? (e.message || 'Too many questions. Please wait a moment.') : e.status === 503 ? 'The assistant is unavailable right now.' : (e.message || 'Something went wrong.'))}`;
    }
    busy = false; go.disabled = false; scroll(); input.focus();
  }
  el.querySelector('#f').onsubmit = e => { e.preventDefault(); ask(input.value); };
  el.querySelectorAll('[data-s]').forEach(c => c.onclick = () => ask(c.dataset.s));
  el.querySelector('#sum').onclick = () => ask('', 'summary');
  el.querySelector('#new').onclick = () => { hist = []; welcome(); el.querySelector('#sg').style.display = ''; };
  welcome(); input.focus();
}
