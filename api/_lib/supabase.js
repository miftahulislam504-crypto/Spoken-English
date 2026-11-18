import { ApiError } from './http.js';
export function env() {
  const url = process.env.SUPABASE_URL; const anon = process.env.SUPABASE_ANON_KEY; const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon) throw new ApiError(500, 'server_error', 'Server is not configured.');
  return { url, anon, svc };
}
// Every upstream call has a timeout (plan section 15).
export async function timedFetch(url, opts = {}, ms = 8000) {
  const c = new AbortController(); const timer = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); } catch (e) { throw new ApiError(502, 'upstream_error'); } finally { clearTimeout(timer); }
}
// Checks the learner's token with Supabase Auth. Never trusts anything the client says about who they are.
export async function verifyUser(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) throw new ApiError(401, 'unauthenticated');
  const { url, anon } = env();
  const r = await timedFetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${m[1]}` } });
  if (r.status === 401 || r.status === 403) throw new ApiError(401, 'unauthenticated');
  if (!r.ok) throw new ApiError(502, 'upstream_error');
  const u = await r.json();
  return { id: u.id, email: u.email, token: m[1] };
}
// Database access over PostgREST. With the learner's token, row-level security applies. service:true bypasses it (server only).
export async function rest(method, path, { token, service = false, body, prefer } = {}) {
  const { url, anon, svc } = env();
  if (service && !svc) throw new ApiError(500, 'server_error', 'Server is not configured.');
  const r = await timedFetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { apikey: service ? svc : anon, Authorization: `Bearer ${service ? svc : token}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (r.status === 204) return null;
  const text = await r.text();
  const j = text ? JSON.parse(text) : null;
  if (!r.ok) {
    if (r.status === 409 || (j && j.code === '23505') || (j && j.code === '23503')) throw new ApiError(409, 'conflict');
    if (r.status === 401 || r.status === 403) throw new ApiError(403, 'forbidden');
    console.error('postgrest_error', r.status, j && j.code);
    throw new ApiError(502, 'upstream_error');
  }
  return j;
}
// For routes that work with or without a sign-in (usage events, feedback): the learner when the token is good, otherwise nobody.
export async function optionalUser(req) {
  if (!/^Bearer (.+)$/.test(req.headers.authorization || '')) return null;
  try { return await verifyUser(req); } catch (e) { return null; }
}
