// Logo manager card: preview, upload / change (with a preview step), remove. Used by Shop settings (Super Admin)
// and by the Developer's business editor. `base` is the API path: '/b/logo' or `/developer/businesses/<id>/logo`.
import { post, del } from './api.js';
import { esc, ok, fail, prepareLogo, bizLogo, hasCustomLogo, confirmBox } from './ui.js';

const kb = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

export function mountLogoManager(host, { biz, base = '/b/logo', onChange } = {}) {
  let busy = false, pending = null; // pending = { data, width, height, bytes, name }
  const state = { biz: { ...biz, theme: { ...(biz.theme || {}) } } };

  const draw = () => {
    const custom = hasCustomLogo(state.biz);
    const src = pending ? pending.data : bizLogo(state.biz);
    host.innerHTML = `<div class="logo-mgr">
      <div class="logo-drop ${busy ? 'is-busy' : ''}" id="lgDrop" tabindex="0" role="button" aria-label="Choose a logo image">
        <img src="${esc(src)}" alt="${esc(state.biz.short_name || 'Logo')}" id="lgImg">
        ${busy ? '<div class="logo-busy"><span class="spinner-border"></span></div>' : '<div class="logo-hint"><i class="bi bi-cloud-arrow-up"></i><span>Drop an image or click</span></div>'}
      </div>
      <div class="logo-info">
        ${pending ? `<div class="fw-semibold">New logo preview</div><div class="small muted">${pending.width}×${pending.height} px · ${kb(pending.bytes)} · nothing changes until you save</div>
          <div class="logo-preview-row"><div class="lp dark"><img src="${esc(pending.data)}" alt=""></div><div class="lp light"><img src="${esc(pending.data)}" alt=""></div></div>
          <div class="d-flex flex-wrap gap-2 mt-3"><button class="btn btn-fb btn-sm" data-act="save" ${busy ? 'disabled' : ''}>${busy ? '<span class="spinner-border spinner-border-sm me-1"></span>Saving…' : '<i class="bi bi-check2 me-1"></i>Save logo'}</button><button class="btn btn-soft btn-sm" data-act="pick" ${busy ? 'disabled' : ''}>Choose another</button><button class="btn btn-soft btn-sm" data-act="cancel" ${busy ? 'disabled' : ''}>Cancel</button></div>`
        : `<div class="fw-semibold">${custom ? 'Custom logo' : 'Default logo'}</div>
          <div class="small muted">${custom ? 'Shown in the sidebar, the business switcher and the browser tab.' : 'No logo uploaded yet — the default mark is used.'} A PNG with a transparent background looks best (at least 64×64 px).</div>
          <div class="d-flex flex-wrap gap-2 mt-3"><button class="btn btn-fb btn-sm" data-act="pick" ${busy ? 'disabled' : ''}><i class="bi bi-upload me-1"></i>${custom ? 'Change logo' : 'Upload logo'}</button>${custom ? `<button class="btn btn-danger-soft btn-sm" data-act="remove" ${busy ? 'disabled' : ''}>${busy ? '<span class="spinner-border spinner-border-sm me-1"></span>' : '<i class="bi bi-trash3 me-1"></i>'}Remove</button>` : ''}</div>`}
        <div class="small mt-2 text-danger" id="lgErr" role="alert" hidden></div>
      </div>
      <input type="file" id="lgFile" accept="image/png,image/jpeg,image/webp" hidden>
    </div>`;
    wire();
  };

  const showErr = m => { const e = host.querySelector('#lgErr'); if (e) { e.textContent = m; e.hidden = !m; } };
  async function choose(file) {
    if (busy || !file) return; showErr('');
    try { pending = { ...(await prepareLogo(file)), name: file.name }; draw(); } catch (e) { showErr(e.message); }
  }
  function wire() {
    const file = host.querySelector('#lgFile'), drop = host.querySelector('#lgDrop');
    file.onchange = () => { const f = file.files[0]; file.value = ''; choose(f); };
    drop.onclick = () => { if (!busy) file.click(); };
    drop.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && !busy) { e.preventDefault(); file.click(); } };
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('is-over'); }));
    drop.addEventListener('drop', e => choose(e.dataTransfer && e.dataTransfer.files[0]));
    host.querySelectorAll('[data-act]').forEach(b => b.onclick = () => ({ pick: () => file.click(), cancel: () => { pending = null; showErr(''); draw(); }, save, remove }[b.dataset.act])());
  }
  const apply = logoUrl => {
    const th = { ...(state.biz.theme || {}) }; if (logoUrl) th.logo_url = logoUrl; else delete th.logo_url;
    state.biz = { ...state.biz, theme: th }; if (onChange) onChange(state.biz);
  };
  async function save() {
    if (busy || !pending) return; busy = true; showErr(''); draw();
    try { const r = await post(base, { data: pending.data }); pending = null; busy = false; apply(r.logo_url); draw(); ok('Logo updated', 'Everyone on this business sees the new logo.'); }
    catch (e) { busy = false; draw(); showErr(e.message); fail(e); }
  }
  async function remove() {
    if (busy) return;
    if (!(await confirmBox({ title: 'Remove the logo?', message: 'The default logo will be shown instead. You can upload a new one any time.', confirmText: 'Remove logo', danger: true }))) return;
    busy = true; showErr(''); draw();
    try { await del(base); busy = false; apply(null); draw(); ok('Logo removed', 'The default logo is now used.'); }
    catch (e) { busy = false; draw(); showErr(e.message); fail(e); }
  }
  draw();
  return { get biz() { return state.biz; } };
}
