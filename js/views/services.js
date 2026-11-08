import { get, post, put, del } from '../api.js';
import { esc, money, num, openModal, fail, ok, pill, empty } from './_kit.js';
import { confirmBox, skeleton } from '../ui.js';
import { busy } from './_kit.js';

export async function render(el, ctx) {
  const canEdit = ctx.can('services.manage'); let rows = [];
  el.innerHTML = `<div class="page-head"><div><h1>Services & prices</h1><p>What you offer, what it costs and how long it takes.</p></div>${canEdit ? '<button class="btn btn-fb" id="add"><i class="bi bi-plus-lg me-1"></i>Add service</button>' : ''}</div><div class="row g-3" id="l">${skeleton(3, 110)}</div>`;
  const load = async () => { try { rows = await get('/b/barber/services', { all: 1 }); draw(); } catch (e) { fail(e); } };
  const draw = () => {
    el.querySelector('#l').innerHTML = rows.length ? rows.map(s => `<div class="col-md-6 col-xl-4"><div class="fb-card h-100 ${s.status === 'inactive' ? 'opacity-50' : ''}"><div class="d-flex justify-content-between align-items-start"><div><div class="fw-bold fs-6">${esc(s.name)}</div><div class="small muted"><i class="bi bi-clock me-1"></i>${s.duration_min} min · ${num(s.done)} done</div></div>${s.status === 'inactive' ? pill('Hidden', 'danger') : Number(s.price) <= 0 ? pill('Set price', 'warning') : ''}</div>
      <div class="fs-3 fw-bold my-2" style="color:var(--primary)">${money(s.price)}</div>${canEdit ? `<div class="d-flex gap-2"><button class="btn btn-sm btn-soft" data-e="${s.id}"><i class="bi bi-pencil me-1"></i>Edit</button><button class="btn btn-sm btn-danger-soft" data-d="${s.id}"><i class="bi bi-trash"></i></button></div>` : ''}</div></div>`).join('') : `<div class="col-12">${empty('bi-scissors', 'No services yet', 'Add the services you provide, with prices and durations.')}</div>`;
    el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => form(rows.find(x => x.id == b.dataset.e)));
    el.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => { const s = rows.find(x => x.id == b.dataset.d); if (!(await confirmBox({ title: `Remove “${esc(s.name)}”?`, message: s.done ? 'It has history, so it will be hidden instead of deleted. Past sales stay intact.' : 'This service will be deleted.', confirmText: 'Remove', danger: true }))) return; try { const r = await del('/b/barber/services/' + s.id); ok(r.deactivated ? 'Service hidden' : 'Service deleted'); load(); } catch (e) { fail(e); } });
  };
  function form(s) {
    const m = openModal({ size: 'modal-sm', title: s ? 'Edit service' : 'Add service', body: `<div class="mb-3"><label class="form-label">Service name *</label><input class="form-control" id="n" value="${esc(s ? s.name : '')}" placeholder="e.g. Haircut"></div><div class="row g-2"><div class="col-6"><label class="form-label">Price (${esc(ctx.biz.currency)}) *</label><input class="form-control" id="p" type="number" min="0" step="0.01" inputmode="decimal" value="${s ? s.price : ''}"></div><div class="col-6"><label class="form-label">Duration (min)</label><input class="form-control" id="d" type="number" min="5" step="5" value="${s ? s.duration_min : 30}"></div></div>${s ? `<div class="form-check form-switch mt-3"><input class="form-check-input" type="checkbox" id="a" ${s.status === 'active' ? 'checked' : ''}><label class="form-check-label">Offered to customers</label></div>` : ''}`, footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-fb" id="go">Save</button>' });
    m.el.querySelector('#go').onclick = e => busy(e.currentTarget, 'Saving…', async () => { try { const body = { name: m.el.querySelector('#n').value, price: m.el.querySelector('#p').value, duration_min: m.el.querySelector('#d').value }; if (s) { body.status = m.el.querySelector('#a').checked ? 'active' : 'inactive'; await put('/b/barber/services/' + s.id, body); } else await post('/b/barber/services', body); ok('Service saved'); m.close(); load(); } catch (er) { fail(er); } });
  }
  if (canEdit) el.querySelector('#add').onclick = () => form(null);
  await load();
}
