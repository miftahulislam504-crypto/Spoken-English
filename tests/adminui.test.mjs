// The admin dashboard page, run against the real admin API code: sign in, role-based tabs, editing content, giving a plan, and safe display of text.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as cloud from './helpers/fakeCloud.mjs';

Object.assign(process.env, { SUPABASE_URL: 'https://fake.supabase.test', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', ANTHROPIC_API_KEY: 'k', OPENAI_API_KEY: 'k', OPS_TOKEN: 'ops', CRON_SECRET: 'cron' });
['AI_TURNS_PER_DAY', 'AI_PRICE_INPUT_PER_MTOK', 'AI_PRICE_OUTPUT_PER_MTOK'].forEach((k) => delete process.env[k]);
console.error = () => {};

const store = new Map(); const vals = {}; const clicks = [];
const app = { innerHTML: '' }; const view = { innerHTML: '' };
globalThis.sessionStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.document = { querySelector: (s) => (s === '#app' ? app : s === '#view' ? view : null), getElementById: (id) => (id in vals ? vals[id] : null), addEventListener: (n, f) => { if (n === 'click') clicks.push(f); } };
globalThis.confirm = () => true;

const { default: handler } = await import('../api/v1/[...path].js'); const { resetRateLimits } = await import('../api/_lib/http.js');
const E = await import('../api/_lib/entitlements.js'); const P = await import('../api/_lib/plans.js'); const { lessonToRows } = await import('../api/_lib/content.js');
const { lessons: A, courses } = await import('../www/src/content/lessons.js'); const { lessons: B } = await import('../www/src/content/lessons-w34.js');
const { db, call, PEOPLE } = cloud; const ID = Object.fromEntries(PEOPLE.map((p) => [p.tok, p.id]));
const resp = (b, status = 200) => ({ ok: status < 400, status, json: async () => b ?? {} });
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url, 'http://admin.test');
  if (u.host === 'fake.supabase.test' && u.pathname === '/auth/v1/token') { const b = JSON.parse(opts.body); if (b.password !== 'right-password') return resp({ error_description: 'Invalid login credentials' }, 400); return resp({ access_token: b.email.split('@')[0], refresh_token: 'r', expires_in: 3600, user: { email: b.email } }); }
  if (u.host !== 'admin.test') return cloud.fetch(url, opts);
  if (u.pathname === '/api/v1/public-config') return resp({ supabase_url: 'https://fake.supabase.test', anon_key: 'anon' });
  const m = /^Bearer (.+)$/.exec((opts.headers || {}).Authorization || ''); const r = await call(handler, opts.method || 'GET', u.pathname.slice('/api/v1/'.length), { body: opts.body ? JSON.parse(opts.body) : undefined, token: m ? m[1] : null, query: Object.fromEntries(u.searchParams) });
  return resp(r.body, r.code);
};
function server() {
  resetRateLimits(); cloud.reset(); P.clearPlanCache(); E.clearEntitlementCaches();
  db.courses = courses.map((c) => ({ id: c.id, title: c.title_en, published_status: 'published', content_version: 1 }));
  [...A, ...B].forEach((l) => { const r = lessonToRows(l); db.lessons.push({ ...r.lesson, updated_at: '2026-10-01T00:00:00Z' }); db.exercises.push(...r.exercises); });
  db.admin_roles = [{ user_id: ID.owner, role: 'owner', email: 'owner@x.test' }, { user_id: ID.editor, role: 'content_manager', email: 'editor@x.test' }, { user_id: ID.helper, role: 'support', email: 'helper@x.test' }, { user_id: ID.viewer, role: 'analyst', email: 'viewer@x.test' }];
}
server(); await import('../www/admin/admin.js');
const wait = () => new Promise((r) => setTimeout(r, 40));
const click = async (dataset) => { clicks.forEach((f) => f({ target: { closest: () => ({ dataset }) } })); await wait(); };
const signIn = async (who, pass = 'right-password') => { vals['li-email'] = { value: `${who}@x.test` }; vals['li-pass'] = { value: pass }; await click({ act: 'login' }); };
const tabsOf = () => [...app.innerHTML.matchAll(/data-act="tab" data-v="(\w+)"/g)].map((m) => m[1]);
const open = async (name) => { await click({ act: 'tab', v: name }); return view.innerHTML; };
await wait();

test('the page asks for sign in first and refuses an account without an admin role', async () => {
  assert.match(app.innerHTML, /Admin sign in/);
  await signIn('learner'); assert.match(app.innerHTML, /no admin role/); assert.equal(store.has('admin.session'), false, 'nothing is kept for a refused account');
  await signIn('owner', 'wrong'); assert.match(app.innerHTML, /Invalid login/);
});

test('each role sees only its own sections', async () => {
  const expect = { owner: ['overview', 'analytics', 'content', 'ai', 'plans', 'learners', 'feedback', 'team', 'audit'], editor: ['overview', 'analytics', 'content', 'feedback'], helper: ['plans', 'learners', 'feedback'], viewer: ['overview', 'analytics', 'content', 'ai', 'plans'] };
  for (const [who, tabs] of Object.entries(expect)) { await click({ act: 'logout' }); await signIn(who); assert.deepEqual(tabsOf(), tabs, who); assert.match(app.innerHTML, new RegExp(`<span class="badge">${who === 'editor' ? 'content_manager' : who === 'helper' ? 'support' : who === 'viewer' ? 'analyst' : 'owner'}</span>`)); }
});

test('the owner can open every section and none of them shows a blank or broken value', async () => {
  await click({ act: 'logout' }); await signIn('owner');
  const heading = { overview: /Health:/, analytics: /Funnel/, content: /Checks/, ai: /AI coach/, plans: /Free - Starter/, learners: /Find a learner/, feedback: /No reports|bug|idea/, team: /What each role can do/, audit: /When/ };
  for (const [name, re] of Object.entries(heading)) { const html = await open(name); assert.match(html, re, name); assert.doesNotMatch(html, /undefined|\[object Object\]|NaN/, name); assert.doesNotMatch(html, /fb bad/, `${name} shows an error`); }
});

test('content: open a lesson, change its title with a reason, see the new version, and restore the old one', async () => {
  await open('content'); assert.match(view.innerHTML, /1\. Greetings and polite words/);
  await click({ act: 'lesson', id: 'l1' }); assert.match(view.innerHTML, /This lesson passes every check/); assert.match(view.innerHTML, /Set to draft/); assert.match(view.innerHTML, /Exercises \(/);
  Object.assign(vals, { 'ls-title': { value: 'Hello everyone' }, 'ls-obj': { value: 'Say hello\nSay goodbye' }, 'ls-dur': { value: '420' }, 'ls-min': { value: '0.7' }, 'ls-pre': { value: '' }, 'ls-reason': { value: 'simpler title' } });
  await click({ act: 'save-lesson', id: 'l1' }); assert.match(view.innerHTML, /Saved\. Version 2/); assert.equal(db.lessons.find((l) => l.id === 'l1').title_en, 'Hello everyone');
  assert.match(view.innerHTML, /Earlier versions/); const rev = db.content_revisions[0].id;
  await click({ act: 'restore', id: 'l1', rev: String(rev) }); assert.match(view.innerHTML, /Restored as version 3/); assert.equal(db.lessons.find((l) => l.id === 'l1').title_en, 'Greetings and polite words');
  const ex = db.exercises.find((e) => e.lesson_id === 'l1' && e.exercise_type === 'choose');
  Object.assign(vals, { ['ex-c-' + ex.id]: { value: JSON.stringify({ ...ex.content_json, options: ['x', 'x'] }) }, ['ex-a-' + ex.id]: { value: JSON.stringify(ex.answer_rules_json) }, ['ex-r-' + ex.id]: { value: '' } });
  await click({ act: 'save-ex', id: ex.id }); assert.match(view.innerHTML, /options repeat/, 'a bad exercise edit shows the reason it was refused');
  Object.assign(vals, { ['ex-c-' + ex.id]: { value: '{not json' } }); await click({ act: 'save-ex', id: ex.id }); assert.match(view.innerHTML, /fb bad/, 'broken JSON is reported, not ignored');
  await click({ act: 'back' }); assert.match(view.innerHTML, /Checks/);
});

test('learners: find by email, open, give a plan with a reason, and take it back', async () => {
  await click({ act: 'logout' }); await signIn('helper'); await open('learners');
  vals['us-q'] = { value: 'learner@x.test' }; await click({ act: 'search' }); assert.match(view.innerHTML, /learner@x\.test/);
  await click({ act: 'user', id: ID.learner }); assert.match(view.innerHTML, /Give or take back a plan/); assert.match(view.innerHTML, /up to 31/); assert.match(view.innerHTML, /Free - Starter/);
  Object.assign(vals, { 'gr-plan': { value: 'pro' }, 'gr-days': { value: '14' }, 'gr-reason': { value: '' } }); await click({ act: 'grant', id: ID.learner }); assert.match(view.innerHTML, /Reason/i, 'no reason, no plan'); assert.equal(db.subscriptions.length, 0);
  vals['gr-reason'] = { value: 'beta tester' }; await click({ act: 'grant', id: ID.learner }); assert.match(view.innerHTML, /Plan given/); assert.match(view.innerHTML, /Pro/); assert.equal(db.subscriptions.length, 1);
  await click({ act: 'revoke', id: ID.learner }); assert.match(view.innerHTML, /Manual plan taken back/);
  vals['us-q'] = { value: 'nobody@x.test' }; await click({ act: 'search' }); assert.match(view.innerHTML, /No learner has exactly this email/);
});

test('text from learners is shown as text, never as page code', async () => {
  await click({ act: 'logout' }); await signIn('owner');
  const fid = crypto.randomUUID(); db.feedback_reports.push({ id: fid, user_id: null, kind: 'bug', message: '<img src=x onerror=alert(1)>', context: { screen: '"><script>x</script>' }, status: 'new', created_at: new Date().toISOString() });
  const html = await open('feedback'); assert.doesNotMatch(html, /<img src=x/); assert.doesNotMatch(html, /<script>x/); assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  await click({ act: 'fbs', id: fid, v: 'resolved' }); assert.equal(db.feedback_reports[0].status, 'resolved');
});

test('team and audit: add a role, see it in the log, and the page never keeps a secret', async () => {
  await open('team'); vals['rl-email'] = { value: 'learner@x.test' }; vals['rl-role'] = { value: 'analyst' }; await click({ act: 'set-role' }); assert.match(view.innerHTML, /Role saved/); assert.match(view.innerHTML, /learner@x\.test/);
  const html = await open('audit'); assert.match(html, /role\.set/); assert.match(html, /user\.grant/);
  assert.ok(![...store.values()].some((v) => /service|sk-|ANTHROPIC|OPS_TOKEN/i.test(v)), 'only the sign-in session is stored, in this tab only');
  await click({ act: 'logout' }); assert.equal(store.size, 0); assert.match(app.innerHTML, /Admin sign in/);
});
