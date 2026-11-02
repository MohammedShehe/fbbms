import { get, post, put, del, api } from '../api.js';
import { esc, money, num, openModal, fail, ok, thumb, stockPill, pager, debounce, empty, skeleton, pill, confirmBox, resizeImage, fmtDateTime, downloadCSV } from '../ui.js';

const expPill = p => { if (!p.expiry_date) return ''; const d = Math.floor((new Date(String(p.expiry_date).slice(0, 10) + 'T12:00:00Z') - Date.now()) / 864e5); return d < 0 ? ' ' + pill('Expired', 'danger') : d <= 30 ? ' ' + pill(`Expires in ${d}d`, 'warning') : ''; };

export async function render(el, ctx) {
  const manage = ctx.can('products.manage'), cost = ctx.can('products.see_cost'), adjust = ctx.can('stock.adjust');
  let cats = await get('/b/categories');
  const st = { page: 1, limit: 20, q: '', category: '', stock: '', published: '', status: 'active', sort: 'name' };
  el.innerHTML = `<div class="page-head"><div><h1>Products & stock</h1><p>Everything you sell, with live stock levels${ctx.biz.settings.has_website ? ' — publish items to show them on your website' : ''}.</p></div>
    <div class="d-flex gap-2 flex-wrap">${manage ? '<button class="btn btn-soft" id="cats"><i class="bi bi-tags me-1"></i>Categories</button>' : ''}<button class="btn btn-soft" id="csv"><i class="bi bi-download me-1"></i>CSV</button>${manage ? '<button class="btn btn-fb" id="add"><i class="bi bi-plus-lg me-1"></i>Add product</button>' : ''}</div></div>
    <div class="row g-3 mb-3" id="sum"></div>
    <div class="filters"><div class="search"><i class="bi bi-search"></i><input id="q" class="form-control" placeholder="Search name, brand, SKU or barcode…"></div>
      <select id="category" class="form-select"></select>
      <select id="stock" class="form-select"><option value="">All stock levels</option><option value="in">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option></select>
      ${ctx.biz.settings.has_website ? '<select id="published" class="form-select"><option value="">Website: any</option><option value="1">On website</option><option value="0">Not on website</option></select>' : ''}
      <select id="status" class="form-select"><option value="active">Active</option><option value="archived">Archived</option></select>
      <select id="sort" class="form-select"><option value="name">Name A–Z</option><option value="newest">Newest</option><option value="price_asc">Price ↑</option><option value="price_desc">Price ↓</option><option value="stock_asc">Stock ↑</option><option value="stock_desc">Stock ↓</option></select></div>
    <div class="tbl-wrap"><table class="fb-table stack"><thead><tr><th>Product</th><th>Category</th><th class="num">Price</th>${cost ? '<th class="num">Cost</th>' : ''}<th>Stock</th>${ctx.biz.settings.has_website ? '<th>Website</th>' : ''}<th></th></tr></thead><tbody id="rows"></tbody></table></div><div class="pager" id="pg"></div>`;
  const $ = s => el.querySelector(s);
  const fillCats = () => { $('#category').innerHTML = '<option value="">All categories</option>' + cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join(''); $('#category').value = st.category; };
  fillCats();

  const load = async () => {
    $('#rows').innerHTML = `<tr><td colspan="8">${skeleton(5, 24)}</td></tr>`;
    try {
      const r = await get('/b/products', st); const s = r.summary;
      $('#sum').innerHTML = [['Active products', num(s.items), 'bi-box-seam', 'var(--primary)', `${num(s.units)} units on hand`], ['Low stock', num(s.low), 'bi-exclamation-triangle', 'var(--warning)', 'need restocking soon'], ['Out of stock', num(s.out_of_stock), 'bi-x-circle', 'var(--danger)', 'cannot be sold'], cost ? ['Stock value', money(s.cost_value), 'bi-safe2', 'var(--success)', `retail ${money(s.retail_value)}`] : ['Retail value', money(s.retail_value), 'bi-tag', 'var(--success)', 'at list price']]
        .map(([l, v, i, c, sub]) => `<div class="col-6 col-lg-3"><div class="kpi" style="--c:${c}"><div class="ico"><i class="bi ${i}"></i></div><div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${sub}</div></div></div>`).join('');
      $('#rows').innerHTML = r.rows.length ? r.rows.map(p => `<tr><td data-label="Product"><div class="d-flex align-items-center gap-2">${thumb(p.image_url, p.name)}<div class="text-start"><div class="fw-semibold">${esc(p.name)} ${p.is_featured ? '<i class="bi bi-star-fill text-warning small" title="Featured"></i>' : ''}</div><small class="muted">${esc(p.sku)}${p.barcode ? ' · <i class="bi bi-upc"></i> ' + esc(p.barcode) : ''}${p.brand ? ' · ' + esc(p.brand) : ''}${p.size ? ' · ' + esc(p.size) : ''}</small></div></div></td>
        <td data-label="Category">${esc(p.category_name || '—')}</td><td class="num" data-label="Price"><b>${money(p.price)}</b></td>${cost ? `<td class="num" data-label="Cost">${money(p.cost_price)}</td>` : ''}<td data-label="Stock">${stockPill(p)}${expPill(p)}</td>
        ${ctx.biz.settings.has_website ? `<td data-label="Website">${p.is_published ? pill('Live', 'success') : pill('Hidden')}</td>` : ''}
        <td class="nolabel"><div class="d-flex gap-1 justify-content-end"><button class="btn btn-sm btn-soft" data-h="${p.id}" title="Stock history"><i class="bi bi-clock-history"></i></button>${adjust && p.track_stock ? `<button class="btn btn-sm btn-soft" data-s="${p.id}" title="Receive / adjust stock"><i class="bi bi-boxes"></i></button>` : ''}${manage ? `<button class="btn btn-sm btn-soft" data-e="${p.id}" title="Edit"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-danger-soft" data-a="${p.id}" data-r="${p.status === 'archived' ? 1 : 0}" title="${p.status === 'archived' ? 'Restore' : 'Archive'}"><i class="bi bi-${p.status === 'archived' ? 'arrow-counterclockwise' : 'archive'}"></i></button>` : ''}</div></td></tr>`).join('') : `<tr><td colspan="8">${empty('bi-box-seam', 'No products found', manage ? 'Add your first product to start selling.' : '')}</td></tr>`;
      const by = id => r.rows.find(p => p.id == id);
      $('#rows').querySelectorAll('[data-e]').forEach(b => b.onclick = () => form(by(b.dataset.e)));
      $('#rows').querySelectorAll('[data-s]').forEach(b => b.onclick = () => stockForm(by(b.dataset.s)));
      $('#rows').querySelectorAll('[data-h]').forEach(b => b.onclick = () => history(by(b.dataset.h)));
      $('#rows').querySelectorAll('[data-a]').forEach(b => b.onclick = async () => { const restore = b.dataset.r === '1'; if (!(await confirmBox({ title: restore ? 'Restore product?' : 'Archive product?', message: restore ? 'It will be sellable again.' : 'It will be hidden from the shop and website. Sales history is kept.', confirmText: restore ? 'Restore' : 'Archive', danger: !restore }))) return; try { await post(`/b/products/${b.dataset.a}/archive`, { restore }); ok(restore ? 'Restored' : 'Archived'); load(); } catch (e) { fail(e); } });
      pager($('#pg'), r, p => { st.page = p; load(); });
    } catch (e) { $('#rows').innerHTML = `<tr><td colspan="8">${empty('bi-exclamation-triangle', 'Could not load products', e.message)}</td></tr>`; }
  };
  ['category', 'stock', 'published', 'status', 'sort'].forEach(k => { const n = $('#' + k); if (n) n.onchange = () => { st[k] = n.value; st.page = 1; load(); }; });
  $('#q').oninput = debounce(e => { st.q = e.target.value; st.page = 1; load(); }, 300);
  $('#csv').onclick = async () => { const r = await get('/b/products', { ...st, page: 1, limit: 500 }); downloadCSV('products.csv', [['SKU', 'Name', 'Brand', 'Size', 'Category', 'Barcode', 'Expiry', 'Price', ...(cost ? ['Cost'] : []), 'Stock', 'Published'], ...r.rows.map(p => [p.sku, p.name, p.brand, p.size, p.category_name, p.barcode, p.expiry_date ? String(p.expiry_date).slice(0, 10) : '', p.price, ...(cost ? [p.cost_price] : []), p.track_stock ? p.stock_qty : 'service', p.is_published ? 'yes' : 'no'])]); };

  /* ---- add / edit ---- */
  function form(p) {
    const e = !!p; const sz = ctx.biz.template === 'scents' ? 'e.g. 100ml' : 'e.g. Size 5 / XL';
    let img = p ? p.image_url : null;
    const m = openModal({ size: 'modal-lg', title: e ? 'Edit product' : 'Add product', body: `<div class="row g-3">
      <div class="col-md-4"><label class="form-label">Photo</label><div class="pcard" style="cursor:default;pointer-events:auto"><div class="img" id="imgBox">${img ? `<img src="${esc(img)}">` : '<i class="bi bi-image"></i>'}</div></div><input type="file" accept="image/*" id="file" class="form-control mt-2"><div class="small muted mt-1">Square photos look best. Resized automatically.</div></div>
      <div class="col-md-8"><div class="row g-3"><div class="col-12"><label class="form-label">Name *</label><input class="form-control" id="f_name" value="${esc(p?.name || '')}" maxlength="160"></div>
        <div class="col-sm-6"><label class="form-label">Brand</label><input class="form-control" id="f_brand" value="${esc(p?.brand || '')}"></div><div class="col-sm-6"><label class="form-label">Size / variant</label><input class="form-control" id="f_size" value="${esc(p?.size || '')}" placeholder="${sz}"></div>
        <div class="col-sm-6"><label class="form-label">Category</label><select class="form-select" id="f_cat"><option value="">— none —</option>${cats.map(c => `<option value="${c.id}" ${p?.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div><div class="col-sm-6"><label class="form-label">SKU ${e ? '' : '(auto if empty)'}</label><input class="form-control" id="f_sku" value="${esc(p?.sku || '')}"></div>
        <div class="col-sm-${cost ? 4 : 6}"><label class="form-label">Selling price (${ctx.biz.currency}) *</label><input type="number" min="0" class="form-control" id="f_price" value="${p?.price ?? ''}"></div>${cost ? `<div class="col-sm-4"><label class="form-label">Cost price</label><input type="number" min="0" class="form-control" id="f_cost" value="${p?.cost_price ?? 0}"></div>` : ''}
        <div class="col-sm-${cost ? 4 : 6}"><label class="form-label">Low-stock alert at</label><input type="number" min="0" class="form-control" id="f_low" value="${p?.low_stock_at ?? 5}"></div>
        <div class="col-sm-6"><label class="form-label">Barcode</label><div class="input-group"><input class="form-control" id="f_bar" value="${esc(p?.barcode || '')}" maxlength="64" placeholder="Scan or type"><span class="input-group-text"><i class="bi bi-upc-scan"></i></span></div></div><div class="col-sm-6"><label class="form-label">Expiry date (optional)</label><input type="date" class="form-control" id="f_exp" value="${p?.expiry_date ? esc(String(p.expiry_date).slice(0, 10)) : ''}"></div>
        ${e ? '' : '<div class="col-sm-6"><label class="form-label">Opening stock</label><input type="number" min="0" class="form-control" id="f_stock" value="0"></div>'}
        <div class="col-12"><label class="form-label">Description (shown on website)</label><textarea class="form-control" id="f_desc" rows="3" maxlength="4000">${esc(p?.description || '')}</textarea></div>
        <div class="col-12 d-flex flex-wrap gap-4"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="f_track" ${p && !p.track_stock ? '' : 'checked'}><label class="form-check-label">Track stock</label></div>
          ${ctx.biz.settings.has_website ? `<div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="f_pub" ${p?.is_published ? 'checked' : ''}><label class="form-check-label">Show on website</label></div><div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="f_feat" ${p?.is_featured ? 'checked' : ''}><label class="form-check-label">Featured</label></div>` : ''}</div></div></div></div>`,
      footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-fb" id="save">Save product</button>' });
    const f = id => m.el.querySelector('#' + id);
    f('file').onchange = async ev => { const file = ev.target.files[0]; if (!file) return; try { const data = await resizeImage(file); f('imgBox').innerHTML = '<div class="spinner-border"></div>'; const r = await post('/b/upload', { data }); img = r.url; f('imgBox').innerHTML = `<img src="${esc(img)}">`; } catch (err) { fail(err); f('imgBox').innerHTML = img ? `<img src="${esc(img)}">` : '<i class="bi bi-image"></i>'; } };
    f('save').onclick = async () => {
      const body = { name: f('f_name').value, brand: f('f_brand').value, size: f('f_size').value, category_id: f('f_cat').value || null, sku: f('f_sku').value, price: f('f_price').value, low_stock_at: f('f_low').value, description: f('f_desc').value, track_stock: f('f_track').checked, image_url: img, barcode: f('f_bar').value, expiry_date: f('f_exp').value || null, is_published: f('f_pub') ? f('f_pub').checked : false, is_featured: f('f_feat') ? f('f_feat').checked : false };
      if (cost) body.cost_price = f('f_cost').value; if (!e) body.stock_qty = f('f_stock').value;
      const b = f('save'); b.disabled = true;
      try { e ? await put('/b/products/' + p.id, body) : await post('/b/products', body); ok(e ? 'Product updated' : 'Product added'); m.close(); load(); } catch (err) { fail(err); b.disabled = false; }
    };
  }

  function stockForm(p) {
    const m = openModal({ size: 'modal-sm', title: `Stock · ${esc(p.name)}`, body: `<div class="mb-3 text-center"><div class="muted small">On shelf now</div><div class="display-6 fw-bold">${p.stock_qty}</div></div>
      <div class="mb-3"><label class="form-label">What happened?</label><select class="form-select" id="t"><option value="purchase">Received new stock (+)</option><option value="adjustment">Stock-take correction (+/−)</option><option value="damage">Damaged / expired / lost (−)</option></select></div>
      <div class="mb-3"><label class="form-label" id="ql">Quantity</label><input type="number" class="form-control" id="qty" placeholder="e.g. 12"></div>
      ${cost ? '<div class="mb-3" id="ucw"><label class="form-label">Unit cost (optional, updates average cost)</label><input type="number" min="0" class="form-control" id="uc"></div>' : ''}
      <div class="mb-1"><label class="form-label" id="nl">Note</label><input class="form-control" id="note" maxlength="200" placeholder="Supplier, invoice no., reason…"></div><div class="small muted mt-2">Every change is recorded permanently with your name.</div>`,
      footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-fb" id="go">Save</button>' });
    const f = id => m.el.querySelector('#' + id);
    f('t').onchange = () => { const t = f('t').value; f('ql').textContent = t === 'adjustment' ? 'Change (use − to reduce)' : 'Quantity'; if (f('ucw')) f('ucw').style.display = t === 'purchase' ? '' : 'none'; f('nl').textContent = t === 'purchase' ? 'Note' : 'Reason (required)'; };
    f('go').onclick = async () => { try { const r = await post(`/b/products/${p.id}/stock`, { type: f('t').value, qty: f('qty').value, unit_cost: f('uc')?.value, note: f('note').value }); ok('Stock updated', `${p.name}: now ${r.balance}`); m.close(); load(); } catch (e) { fail(e); } };
  }

  async function history(p) {
    const m = openModal({ size: 'modal-lg', title: `Stock history · ${esc(p.name)}`, body: skeleton(5, 22) });
    try { const rows = await get(`/b/products/${p.id}/movements`); m.el.querySelector('.modal-body').innerHTML = rows.length ? `<div class="tbl-wrap"><table class="fb-table"><thead><tr><th>When</th><th>Type</th><th class="num">Change</th><th class="num">Balance</th><th>By</th><th>Note</th></tr></thead><tbody>${rows.map(r => `<tr><td>${fmtDateTime(r.created_at)}</td><td>${pill(r.type.replace('_', ' '), r.qty_change > 0 ? 'success' : 'warning')}</td><td class="num"><b class="${r.qty_change > 0 ? 'text-success' : 'text-danger'}">${r.qty_change > 0 ? '+' : ''}${r.qty_change}</b></td><td class="num">${r.balance_after}</td><td>${esc(r.user_name || '—')}</td><td>${esc(r.note || '')}</td></tr>`).join('')}</tbody></table></div>` : empty('bi-clock-history', 'No movements yet'); }
    catch (e) { m.close(); fail(e); }
  }

  /* ---- categories ---- */
  $('#cats') && ($('#cats').onclick = () => {
    const m = openModal({ title: 'Categories', body: '<div id="cl"></div><div class="input-group mt-3"><input class="form-control" id="nc" placeholder="New category name"><button class="btn btn-fb" id="ac">Add</button></div>' });
    const drawC = () => { m.el.querySelector('#cl').innerHTML = cats.map(c => `<div class="feed-item"><div class="flex-grow-1 fw-semibold">${esc(c.name)} <small class="muted">· ${c.product_count} products</small></div><button class="btn btn-sm btn-soft" data-ren="${c.id}"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-danger-soft" data-del="${c.id}"><i class="bi bi-trash"></i></button></div>`).join('') || empty('bi-tags', 'No categories yet');
      m.el.querySelectorAll('[data-ren]').forEach(b => b.onclick = async () => { const c = cats.find(x => x.id == b.dataset.ren); const v = prompt('Rename category', c.name); if (v && v.trim()) { try { await put('/b/categories/' + c.id, { name: v }); await refresh(); } catch (e) { fail(e); } } });
      m.el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { try { await del('/b/categories/' + b.dataset.del); await refresh(); } catch (e) { fail(e); } }); };
    const refresh = async () => { cats = await get('/b/categories'); drawC(); fillCats(); };
    m.el.querySelector('#ac').onclick = async () => { const v = m.el.querySelector('#nc').value; try { await post('/b/categories', { name: v }); m.el.querySelector('#nc').value = ''; await refresh(); } catch (e) { fail(e); } };
    drawC();
  });
  $('#add') && ($('#add').onclick = () => form(null));
  ctx.on('product.changed', debounce(load, 800));
  load();
}
