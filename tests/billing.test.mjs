// Plans, quotas, budgets, purchases and notifications, run against a fake Supabase, Google Play and AI provider.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as cloud from './helpers/fakeCloud.mjs';

Object.assign(process.env, { SUPABASE_URL: 'https://fake.supabase.test', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', ANTHROPIC_API_KEY: 'k', OPENAI_API_KEY: 'k', GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: cloud.SERVICE_ACCOUNT, PLAY_WEBHOOK_SECRET: 'hook-secret', OPS_TOKEN: 'ops-secret-token' });
['AI_TURNS_PER_DAY', 'AI_PRICE_INPUT_PER_MTOK', 'AI_PRICE_OUTPUT_PER_MTOK', 'STT_PRICE_PER_MINUTE', 'AI_DAILY_BUDGET_USD', 'AI_MONTHLY_BUDGET_USD', 'PLAY_REQUIRE_ACCOUNT_ID'].forEach((k) => delete process.env[k]);
globalThis.fetch = cloud.fetch;
const origError = console.error; console.error = () => {};

const { default: handler } = await import('../api/v1/[...path].js');
const { resetRateLimits } = await import('../api/_lib/http.js');
const E = await import('../api/_lib/entitlements.js');
const P = await import('../api/_lib/plans.js');
const C = await import('../api/_lib/cost.js');
const play = await import('../api/_lib/play.js');
const { db, google, call, playSub, pubsub } = cloud;

const fresh = () => { resetRateLimits(); cloud.reset(); P.clearPlanCache(); E.clearEntitlementCaches(); play.clearPlayCache(); ['AI_TURNS_PER_DAY', 'AI_PRICE_INPUT_PER_MTOK', 'AI_PRICE_OUTPUT_PER_MTOK', 'STT_PRICE_PER_MINUTE', 'AI_DAILY_BUDGET_USD', 'PLAY_REQUIRE_ACCOUNT_ID'].forEach((k) => delete process.env[k]); };
const NOW = Date.now();
const tok = (n) => 'purchase-token-' + String(n).padStart(24, 'x');
const idem = (() => { let n = 0; return () => 'idem-key-' + String(++n).padStart(8, '0'); })();
const session = async (mode = 'guided', id = 'greet', token = 'tok1') => (await call(handler, 'POST', 'speaking/sessions', { body: { mode, scenario_id: id }, token })).body;
const turn = (sid, body, token = 'tok1') => call(handler, 'POST', `speaking/sessions/${sid}/turns`, { body, token, headers: { 'idempotency-key': idem() } });
const audio = { data: 'A'.repeat(200), mime: 'audio/webm', duration_ms: 4000 };

test('plan features: wrong or missing values fall back to safe defaults', () => {
  const f = P.normalizeFeatures({ ai_turns_per_day: -5, stt_seconds_per_day: 'many', speaking_modes: ['guided', 'karaoke'] }, P.PLAN_DEFAULTS.pro.features);
  assert.deepEqual(f, { ai_turns_per_day: 40, stt_seconds_per_day: 600, speaking_modes: ['guided'] });
  assert.deepEqual(P.normalizeFeatures(null, P.PLAN_DEFAULTS.free.features), P.PLAN_DEFAULTS.free.features);
  assert.equal(P.normalizeFeatures({ ai_turns_per_day: 7 }, P.PLAN_DEFAULTS.free.features).ai_turns_per_day, 7);
  const merged = P.mergePlans([{ id: 'pro', name: 'Pro', features: { ai_turns_per_day: 55 }, rank: 1, play_product_id: 'sub_pro' }, { id: 'gold', name: 'Gold', features: {}, rank: 5 }]);
  assert.equal(merged.pro.features.ai_turns_per_day, 55); assert.equal(merged.free.features.ai_turns_per_day, 10); assert.ok(merged.gold); assert.equal(merged.gold.features.ai_turns_per_day, 10);
});

test('daily window follows Bangladesh time and can be changed', () => {
  const w = E.dayWindow(Date.UTC(2026, 10, 7, 20, 0, 0)); // 02:00 on 8 Nov in Dhaka
  assert.equal(new Date(w.start).toISOString(), '2026-11-07T18:00:00.000Z'); assert.equal(w.end - w.start, 86400000);
  assert.equal(new Date(E.dayWindow(Date.UTC(2026, 10, 7, 17, 59)).start).toISOString(), '2026-11-06T18:00:00.000Z');
  process.env.QUOTA_TZ_OFFSET_MINUTES = '0'; assert.equal(new Date(E.dayWindow(Date.UTC(2026, 10, 7, 20)).start).toISOString(), '2026-11-07T00:00:00.000Z'); delete process.env.QUOTA_TZ_OFFSET_MINUTES;
  assert.equal(new Date(E.monthStart(Date.UTC(2026, 10, 20))).toISOString(), '2026-10-31T18:00:00.000Z');
});

test('entitlement rules: store state, expiry, grace period, cancelled-but-paid, gifts and the highest plan wins', () => {
  const plans = P.mergePlans([]); const future = new Date(NOW + 86400000).toISOString(); const past = new Date(NOW - 1000).toISOString();
  const g = (state, end, plan = 'pro') => ({ plan_id: plan, provider: 'google_play', status: 'x', store_state: state, current_period_end: end });
  assert.ok(E.isEntitled(g('SUBSCRIPTION_STATE_ACTIVE', future), NOW));
  assert.ok(E.isEntitled(g('SUBSCRIPTION_STATE_IN_GRACE_PERIOD', future), NOW));
  assert.ok(E.isEntitled(g('SUBSCRIPTION_STATE_CANCELED', future), NOW), 'cancelled but paid until the end');
  assert.ok(!E.isEntitled(g('SUBSCRIPTION_STATE_CANCELED', past), NOW));
  assert.ok(!E.isEntitled(g('SUBSCRIPTION_STATE_ACTIVE', past), NOW));
  ['SUBSCRIPTION_STATE_ON_HOLD', 'SUBSCRIPTION_STATE_PAUSED', 'SUBSCRIPTION_STATE_PENDING', 'SUBSCRIPTION_STATE_EXPIRED', 'whatever'].forEach((s) => assert.ok(!E.isEntitled(g(s, future), NOW), s));
  assert.ok(E.isEntitled({ provider: 'manual', status: 'active', current_period_end: null }, NOW), 'a gift without an end date');
  assert.ok(!E.isEntitled({ provider: 'manual', status: 'canceled', current_period_end: null }, NOW));
  assert.equal(E.pickPlan([g('SUBSCRIPTION_STATE_ACTIVE', future, 'pro'), g('SUBSCRIPTION_STATE_ACTIVE', future, 'advanced'), g('SUBSCRIPTION_STATE_EXPIRED', future, 'advanced')], plans, NOW).plan_id, 'advanced');
  assert.equal(E.pickPlan([g('SUBSCRIPTION_STATE_ACTIVE', future, 'unknown-plan')], plans, NOW), null);
  assert.equal(E.pickPlan([], plans, NOW), null);
});

test('cost: nothing is invented without prices, and token costs follow the configured prices', () => {
  assert.equal(C.inputCost(1000), null); assert.equal(C.sttCost(60), null); assert.ok(!C.pricesConfigured());
  Object.assign(process.env, { AI_PRICE_INPUT_PER_MTOK: '1', AI_PRICE_OUTPUT_PER_MTOK: '5', STT_PRICE_PER_MINUTE: '0.006' });
  assert.equal(C.inputCost(1000000), 1); assert.equal(C.outputCost(200000), 1); assert.equal(C.sttCost(30), 0.003); assert.ok(C.pricesConfigured());
  process.env.AI_PRICE_INPUT_PER_MTOK = ''; assert.equal(C.inputCost(1000), null); fresh();
});

test('GET /plans is public and shows the limits; entitlements start on Free with a billing reference', async () => {
  fresh();
  const p = await call(handler, 'GET', 'plans', { token: null });
  assert.equal(p.code, 200); assert.deepEqual(p.body.plans.map((x) => x.id), ['free', 'pro', 'advanced']); assert.equal(p.body.plans[0].features.ai_turns_per_day, 10); assert.equal(p.body.plans[1].play_product_id, 'sub_pro'); assert.equal(p.body.billing_available, true);
  const e = await call(handler, 'GET', 'me/entitlements'); assert.equal(e.code, 200);
  assert.equal(e.body.plan.id, 'free'); assert.equal(e.body.usage.ai_turns.limit, 10); assert.equal(e.body.usage.ai_turns.used, 0); assert.ok(e.body.billing_ref.length >= 32);
  const again = await call(handler, 'GET', 'me/entitlements'); assert.equal(again.body.billing_ref, e.body.billing_ref); assert.equal(db.billing_accounts.length, 1);
  assert.equal((await call(handler, 'GET', 'me/entitlements', { token: null })).code, 401);
});

test('a learner on Free is held to the Free limits; changing the plan row changes them with no release', async () => {
  fresh();
  db.plans[0].features = { ai_turns_per_day: 2, stt_seconds_per_day: 10, speaking_modes: ['guided', 'repeat'] };
  P.clearPlanCache();
  const e = await call(handler, 'GET', 'me/entitlements'); assert.equal(e.body.usage.ai_turns.limit, 2);
  const locked = await call(handler, 'POST', 'speaking/sessions', { body: { mode: 'roleplay', scenario_id: 'greet' } });
  assert.equal(locked.code, 403); assert.equal(locked.body.error.code, 'plan_required'); assert.equal(locked.body.error.details.mode, 'roleplay');
  const s = await session('guided', 'greet'); assert.ok(s.session_id);
  assert.equal((await turn(s.session_id, { text: 'I go to school yesterday' })).code, 200);
  assert.equal((await turn(s.session_id, { text: 'I like tea' })).code, 200);
  const third = await turn(s.session_id, { text: 'Hello again' });
  assert.equal(third.code, 429); assert.equal(third.body.error.code, 'quota_exceeded'); assert.equal(third.body.error.details.what, 'ai_turns'); assert.equal(third.body.error.details.limit, 2); assert.ok(third.body.error.details.resets_at);
  assert.equal(cloud.ai.calls, 2, 'a refused turn never reaches the AI provider');
  const u = await call(handler, 'GET', 'me/entitlements'); assert.equal(u.body.usage.ai_turns.used, 2);
});

test('repeat-after-me turns do not use AI turns, and a refused voice turn costs no speech recognition', async () => {
  fresh();
  db.plans[0].features = { ai_turns_per_day: 1, stt_seconds_per_day: 6, speaking_modes: ['guided', 'repeat'] }; P.clearPlanCache();
  const r = await session('repeat', 'phrases');
  for (let i = 0; i < 3; i++) assert.equal((await turn(r.session_id, { kind: 'repeat', target_text: 'I like tea', text: 'I like tea' })).code, 200);
  assert.equal((await call(handler, 'GET', 'me/entitlements')).body.usage.ai_turns.used, 0, 'repeat turns are free of AI quota');
  const v1 = await turn(r.session_id, { kind: 'repeat', target_text: 'I like tea', audio }); assert.equal(v1.code, 200); assert.equal(cloud.stt.calls, 1);
  const v2 = await turn(r.session_id, { kind: 'repeat', target_text: 'I like tea', audio });
  assert.equal(v2.code, 429); assert.equal(v2.body.error.details.what, 'stt_seconds'); assert.equal(cloud.stt.calls, 1, 'no recording was sent to the speech provider');
});

test('usage is recorded with tokens and cost, silence is counted, and totals reach the owner summary', async () => {
  fresh();
  Object.assign(process.env, { AI_PRICE_INPUT_PER_MTOK: '1', AI_PRICE_OUTPUT_PER_MTOK: '5', STT_PRICE_PER_MINUTE: '0.006' });
  const s = await session('guided', 'greet');
  const t = await turn(s.session_id, { audio }); assert.equal(t.code, 200); assert.equal(t.body.tokens, undefined, 'token counts are not sent to the phone');
  const byType = Object.fromEntries(db.usage_ledger.map((r) => [r.usage_type, r]));
  assert.equal(byType.speaking_turn.quantity, 1); assert.equal(byType.ai_input_tokens.quantity, 1200); assert.equal(byType.ai_output_tokens.quantity, 150);
  assert.equal(byType.ai_input_tokens.cost_usd, 0.0012); assert.equal(byType.ai_output_tokens.cost_usd, 0.00075); assert.equal(byType.stt_seconds.quantity, 4); assert.equal(byType.stt_seconds.cost_usd, 0.0004);
  cloud.stt.text = ''; const silent = await turn(s.session_id, { audio }); assert.equal(silent.body.no_speech, true);
  assert.equal(db.usage_ledger.filter((r) => r.usage_type === 'stt_seconds').length, 2, 'the provider bills silence, so it is counted');
  const sum = await call(handler, 'GET', 'ops/summary', { token: null, headers: { authorization: 'Bearer ops-secret-token' } });
  assert.equal(sum.code, 200); assert.ok(sum.body.today.usage.find((x) => x.usage_type === 'ai_input_tokens').quantity === 1200); assert.ok(sum.body.today.cost_usd > 0.002); assert.equal(sum.body.budget.prices_configured, true); assert.deepEqual(sum.body.warnings, []);
  cloud.stt.text = 'I go to school yesterday';
  assert.equal((await call(handler, 'GET', 'ops/summary', { token: null, headers: { authorization: 'Bearer wrong' } })).code, 401);
  assert.equal((await call(handler, 'GET', 'ops/summary', { token: null })).code, 401);
  assert.equal(cloud.google.tokenCalls, 0);
});

test('the AI switch and the daily budget stop AI calls but not typing practice, and a missing price list is flagged', async () => {
  fresh();
  const s = await session('guided', 'greet');
  db.app_settings.find((r) => r.key === 'ai_enabled').value = false; E.clearEntitlementCaches();
  const off = await turn(s.session_id, { text: 'hello' }); assert.equal(off.code, 503); assert.equal(off.body.error.code, 'ai_unavailable'); assert.equal(off.body.error.details, 'disabled');
  const rep = await session('repeat', 'phrases'); assert.equal((await turn(rep.session_id, { kind: 'repeat', target_text: 'I like tea', text: 'I like tea' })).code, 200, 'repeat practice does not use the AI');
  db.app_settings.find((r) => r.key === 'ai_enabled').value = true; db.app_settings.find((r) => r.key === 'ai_daily_budget_usd').value = 0.001; E.clearEntitlementCaches();
  Object.assign(process.env, { AI_PRICE_INPUT_PER_MTOK: '10', AI_PRICE_OUTPUT_PER_MTOK: '50' });
  const g = await session('guided', 'greet'); // a new session ends the old one
  assert.equal((await turn(g.session_id, { text: 'hello' })).code, 200, 'under the budget the first call goes through');
  E.clearEntitlementCaches();
  const over = await turn(g.session_id, { text: 'hello again' }); assert.equal(over.code, 503); assert.equal(over.body.error.details, 'daily_budget');
  delete process.env.AI_PRICE_INPUT_PER_MTOK; delete process.env.AI_PRICE_OUTPUT_PER_MTOK;
  const sum = await call(handler, 'GET', 'ops/summary', { token: null, headers: { authorization: 'Bearer ops-secret-token' } });
  assert.ok(sum.body.warnings.includes('budget_without_prices'));
});

test('the old AI_TURNS_PER_DAY setting still works as a ceiling for every plan', async () => {
  fresh();
  db.subscriptions.push({ id: 's1', user_id: 'u1', plan_id: 'advanced', provider: 'manual', provider_reference: 'gift', status: 'active', store_state: null, current_period_end: null, updated_at: new Date().toISOString() });
  assert.equal((await call(handler, 'GET', 'me/entitlements')).body.usage.ai_turns.limit, 100);
  process.env.AI_TURNS_PER_DAY = '25'; assert.equal((await call(handler, 'GET', 'me/entitlements')).body.usage.ai_turns.limit, 25); delete process.env.AI_TURNS_PER_DAY;
  assert.equal((await call(handler, 'GET', 'me/entitlements')).body.plan.id, 'advanced');
  assert.equal((await call(handler, 'GET', 'me/entitlements', { token: 'tok2' })).body.plan.id, 'free', 'another learner is not affected');
});

// ---------- purchases ----------
const ref = async (token = 'tok1') => (await call(handler, 'GET', 'me/entitlements', { token })).body.billing_ref;
const verify = (t, token = 'tok1') => call(handler, 'POST', 'billing/google/verify', { body: { purchase_token: t }, token });

test('verify: a real purchase is checked with Google, saved, acknowledged, and upgrades the plan at once', async () => {
  fresh();
  const r = await ref(); google.subs[tok(1)] = playSub({ account: r });
  const v = await verify(tok(1));
  assert.equal(v.code, 200, JSON.stringify(v.body)); assert.equal(v.body.plan.id, 'pro'); assert.equal(v.body.usage.ai_turns.limit, 40); assert.equal(v.body.purchase.entitled, true); assert.equal(v.body.purchase.acknowledged, true);
  assert.deepEqual(google.acked, [tok(1)]);
  const row = db.subscriptions[0]; assert.equal(row.user_id, 'u1'); assert.equal(row.status, 'active'); assert.equal(row.store_state, 'SUBSCRIPTION_STATE_ACTIVE'); assert.equal(row.product_id, 'sub_pro'); assert.equal(row.acknowledged, true); assert.equal(row.provider_reference, tok(1));
  const jwt = google.jwtChecks[0]; assert.ok(jwt.ok, 'the sign-in token to Google is correctly signed'); assert.equal(jwt.header.alg, 'RS256'); assert.equal(jwt.claims.scope, 'https://www.googleapis.com/auth/androidpublisher'); assert.equal(jwt.claims.aud, 'https://oauth2.googleapis.com/token'); assert.equal(jwt.claims.iss, 'play@test.iam.gserviceaccount.com');
  await verify(tok(1)); assert.equal(db.subscriptions.length, 1, 'verifying twice is harmless'); assert.equal(google.acked.length, 1, 'and is not acknowledged twice'); assert.equal(google.tokenCalls, 1, 'the Google access token is reused');
});

test('verify: only the learner the purchase was made for can claim it', async () => {
  fresh();
  const r1 = await ref('tok1'); await ref('tok2'); google.subs[tok(2)] = playSub({ account: r1 });
  const stolen = await verify(tok(2), 'tok2'); assert.equal(stolen.code, 409); assert.equal(stolen.body.error.code, 'conflict'); assert.equal(db.subscriptions.length, 0);
  assert.equal((await verify(tok(2), 'tok1')).code, 200); assert.equal(db.subscriptions[0].user_id, 'u1');
  const again = await verify(tok(2), 'tok2'); assert.equal(again.code, 409, 'a saved purchase cannot be taken over');
  assert.equal(db.subscriptions[0].user_id, 'u1');
  assert.equal((await call(handler, 'GET', 'me/entitlements', { token: 'tok2' })).body.plan.id, 'free');
});

test('verify: bad input, unknown products and purchases Google does not know are rejected', async () => {
  fresh(); await ref();
  assert.equal((await verify('short')).code, 400); assert.equal((await call(handler, 'POST', 'billing/google/verify', { body: {} })).code, 400); assert.equal((await call(handler, 'POST', 'billing/google/verify', { body: { purchase_token: 'x'.repeat(5000) } })).code, 400);
  assert.equal((await verify(tok(3))).code, 400, 'Google does not know this token');
  google.subs[tok(4)] = playSub({ product: 'some_other_product', account: await ref() });
  const other = await verify(tok(4)); assert.equal(other.code, 400); assert.equal(db.subscriptions.length, 0);
  assert.equal((await verify(tok(5), null)).code, 401);
});

test('verify: a purchase without an account id binds to the sender unless the server demands one', async () => {
  fresh();
  google.subs[tok(6)] = playSub();
  process.env.PLAY_REQUIRE_ACCOUNT_ID = '1'; assert.equal((await verify(tok(6))).code, 409); delete process.env.PLAY_REQUIRE_ACCOUNT_ID;
  assert.equal((await verify(tok(6))).code, 200); assert.equal(db.subscriptions[0].user_id, 'u1');
});

test('verify: purchases that are not paid for yet or are on hold give no access', async () => {
  fresh();
  const r = await ref();
  for (const [n, state] of [[7, 'SUBSCRIPTION_STATE_PENDING'], [8, 'SUBSCRIPTION_STATE_ON_HOLD'], [9, 'SUBSCRIPTION_STATE_EXPIRED']]) {
    google.subs[tok(n)] = playSub({ state, account: r }); const v = await verify(tok(n));
    assert.equal(v.code, 200); assert.equal(v.body.purchase.entitled, false, state); assert.equal(v.body.plan.id, 'free', state);
  }
  assert.deepEqual(google.acked, [], 'nothing is acknowledged until it is paid');
  google.subs[tok(10)] = playSub({ state: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', account: r, acked: true }); assert.equal((await verify(tok(10))).body.plan.id, 'pro', 'payment problem, access kept');
});

test('upgrading to a new purchase retires the one it replaces', async () => {
  fresh(); const r = await ref();
  google.subs[tok(11)] = playSub({ account: r }); await verify(tok(11));
  google.subs[tok(12)] = playSub({ product: 'sub_adv', account: r, linked: tok(11) }); const v = await verify(tok(12));
  assert.equal(v.body.plan.id, 'advanced');
  const old = db.subscriptions.find((x) => x.provider_reference === tok(11)); assert.equal(old.status, 'canceled'); assert.equal(old.store_state, 'REPLACED');
});

test('restore: several tokens at once, one bad token does not spoil the rest', async () => {
  fresh(); const r = await ref(); google.subs[tok(13)] = playSub({ account: r });
  const out = await call(handler, 'POST', 'billing/google/restore', { body: { purchases: [{ purchase_token: tok(13) }, { purchase_token: tok(14) }, { purchase_token: 'bad' }] } });
  assert.equal(out.code, 200); assert.deepEqual(out.body.results.map((x) => x.ok), [true, false, false]); assert.equal(out.body.plan.id, 'pro');
  assert.equal((await call(handler, 'POST', 'billing/google/restore', { body: { purchases: new Array(11).fill({ purchase_token: tok(13) }) } })).code, 400);
});

test('billing is off cleanly when Google is not set up', async () => {
  fresh(); const saved = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON; delete process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  try {
    const v = await verify(tok(15)); assert.equal(v.code, 503); assert.equal(v.body.error.code, 'billing_unavailable');
    assert.equal((await call(handler, 'GET', 'me/entitlements')).body.billing_available, false);
    assert.equal((await call(handler, 'GET', 'plans', { token: null })).body.billing_available, false);
  } finally { process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = saved; }
});

// ---------- notifications ----------
const hook = (note, secret = 'hook-secret', id) => call(handler, 'POST', 'billing/google/webhook', { token: null, query: { secret }, body: pubsub(note, id) });
const renewal = (t, type = 2) => ({ subscriptionNotification: { version: '1.0', notificationType: type, purchaseToken: t, subscriptionId: 'sub_pro' } });

test('webhook: wrong secret is refused, test messages are accepted, other apps are ignored', async () => {
  fresh();
  assert.equal((await hook(renewal(tok(20)), 'nope')).code, 401); assert.equal((await hook(renewal(tok(20)), '')).code, 401);
  assert.equal((await call(handler, 'POST', 'billing/google/webhook', { token: null, body: pubsub(renewal(tok(20))) })).code, 401);
  const t = await hook({ testNotification: { version: '1.0' } }); assert.equal(t.code, 200); assert.equal(t.body.status, 'ignored');
  const other = await hook({ packageName: 'com.someone.else', ...renewal(tok(20)) }); assert.equal(other.body.status, 'ignored');
  assert.equal((await call(handler, 'POST', 'billing/google/webhook', { token: null, query: { secret: 'hook-secret' }, body: { nope: 1 } })).code, 400);
  assert.equal((await call(handler, 'POST', 'billing/google/webhook', { token: null, query: { secret: 'hook-secret' }, body: { message: { data: '!!!', messageId: 'x' } } })).code, 400);
  assert.equal(google.tokenCalls, 0, 'nothing is asked of Google for these');
});

test('webhook: a renewal, a cancellation and an expiry move the plan, always from what Google says', async () => {
  fresh(); const r = await ref(); google.subs[tok(21)] = playSub({ account: r, acked: true }); await verify(tok(21));
  assert.equal((await call(handler, 'GET', 'me/entitlements')).body.plan.id, 'pro');
  google.subs[tok(21)] = playSub({ account: r, acked: true, state: 'SUBSCRIPTION_STATE_CANCELED', auto: false, expiresInDays: 10 });
  assert.equal((await hook(renewal(tok(21), 3))).body.status, 'ok');
  let e = (await call(handler, 'GET', 'me/entitlements')).body; assert.equal(e.plan.id, 'pro', 'cancelled but paid until the end'); assert.equal(e.will_renew, false); assert.equal(e.status, 'canceled');
  google.subs[tok(21)] = playSub({ account: r, acked: true, state: 'SUBSCRIPTION_STATE_EXPIRED', expiresInDays: -1 });
  await hook(renewal(tok(21), 13)); e = (await call(handler, 'GET', 'me/entitlements')).body; assert.equal(e.plan.id, 'free'); assert.equal(e.usage.ai_turns.limit, 10);
  google.subs[tok(21)] = playSub({ account: r, acked: true }); await hook(renewal(tok(21), 1)); assert.equal((await call(handler, 'GET', 'me/entitlements')).body.plan.id, 'pro');
});

test('webhook: the first message can come before the app has sent the purchase, and a refund removes access', async () => {
  fresh(); const r = await ref(); google.subs[tok(22)] = playSub({ account: r });
  assert.equal((await hook(renewal(tok(22), 4))).body.status, 'ok');
  assert.equal(db.subscriptions.length, 1); assert.equal(db.subscriptions[0].user_id, 'u1'); assert.deepEqual(google.acked, [tok(22)]);
  google.subs[tok(22)] = playSub({ account: r, acked: true, state: 'SUBSCRIPTION_STATE_EXPIRED', expiresInDays: -1 });
  await hook({ voidedPurchaseNotification: { purchaseToken: tok(22), orderId: 'GS.1', productType: 1, refundType: 1 } });
  assert.equal((await call(handler, 'GET', 'me/entitlements')).body.plan.id, 'free');
});

test('webhook: a purchase of someone we do not know is ignored, not guessed', async () => {
  fresh(); google.subs[tok(23)] = playSub({ account: 'unknown-account-id' });
  const out = await hook(renewal(tok(23), 4)); assert.equal(out.code, 200); assert.equal(out.body.status, 'ignored'); assert.equal(db.subscriptions.length, 0);
  assert.equal((await hook(renewal(tok(24), 2))).body.status, 'ignored', 'Google no longer knows this token: nothing to retry');
});

test('webhook: the same message twice is processed once, a failed one is retried, and Google errors ask Pub/Sub to retry', async () => {
  fresh(); const r = await ref(); google.subs[tok(25)] = playSub({ account: r, acked: true });
  assert.equal((await hook(renewal(tok(25), 4), 'hook-secret', 'msg-1')).body.status, 'ok');
  const asked = () => cloud.log.filter((x) => x.includes('androidpublisher')).length; const before = asked();
  assert.equal((await hook(renewal(tok(25), 4), 'hook-secret', 'msg-1')).body.status, 'duplicate'); assert.equal(asked(), before, 'Google is not asked again for a message already handled');
  assert.ok(db.webhook_events.every((e) => e.processed_at));
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, o) => (String(u).includes('androidpublisher') ? new Response('{}', { status: 500 }) : realFetch(u, o));
  const failed = await hook(renewal(tok(25), 2), 'hook-secret', 'msg-2'); assert.ok(failed.code >= 500, 'a 5xx makes Pub/Sub send it again'); assert.equal(db.webhook_events.find((e) => e.event_id === 'msg-2').processed_at, undefined);
  globalThis.fetch = realFetch;
  assert.equal((await hook(renewal(tok(25), 2), 'hook-secret', 'msg-2')).body.status, 'ok'); assert.ok(db.webhook_events.find((e) => e.event_id === 'msg-2').processed_at);
});

test('the owner summary counts subscriptions and warns about stuck notifications', async () => {
  fresh(); const r = await ref(); google.subs[tok(26)] = playSub({ account: r, acked: true }); await verify(tok(26));
  db.webhook_events.push({ provider: 'google_play', event_id: 'stuck', created_at: new Date(Date.now() - 3600000).toISOString(), processed_at: null });
  const s = (await call(handler, 'GET', 'ops/summary', { token: null, headers: { authorization: 'Bearer ops-secret-token' } })).body;
  assert.deepEqual(s.subscriptions, [{ plan_id: 'pro', status: 'active', store_state: 'SUBSCRIPTION_STATE_ACTIVE', count: 1 }]); assert.equal(s.webhooks.unprocessed, 1); assert.ok(s.warnings.includes('webhook_events_stuck')); assert.ok(!s.warnings.includes('play_not_configured'));
  delete process.env.OPS_TOKEN; assert.equal((await call(handler, 'GET', 'ops/summary', { token: null, headers: { authorization: 'Bearer anything' } })).code, 503); process.env.OPS_TOKEN = 'ops-secret-token';
});
