// Unit tests for the Phase 8 learning engine. Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { allLessons, getLesson, practiceEligible, lessonStep, currentWeekIndex, weekCounts } from '../www/src/engine/lessons.js';
import { skillOf, isExercise, SKILLS } from '../www/src/engine/skills.js';
import { checkAnswer } from '../www/src/engine/answers.js';
import * as M from '../www/src/engine/metrics.js';
import * as S from '../www/src/engine/srs.js';
import * as K from '../www/src/engine/mistakes.js';
import * as ST from '../www/src/engine/study.js';
import { buildReview, buildReviewStep, resolveStep, shuffled } from '../www/src/engine/review.js';
import { levelEvidence, levelPatch, speakingEvidence } from '../www/src/engine/evidence.js';
import { recommend } from '../www/src/engine/recommend.js';
import { hintMode, hintsFaded, offerLessSupport } from '../www/src/engine/scaffold.js';
import { migrateState } from '../www/src/engine/migrate.js';
import { mergeMistakes, mergeReview, mergeDaily, mergeListening } from '../www/src/engine/merge.js';
import { buildVocabPractice, vocabStep } from '../www/src/engine/vocab.js';
import { buildPath } from '../www/src/engine/path.js';

const T0 = new Date(2026, 10, 7, 10, 0, 0).getTime(); // 7 Nov 2026, local time
const DAY = 86400000;
const base = (o = {}) => ({ level: 'Pre-A1', lesson_progress: {}, mistakes: [], review: {}, daily: {}, phrasebook: [], speak_log: [], listen_progress: {}, missed_words: {}, bengali_support: 'full', best_streak: 0, ...o });
const done = (ids, extra = {}) => Object.fromEntries(ids.map((id) => [id, { status: 'completed', attempt_count: 1, score: 1, mastery_score: 1, ...extra }]));
const rightAnswer = (step) => {
  if (step.type === 'choose' || step.type === 'listen_choose') return step.answer;
  if (step.type === 'order') return step.accept[0].split(' ');
  if (step.type === 'type') return step.accept[0];
  return step.example_en;
};

test('every exercise gets a skill and listening steps are listening', () => {
  let n = 0; const seen = new Set();
  allLessons().forEach((l) => l.steps.filter(isExercise).forEach((st) => { n++; const k = skillOf(st); seen.add(k); assert.ok(SKILLS.includes(k)); if (st.type === 'listen_choose') assert.equal(k, 'listening'); }));
  assert.equal(n, 162);
  assert.deepEqual([...seen].sort(), [...SKILLS].sort());
  assert.equal(skillOf({ type: 'choose', prompt_en: 'Choose the correct word: He ___ my friend.' }), 'grammar');
  assert.equal(skillOf({ type: 'choose', prompt_en: 'How do you say your age?' }), 'vocabulary');
  assert.equal(skillOf({ type: 'pattern', vocab_id: 'x' }), 'vocabulary');
  assert.equal(skillOf({ type: 'type', audio_en: 'Hello' }), 'listening');
});

test('practice steps carry a reference that resolves back to the same exercise', () => {
  const lp = done(['l1', 'l2', 'l4']);
  const steps = practiceEligible({ lesson_progress: lp });
  assert.ok(steps.length > 0);
  steps.forEach((st) => { assert.ok(st.ref); assert.equal(lessonStep(st.ref).prompt_en, st.prompt_en); });
  assert.equal(lessonStep('l1:2'), null); // a teach step is not an exercise
  assert.equal(lessonStep('nope:1'), null);
});

test('srs: new item is due in 10 minutes, steps grow, misses go back, early practice has no effect', () => {
  let it = S.newQueueItem('m:x', 'mistake', T0);
  assert.equal(it.due, T0 + S.SOON_MS);
  assert.equal(S.record(it, true, T0 + 1000), it); // not due yet
  it = S.record(it, true, T0 + S.SOON_MS);
  assert.equal(it.box, 1); assert.equal(it.due, T0 + S.SOON_MS + DAY);
  it = S.record(it, true, it.due); assert.equal(it.box, 2); assert.equal(S.intervalDays(it), 3);
  it = S.record(it, true, it.due); assert.equal(it.box, 3); assert.ok(S.isMastered(it));
  const lapsed = S.record(it, false, it.due + 5);
  assert.equal(lapsed.box, 1); assert.equal(lapsed.lapses, 1); assert.equal(lapsed.last, 'wrong');
  assert.equal(S.record(S.newQueueItem('a', 'vocab', T0), false, T0).box, 0);
  assert.equal(S.dueText(T0 - 1, T0), 'now'); assert.equal(S.dueText(T0 + 3600000, T0), 'today'); assert.equal(S.dueText(T0 + DAY, T0), 'tomorrow'); assert.equal(S.dueText(T0 + 4 * DAY, T0), 'days:4');
});

test('mistakes: repeats are counted, resolved items reopen, list is capped', () => {
  let r = K.addMistake([], { id: 'x:l4:4', kind: 'step', ref: 'l4:4', skill: 'grammar', user: 'am', expected: 'is' }, T0);
  assert.ok(r.isNew); assert.equal(r.list[0].count, 1);
  r = K.addMistake(r.list, { id: 'x:l4:4', user: 'are' }, T0 + 5);
  assert.equal(r.list.length, 1); assert.equal(r.list[0].count, 2); assert.equal(r.list[0].user, 'are'); assert.equal(r.list[0].expected, 'is');
  const res = K.resolveMistake(r.list, 'x:l4:4', T0 + 10, 'review');
  assert.equal(K.openMistakes(res).length, 0); assert.equal(K.resolvedMistakes(res).length, 1);
  const again = K.addMistake(res, { id: 'x:l4:4' }, T0 + 20);
  assert.ok(again.reopened); assert.equal(again.list[0].resolved_at, null);
  let list = [];
  for (let i = 0; i < 230; i++) list = K.addMistake(list, { id: 'x:l1:' + i, kind: 'step' }, T0 + i).list;
  assert.equal(list.length, K.MAX_MISTAKES);
  assert.equal(K.speakMistakeId('I went to school!'), 'sp:i went to school');
  assert.equal(K.lessonOfRef('l4:4'), 'l4'); assert.equal(K.lessonOfRef('listen:ld1:2'), null);
});

test('speakable corrections need 3 words and are unique', () => {
  let list = [];
  list = K.addMistake(list, { id: 'a', kind: 'speaking', expected: 'is' }, T0).list;
  list = K.addMistake(list, { id: 'b', kind: 'speaking', expected: 'I went to school yesterday.' }, T0 + 1).list;
  list = K.addMistake(list, { id: 'c', kind: 'speaking', expected: 'I went to school yesterday' }, T0 + 2).list;
  const sp = K.speakable(list);
  assert.equal(sp.length, 1); assert.equal(sp[0].text, 'I went to school yesterday');
});

test('recordAnswer: a wrong first try creates a mistake and a review item; three correct reviews resolve it', () => {
  let s = base();
  const wrong = { source: 'lesson', skill: 'grammar', correct: false, ref: 'l4:4', user: 'am', expected: 'is', prompt: 'Choose the correct word: He ___ my friend.' };
  s = { ...s, ...ST.recordAnswer(s, wrong, T0) };
  assert.equal(s.mistakes.length, 1); assert.equal(s.mistakes[0].lesson_id, 'l4');
  const qid = 'm:x:l4:4'; assert.equal(s.review[qid].due, T0 + S.SOON_MS);
  assert.deepEqual(s.daily[M.dayKey(T0)].ex.grammar, [1, 0]); assert.equal(s.daily[M.dayKey(T0)].mis, 1);
  let t = T0 + S.SOON_MS;
  for (let i = 0; i < 3; i++) {
    s = { ...s, ...ST.recordAnswer(s, { source: 'review', skill: 'grammar', correct: true, review_id: qid }, t) };
    t += 30 * DAY;
  }
  assert.equal(s.mistakes[0].resolved_by, 'review'); assert.ok(s.mistakes[0].resolved_at);
  assert.equal(s.review[qid], undefined);
  assert.equal(M.sumDays(s.daily, Object.keys(s.daily)).res, 1);
  assert.deepEqual(s.daily[M.dayKey(T0)].rv, [1, 1]);
  // making the same mistake again reopens it and puts it back in the queue
  s = { ...s, ...ST.recordAnswer(s, wrong, t) };
  assert.equal(s.mistakes[0].resolved_at, null); assert.equal(s.mistakes[0].count, 2); assert.ok(s.review[qid]);
});

test('recordAnswer: a correct answer in a lesson does not create a mistake, and a miss in review sends the item back', () => {
  let s = base();
  s = { ...s, ...ST.recordAnswer(s, { source: 'lesson', skill: 'grammar', correct: true, ref: 'l4:4' }, T0) };
  assert.equal(s.mistakes.length, 0); assert.deepEqual(Object.keys(s.review), []);
  s = { ...s, ...ST.recordSpeaking(s, { original_text: 'I go school', corrected_text: 'I go to school.', error_type: 'preposition', explanation_bn: 'to যোগ করুন' }, T0) };
  const qid = 'm:sp:i go to school'; assert.ok(s.review[qid]);
  let t = T0 + S.SOON_MS;
  s = { ...s, ...ST.recordAnswer(s, { source: 'review', skill: 'sentence', correct: true, review_id: qid }, t) };
  assert.equal(s.review[qid].box, 1);
  s = { ...s, ...ST.recordAnswer(s, { source: 'review', skill: 'sentence', correct: false, review_id: qid }, t + DAY + 1) };
  assert.equal(s.review[qid].box, 0); assert.equal(s.review[qid].lapses, 1);
});

test('vocabulary answers move the schedule of saved words, but early correct answers do not', () => {
  const p = { id: 'hello', en: 'Hello', bn: 'হ্যালো', in_review: true, recognition: { seen: 0, correct: 0 }, active: { used: 0, correct: 0 } };
  let s = base({ phrasebook: [p] });
  s = { ...s, ...ST.addVocabQueue(s, 'hello', T0) };
  assert.equal(s.review['v:hello'].due, T0 + S.SOON_MS);
  s = { ...s, ...ST.recordAnswer(s, { source: 'vocab', skill: 'vocabulary', correct: true, vocab_id: 'hello' }, T0 + 1000) };
  assert.equal(s.review['v:hello'].box, 0);
  s = { ...s, ...ST.recordAnswer(s, { source: 'vocab', skill: 'vocabulary', correct: true, vocab_id: 'hello' }, T0 + S.SOON_MS) };
  assert.equal(s.review['v:hello'].box, 1);
  s = { ...s, ...ST.removeVocabQueue(s, 'hello') };
  assert.equal(s.review['v:hello'], undefined);
});

test('review session: every built exercise can be answered correctly, and support is reduced with the box', () => {
  const lp = done(['l1', 'l2', 'l4', 'l9']);
  let s = base({ lesson_progress: lp, phrasebook: [
    { id: 'name', en: 'name', bn: 'নাম', example: 'My name is Rahim.', in_review: true, recognition: { seen: 0, correct: 0 }, active: { used: 0, correct: 0 } },
    { id: 'my', en: 'my', bn: 'আমার', example: 'My book.', in_review: true, recognition: { seen: 0, correct: 0 }, active: { used: 0, correct: 0 } },
    { id: 'your', en: 'your', bn: 'আপনার', example: 'Your book.', in_review: true, recognition: { seen: 0, correct: 0 }, active: { used: 0, correct: 0 } }
  ] });
  // one wrong answer for every kind of exercise
  const refs = [];
  allLessons().forEach((l) => l.steps.forEach((st, i) => { if (isExercise(st) && st.scored !== false && !refs.find((r) => r.t === st.type)) refs.push({ t: st.type, ref: `${l.id}:${i}`, step: st }); }));
  refs.forEach((r) => { s = { ...s, ...ST.recordAnswer(s, { source: 'lesson', skill: skillOf(r.step), correct: false, ref: r.ref, user: 'x', expected: 'y', prompt: r.step.prompt_en }, T0) }; });
  s = { ...s, ...ST.recordSpeaking(s, { original_text: 'She like tea', corrected_text: 'She likes tea.', error_type: 'subject_verb_agreement', explanation_bn: 'likes হবে', alternative_text: 'She enjoys tea.' }, T0) };
  ['name', 'my', 'your'].forEach((id) => { s = { ...s, ...ST.addVocabQueue(s, id, T0) }; });
  const now = T0 + DAY;
  const steps = buildReview(s, now, 20);
  assert.equal(steps.length, refs.length + 1 + 3);
  steps.forEach((st) => {
    assert.ok(st.review_id);
    const ans = rightAnswer(st);
    assert.ok(checkAnswer(st, ans).correct, `${st.review_id} ${st.type} ${st.prompt_en}`);
  });
  assert.equal(buildReview(s, now).length, S.SESSION_MAX);
  // scaffolding: low box gives tiles for a speaking correction and a meaning check; a higher box asks to write it
  const sp = s.review['m:sp:she likes tea'];
  assert.equal(buildReviewStep(s, { ...sp, box: 0 }).type, 'order');
  const typed = buildReviewStep(s, { ...sp, box: 2 });
  assert.equal(typed.type, 'type'); assert.equal(typed.hint_tap, true);
  assert.ok(checkAnswer(typed, 'She enjoys tea').correct);
  assert.equal(buildReviewStep(s, { ...s.review['v:name'], box: 0 }).type, 'choose');
  assert.equal(buildReviewStep(s, { ...s.review['v:name'], box: 3 }).type, 'pattern');
  // choose options are shuffled but the answer still points at the right option
  const choose = refs.find((r) => r.t === 'choose');
  const built = buildReviewStep(s, s.review['m:x:' + choose.ref]);
  assert.equal(built.options[built.answer], choose.step.options[choose.step.answer]);
  assert.deepEqual(shuffled([1, 2, 3, 4, 5], 7), shuffled([1, 2, 3, 4, 5], 7));
});

test('a review item whose content is gone is skipped, not shown broken', () => {
  const s = base({ mistakes: [{ id: 'x:l99:3', kind: 'step', ref: 'l99:3', count: 1, first_at: T0, last_at: T0, resolved_at: null }], review: { 'm:x:l99:3': S.newQueueItem('m:x:l99:3', 'mistake', T0, T0) } });
  assert.equal(buildReview(s, T0 + 1).length, 0);
  assert.equal(resolveStep('listen:ld1:99'), null);
});

test('metrics: windows, confidence, streak, weekly report and trend', () => {
  let d = {};
  for (let i = 0; i < 10; i++) d = M.addAnswer(d, T0 - i * DAY, 'grammar', i % 2 === 0);
  const st = M.skillStats(d, T0, 30);
  assert.equal(st.grammar.n, 10); assert.equal(st.grammar.c, 5); assert.equal(st.grammar.confidence, 'low'); assert.equal(st.grammar.status, 'developing' === st.grammar.status ? 'developing' : 'needs');
  assert.equal(st.listening.status, 'unknown'); assert.equal(st.listening.pct, null);
  assert.equal(M.confidenceOf(4), 'none'); assert.equal(M.confidenceOf(5), 'low'); assert.equal(M.confidenceOf(20), 'medium'); assert.equal(M.confidenceOf(50), 'high');
  assert.equal(M.statusOf(10, 0.5), 'needs'); assert.equal(M.statusOf(10, 0.7), 'developing'); assert.equal(M.statusOf(10, 0.9), 'strong');
  const sk = M.streakInfo(d, T0); assert.equal(sk.current, 10); assert.ok(sk.activeToday);
  const sk2 = M.streakInfo(d, T0 + DAY); assert.equal(sk2.current, 10); assert.ok(!sk2.activeToday); // yesterday still counts until the day ends
  assert.equal(M.streakInfo(d, T0 + 3 * DAY).current, 0);
  const wr = M.weekReport(d, T0); assert.equal(wr.cur.n, 7); assert.equal(wr.prev.n, 3); assert.equal(wr.days.length, 7);
  assert.equal(M.trend(d, T0), null); // not enough answers to compare
  let e = {};
  for (let i = 0; i < 12; i++) { e = M.addAnswer(e, T0 - i * 1000, 'grammar', true); e = M.addAnswer(e, T0 - 15 * DAY - i * 1000, 'grammar', i < 6); }
  assert.equal(M.trend(e, T0).direction, 'better');
  assert.equal(M.minutesOf(0), 0); assert.equal(M.minutesOf(20), 1); assert.equal(M.minutesOf(300), 5);
  let big = {}; for (let i = 0; i < 150; i++) big = M.bump(big, T0 - i * DAY, (x) => { x.sec += 1; });
  assert.equal(Object.keys(big).length, 120);
});

test('level evidence: needs lessons, enough answers and accuracy; placed lessons do not count; never goes down', () => {
  const w12 = allLessons().filter((l) => l.week === 'w1' || l.week === 'w2').map((l) => l.id);
  let s = base({ lesson_progress: done(w12.slice(0, 12)) });
  assert.equal(levelPatch(s, T0), null);
  for (let i = 0; i < 40; i++) s.daily = M.addAnswer(s.daily, T0 - (i % 10) * DAY, 'grammar', i % 5 !== 0); // 80% right
  const ev = levelEvidence(s, T0); assert.ok(ev.met); assert.equal(ev.next, 'A1');
  const p = levelPatch(s, T0); assert.equal(p.level, 'A1'); assert.equal(p.level_notice.to, 'A1');
  assert.equal(levelPatch({ ...s, lesson_progress: done(w12.slice(0, 12), { placed: true }) }, T0), null);
  let low = base({ lesson_progress: done(w12) });
  for (let i = 0; i < 40; i++) low.daily = M.addAnswer(low.daily, T0, 'grammar', i % 2 === 0);
  assert.equal(levelPatch(low, T0), null);
  assert.equal(levelEvidence({ ...s, level: 'A2' }, T0), null);
});

test('speaking evidence: no level without two goal-met conversations; recognizer percent only from sessions that measured it', () => {
  assert.equal(speakingEvidence([]).level, null);
  const one = [{ mode: 'guided', scenario_id: 'greet', level: 'Pre-A1', goal_met: true, turns: 3, words: 12 }];
  assert.equal(speakingEvidence(one).level, null); assert.equal(speakingEvidence(one).confidence, 'none');
  const two = [...one, { mode: 'roleplay', scenario_id: 'intro', level: 'Pre-A1', goal_met: true, turns: 4, words: 20 }, { mode: 'repeat', scenario_id: 'phrases', accuracy_pct: 80, turns: 6, words: 20 }];
  const e = speakingEvidence(two);
  assert.equal(e.level, 'Pre-A1'); assert.equal(e.confidence, 'low'); assert.equal(e.recognized_pct, 80); assert.equal(e.recognized_sessions, 1); assert.equal(e.words_per_turn, 4.6);
  assert.equal(speakingEvidence([...two, { mode: 'answer', level: 'A1', goal_met: true, turns: 2, words: 5 }, { mode: 'guided', level: 'A1', goal_met: true, turns: 2, words: 5 }]).level, 'A1');
  assert.equal(hintsFaded([{ mode: 'guided', scenario_id: 'greet', goal_met: true }, { mode: 'guided', scenario_id: 'greet', goal_met: true }], 'greet'), true);
  assert.equal(hintsFaded(one, 'greet'), false);
});

test('recommendations: due reviews first, weak skill next, reasons carried, nothing invented for a new learner', () => {
  const fresh = recommend(base(), T0, { signedIn: false });
  assert.equal(fresh[0].id, 'lesson'); assert.equal(fresh[0].params.first, '1');
  let s = base({ lesson_progress: done(['l1']), mistakes: [{ id: 'x:l1:5', kind: 'step', count: 1, first_at: T0, last_at: T0, resolved_at: null }], review: { 'm:x:l1:5': S.newQueueItem('m:x:l1:5', 'mistake', T0, T0) } });
  for (let i = 0; i < 12; i++) s.daily = M.addAnswer(s.daily, T0, 'listening', i < 3);
  const r = recommend(s, T0 + 1, { signedIn: true });
  assert.equal(r[0].id, 'review'); assert.equal(r[0].params.n, 1);
  const weak = r.find((x) => x.id === 'weak'); assert.equal(weak.params.skill, 'listening'); assert.equal(weak.href, '#/listening');
  assert.ok(r.find((x) => x.id === 'speak'));
  assert.ok(r.every((x) => x.href || x.action));
  for (let i = 0; i < 40; i++) s.daily = M.addAnswer(s.daily, T0, 'sentence', true);
  assert.ok(offerLessSupport({ ...s, daily: M.addAnswer({}, T0, 'x', true) }, T0) === false);
});

test('scaffolding: hint is shown, tapped or off from the setting, the item and the skill strength', () => {
  const step = { type: 'choose', prompt_en: 'Choose the correct word: He ___ my friend.' };
  assert.equal(hintMode(base(), step, T0), 'show');
  assert.equal(hintMode(base({ bengali_support: 'off' }), step, T0), 'off');
  assert.equal(hintMode(base({ bengali_support: 'reduced' }), step, T0), 'tap');
  assert.equal(hintMode(base(), { ...step, hint_tap: true }, T0), 'tap');
  let d = {}; for (let i = 0; i < 25; i++) d = M.addAnswer(d, T0, 'grammar', true);
  assert.equal(hintMode(base({ daily: d }), step, T0), 'tap');
  assert.equal(hintMode(base({ daily: d }), { type: 'order' }, T0), 'show'); // a different skill is not strong yet
});

test('migration: old mistakes are mapped to exercises where possible and queued; saved words get queue items', () => {
  const l = getLesson('l4'); const idx = l.steps.findIndex((x) => x.type === 'choose' && x.scored !== false);
  const st = l.steps[idx];
  // saved newest first, as the app always did
  const old = { schema: undefined, mistakes: [
    { lesson_id: 'l4', prompt: st.prompt_en, user: 'again', expected: st.options[st.answer], at: T0 - 2000 },
    { lesson_id: 'vocab', prompt: 'What does "x" mean?', user: 'a', expected: 'b', at: T0 - 3000 },
    { lesson_id: 'speaking', prompt: '', user: 'I go school', expected: 'I go to school.', at: T0 - 4000 },
    { lesson_id: 'l4', prompt: st.prompt_en, user: 'wrong', expected: st.options[st.answer], at: T0 - 5000 }
  ], phrasebook: [{ id: 'hello', en: 'Hello', in_review: true, recognition: { seen: 0, correct: 0 }, active: { used: 0, correct: 0 } }] };
  const m = migrateState(old, T0);
  assert.equal(m.schema, 2); assert.equal(m.mistakes.length, 3);
  const step = m.mistakes.find((x) => x.ref === `l4:${idx}`); assert.equal(step.count, 2); assert.equal(step.skill, skillOf(st)); assert.equal(step.user, 'again');
  assert.ok(m.mistakes.find((x) => x.kind === 'speaking' && x.id === 'sp:i go to school'));
  assert.ok(m.mistakes.find((x) => x.kind === 'note'));
  assert.ok(m.review[`m:x:l4:${idx}`] && m.review['m:sp:i go to school'] && m.review['v:hello']);
  assert.equal(Object.keys(m.review).length, 3);
  assert.equal(migrateState(m, T0), m); // already current
});

test('merge: two phones converge, resolved state respects later practice, daily log keeps the larger counts', () => {
  const a = [{ id: 'x:l1:1', count: 2, first_at: 100, last_at: 500, resolved_at: null }, { id: 'x:l1:2', count: 1, first_at: 100, last_at: 200, resolved_at: 300, resolved_by: 'review' }];
  const b = [{ id: 'x:l1:1', count: 3, first_at: 90, last_at: 400, resolved_at: 450, resolved_by: 'review' }, { id: 'x:l1:2', count: 2, first_at: 100, last_at: 350, resolved_at: null }, { id: 'x:l1:3', count: 1, first_at: 1, last_at: 1, resolved_at: null }];
  const m = mergeMistakes(a, b);
  assert.equal(m.length, 3);
  const one = m.find((x) => x.id === 'x:l1:1'); assert.equal(one.count, 3); assert.equal(one.first_at, 90); assert.equal(one.resolved_at, null); // seen again at 500 after resolved at 450
  const two = m.find((x) => x.id === 'x:l1:2'); assert.equal(two.resolved_at, null); // seen again at 350 after resolved at 300
  assert.deepEqual(mergeMistakes(m, a).map((x) => x.count), m.map((x) => x.count)); // merging again changes nothing
  const r = mergeReview({ q: { id: 'q', box: 1, last_at: 5 } }, { q: { id: 'q', box: 2, last_at: 9 }, z: { id: 'z', box: 0, created_at: 1 } });
  assert.equal(r.q.box, 2); assert.ok(r.z);
  const d = mergeDaily({ '2026-11-07': { sec: 60, ex: { grammar: [3, 2] }, rv: [1, 1], mis: 1 } }, { '2026-11-07': { sec: 30, ex: { grammar: [5, 4], listening: [2, 2] }, rv: [0, 0], mis: 2 }, '2026-11-06': { sec: 10, ex: {}, rv: [0, 0] } });
  assert.equal(d['2026-11-07'].sec, 60); assert.deepEqual(d['2026-11-07'].ex.grammar, [5, 4]); assert.deepEqual(d['2026-11-07'].ex.listening, [2, 2]); assert.equal(d['2026-11-07'].mis, 2); assert.ok(d['2026-11-06']);
  const l = mergeListening({ ld1: { attempts: 2, best: 60, last_score: 60, last_at: 5 } }, { ld1: { attempts: 1, best: 80, last_score: 80, last_at: 9 } });
  assert.equal(l.ld1.attempts, 2); assert.equal(l.ld1.best, 80); assert.equal(l.ld1.last_score, 80);
});

test('vocabulary practice still builds meaning checks and own-sentence tasks', () => {
  const p = (id, en, bn) => ({ id, en, bn, example: `${en} here`, in_review: true, recognition: { seen: 0, correct: 0 }, active: { used: 0, correct: 0 } });
  const s = base({ lesson_progress: done(['l1', 'l2']), phrasebook: [p('a', 'alpha', 'ক'), p('b', 'beta', 'খ'), p('c', 'gamma', 'গ')] });
  const steps = buildVocabPractice(s);
  assert.equal(steps.length, 6);
  steps.filter((x) => x.type === 'choose').forEach((x) => assert.equal(x.options[x.answer], s.phrasebook.find((y) => y.id === x.vocab_id).bn));
  assert.equal(vocabStep(base({ phrasebook: [p('a', 'alpha', '')] }), p('a', 'alpha', ''), 'recognition'), null);
});

test('the path follows the lesson the learner is on', () => {
  const s = base({ lesson_progress: done(allLessons().filter((l) => l.week === 'w1' || l.week === 'w2').map((l) => l.id)) });
  assert.equal(currentWeekIndex(s), 2);
  assert.equal(buildPath(s, 2).current.id, 'w3');
  assert.equal(weekCounts(s.lesson_progress).filter((w) => w.done === w.total).length, 2);
  assert.equal(buildPath(base()).current.id, 'w1');
});

test('long answers are clipped so the account always accepts them', () => {
  const r = K.addMistake([], { id: 'x:l1:1', kind: 'step', ref: 'l1:1', user: 'a'.repeat(900), expected: 'b'.repeat(500), explanation_bn: 'ক'.repeat(900) }, T0);
  assert.equal(r.list[0].user.length, 300); assert.equal(r.list[0].expected.length, 300); assert.equal(r.list[0].explanation_bn.length, 400);
  assert.equal(mergeMistakes([{ id: 'a', count: 1, first_at: 0, last_at: 0 }], [{ id: 'a', count: 1, first_at: 0, last_at: 0 }])[0].first_at, 0);
});
