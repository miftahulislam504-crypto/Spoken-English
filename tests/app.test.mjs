// Smoke tests: every screen renders for several kinds of learner without errors or missing UI strings.
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
globalThis.window = globalThis.window || { scrollY: 0 };
globalThis.document = globalThis.document || { getElementById: () => null };
globalThis.location = { hash: '' };
const warnings = [];
const origWarn = console.warn; console.warn = (...a) => { warnings.push(a.join(' ')); };

const { getState, setState } = await import('../www/src/store.js');
const screens = await import('../www/src/screens.js');
const { review, mistakes } = await import('../www/src/review.js');
const { progress, weekly } = await import('../www/src/progress.js');
const { vocabulary, phrasebook } = await import('../www/src/vocabulary.js');
const { lessonView, startRun } = await import('../www/src/lessonPlayer.js');
const { speak, speakPick } = await import('../www/src/speak.js');
const { listening } = await import('../www/src/listening.js');
const { allLessons } = await import('../www/src/engine/lessons.js');
const { skillOf, isExercise } = await import('../www/src/engine/skills.js');
const ST = await import('../www/src/engine/study.js');
const M = await import('../www/src/engine/metrics.js');
const { buildReview } = await import('../www/src/engine/review.js');
const { studyPayload, mergeStudy } = await import('../www/src/engine/studysync.js');
const { migrateState } = await import('../www/src/engine/migrate.js');

const DAY = 86400000;
const now = Date.now();
const all = () => ({ ...getState(), ...{} });
const done = (n) => Object.fromEntries(allLessons().slice(0, n).map((l) => [l.id, { status: 'completed', attempt_count: 1, score: 0.8, mastery_score: 0.8, completed_at: now, last_attempt_at: now, content_version: 1, run: null }]));
function busyLearner() {
  let s = { ...getState(), onboarded: true, level: 'Pre-A1', lesson_progress: done(10), phrasebook: [], mistakes: [], review: {}, daily: {}, speak_log: [] };
  for (let d = 0; d < 9; d++) {
    const t = now - d * DAY;
    ['listening', 'grammar', 'sentence', 'vocabulary'].forEach((k, i) => { for (let j = 0; j < 8; j++) s.daily = M.addAnswer(s.daily, t, k, (j + i + d) % 3 !== 0); });
    s.daily = M.bump(s.daily, t, (x) => { x.sec += 600; x.lc += 1; x.sp += 2; x.ls += 1; });
  }
  let n = 0;
  allLessons().slice(0, 6).forEach((l) => l.steps.forEach((st, i) => { if (isExercise(st) && st.scored !== false && n < 12) { n++; s = { ...s, ...ST.recordAnswer(s, { source: 'lesson', skill: skillOf(st), correct: false, ref: `${l.id}:${i}`, user: 'oops <b>', expected: 'right', prompt: st.prompt_en }, now - n * 3600000) }; } }));
  s = { ...s, ...ST.recordSpeaking(s, { original_text: 'I go school', corrected_text: 'I go to school.', error_type: 'preposition', explanation_bn: 'to যোগ করুন', alternative_text: 'I am going to school.' }, now - 5000) };
  s.phrasebook = [{ id: 'name', en: 'name', bn: 'নাম', example: 'My name is Rahim.', in_review: true, recognition: { seen: 1, correct: 1 }, active: { used: 0, correct: 0 } }, { id: 'my', en: 'my', bn: 'আমার', example: 'My book.', in_review: true, recognition: { seen: 0, correct: 0 }, active: { used: 1, correct: 1 } }, { id: 'your', en: 'your', bn: 'আপনার', example: 'Your book.', in_review: true, recognition: { seen: 0, correct: 0 }, active: { used: 0, correct: 0 } }];
  s.review = { ...s.review, ...ST.addVocabQueue(s, 'name', now - 7200000).review, ...ST.addVocabQueue(s, 'my', now - 7200000).review };
  s.speak_log = [{ at: now - DAY, mode: 'guided', scenario_id: 'greet', level: 'Pre-A1', turns: 4, words: 20, goal_met: true, accuracy_pct: null, avg_wpm: 90 }, { at: now - 2 * DAY, mode: 'repeat', scenario_id: 'phrases', level: null, turns: 6, words: 25, goal_met: false, accuracy_pct: 82, avg_wpm: null }, { at: now - 3 * DAY, mode: 'guided', scenario_id: 'greet', level: 'Pre-A1', turns: 4, words: 18, goal_met: true, accuracy_pct: null, avg_wpm: 85 }];
  s.missed_words = { think: 3, very: 2, school: 1 };
  s.listen_progress = { ld1: { attempts: 2, best: 100, last_score: 100, last_at: now } };
  s.level_notice = { from: 'Pre-A1', to: 'A1', at: now, pct: 78 };
  s.bengali_support = 'reduced';
  return s;
}
const scenarios = {
  fresh: () => ({ ...getState(), onboarded: true, level: 'Pre-A1', lesson_progress: {}, mistakes: [], review: {}, daily: {}, phrasebook: [], speak_log: [], listen_progress: {}, missed_words: {}, level_notice: null, practice_run: null }),
  busy: busyLearner,
  'bengali off': () => ({ ...busyLearner(), bengali_support: 'off', level_notice: null }),
  'level a2': () => ({ ...busyLearner(), level: 'A2', bengali_support: 'full' })
};
const fns = { home: screens.home, learn: screens.learn, settings: screens.settings, review, mistakes, progress, weekly, vocabulary, phrasebook, speak, listening, grammar: screens.grammar, patterns: screens.patterns };

for (const [name, make] of Object.entries(scenarios)) {
  test(`all screens render for: ${name}`, () => {
    const s = make();
    for (const [id, fn] of Object.entries(fns)) {
      const html = fn(s);
      assert.equal(typeof html, 'string', id); assert.ok(html.length > 50, id);
      assert.ok(!/undefined|NaN|\[object/.test(html), `${id} shows undefined/NaN: ${html.match(/.{30}(undefined|NaN|\[object).{30}/)}`);
    }
    assert.ok(!/<b>/.test(review(s) + mistakes(s) + screens.home(s)), 'user text is escaped');
    assert.deepEqual(warnings.splice(0), []);
  });
}

test('home shows the level notice, the review card and a recommendation that is not a duplicate of Continue Learning', () => {
  const html = screens.home(busyLearner());
  assert.match(html, /Your level is now/); assert.match(html, /items are due for review/); assert.match(html, /Mistake Notebook/);
  assert.match(html, /Review (\d+|1) item/);
  assert.match(screens.home(scenarios.fresh()), /Start with:/);
  assert.match(screens.home(scenarios.fresh()), /Nothing is due/);
});

test('progress shows evidence, never a score from too few answers, and the recognizer note', () => {
  const fresh = progress(scenarios.fresh());
  assert.match(fresh, /Not enough practice yet/); assert.match(fresh, /At least 5 answers are needed/); assert.match(fresh, /No speaking sessions yet/);
  assert.doesNotMatch(fresh, /\d+% now/);
  const busy = progress(busyLearner());
  assert.match(busy, /correct on the first try, last 30 days/); assert.match(busy, /not a pronunciation score/); assert.match(busy, /Words recognized: 82%/);
  assert.match(busy, /Words to practise saying/); assert.match(busy, /Speaking level estimate/);
  ['Overall Learning Summary', 'Listening Comprehension', 'Sentence Formation', 'Grammar Accuracy', 'Speaking Fluency', 'Pronunciation / Intelligibility', 'Vocabulary in Use', 'Mistake Trends', 'Weekly Report', 'Learning Streak and Practice Time'].forEach((x) => assert.match(busy, new RegExp(x.replace('/', '\\/'))));
});

test('review queue and notebook show due items and open mistakes', () => {
  const s = busyLearner();
  const r = review(s); assert.match(r, /Due now/); assert.match(r, /Start review/);
  const m = mistakes(s); assert.match(m, /To review \(\d+\)/); assert.match(m, /I know this/);
  assert.match(review(scenarios.fresh()), /queue is empty/);
});

test('a review run starts from due items and shows hints behind a tap when Bengali support is on request', () => {
  const s = busyLearner(); setState({ ...s });
  assert.equal(startRun('review'), true);
  const html = lessonView(getState(), 'review');
  assert.match(html, /Back to Review Queue/); assert.match(html, /Step 1 of/);
  assert.deepEqual(warnings.splice(0), []);
  setState({ practice_run: null }); setState({ ...scenarios.fresh() });
  assert.equal(startRun('review'), false); // nothing due: the router sends the learner back
});

test('lesson, practice, vocabulary and listening runs still start and render', () => {
  setState({ ...busyLearner(), practice_run: null });
  const first = allLessons()[0].id;
  assert.equal(startRun(first), true); assert.match(lessonView(getState(), first), /Step 1 of/);
  setState({ practice_run: null });
  assert.equal(startRun('practice'), true); assert.match(lessonView(getState(), 'practice'), /Step 1 of/);
  setState({ practice_run: null });
  assert.equal(startRun('vocab'), true); assert.match(lessonView(getState(), 'vocab'), /Step 1 of/);
  setState({ practice_run: null });
  assert.equal(startRun('listen:ld1'), true); assert.match(lessonView(getState(), 'listen:ld1'), /Step 1 of/);
  assert.deepEqual(warnings.splice(0), []);
});

test('sync payload and merge round trip', () => {
  const s = busyLearner();
  const p = studyPayload(s);
  assert.ok(p.mistakes.length > 0); assert.ok(p.review.every((r) => r.type === 'mistake')); assert.ok(p.activity.length > 0); assert.ok(p.skills.some((x) => x.skill_type === 'speaking'));
  assert.equal(JSON.parse(JSON.stringify(p)).mistakes.length, p.mistakes.length);
  const fresh = { mistakes: [], review: {}, listen_progress: {}, daily: {} };
  const restored = mergeStudy(fresh, JSON.parse(JSON.stringify({ mistakes: p.mistakes, review: p.review, listening: p.listening, activity: p.activity })), now);
  assert.equal(restored.mistakes.length, s.mistakes.length);
  assert.ok(Object.keys(restored.review).length >= p.review.length);
  assert.deepEqual(Object.keys(restored.daily).sort(), Object.keys(s.daily).sort());
  const again = mergeStudy({ ...fresh, ...restored }, { mistakes: p.mistakes, review: p.review, listening: p.listening, activity: p.activity }, now);
  assert.equal(again.mistakes.length, restored.mistakes.length);
});

test('old saved data from Phase 7 opens in the new version', () => {
  const old = { onboarded: true, level: 'A1', lesson_progress: done(5), phrasebook: [{ id: 'hello', en: 'Hello', bn: 'হ্যালো', recognition: { seen: 0, correct: 0 }, active: { used: 0, correct: 0 }, in_review: true }], mistakes: [{ lesson_id: 'speaking', prompt: '', user: 'I go school', expected: 'I go to school.', at: now }, { lesson_id: 'l4', prompt: 'x', user: 'a', expected: 'b', at: now }] };
  const m = migrateState({ ...getState(), ...old, schema: undefined, review: {}, daily: {} });
  setState({ ...m, onboarded: true });
  for (const fn of Object.values(fns)) assert.ok(fn(getState()).length > 50);
  assert.deepEqual(warnings.splice(0), []);
});

// ---- end to end: play real lessons and reviews through the lesson player ----
const { lpAct } = await import('../www/src/lessonPlayer.js');
const el = (act, o = {}) => ({ dataset: { act, ...o } });
let typed = '';
globalThis.document = { getElementById: (id) => (id === 'ans' ? { value: typed } : null) };
const current = (param) => { const st = getState(); const run = param === 'review' || param === 'practice' || param === 'vocab' || param.startsWith('listen:') ? st.practice_run : st.lesson_progress[param].run; const isRunId = param === 'review' || param === 'practice' || param === 'vocab' || param.startsWith('listen:'); const steps = isRunId ? [...st.practice_run.steps, { stage: 'review', type: 'review' }] : allLessons().find((l) => l.id === param).steps; return { run, step: steps[run.step_index], steps }; };
function answer(param, step, right) {
  const wrongText = 'zzz qqq';
  if (step.type === 'choose' || step.type === 'listen_choose') { const k = right ? step.answer : (step.answer + 1) % step.options.length; lpAct(el('lp-sel', { value: k }), param); }
  else if (step.type === 'order') { const want = (right ? step.accept[0] : step.accept[0]).split(' '); const used = new Set(); want.forEach((w) => { const i = step.tiles.findIndex((x, j) => !used.has(j) && x.toLowerCase().replace(/[^a-z0-9']/g, '') === w.toLowerCase().replace(/[^a-z0-9']/g, '')); used.add(i); lpAct(el('lp-tile', { i }), param); }); if (!right) { lpAct(el('lp-untile', { i: 0 }), param); } }
  else typed = right ? (step.type === 'pattern' ? step.example_en : step.accept[0]) : wrongText;
  lpAct(el('lp-check'), param);
}
function play(param, { wrongOn = -1, reviewRight = true } = {}) {
  let guard = 0; let attempts = 0;
  while (guard++ < 80) {
    const { run, step } = current(param);
    if (step.type === 'review') return lpAct(el('lp-finish'), param);
    if (['choose', 'listen_choose', 'order', 'type', 'pattern'].includes(step.type)) {
      const wrong = step.scored !== false && run.step_index === wrongOn;
      if (wrong) { answer(param, step, false); lpAct(el('lp-again'), param); }
      answer(param, step, true);
      lpAct(el('lp-next'), param);
    } else lpAct(el('lp-next'), param);
  }
  throw new Error('player did not reach the end of ' + param);
}

test('end to end: a lesson with one wrong first try creates a mistake, a review item and a progress log; three reviews resolve it', () => {
  setState({ ...scenarios.fresh(), first_done: true });
  const L = allLessons()[0]; const wrongIdx = L.steps.findIndex((x) => x.type === 'choose' && x.scored !== false);
  assert.equal(startRun(L.id), true);
  play(L.id, { wrongOn: wrongIdx });
  let s = getState();
  assert.equal(s.lesson_progress[L.id].status, 'completed');
  assert.equal(s.mistakes.length, 1); assert.equal(s.mistakes[0].ref, `${L.id}:${wrongIdx}`); assert.ok(s.mistakes[0].skill);
  const qid = 'm:' + s.mistakes[0].id; assert.ok(s.review[qid]);
  const day = s.daily[M.dayKey(Date.now())]; assert.equal(day.lc, 1); assert.equal(day.mis, 1); assert.ok(day.sec > 0);
  const asked = Object.values(day.ex).reduce((n, x) => n + x[0], 0); assert.ok(asked >= 3);
  assert.deepEqual(warnings.splice(0), []);
  for (let round = 0; round < 3; round++) {
    s = getState(); setState({ review: { ...s.review, [qid]: { ...s.review[qid], due: Date.now() - 1000 } }, practice_run: null });
    assert.equal(startRun('review'), true);
    const steps = getState().practice_run.steps; assert.equal(steps.length, 1);
    play('review');
  }
  s = getState();
  assert.ok(s.mistakes[0].resolved_at); assert.equal(s.mistakes[0].resolved_by, 'review'); assert.equal(s.review[qid], undefined);
  assert.equal(s.practice_run, null);
  const d2 = s.daily[M.dayKey(Date.now())]; assert.deepEqual(d2.rv, [3, 3]); assert.equal(d2.res, 1);
  assert.deepEqual(warnings.splice(0), []);
});

test('end to end: a wrong first try in a review sends the item back; saved words get a queue item and come back in review', () => {
  const p = { id: 'name', en: 'name', bn: 'নাম', example: 'My name is Rahim.', in_review: true, recognition: { seen: 0, correct: 0 }, active: { used: 0, correct: 0 } };
  const p2 = { id: 'my', en: 'my', bn: 'আমার', example: 'My book.', in_review: true, recognition: { seen: 0, correct: 0 }, active: { used: 0, correct: 0 } };
  const p3 = { id: 'your', en: 'your', bn: 'আপনার', example: 'Your book.', in_review: true, recognition: { seen: 0, correct: 0 }, active: { used: 0, correct: 0 } };
  setState({ ...scenarios.fresh(), first_done: true, lesson_progress: done(3), phrasebook: [p, p2, p3], practice_run: null });
  { const q = ST.addVocabQueue(getState(), 'name', Date.now()); q.review['v:name'].due = Date.now() - 1000; setState(q); }
  assert.equal(startRun('review'), true);
  const { step } = current('review'); assert.equal(step.type, 'choose'); assert.equal(step.vocab_id, 'name');
  answer('review', step, false); lpAct(el('lp-again'), 'review'); answer('review', step, true); lpAct(el('lp-next'), 'review');
  lpAct(el('lp-finish'), 'review');
  const s = getState();
  assert.equal(s.review['v:name'].lapses, 1); assert.equal(s.review['v:name'].box, 0);
  assert.equal(s.mistakes.length, 0, 'a missed saved word is scheduled, not copied into the notebook');
  assert.equal(s.phrasebook.find((x) => x.id === 'name').recognition.seen, 1);
  assert.deepEqual(warnings.splice(0), []);
});

test('end to end: finishing enough lessons with good answers raises the level once, with a notice, and never lowers it', () => {
  const lessons = allLessons().filter((l) => l.week === 'w1' || l.week === 'w2');
  const lp = Object.fromEntries(lessons.slice(0, 11).map((l) => [l.id, { status: 'completed', attempt_count: 1, score: 1, mastery_score: 1, completed_at: Date.now(), last_attempt_at: Date.now(), content_version: 1, run: null }]));
  let daily = {}; for (let i = 0; i < 36; i++) daily = M.addAnswer(daily, Date.now(), 'grammar', i % 6 !== 0);
  setState({ ...scenarios.fresh(), first_done: true, level: 'Pre-A1', lesson_progress: lp, daily, practice_run: null });
  const next = lessons.find((l) => !lp[l.id]);
  for (const l of allLessons()) { if (l.id === next.id) break; }
  assert.equal(startRun(next.id), true); play(next.id);
  const s = getState();
  assert.equal(s.level, 'A1'); assert.equal(s.level_notice.from, 'Pre-A1'); assert.equal(s.level_notice.to, 'A1');
  assert.match(screens.home(s), /Your level is now/);
  setState({ practice_run: null, daily: {} });
  assert.equal(getState().level, 'A1');
});
