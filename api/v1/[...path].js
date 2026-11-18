// One serverless function serves all of /api/v1 (keeps within hosting function limits).
import { ApiError, cors, errorBody, rateLimit } from '../_lib/http.js';
import { verifyUser, env } from '../_lib/supabase.js';
import { routes } from '../_lib/routes.js';
import { publicRoutes } from '../_lib/billing.js';
import { openRoutes } from '../_lib/open.js';
import { opsRoutes } from '../_lib/ops.js';

const openAll = [...publicRoutes, ...openRoutes, ...opsRoutes];

export default async function handler(req, res) {
  cors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const raw = req.query.path;
    const path = (Array.isArray(raw) ? raw : [raw].filter(Boolean)).join('/');
    const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
    if (path === 'health' && req.method === 'GET') return res.status(200).json({ status: 'ok', version: 'v1', time: new Date().toISOString() });
    if (path === 'public-config' && req.method === 'GET') {
      rateLimit('ip:' + ip, 60);
      const { url, anon } = env(); // the anon key is public by design; row-level security protects the data
      return res.status(200).json({ supabase_url: url, anon_key: anon });
    }
    const open = openAll.find(([m, re]) => m === req.method && re.test(path));
    if (open) { rateLimit(`ip:${path}:${ip}`, open[3]); return res.status(200).json(await open[2]({ req, query: req.query || {}, body: req.body })); }
    const route = routes.find(([m, re]) => m === req.method && re.test(path));
    if (!route) throw routes.some(([, re]) => re.test(path)) ? new ApiError(405, 'method_not_allowed') : new ApiError(404, 'not_found');
    const user = await verifyUser(req);
    rateLimit('u:' + user.id, 120);
    const out = await route[2]({ req, user, params: route[1].exec(path).slice(1), body: req.body, query: req.query });
    if (out && out.status === 204) return res.status(204).end();
    return res.status(200).json(out);
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === 'rate_limited') res.setHeader('Retry-After', '30');
      return res.status(e.status).json(errorBody(e.code, e.details));
    }
    console.error('api_error', e && e.message);
    return res.status(500).json(errorBody('server_error'));
  }
}
