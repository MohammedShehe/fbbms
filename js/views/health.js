// Business Health Monitor: transparent formula-based score (no AI), risk flags, recommendations, sales forecast.
import { get } from '../api.js';
import { esc, money, num, compact, shortDay, fail, pill, empty, skeleton, chartTheme, PALETTE } from '../ui.js';
import { exportPDF } from '../export.js';

const KIND = { good: 'success', watch: 'warning', risk: 'danger', nodata: '' };
const COL = { good: 'var(--success)', watch: 'var(--warning, #ffb84d)', risk: 'var(--danger)', nodata: 'var(--muted)' };
const STATUS = { good: 'Good', watch: 'Watch', risk: 'At risk', nodata: 'No data yet' };
let chart;

const gauge = (score, status) => {
  const s = score === null ? 0 : Math.max(0, Math.min(100, score)); const r = 70, c = Math.PI * r; const off = c * (1 - s / 100);
  return `<svg viewBox="0 0 180 110" width="220" role="img" aria-label="Health score ${score ?? 'n/a'}"><path d="M20 95 A70 70 0 0 1 160 95" fill="none" stroke="var(--border)" stroke-width="14" stroke-linecap="round"/>
  <path d="M20 95 A70 70 0 0 1 160 95" fill="none" stroke="${COL[status] || COL.nodata}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" style="transition:stroke-dashoffset .8s"/>
  <text x="90" y="88" text-anchor="middle" font-size="38" font-weight="800" fill="currentColor">${score ?? '—'}</text><text x="90" y="105" text-anchor="middle" font-size="10" fill="var(--muted)">out of 100</text></svg>`;
};
const scoreStatus = s => s === null ? 'nodata' : s >= 75 ? 'good' : s >= 50 ? 'watch' : 'risk';
const PRI = { high: ['High', 'danger'], medium: ['Medium', 'warning'], low: ['Low', 'info'] };

export async function render(el, ctx) {
  el.innerHTML = `<div class="page-head"><div><h1>Business health</h1><p>A score built from fixed, visible formulas on your own sales, stock and expenses. It is <b>not</b> written by AI and nothing is guessed.</p></div><div class="d-flex gap-2"><button class="btn btn-soft" id="pdf"><i class="bi bi-file-earmark-pdf me-1"></i>PDF</button><button class="btn btn-soft" id="re"><i class="bi bi-arrow-clockwise"></i></button></div></div><div id="b">${skeleton(5, 80)}</div>`;
  let H = null, F = null;
  const load = async () => {
    el.querySelector('#b').innerHTML = skeleton(5, 80);
    try { [H, F] = await Promise.all([get('/b/health'), get('/b/forecast').catch(() => null)]); } catch (e) { el.querySelector('#b').innerHTML = empty('bi-heart-pulse', 'Could not load', e.message); return; }
    draw();
  };
  const draw = () => {
    if (chart) { chart.destroy(); chart = null; }
    const st = scoreStatus(H.score);
    const ind = H.indicators.map(i => `<div class="col-md-6 col-xl-4"><div class="fb-card h-100"><div class="d-flex justify-content-between align-items-start gap-2"><div><div class="fw-bold">${esc(i.label)}</div><div class="small muted">Weight ${i.weight}% of total</div></div>${pill(STATUS[i.status] || i.status, KIND[i.status])}</div>
      <div class="d-flex align-items-baseline gap-2 my-2"><span style="font-size:2rem;font-weight:800;color:${COL[i.status] || ''}">${i.score ?? '—'}</span><span class="muted small">/ 100</span></div>
      <div style="height:6px;border-radius:6px;background:var(--border);overflow:hidden"><div style="width:${i.score ?? 0}%;height:100%;background:${COL[i.status] || COL.nodata}"></div></div>
      <div class="fw-semibold mt-2">${esc(i.headline)}</div><div class="small muted">${esc(i.detail)}</div>
      ${i.formula ? `<details class="mt-2"><summary class="small" style="cursor:pointer">How this score is calculated</summary><div class="small mt-1 p-2" style="background:var(--surface-2,rgba(127,127,127,.1));border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:.75rem">${esc(i.formula)}</div></details>` : ''}</div></div>`).join('');
    const flags = H.flags.length ? H.flags.map(f => `<div class="feed-item"><i class="bi bi-flag-fill fs-5 text-${f.severity === 'high' ? 'danger' : 'warning'}"></i><div class="flex-grow-1"><div class="fw-semibold small">${esc(f.title)} ${f.who ? `<span class="muted">· ${esc(f.who)}</span>` : ''} ${pill(f.severity, f.severity === 'high' ? 'danger' : 'warning')}</div><div class="small muted">${esc(f.detail)}</div></div></div>`).join('') : empty('bi-shield-check', 'No risk flags', 'Nothing unusual in the last 30 days.');
    const recs = H.recommendations.length ? H.recommendations.map(r => { const [t, k] = PRI[r.priority] || [r.priority, '']; return `<div class="feed-item"><i class="bi bi-lightbulb-fill fs-5 text-warning"></i><div class="flex-grow-1"><div class="small">${pill(t, k)} ${esc(r.text)}</div>${r.page ? `<a class="small" href="#/${esc(r.page)}">Open ${esc(r.page)} →</a>` : ''}</div></div>`; }).join('') : empty('bi-check2-circle', 'No actions needed', 'Keep going.');
    el.querySelector('#b').innerHTML = `<div class="fb-card mb-3"><div class="row align-items-center g-3"><div class="col-md-4 text-center">${gauge(H.score, st)}<div class="mt-1">${pill(H.grade, KIND[st])}</div><div class="small muted mt-1">As of ${esc(H.as_of)}</div></div>
      <div class="col-md-8"><h3 class="mb-1">How the score works</h3><p class="muted small mb-2">${esc(H.method || 'The overall score is a weighted average of the indicators below. Each indicator uses the formula shown on its card. Indicators with no data are left out and the weights are re-balanced.')}</p>
      <div class="d-flex flex-wrap gap-2">${H.indicators.map(i => `<span class="pill ${KIND[i.status]}">${esc(i.label)} · ${i.score ?? '—'}</span>`).join('')}</div></div></div></div>
      <div class="row g-3 mb-3">${ind}</div>
      <div class="row g-3 mb-3"><div class="col-lg-6"><div class="fb-card h-100"><h3>Risk flags</h3><div class="card-sub">Unusual activity worth a look</div>${flags}</div></div><div class="col-lg-6"><div class="fb-card h-100"><h3>Recommended actions</h3><div class="card-sub">Based on the numbers above</div>${recs}</div></div></div>
      <div class="fb-card"><h3>Sales forecast</h3><div class="card-sub">Next 14 days · confidence ${esc(F ? F.confidence : '—')}</div>${F ? `<div class="row g-2 mb-3"><div class="col-6 col-md-3"><div class="kpi"><div class="lbl">Month to date</div><div class="val">${money(F.month_to_date)}</div></div></div><div class="col-6 col-md-3"><div class="kpi"><div class="lbl">Projected month end</div><div class="val">${money(F.projected_month_end)}</div></div></div><div class="col-6 col-md-3"><div class="kpi"><div class="lbl">Trend factor</div><div class="val">×${F.trend_factor}</div></div></div></div>
      <div class="chart-box"><canvas id="fc"></canvas></div><p class="small muted mt-2 mb-0"><i class="bi bi-info-circle me-1"></i>${esc(F.method)}</p>` : empty('bi-graph-up', 'Forecast unavailable')}</div>`;
    if (F) {
      const t = chartTheme(); Chart.defaults.color = t.text; const hist = F.history.slice(-14);
      const labels = [...hist.map(d => shortDay(d.date)), ...F.next_days.map(d => shortDay(d.date))];
      chart = new Chart(el.querySelector('#fc'), { type: 'line', data: { labels, datasets: [
        { label: 'Actual', data: [...hist.map(d => d.revenue), ...F.next_days.map(() => null)], borderColor: PALETTE[0], backgroundColor: PALETTE[0] + '22', fill: true, tension: .3, pointRadius: 2 },
        { label: 'Forecast', data: [...hist.map(() => null), ...F.next_days.map(d => d.revenue)], borderColor: PALETTE[1], borderDash: [6, 4], tension: .3, pointRadius: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { usePointStyle: true } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${money(c.raw)}` } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: { grid: { color: t.grid }, ticks: { callback: v => compact(v) } } } } });
    }
  };
  el.querySelector('#re').onclick = load;
  el.querySelector('#pdf').onclick = async e => {
    if (!H) return; const b = e.currentTarget; b.disabled = true;
    try {
      await exportPDF(`Business health ${H.as_of}`, { subtitle: `${ctx.biz.name} · Score ${H.score ?? 'n/a'} (${H.grade}) · formula-based, not AI`, landscape: true, footer: 'Generated by FBBMS', sections: [
        { heading: 'Indicators', columns: ['Indicator', 'Score', 'Weight %', 'Status', 'Detail', 'Formula'], rows: H.indicators.map(i => [i.label, i.score ?? '—', i.weight, STATUS[i.status], `${i.headline}. ${i.detail}`, i.formula]) },
        { heading: 'Risk flags', columns: ['Severity', 'Who', 'Flag', 'Detail'], rows: H.flags.map(f => [f.severity, f.who || '', f.title, f.detail]) },
        { heading: 'Recommended actions', columns: ['Priority', 'Action'], rows: H.recommendations.map(r => [r.priority, r.text]) }] });
    } catch (err) { fail(err); }
    b.disabled = false;
  };
  ctx.cleanup = () => chart && chart.destroy();
  await load();
}
