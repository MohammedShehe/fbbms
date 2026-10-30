import { API_BASE } from './config.js';

export const session = {
  get token() { return localStorage.getItem('fbbms_token'); },
  set token(v) { v ? localStorage.setItem('fbbms_token', v) : localStorage.removeItem('fbbms_token'); },
  get biz() { return Number(localStorage.getItem('fbbms_biz')) || null; },
  set biz(v) { v ? localStorage.setItem('fbbms_biz', v) : localStorage.removeItem('fbbms_biz'); },
  clear() { localStorage.removeItem('fbbms_token'); localStorage.removeItem('fbbms_biz'); }
};

export class ApiError extends Error { constructor(msg, status, detail) { super(msg); this.status = status; this.detail = detail; } }

const qs = p => { const u = new URLSearchParams(); Object.entries(p || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') u.append(k, v); }); const s = u.toString(); return s ? '?' + s : ''; };

export async function api(path, { method = 'GET', body, params, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && session.token) headers.Authorization = 'Bearer ' + session.token;
  if (path.startsWith('/b/') && session.biz) headers['X-Business-Id'] = String(session.biz);
  let res;
  try { res = await fetch(API_BASE + path + qs(params), { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }); }
  catch { throw new ApiError('Cannot reach the server. Check your internet connection.', 0); }
  let data = null; try { data = await res.json(); } catch { /* empty */ }
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
