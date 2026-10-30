import { get, post, put } from '../api.js';
import { esc, money, num, openModal, fail, ok, initials, pill, ago, empty, skeleton, confirmBox } from '../ui.js';

const PRESETS = {
  'Cashier': ['sales.create', 'products.view', 'orders.view'],
  'Stock keeper': ['products.view', 'products.manage', 'stock.adjust'],
  'Shop supervisor': ['sales.create', 'sales.view_all', 'sales.discount', 'sales.void', 'products.view', 'products.manage', 'stock.adjust', 'orders.view', 'orders.manage', 'expenses.manage']
};

export async function render(el, ctx) {
  const { permissions, defaults } = await get('/b/permissions');
  el.innerHTML = `<div class="page-head"><div><h1>Team & access</h1><p>Add your shopkeepers and decide exactly what each person can see and do.</p></div><button class="btn btn-fb" id="add"><i class="bi bi-person-plus me-1"></i>Add shopkeeper</button></div><div class="row g-3" id="list">${skeleton(3, 120)}</div>`;
  const $ = s => el.querySelector(s); let team = [];
  const load = async () => { try { team = await get('/b/team'); draw(); } catch (e) { $('#list').innerHTML = empty('bi-exclamation-triangle', 'Could not load team', e.message); } };
  const draw = () => {
    $('#list').innerHTML = team.map(m => `<div class="col-md-6 col-xl-4"><div class="fb-card h-100 ${m.status === 'disabled' ? 'opacity-50' : ''}"><div class="d-flex gap-3 align-items-center mb-2"><span class="avatar" style="width:46px;height:46px">${esc(initials(m.name))}</span><div class="flex-grow-1 min-w-0"><div class="fw-bold text-truncate">${esc(m.name)}</div><div class="small muted text-truncate">${esc(m.email)}</div></div>${m.role === 'super_admin' ? pill('Super Admin', 'gold') : m.status === 'disabled' ? pill('Disabled', 'danger') : pill('Active', 'success')}</div>
      <div class="small muted mb-2">${m.phone ? `<i class="bi bi-telephone me-1"></i>${esc(m.phone)} · ` : ''}Last sign-in: ${m.last_login ? ago(m.last_login) : 'never'}</div>
      ${m.role === 'sub_admin' ? `<div class="row g-2 text-center mb-2"><div class="col-4"><div class="fw-bold">${num(m.sales_30d)}</div><div class="small muted">Sales 30d</div></div><div class="col-4"><div class="fw-bold">${money(m.revenue_30d)}</div><div class="small muted">Revenue</div></div><div class="col-4"><div class="fw-bold ${m.voids_30d ? 'text-warning' : ''}">${num(m.voids_30d)}</div><div class="small muted">Voids</div></div></div>
      <div class="small muted mb-3">${m.permissions.length} of ${permissions.length} permissions</div><div class="d-flex gap-2 flex-wrap"><button class="btn btn-sm btn-soft" data-e="${m.id}"><i class="bi bi-shield-lock me-1"></i>Access</button><button class="btn btn-sm btn-soft" data-r="${m.id}"><i class="bi bi-key me-1"></i>Reset password</button><button class="btn btn-sm ${m.status === 'active' ? 'btn-danger-soft' : 'btn-soft'}" data-t="${m.id}">${m.status === 'active' ? 'Disable' : 'Enable'}</button></div>` : '<div class="small muted">Full access to this shop. Only the Developer can change Super Admins.</div>'}</div></div>`).join('') || empty('bi-people', 'No team yet');
    $('#list').querySelectorAll('[data-e]').forEach(b => b.onclick = () => form(team.find(x => x.id == b.dataset.e)));
    $('#list').querySelectorAll('[data-r]').forEach(b => b.onclick = async () => { const m = team.find(x => x.id == b.dataset.r); if (!(await confirmBox({ title: `Reset ${m.name}'s password?`, message: 'A new temporary password is generated. They must change it at next sign-in.', confirmText: 'Reset' }))) return; try { const r = await post(`/b/team/${m.id}/reset-password`); showPw(m.name, m.email, r.temp_password); } catch (e) { fail(e); } });
    $('#list').querySelectorAll('[data-t]').forEach(b => b.onclick = async () => { const m = team.find(x => x.id == b.dataset.t); const dis = m.status === 'active'; if (dis && !(await confirmBox({ title: `Disable ${m.name}?`, message: 'They will be signed out and unable to log in. Their sales history stays.', confirmText: 'Disable', danger: true }))) return; try { await put('/b/team/' + m.id, { status: dis ? 'disabled' : 'active' }); ok(dis ? 'Account disabled' : 'Account enabled'); load(); } catch (e) { fail(e); } });
  };
  function showPw(name, email, pw) { openModal({ title: '🔑 Temporary password', size: 'modal-sm', body: `<p>Give this to <b>${esc(name)}</b> (${esc(email)}). It is shown <b>only once</b>.</p><div class="pw-box">${esc(pw)}</div><button class="btn btn-soft w-100 mt-3" onclick="navigator.clipboard.writeText('${esc(pw)}');this.textContent='Copied ✓'">Copy</button>` }); }
  function permGrid(sel) { const groups = [...new Set(permissions.map(p => p.group))]; return `<div class="d-flex gap-2 flex-wrap mb-3">${Object.keys(PRESETS).map(k => `<button type="button" class="chip" data-preset="${esc(k)}">${esc(k)}</button>`).join('')}<button type="button" class="chip" data-preset="__none">Clear</button></div>` + groups.map(g => `<div class="perm-group"><h6>${esc(g)}</h6>${permissions.filter(p => p.group === g).map(p => `<div class="form-check mb-1"><input class="form-check-input perm" type="checkbox" id="p_${p.key}" value="${p.key}" ${sel.includes(p.key) ? 'checked' : ''}><label class="form-check-label small" for="p_${p.key}">${esc(p.label)}</label></div>`).join('')}</div>`).join(''); }
  function form(m) {
    const e = !!m; const sel = e ? m.permissions : defaults;
    const mm = openModal({ size: 'modal-lg', title: e ? `Access · ${esc(m.name)}` : 'Add shopkeeper', body: `${e ? '' : `<div class="row g-3 mb-3"><div class="col-md-6"><label class="form-label">Full name *</label><input id="n" class="form-control"></div><div class="col-md-6"><label class="form-label">Email *</label><input id="em" type="email" class="form-control"></div><div class="col-md-6"><label class="form-label">Phone</label><input id="ph" class="form-control" inputmode="tel"></div><div class="col-md-6"><label class="form-label">Password (blank = auto-generate)</label><input id="pw" class="form-control" autocomplete="off"></div></div>`}<h6 class="mb-2">What can they do?</h6>${permGrid(sel)}<div class="small muted">Discount limit for shopkeepers is set in <a href="#/settings" data-bs-dismiss="modal">Shop settings</a>.</div>`,
      footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-fb" id="sv">Save</button>' });
    mm.el.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => { const set = PRESETS[b.dataset.preset] || []; mm.el.querySelectorAll('.perm').forEach(c => c.checked = set.includes(c.value)); });
    mm.el.querySelector('#sv').onclick = async () => {
      const permissionsSel = [...mm.el.querySelectorAll('.perm:checked')].map(c => c.value);
      try {
        if (e) { await put('/b/team/' + m.id, { permissions: permissionsSel }); ok('Access updated'); }
        else { const r = await post('/b/team', { name: mm.el.querySelector('#n').value, email: mm.el.querySelector('#em').value, phone: mm.el.querySelector('#ph').value, password: mm.el.querySelector('#pw').value, permissions: permissionsSel }); ok('Shopkeeper added'); mm.close(); if (r.temp_password) showPw(mm.el.querySelector('#n').value, mm.el.querySelector('#em').value, r.temp_password); else ok('Existing account linked', 'They can sign in with their current password.'); load(); return; }
        mm.close(); load();
      } catch (err) { fail(err); }
    };
  }
  $('#add').onclick = () => form(null); load();
}
