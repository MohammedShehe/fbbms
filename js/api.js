import { API_BASE } from './config.js';
import { blocked, setBilling, getBilling } from './billing-state.js';

export const session = {
  get token() { return localStorage.getItem('fbbms_token'); },
  set token(v) { v ? localStorage.setItem('fbbms_token', v) : localStorage.removeItem('fbbms_token'); },
  get biz() { return Number(localStorage.getItem('fbbms_biz')) || null; },
  set biz(v) { v ? localStorage.setItem('fbbms_biz', v) : localStorage.removeItem('fbbms_biz'); },
  clear() { localStorage.removeItem('fbbms_token'); localStorage.removeItem('fbbms_biz'); }
};

export class ApiError extends Error { constructor(msg, status, detail, silent = false) { super(msg); this.status = status; this.detail = detail; this.silent = silent; } }

const qs = p => { const u = new URLSearchParams(); Object.entries(p || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') u.append(k, v); }); const s = u.toString(); return s ? '?' + s : ''; };

export async function api(path, { method = 'GET', body, params, auth = true } = {}) {
  // Unpaid business = read-only. Stop writes here (the server enforces it too) and show the renew popup instead of an error.
  if (method !== 'GET' && path.startsWith('/b/') && !path.startsWith('/b/billing') && path !== '/b/notifications/read' && blocked('write')) throw new ApiError('Subscription required', 402, null, true);
  const headers = { 'Content-Type': 'application/json' };
  if (auth && session.token) headers.Authorization = 'Bearer ' + session.token;
  if (path.startsWith('/b/') && session.biz) headers['X-Business-Id'] = String(session.biz);
  let res;
  try { res = await fetch(API_BASE + path + qs(params), { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }); }
  catch { throw new ApiError('Cannot reach the server. Check your internet connection.', 0); }
  let data = null; try { data = await res.json(); } catch { /* empty */ }
  if (res.status === 402 && data && data.code === 'SUBSCRIPTION_REQUIRED') {
    const cur = getBilling() || {}; setBilling({ ...cur, locked: true, state: 'expired' }); blocked('write');
    document.dispatchEvent(new CustomEvent('billing:refresh'));
    throw new ApiError(data.message, 402, null, true);
  }
  if (!res.ok) {
    if (res.status === 401 && auth && session.token) { session.clear(); location.href = 'index.html?expired=1'; }
    throw new ApiError((data && data.message) || 'Request failed', res.status, data && data.detail);
  }
  return data;
}

export const get = (p, params) => api(p, { params });
export const post = (p, body) => api(p, { method: 'POST', body: body || {} });
export const put = (p, body) => api(p, { method: 'PUT', body: body || {} });
export const del = p => api(p, { method: 'DELETE' });
export const streamUrl = () => `${API_BASE}/b/stream?token=${encodeURIComponent(session.token)}&b=${session.biz}`;

/** Authenticated file download (returns a Blob). */
export async function downloadBlob(path, { params } = {}) {
  const headers = {}; if (session.token) headers.Authorization = 'Bearer ' + session.token;
  let res; try { res = await fetch(API_BASE + path + qs(params), { headers }); } catch { throw new ApiError('Cannot reach the server. Check your internet connection.', 0); }
  if (!res.ok) { let m = 'Download failed'; try { m = (await res.json()).message || m; } catch (_) { /* ignore */ } throw new ApiError(m, res.status); }
  return res.blob();
}
