import { get } from '../api.js';
import { esc, num, fmtDateTime, pill, debounce, empty, skeleton, downloadCSV } from '../ui.js';

export async function render(el, ctx) {
  const st = { type: '', q: '', limit: 150 };
  el.innerHTML = `<div class="page-head"><div><h1>Stock ledger</h1><p>Every unit that entered or left the shop — permanent, with who did it. Nothing can be edited or removed.</p></div><button class="btn btn-soft" id="csv"><i class="bi bi-download me-1"></i>CSV</button></div>
  <div class="filters"><div class="search"><i class="bi bi-search"></i><input id="q" class="form-control" placeholder="Search product or SKU…"></div>
  <select id="type" class="form-select"><option value="">All movements</option><option value="opening">Opening stock</option><option value="purchase">Received</option><option value="sale">Sold</option><option value="void_return">Void returns</option><option value="adjustment">Adjustments</option><option value="damage">Damaged / lost</option></select></div>
  <div class="tbl-wrap"><table class="fb-table stack"><thead><tr><th>When</th><th>Product</th><th>Type</th><th class="num">Change</th><th class="num">Balance</th><th>By</th><th>Note</th></tr></thead><tbody id="rows"></tbody></table></div>`;
  const $ = s => el.querySelector(s); let rows = [];
  const kind = { sale: 'info', purchase: 'success', opening: 'success', void_return: 'warning', adjustment: 'gold', damage: 'danger' };
  const load = async () => { $('#rows').innerHTML = `<tr><td colspan="7">${skeleton(6, 22)}</td></tr>`; try { rows = await get('/b/stock-ledger', st);
    $('#rows').innerHTML = rows.length ? rows.map(r => `<tr><td data-label="When">${fmtDateTime(r.created_at)}</td><td data-label="Product"><b>${esc(r.product_name)}</b><br><small class="muted">${esc(r.sku)}</small></td><td data-label="Type">${pill(r.type.replace('_', ' '), kind[r.type])}</td><td class="num" data-label="Change"><b class="${r.qty_change > 0 ? 'text-success' : 'text-danger'}">${r.qty_change > 0 ? '+' : ''}${r.qty_change}</b></td><td class="num" data-label="Balance">${num(r.balance_after)}</td><td data-label="By">${esc(r.user_name || '—')}</td><td data-label="Note">${esc(r.note || '')}</td></tr>`).join('') : `<tr><td colspan="7">${empty('bi-clipboard-data', 'No movements found')}</td></tr>`; } catch (e) { $('#rows').innerHTML = `<tr><td colspan="7">${empty('bi-exclamation-triangle', 'Error', e.message)}</td></tr>`; } };
  $('#type').onchange = e => { st.type = e.target.value; load(); }; $('#q').oninput = debounce(e => { st.q = e.target.value; load(); }, 300);
  $('#csv').onclick = () => downloadCSV('stock_ledger.csv', [['When', 'SKU', 'Product', 'Type', 'Change', 'Balance', 'By', 'Note'], ...rows.map(r => [r.created_at, r.sku, r.product_name, r.type, r.qty_change, r.balance_after, r.user_name, r.note])]);
  ctx.on('product.changed', debounce(load, 800)); ctx.on('sale.new', debounce(load, 800)); load();
}
