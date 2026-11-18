// Who has which plan, and what they may still use today (plan sections 12 and 11). Everything is decided here on the server.
// The app only shows what the server says; it can never grant itself a plan or more turns.
import { ApiError } from './http.js';
import { rest } from './supabase.js';
import { loadPlans } from './plans.js';

const q = encodeURIComponent;
const DAY = 86400000;
// Daily limits reset at midnight in Bangladesh (UTC+6) unless QUOTA_TZ_OFFSET_MINUTES says otherwise.
export const quotaOffsetMs = () => { const v = process.env.QUOTA_TZ_OFFSET_MINUTES; const n = v === undefined || v === '' ? NaN : Number(v); return (Number.isFinite(n) && Math.abs(n) <= 840 ? n : 360) * 60000; };
export function dayWindow(now = Date.now()) { const off = quotaOffsetMs(); const start = Math.floor((now + off) / DAY) * DAY - off; return { start, end: start + DAY }; }
export function monthStart(now = Date.now()) { const off = quotaOffsetMs(); const d = new Date(now + off); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - off; }

// A subscription gives access while the store says it is active, in a grace period (payment problem, access kept), or cancelled but not yet ended.
export const ENTITLED_STATES = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED'];
export function isEntitled(sub, now) {
  const end = sub.current_period_end ? Date.parse(sub.current_period_end) : null;
  if (end !== null && end <= now) return false;
  if (sub.provider === 'google_play') return ENTITLED_STATES.includes(sub.store_state);
  return sub.status === 'active' || sub.status === 'trialing';
}
export function pickPlan(subs, plans, now) {
  const rank = (id) => (plans[id] ? plans[id].rank : -1);
  const ends = (s) => (s.current_period_end ? Date.parse(s.current_period_end) : Infinity);
  return (subs || []).filter((s) => plans[s.plan_id] && isEntitled(s, now)).sort((a, b) => rank(b.plan_id) - rank(a.plan_id) || ends(b) - ends(a))[0] || null;
}
// AI_TURNS_PER_DAY, when set, is a ceiling for every plan (a safety brake for the owner).
export function limitsFor(plan) {
  const f = { ...plan.features }; const cap = Number(process.env.AI_TURNS_PER_DAY);
  if (process.env.AI_TURNS_PER_DAY && Number.isFinite(cap) && cap >= 0) f.ai_turns_per_day = Math.min(f.ai_turns_per_day, cap);
  return f;
}
export async function usageToday(userId, now = Date.now()) {
  const w = dayWindow(now);
  const rows = await rest('GET', `usage_ledger?user_id=eq.${userId}&usage_type=in.(speaking_turn,stt_seconds)&created_at=gte.${q(new Date(w.start).toISOString())}&select=usage_type,quantity&limit=2000`, { service: true });
  const sum = (t) => (rows || []).filter((r) => r.usage_type === t).reduce((n, r) => n + (Number(r.quantity) || 0), 0);
  return { ai_turns: Math.round(sum('speaking_turn')), stt_seconds: Math.round(sum('stt_seconds') * 10) / 10, resets_at: new Date(w.end).toISOString() };
}
export async function getEntitlement(userId, now = Date.now()) {
  const [plans, subs, used] = await Promise.all([
    loadPlans(),
    rest('GET', `subscriptions?user_id=eq.${userId}&select=plan_id,provider,status,store_state,current_period_end,auto_renew&order=updated_at.desc&limit=20`, { service: true }),
    usageToday(userId, now)
  ]);
  const sub = pickPlan(subs, plans, now); const plan = sub ? plans[sub.plan_id] : plans.free; const features = limitsFor(plan);
  return {
    plan: { id: plan.id, name: plan.name }, source: sub ? sub.provider : 'free', status: sub ? sub.status : 'free',
    renews_at: sub ? sub.current_period_end : null, will_renew: sub && sub.provider === 'google_play' ? !!sub.auto_renew : null, features,
    usage: { ai_turns: { used: used.ai_turns, limit: features.ai_turns_per_day }, stt_seconds: { used: used.stt_seconds, limit: features.stt_seconds_per_day }, resets_at: used.resets_at }
  };
}

// ---- checks used by the speaking routes ----
const over = (ent, what, extra) => new ApiError(429, 'quota_exceeded', undefined, { what, plan: ent.plan.id, resets_at: ent.usage.resets_at, ...extra });
export function assertMode(ent, mode) {
  if (!ent.features.speaking_modes.includes(mode)) throw new ApiError(403, 'plan_required', undefined, { feature: 'mode', mode, plan: ent.plan.id });
}
export function assertTurns(ent) {
  const u = ent.usage.ai_turns; if (u.used >= u.limit) throw over(ent, 'ai_turns', { used: u.used, limit: u.limit });
}
export function assertStt(ent, seconds) {
  const u = ent.usage.stt_seconds; if (u.used + seconds > u.limit) throw over(ent, 'stt_seconds', { used: u.used, limit: u.limit });
}

// ---- owner switches and budgets (plan section 19) ----
const cache = { settings: null, costs: new Map() };
export const clearEntitlementCaches = () => { cache.settings = null; cache.costs.clear(); };
const money = (x) => { const n = Number(x); return x === null || x === undefined || x === '' || !Number.isFinite(n) || n < 0 ? null : n; };
export async function loadSettings() {
  if (cache.settings && cache.settings.exp > Date.now()) return cache.settings.value;
  let rows = [];
  try { rows = (await rest('GET', 'app_settings?select=key,value', { service: true })) || []; } catch (e) { console.error('settings_load_failed', e && e.message); }
  const get = (k) => { const r = rows.find((x) => x.key === k); return r ? r.value : undefined; };
  const value = {
    ai_enabled: get('ai_enabled') !== false,
    daily_usd: money(get('ai_daily_budget_usd') !== undefined ? get('ai_daily_budget_usd') : process.env.AI_DAILY_BUDGET_USD),
    monthly_usd: money(get('ai_monthly_budget_usd') !== undefined ? get('ai_monthly_budget_usd') : process.env.AI_MONTHLY_BUDGET_USD)
  };
  cache.settings = { value, exp: Date.now() + 30000 };
  return value;
}
export async function costSince(ms) {
  const hit = cache.costs.get(ms); if (hit && hit.exp > Date.now()) return hit.value;
  let value = 0;
  try { value = Number(await rest('POST', 'rpc/usage_cost_since', { service: true, body: { since: new Date(ms).toISOString() } })) || 0; } catch (e) { console.error('cost_query_failed', e && e.message); }
  cache.costs.set(ms, { value, exp: Date.now() + 60000 });
  return value;
}
// Stops AI calls when the owner turned them off or the estimated spend reached a budget. If the spend cannot be read, calls continue (the per-learner limits still apply) and the error is logged.
export async function aiAvailable(now = Date.now()) {
  const s = await loadSettings();
  if (!s.ai_enabled) return { ok: false, reason: 'disabled' };
  if (s.daily_usd !== null && (await costSince(dayWindow(now).start)) >= s.daily_usd) return { ok: false, reason: 'daily_budget' };
  if (s.monthly_usd !== null && (await costSince(monthStart(now))) >= s.monthly_usd) return { ok: false, reason: 'monthly_budget' };
  return { ok: true };
}
