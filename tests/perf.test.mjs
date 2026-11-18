// Performance checks (plan section 17): download size, saved data size, how fast screens draw for a learner with a lot of history, and API speed.
// The limits leave room to grow but fail on a real regression. Run on a slow computer they may need loosening; the sizes never do.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
globalThis.window = { scrollY: 0, addEventListener() {} }; globalThis.document = { getElementById: () => null, addEventListener() {} }; globalThis.location = { hash: '' };
console.warn = () => {};
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'admin' ? [] : walk(join(d, e.name))) : [join(d, e.name)]));
const gz = (files) => files.reduce((n, f) => n + gzipSync(readFileSync(f)).length, 0);
const www = walk(new URL('../www', import.meta.url).pathname);

test('download size: the app a learner installs stays small (budgets are in KB after compression)', () => {
  const js = gz(www.filter((f) => f.endsWith('.js') && !f.includes('/content/'))); const content = gz(www.filter((f) => f.includes('/content/'))); const css = gz(www.filter((f) => f.endsWith('.css')));
  console.log(`      js ${(js / 1024).toFixed(1)} KB, lessons ${(content / 1024).toFixed(1)} KB, css ${(css / 1024).toFixed(1)} KB, total ${((js + content + css) / 1024).toFixed(1)} KB`);
  assert.ok(js <= 130 * 1024, `code is ${(js / 1024).toFixed(0)} KB, the budget is 130 KB`);
  assert.ok(content <= 60 * 1024, `lessons are ${(content / 1024).toFixed(0)} KB, the budget is 60 KB`);
  assert.ok(css <= 8 * 1024, `styles are ${(css / 1024).toFixed(0)} KB, the budget is 8 KB`);
  assert.ok(js + content + css <= 200 * 1024, 'everything together must stay under 200 KB');
});

const { getState, setState } = await import('../www/src/store.js');
const screens0 = await import('../www/src/screens.js'); const { review, mistakes } = await import('../www/src/review.js'); const { progress, weekly } = await import('../www/src/progress.js');
const { phrasebook } = await import('../www/src/vocabulary.js'); const { speakPick } = await import('../www/src/speak.js'); const { allLessons } = await import('../www/src/engine/lessons.js');
const { privacy } = await import('../www/src/privacy.js'); const { buildReview } = await import('../www/src/engine/review.js');
const ST = await import('../www/src/engine/study.js'); const { lessonToRows } = await import('../api/_lib/content.js');

// A learner who has used the app every day for four months.
const DAY = 86400000; const now = Date.now();
const heavy = () => {
  const lp = {}; allLessons().forEach((l) => { lp[l.id] = { status: 'completed', attempt_count: 3, score: 0.9, mastery_score: 0.9, completed_at: now - DAY, last_attempt_at: now - DAY, content_version: l.content_version, run: null }; });
  const daily = {}; for (let i = 0; i < 120; i++) { const d = new Date(now - i * DAY); daily[`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`] = { sec: 600, lc: 1, ex: 20, ok: 17, ss: 1, ls: 1, rv: 10, ts: 0 }; }
  const mk = Array.from({ length: 300 }, (_, i) => ({ id: 'm' + i, kind: 'step', ref: `l${(i % 31) + 1}:${i % 5}`, skill: 'grammar', lesson_id: `l${(i % 31) + 1}`, count: 2 + (i % 4), last_seen: now - i * 3600000, resolved_at: i % 3 ? null : now, original_text: 'I go to school yesterday', corrected_text: 'I went to school yesterday' }));
  const phrase = Array.from({ length: 300 }, (_, i) => ({ id: 'w' + i, en: 'phrase number ' + i, bn: 'অর্থ ' + i, example: 'Example sentence ' + i, source: i % 5 ? 'lesson' : 'custom', saved_at: now, in_review: true, recognition: { seen: 6, correct: 4 }, active: { used: 2, correct: 1 } }));
  const review_ = {}; for (let i = 0; i < 400; i++) review_['q' + i] = { id: 'q' + i, type: i % 2 ? 'vocab' : 'step', box: i % 6, due: now + (i - 200) * 3600000, reps: 5, lapses: 1, last: 1, last_at: now - DAY };
  const log = Array.from({ length: 200 }, (_, i) => ({ at: now - i * 8 * 3600000, mode: 'guided', scenario_id: 'greet', turns: 5, words: 40, goal_met: true, accuracy_pct: 80, avg_wpm: 70 }));
  return { onboarded: true, ob_step: 'done', level: 'A2', lesson_progress: lp, daily, mistakes: mk, phrasebook: phrase, review: review_, speak_log: log, skills: {}, best_streak: 40 };
};

test('saved data: four months of daily use fits easily in phone storage and loads quickly', () => {
  setState(heavy()); const raw = localStorage.getItem('se.state.v1');
  console.log(`      saved state ${(raw.length / 1024).toFixed(0)} KB`);
  assert.ok(raw.length < 600 * 1024, `the saved state is ${(raw.length / 1024).toFixed(0)} KB, the limit is 600 KB (phones allow about 5000 KB)`);
  const t0 = performance.now(); for (let i = 0; i < 20; i++) JSON.parse(raw); const per = (performance.now() - t0) / 20;
  assert.ok(per < 40, `reading the saved state takes ${per.toFixed(1)} ms`);
});

const avg = (f, n = 15) => { f(); const t0 = performance.now(); for (let i = 0; i < n; i++) f(); return (performance.now() - t0) / n; };
test('screens draw quickly even for a learner with a lot of history', () => {
  setState(heavy()); const s = getState(); const rows = [];
  const draw = { home: () => screens0.home(s), learn: () => screens0.learn(s), progress: () => progress(s), weekly: () => weekly(s), review: () => review(s), mistakes: () => mistakes(s), phrasebook: () => phrasebook(s), speak: () => speakPick(s, 'guided'), settings: () => screens0.settings(s), privacy: () => privacy(s) };
  Object.entries(draw).forEach(([n, f]) => { if (!f) return; const ms = avg(f); rows.push(`${n} ${ms.toFixed(1)}`); assert.ok(ms < 60, `${n} takes ${ms.toFixed(1)} ms to draw (limit 60)`); });
  console.log('      ms per screen: ' + rows.join(', '));
});

test('building a review session from 400 scheduled items is fast', () => { const s = getState(); const ms = avg(() => buildReview(s, now)); assert.ok(ms < 60, `${ms.toFixed(1)} ms`); assert.ok(ST.dueList); });

test('a full lesson set as a download stays small', () => {
  const lessons = allLessons(); const raw = JSON.stringify(lessons); const packed = gzipSync(raw).length;
  console.log(`      31 lessons: ${(raw.length / 1024).toFixed(0)} KB, ${(packed / 1024).toFixed(0)} KB compressed`);
  assert.ok(raw.length < 300 * 1024, 'the lesson download is under 300 KB'); assert.ok(lessons.every((l) => lessonToRows(l).exercises.length > 0));
});

// ---- server ----
const cloud = await import('./helpers/fakeCloud.mjs');
Object.assign(process.env, { SUPABASE_URL: 'https://fake.supabase.test', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', ANTHROPIC_API_KEY: 'k', OPENAI_API_KEY: 'k', OPS_TOKEN: 'ops' });
globalThis.fetch = cloud.fetch; console.error = () => {};
const { default: handler } = await import('../api/v1/[...path].js'); const { resetRateLimits } = await import('../api/_lib/http.js');
test('the server answers the common requests quickly (the database is pretend here, so this measures our own code)', async () => {
  cloud.reset(); resetRateLimits();
  const time = async (f, n = 20) => { await f(); const t0 = performance.now(); for (let i = 0; i < n; i++) { resetRateLimits(); await f(); } return (performance.now() - t0) / n; };
  const ev = { install_id: 'a'.repeat(32), events: Array.from({ length: 50 }, () => ({ name: 'app_opened', props: {} })) };
  const a = await time(() => cloud.call(handler, 'POST', 'events', { token: null, body: ev })); assert.ok(a < 40, `50 events take ${a.toFixed(1)} ms`);
  const b = await time(() => cloud.call(handler, 'GET', 'plans', { token: null })); assert.ok(b < 30, `plans take ${b.toFixed(1)} ms`);
  const c = await time(() => cloud.call(handler, 'GET', 'me/entitlement', { token: 'tok1' })); assert.ok(c < 40, `entitlement takes ${c.toFixed(1)} ms`);
  console.log(`      ms per request: 50 events ${a.toFixed(1)}, plans ${b.toFixed(1)}, entitlement ${c.toFixed(1)}`);
});
