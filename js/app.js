import { api, get, post, put, session, streamUrl } from './api.js';
import { $, $$, esc, setCurrency, setRegion, getTz, applyTheme, toast, fail, ok, openModal, initials, ago, money, fmtDate } from './ui.js';
import { BIZ_LOGOS, DEFAULT_LOGO } from './config.js';

if (!session.token) location.replace('index.html');

const NAV = [
  { group: 'Overview' },
  { id: 'dashboard', label: 'Dashboard', icon: 'bi-grid-1x2-fill' },
  { id: 'pos', label: 'New sale', icon: 'bi-bag-plus-fill', perm: 'sales.create' },
  { group: 'Sell' },
  { id: 'sales', label: 'Sales', icon: 'bi-receipt', any: ['sales.create', 'sales.view_all'] },
  { id: 'refunds', label: 'Refunds & exchanges', icon: 'bi-arrow-return-left', mod: 'refunds', any: ['sales.refund', 'sales.view_all'] },
  { id: 'customers', label: 'Customers', icon: 'bi-people', mod: 'customers', any: ['customers.view', 'customers.manage', 'reports.view'] },
  { id: 'orders', label: 'Website orders', icon: 'bi-globe2', perm: 'orders.view', badge: true },
  { group: 'Inventory' },
  { id: 'products', label: 'Products', icon: 'bi-box-seam-fill', any: ['products.view', 'products.manage'] },
  { id: 'stock', label: 'Stock ledger', icon: 'bi-clipboard2-data-fill', perm: 'stock.adjust' },
  { id: 'suppliers', label: 'Suppliers & purchases', icon: 'bi-truck', mod: 'suppliers', perm: 'suppliers.manage' },
  { group: 'Money' },
  { id: 'expenses', label: 'Expenses', icon: 'bi-wallet2', perm: 'expenses.manage' },
  { id: 'cash', label: 'Cash & till', icon: 'bi-safe2', mod: 'cash', perm: 'cash.manage' },
  { id: 'finance', label: 'Finance & tax', icon: 'bi-bank2', mod: 'finance', perm: 'reports.view' },
  { id: 'reports', label: 'Reports', icon: 'bi-graph-up-arrow', perm: 'reports.view' },
  { group: 'Intelligence' },
  { id: 'health', label: 'Business health', icon: 'bi-heart-pulse-fill', mod: 'health', any: ['health.view', 'reports.view'] },
  { id: 'alerts', label: 'Alerts', icon: 'bi-bell-fill', mod: 'alerts', alerts: true },
  { id: 'assistant', label: 'AI assistant', icon: 'bi-stars', mod: 'ai', perm: 'ai.use' },
  { group: 'Manage' },
  { id: 'team', label: 'Team & access', icon: 'bi-people-fill', superOnly: true },
  { id: 'audit', label: 'Audit trail', icon: 'bi-shield-check', superOnly: true },
  { id: 'integrations', label: 'API & webhooks', icon: 'bi-plug-fill', mod: 'public_api', superOnly: true },
  { id: 'branches', label: 'Branches', icon: 'bi-diagram-3-fill', mod: '_group', superOnly: true },
  { id: 'settings', label: 'Shop & website', icon: 'bi-sliders', superOnly: true },
  { group: 'Platform', dev: true },
  { id: 'dev-overview', label: 'Developer console', icon: 'bi-cpu-fill', dev: true },
  { id: 'dev-businesses', label: 'Businesses', icon: 'bi-shop-window', dev: true },
  { id: 'dev-users', label: 'All users', icon: 'bi-person-lines-fill', dev: true },
  { id: 'dev-ai', label: 'AI settings', icon: 'bi-robot', dev: true },
  { id: 'dev-modules', label: 'Feature modules', icon: 'bi-toggles', dev: true },
  { id: 'dev-api', label: 'API & integrations', icon: 'bi-plug', dev: true },
  { id: 'dev-system', label: 'System & backups', icon: 'bi-hdd-stack-fill', dev: true },
  { id: 'dev-security', label: 'Security & sessions', icon: 'bi-shield-lock-fill', dev: true },
  { id: 'dev-theme', label: 'Platform theme', icon: 'bi-palette-fill', dev: true },
  { id: 'dev-audit', label: 'Global audit', icon: 'bi-journal-text', dev: true }
];

export const ctx = {
  profile: null, biz: null, role: null, perms: new Set(), isDev: false, isSuper: false, listeners: new Map(), badge: 0, alerts: 0, notifs: [], unread: 0,
  can(p) { return this.isSuper || this.perms.has(p); },
  canAny(a) { return a.some(p => this.can(p)); },
  on(ev, fn) { if (!this.listeners.has(ev)) this.listeners.set(ev, new Set()); this.listeners.get(ev).add(fn); this._scoped.push([ev, fn]); },
  _scoped: [],
  emit(ev, d) { (this.listeners.get(ev) || []).forEach(fn => { try { fn(d); } catch (e) { console.error(e); } }); (this.listeners.get('*') || []).forEach(fn => fn(ev, d)); },
  go(id) { location.hash = '#/' + id; },
  async refreshBadge() { if (!this.biz) return; try { if (this.can('orders.view')) { const r = await get('/b/orders', { status: 'new', limit: 1 }); this.badge = r.total; } if (this.biz.modules && this.biz.modules.alerts) { const a = await get('/b/notifications', { unread: 1, limit: 1 }); this.alerts = a.unread ?? a.unread_count ?? 0; } renderNav(); } catch { /* ignore */ } }
};

const modOn = n => !n.mod || n.dev || !ctx.biz || (n.mod === '_group' ? !!ctx.biz.group_id : ctx.biz.modules ? ctx.biz.modules[n.mod] !== false : true);
const allowed = n => n.group ? true : !modOn(n) ? false : n.dev ? ctx.isDev : n.superOnly ? ctx.isSuper : n.perm ? ctx.can(n.perm) : n.any ? ctx.canAny(n.any) : true;
const needsBiz = id => !id.startsWith('dev-');

/* ---------------- boot ---------------- */
(async function boot() {
  try {
    const [profile, theme] = await Promise.all([get('/auth/me'), get('/auth/theme').catch(() => null)]);
    ctx.profile = profile; ctx.isDev = profile.is_developer; ctx.platformTheme = theme;
    const ids = profile.memberships.map(m => m.business.id);
    if (!ids.includes(session.biz)) session.biz = ids[0] || null;
    if (!ids.length && !ctx.isDev) { document.body.innerHTML = '<div class="auth"><div class="auth-card text-center"><h4>No business assigned</h4><p class="muted">Your account is not linked to any shop yet. Ask your Super Admin or the Developer to add you.</p><button class="btn btn-fb" onclick="localStorage.clear();location.href=\'index.html\'">Sign out</button></div></div>'; return; }
    await selectBusiness(session.biz, true);
    $('#app').style.visibility = 'visible'; const splash = $('#bootScreen'); if (splash) splash.remove();
    if (profile.must_change_password) forcePasswordChange();
  } catch (e) { const splash = $('#bootScreen'); if (splash) { splash.innerHTML = `<div class="boot-mark"><img src="assets/fbbms-logo.svg" alt=""></div><i class="bi bi-wifi-off" style="font-size:1.6rem;color:var(--danger)"></i><strong>Unable to load workspace</strong><span>${esc(e.message || 'Please check your connection and try again.')}</span><button class="btn btn-fb mt-2" onclick="location.reload()">Try again</button><a href="index.html" class="small mt-2">Return to sign in</a>`; } fail(e); }
})();

async function selectBusiness(id, first = false) {
  session.biz = id || null;
  if (id) {
    const m = ctx.profile.memberships.find(x => x.business.id === id);
    ctx.biz = await get('/b/business'); ctx.role = ctx.biz.role; ctx.perms = new Set(ctx.biz.permissions); ctx.isSuper = ctx.role === 'super_admin';
    setCurrency(ctx.biz.currency); setRegion({ timezone: ctx.biz.timezone || ctx.biz.settings.timezone, date_format: ctx.biz.settings.date_format }); ctx.tz = getTz(); ctx.fmtCfg = { tz: ctx.tz, date_format: ctx.biz.settings.date_format || 'DD/MM/YYYY' };
    { const t = document.getElementById('tzNote'); if (t) t.textContent = ctx.tz.replace(/_/g, ' '); }
    ctx.logo = BIZ_LOGOS[ctx.biz.slug] || DEFAULT_LOGO;
    ctx.fullLogo = ctx.biz.slug === 'zanlux' ? 'assets/zanlux-logo.png' : null;
    applyBrand();
    openStream();
  } else { ctx.biz = null; ctx.role = 'developer'; ctx.isSuper = true; ctx.perms = new Set(); applyBrand(); closeStream(); }
  renderBrand(); renderBizSwitch(); renderUser(); renderNav(); ctx.refreshBadge();
  if (first) { window.addEventListener('hashchange', route); }
  if (!location.hash || (!ctx.biz && needsBiz(currentId())) || (ctx.biz && !allowed(NAV.find(n => n.id === currentId()) || {}))) location.hash = '#/' + (ctx.biz ? 'dashboard' : 'dev-overview');
  else route();
}

function applyBrand() {
  const mode = localStorage.getItem('fbbms_mode') || (ctx.biz && ctx.biz.theme && ctx.biz.theme.mode) || (ctx.platformTheme && ctx.platformTheme.mode) || 'dark';
  const t = ctx.biz ? ctx.biz.theme : ctx.platformTheme || {};
  applyTheme({ primary: t.primary || '#d4af55', accent: t.accent || '#f1d98a', mode });
  $('#themeBtn i').className = 'bi ' + (mode === 'dark' ? 'bi-moon-stars' : 'bi-sun');
  document.title = (ctx.biz ? ctx.biz.short_name : 'FBBMS') + ' · FBBMS';
}

function renderBrand() {
  const b = ctx.biz;
  const logoSrc = b ? ctx.logo : DEFAULT_LOGO;
  const w = b && b.slug === 'zanlux' ? 120 : 84;
  $('#brand').innerHTML = `<div class="logo-anim glow" style="width:${w}px;--logo-mask:url(${new URL(logoSrc, location.href).href})"><img src="${logoSrc}" alt="${esc(b ? b.short_name : 'FBBMS')}"></div>
    <div><div class="brand-name">${esc(b ? b.short_name : 'FBBMS')}</div><div class="brand-sub">${esc(b ? (b.tagline || 'Management') : 'Developer console')}</div></div>`;
}

function renderBizSwitch() {
  const ms = ctx.profile.memberships; const b = ctx.biz;
  const cur = b ? `<img src="${ctx.logo}" alt=""><div><div class="nm">${esc(b.name)}</div><small>${b.role === 'sub_admin' ? 'Shopkeeper' : ctx.isDev ? 'Developer access' : 'Super Admin'}</small></div>` : `<img src="${DEFAULT_LOGO}" alt=""><div><div class="nm">Developer console</div><small>All businesses</small></div>`;
  const items = ms.map(m => `<li><a class="dropdown-item d-flex align-items-center gap-2 ${b && m.business.id === b.id ? 'active' : ''}" href="#" data-biz="${m.business.id}"><img src="${BIZ_LOGOS[m.business.slug] || DEFAULT_LOGO}" width="22" height="22" style="object-fit:contain"> ${esc(m.business.name)}</a></li>`).join('');
  $('#bizWrap').innerHTML = `<button class="biz-switch" data-bs-toggle="dropdown">${cur}<i class="bi bi-chevron-expand muted ms-1"></i></button>
    <ul class="dropdown-menu">${items}${ctx.isDev ? `<li><hr class="dropdown-divider"></li><li><a class="dropdown-item" href="#" data-biz="0"><i class="bi bi-cpu me-2"></i>Developer console</a></li>` : ''}</ul>`;
  $$('[data-biz]', $('#bizWrap')).forEach(a => a.onclick = async e => { e.preventDefault(); const id = Number(a.dataset.biz) || null; if (id === session.biz) return; ctx.badge = 0; await selectBusiness(id); location.hash = '#/' + (id ? 'dashboard' : 'dev-overview'); });
}

function renderUser() {
  const u = ctx.profile;
  $('#userWrap').innerHTML = `<button class="icon-btn p-0" data-bs-toggle="dropdown" style="width:auto;padding:0 6px 0 4px!important;gap:8px;display:flex;align-items:center"><span class="avatar">${esc(initials(u.name))}</span><i class="bi bi-chevron-down small muted d-none d-sm-inline"></i></button>
    <ul class="dropdown-menu dropdown-menu-end" style="min-width:230px"><li class="px-3 py-2"><div class="fw-bold">${esc(u.name)}</div><div class="small muted">${esc(u.email)}</div><div class="mt-1"><span class="pill gold">${ctx.isDev ? 'Developer' : ctx.role === 'super_admin' ? 'Super Admin' : 'Sub Admin'}</span></div></li>
    <li><hr class="dropdown-divider"></li><li><a class="dropdown-item" href="#" id="miProfile"><i class="bi bi-person-gear me-2"></i>My profile & password</a></li>
    <li><a class="dropdown-item" href="#" id="miOut"><i class="bi bi-box-arrow-right me-2"></i>Sign out</a></li></ul>`;
  $('#miProfile').onclick = e => { e.preventDefault(); profileModal(); };
  $('#miOut').onclick = e => { e.preventDefault(); session.clear(); location.href = 'index.html'; };
}

function renderNav() {
  const items = NAV.filter(n => n.group ? true : (allowed(n) && (ctx.biz ? !n.dev : n.dev)));
  // drop group headings that have no visible items
  const out = []; items.forEach((n, i) => { if (n.group) { if (items[i + 1] && !items[i + 1].group) out.push(n); } else out.push(n); });
  if (ctx.biz && ctx.isDev) out.push({ group: 'Platform' }, { id: 'dev-overview', label: 'Developer console', icon: 'bi-cpu-fill', jump: true });
  const cur = currentId();
  $('#nav').innerHTML = out.map(n => n.group ? `<div class="nav-group">${n.group}</div>` :
    `<a class="nav-item ${n.id === cur ? 'active' : ''}" href="#/${n.id}" data-id="${n.id}"><i class="bi ${n.icon}"></i><span>${n.label}</span>${n.badge && ctx.badge ? `<span class="badge-dot">${ctx.badge}</span>` : ''}${n.alerts && ctx.alerts ? `<span class="badge-dot">${ctx.alerts}</span>` : ''}</a>`).join('');
  // bottom nav (mobile): up to 4 main + menu
  const main = out.filter(n => !n.group && !n.jump && ['dashboard', 'pos', 'sales', 'orders', 'products', 'dev-overview', 'dev-businesses'].includes(n.id)).slice(0, 4);
  $('#bottomNav').innerHTML = main.map(n => `<a href="#/${n.id}" class="${n.id === cur ? 'active' : ''}"><i class="bi ${n.icon}"></i>${n.label.split(' ')[0]}${n.badge && ctx.badge ? `<span class="badge-dot" style="position:absolute;top:2px;right:22%">${ctx.badge}</span>` : ''}</a>`).join('') + `<a href="#" id="bnMore"><i class="bi bi-grid-3x3-gap"></i>More</a>`;
  $('#bnMore').onclick = e => { e.preventDefault(); document.body.classList.add('nav-open'); };
}

const currentId = () => (location.hash.replace(/^#\//, '').split('?')[0]) || (ctx.biz ? 'dashboard' : 'dev-overview');

/* ---------------- router ---------------- */
let routeToken = 0;
async function route() {
  const id = currentId(); const n = NAV.find(x => x.id === id);
  document.body.classList.remove('nav-open');
  ctx._scoped.forEach(([ev, fn]) => ctx.listeners.get(ev)?.delete(fn)); ctx._scoped = [];
  if (ctx.cleanup) { try { ctx.cleanup(); } catch (_) {} ctx.cleanup = null; }
  const el = $('#view');
  if (!n || !allowed(n) || (needsBiz(id) && !ctx.biz) || (!needsBiz(id) && !ctx.isDev)) { el.innerHTML = `<div class="empty"><i class="bi bi-lock"></i><div class="fw-bold text-body">Not available</div><div>You don’t have access to this page.</div></div>`; renderNav(); return; }
  renderNav();
  const tok = ++routeToken; el.innerHTML = '<div class="skeleton mb-3" style="height:90px"></div><div class="row g-3"><div class="col-6 col-lg-3"><div class="skeleton" style="height:120px"></div></div><div class="col-6 col-lg-3"><div class="skeleton" style="height:120px"></div></div><div class="col-6 col-lg-3"><div class="skeleton" style="height:120px"></div></div><div class="col-6 col-lg-3"><div class="skeleton" style="height:120px"></div></div></div>';
  try {
    let render;
    if (id.startsWith('dev-')) render = (await import('./views/dev.js')).views[id.slice(4)];
    else render = (await import(`./views/${id}.js`)).render;
    if (tok !== routeToken) return;
    el.innerHTML = ''; await render(el, ctx);
    window.scrollTo({ top: 0 });
  } catch (e) { console.error(e); if (tok === routeToken) el.innerHTML = `<div class="empty"><i class="bi bi-exclamation-triangle"></i><div class="fw-bold text-body">Could not load this page</div><div>${esc(e.message)}</div><button class="btn btn-soft mt-3" onclick="location.reload()">Retry</button></div>`; }
}

/* ---------------- live stream ---------------- */
let es, esTimer;
function closeStream() { if (es) es.close(); es = null; setLive(false); }
function setLive(on) { $('#liveDot').classList.toggle('on', on); $('#liveTxt').textContent = on ? 'Live' : (ctx.biz ? 'Reconnecting…' : 'Console'); }
function openStream() {
  closeStream();
  es = new EventSource(streamUrl());
  es.addEventListener('hello', () => setLive(true));
  es.onerror = () => setLive(false);
  const evs = ['notification', 'sale.new', 'sale.voided', 'order.new', 'order.updated', 'product.changed', 'stock.low', 'expense.new', 'settings.changed'];
  evs.forEach(ev => es.addEventListener(ev, m => { let d = {}; try { d = JSON.parse(m.data); } catch (_) {} onLive(ev, d); }));
}
function beep() { try { const a = new (window.AudioContext || window.webkitAudioContext)(); const o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.type = 'sine'; o.frequency.value = 880; g.gain.setValueAtTime(.001, a.currentTime); g.gain.exponentialRampToValueAtTime(.2, a.currentTime + .02); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .5); o.start(); o.stop(a.currentTime + .5); } catch (_) {} }
function notify(icon, title, text, kind = 'info') { ctx.notifs.unshift({ icon, title, text, at: new Date().toISOString(), kind }); ctx.notifs = ctx.notifs.slice(0, 30); ctx.unread++; renderBell(); }
function onLive(ev, d) {
  const mine = d.by_id === ctx.profile.id;
  if (ev === 'order.new') { toast('info', '🛍️ New website order', `${d.order_no} · ${d.customer} · ${money(d.total)}`, 8000); beep(); notify('bi-bag-heart', 'New website order', `${d.order_no} from ${d.customer} (${money(d.total)})`); ctx.badge++; renderNav(); }
  else if (ev === 'sale.new' && !mine && ctx.can('reports.view')) { toast('success', '💰 Sale recorded', `${d.receipt_no} · ${money(d.total)} by ${d.by}`); notify('bi-receipt', 'Sale recorded', `${d.receipt_no} · ${money(d.total)} by ${d.by}`); }
  else if (ev === 'sale.voided' && ctx.isSuper) { toast('warn', 'Sale voided', `${d.receipt_no} (${money(d.total)}) by ${d.by}`, 8000); notify('bi-x-octagon', 'Sale voided', `${d.receipt_no} · ${money(d.total)} by ${d.by}`, 'warn'); }
  else if (ev === 'stock.low' && ctx.can('products.view')) { toast('warn', 'Low stock', `${d.name}: ${d.stock_qty} left`); notify('bi-exclamation-triangle', 'Low stock', `${d.name}: ${d.stock_qty} left`, 'warn'); }
  else if (ev === 'notification') { const k = d.severity === 'critical' ? 'error' : d.severity === 'warn' ? 'warn' : 'info'; if (d.severity !== 'info') toast(k, d.title, d.body || '', 8000); notify('bi-bell', d.title, d.body || '', d.severity === 'info' ? 'info' : 'warn'); ctx.alerts++; renderNav(); }
  else if (ev === 'order.updated') ctx.refreshBadge();
  else if (ev === 'settings.changed') get('/b/business').then(b => { ctx.biz = b; applyBrand(); });
  ctx.emit(ev, d);
}
function renderBell() {
  $('#bellCount').textContent = ctx.unread; $('#bellCount').classList.toggle('d-none', !ctx.unread);
  $('#notifMenu').innerHTML = `<div class="d-flex justify-content-between align-items-center px-2 pb-2"><b>Live activity</b><a href="#" id="clearN" class="small">Clear</a></div>` +
    (ctx.notifs.length ? ctx.notifs.map(n => `<div class="feed-item px-2"><i class="bi ${n.icon} fs-5 text-${n.kind === 'warn' ? 'warning' : 'info'}"></i><div><div class="fw-semibold small">${esc(n.title)}</div><div class="small muted">${esc(n.text)} · ${ago(n.at)}</div></div></div>`).join('') : '<div class="empty py-4"><i class="bi bi-bell-slash"></i>Nothing yet — live events will show up here.</div>');
  const c = $('#clearN'); if (c) c.onclick = e => { e.preventDefault(); ctx.notifs = []; ctx.unread = 0; renderBell(); };
}
$('#notifMenu').addEventListener('show.bs.dropdown', () => {}); document.addEventListener('shown.bs.dropdown', e => { if (e.target.querySelector && e.target.querySelector('#bellCount')) { ctx.unread = 0; renderBell(); } });
renderBell();

/* ---------------- clock, theme, menu ---------------- */
function tick() {
  const n = new Date();
  $('#clockT').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: getTz(), hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(n);
  $('#clockD').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: getTz(), weekday: 'long', day: 'numeric', month: 'long' }).format(n);
}
tick(); setInterval(tick, 1000);
$('#themeBtn').onclick = () => { const m = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('fbbms_mode', m); applyBrand(); ctx.emit('theme'); };
$('#menuBtn').onclick = () => document.body.classList.toggle('nav-open'); $('#scrim').onclick = () => document.body.classList.remove('nav-open');
$('#nav').addEventListener('click', () => document.body.classList.remove('nav-open'));
document.addEventListener('visibilitychange', () => { if (!document.hidden) ctx.emit('visible'); });

/* ---------------- profile & forced password change ---------------- */
function pwFields() { return `<div class="mb-3"><label class="form-label">Current password</label><input type="password" class="form-control" id="pwCur" autocomplete="current-password"></div>
  <div class="mb-1"><label class="form-label">New password (min. 8 characters)</label><input type="password" class="form-control" id="pwNew" autocomplete="new-password"></div>`; }
async function savePw(m) {
  try { await post('/auth/change-password', { current_password: $('#pwCur', m.el).value, new_password: $('#pwNew', m.el).value }); ok('Password updated', 'Use the new one next time you sign in.'); ctx.profile.must_change_password = false; return true; }
  catch (e) { fail(e); return false; }
}
function forcePasswordChange() {
  const m = openModal({ title: '🔐 Set your own password', body: `<p class="muted">For your security, please replace the temporary password you were given.</p>${pwFields()}`, footer: '<button class="btn btn-fb" id="pwGo">Save password</button>' });
  m.modal._config.backdrop = 'static'; m.modal._config.keyboard = false; m.el.querySelector('.btn-close').remove();
  $('#pwGo', m.el).onclick = async () => { if (await savePw(m)) m.close(); };
}
function profileModal() {
  const u = ctx.profile;
  const m = openModal({ title: 'My profile', body: `<div class="mb-3"><label class="form-label">Full name</label><input class="form-control" id="pfName" value="${esc(u.name)}"></div>
    <div class="mb-3"><label class="form-label">Phone</label><input class="form-control" id="pfPhone" value="${esc(u.phone || '')}"></div>
    <div class="mb-4"><label class="form-label">Email</label><input class="form-control" value="${esc(u.email)}" disabled></div>
    <h6 class="mb-3">Change password</h6>${pwFields()}`,
    footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Close</button><button class="btn btn-fb" id="pfSave">Save changes</button>' });
  $('#pfSave', m.el).onclick = async () => {
    try { await put('/auth/profile', { name: $('#pfName', m.el).value, phone: $('#pfPhone', m.el).value }); u.name = $('#pfName', m.el).value; u.phone = $('#pfPhone', m.el).value; renderUser(); ok('Profile saved'); }
    catch (e) { return fail(e); }
    if ($('#pwNew', m.el).value || $('#pwCur', m.el).value) { if (!(await savePw(m))) return; }
    m.close();
  };
}
