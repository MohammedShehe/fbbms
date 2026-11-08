import { get, post } from '../api.js';
import { esc, num, fmtDate, todayEAT, addDays, openModal, fail, ok, pill, empty, skeleton } from '../ui.js';
import { busy, rangeBar, bar } from './_kit.js';

export async function render(el, ctx) {
  const st = { from: addDays(todayEAT(), -29), to: todayEAT() }; let data = null, barbers = [];
  el.innerHTML = `<div class="page-head"><div><h1>Supplies used</h1><p>Record what you use up. Stock goes down automatically and you get low-stock alerts.</p></div><div class="d-flex gap-2"><button class="btn btn-fb" id="add"><i class="bi bi-droplet-half me-1"></i>Record usage</button>${ctx.can('stock.adjust') ? '<a class="btn btn-soft" href="#/products"><i class="bi bi-box-seam me-1"></i>Restock</a>' : ''}</div></div><div class="filters" id="rb"></div><div id="v">${skeleton(4, 60)}</div>`;
  const $ = s => el.querySelector(s); rangeBar($('#rb'), st, () => load());
  const load = async () => {
    try {
      data = await get('/b/barber/usage', st); if (!barbers.length) barbers = await get('/b/barber/barbers').catch(() => []);
      $('#v').innerHTML = `<div class="row g-3"><div class="col-lg-7"><div class="fb-card"><h3>Stock & usage rate</h3><div class="card-sub">${data.days} day${data.days === 1 ? '' : 's'} · how fast each item is used and how long it will last</div><div class="tbl-wrap"><table class="fb-table"><thead><tr><th>Item</th><th class="num">In stock</th><th class="num">Used</th><th class="num">Per day</th><th class="num">Lasts</th></tr></thead><tbody>${data.summary.map(s => `<tr><td><b>${esc(s.name)}</b> ${s.low ? pill(s.stock_qty <= 0 ? 'Out' : 'Low', s.stock_qty <= 0 ? 'danger' : 'warning') : ''}</td><td class="num">${num(s.stock_qty)}</td><td class="num">${num(s.used)}</td><td class="num">${num(s.per_day)}</td><td class="num">${s.days_left === null ? '—' : s.days_left + ' d'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted text-center">No stock-tracked items yet. Add them under Products.</td></tr>'}</tbody></table></div></div></div>
        <div class="col-lg-5"><div class="fb-card"><h3>Usage log</h3><div class="card-sub">Latest records</div>${data.rows.length ? data.rows.slice(0, 30).map(r => `<div class="feed-item"><div class="flex-grow-1"><div class="fw-semibold">${esc(r.product)} × ${r.qty}</div><div class="small muted">${fmtDate(r.used_on)}${r.barber ? ' · ' + esc(r.barber) : ''}${r.note ? ' · ' + esc(r.note) : ''}</div></div><small class="muted">${esc(r.by_name || '')}</small></div>`).join('') : empty('bi-droplet', 'No usage recorded in this period')}</div></div></div>`;
    } catch (e) { $('#v').innerHTML = empty('bi-exclamation-triangle', 'Could not load', e.message); }
  };
  $('#add').onclick = async () => {
    let items = []; try { items = await get('/b/barber/supplies'); } catch (e) { return fail(e); }
    if (!items.length) return fail(new Error('Add your supplies under Products first (stock-tracked items).'));
    const m = openModal({ size: 'modal-sm', title: 'Record usage', body: `<div class="mb-3"><label class="form-label">Item *</label><select class="form-select" id="p">${items.map(p => `<option value="${p.id}">${esc(p.name)} (${p.stock_qty} in stock)</option>`).join('')}</select></div><div class="row g-2"><div class="col-5"><label class="form-label">Quantity *</label><input class="form-control" id="q" type="number" min="1" value="1"></div><div class="col-7"><label class="form-label">Used by</label><select class="form-select" id="b"><option value="">Shop in general</option>${barbers.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div></div><input class="form-control mt-2" id="n" placeholder="Note (optional)" maxlength="200">`, footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-fb" id="go">Record</button>' });
    m.el.querySelector('#go').onclick = e => busy(e.currentTarget, 'Saving…', async () => { try { await post('/b/barber/usage', { product_id: m.el.querySelector('#p').value, qty: m.el.querySelector('#q').value, barber_id: m.el.querySelector('#b').value || undefined, note: m.el.querySelector('#n').value }); ok('Usage recorded'); m.close(); load(); } catch (er) { fail(er); } });
  };
  ctx.on('product.changed', () => load()); await load();
}
