// Super Admin: API keys and webhooks for the public API (/api/v1).
import { get, post, put, del } from '../api.js';
import { API_ORIGIN } from '../config.js';
import { esc, num, openModal, fail, ok, pill, ago, fmtDateTime, empty, skeleton, confirmBox } from '../ui.js';

const copy = t => { try { navigator.clipboard.writeText(t); ok('Copied'); } catch { /* ignore */ } };
const secretModal = (title, note, secret) => { const m = openModal({ title, body: `<p>${esc(note)}</p><div class="pw-box" style="word-break:break-all">${esc(secret)}</div><div class="alert alert-warning small mt-3 mb-0"><i class="bi bi-exclamation-triangle me-1"></i>This is the only time it is shown. Store it somewhere safe (never in public website code).</div>`, footer: '<button class="btn btn-fb" id="cp"><i class="bi bi-clipboard me-1"></i>Copy</button>' }); m.el.querySelector('#cp').onclick = () => copy(secret); return m; };

export async function render(el, ctx) {
  const base = `${API_ORIGIN}/api/v1`; let meta, keys = [], hooks = [];
  el.innerHTML = `<div class="page-head"><div><h1>API &amp; webhooks</h1><p>Let your website or app read your catalogue and send orders to ${esc(ctx.biz.short_name)}, and get notified when things happen.</p></div></div><div id="body">${skeleton(4, 70)}</div>`;
  const load = async () => { [meta, keys, hooks] = await Promise.all([get('/b/integrations/meta'), get('/b/integrations/keys'), get('/b/integrations/webhooks')]); draw(); };

  const draw = () => {
    const off = meta.policy && meta.policy.enabled === false;
    el.querySelector('#body').innerHTML = `${off ? '<div class="alert alert-warning"><i class="bi bi-exclamation-triangle me-1"></i>The public API is switched off platform-wide by the Developer. Keys will not work until it is turned back on.</div>' : ''}
    <div class="fb-card mb-3"><button class="btn btn-soft btn-sm" data-bs-toggle="collapse" data-bs-target="#qs"><i class="bi bi-rocket-takeoff me-1"></i>Quick start</button>
      <div class="collapse mt-3" id="qs"><div class="small muted mb-2">Base URL</div><div class="pw-box" style="word-break:break-all;font-size:.9rem">${esc(base)}</div>
      <div class="small muted mt-3 mb-1">1. Check the connection (no key needed)</div><pre class="p-2 small" style="background:rgba(127,127,127,.12);border-radius:8px;overflow:auto">curl ${esc(base)}/ping</pre>
      <div class="small muted mb-1">2. List products with your key (server-side)</div><pre class="p-2 small" style="background:rgba(127,127,127,.12);border-radius:8px;overflow:auto">curl -H "X-API-Key: fbk_live_…" ${esc(base)}/products</pre>
      <div class="small muted mb-1">3. From your website (list its address under “Allowed websites” first)</div><pre class="p-2 small" style="background:rgba(127,127,127,.12);border-radius:8px;overflow:auto">const r = await fetch('${esc(base)}/products', { headers: { 'X-API-Key': KEY } });\nconst { data } = await r.json();</pre>
      <div class="small">Full guide with examples for placing orders, tracking, errors, rate limits and verifying webhook signatures: <b>docs/PUBLIC_API.md</b> (included with the backend).</div></div></div>
    <div class="d-flex justify-content-between align-items-center mb-2"><h3 class="m-0">API keys</h3><button class="btn btn-fb btn-sm" id="nk"><i class="bi bi-plus-lg me-1"></i>New key</button></div>
    ${keys.length ? `<div class="tbl-wrap mb-4"><table class="fb-table stack"><thead><tr><th>Key</th><th>Can do</th><th>Allowed websites</th><th>Last 24h</th><th>Last used</th><th>Status</th><th></th></tr></thead><tbody>${keys.map(k => `<tr>
      <td data-label="Key"><b>${esc(k.name)}</b><br><small class="muted">${esc(k.key_prefix)}…</small></td>
      <td data-label="Can do">${k.scopes.map(s => pill(s, 'info')).join(' ')}</td>
      <td data-label="Websites">${k.allowed_origins.length ? k.allowed_origins.map(o => `<div class="small">${esc(o)}</div>`).join('') : '<span class="muted small">Any (server use)</span>'}</td>
      <td data-label="24h">${num(k.requests_24h)} req${k.errors_24h ? ` · <span class="text-danger">${num(k.errors_24h)} errors</span>` : ''}<br><small class="muted">limit ${num(k.rate_limit)}/min</small></td>
      <td data-label="Last used">${k.last_used_at ? ago(k.last_used_at) : 'Never'}${k.expires_at ? `<br><small class="muted">expires ${fmtDateTime(k.expires_at)}</small>` : ''}</td>
      <td data-label="Status">${pill(k.status, k.status === 'active' ? 'success' : 'danger')}</td>
      <td class="text-end text-nowrap"><button class="btn btn-sm btn-soft" data-log="${k.id}" title="Request log"><i class="bi bi-list-ul"></i></button> ${k.status === 'active' ? `<button class="btn btn-sm btn-soft" data-ek="${k.id}"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-danger-soft" data-rv="${k.id}">Revoke</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : `<div class="fb-card mb-4">${empty('bi-key', 'No API keys yet', 'Create a key to connect your website.')}</div>`}
    <div class="d-flex justify-content-between align-items-center mb-2"><h3 class="m-0">Webhooks</h3><button class="btn btn-fb btn-sm" id="nw"><i class="bi bi-plus-lg me-1"></i>New webhook</button></div>
    ${hooks.length ? `<div class="tbl-wrap"><table class="fb-table stack"><thead><tr><th>Address</th><th>Events</th><th>Last delivery</th><th>Status</th><th></th></tr></thead><tbody>${hooks.map(h => `<tr>
      <td data-label="URL" style="word-break:break-all">${esc(h.url)}</td><td data-label="Events">${h.events.map(e => pill(e, 'gold')).join(' ')}</td>
      <td data-label="Last">${h.last_attempt_at ? `${ago(h.last_attempt_at)} · ${h.last_status >= 200 && h.last_status < 300 ? `<span class="text-success">HTTP ${h.last_status}</span>` : `<span class="text-danger">${h.last_status ? 'HTTP ' + h.last_status : 'no response'}</span>`}${h.failure_count ? `<br><small class="text-danger">${h.failure_count} failures in a row</small>` : ''}` : '<span class="muted">Never</span>'}</td>
      <td data-label="Status">${pill(h.status, h.status === 'active' ? 'success' : 'danger')}</td>
      <td class="text-end text-nowrap"><button class="btn btn-sm btn-soft" data-wt="${h.id}">Send test</button> <button class="btn btn-sm btn-soft" data-we="${h.id}"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-danger-soft" data-wd="${h.id}"><i class="bi bi-trash"></i></button></td></tr>`).join('')}</tbody></table></div>` : `<div class="fb-card">${empty('bi-broadcast', 'No webhooks', 'Webhooks call your server when an order arrives, a sale completes or stock runs low.')}</div>`}
    <p class="small muted mt-3"><i class="bi bi-shield-lock me-1"></i>Webhooks are signed (X-FBBMS-Signature) so your server can verify they really came from FBBMS. Up to ${meta.policy.max_keys_per_business} keys and ${meta.policy.max_webhooks_per_business} webhooks per business.</p>`;
    const $ = s => el.querySelector(s);
    $('#nk').onclick = () => keyForm(); $('#nw').onclick = () => hookForm();
    el.querySelectorAll('[data-ek]').forEach(b => b.onclick = () => keyForm(keys.find(k => k.id == b.dataset.ek)));
    el.querySelectorAll('[data-rv]').forEach(b => b.onclick = async () => { const k = keys.find(x => x.id == b.dataset.rv); if (!(await confirmBox({ title: `Revoke “${k.name}”?`, message: 'Any website using this key stops working immediately. This cannot be undone.', confirmText: 'Revoke', danger: true }))) return; try { await post(`/b/integrations/keys/${k.id}/revoke`); ok('Key revoked'); load(); } catch (e) { fail(e); } });
    el.querySelectorAll('[data-log]').forEach(b => b.onclick = () => logModal(keys.find(k => k.id == b.dataset.log)));
    el.querySelectorAll('[data-we]').forEach(b => b.onclick = () => hookForm(hooks.find(h => h.id == b.dataset.we)));
    el.querySelectorAll('[data-wd]').forEach(b => b.onclick = async () => { if (!(await confirmBox({ title: 'Delete this webhook?', message: 'Events will no longer be sent to it.', confirmText: 'Delete', danger: true }))) return; try { await del('/b/integrations/webhooks/' + b.dataset.wd); ok('Webhook deleted'); load(); } catch (e) { fail(e); } });
    el.querySelectorAll('[data-wt]').forEach(b => b.onclick = async () => { b.disabled = true; try { const r = await post(`/b/integrations/webhooks/${b.dataset.wt}/test`); r.ok ? ok('Test delivered', `Your server answered HTTP ${r.status}`) : fail(new Error(r.status ? `Your server answered HTTP ${r.status}` : 'Could not reach that address (it is retried automatically)')); load(); } catch (e) { fail(e); b.disabled = false; } });
  };

  function keyForm(k) {
    const scopes = Object.entries(meta.scopes);
    const m = openModal({ title: k ? 'Edit key' : 'New API key', body: `<div class="mb-3"><label class="form-label">Name</label><input class="form-control" id="n" maxlength="100" placeholder="e.g. Main website" value="${esc(k ? k.name : '')}"></div>
      <div class="mb-3"><label class="form-label">What can this key do?</label>${scopes.map(([s, d]) => `<div class="form-check"><input class="form-check-input" type="checkbox" value="${esc(s)}" id="sc_${esc(s)}" ${(k ? k.scopes.includes(s) : true) ? 'checked' : ''}><label class="form-check-label" for="sc_${esc(s)}"><b>${esc(s)}</b> <span class="muted small">${esc(d)}</span></label></div>`).join('')}</div>
      <div class="mb-3"><label class="form-label">Allowed websites</label><textarea class="form-control" id="o" rows="2" placeholder="https://zanlux.online&#10;https://www.zanlux.online">${esc(k ? k.allowed_origins.join('\n') : '')}</textarea><div class="form-text">Browsers from other websites are refused. Leave empty only for keys used on a server.</div></div>
      <div class="row g-2"><div class="col-6"><label class="form-label">Requests per minute</label><input type="number" class="form-control" id="r" min="10" max="1000" value="${k ? k.rate_limit : meta.policy.default_rate_limit}"></div>
      ${k ? '' : '<div class="col-6"><label class="form-label">Expires in (days)</label><input type="number" class="form-control" id="x" min="0" placeholder="0 = never"></div>'}</div>`,
      footer: `<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-fb" id="go">${k ? 'Save' : 'Create key'}</button>` });
    m.el.querySelector('#go').onclick = async () => {
      const body = { name: m.el.querySelector('#n').value, scopes: scopes.map(([s]) => s).filter(s => m.el.querySelector('#sc_' + CSS.escape(s)).checked), allowed_origins: m.el.querySelector('#o').value.split(/[\s,]+/).filter(Boolean), rate_limit: Number(m.el.querySelector('#r').value) || undefined };
      if (!k) body.expires_in_days = Number(m.el.querySelector('#x').value) || 0;
      try { if (k) { await put('/b/integrations/keys/' + k.id, body); ok('Key updated'); m.close(); } else { const r = await post('/b/integrations/keys', body); m.close(); secretModal('🔑 Your new API key', r.note, r.api_key); } load(); } catch (e) { fail(e); }
    };
  }

  function hookForm(h) {
    const m = openModal({ title: h ? 'Edit webhook' : 'New webhook', body: `<div class="mb-3"><label class="form-label">Address (https://…)</label><input class="form-control" id="u" placeholder="https://yoursite.com/fbbms-webhook" value="${esc(h ? h.url : '')}"></div>
      <div class="mb-3"><label class="form-label">Send me…</label>${meta.events.map(e => `<div class="form-check"><input class="form-check-input" type="checkbox" value="${esc(e)}" id="ev_${esc(e)}" ${(h ? h.events.includes(e) : true) ? 'checked' : ''}><label class="form-check-label" for="ev_${esc(e)}">${esc(e)}</label></div>`).join('')}</div>
      ${h ? `<div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="act" ${h.status === 'active' ? 'checked' : ''}><label class="form-check-label" for="act">Active</label></div>` : ''}`,
      footer: `<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-fb" id="go">${h ? 'Save' : 'Create webhook'}</button>` });
    m.el.querySelector('#go').onclick = async () => {
      const body = { url: m.el.querySelector('#u').value.trim(), events: meta.events.filter(e => m.el.querySelector('#ev_' + CSS.escape(e)).checked) };
      try { if (h) { body.status = m.el.querySelector('#act').checked ? 'active' : 'disabled'; await put('/b/integrations/webhooks/' + h.id, body); ok('Webhook updated'); m.close(); } else { const r = await post('/b/integrations/webhooks', body); m.close(); secretModal('🔔 Webhook signing secret', r.note, r.secret); } load(); } catch (e) { fail(e); }
    };
  }

  async function logModal(k) {
    const m = openModal({ size: 'modal-lg', title: `Recent requests · ${esc(k.name)}`, body: skeleton(4, 24) });
    try { const rows = await get(`/b/integrations/keys/${k.id}/log`);
      m.el.querySelector('.modal-body').innerHTML = rows.length ? `<div class="tbl-wrap"><table class="fb-table"><thead><tr><th>When</th><th>Request</th><th>Status</th><th>Time</th><th>IP</th></tr></thead><tbody>${rows.map(r => `<tr><td>${fmtDateTime(r.created_at)}</td><td><code>${esc(r.method)} ${esc(r.path)}</code></td><td>${pill(String(r.status), r.status < 400 ? 'success' : 'danger')}</td><td>${num(r.ms)} ms</td><td>${esc(r.ip || '')}</td></tr>`).join('')}</tbody></table></div>` : empty('bi-inbox', 'No requests yet', 'Requests made with this key will appear here.');
    } catch (e) { m.close(); fail(e); }
  }

  try { await load(); } catch (e) { el.querySelector('#body').innerHTML = empty('bi-plug', 'Not available', e.message); }
}
