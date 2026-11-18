export class ApiError extends Error {
  constructor(status, code, message, details) { super(message || code); this.status = status; this.code = code; this.details = details; }
}
const ALLOWED = (process.env.ALLOWED_ORIGINS || 'https://localhost,capacitor://localhost,http://localhost').split(',').map((x) => x.trim());
export function cors(req, res) {
  const o = req.headers.origin;
  if (o && ALLOWED.includes(o)) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,Idempotency-Key');
  res.setHeader('Access-Control-Max-Age', '600');
}
// Stable error codes with user-friendly messages (plan section 11).
const MESSAGES = {
  unauthenticated: 'Please sign in to continue.', forbidden: 'You do not have access to this.', not_found: 'We could not find that.',
  invalid_input: 'Some information is not valid.', conflict: 'This conflicts with existing data.', rate_limited: 'Too many requests. Please wait a moment.',
  upstream_error: 'A service is not responding. Please try again.', server_error: 'Something went wrong. Please try again.', method_not_allowed: 'This action is not supported.',
  quota_exceeded: 'You have reached the limit for today.', ai_unavailable: 'The AI coach is not available right now.', stt_unavailable: 'Voice recognition is not available right now.',
  plan_required: 'This is part of a paid plan.', billing_unavailable: 'Purchases are not available right now.', confirmation_required: 'Please confirm this action.'
};
export const errorBody = (code, details) => ({ error: { code, message: MESSAGES[code] || MESSAGES.server_error, ...(details ? { details } : {}) } });
// Best-effort limiter (memory of one server instance). Add Vercel Firewall rate limits for hard guarantees.
const hits = new Map();
export const resetRateLimits = () => hits.clear(); // for tests
export function rateLimit(key, limit = 120, windowMs = 60000) {
  const now = Date.now(); const h = hits.get(key);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  if (!h || h.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); return; }
  if (++h.n > limit) throw new ApiError(429, 'rate_limited');
}
