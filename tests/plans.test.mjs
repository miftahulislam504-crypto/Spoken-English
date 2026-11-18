// The Plans screen, store prices, the purchase and restore flows, limits on the AI Speak screen.
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
globalThis.window = { scrollY: 0 }; globalThis.document = { getElementById: () => null }; globalThis.location = { hash: '' };
const warnings = []; console.warn = (...a) => warnings.push(a.join(' '));

const PLANS = [
  { id: 'free', name: 'Free - Starter', rank: 0, play_product_id: null, play_base_plan_id: null, features: { ai_turns_per_day: 10, stt_seconds_per_day: 120, speaking_modes: ['guided', 'repeat', 'answer', 'review'] } },
  { id: 'pro', name: 'Pro - Regular practice', rank: 1, play_product_id: 'sub_pro', play_base_plan_id: 'monthly', features: { ai_turns_per_day: 40, stt_seconds_per_day: 600, speaking_modes: ['guided', 'roleplay', 'free', 'repeat', 'answer', 'review'] } },
  { id: 'advanced', name: 'Advanced - Intensive practice', rank: 2, play_product_id: 'sub_adv', play_base_plan_id: 'monthly', features: { ai_turns_per_day: 100, stt_seconds_per_day: 1500, speaking_modes: ['guided', 'roleplay', 'free', 'repeat', 'answer', 'review'] } }
];
const ent = (plan, over = {}) => ({ plan: { id: plan.id, name: plan.name }, source: plan.id === 'free' ? 'free' : 'google_play', status: plan.id === 'free' ? 'free' : 'active', renews_at: plan.id === 'free' ? null : '2026-12-20T10:00:00.000Z', will_renew: plan.id === 'free' ? null : true, features: plan.features, usage: { ai_turns: { used: 3, limit: plan.features.ai_turns_per_day }, stt_seconds: { used: 45, limit: plan.features.stt_seconds_per_day }, resets_at: '2026-11-08T18:00:00.000Z' }, billing_ref: 'ref-abcdefghijklmnopqrstuvwxyz012345', billing_available: true, ...over });
const server = { plan: PLANS[0], plansFail: false, calls: [], verifyPlan: null, restoreResult: null };
globalThis.fetch = async (url, opts = {}) => {
  const path = new URL(url, 'http://app.test').pathname.replace('/api/v1', ''); const body = opts.body ? JSON.parse(opts.body) : null;
  server.calls.push(`${opts.method || 'GET'} ${path}`);
  const ok = (o) => new Response(JSON.stringify(o), { status: 200 });
  if (path === '/plans') return server.plansFail ? new Response('{}', { status: 500 }) : ok({ plans: PLANS, billing_available: true });
  if (path === '/me/entitlements') return ok(ent(server.plan));
  if (path === '/billing/google/verify') { server.lastVerify = body; if (server.verifyError) return new Response(JSON.stringify({ error: { code: server.verifyError } }), { status: 409 }); server.plan = server.verifyPlan || server.plan; return ok({ ...ent(server.plan), purchase: { state: 'SUBSCRIPTION_STATE_ACTIVE', entitled: true, acknowledged: true } }); }
  if (path === '/billing/google/restore') { server.lastRestore = body; server.plan = server.verifyPlan || server.plan; return ok({ ...ent(server.plan), results: body.purchases.map(() => ({ ok: true })) }); }
  return new Response('{}', { status: 404 });
};

const { getState, setState } = await import('../www/src/store.js');
const { plans, blAct, quotaLine } = await import('../www/src/billing.js');
const { speak } = await import('../www/src/speak.js');
const { settings } = await import('../www/src/screens.js');
const E = await import('../www/src/entitlement.js');
const wait = (n = 15) => new Promise((r) => setTimeout(r, n));
const signIn = () => localStorage.setItem('se.auth.v1', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1', email: 'a@b.c' } }));
const el = (act, o = {}) => ({ dataset: { act, ...o } });
const reload = async () => { await blAct(el('bl-reload')); const s = getState(); plans(s); await wait(); return plans(getState()); };

test('a guest sees the plans and the limits, a sign-in prompt, and no price or purchase button in a browser', async () => {
  setState({ onboarded: true, entitlement: null });
  plans(getState()); await wait();
  const html = plans(getState());
  assert.match(html, /Sign in to use the AI coach and to subscribe/); assert.match(html, /Free - Starter/); assert.match(html, /Pro - Regular practice/);
  assert.match(html, /10 AI conversation turns per day/); assert.match(html, /40 AI conversation turns per day/); assert.match(html, /2 minutes of voice recording per day/); assert.match(html, /25 minutes of voice recording per day/);
  assert.match(html, /All six speaking modes/); assert.match(html, /Speaking modes: Guided Conversation, Repeat After Me/);
  assert.match(html, /Subscribing is available in the Android app/); assert.doesNotMatch(html, /data-act="bl-buy"/);
  assert.match(html, /renew automatically until you cancel in Google Play/); assert.match(html, /Manage subscription/);
  assert.doesNotMatch(html, /\$|Tk|USD|per month|\/month/, 'no price is written in the app');
  assert.deepEqual(warnings.splice(0), []);
});

test('a signed-in learner on Free sees today\'s usage with the limits and when it resets', async () => {
  signIn(); server.plan = PLANS[0]; setState({ entitlement: null });
  const html = await reload();
  assert.match(html, /Your plan: Free - Starter/); assert.match(html, /AI conversation turns: 3 of 10/); assert.match(html, /Voice recording: 0\.8 of 2 minutes/); assert.match(html, /Resets at/);
  assert.match(html, /Lessons, listening, review and progress are always free/); assert.match(html, /role="progressbar"/); assert.match(html, /aria-valuenow="3"/);
  assert.match(html, /Your plan<\/span>/);
  assert.match(settings(getState()), /Plan: Free - Starter/);
  assert.deepEqual(warnings.splice(0), []);
});

test('in the Android app prices come from Google Play and Subscribe starts the purchase with the billing reference', async () => {
  const buys = []; let cancel = false; let purchases = [];
  window.Capacitor = { Plugins: { NativePurchases: {
    isBillingSupported: async () => ({ isBillingSupported: true }),
    getProducts: async ({ productIdentifiers, productType }) => { assert.equal(productType, 'subs'); return { products: productIdentifiers.map((id) => ({ identifier: id, priceString: id === 'sub_pro' ? 'Tk 299.00' : 'Tk 599.00' })) }; },
    purchaseProduct: async (o) => { buys.push(o); if (cancel) throw { code: 'USER_CANCELLED', message: 'cancelled' }; return { purchaseToken: 'play-token-aaaaaaaaaaaaaaaaaaaa' }; },
    restorePurchases: async () => {}, getPurchases: async () => ({ purchases }), manageSubscriptions: async () => { buys.push('manage'); }
  } } };
  let html = await reload();
  assert.match(html, /Tk 299\.00/); assert.match(html, /Tk 599\.00/); assert.match(html, /data-act="bl-buy" data-id="pro"/); assert.match(html, /data-act="bl-buy" data-id="advanced"/); assert.match(html, /data-act="bl-restore"/);
  // cancelled: nothing is shown as an error
  cancel = true; await blAct(el('bl-buy', { id: 'pro' })); html = plans(getState());
  assert.doesNotMatch(html, /could not be completed|class="fb bad"/); assert.equal(buys.length, 1);
  // a real purchase
  cancel = false; server.verifyPlan = PLANS[1]; await blAct(el('bl-buy', { id: 'pro' })); html = plans(getState());
  assert.deepEqual(buys[1], { productIdentifier: 'sub_pro', planIdentifier: 'monthly', productType: 'subs', appAccountToken: 'ref-abcdefghijklmnopqrstuvwxyz012345' });
  assert.deepEqual(server.lastVerify, { purchase_token: 'play-token-aaaaaaaaaaaaaaaaaaaa' });
  assert.equal(getState().entitlement.plan.id, 'pro'); assert.match(html, /Thank you. Your plan is now Pro - Regular practice/); assert.match(html, /Renews on/); assert.match(html, /AI conversation turns: 3 of 40/);
  assert.doesNotMatch(html, /data-act="bl-buy" data-id="pro"/, 'the current plan has no Subscribe button'); assert.match(html, /data-act="bl-buy" data-id="advanced"/);
  await blAct(el('bl-manage')); assert.equal(buys[2], 'manage');
  assert.deepEqual(warnings.splice(0), []);
});

test('a purchase that is not active yet says so, and a server refusal is explained without charging language', async () => {
  signIn(); server.plan = PLANS[0]; server.verifyPlan = null; setState({ entitlement: null }); await reload();
  await blAct(el('bl-buy', { id: 'pro' })); const html = plans(getState());
  assert.match(html, /waiting for payment/);
  server.verifyError = 'conflict'; await blAct(el('bl-buy', { id: 'pro' })); const html2 = plans(getState());
  assert.match(html2, /class="fb bad"/); server.verifyError = null;
});

test('restore sends every purchase token, says when there is nothing to restore, and updates the plan', async () => {
  signIn(); server.plan = PLANS[0]; server.verifyPlan = null; setState({ entitlement: null });
  const calls = []; let purchases = [];
  window.Capacitor.Plugins.NativePurchases = { ...window.Capacitor.Plugins.NativePurchases, restorePurchases: async () => { calls.push('restore'); }, getPurchases: async () => ({ purchases }) };
  await reload();
  await blAct(el('bl-restore')); assert.match(plans(getState()), /No purchases were found/);
  purchases = [{ purchaseToken: 'restore-token-aaaaaaaaaaaaaaaaaa', productIdentifier: 'sub_pro' }, { productIdentifier: 'no-token' }];
  server.verifyPlan = PLANS[2]; await blAct(el('bl-restore'));
  assert.deepEqual(server.lastRestore, { purchases: [{ purchase_token: 'restore-token-aaaaaaaaaaaaaaaaaa' }] });
  assert.match(plans(getState()), /Purchases restored. Your plan is Advanced - Intensive practice/); assert.equal(getState().entitlement.plan.id, 'advanced');
});

test('plans that cannot be loaded show an error with a retry, not a blank screen', async () => {
  server.plansFail = true; signIn();
  await blAct(el('bl-reload')); plans(getState()); await wait();
  const html = plans(getState()); assert.match(html, /Plans could not be loaded/); assert.match(html, /data-act="bl-reload"/);
  server.plansFail = false; await reload();
});

test('AI Speak shows what is left today, locks modes the plan does not include, and links to plans', async () => {
  signIn(); server.plan = PLANS[0]; window.Capacitor = undefined;
  setState({ onboarded: true, entitlement: ent(PLANS[0]) });
  let html = speak(getState());
  assert.match(html, /AI turns left today: 7/); assert.match(html, /Voice recording left today: 1\.3 minutes/);
  assert.match(html, /<li class="row"><a class="stack grow" href="#\/plans">[\s\S]*?Roleplay[\s\S]*?Paid plan/);
  assert.doesNotMatch(html, /data-mode="roleplay"/);
  setState({ entitlement: ent(PLANS[1]) }); html = speak(getState());
  assert.match(html, /AI turns left today: 37/); assert.doesNotMatch(html, /Paid plan/);
  assert.equal(E.modeAllowed({ entitlement: null }, 'roleplay'), true, 'unknown plan: the server decides');
  assert.equal(E.turnsLeft({ entitlement: ent(PLANS[0]) }), 7); assert.equal(E.voiceSecondsLeft({ entitlement: ent(PLANS[0]) }), 75);
  setState({ entitlement: null }); assert.equal(quotaLine(getState()), '');
  assert.deepEqual(warnings.splice(0), []);
});

test('signing out clears the plan and the limit errors offer the plans', async () => {
  setState({ entitlement: ent(PLANS[1]) });
  localStorage.removeItem('se.auth.v1'); await E.refreshEntitlement(); assert.equal(getState().entitlement, null);
  const { errText } = await import('../www/src/account.js'); const { upgradeLink } = await import('../www/src/billing.js');
  assert.match(errText({ code: 'quota_exceeded', details: { what: 'ai_turns' } }), /AI conversation turns/); assert.match(errText({ code: 'quota_exceeded', details: { what: 'stt_seconds' } }), /voice recording/);
  assert.match(errText({ code: 'plan_required' }), /paid plan/); assert.match(errText({ code: 'billing_unavailable' }), /not available right now/); assert.match(errText({ code: 'quota_exceeded' }), /limit for your plan/);
  assert.match(upgradeLink('quota_exceeded'), /href="#\/plans"/); assert.match(upgradeLink('plan_required'), /See plans/); assert.equal(upgradeLink('network'), '');
});
