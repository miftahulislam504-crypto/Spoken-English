// Phase 10: roles, audit log, content management, AI operations, business operations, usage events and the analytics views.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as cloud from './helpers/fakeCloud.mjs';

Object.assign(process.env, { SUPABASE_URL: 'https://fake.supabase.test', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', ANTHROPIC_API_KEY: 'k', OPENAI_API_KEY: 'k', OPS_TOKEN: 'ops-secret', CRON_SECRET: 'cron-secret' });
['AI_TURNS_PER_DAY', 'AI_PRICE_INPUT_PER_MTOK', 'AI_PRICE_OUTPUT_PER_MTOK', 'STT_PRICE_PER_MINUTE', 'AI_DAILY_BUDGET_USD', 'AI_MONTHLY_BUDGET_USD'].forEach((k) => delete process.env[k]);
globalThis.fetch = cloud.fetch;
console.error = () => {};

const { default: handler } = await import('../api/v1/[...path].js');
const { resetRateLimits } = await import('../api/_lib/http.js');
const E = await import('../api/_lib/entitlements.js');
const P = await import('../api/_lib/plans.js');
const { lessonToRows, rowsToLesson, lessonProblems } = await import('../api/_lib/content.js');
const { cleanEvent, EVENTS } = await import('../www/src/engine/events.js');
const { lessons: A, courses } = await import('../www/src/content/lessons.js');
const { lessons: B } = await import('../www/src/content/lessons-w34.js');
const { db, call, PEOPLE } = cloud;
const BUNDLED = [...A, ...B];
const ID = Object.fromEntries(PEOPLE.map((p) => [p.tok, p.id]));
const norm = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([x], [y]) => (x < y ? -1 : 1))) : v));

function fresh() {
  resetRateLimits(); cloud.reset(); P.clearPlanCache(); E.clearEntitlementCaches();
  ['AI_PRICE_INPUT_PER_MTOK', 'AI_PRICE_OUTPUT_PER_MTOK'].forEach((k) => delete process.env[k]);
  db.courses = courses.map((c) => ({ id: c.id, title: c.title_en, published_status: 'published', content_version: 1 }));
  BUNDLED.forEach((l) => { const r = lessonToRows(l); db.lessons.push({ ...r.lesson, updated_at: '2026-10-01T00:00:00Z' }); db.exercises.push(...r.exercises); });
  db.admin_roles = [{ user_id: ID.owner, role: 'owner', email: 'owner@x.test' }, { user_id: ID.editor, role: 'content_manager', email: 'editor@x.test' }, { user_id: ID.helper, role: 'support', email: 'helper@x.test' }, { user_id: ID.viewer, role: 'analyst', email: 'viewer@x.test' }];
}
const as = (tok, method, path, opts = {}) => call(handler, method, path, { token: tok, ...opts });
const get = (tok, path, query) => as(tok, 'GET', path, { query });
const firstEx = (lessonId, type) => db.exercises.find((e) => e.lesson_id === lessonId && (!type || e.exercise_type === type));

test('lessons survive the trip to database rows and back, and every bundled lesson passes the publishing checks', () => {
  const known = Object.fromEntries(BUNDLED.map((l) => [l.id, { status: 'published', prerequisites: l.prerequisite_lesson_ids }]));
  BUNDLED.forEach((l) => {
    const { lesson, exercises } = lessonToRows(l);
    assert.equal(norm(rowsToLesson(lesson, exercises)), norm(JSON.parse(JSON.stringify(l))), l.id);
    assert.deepEqual(lessonProblems(l, known), [], l.id);
  });
});

test('usage events: only the fixed names and values pass', () => {
  assert.deepEqual(cleanEvent('lesson_completed', { lesson_id: 'l1', score_pct: 80, first_time: true, extra: 'x' }), { name: 'lesson_completed', props: { lesson_id: 'l1', score_pct: 80, first_time: true } });
  assert.equal(cleanEvent('lesson_completed', { lesson_id: 'l1 ', score_pct: 80, first_time: true }), null, 'an id with a space is refused');
  assert.equal(cleanEvent('lesson_completed', { lesson_id: 'l1', score_pct: 180, first_time: true }), null);
  assert.equal(cleanEvent('typed_sentence', { text: 'My name is Rahim' }), null, 'unknown events are dropped');
  assert.equal(cleanEvent('feedback_sent', { kind: 'bug', message: 'secret' }).props.message, undefined);
  Object.entries(EVENTS).forEach(([name, spec]) => Object.values(spec).forEach((rule) => assert.ok(['bool', 'int', 'enum', 'id'].includes(rule[0]), `${name}: no free text is allowed`)));
});

test('events are accepted from guests and signed-in learners, bad ones are dropped, and the phone id must be well formed', async () => {
  fresh(); const install = 'abcdef0123456789abcdef0123456789';
  let r = await as(null, 'POST', 'events', { body: { install_id: install, platform: 'web', app_version: '0.2.0', events: [{ name: 'app_opened', props: {}, at: Date.now() }, { name: 'lesson_started', props: { lesson_id: 'l1', week: 'w1' } }, { name: 'sell_data', props: {} }, { name: 'lesson_completed', props: { lesson_id: 'l1', score_pct: 400, first_time: true } }] } });
  assert.equal(r.code, 200); assert.deepEqual(r.body, { accepted: 2, dropped: 2 });
  assert.equal(db.analytics_events.length, 2); assert.equal(db.analytics_events[0].user_id, null);
  r = await as('learner', 'POST', 'events', { body: { install_id: install, events: [{ name: 'paywall_viewed', props: {} }] } });
  assert.equal(db.analytics_events.at(-1).user_id, ID.learner, 'a signed-in learner is attached on the server');
  r = await as(null, 'POST', 'events', { body: { install_id: 'short', events: [{ name: 'app_opened' }] } }); assert.equal(r.code, 400);
  r = await as(null, 'POST', 'events', { body: { install_id: install, events: [] } }); assert.equal(r.code, 400);
  r = await as('bad-token', 'POST', 'events', { body: { install_id: install, events: [{ name: 'app_opened' }] } }); assert.equal(r.code, 200, 'a stale token never blocks usage events');
  assert.equal(db.analytics_events.at(-1).user_id, null);
  for (let i = 0; i < 25; i++) r = await as(null, 'POST', 'events', { body: { install_id: install, events: [{ name: 'app_opened' }] } });
  assert.equal(r.code, 429, 'one phone cannot flood the server');
});

test('roles: each person sees only what their role allows', async () => {
  fresh();
  assert.equal((await get('learner', 'admin/me')).code, 403, 'a learner is not an admin');
  assert.equal((await get(null, 'admin/me')).code, 401);
  const me = (await get('editor', 'admin/me')).body; assert.equal(me.role, 'content_manager'); assert.ok(me.permissions.includes('content.write') && !me.permissions.includes('users.read'));
  assert.ok((await get('owner', 'admin/me')).body.permissions.includes('roles.manage'));
  assert.equal((await get('helper', 'admin/analytics')).code, 403, 'support has no analytics');
  assert.equal((await get('viewer', 'admin/analytics')).code, 200);
  assert.equal((await as('viewer', 'PATCH', 'admin/content/lessons/l1', { body: { title_en: 'X' } })).code, 403, 'an analyst cannot edit lessons');
  assert.equal((await get('editor', 'admin/users/search', { q: 'learner@x.test' })).code, 403, 'a content manager cannot look up learners');
  assert.equal((await get('editor', 'admin/audit')).code, 403);
  assert.equal((await get('helper', 'admin/audit')).code, 403);
  assert.equal((await get('owner', 'admin/audit')).code, 200);
  assert.equal((await as('helper', 'PUT', 'admin/plans/pro', { body: {} })).code, 403);
  assert.equal((await as('owner', 'PUT', 'admin/ai/settings', { body: { ai_enabled: false } })).code, 200);
  assert.equal((await as('viewer', 'PUT', 'admin/ai/settings', { body: { ai_enabled: true } })).code, 403, 'an analyst can see AI numbers but not change them');
});

test('content: an edit saves the old version, raises the version, and is recorded before it is made', async () => {
  fresh();
  const list = (await get('editor', 'admin/content/lessons')).body.lessons; assert.equal(list.length, 31); assert.ok(list.every((l) => l.exercise_count >= 0 && l.content_version === 1));
  const view = (await get('editor', 'admin/content/lessons/l1')).body; assert.deepEqual(view.problems, []); assert.ok(view.exercises.length > 3);
  const r = await as('editor', 'PATCH', 'admin/content/lessons/l1', { body: { title_en: 'Greetings and manners', learning_objectives: ['Say hello', 'Say goodbye'], reason: 'clearer title' } });
  assert.equal(r.code, 200); assert.equal(r.body.content_version, 2);
  const row = db.lessons.find((l) => l.id === 'l1'); assert.equal(row.title_en, 'Greetings and manners'); assert.equal(row.content_version, 2);
  assert.ok(db.exercises.filter((e) => e.lesson_id === 'l1').every((e) => e.content_version === 2), 'exercises follow the lesson version');
  assert.equal(db.content_revisions.length, 1); assert.equal(db.content_revisions[0].snapshot.lesson.title_en, 'Greetings and polite words'); assert.equal(db.content_revisions[0].content_version, 1);
  const a = db.audit_log.at(-1); assert.equal(a.action, 'content.lesson.update'); assert.equal(a.actor_role, 'content_manager'); assert.equal(a.actor_email, 'editor@x.test'); assert.equal(a.details.before.title_en, 'Greetings and polite words'); assert.equal(a.details.reason, 'clearer title');
  assert.equal((await as('editor', 'PATCH', 'admin/content/lessons/l1', { body: { sequence_number: 9 } })).code, 400, 'only listed fields can be edited');
  assert.equal((await as('editor', 'PATCH', 'admin/content/lessons/l1', { body: { title_en: '' } })).code, 400);
  assert.equal((await as('editor', 'PATCH', 'admin/content/lessons/l1', { body: { prerequisite_lesson_ids: ['nope'] } })).code, 400, 'a published lesson cannot be given an unknown prerequisite');
  assert.equal((await as('editor', 'PATCH', 'admin/content/lessons/l5', { body: { prerequisite_lesson_ids: ['l5'] } })).code, 400, 'a lesson cannot need itself');
  assert.equal((await as('editor', 'PATCH', 'admin/content/lessons/l1', { body: { prerequisite_lesson_ids: ['l31'] } })).code, 400, 'prerequisite loops are refused');
  assert.equal((await get('editor', 'admin/content/lessons/nope')).code, 404);
});

test('content: a bad exercise edit is refused, a good one is saved, and a restore brings the old lesson back', async () => {
  fresh();
  const ch = firstEx('l4', 'choose'); const before = JSON.parse(JSON.stringify(ch.answer_rules_json));
  let r = await as('editor', 'PUT', `admin/content/exercises/${ch.id}`, { body: { answer_rules_json: { answer: 9 } } }); assert.equal(r.code, 400, 'the answer must point at an option');
  r = await as('editor', 'PUT', `admin/content/exercises/${ch.id}`, { body: { content_json: { options: ['same', 'same', 'other'] } } }); assert.equal(r.code, 400, 'repeated options are refused');
  r = await as('editor', 'PUT', `admin/content/exercises/${ch.id}`, { body: { content_json: { secret: 'x' } } }); assert.equal(r.code, 400, 'unknown fields are refused');
  assert.deepEqual(db.exercises.find((e) => e.id === ch.id).answer_rules_json, before, 'nothing changed after refusals');
  assert.equal(db.audit_log.length, 0, 'refused edits leave no audit entry because nothing was attempted');
  const ty = firstEx('l1', 'type');
  r = await as('editor', 'PUT', `admin/content/exercises/${ty.id}`, { body: { answer_rules_json: { accept: [] } } }); assert.equal(r.code, 400);
  r = await as('editor', 'PUT', `admin/content/exercises/${ty.id}`, { body: { content_json: { prompt_en: 'Write it again.' }, reason: 'wording' } }); assert.equal(r.code, 200); assert.equal(r.body.content_version, 2);
  assert.equal(db.exercises.find((e) => e.id === ty.id).content_json.prompt_en, 'Write it again.');
  const revs = (await get('editor', 'admin/content/lessons/l1/revisions')).body.revisions; assert.equal(revs.length, 1);
  const back = await as('editor', 'POST', 'admin/content/lessons/l1/restore', { body: { revision_id: revs[0].id } }); assert.equal(back.code, 200); assert.equal(back.body.content_version, 3);
  assert.equal(db.exercises.find((e) => e.id === ty.id).content_json.prompt_en, ty.content_json.prompt_en, 'the old wording is back');
  assert.equal(db.content_revisions.length, 2, 'the version before the restore is kept too');
  assert.equal(db.audit_log.at(-1).action, 'content.lesson.restore');
  assert.equal((await as('editor', 'POST', 'admin/content/lessons/l1/restore', { body: { revision_id: 999 } })).code, 404);
});

test('content: publishing needs a clean lesson; hiding a lesson others need is refused; the phone sees the change', async () => {
  fresh();
  assert.equal((await as('editor', 'POST', 'admin/content/lessons/l1/status', { body: { status: 'draft' } })).code, 409, 'l2 needs l1');
  const r = await as('editor', 'POST', 'admin/content/lessons/l31/status', { body: { status: 'draft', reason: 'check wording' } }); assert.equal(r.code, 200);
  const man = (await as(null, 'GET', 'content/manifest')).body; assert.equal(man.lessons.length, 30); assert.deepEqual(man.retired, ['l31']);
  assert.equal((await as(null, 'GET', 'content/lessons', { query: { ids: 'l31' } })).body.lessons.length, 0, 'a draft is never served');
  db.exercises.find((e) => e.lesson_id === 'l31' && e.exercise_type === 'choose').answer_rules_json.answer = 9; // a broken lesson in the database
  assert.equal((await as('editor', 'POST', 'admin/content/lessons/l31/status', { body: { status: 'published' } })).code, 400, 'a broken lesson cannot be published');
  db.exercises.find((e) => e.lesson_id === 'l31' && e.exercise_type === 'choose').answer_rules_json.answer = firstEx('l31', 'choose') && 0;
  assert.equal((await as('editor', 'POST', 'admin/content/lessons/l31/status', { body: { status: 'published' } })).code, 200);
  assert.equal(db.audit_log.filter((a) => a.action === 'content.lesson.status').length, 2);
  const packed = (await as(null, 'GET', 'content/lessons', { query: { ids: 'l1,l2,l3' } })).body; assert.equal(packed.schema, 1); assert.equal(packed.lessons.length, 3);
  assert.equal((await as(null, 'GET', 'content/lessons', { query: { ids: 'l1,bad id' } })).code, 400);
  assert.equal((await as(null, 'GET', 'content/lessons', { query: { ids: '' } })).code, 400);
  db.exercises.find((e) => e.lesson_id === 'l2' && e.exercise_type === 'choose').answer_rules_json.answer = 7;
  assert.ok(!(await as(null, 'GET', 'content/lessons', { query: { ids: 'l2' } })).body.lessons.length, 'a lesson that fails the checks is not sent to phones');
});

test('content: a new lesson can be added as a draft, with every check applied', async () => {
  fresh();
  const base = JSON.parse(JSON.stringify(BUNDLED.find((l) => l.id === 'l1')));
  const mk = (over) => ({ ...base, id: 'l99', title_en: 'Thank you and sorry', sequence_number: 32, prerequisite_lesson_ids: ['l31'], ...over });
  let r = await as('editor', 'POST', 'admin/content/lessons', { body: { lesson: mk({ week: 'w9' }) } }); assert.equal(r.code, 400); assert.match(r.body.error.details, /week/);
  r = await as('editor', 'POST', 'admin/content/lessons', { body: { lesson: mk({ prerequisite_lesson_ids: ['ghost'] }) } }); assert.equal(r.code, 400);
  r = await as('editor', 'POST', 'admin/content/lessons', { body: { lesson: mk({ id: 'l1' }) } }); assert.equal(r.code, 409, 'an existing id is never overwritten');
  r = await as('editor', 'POST', 'admin/content/lessons', { body: { lesson: mk({ steps: [...base.steps.slice(0, -1)] }) } }); assert.equal(r.code, 400, 'the review step is required');
  r = await as('editor', 'POST', 'admin/content/lessons', { body: { lesson: mk({ course_id: 'c404' }) } }); assert.equal(r.code, 400);
  r = await as('editor', 'POST', 'admin/content/lessons', { body: { lesson: mk({}), reason: 'new topic' } }); assert.equal(r.code, 200); assert.equal(r.body.status, 'draft');
  assert.equal(db.lessons.find((l) => l.id === 'l99').published_status, 'draft'); assert.equal(db.exercises.filter((e) => e.lesson_id === 'l99').length, db.exercises.filter((e) => e.lesson_id === 'l1').length);
  assert.equal(db.audit_log.at(-1).action, 'content.lesson.import');
  assert.equal((await as('editor', 'POST', 'admin/content/lessons/l99/status', { body: { status: 'published' } })).code, 200);
  assert.ok((await as(null, 'GET', 'content/manifest')).body.lessons.some((l) => l.id === 'l99'));
  assert.equal((await get('editor', 'admin/content/checks')).body.with_problems, 0);
});

test('learners: lookup, view, gifts with limits, and every look is logged', async () => {
  fresh();
  let r = await get('helper', 'admin/users/search', { q: 'LEARNER@x.test' }); assert.equal(r.body.users[0].id, ID.learner);
  assert.equal((await get('helper', 'admin/users/search', { q: 'le' })).code, 400, 'short searches are refused');
  assert.equal((await get('helper', 'admin/users/search', { q: 'learner' })).body.users.length, 0, 'only an exact email or id matches');
  r = await get('helper', `admin/users/${ID.learner}`); assert.equal(r.code, 200); assert.equal(r.body.email, 'learner@x.test'); assert.equal(r.body.entitlement.plan.id, 'free'); assert.ok(!JSON.stringify(r.body).includes('transcript'));
  assert.ok(db.audit_log.some((a) => a.action === 'user.view' && a.target_id === ID.learner), 'a look at a learner is recorded');
  assert.equal((await get('helper', 'admin/users/not-a-uuid')).code, 400);
  assert.equal((await as('helper', 'POST', `admin/users/${ID.learner}/grant`, { body: { plan_id: 'pro', days: 7 } })).code, 400, 'a reason is required');
  assert.equal((await as('helper', 'POST', `admin/users/${ID.learner}/grant`, { body: { plan_id: 'pro', days: 90, reason: 'beta tester' } })).code, 400, 'support may give at most 31 days');
  assert.equal((await as('helper', 'POST', `admin/users/${ID.learner}/grant`, { body: { plan_id: 'free', days: 7, reason: 'beta tester' } })).code, 400);
  r = await as('helper', 'POST', `admin/users/${ID.learner}/grant`, { body: { plan_id: 'pro', days: 14, reason: 'closed beta tester' } });
  assert.equal(r.code, 200); assert.equal(r.body.entitlement.plan.id, 'pro'); assert.equal(r.body.entitlement.source, 'manual');
  assert.equal(db.subscriptions[0].provider, 'manual'); assert.equal(db.audit_log.at(-1).details.reason, 'closed beta tester');
  assert.equal((await as('owner', 'POST', `admin/users/${ID.learner}/grant`, { body: { plan_id: 'advanced', days: 90, reason: 'long beta' } })).body.entitlement.plan.id, 'advanced', 'an owner may give longer, and the higher plan wins');
  r = await as('helper', 'POST', `admin/users/${ID.learner}/revoke`, { body: { reason: 'beta over' } }); assert.equal(r.body.entitlement.plan.id, 'free');
  assert.equal((await as('helper', 'POST', `admin/users/${'c0000000-0000-4000-8000-000000000009'}/grant`, { body: { plan_id: 'pro', days: 3, reason: 'nobody' } })).code, 404);
});

test('AI operations: switch and budgets are owner-only, need prices, are recorded, and take effect', async () => {
  fresh();
  let r = await as('owner', 'PUT', 'admin/ai/settings', { body: { daily_usd: 5 } }); assert.equal(r.code, 400, 'a budget without prices could never trigger');
  process.env.AI_PRICE_INPUT_PER_MTOK = '1'; process.env.AI_PRICE_OUTPUT_PER_MTOK = '5';
  r = await as('owner', 'PUT', 'admin/ai/settings', { body: { daily_usd: 5, monthly_usd: 80, reason: 'beta budget' } }); assert.equal(r.code, 200); assert.equal(r.body.settings.daily_usd, 5);
  assert.equal(db.audit_log.at(-1).action, 'ai.settings.update'); assert.equal(db.audit_log.at(-1).details.before.daily_usd, null);
  assert.equal((await as('owner', 'PUT', 'admin/ai/settings', { body: { daily_usd: -1 } })).code, 400);
  assert.equal((await as('owner', 'PUT', 'admin/ai/settings', { body: {} })).code, 400);
  await as('owner', 'PUT', 'admin/ai/settings', { body: { ai_enabled: false } });
  assert.deepEqual(await E.aiAvailable(), { ok: false, reason: 'disabled' });
  await as('owner', 'PUT', 'admin/ai/settings', { body: { ai_enabled: true, daily_usd: null } }); assert.equal((await E.aiAvailable()).ok, true);
  const info = (await get('viewer', 'admin/ai')).body; assert.equal(info.settings.monthly_usd, 80); assert.equal(info.coach_key_set, true); assert.equal(info.coach_provider, 'anthropic'); assert.equal(info.stt_provider, 'openai'); assert.equal(info.prices_configured, true);
  const s = JSON.stringify(info); assert.ok(!s.includes('"k"') && !s.includes('ops-secret'), 'no key is ever returned');
  process.env.GROQ_API_KEY = 'gsk_secret_value'; const g = (await get('viewer', 'admin/ai')).body; delete process.env.GROQ_API_KEY;
  assert.equal(g.coach_provider, 'groq'); assert.equal(g.stt_provider, 'groq'); assert.equal(g.coach_model, 'openai/gpt-oss-120b'); assert.equal(g.stt_model, 'whisper-large-v3-turbo'); assert.ok(!JSON.stringify(g).includes('gsk_secret_value'), 'the Groq key is never returned');
});

test('plans: limits are edited with strict checks and apply at once', async () => {
  fresh();
  const bad = [{ features: { ai_turns_per_day: -1, stt_seconds_per_day: 10, speaking_modes: ['guided'] } }, { features: { ai_turns_per_day: 5, stt_seconds_per_day: 10, speaking_modes: [] } }, { features: { ai_turns_per_day: 5, stt_seconds_per_day: 10, speaking_modes: ['karaoke'] } }, { features: { ai_turns_per_day: 'ten', stt_seconds_per_day: 10, speaking_modes: ['guided'] } }, { play_product_id: 'x' }];
  for (const body of bad) assert.equal((await as('owner', 'PUT', 'admin/plans/free', { body })).code, 400, JSON.stringify(body));
  assert.equal((await as('owner', 'PUT', 'admin/plans/gold', { body: { name: 'Gold' } })).code, 400);
  const r = await as('owner', 'PUT', 'admin/plans/free', { body: { features: { ai_turns_per_day: 3, stt_seconds_per_day: 60, speaking_modes: ['guided', 'repeat'] }, reason: 'tighter free plan' } }); assert.equal(r.code, 200);
  assert.equal((await E.getEntitlement(ID.learner)).features.ai_turns_per_day, 3);
  assert.equal(db.audit_log.at(-1).details.before.features.ai_turns_per_day, 10);
  const list = (await get('helper', 'admin/plans')).body; assert.equal(list.plans.length, 3);
});

test('team: the owner adds and removes roles, and the last owner can never be removed', async () => {
  fresh();
  assert.equal((await as('owner', 'PUT', 'admin/roles', { body: { email: 'nobody@x.test', role: 'support' } })).code, 404);
  assert.equal((await as('owner', 'PUT', 'admin/roles', { body: { email: 'learner@x.test', role: 'janitor' } })).code, 400);
  assert.equal((await as('editor', 'PUT', 'admin/roles', { body: { email: 'learner@x.test', role: 'owner' } })).code, 403, 'nobody can make themselves or others owner without being one');
  assert.equal((await as('owner', 'PUT', 'admin/roles', { body: { email: 'learner@x.test', role: 'analyst' } })).code, 200);
  assert.equal((await get('learner', 'admin/me')).body.role, 'analyst');
  assert.equal((await as('owner', 'DELETE', `admin/roles/${ID.learner}`)).code, 204);
  assert.equal((await get('learner', 'admin/me')).code, 403);
  assert.equal((await as('owner', 'DELETE', `admin/roles/${ID.owner}`)).code, 409, 'the only owner cannot be removed');
  assert.equal((await as('owner', 'PUT', 'admin/roles', { body: { email: 'owner@x.test', role: 'support' } })).code, 409, 'nor demoted');
  await as('owner', 'PUT', 'admin/roles', { body: { email: 'editor@x.test', role: 'owner' } });
  assert.equal((await as('owner', 'DELETE', `admin/roles/${ID.owner}`)).code, 204, 'with a second owner the first can step down');
  assert.deepEqual(db.audit_log.map((a) => a.action).filter((a) => a.startsWith('role.')), ['role.set', 'role.remove', 'role.set', 'role.remove']);
});

test('the audit log can only grow', async () => {
  fresh();
  await as('editor', 'PATCH', 'admin/content/lessons/l1', { body: { title_en: 'Hello again' } });
  assert.ok(db.audit_log.length >= 1);
  await assert.rejects(() => cloud.fetch('https://fake.supabase.test/rest/v1/audit_log?id=eq.1', { method: 'DELETE' }), /append-only/);
  const r = (await get('owner', 'admin/audit', { action: 'content' })).body.entries; assert.ok(r.every((e) => e.action.startsWith('content')));
  assert.equal((await get('owner', 'admin/audit', { limit: '1' })).body.entries.length, 1);
  assert.equal((await get('owner', 'admin/audit', { before: '1' })).body.entries.length, 0);
  const sql = (await import('node:fs')).readFileSync(new URL('../supabase/migrations/0007_admin.sql', import.meta.url), 'utf8');
  assert.match(sql, /before update or delete on public\.audit_log/);
});

test('analytics: events become funnel, daily counts and retention for the dashboard', async () => {
  fresh(); const day = 86400000;
  const put = (install, name, ageDays, props = {}) => db.analytics_events.push({ id: db.analytics_events.length + 1, at: new Date(Date.now() - ageDays * day).toISOString(), install_id: install, user_id: null, name, props });
  ['a', 'b', 'c', 'd'].forEach((x) => put(x.repeat(16), 'app_opened', 3)); put('a'.repeat(16), 'app_opened', 2); put('b'.repeat(16), 'app_opened', -4 + 4);
  ['a', 'b', 'c'].forEach((x) => put(x.repeat(16), 'onboarding_completed', 3, { level: 'A1', placed: true })); ['a', 'b'].forEach((x) => put(x.repeat(16), 'lesson_started', 3)); put('a'.repeat(16), 'lesson_completed', 3);
  const r = (await get('viewer', 'admin/analytics', { days: '30' })).body;
  assert.deepEqual(r.funnel.map((f) => f.actors), [4, 3, 2, 1, 0, 0, 0]);
  const first = r.retention.find((c) => c.size === 4); assert.ok(first && first.d1 === 1, 'one of four phones came back the next day');
  assert.ok(r.daily.some((d) => d.name === 'app_opened' && d.actors === 4));
  assert.equal(r.days, 30); assert.equal((await get('viewer', 'admin/analytics', { days: '9999' })).body.days, 30, 'a wrong period falls back');
  assert.ok(r.event_names.includes('lesson_completed'));
});

test('overview: owner numbers and health checks come together; OPS_TOKEN still works for the old summary', async () => {
  fresh();
  const o = (await get('viewer', 'admin/overview')).body; assert.ok(o.today && o.budget && o.health.checks.length >= 6); assert.equal(o.health.status, 'attention');
  assert.equal((await get('helper', 'admin/overview')).code, 403);
  assert.equal((await as(null, 'GET', 'ops/summary', { token: 'ops-secret' })).code, 200);
  assert.equal((await as(null, 'GET', 'ops/health', { token: 'ops-secret' })).body.checks.find((c) => c.name === 'database').ok, true);
  assert.equal((await as(null, 'GET', 'ops/health', { token: 'wrong' })).code, 401);
});

test('feedback: guests and learners can write; the text kept is limited; the team can work the queue', async () => {
  fresh();
  let r = await as(null, 'POST', 'feedback', { body: { kind: 'bug', message: 'The mic button does nothing', context: { screen: 'speak', password: 'hunter2' }, app_version: '0.2.0', platform: 'android' } });
  assert.equal(r.code, 200); assert.deepEqual(db.feedback_reports[0].context, { screen: 'speak' }, 'only listed context fields are kept');
  assert.equal((await as('learner', 'POST', 'feedback', { body: { kind: 'ai_correction', message: 'This correction is wrong', context: { original: 'I go home', corrected: 'I goes home', error_type: 'verb_tense', mode: 'guided' } } })).code, 200);
  assert.equal(db.feedback_reports[1].user_id, ID.learner);
  assert.equal((await as(null, 'POST', 'feedback', { body: { kind: 'bug', message: '' } })).code, 400);
  assert.equal((await as(null, 'POST', 'feedback', { body: { kind: 'bug', message: 'x'.repeat(1001) } })).code, 400);
  assert.equal((await as(null, 'POST', 'feedback', { body: { kind: 'spam', message: 'hi' } })).code, 400);
  const list = (await get('helper', 'admin/feedback', { kind: 'ai_correction' })).body.reports; assert.equal(list.length, 1);
  const id = list[0].id; assert.equal((await as('helper', 'PATCH', `admin/feedback/${id}`, { body: { status: 'resolved', admin_note: 'fixed in the prompt' } })).code, 200);
  assert.equal(db.feedback_reports.find((f) => f.id === id).status, 'resolved'); assert.equal(db.audit_log.at(-1).action, 'feedback.update');
  assert.equal((await as('helper', 'PATCH', `admin/feedback/${id}`, { body: { status: 'closed' } })).code, 400);
  assert.equal((await get('viewer', 'admin/feedback')).code, 403);
});
