// FBBMS · login animations. Purely visual: no network, no auth logic.
// Drives the live preview cards, pointer effects and the sign-in sequence.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = n => Math.round(n).toLocaleString('en-US');

/* ───────── pointer: grid spotlight + card parallax ───────── */
const root = document.documentElement;
const cards = [...document.querySelectorAll('.lx-card')];
let tx = 0, ty = 0, cx = 0, cy = 0, running = false;
function loop() {
  cx += (tx - cx) * .08; cy += (ty - cy) * .08;
  cards.forEach(c => { const d = +c.dataset.depth || 0; c.style.translate = `${(-cx * d).toFixed(2)}px ${(-cy * d).toFixed(2)}px`; });
  if (Math.abs(tx - cx) > .002 || Math.abs(ty - cy) > .002) requestAnimationFrame(loop); else running = false;
}
if (!reduce && matchMedia('(pointer:fine)').matches) {
  addEventListener('pointermove', e => {
    root.style.setProperty('--mx', e.clientX + 'px'); root.style.setProperty('--my', e.clientY + 'px');
    tx = (e.clientX / innerWidth - .5) * 2; ty = (e.clientY / innerHeight - .5) * 2;
    if (!running) { running = true; requestAnimationFrame(loop); }
  }, { passive: true });
}

/* ───────── live preview (sample data) ───────── */
const el = { total: $('#fxTotal'), count: $('#fxCount'), line: $('#fxLine'), area: $('#fxArea'), dot: $('#fxDot'), pulse: $('#fxPulse'), delta: $('#fxDelta'), orders: $('#fxOrders'), stock: $('#fxStock') };
if (el.total && el.orders) initPreview();

function initPreview() {
  let total = 4_820_000, orders = 126, orderNo = 1039, deltaV = 12.4;

  // count-up once the cards have been dealt
  const countTo = (node, to, ms, from = 0) => {
    if (reduce) { node.textContent = fmt(to); return; }
    const t0 = performance.now();
    (function step(t) { const k = Math.min(1, (t - t0) / ms); node.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - k, 4))); if (k < 1) requestAnimationFrame(step); })(t0);
  };
  setTimeout(() => countTo(el.total, total, 1700), reduce ? 0 : 900);

  /* sparkline */
  const W = 258, H = 62, N = 22;
  let vals = Array.from({ length: N }, (_, i) => 38 + i * 1.3 + Math.sin(i / 2.2) * 12 + rand(-5, 5));
  function draw(v) {
    const lo = Math.min(...v) - 4, hi = Math.max(...v) + 4;
    const pts = v.map((y, i) => [i * (W / (N - 1)), H - 4 - ((y - lo) / (hi - lo)) * (H - 10)]);
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], m = (x0 + x1) / 2; d += ` C${m},${y0} ${m},${y1} ${x1},${y1}`; }
    el.line.setAttribute('d', d); el.area.setAttribute('d', `${d} L${W},${H} L0,${H} Z`);
    const [lx, ly] = pts[pts.length - 1];
    [el.dot, el.pulse].forEach(c => { c.setAttribute('cx', lx); c.setAttribute('cy', ly); });
  }
  draw(vals);
  if (!reduce) { // draw-on at load
    const len = el.line.getTotalLength?.() || 400;
    el.line.style.strokeDasharray = len; el.line.style.strokeDashoffset = len;
    el.line.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 1500, delay: 900, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' })
      .finished.then(() => { el.line.style.strokeDasharray = ''; el.line.style.strokeDashoffset = ''; }).catch(() => {});
  }
  function pushSpark(bump) {
    const from = vals.slice(), next = vals.slice(1).concat(Math.max(20, Math.min(90, from[from.length - 1] + rand(-8, 10) + bump)));
    if (reduce) { vals = next; draw(vals); return; }
    const t0 = performance.now(), D = 850;
    (function step(t) { const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3); draw(from.map((v, i) => v + (next[i] - v) * e)); if (k < 1) requestAnimationFrame(step); else vals = next; })(t0);
  }

  /* stock */
  const items = [['Oud Royale 50 ml', 78], ['Match jersey · M', 54], ['Amber musk 100 ml', 36], ['Training boots · 42', 18]];
  el.stock.innerHTML = items.map(([n]) => `<li><div class="r"><span>${n}</span><em></em></div><div class="t"><i></i></div></li>`).join('');
  const rows = [...el.stock.children];
  const level = items.map(i => i[1]);
  function paintStock(i) {
    const li = rows[i], p = Math.max(4, Math.min(100, level[i]));
    li.querySelector('i').style.width = p + '%'; li.querySelector('em').textContent = p < 20 ? 'Low' : Math.round(p) + '%'; li.classList.toggle('low', p < 20);
  }
  setTimeout(() => rows.forEach((_, i) => paintStock(i)), reduce ? 0 : 1100);

  /* orders */
  const who = ['Walk-in', 'Amina K.', 'Joseph M.', 'Online order', 'Neema S.', 'Hassan R.', 'Walk-in', 'Grace T.'];
  const pay = [['Cash', 'em'], ['M-Pesa', 'vi'], ['Card', 'am'], ['M-Pesa', 'vi']];
  function orderRow() {
    const amt = Math.round(rand(14, 190)) * 1000, [p, c] = pick(pay), li = document.createElement('li');
    li.className = 'lx-ord';
    li.innerHTML = `<span class="id">#${++orderNo}</span><span class="who">${pick(who)}</span><span class="pay ${c}">${p}</span><b>${fmt(amt)}</b>`;
    return { li, amt };
  }
  for (let i = 0; i < 3; i++) { const { li } = orderRow(); li.style.animation = 'none'; el.orders.prepend(li); }

  function tick() {
    if (document.hidden) return;
    const { li, amt } = orderRow();
    el.orders.prepend(li);
    const all = [...el.orders.children];
    if (all.length > 3) { const last = all[all.length - 1]; last.classList.add('out'); setTimeout(() => last.remove(), 450); }
    const from = total; total += amt; orders++;
    countTo(el.total, total, 900, from); el.count.textContent = orders;
    pushSpark(amt / 14000);
    deltaV = Math.max(4, Math.min(24, deltaV + rand(-.5, .6)));
    el.delta.innerHTML = `<i class="bi bi-arrow-up-right"></i> ${deltaV.toFixed(1)}%`;
    const s = Math.floor(Math.random() * rows.length); level[s] -= rand(4, 9); paintStock(s);
    if (level[s] < 12) setTimeout(() => { level[s] = rand(80, 95); paintStock(s); }, 2600);
  }
  if (!reduce) setTimeout(() => { tick(); setInterval(tick, 2700); }, 2600);
}

/* ───────── sign-in choreography (used by login.js) ───────── */
export function setAuthing(on) { document.body.classList.toggle('is-authing', !!on); }

export function stepIn(node) {
  node.classList.remove('d-none', 'lx-enter'); void node.offsetWidth; node.classList.add('lx-enter');
}

export function shake(node) {
  if (!node || reduce) return;
  node.classList.remove('lx-shake'); void node.offsetWidth; node.classList.add('lx-shake');
  node.addEventListener('animationend', () => node.classList.remove('lx-shake'), { once: true });
}

export async function playUnlock() {
  const u = $('#unlock'); if (u) u.setAttribute('aria-hidden', 'false');
  setAuthing(false);
  document.body.classList.add('is-unlocked');
  if (reduce) { await sleep(250); return; }
  await sleep(1500);                       // ring + tick draw, progress bar fills
  document.body.classList.add('is-exit');  // card dissolves, circle wipe
  await sleep(650);
}
