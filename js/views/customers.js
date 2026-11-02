// Customer CRM: segments, profiles, purchase history, loyalty, debts (receivables), birthdays. Also exports pickCustomer() for the POS.
import { get, post, put } from '../api.js';
import { esc, money, num, fmtDate, openModal, confirmBox, fail, ok, pill, empty, skeleton, debounce, downloadCSV, pager, payLabel, PAY, todayEAT } from '../ui.js';
import { exportButtons } from '../export.js';

const SEG = { vip: ['VIP', 'gold'], regular: ['Regular', 'success'], new: ['New', 'info'], dormant: ['Dormant', 'warning'], prospect: ['Prospect', ''] };
const segPill = s => { const [t, k] = SEG[s] || [s, '']; return pill(t, k); };
const waLink = p => { const d = String(p || '').replace(/\D/g, ''); return d ? `https://wa.me/${d.replace(/^0/, '255')}` : ''; };

/** Opens a modal to search customers (name / phone) or quick-create one. onPick(customer) receives {id,name,phone,loyalty_points,balance}. */
export async function pickCustomer(ctx, { onPick } = {}) {
  const canAdd = ctx.can('customers.manage');
  const m = openModal({ size: 'modal-sm', title: 'Choose customer', body: `<div class="search mb-2"><i class="bi bi-search"></i><input id="pq" class="form-control" placeholder="Name or phone (2+ letters)…" autofocus></div><div id="pr" class="mb-2"><div class="small muted">Type to search.</div></div>
    ${canAdd ? `<hr><div class="small fw-semibold mb-2">New customer</div><div class="mb-2"><input class="form-control" id="nn" placeholder="Full name"></div><div class="mb-2"><input class="form-control" id="np" placeholder="Phone (07…)" inputmode="tel"></div><button class="btn btn-fb w-100" id="nc">Add & select</button>` : ''}`,
    footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button>' });
  const q = s => m.el.querySelector(s); let rows = [];
  const pick = c => { m.close(); onPick && onPick(c); };
  const search = debounce(async () => {
    const t = q('#pq').value.trim(); if (t.length < 2) { q('#pr').innerHTML = '<div class="small muted">Type to search.</div>'; return; }
    try { rows = await get('/b/customers/lookup', { q: t }); } catch (e) { return fail(e); }
    q('#pr').innerHTML = rows.length ? rows.map((c, i) => `<button class="feed-item w-100 text-start border-0 bg-transparent" data-i="${i}"><div class="flex-grow-1"><div class="fw-semibold">${esc(c.name)}</div><div class="small muted">${esc(c.phone || 'no phone')}${c.loyalty_points ? ` · ${num(c.loyalty_points)} pts` : ''}</div></div>${c.balance > 0.009 ? pill('Owes ' + money(c.balance), 'danger') : ''}</button>`).join('') : '<div class="small muted">No match. Add them below.</div>';
    q('#pr').querySelectorAll('[data-i]').forEach(b => b.onclick = () => pick(rows[b.dataset.i]));
  }, 250);
  q('#pq').oninput = search;
  if (canAdd) q('#nc').onclick = async () => {
    try { const name = q('#nn').value.trim(), phone = q('#np').value.trim(); const r = await post('/b/customers', { name, phone }); pick({ id: r.id, name, phone, loyalty_points: 0, balance: 0 }); } catch (e) { fail(e); }
  };
}

export async function render(el, ctx) {
  const manage = ctx.can('customers.manage'); const cur = ctx.biz.currency; const loyaltyOn = !!ctx.biz.settings.loyalty_enabled;
  const st = { tab: 'list', q: '', segment: '', sort: '', debt: false, archived: false, page: 1, limit: 30, days: 30 };
  let seg = null, list = null, rec = null, bdays = null;

  el.innerHTML = `<div class="page-head"><div><h1>Customers</h1><p>Know who buys, who owes you and who to thank.</p></div><div class="d-flex gap-2 flex-wrap"><span class="d-flex gap-2" id="exp"></span>${manage ? '<button class="btn btn-fb" id="add"><i class="bi bi-person-plus me-1"></i>Add customer</button>' : ''}</div></div>
    <div class="row g-3 mb-3" id="kpis"></div>
    <div class="chips mb-3" id="tabs"><span class="chip" data-t="list">Customers</span><span class="chip" data-t="rec">Receivables</span><span class="chip" data-t="bd">Birthdays</span></div><div id="body">${skeleton(5, 24)}</div>`;
  const $ = s => el.querySelector(s);
  const params = () => ({ q: st.q, segment: st.segment, sort: st.sort, debt: st.debt ? 1 : '', status: st.archived ? 'archived' : '', page: st.page, limit: st.limit });

  const exportData = async () => {
    if (st.tab === 'rec') { rec = rec || await get('/b/receivables'); return { filename: 'receivables', title: 'Customer receivables', subtitle: `Total owed: ${money(rec.total)}`, columns: ['Customer', 'Phone', 'Invoices', 'Oldest (days)', 'Owes'], rows: rec.customers.map(c => [c.name, c.phone || '', c.invoices, c.oldest_days, c.due]) }; }
    const all = await get('/b/customers', { ...params(), page: 1, limit: 200 });
    return { filename: 'customers', title: 'Customers', columns: ['Name', 'Phone', 'Email', 'Segment', 'Purchases', 'Lifetime spend', 'Last purchase', 'Owes', 'Points'], rows: all.rows.map(c => [c.name, c.phone || '', c.email || '', c.segment, c.orders, c.spent, c.last_purchase ? fmtDate(c.last_purchase) : '', c.balance, c.loyalty_points]) };
  };
  $('#exp').innerHTML = '<button class="btn btn-soft" id="csv"><i class="bi bi-download me-1"></i>CSV</button>';
  $('#csv').onclick = async () => { try { const d = await exportData(); downloadCSV(d.filename + '.csv', [d.columns, ...d.rows]); } catch (e) { fail(e); } };
  exportButtons($('#exp'), exportData);

  const loadSeg = async () => { seg = await get('/b/customers/segments'); kpis(); };
  const kpis = () => { const c = seg.counts || {}; $('#kpis').innerHTML = [['Customers', seg.total, 'var(--primary)'], ['VIP', c.vip || 0, 'var(--accent)'], ['Dormant', c.dormant || 0, 'var(--warning,#ffb84d)'], ['New (30 d)', c.new || 0, 'var(--info,#56a8ff)']].map(([l, v, col]) => `<div class="col-6 col-lg-3"><div class="kpi" style="--c:${col}"><div class="lbl">${l}</div><div class="val">${num(v)}</div></div></div>`).join(''); };

  const draw = async () => {
    $('#tabs').querySelectorAll('.chip').forEach(c => { c.classList.toggle('active', c.dataset.t === st.tab); c.onclick = () => { st.tab = c.dataset.t; draw(); }; });
    const b = $('#body'); b.innerHTML = skeleton(4, 24);
    try { if (st.tab === 'list') await drawList(b); else if (st.tab === 'rec') await drawRec(b); else await drawBd(b); } catch (e) { b.innerHTML = empty('bi-exclamation-triangle', 'Could not load', e.message); }
  };

  async function drawList(b) {
    b.innerHTML = `<div class="chips mb-2" id="sg"><span class="chip" data-s="">All</span>${Object.entries(SEG).map(([k, v]) => `<span class="chip" data-s="${k}" title="${esc(seg.rules?.[k] || '')}">${v[0]} <small>${seg.counts[k] || 0}</small></span>`).join('')}</div>
      <div class="filters"><div class="search"><i class="bi bi-search"></i><input id="q" class="form-control" placeholder="Search name, phone or email…" value="${esc(st.q)}"></div>
      <select id="so" class="form-select"><option value="">Name A–Z</option><option value="spent">Top spenders</option><option value="recent">Most recent</option><option value="balance">Highest debt</option></select>
      <label class="form-check d-flex align-items-center gap-2 m-0"><input type="checkbox" class="form-check-input" id="db" ${st.debt ? 'checked' : ''}><span class="small">Owing only</span></label><label class="form-check d-flex align-items-center gap-2 m-0"><input type="checkbox" class="form-check-input" id="ar" ${st.archived ? 'checked' : ''}><span class="small">Archived</span></label></div>
      <div class="small muted mb-2">${esc(seg.rules ? 'Segments: ' + Object.entries(seg.rules).map(([k, v]) => `${SEG[k]?.[0] || k} = ${v}`).join(' · ') : '')}</div>
      <div class="tbl-wrap"><table class="fb-table stack"><thead><tr><th>Customer</th><th>Segment</th><th class="num">Purchases</th><th class="num">Spent</th><th>Last</th><th class="num">Owes</th>${loyaltyOn ? '<th class="num">Points</th>' : ''}<th></th></tr></thead><tbody id="r"></tbody></table></div><div class="pager" id="pg"></div>`;
    b.querySelector('#so').value = st.sort;
    b.querySelectorAll('#sg .chip').forEach(c => { c.classList.toggle('active', c.dataset.s === st.segment); c.onclick = () => { st.segment = c.dataset.s; st.page = 1; draw(); }; });
    b.querySelector('#q').oninput = debounce(e => { st.q = e.target.value; st.page = 1; load(); }, 300);
    b.querySelector('#so').onchange = e => { st.sort = e.target.value; st.page = 1; load(); };
    b.querySelector('#db').onchange = e => { st.debt = e.target.checked; st.page = 1; load(); };
    b.querySelector('#ar').onchange = e => { st.archived = e.target.checked; st.page = 1; load(); };
    const load = async () => {
      list = await get('/b/customers', params());
      b.querySelector('#r').innerHTML = list.rows.length ? list.rows.map(c => `<tr class="${c.status === 'archived' ? 'voided' : ''}"><td data-label="Customer"><b>${esc(c.name)}</b><br><small class="muted">${esc(c.phone || c.email || '—')}</small></td><td data-label="Segment">${segPill(c.segment)}</td><td class="num" data-label="Purchases">${num(c.orders)}</td><td class="num" data-label="Spent">${money(c.spent)}</td><td data-label="Last">${c.last_purchase ? fmtDate(c.last_purchase) : '—'}</td><td class="num" data-label="Owes">${c.balance > 0.009 ? `<b class="text-danger">${money(c.balance)}</b>` : '—'}</td>${loyaltyOn ? `<td class="num" data-label="Points">${num(c.loyalty_points)}</td>` : ''}<td class="text-end"><button class="btn btn-sm btn-soft" data-v="${c.id}">Open</button></td></tr>`).join('') : `<tr><td colspan="8">${empty('bi-people', 'No customers found', manage ? 'Add customers here, or pick them at the till.' : '')}</td></tr>`;
      b.querySelectorAll('[data-v]').forEach(x => x.onclick = () => detail(Number(x.dataset.v)));
      pager(b.querySelector('#pg'), list, p => { st.page = p; load(); });
    };
    await load();
  }

  async function drawRec(b) {
    rec = await get('/b/receivables'); const a = rec.aging;
    b.innerHTML = `<div class="row g-3 mb-3">${[['Total owed to you', rec.total, 'var(--danger)'], ...Object.entries(rec.buckets).map(([k, l]) => [l, a[k], 'var(--primary)'])].map(([l, v, col]) => `<div class="col-6 col-lg"><div class="kpi" style="--c:${col}"><div class="lbl">${esc(l)}</div><div class="val">${money(v)}</div></div></div>`).join('')}</div>
      <div class="tbl-wrap"><table class="fb-table stack"><thead><tr><th>Customer</th><th class="num">Invoices</th><th class="num">Oldest</th><th class="num">Owes</th><th></th></tr></thead><tbody>${rec.customers.length ? rec.customers.map(c => `<tr><td data-label="Customer"><b>${esc(c.name)}</b><br><small class="muted">${esc(c.phone || '')}</small></td><td class="num" data-label="Invoices">${c.invoices}</td><td class="num" data-label="Oldest">${pill(c.oldest_days + ' d', c.oldest_days > 90 ? 'danger' : c.oldest_days > 30 ? 'warning' : '')}</td><td class="num" data-label="Owes"><b class="text-danger">${money(c.due)}</b></td><td class="text-end">${manage ? `<button class="btn btn-sm btn-fb" data-c="${c.customer_id}">Collect</button> ` : ''}${waLink(c.phone) ? `<a class="btn btn-sm btn-soft" target="_blank" rel="noopener" href="${waLink(c.phone)}"><i class="bi bi-whatsapp"></i></a> ` : ''}<button class="btn btn-sm btn-soft" data-v="${c.customer_id}">Open</button></td></tr>`).join('') : `<tr><td colspan="5">${empty('bi-check2-circle', 'Nobody owes you', 'Credit sales will appear here.')}</td></tr>`}</tbody></table></div>`;
    b.querySelectorAll('[data-v]').forEach(x => x.onclick = () => detail(Number(x.dataset.v)));
    b.querySelectorAll('[data-c]').forEach(x => x.onclick = () => repay(Number(x.dataset.c), rec.customers.find(c => c.customer_id == x.dataset.c).due, rec.customers.find(c => c.customer_id == x.dataset.c).name));
  }

  async function drawBd(b) {
    bdays = await get('/b/customers/birthdays', { days: st.days });
    b.innerHTML = `<div class="filters"><select id="dy" class="form-select">${[7, 14, 30, 60].map(d => `<option value="${d}" ${d === st.days ? 'selected' : ''}>Next ${d} days</option>`).join('')}</select></div>
      <div class="tbl-wrap"><table class="fb-table stack"><thead><tr><th>Customer</th><th>Birthday</th><th>In</th><th></th></tr></thead><tbody>${bdays.length ? bdays.map(c => `<tr><td data-label="Customer"><b>${esc(c.name)}</b><br><small class="muted">${esc(c.phone || '')}${c.marketing_ok ? '' : ' · no marketing'}</small></td><td data-label="Birthday">${fmtDate(c.next_birthday)}</td><td data-label="In">${c.days_left === 0 ? pill('Today! 🎂', 'gold') : c.days_left + ' d'}</td><td class="text-end">${c.marketing_ok && waLink(c.phone) ? `<a class="btn btn-sm btn-soft" target="_blank" rel="noopener" href="${waLink(c.phone)}?text=${encodeURIComponent(`Happy birthday ${c.name.split(' ')[0]}! 🎉 From all of us at ${ctx.biz.short_name}.`)}"><i class="bi bi-whatsapp me-1"></i>Wish</a>` : ''}<button class="btn btn-sm btn-soft" data-v="${c.id}">Open</button></td></tr>`).join('') : `<tr><td colspan="4">${empty('bi-cake2', 'No birthdays coming up', 'Add birthdays on customer profiles.')}</td></tr>`}</tbody></table></div>`;
    b.querySelector('#dy').onchange = e => { st.days = Number(e.target.value); draw(); };
    b.querySelectorAll('[data-v]').forEach(x => x.onclick = () => detail(Number(x.dataset.v)));
  }

  /* ---------- add / edit ---------- */
  function form(c) {
    const m = openModal({ title: c ? `Edit · ${esc(c.name)}` : 'Add customer', body: `<div class="row g-3"><div class="col-md-6"><label class="form-label">Name *</label><input class="form-control" id="n" value="${esc(c?.name || '')}"></div><div class="col-md-6"><label class="form-label">Phone</label><input class="form-control" id="ph" inputmode="tel" value="${esc(c?.phone || '')}"></div>
      <div class="col-md-6"><label class="form-label">Email</label><input class="form-control" id="em" type="email" value="${esc(c?.email || '')}"></div><div class="col-md-6"><label class="form-label">Birthday</label><input class="form-control" id="bd" type="date" value="${esc(c?.birthday ? String(c.birthday).slice(0, 10) : '')}"></div>
      <div class="col-12"><label class="form-label">Address</label><input class="form-control" id="ad" value="${esc(c?.address || '')}"></div><div class="col-12"><label class="form-label">Notes</label><textarea class="form-control" id="nt" rows="2">${esc(c?.notes || '')}</textarea></div>
      <div class="col-12 form-check form-switch ms-2"><input class="form-check-input" type="checkbox" id="mk" ${c && !c.marketing_ok ? '' : 'checked'}><label class="form-check-label">OK to send offers and greetings</label></div></div>`,
      footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-fb" id="go">Save</button>' });
    const v = id => m.el.querySelector('#' + id);
    v('go').onclick = async () => { try { const body = { name: v('n').value, phone: v('ph').value, email: v('em').value, birthday: v('bd').value, address: v('ad').value, notes: v('nt').value, marketing_ok: v('mk').checked }; if (c) await put('/b/customers/' + c.id, body); else await post('/b/customers', body); ok('Customer saved'); m.close(); await loadSeg(); draw(); } catch (e) { fail(e); } };
  }

  /* ---------- repay debt ---------- */
  function repay(id, owed, name, after) {
    const m = openModal({ size: 'modal-sm', title: `Collect from ${esc(name)}`, body: `<p class="small muted">Owes <b>${money(owed)}</b>. Payments clear the oldest sales first.</p><div class="mb-3"><label class="form-label">Amount (${esc(cur)})</label><input class="form-control" type="number" min="0" step="any" id="am" value="${owed}"></div>
      <div class="mb-3"><label class="form-label">Method</label><select class="form-select" id="pm">${Object.entries(PAY).map(([k, v]) => `<option value="${k}">${esc(v[0])}</option>`).join('')}</select></div><div class="mb-1"><label class="form-label">Reference (optional)</label><input class="form-control" id="rf" maxlength="80"></div>`,
      footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-fb" id="go">Record payment</button>' });
    const v = x => m.el.querySelector('#' + x);
    v('go').onclick = async () => { try { const r = await post(`/b/customers/${id}/payments`, { amount: v('am').value, method: v('pm').value, reference: v('rf').value }); ok('Payment recorded', `${r.allocated.length} sale(s) updated · remaining ${money(r.remaining_balance)}`); m.close(); if (after) await after(); else draw(); } catch (e) { fail(e); } };
  }

  /* ---------- detail ---------- */
  async function detail(id) {
    const m = openModal({ size: 'modal-xl', title: 'Customer', body: skeleton(5, 28) });
    const paint = async () => {
      let c; try { c = await get('/b/customers/' + id); } catch (e) { m.close(); return fail(e); }
      m.el.querySelector('.modal-title').innerHTML = `${esc(c.name)} ${segPill(c.segment)} ${c.status === 'archived' ? pill('Archived') : ''}`;
      m.el.querySelector('.modal-body').innerHTML = `<div class="row g-3 mb-3"><div class="col-lg-4"><div>${c.phone ? `<i class="bi bi-telephone me-1"></i>${esc(c.phone)}` : '<span class="muted">No phone</span>'} ${waLink(c.phone) ? `<a href="${waLink(c.phone)}" target="_blank" rel="noopener" class="ms-1"><i class="bi bi-whatsapp"></i></a>` : ''}</div>${c.email ? `<div><i class="bi bi-envelope me-1"></i>${esc(c.email)}</div>` : ''}${c.birthday ? `<div><i class="bi bi-cake2 me-1"></i>${fmtDate(c.birthday)}</div>` : ''}${c.address ? `<div class="small muted">${esc(c.address)}</div>` : ''}${c.notes ? `<div class="small mt-2">${esc(c.notes)}</div>` : ''}<div class="small muted mt-2">Customer since ${fmtDate(c.created_at)}${c.marketing_ok ? '' : ' · no marketing'}</div></div>
        <div class="col-6 col-lg-2"><div class="kpi"><div class="lbl">Lifetime spend</div><div class="val">${money(c.spent)}</div></div></div><div class="col-6 col-lg-2"><div class="kpi"><div class="lbl">Purchases</div><div class="val">${num(c.orders)}</div></div></div>
        <div class="col-6 col-lg-2"><div class="kpi" style="--c:var(--danger)"><div class="lbl">Owes</div><div class="val">${money(c.balance)}</div></div></div>${loyaltyOn ? `<div class="col-6 col-lg-2"><div class="kpi"><div class="lbl">Points</div><div class="val">${num(c.loyalty_points)}</div></div></div>` : ''}</div>
        ${manage ? `<div class="d-flex flex-wrap gap-2 mb-3">${c.balance > 0.009 ? '<button class="btn btn-fb btn-sm" id="rp"><i class="bi bi-cash-coin me-1"></i>Collect payment</button>' : ''}${loyaltyOn ? '<button class="btn btn-soft btn-sm" id="pt"><i class="bi bi-stars me-1"></i>Adjust points</button>' : ''}<button class="btn btn-soft btn-sm" id="ed"><i class="bi bi-pencil me-1"></i>Edit</button><button class="btn btn-soft btn-sm" id="ar">${c.status === 'archived' ? 'Restore' : 'Archive'}</button></div>` : ''}
        ${c.favourites.length ? `<div class="mb-3 small"><b>Favourites:</b> ${c.favourites.map(f => `${esc(f.name)} <span class="muted">×${f.units}</span>`).join(' · ')}</div>` : ''}
        <div class="row g-3"><div class="col-lg-8"><h6>Purchase history</h6><div class="tbl-wrap"><table class="fb-table"><thead><tr><th>Receipt</th><th>Items</th><th class="num">Total</th><th class="num">Due</th></tr></thead><tbody>${c.sales.length ? c.sales.map(s => `<tr class="${s.status === 'voided' ? 'voided' : ''}"><td>${esc(s.receipt_no)}<br><small class="muted">${fmtDate(s.sale_date)}</small></td><td class="small">${esc(s.items || '')}</td><td class="num">${money(s.total)}${s.refunded_total > 0 ? `<br><small class="text-danger">−${money(s.refunded_total)} refunded</small>` : ''}</td><td class="num">${s.status === 'voided' ? pill('Voided', 'danger') : s.due > 0.009 ? `<b class="text-danger">${money(s.due)}</b>` : pill('Paid', 'success')}</td></tr>`).join('') : '<tr><td colspan="4" class="muted">No purchases yet</td></tr>'}</tbody></table></div></div>
        ${loyaltyOn ? `<div class="col-lg-4"><h6>Loyalty log</h6>${c.loyalty.length ? c.loyalty.map(l => `<div class="d-flex justify-content-between small border-bottom py-1"><span>${esc(l.reason || '')}<br><span class="muted">${fmtDate(l.created_at)}</span></span><b class="${l.points_change < 0 ? 'text-danger' : 'text-success'}">${l.points_change > 0 ? '+' : ''}${l.points_change}</b></div>`).join('') : '<div class="muted small">No points activity yet.</div>'}</div>` : ''}</div>`;
      const q = s => m.el.querySelector(s);
      if (q('#rp')) q('#rp').onclick = () => repay(id, c.balance, c.name, async () => { await paint(); await loadSeg(); draw(); });
      if (q('#ed')) q('#ed').onclick = () => { m.close(); form(c); };
      if (q('#ar')) q('#ar').onclick = async () => { try { await post(`/b/customers/${id}/archive`, { restore: c.status === 'archived' }); ok('Done'); m.close(); await loadSeg(); draw(); } catch (e) { fail(e); } };
      if (q('#pt')) q('#pt').onclick = () => {
        const pm = openModal({ size: 'modal-sm', title: 'Adjust loyalty points', body: `<p class="small muted">Current balance: <b>${num(c.loyalty_points)}</b>. Use a negative number to remove points.</p><div class="mb-3"><label class="form-label">Points</label><input class="form-control" type="number" id="pp" placeholder="e.g. 50 or -20"></div><div class="mb-1"><label class="form-label">Reason *</label><input class="form-control" id="pr" maxlength="120"></div>`, footer: '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button><button class="btn btn-fb" id="go">Apply</button>' });
        pm.el.querySelector('#go').onclick = async () => { try { const r = await post(`/b/customers/${id}/points`, { points: pm.el.querySelector('#pp').value, reason: pm.el.querySelector('#pr').value }); ok('Points updated', `New balance ${num(r.balance)}`); pm.close(); paint(); } catch (e) { fail(e); } };
      };
    };
    await paint();
  }

  if (manage) $('#add').onclick = () => form();
  await loadSeg(); await draw();
}
