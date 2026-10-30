// ─── FBBMS front-end settings ───────────────────────────────────────────────
// Set PRODUCTION_API to the public URL of your backend (the folder `backend`), ending in /api
export const PRODUCTION_API = 'https://api.fourbrothers.online/api';
export const DEV_API = 'https://fbbms-backend.onrender.com/api';
export const API_BASE = window.FBBMS_API || localStorage.getItem('fbbms_api') ||
  (['localhost', '127.0.0.1'].includes(location.hostname) ? DEV_API : PRODUCTION_API);
export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');
export const TZ = 'Africa/Dar_es_Salaam';
export const BIZ_LOGOS = { zanlux: 'assets/zanlux-icon.png' }; // per-business emblem (by slug). Others fall back to the FBBMS mark.
export const DEFAULT_LOGO = 'assets/fbbms-logo.svg';
