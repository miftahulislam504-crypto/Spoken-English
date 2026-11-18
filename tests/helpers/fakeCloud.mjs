// A small stand-in for Supabase (PostgREST), Google Play, Google sign-in, the AI provider and the speech provider.
// It keeps data in memory, so server code can be run end to end without any network.
import crypto from 'node:crypto';

// Signed-in people for the admin tests. Ids look like real ones because the API checks their shape.
export const PEOPLE = [
  { tok: 'owner', id: 'a0000000-0000-4000-8000-000000000001', email: 'owner@x.test', name: 'Owner' },
  { tok: 'editor', id: 'a0000000-0000-4000-8000-000000000002', email: 'editor@x.test', name: 'Editor' },
  { tok: 'helper', id: 'a0000000-0000-4000-8000-000000000003', email: 'helper@x.test', name: 'Helper' },
  { tok: 'viewer', id: 'a0000000-0000-4000-8000-000000000004', email: 'viewer@x.test', name: 'Viewer' },
  { tok: 'learner', id: 'b0000000-0000-4000-8000-0000000000b1', email: 'learner@x.test', name: 'Learner' }
];
export const db = { plans: [], subscriptions: [], usage_ledger: [], webhook_events: [], billing_accounts: [], app_settings: [], mistake_records: [], review_queue: [], conversation_sessions: [], conversation_turns: [], profiles: [{ id: 'u1', current_level: 'Pre-A1' }, { id: 'u2', current_level: 'A1' }, ...PEOPLE.map((p) => ({ id: p.id, current_level: 'A1', display_name: p.name, daily_goal_minutes: 10, created_at: '2026-10-01T00:00:00.000Z' }))], listening_progress: [], daily_activity: [], skill_assessments: [], admin_roles: [], user_lesson_progress: [], audit_log: [], analytics_events: [], content_revisions: [], feedback_reports: [], saved_words: [], lessons: [], exercises: [], courses: [], auth_users: [], exercise_attempts: [] };
export const log = [];            // every outgoing request, as "METHOD host/path"
export const google = { subs: {}, acked: [], tokenCalls: 0, jwtChecks: [] }; // purchase token -> Play subscription resource
export const ai = { calls: 0, usage: { input_tokens: 1200, output_tokens: 150 }, fail: false };
export const stt = { calls: 0, text: 'I go to school yesterday', duration: 4 };
export const users = { tok1: { id: 'u1', email: 'a@b.c' }, tok2: { id: 'u2', email: 'd@e.f' }, ...Object.fromEntries(PEOPLE.map((p) => [p.tok, { id: p.id, email: p.email }])) };
export const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
export const SERVICE_ACCOUNT = JSON.stringify({ client_email: 'play@test.iam.gserviceaccount.com', private_key: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }) });

const UNIQUE = { subscriptions: ['provider', 'provider_reference'], usage_ledger: ['user_id', 'idempotency_key'], webhook_events: ['provider', 'event_id'], billing_accounts: ['user_id'], mistake_records: ['user_id', 'client_id'], review_queue: ['user_id', 'content_reference', 'review_type'], listening_progress: ['user_id', 'item_id'], daily_activity: ['user_id', 'day'], admin_roles: ['user_id'], saved_words: ['user_id', 'client_id'], lessons: ['id'], exercises: ['id'], courses: ['id'], app_settings: ['key'] };
const NUMERIC_ID = ['audit_log', 'content_revisions', 'analytics_events'];
let seq = 0;
export function reset() {
  Object.keys(db).forEach((k) => { if (!['profiles'].includes(k)) db[k] = []; });
  db.plans = [{ id: 'free', name: 'Free - Starter', features: {}, play_product_id: null, play_base_plan_id: null, rank: 0, sort_order: 1 }, { id: 'pro', name: 'Pro - Regular practice', features: {}, play_product_id: 'sub_pro', play_base_plan_id: 'monthly', rank: 1, sort_order: 2 }, { id: 'advanced', name: 'Advanced - Intensive practice', features: {}, play_product_id: 'sub_adv', play_base_plan_id: 'monthly', rank: 2, sort_order: 3 }];
  db.app_settings = [{ key: 'ai_enabled', value: true }, { key: 'ai_daily_budget_usd', value: null }, { key: 'ai_monthly_budget_usd', value: null }];
  db.auth_users = PEOPLE.map((p) => ({ id: p.id, email: p.email, created_at: '2026-10-01T00:00:00Z', last_sign_in_at: null }));
  log.length = 0; google.subs = {}; google.acked = []; google.tokenCalls = 0; google.jwtChecks = [];
  ai.calls = 0; ai.fail = false; ai.usage = { input_tokens: 1200, output_tokens: 150 }; stt.calls = 0; seq = 0;
}
const cmp = (v, op, want) => {
  const a = v instanceof Date ? v.toISOString() : v;
  if (op === 'eq') return String(a) === want; if (op === 'gte') return String(a) >= want; if (op === 'lte') return String(a) <= want;
  if (op === 'lt') return typeof a === 'number' ? a < Number(want) : String(a) < want; if (op === 'like') return String(a).startsWith(want.replace(/\*$/, ''));
  if (op === 'is') return want === 'null' ? a === null || a === undefined : a !== null; if (op === 'not.is') return want === 'null' ? a !== null && a !== undefined : a === null;
  if (op === 'in') return want.replace(/^\(|\)$/g, '').split(',').includes(String(a));
  return true;
};
function filter(rows, params) {
  let out = rows;
  for (const [k, raw] of params) {
    if (['select', 'order', 'limit', 'on_conflict'].includes(k)) continue;
    const m = /^(not\.is|eq|gte|lte|lt|like|is|in)\.(.*)$/.exec(raw); if (!m) continue;
    out = out.filter((r) => cmp(r[k], m[1], m[2]));
  }
  return out;
}
const rpc = {
  usage_cost_since: (b) => db.usage_ledger.filter((r) => r.created_at >= b.since).reduce((n, r) => n + (Number(r.cost_usd) || 0), 0),
  usage_totals: (b) => { const m = {}; db.usage_ledger.filter((r) => r.created_at >= b.since).forEach((r) => { const x = m[r.usage_type] || (m[r.usage_type] = { usage_type: r.usage_type, quantity: 0, cost_usd: 0, u: new Set() }); x.quantity += Number(r.quantity); x.cost_usd += Number(r.cost_usd) || 0; x.u.add(r.user_id); }); return Object.values(m).map((x) => ({ usage_type: x.usage_type, quantity: x.quantity, cost_usd: x.cost_usd, users: x.u.size })); },
  subscription_counts: () => { const m = {}; db.subscriptions.forEach((s) => { const k = `${s.plan_id}|${s.status}|${s.store_state}`; m[k] = m[k] || { plan_id: s.plan_id, status: s.status, store_state: s.store_state, n: 0 }; m[k].n += 1; }); return Object.values(m); }
};
const dayOf = (iso, off = 360) => new Date((typeof iso === 'number' ? iso : Date.parse(iso)) + off * 60000).toISOString().slice(0, 10);
const by = (rows, f) => { const m = {}; rows.forEach((r) => { const k = f(r); (m[k] = m[k] || []).push(r); }); return m; };
Object.assign(rpc, {
  admin_find_user: (b) => db.auth_users.filter((u) => u.email.toLowerCase() === String(b.p_query).trim().toLowerCase() || u.id === String(b.p_query).trim()),
  analytics_daily: (b) => { const rows = db.analytics_events.filter((e) => e.at >= b.p_since); const out = []; Object.entries(by(rows, (e) => dayOf(e.at, b.p_offset) + '|' + e.name)).forEach(([k, v]) => { const [day, name] = k.split('|'); out.push({ day, name, events: v.length, actors: new Set(v.map((e) => e.install_id)).size }); }); return out; },
  analytics_totals: (b) => Object.entries(by(db.analytics_events.filter((e) => e.at >= b.p_since), (e) => e.name)).map(([name, v]) => ({ name, events: v.length, actors: new Set(v.map((e) => e.install_id)).size })),
  analytics_retention: (b) => { const opens = db.analytics_events.filter((e) => e.name === 'app_opened'); const days = {}; opens.forEach((e) => { (days[e.install_id] = days[e.install_id] || new Set()).add(dayOf(e.at, b.p_offset)); }); const add = (d, n) => dayOf(Date.parse(d + 'T00:00:00Z') + n * 86400000, 0); const co = {}; Object.values(days).forEach((set) => { const first = [...set].sort()[0]; const c = co[first] = co[first] || { cohort: first, size: 0, d1: 0, d7: 0 }; c.size += 1; if (set.has(add(first, 1))) c.d1 += 1; if (set.has(add(first, 7))) c.d7 += 1; }); return Object.values(co).sort((x, y) => (x.cohort < y.cohort ? -1 : 1)); },
  product_metrics: () => ({ learners_total: db.profiles.length, learners_new: [], practicing_per_day: [], lessons_completed: [], sessions: { total: db.conversation_sessions.length, ended: 0, abandoned: 0, failed: 0, learners: 0 }, sessions_by_mode: {}, learner_turns: db.conversation_turns.length, open_mistakes: db.mistake_records.filter((m) => !m.resolved_at).length, feedback_new: db.feedback_reports.filter((f) => f.status === 'new').length }),
  run_retention: (b) => { const cut = (d) => new Date(Date.now() - d * 86400000).toISOString(); const n = db.analytics_events.length; db.analytics_events = db.analytics_events.filter((e) => e.at >= cut(b.p_analytics_days)); const t = db.conversation_turns.length; db.conversation_turns = db.conversation_turns.filter((x) => x.created_at >= cut(b.p_transcript_days)); return { analytics_events: n - db.analytics_events.length, conversation_turns: t - db.conversation_turns.length, session_summaries: 0, webhook_events: 0, feedback_reports: 0 }; }
});
const json = (o, status = 200) => new Response(o === null ? null : JSON.stringify(o), { status });

export async function fetch(url, opts = {}) {
  const u = new URL(url, 'http://app.test'); const method = opts.method || 'GET'; const headers = opts.headers || {};
  log.push(`${method} ${u.host}${u.pathname}`);
  if (u.host === 'oauth2.googleapis.com') {
    google.tokenCalls += 1;
    const jwt = new URLSearchParams(opts.body).get('assertion'); const [h, c, s] = jwt.split('.');
    const ok = crypto.createVerify('RSA-SHA256').update(`${h}.${c}`).verify(keys.publicKey, Buffer.from(s, 'base64url'));
    google.jwtChecks.push({ ok, header: JSON.parse(Buffer.from(h, 'base64url')), claims: JSON.parse(Buffer.from(c, 'base64url')) });
    return json({ access_token: 'gtoken', expires_in: 3600 });
  }
  if (u.host === 'androidpublisher.googleapis.com') {
    if (headers.Authorization !== 'Bearer gtoken') return json({}, 401);
    const m = /purchases\/subscriptionsv2\/tokens\/(.+)$/.exec(u.pathname);
    if (m && method === 'GET') { const t = decodeURIComponent(m[1]); return google.subs[t] ? json(google.subs[t]) : json({ error: { code: 410 } }, 410); }
    const a = /purchases\/subscriptions\/([^/]+)\/tokens\/(.+):acknowledge$/.exec(u.pathname);
    if (a && method === 'POST') { const t = decodeURIComponent(a[2]); if (!google.subs[t]) return json({}, 400); google.acked.push(t); google.subs[t].acknowledgementState = 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'; return json({}); }
    return json({}, 404);
  }
  if (u.host === 'api.anthropic.com') {
    ai.calls += 1; if (ai.fail) return json({}, 500);
    return json({ content: [{ type: 'tool_use', input: { coach_reply_en: 'Nice! Where do you study?', coach_reply_bn: 'ভালো! কোথায় পড়ো?', understood: true, goal_met: false, suggested_replies: ['At a school.'], feedback: { original_text: 'I go to school yesterday', corrected_text: 'I went to school yesterday.', error_type: 'verb_tense', explanation_bn: 'অতীত কাল: went', alternative_text: '', needs_retry: false } } }], usage: ai.usage });
  }
  if (u.host === 'api.openai.com') { stt.calls += 1; return json({ text: stt.text, duration: stt.duration, segments: [{ start: 0, end: stt.duration, avg_logprob: -0.1, no_speech_prob: 0.01, text: stt.text }] }); }
  if (u.pathname.startsWith('/auth/v1/user')) { const t = (headers.Authorization || '').replace('Bearer ', ''); return users[t] ? json(users[t]) : json({}, 401); }
  const ad = /^\/auth\/v1\/admin\/users\/([^/]+)$/.exec(u.pathname);
  if (ad && method === 'DELETE') { // removing a sign-in removes everything that belongs to it (cascading rules in the real database)
    const id = ad[1]; db.auth_users = db.auth_users.filter((x) => x.id !== id); db.profiles = db.profiles.filter((x) => x.id !== id);
    Object.keys(db).forEach((k) => { if (Array.isArray(db[k]) && !['profiles', 'audit_log', 'auth_users'].includes(k)) db[k] = db[k].filter((r) => r.user_id !== id); });
    return json({}, 200);
  }
  const rp = /\/rest\/v1\/rpc\/(\w+)$/.exec(u.pathname);
  if (rp) return json(rpc[rp[1]](JSON.parse(opts.body || '{}')));
  const table = u.pathname.split('/').pop(); if (!db[table]) return json({ code: 'PGRST205' }, 404);
  if (method === 'GET') {
    let rows = filter(db[table], u.searchParams);
    const ord = u.searchParams.get('order'); if (ord) { const [f, d] = ord.split('.'); rows = [...rows].sort((a, b) => { const x = a[f]; const y = b[f]; const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0; return c * (d === 'desc' ? -1 : 1); }); }
    const lim = Number(u.searchParams.get('limit')); if (lim) rows = rows.slice(0, lim);
    return json(rows.map((r) => ({ ...r })));
  }
  if (method === 'POST') {
    const rows = JSON.parse(opts.body); const list = Array.isArray(rows) ? rows : [rows]; const prefer = headers.Prefer || ''; const uk = UNIQUE[table]; const made = [];
    list.forEach((r) => {
      const i = uk ? db[table].findIndex((x) => uk.every((k) => x[k] === r[k])) : -1;
      if (i >= 0) { if (prefer.includes('merge-duplicates')) db[table][i] = { ...db[table][i], ...r }; else if (!prefer.includes('ignore-duplicates')) throw Object.assign(new Error('dup'), { dup: true }); return; }
      const row = { id: table === 'conversation_sessions' || table === 'conversation_turns' || table === 'feedback_reports' ? crypto.randomUUID() : NUMERIC_ID.includes(table) ? ++seq : `row${++seq}`, [table === 'analytics_events' || table === 'audit_log' ? 'at' : 'created_at']: new Date().toISOString(), ...(table === 'feedback_reports' ? { status: 'new' } : {}), ...(table === 'conversation_sessions' ? { session_status: 'active' } : {}), ...r };
      db[table].push(row); made.push({ ...row });
    });
    return json(prefer.includes('return=representation') ? made : null, 201);
  }
  if (method === 'PATCH') { filter(db[table], u.searchParams).forEach((r) => Object.assign(r, JSON.parse(opts.body))); return json(null, 204); }
  if (method === 'DELETE') { const gone = filter(db[table], u.searchParams); if (table === 'audit_log') throw new Error('audit_log is append-only'); db[table] = db[table].filter((r) => !gone.includes(r)); return (headers.Prefer || '').includes('return=representation') ? json(gone.map((r) => ({ ...r }))) : json(null, 204); }
  return json(null, 204);
}

// A Google Play subscription resource like the real API returns.
export function playSub({ product = 'sub_pro', state = 'SUBSCRIPTION_STATE_ACTIVE', expiresInDays = 30, account = null, acked = false, linked = null, test = false, auto = true } = {}) {
  return { kind: 'androidpublisher#subscriptionPurchaseV2', startTime: new Date().toISOString(), regionCode: 'BD', subscriptionState: state, latestOrderId: 'GPA.1111-2222-3333-44444', acknowledgementState: acked ? 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' : 'ACKNOWLEDGEMENT_STATE_PENDING', lineItems: [{ productId: product, expiryTime: new Date(Date.now() + expiresInDays * 86400000).toISOString(), autoRenewingPlan: { autoRenewEnabled: auto }, offerDetails: { basePlanId: 'monthly' } }], ...(account ? { externalAccountIdentifiers: { obfuscatedExternalAccountId: account } } : {}), ...(linked ? { linkedPurchaseToken: linked } : {}), ...(test ? { testPurchase: {} } : {}) };
}
export const pubsub = (note, id = 'm' + Math.random().toString(36).slice(2)) => ({ message: { data: Buffer.from(JSON.stringify({ version: '1.0', packageName: 'com.spokenenglish.coach', eventTimeMillis: String(Date.now()), ...note })).toString('base64'), messageId: id, publishTime: new Date().toISOString() }, subscription: 'projects/x/subscriptions/y' });

export function call(handler, method, path, { body, token = 'tok1', headers = {}, query = {} } = {}) {
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(o) { resolve({ code: this.code, body: o }); }, end() { resolve({ code: this.code, body: null }); } };
    handler({ method, query: { path: path.split('/'), ...query }, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'x-forwarded-for': '9.9.9.' + Math.floor(Math.random() * 250), ...headers }, body }, res);
  });
}
