// Phase 11 (server side): what a learner can download and delete, saved words, the nightly clean-up, and the promise that voice is never stored.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as cloud from './helpers/fakeCloud.mjs';

Object.assign(process.env, { SUPABASE_URL: 'https://fake.supabase.test', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', ANTHROPIC_API_KEY: 'k', OPENAI_API_KEY: 'k', OPS_TOKEN: 'ops-secret', CRON_SECRET: 'cron-secret' });
['AI_TURNS_PER_DAY', 'AI_PRICE_INPUT_PER_MTOK', 'AI_PRICE_OUTPUT_PER_MTOK', 'STT_PRICE_PER_MINUTE', 'AI_DAILY_BUDGET_USD', 'AI_MONTHLY_BUDGET_USD'].forEach((k) => delete process.env[k]);
globalThis.fetch = cloud.fetch; console.error = () => {};

const { default: handler } = await import('../api/v1/[...path].js');
const { resetRateLimits } = await import('../api/_lib/http.js');
const E = await import('../api/_lib/entitlements.js');
const P = await import('../api/_lib/plans.js');
const { mergeWords } = await import('../www/src/engine/merge.js');
const { db, call, PEOPLE } = cloud;
const ID = Object.fromEntries(PEOPLE.map((p) => [p.tok, p.id]));
const as = (tok, method, path, opts = {}) => call(handler, method, path, { token: tok, ...opts });
const fresh = () => { resetRateLimits(); cloud.reset(); P.clearPlanCache(); E.clearEntitlementCaches(); db.admin_roles = [{ user_id: ID.owner, role: 'owner' }]; };
const word = (id, over = {}) => ({ id, en: id, bn: 'অর্থ', example: `I say ${id}.`, source: 'lesson', in_review: true, recognition: { seen: 0, correct: 0 }, active: { used: 0, correct: 0 }, ...over });
const AUDIO = 'QVVESU9CWVRFUw=='.repeat(40); // pretend recording

test('voice is never stored: a spoken turn leaves no recording and no reference to one anywhere', async () => {
  fresh();
  const s = (await as('learner', 'POST', 'speaking/sessions', { body: { mode: 'repeat', scenario_id: 'phrases' } })).body;
  const r = await as('learner', 'POST', `speaking/sessions/${s.session_id}/turns`, { body: { kind: 'repeat', target_text: 'I like tea', audio: { data: AUDIO, mime: 'audio/webm', duration_ms: 3000 } }, headers: { 'idempotency-key': 'idem-key-00000001' } });
  assert.equal(r.code, 200); assert.equal(cloud.stt.calls, 1, 'the recording was used for transcription');
  const everything = JSON.stringify(db);
  assert.ok(!everything.includes(AUDIO.slice(0, 40)), 'no table holds the recording');
  assert.ok(db.conversation_turns.every((t) => !t.audio_reference), 'no turn points to a stored recording');
  assert.ok(!JSON.stringify(cloud.log).includes(AUDIO.slice(0, 40)));
});

test('download my data: everything under the account, nothing from anyone else, limited to three a hour', async () => {
  fresh();
  db.mistake_records.push({ user_id: ID.learner, client_id: 'm1', original_text: 'I go yesterday', corrected_text: 'I went yesterday' }, { user_id: ID.owner, client_id: 'm9', original_text: 'someone else' });
  db.saved_words.push({ user_id: ID.learner, client_id: 'tea', en: 'tea', bn: 'চা', example: null, custom: false, in_review: true, seen: 2, seen_correct: 1, used: 0, used_correct: 0, updated_at: new Date().toISOString() });
  db.feedback_reports.push({ id: 'f1', user_id: ID.learner, kind: 'bug', message: 'my report', context: {}, status: 'new', created_at: new Date().toISOString() });
  db.analytics_events.push({ id: 1, at: new Date().toISOString(), install_id: 'a'.repeat(16), user_id: ID.learner, name: 'app_opened', props: {} });
  const s = (await as('learner', 'POST', 'speaking/sessions', { body: { mode: 'guided', scenario_id: 'greet' } })).body;
  await as('learner', 'POST', `speaking/sessions/${s.session_id}/turns`, { body: { text: 'I like tea' }, headers: { 'idempotency-key': 'idem-key-00000002' } });
  const r = await as('learner', 'GET', 'me/export'); assert.equal(r.code, 200);
  const x = r.body; assert.equal(x.format_version, 1); assert.equal(x.account.email, 'learner@x.test');
  assert.ok(x.mistakes.some((m) => m.original_text === 'I go yesterday')); assert.ok(!JSON.stringify(x).includes('someone else'));
  assert.equal(x.saved_words[0].en, 'tea'); assert.equal(x.feedback_sent[0].message, 'my report'); assert.equal(x.usage_statistics_events.length, 1);
  assert.equal(x.speaking_sessions.length, 1); assert.ok(x.speaking_sessions[0].turns.some((t) => t.transcript === 'I like tea'), 'the learner\'s own words are included');
  assert.ok(!JSON.stringify(x).includes('"user_id"'), 'the id is not repeated on every row');
  assert.match(x.note, /never stored/);
  assert.equal((await as(null, 'GET', 'me/export')).code, 401);
  await as('learner', 'GET', 'me/export'); await as('learner', 'GET', 'me/export');
  assert.equal((await as('learner', 'GET', 'me/export')).code, 429, 'the fourth download in an hour is refused');
});

test('delete my speaking history: transcripts go, other learning data stays, other people are untouched', async () => {
  fresh();
  const a = (await as('learner', 'POST', 'speaking/sessions', { body: { mode: 'guided', scenario_id: 'greet' } })).body;
  await as('learner', 'POST', `speaking/sessions/${a.session_id}/turns`, { body: { text: 'I like tea' }, headers: { 'idempotency-key': 'idem-key-00000003' } });
  const b = (await as('owner', 'POST', 'speaking/sessions', { body: { mode: 'guided', scenario_id: 'greet' } })).body;
  db.mistake_records.push({ user_id: ID.learner, client_id: 'm1', original_text: 'x' });
  assert.ok(db.conversation_sessions.length === 2);
  const r = await as('learner', 'DELETE', 'me/speaking-history'); assert.equal(r.code, 200); assert.equal(r.body.deleted_sessions, 1);
  assert.deepEqual(db.conversation_sessions.map((s) => s.user_id), [ID.owner]); assert.ok(db.mistake_records.some((m) => m.client_id === 'm1'), 'mistakes are learning data, not speaking history');
  assert.equal(b.session_id, db.conversation_sessions[0].id);
});

test('saved words: merged without losing progress, removals travel, limits are enforced', async () => {
  const phone = [word('tea', { recognition: { seen: 5, correct: 4 } }), word('rice', { source: 'custom', in_review: false })];
  const acct = [word('tea', { recognition: { seen: 9, correct: 2 }, active: { used: 3, correct: 3 } }), word('milk')];
  const m = mergeWords(phone, acct); const tea = m.find((w) => w.id === 'tea');
  assert.deepEqual(tea.recognition, { seen: 9, correct: 4 }, 'counters only go up'); assert.deepEqual(tea.active, { used: 3, correct: 3 });
  assert.equal(m.find((w) => w.id === 'rice').in_review, false, 'the phone\'s own switch wins'); assert.equal(m.length, 3);

  fresh();
  let r = await as('learner', 'PUT', 'me/words', { body: { words: [word('tea'), word('rice', { source: 'custom' })] } }); assert.equal(r.code, 200); assert.equal(r.body.saved, 2);
  r = await as('learner', 'PUT', 'me/words', { body: { words: [word('tea', { recognition: { seen: 3, correct: 3 } })], removed: ['rice'] } });
  const rows = db.saved_words.filter((w) => w.user_id === ID.learner); assert.deepEqual(rows.map((w) => w.client_id), ['tea']); assert.equal(rows[0].seen, 3);
  r = await as('learner', 'GET', 'me/words'); assert.equal(r.body.words[0].id, 'tea'); assert.deepEqual(r.body.words[0].recognition, { seen: 3, correct: 3 });
  assert.equal((await as('learner', 'PUT', 'me/words', { body: { words: [word('x', { recognition: { seen: 1, correct: 2 } })] } })).code, 400, 'correct cannot exceed seen');
  assert.equal((await as('learner', 'PUT', 'me/words', { body: { words: [word('x'.repeat(200))] } })).code, 400);
  assert.equal((await as('learner', 'PUT', 'me/words', { body: { words: Array.from({ length: 301 }, (_, i) => word('w' + i)) } })).code, 400);
  assert.equal((await as('owner', 'GET', 'me/words')).body.words.length, 0, 'one person never sees another\'s words');
});

test('delete my account: needs the confirmation word, removes everything, keeps only an anonymous record, and never strands the dashboard', async () => {
  fresh();
  assert.equal((await as('learner', 'DELETE', 'me')).code, 400, 'no confirmation, no deletion');
  assert.equal((await as('learner', 'DELETE', 'me', { body: { confirm: 'yes' } })).code, 400);
  db.mistake_records.push({ user_id: ID.learner, client_id: 'm1' }); db.saved_words.push({ user_id: ID.learner, client_id: 'tea' }); db.analytics_events.push({ id: 5, at: new Date().toISOString(), install_id: 'b'.repeat(16), user_id: ID.learner, name: 'app_opened', props: {} });
  const r = await as('learner', 'DELETE', 'me', { body: { confirm: 'DELETE' } }); assert.equal(r.code, 204);
  assert.ok(!db.profiles.some((p) => p.id === ID.learner)); assert.equal(db.mistake_records.length, 0); assert.equal(db.saved_words.length, 0); assert.equal(db.analytics_events.length, 0);
  const a = db.audit_log.at(-1); assert.equal(a.action, 'account.deleted'); assert.ok(!JSON.stringify(a).includes(ID.learner), 'the record cannot be traced back to the person'); assert.equal(a.actor_id, undefined);
  assert.equal((await as('owner', 'DELETE', 'me', { body: { confirm: 'DELETE' } })).code, 409, 'the only owner must hand over first');
  assert.ok(db.profiles.some((p) => p.id === ID.owner));
  db.admin_roles.push({ user_id: ID.editor, role: 'owner' });
  assert.equal((await as('owner', 'DELETE', 'me', { body: { confirm: 'DELETE' } })).code, 204, 'with another owner it is allowed');
});

test('nightly clean-up: needs the secret, removes only what is past its time, honours the settings, and records that it ran', async () => {
  fresh(); const day = 86400000; const old = new Date(Date.now() - 200 * day).toISOString(); const recent = new Date(Date.now() - 5 * day).toISOString();
  db.analytics_events.push({ id: 1, at: old, install_id: 'a'.repeat(16), name: 'app_opened', props: {} }, { id: 2, at: recent, install_id: 'a'.repeat(16), name: 'app_opened', props: {} });
  db.conversation_turns.push({ id: 't1', session_id: 's', created_at: new Date(Date.now() - 100 * day).toISOString(), transcript: 'old words' }, { id: 't2', session_id: 's', created_at: recent, transcript: 'new words' });
  assert.equal((await as(null, 'GET', 'ops/maintenance')).code, 401); assert.equal((await as('nope', 'GET', 'ops/maintenance')).code, 401);
  const r = await as(null, 'GET', 'ops/maintenance', { token: 'cron-secret' }); assert.equal(r.code, 200);
  assert.deepEqual(db.analytics_events.map((e) => e.id), [2]); assert.deepEqual(db.conversation_turns.map((e) => e.id), ['t2']);
  assert.equal(r.body.removed.analytics_events, 1); assert.deepEqual(r.body.days, { analytics: 180, transcript: 90, webhook: 180, feedback: 365 });
  assert.ok(db.app_settings.find((s) => s.key === 'maintenance_last_run').value.at);
  assert.equal((await as(null, 'GET', 'ops/health', { token: 'ops-secret' })).body.checks.find((c) => c.name === 'nightly clean-up').ok, true);
  db.app_settings.push({ key: 'retention_analytics_days', value: 2 }, { key: 'retention_transcript_days', value: 'forever' });
  const r2 = await as(null, 'GET', 'ops/maintenance', { token: 'ops-secret' });
  assert.equal(r2.body.days.analytics, 180, 'a value that is too small is ignored, so a typo cannot wipe data'); assert.equal(r2.body.days.transcript, 90, 'a wrong value falls back to the default');
  db.app_settings.find((s) => s.key === 'retention_analytics_days').value = 30;
  assert.equal((await as(null, 'GET', 'privacy-policy')).body.retention_days.usage_statistics, 30);
});

test('privacy facts for the screen are public and say that audio is not stored', async () => {
  fresh(); const r = await as(null, 'GET', 'privacy-policy');
  assert.equal(r.code, 200); assert.equal(r.body.audio_stored, false); assert.deepEqual(Object.keys(r.body.retention_days).sort(), ['payment_notifications', 'resolved_feedback', 'speaking_transcripts', 'usage_statistics']);
});
