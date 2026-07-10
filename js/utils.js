/* ============================================================
   FBBMS UTILITIES
   ============================================================ */

const FB_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const FB_DAYS   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function fbFormatMoney(amount){
  const n = Number(amount) || 0;
  return "TZS " + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fbFormatDateLong(d = new Date()){
  return `${FB_DAYS[d.getDay()]}, ${d.getDate()} ${FB_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function fbFormatDateShort(d = new Date()){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function fbFormatTime(d = new Date()){
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2,"0");
  const s = String(d.getSeconds()).padStart(2,"0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12; if(h === 0) h = 12;
  return { display: `${String(h).padStart(2,"0")}:${m}:${s}`, ampm };
}

/* Mounts a live ticking clock into a container with the FBBMS "ledger clock" markup */
function fbMountLiveClock(containerEl){
  if(!containerEl) return;
  containerEl.innerHTML = `
    <div class="fb-clock">
      <div class="fb-clock-date" data-fb-date></div>
      <div class="fb-clock-time">
        <span data-fb-time></span>
        <span class="fb-clock-ampm" data-fb-ampm></span>
      </div>
    </div>
  `;
  const dateEl = containerEl.querySelector("[data-fb-date]");
  const timeEl = containerEl.querySelector("[data-fb-time]");
  const ampmEl = containerEl.querySelector("[data-fb-ampm]");

  function tick(){
    const now = new Date();
    dateEl.textContent = fbFormatDateLong(now);
    const t = fbFormatTime(now);
    timeEl.textContent = t.display;
    ampmEl.textContent = t.ampm;
  }
  tick();
  setInterval(tick, 1000);
}

function fbGenerateId(prefix="REC"){
  return prefix + "-" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random()*900+100);
}

function fbGenerateOtp(){
  return String(Math.floor(100000 + Math.random()*900000));
}

function fbToast(message, type="info"){
  let host = document.getElementById("fbToastHost");
  if(!host){
    host = document.createElement("div");
    host.id = "fbToastHost";
    host.className = "fb-toast-host";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = `fb-toast fb-toast-${type}`;
  const icons = { info:"bi-info-circle", success:"bi-check-circle", error:"bi-exclamation-circle", warning:"bi-exclamation-triangle" };
  el.innerHTML = `<i class="bi ${icons[type]||icons.info}"></i><span>${message}</span>`;
  host.appendChild(el);
  requestAnimationFrame(()=> el.classList.add("show"));
  setTimeout(()=>{
    el.classList.remove("show");
    setTimeout(()=> el.remove(), 350);
  }, 4200);
}

function fbDebounce(fn, wait=250){
  let t;
  return (...args)=>{ clearTimeout(t); t = setTimeout(()=> fn(...args), wait); };
}

function fbEscapeHtml(str){
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

function fbInitials(name){
  if(!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0]||"")).toUpperCase();
}
