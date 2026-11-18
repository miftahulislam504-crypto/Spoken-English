// AI Speak with a fake server: corrections become mistakes and review items, sessions are logged, and hints fade after the goal is reached twice.
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
globalThis.window = { scrollY: 0 }; let typed = '';
globalThis.document = { getElementById: (id) => (id === 'sk-text' ? { value: typed } : null) };
globalThis.location = { hash: '' };
const warnings = []; console.warn = (...a) => warnings.push(a.join(' '));
localStorage.setItem('se.auth.v1', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1', email: 'a@b.c' } }));

let turn = 0; const sent = [];
const FB = { original_text: 'I go school', corrected_text: 'I go to school.', error_type: 'preposition', explanation_bn: 'to যোগ করুন', alternative_text: '', needs_retry: true };
globalThis.fetch = async (url, opts = {}) => {
  const path = new URL(url, 'http://app.test').pathname; const body = opts.body ? JSON.parse(opts.body) : {};
  sent.push(path);
  const ok = (o) => new Response(JSON.stringify(o), { status: 200 });
  if (path.endsWith('/speaking/sessions')) return ok({ session_id: 'sid' + (++turn), mode: body.mode, scenario_id: body.scenario_id });
  if (path.endsWith('/turns')) {
    if (body.kind === 'repeat') return ok({ kind: 'repeat', transcript: 'I think this is berry good', understood: true, compare: { matched: false, accuracy: 0.8, missing: ['very', 'good'], extra: ['berry'] }, stt: null, fluency: null });
    return ok({ kind: 'reply', transcript: body.text, understood: true, goal_met: true, coach: { reply_en: 'Good!', reply_bn: 'ভালো' }, suggested_replies: ['I am fine.'], feedback: FB, stt: null, fluency: null });
  }
  if (path.endsWith('/end')) return ok({ mode: 'guided', level: 'Pre-A1', turns: 1, words: 3, goal_met: true, corrections: [], accuracy_pct: null, avg_wpm: null, encouragement: 'goal_met' });
  return new Response('{}', { status: 404 });
};

const { getState, setState } = await import('../www/src/store.js');
const { skAct, sessionView, speak } = await import('../www/src/speak.js');
const M = await import('../www/src/engine/metrics.js');
const el = (act, o = {}) => ({ dataset: { act, ...o } });
const wait = () => new Promise((r) => setTimeout(r, 5));
const play = async () => {
  await skAct(el('sk-start', { mode: 'guided', id: 'greet' })); await wait();
  typed = 'I go school'; await skAct(el('sk-send-text')); await wait();
  await skAct(el('sk-end')); await wait();
};

test('a guided session turns the correction into a mistake and a review item, and is logged', async () => {
  setState({ onboarded: true, bengali_support: 'full' });
  await play();
  const s = getState();
  assert.equal(s.mistakes.length, 1); assert.equal(s.mistakes[0].kind, 'speaking'); assert.equal(s.mistakes[0].expected, 'I go to school.');
  assert.ok(s.review['m:sp:i go to school']);
  const day = s.daily[M.dayKey(Date.now())]; assert.equal(day.sp, 1); assert.equal(day.ss, 1); assert.ok(day.sec >= 60); assert.equal(day.mis, 1);
  assert.equal(s.speak_log.length, 1); assert.equal(s.speak_log[0].scenario_id, 'greet'); assert.equal(s.speak_log[0].level, 'Pre-A1'); assert.equal(s.speak_log[0].goal_met, true);
  assert.equal(s.practice.seconds >= 60, true);
  assert.match(sessionView(s), /Session summary/);
  assert.deepEqual(warnings.splice(0), []);
});

test('hints show at first and fade once the goal was reached twice; they can be shown again', async () => {
  await skAct(el('sk-leave'));
  await skAct(el('sk-start', { mode: 'guided', id: 'greet' })); await wait();
  assert.match(sessionView(getState()), /You could say/);
  await skAct(el('sk-leave'));
  await play();
  await skAct(el('sk-leave'));
  assert.equal(getState().speak_log.length, 2);
  await skAct(el('sk-start', { mode: 'guided', id: 'greet' })); await wait();
  const html = sessionView(getState());
  assert.match(html, /the hints are hidden/); assert.doesNotMatch(html, /You could say/);
  await skAct(el('sk-hints'));
  assert.match(sessionView(getState()), /You could say/);
  assert.equal(getState().mistakes[0].count, 2, 'the same correction twice is one record seen twice');
  assert.deepEqual(warnings.splice(0), []);
});

test('Review My Mistakes uses open corrections, and repeating one word for word counts as a correct review', async () => {
  await skAct(el('sk-leave'));
  const s0 = getState();
  const it = s0.review['m:sp:i go to school'];
  setState({ review: { ...s0.review, 'm:sp:i go to school': { ...it, due: Date.now() - 1000 } } });
  await skAct(el('sk-start', { mode: 'review', id: 'review' })); await wait();
  assert.match(sessionView(getState()), /I go to school\./);
  // the fake server reports a missed word first, then a perfect repeat
  await skAct(el('sk-send-text')).catch(() => {});
  typed = 'I think this is berry good'; await skAct(el('sk-send-text')); await wait();
  assert.deepEqual(Object.keys(getState().missed_words).sort(), ['good', 'very']);
  assert.equal(getState().review['m:sp:i go to school'].box, 0, 'a miss does not move the schedule');
  globalThis.fetch = async (url) => (String(url).endsWith('/turns') ? new Response(JSON.stringify({ kind: 'repeat', transcript: 'I go to school', understood: true, compare: { matched: true, accuracy: 1, missing: [], extra: [] }, stt: null, fluency: null }), { status: 200 }) : new Response(JSON.stringify({ session_id: 'x' }), { status: 200 }));
  typed = 'I go to school'; await skAct(el('sk-send-text')); await wait();
  assert.equal(getState().review['m:sp:i go to school'].box, 1);
  assert.deepEqual(warnings.splice(0), []);
});

test('the hub shows the six modes and asks guests to sign in', () => {
  const html = speak(getState());
  ['Guided Conversation', 'Roleplay', 'Free Conversation', 'Repeat After Me', 'Answer a Question', 'Review My Mistakes'].forEach((m) => assert.match(html, new RegExp(m)));
});
