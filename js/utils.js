// js/utils.js
export const FB_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const FB_DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export function fbFormatMoney(amount) {
    const n = Number(amount) || 0;
    return "TZS " + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function fbFormatDateLong(d = new Date()) {
    return `${FB_DAYS[d.getDay()]}, ${d.getDate()} ${FB_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fbFormatDateShort(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export function fbFormatDateDisplay(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return fbFormatDateShort(d);
}

export function fbFormatTime(d = new Date()) {
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return { display: `${String(h).padStart(2, "0")}:${m}:${s}`, ampm };
}

export function fbMountLiveClock(containerEl) {
    if (!containerEl) return;
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

    function tick() {
        const now = new Date();
        dateEl.textContent = fbFormatDateLong(now);
        const t = fbFormatTime(now);
        timeEl.textContent = t.display;
        ampmEl.textContent = t.ampm;
    }
    tick();
    setInterval(tick, 1000);
}

export function fbToast(message, type = "info") {
    let host = document.getElementById("fbToastHost");
    if (!host) {
        host = document.createElement("div");
        host.id = "fbToastHost";
        host.className = "fb-toast-host";
        document.body.appendChild(host);
    }
    const el = document.createElement("div");
    el.className = `fb-toast fb-toast-${type}`;
    const icons = { 
        info: "bi-info-circle", 
        success: "bi-check-circle", 
        error: "bi-exclamation-circle", 
        warning: "bi-exclamation-triangle" 
    };
    el.innerHTML = `<i class="bi ${icons[type] || icons.info}"></i><span>${message}</span>`;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => el.remove(), 350);
    }, 4200);
}

export function fbDebounce(fn, wait = 250) {
    let t;
    return (...args) => { 
        clearTimeout(t); 
        t = setTimeout(() => fn(...args), wait); 
    };
}

export function fbEscapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str ?? "";
    return d.innerHTML;
}

export function fbInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

export function fbSetSession(session) {
    localStorage.setItem('fb_session', JSON.stringify(session));
}

export function fbGetSession() {
    try {
        const data = localStorage.getItem('fb_session');
        return data ? JSON.parse(data) : null;
    } catch (e) {
        return null;
    }
}

export function fbClearSession() {
    localStorage.removeItem('fb_session');
    localStorage.removeItem('fb_token');
}

export function fbSetToken(token) {
    localStorage.setItem('fb_token', token);
}

export function fbGetToken() {
    return localStorage.getItem('fb_token');
}

export function fbRequireRole(expectedRole) {
    const session = fbGetSession();
    if (!session || session.role !== expectedRole) {
        window.location.href = "index.html";
        return null;
    }
    return session;
}

export function fbLogout() {
    fbClearSession();
    window.location.href = "index.html";
}

export function fbWireProfileMenu(triggerId, dropdownId) {
    const trigger = document.getElementById(triggerId);
    const dropdown = document.getElementById(dropdownId);
    if (!trigger || !dropdown) return;
    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("show");
    });
    document.addEventListener("click", () => dropdown.classList.remove("show"));
    dropdown.addEventListener("click", (e) => e.stopPropagation());
}

// ============================================================
// BUTTON LOADER HELPERS (Added for OTP resend functionality)
// ============================================================

/**
 * Show loading state on a button with spinner
 * @param {HTMLElement} button - The button element
 * @param {string} loadingText - Text to show while loading (optional)
 * @returns {string} The original button text for restoration
 */
export function fbShowButtonLoader(button, loadingText = 'Loading...') {
    const originalText = button.textContent;
    button.disabled = true;
    button.innerHTML = `
        <span class="spinner" style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;vertical-align:middle;margin-right:8px;"></span> 
        ${loadingText}
    `;
    return originalText;
}

/**
 * Restore button to original state after loading
 * @param {HTMLElement} button - The button element
 * @param {string} originalText - The original button text to restore
 */
export function fbHideButtonLoader(button, originalText) {
    button.disabled = false;
    button.textContent = originalText;
}