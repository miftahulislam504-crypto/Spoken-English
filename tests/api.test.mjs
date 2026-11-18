// The /me/study API: input checking, row mapping, and a full save-and-restore against a small fake of the database service.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://fake.supabase.test'; process.env.SUPABASE_ANON_KEY = 'anon'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
const db = { mistake_records: [], review_queue: [], listening_progress: [], daily_activity: [], skill_assessments: [] };
const KEYS = { mistake_records: ['user_id', 'client_id'], review_queue: ['user_id', 'content_reference', 'review_type'], listening_progress: ['user_id', 'item_id'], daily_activity: ['user_id', 'day'] };
const calls = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url); const table = u.pathname.split('/').pop(); const method = opts.method || 'GET';
  calls.push(`${method} ${table}`);
  const auth = (opts.headers || {}).Authorization;
  if (u.pathname.startsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'u1', email: 'a@b.c' }), { status: 200 });
  if (method === 'GET') {
    let rows = db[table].filter((r) => r.user_id === 'u1');
    for (const [k, val] of u.searchParams) { if (val === 'not.is.null') rows = rows.filter((r) => r[k] != null); if (val.startsWith('eq.') && k !== 'user_id') rows = rows.filter((r) => String(r[k]) === val.slice(3)); }
    if (u.searchParams.get('assessed_at')) rows = rows.filter((r) => r.assessed_at >= u.searchParams.get('assessed_at').slice(4));
    return new Response(JSON.stringify(rows.map((r) => ({ ...r, updated_at: r.updated_at || new Date().toISOString() }))), { status: 200 });
  }
  if (method === 'POST') {
    assert.equal(auth, 'Bearer service', 'writes use the server key');
    const rows = JSON.parse(opts.body); const keys = KEYS[table];
    const first = Object.keys(rows[0]).sort().join(); rows.forEach((r) => assert.equal(Object.keys(r).sort().join(), first, 'every row has the same keys'));
    rows.forEach((r) => {
      if (!keys) { db[table].push({ ...r, assessed_at: new Date().toISOString() }); return; }
      const i = db[table].findIndex((x) => keys.every((k) => x[k] === r[k]));
      if (i >= 0) db[table][i] = { ...db[table][i], ...r }; else db[table].push({ ...r });
    });
    return new Response(null, { status: 201 });
  }
  return new Response(null, { status: 204 });
};

const { cleanStudy, mistakeFromRow, mistakeToRow } = await import('../api/_lib/study.js');
const { default: handler } = await import('../api/v1/[...path].js');
const { studyPayload, mergeStudy } = await import('../www/src/engine/studysync.js');
const ST = await import('../www/src/engine/study.js');
const M = await import('../www/src/engine/metrics.js');
const { speakMistakeId } = await import('../www/src/engine/mistakes.js');

const T0 = Date.now();
function call(method, path, body) {
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(o) { resolve({ code: this.code, body: o }); }, end() { resolve({ code: this.code, body: null }); } };
    handler({ method, query: { path: path.split('/') }, headers: { authorization: 'Bearer tok', 'x-forwarded-for': '1.1.1.1' }, body }, res);
  });
}
let s = { mistakes: [], review: {}, daily: {}, phrasebook: [], listen_progress: { ld1: { attempts: 2, best: 80, last_score: 80, last_at: T0 } }, speak_log: [] };
s = { ...s, ...ST.recordAnswer(s, { source: 'lesson', skill: 'grammar', correct: false, ref: 'l4:4', user: 'am', expected: 'is', prompt: 'Choose the correct word: He ___ my friend.' }, T0) };
s = { ...s, ...ST.recordSpeaking(s, { original_text: 'I go school', corrected_text: "I'm going to school.", error_type: 'preposition', explanation_bn: 'to যোগ করুন', alternative_text: '' }, T0) };
for (let i = 0; i < 6; i++) s.daily = M.addAnswer(s.daily, T0, 'listening', i % 2 === 0);

test('the phone payload passes the server checks, as it is', () => {
  const p = JSON.parse(JSON.stringify(studyPayload(s)));
  const c = cleanStudy(p);
  assert.equal(c.mistakes.length, 2); assert.equal(c.review.length, 2); assert.equal(c.listening.length, 1); assert.ok(c.activity.length >= 1); assert.ok(c.skills.length >= 1);
});

test('bad input is rejected with a clear error and nothing is saved', () => {
  const p = JSON.parse(JSON.stringify(studyPayload(s)));
  const rejects = (body, re) => assert.throws(() => cleanStudy(body), (e) => e.code === 'invalid_input' && re.test(e.details));
  rejects({ ...p, mistakes: [{ ...p.mistakes[0], kind: 'x' }] }, /kind is invalid/);
  rejects({ ...p, mistakes: [{ ...p.mistakes[0], count: 0 }] }, /count is invalid/);
  rejects({ ...p, review: [{ ...p.review[0], id: 'v:hello' }] }, /only mistake review items/);
  rejects({ ...p, activity: [{ day: '2026-13-45', data: {} }] }, /day is invalid/);
  rejects({ ...p, activity: [{ day: '2026-11-07', data: { ex: { grammar: [1, 5] } } }] }, /ex is invalid/);
  rejects({ ...p, mistakes: new Array(201).fill(p.mistakes[0]) }, /at most 200/);
  rejects('nope', /body must be an object/);
  rejects({ ...p, skills: [{ skill_type: 'pronunciation', confidence: 'low', n: 1, c: 1 }] }, /skill_type is invalid/);
});

test('row mapping is lossless in both directions', () => {
  const m = s.mistakes[0];
  const row = mistakeToRow('u1', m); assert.equal(row.client_id, m.id); assert.equal(row.occurrence_count, m.count);
  const back = mistakeFromRow(row); assert.deepEqual({ ...back, lesson_id: undefined }, { ...m, lesson_id: undefined, alternative: m.alternative || '', error_type: m.kind === 'speaking' ? m.error_type : null, resolved_by: null, explanation_bn: m.explanation_bn || '' });
  assert.equal(mistakeFromRow({ ...row, ref: 'l4:4' }).lesson_id, 'l4');
});

test('save, restore on a new phone, and a second save changes nothing', async () => {
  const payload = JSON.parse(JSON.stringify(studyPayload(s)));
  const put = await call('PUT', 'me/study', payload);
  assert.equal(put.code, 200, JSON.stringify(put.body)); assert.deepEqual(put.body.saved.mistakes, 2);
  assert.equal(db.mistake_records.length, 2); assert.equal(db.review_queue.length, 2); assert.equal(db.listening_progress.length, 1); assert.ok(db.daily_activity.length >= 1); assert.ok(db.skill_assessments.length >= 1);
  assert.ok(db.mistake_records.every((r) => r.user_id === 'u1' && r.client_id));
  const sp = db.mistake_records.find((r) => r.kind === 'speaking'); assert.equal(sp.client_id, speakMistakeId("I'm going to school."));
  const get = await call('GET', 'me/study');
  assert.equal(get.code, 200); assert.equal(get.body.mistakes.length, 2);
  const fresh = { mistakes: [], review: {}, listen_progress: {}, daily: {} };
  const restored = mergeStudy(fresh, get.body, T0);
  assert.equal(restored.mistakes.length, 2); assert.equal(Object.keys(restored.review).length, 2); assert.equal(restored.listen_progress.ld1.best, 80);
  assert.deepEqual(restored.daily[M.dayKey(T0)].ex.listening, s.daily[M.dayKey(T0)].ex.listening);
  const again = await call('PUT', 'me/study', JSON.parse(JSON.stringify(studyPayload({ ...s, ...restored }))));
  assert.equal(again.code, 200); assert.equal(db.mistake_records.length, 2); assert.equal(db.skill_assessments.length, new Set(db.skill_assessments.map((r) => r.skill_type)).size, 'at most one snapshot per skill in 20 hours');
});

test('a mistake resolved on one phone stays resolved after the other phone syncs', async () => {
  const resolved = { ...s, ...ST.markKnown(s, s.mistakes[0].id, T0 + 5000) };
  await call('PUT', 'me/study', JSON.parse(JSON.stringify(studyPayload(resolved))));
  const row = db.mistake_records.find((r) => r.client_id === s.mistakes[0].id);
  assert.ok(row.resolved_at); assert.equal(row.resolved_by, 'learner');
  assert.equal(db.review_queue.filter((r) => r.content_reference === 'm:' + s.mistakes[0].id).length, 1); // old row is kept but no longer sent back
  const get = await call('GET', 'me/study');
  const restored = mergeStudy({ mistakes: [], review: {}, listen_progress: {}, daily: {} }, get.body, T0 + 9000);
  assert.ok(restored.mistakes.find((m) => m.id === s.mistakes[0].id).resolved_at);
  assert.equal(restored.review['m:' + s.mistakes[0].id], undefined);
});

test('the endpoint needs sign-in and rejects bad bodies with 400', async () => {
  const res = { headers: {}, setHeader() {}, status(c) { this.code = c; return this; }, json(o) { this.out = o; }, end() {} };
  await handler({ method: 'GET', query: { path: ['me', 'study'] }, headers: {}, body: undefined }, res);
  assert.equal(res.code, 401);
  const bad = await call('PUT', 'me/study', { mistakes: [{ id: 'x' }] });
  assert.equal(bad.code, 400); assert.equal(bad.body.error.code, 'invalid_input');
});
