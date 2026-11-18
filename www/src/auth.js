import { API_BASE } from './runtime-config.js';
const KEY = 'se.auth.v1';
let cfg = null;

async function tfetch(url, opts = {}, ms = 12000) {
  const c = new AbortController(); const id = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); } catch (e) { throw { code: 'network' }; } finally { clearTimeout(id); }
}
export const getSession = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const saveSession = (r) => localStorage.setItem(KEY, JSON.stringify({ access_token: r.access_token, refresh_token: r.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (r.expires_in || 3600), user: { id: r.user.id, email: r.user.email } }));

async function config() {
  if (cfg) return cfg;
  const r = await tfetch(`${API_BASE}/api/v1/public-config`);
  if (!r.ok) throw { code: 'config' };
  cfg = await r.json();
  return cfg;
}
function authCode(j) {
  const c = j.error_code || j.error || '';
  if (c === 'invalid_credentials' || /invalid login/i.test(j.msg || j.error_description || '')) return 'invalid_credentials';
  if (c === 'user_already_exists' || /already registered/i.test(j.msg || '')) return 'user_exists';
  if (c === 'weak_password') return 'weak_password';
  if (c === 'email_not_confirmed') return 'email_not_confirmed';
  if (/rate_limit/.test(c)) return 'rate_limited';
  return 'server_error';
}
async function gotrue(path, body, query = '') {
  const c = await config();
  const r = await tfetch(`${c.supabase_url}/auth/v1/${path}${query}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: c.anon_key }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw { code: authCode(j) };
  return j;
}
export async function signUp(email, password, name) {
  const j = await gotrue('signup', { email, password, data: { display_name: name } });
  if (j.access_token) { saveSession(j); return 'signed_in'; }
  return 'confirm_email';
}
export async function signIn(email, password) { saveSession(await gotrue('token', { email, password }, '?grant_type=password')); }
export const resetPassword = (email) => gotrue('recover', { email });
async function refresh() {
  const s = getSession(); if (!s) return null;
  try { saveSession(await gotrue('token', { refresh_token: s.refresh_token }, '?grant_type=refresh_token')); } catch (e) { if (e.code !== 'network') localStorage.removeItem(KEY); throw e; }
  return getSession();
}
export async function signOut() {
  const s = getSession();
  if (s) { try { const c = await config(); await tfetch(`${c.supabase_url}/auth/v1/logout`, { method: 'POST', headers: { apikey: c.anon_key, Authorization: 'Bearer ' + s.access_token } }); } catch (e) { /* signing out locally anyway */ } }
  localStorage.removeItem(KEY);
}
// Calls our own /api/v1 with the learner's token. Errors have a stable code.
export async function api(method, path, body, headers = {}) {
  let s = getSession(); if (!s) throw { code: 'unauthenticated' };
  if (s.expires_at - 60 < Date.now() / 1000) s = await refresh();
  if (!s) throw { code: 'unauthenticated' };
  const r = await tfetch(`${API_BASE}/api/v1${path}`, { method, headers: { ...headers, Authorization: 'Bearer ' + s.access_token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw { code: (j.error && j.error.code) || 'server_error', status: r.status, details: j.error && j.error.details };
  return j;
}
// For the few endpoints that need no sign-in (the list of plans).
export async function publicGet(path) {
  const r = await tfetch(`${API_BASE}/api/v1${path}`, { method: 'GET' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw { code: (j.error && j.error.code) || 'server_error', status: r.status };
  return j;
}
