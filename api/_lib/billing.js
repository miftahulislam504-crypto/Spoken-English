// Plans, purchases, notifications and the owner's usage summary (plan sections 11, 12 and 19).
import crypto from 'node:crypto';
import { ApiError, rateLimit } from './http.js';
import { rest } from './supabase.js';
import * as v from './validate.js';
import { loadPlans, sortedPlans } from './plans.js';
import { getEntitlement, isEntitled, dayWindow, monthStart, loadSettings, costSince } from './entitlements.js';
import { playConfig, getSubscription, acknowledge, statusOf } from './play.js';
import { pricesConfigured } from './cost.js';

const q = encodeURIComponent;
const iso = (n) => (n === null || n === undefined ? null : new Date(n).toISOString());
const safeEqual = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const TOKEN = /^[\w.\-~]{20,4096}$/;
const cleanToken = (x) => { if (typeof x !== 'string' || !TOKEN.test(x)) throw new ApiError(400, 'invalid_input', undefined, 'purchase_token is invalid'); return x; };

// ---- the id sent to Google Play with each purchase ----
export async function billingRef(userId) {
  const get = async () => { const r = await rest('GET', `billing_accounts?user_id=eq.${userId}&select=obfuscated_id`, { service: true }); return r && r[0] ? r[0].obfuscated_id : null; };
  const have = await get(); if (have) return have;
  await rest('POST', 'billing_accounts?on_conflict=user_id', { service: true, prefer: 'resolution=ignore-duplicates,return=minimal', body: [{ user_id: userId, obfuscated_id: crypto.randomBytes(24).toString('base64url') }] });
  return get();
}
export async function entitlementPayload(userId) {
  const [ent, ref] = await Promise.all([getEntitlement(userId), billingRef(userId)]);
  return { ...ent, billing_ref: ref, billing_available: !!playConfig() };
}

// ---- one purchase token: ask Google, then save what Google says ----
// userHint is the signed-in learner (verify and restore) or null (notifications). Returns { ignored: true } when the purchase belongs to nobody we know.
export async function applyPurchase(token, userHint, now = Date.now()) {
  const [sub, plans] = await Promise.all([getSubscription(token), loadPlans()]);
  const hit = sub.items.map((item) => ({ item, plan: Object.values(plans).find((p) => p.play_product_id && p.play_product_id === item.product_id) })).find((x) => x.plan);
  if (!hit) { if (userHint) throw new ApiError(400, 'invalid_input', undefined, 'this product is not part of the app'); return { ignored: true }; }
  const existing = (await rest('GET', `subscriptions?provider=eq.google_play&provider_reference=eq.${q(token)}&select=id,user_id`, { service: true }))[0];
  let owner = existing ? existing.user_id : null;
  if (!owner && sub.account_id) { const a = await rest('GET', `billing_accounts?obfuscated_id=eq.${q(sub.account_id)}&select=user_id`, { service: true }); owner = a && a[0] ? a[0].user_id : null; }
  if (!owner && userHint && !sub.account_id && process.env.PLAY_REQUIRE_ACCOUNT_ID !== '1') owner = userHint; // purchase made without an account id: bind it to the learner who sent it
  if (!owner) { if (userHint) throw new ApiError(409, 'conflict'); return { ignored: true }; }
  if (userHint && owner !== userHint) { console.error('purchase_owner_mismatch'); throw new ApiError(409, 'conflict'); }
  const { item, plan } = hit; const status = statusOf(sub.state);
  const row = { user_id: owner, plan_id: plan.id, provider: 'google_play', provider_reference: token, status, current_period_end: iso(item.expiry), product_id: item.product_id, store_state: sub.state, latest_order_id: sub.order_id, auto_renew: item.auto_renew, acknowledged: sub.acknowledged, is_test: sub.test, started_at: iso(sub.start), last_verified_at: iso(now), updated_at: iso(now) };
  await rest('POST', 'subscriptions?on_conflict=provider,provider_reference', { service: true, prefer: 'resolution=merge-duplicates,return=minimal', body: [row] });
  if (sub.linked_token) await rest('PATCH', `subscriptions?provider=eq.google_play&provider_reference=eq.${q(sub.linked_token)}&user_id=eq.${owner}`, { service: true, prefer: 'return=minimal', body: { status: 'canceled', store_state: 'REPLACED', current_period_end: iso(now), updated_at: iso(now) } });
  const entitled = isEntitled({ provider: 'google_play', store_state: sub.state, current_period_end: row.current_period_end, status }, now);
  let acknowledged = sub.acknowledged;
  if (entitled && !acknowledged) {
    try { await acknowledge(item.product_id, token); acknowledged = true; await rest('PATCH', `subscriptions?provider=eq.google_play&provider_reference=eq.${q(token)}`, { service: true, prefer: 'return=minimal', body: { acknowledged: true } }); } catch (e) { console.error('ack_failed', e && e.message); }
  }
  return { user_id: owner, plan_id: plan.id, state: sub.state, status, entitled, acknowledged };
}

// ---- routes for a signed-in learner ----
const getEntitlements = async ({ user }) => entitlementPayload(user.id);
const verify = async ({ user, body }) => {
  rateLimit('billing:' + user.id, 10);
  const out = await applyPurchase(cleanToken(v.obj(body, 'body').purchase_token), user.id);
  return { ...(await entitlementPayload(user.id)), purchase: { state: out.state, entitled: out.entitled, acknowledged: out.acknowledged } };
};
const restore = async ({ user, body }) => {
  rateLimit('billing:' + user.id, 10);
  const list = v.obj(body, 'body').purchases;
  if (!Array.isArray(list) || list.length > 10) throw new ApiError(400, 'invalid_input', undefined, 'purchases must be a list of at most 10');
  const results = [];
  for (const p of list) {
    try { const out = await applyPurchase(cleanToken(v.obj(p, 'purchase').purchase_token), user.id); results.push({ ok: true, entitled: !!out.entitled }); } catch (e) { results.push({ ok: false, code: e.code || 'server_error' }); }
  }
  return { ...(await entitlementPayload(user.id)), results };
};
export const billingRoutes = [
  ['GET', /^me\/entitlements$/, getEntitlements],
  ['POST', /^billing\/google\/verify$/, verify],
  ['POST', /^billing\/google\/restore$/, restore]
];

// ---- routes that need no sign-in ----
const getPlans = async () => {
  const plans = await loadPlans();
  return { plans: sortedPlans(plans).map((p) => ({ id: p.id, name: p.name, rank: p.rank, features: p.features, play_product_id: p.play_product_id, play_base_plan_id: p.play_base_plan_id })), billing_available: !!playConfig() };
};
// Google Play sends notifications through Pub/Sub to this address. The secret in the address keeps strangers out, and the notification itself is only a
// reason to ask Google again, so a forged one can never grant anything. Errors that may pass on their own return 5xx so Pub/Sub tries again.
const playWebhook = async ({ query, body }) => {
  const secret = process.env.PLAY_WEBHOOK_SECRET;
  if (!secret || !playConfig()) throw new ApiError(503, 'billing_unavailable');
  if (!safeEqual(query.secret || '', secret)) throw new ApiError(401, 'unauthenticated');
  const msg = body && body.message;
  if (!msg || typeof msg.data !== 'string' || typeof msg.messageId !== 'string' || msg.messageId.length > 100) throw new ApiError(400, 'invalid_input', undefined, 'not a Pub/Sub message');
  let note; try { note = JSON.parse(Buffer.from(msg.data, 'base64').toString('utf8')); } catch (e) { throw new ApiError(400, 'invalid_input', undefined, 'message data is invalid'); }
  const ev = (await rest('GET', `webhook_events?provider=eq.google_play&event_id=eq.${q(msg.messageId)}&select=processed_at`, { service: true }))[0];
  if (ev && ev.processed_at) return { status: 'duplicate' };
  if (!ev) await rest('POST', 'webhook_events?on_conflict=provider,event_id', { service: true, prefer: 'resolution=ignore-duplicates,return=minimal', body: [{ provider: 'google_play', event_id: msg.messageId, payload: { kind: note.subscriptionNotification ? 'subscription' : note.voidedPurchaseNotification ? 'voided' : note.testNotification ? 'test' : 'other', type: (note.subscriptionNotification || {}).notificationType || null } }] });
  const done = (result) => rest('PATCH', `webhook_events?provider=eq.google_play&event_id=eq.${q(msg.messageId)}`, { service: true, prefer: 'return=minimal', body: { processed_at: new Date().toISOString() } }).then(() => ({ status: result }));
  const cfg = playConfig();
  if (note.packageName && note.packageName !== cfg.pkg) return done('ignored');
  const token = (note.subscriptionNotification || note.voidedPurchaseNotification || {}).purchaseToken;
  if (!token || !TOKEN.test(token)) return done('ignored');
  try { const out = await applyPurchase(token, null); return done(out.ignored ? 'ignored' : 'ok'); } catch (e) {
    if (e.status === 400) return done('ignored'); // Google no longer knows this purchase: nothing to retry
    throw e;
  }
};
// For the owner: usage, estimated cost, subscriptions and warnings. Needs OPS_TOKEN. The admin dashboard in Phase 10 is built on this.
export const bearerIs = (req, secret) => { const m = /^Bearer (.+)$/.exec(req.headers.authorization || ''); return !!(secret && m && safeEqual(m[1], secret)); };
const opsSummary = async ({ req }) => {
  const token = process.env.OPS_TOKEN; if (!token) throw new ApiError(503, 'billing_unavailable');
  if (!bearerIs(req, token)) throw new ApiError(401, 'unauthenticated');
  return buildSummary();
};
// The same numbers feed the admin dashboard (Phase 10), which checks the signed-in admin's role instead of OPS_TOKEN.
export async function buildSummary() {
  const now = Date.now(); const day = dayWindow(now).start; const month = monthStart(now);
  const totals = async (since) => ((await rest('POST', 'rpc/usage_totals', { service: true, body: { since: new Date(since).toISOString() } })) || []).map((r) => ({ usage_type: r.usage_type, quantity: Number(r.quantity), cost_usd: Number(r.cost_usd), users: Number(r.users) }));
  const [today, thisMonth, subs, pending, settings, spentToday, spentMonth] = await Promise.all([
    totals(day), totals(month), rest('POST', 'rpc/subscription_counts', { service: true, body: {} }),
    rest('GET', 'webhook_events?provider=eq.google_play&processed_at=is.null&select=event_id,created_at&order=created_at&limit=50', { service: true }), loadSettings(), costSince(day), costSince(month)
  ]);
  const sum = (rows) => Math.round(rows.reduce((n, r) => n + r.cost_usd, 0) * 1e4) / 1e4;
  const warnings = [];
  if ((settings.daily_usd !== null || settings.monthly_usd !== null) && !pricesConfigured()) warnings.push('budget_without_prices');
  if (!playConfig()) warnings.push('play_not_configured');
  if (!process.env.PLAY_WEBHOOK_SECRET) warnings.push('webhook_secret_missing');
  if ((pending || []).some((e) => now - Date.parse(e.created_at) > 10 * 60000)) warnings.push('webhook_events_stuck');
  return {
    generated_at: new Date(now).toISOString(), quota_day_start: new Date(day).toISOString(),
    today: { usage: today, cost_usd: sum(today) }, month: { usage: thisMonth, cost_usd: sum(thisMonth) },
    subscriptions: (subs || []).map((r) => ({ plan_id: r.plan_id, status: r.status, store_state: r.store_state, count: Number(r.n) })),
    webhooks: { unprocessed: (pending || []).length },
    budget: { ai_enabled: settings.ai_enabled, daily_usd: settings.daily_usd, monthly_usd: settings.monthly_usd, spent_today_usd: Math.round(spentToday * 1e4) / 1e4, spent_month_usd: Math.round(spentMonth * 1e4) / 1e4, prices_configured: pricesConfigured() },
    warnings
  };
}
// [method, pattern, handler, requests per minute from one address]
export const publicRoutes = [
  ['GET', /^plans$/, getPlans, 60],
  ['POST', /^billing\/google\/webhook$/, playWebhook, 600],
  ['GET', /^ops\/summary$/, opsSummary, 30]
];
