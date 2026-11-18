// The learning engine: turns what the learner does into mistake records, review schedule and practice log (plan sections 6.8 and 9).
// Every function takes the current state and returns a patch for setState. Nothing here touches the screen or the network.
import { addMistake, resolveMistake, speakMistakeId, stepMistakeId, lessonOfRef } from './mistakes.js';
import { newQueueItem, record, isMastered } from './srs.js';
import { addAnswer, addReview, bump, streakInfo } from './metrics.js';

const qidOf = (mistakeId) => 'm:' + mistakeId;
export const vocabQid = (id) => 'v:' + id;
export function validItem(s, it) {
  if (it.type === 'mistake') { const m = s.mistakes.find((x) => x.id === it.id.slice(2)); return !!m && !m.resolved_at; }
  if (it.type === 'vocab') return s.phrasebook.some((p) => p.id === it.id.slice(2) && p.in_review !== false);
  return false;
}
export const queueList = (s) => Object.values(s.review || {}).filter((it) => validItem(s, it));
export const dueList = (s, now) => queueList(s).filter((it) => it.due <= now).sort((a, b) => a.due - b.due);
export const upcomingList = (s, now) => queueList(s).filter((it) => it.due > now).sort((a, b) => a.due - b.due);

function withStreak(s, patch, now) {
  const cur = streakInfo(patch.daily || s.daily, now).current;
  return cur > (s.best_streak || 0) ? { ...patch, best_streak: cur } : patch;
}
// Moves a queue item after an answer. A mistake that has been remembered three times in a row is resolved and leaves the queue.
function applyReview(st, qid, correct, now) {
  const it = st.review[qid]; if (!it) return;
  const next = record(it, correct, now);
  if (qid.startsWith('m:') && correct && isMastered(next)) {
    st.mistakes = resolveMistake(st.mistakes, qid.slice(2), now, 'review');
    delete st.review[qid];
    st.daily = bump(st.daily, now, (d) => { d.res += 1; });
  } else st.review[qid] = next;
}
function failedItem(st, qid, fresh, now) {
  if (fresh || !st.review[qid]) st.review[qid] = newQueueItem(qid, 'mistake', now);
  else applyReview(st, qid, false, now);
}

// One first-try answer. ev: { source, skill, correct, ref, review_id, vocab_id, user, expected, prompt }
export function recordAnswer(s, ev, now = Date.now()) {
  const st = { mistakes: s.mistakes, review: { ...(s.review || {}) }, daily: s.daily };
  st.daily = ev.source === 'review' ? addReview(st.daily, now, ev.correct) : addAnswer(st.daily, now, ev.skill, ev.correct);
  if (ev.review_id) applyReview(st, ev.review_id, ev.correct, now);
  else if (ev.vocab_id) applyReview(st, vocabQid(ev.vocab_id), ev.correct, now);
  else if (ev.ref) {
    const id = stepMistakeId(ev.ref); const qid = qidOf(id);
    if (ev.correct) applyReview(st, qid, true, now);
    else {
      const r = addMistake(st.mistakes, { id, kind: 'step', ref: ev.ref, lesson_id: lessonOfRef(ev.ref), skill: ev.skill, prompt: ev.prompt || '', user: ev.user || '', expected: ev.expected || '' }, now);
      st.mistakes = r.list; failedItem(st, qid, r.isNew || r.reopened, now);
      st.daily = bump(st.daily, now, (d) => { d.mis += 1; });
    }
  }
  return withStreak(s, st, now);
}

// A correction from the AI coach becomes a mistake record and a review item.
export function recordSpeaking(s, fb, now = Date.now()) {
  const id = speakMistakeId(fb.corrected_text); const qid = qidOf(id);
  const st = { mistakes: s.mistakes, review: { ...(s.review || {}) }, daily: s.daily };
  const r = addMistake(st.mistakes, { id, kind: 'speaking', skill: 'speaking', error_type: fb.error_type || 'other', user: fb.original_text, expected: fb.corrected_text, explanation_bn: fb.explanation_bn || '', alternative: fb.alternative_text || '' }, now);
  st.mistakes = r.list; failedItem(st, qid, r.isNew || r.reopened, now);
  st.daily = bump(st.daily, now, (d) => { d.mis += 1; });
  return withStreak(s, st, now);
}
// A corrected sentence said aloud and recognized word for word counts as a correct review.
export function recordSpokenReview(s, mid, now = Date.now()) {
  const st = { mistakes: s.mistakes, review: { ...(s.review || {}) }, daily: s.daily };
  applyReview(st, qidOf(mid), true, now);
  return st;
}
export const markKnown = (s, id, now = Date.now()) => {
  const review = { ...(s.review || {}) }; delete review[qidOf(id)];
  return { mistakes: resolveMistake(s.mistakes, id, now, 'learner'), review };
};
// Queue items for saved words (plan section 6.7 "add it to review").
export const addVocabQueue = (s, id, now = Date.now()) => ({ review: { ...(s.review || {}), [vocabQid(id)]: newQueueItem(vocabQid(id), 'vocab', now) } });
export function removeVocabQueue(s, id) { const review = { ...(s.review || {}) }; delete review[vocabQid(id)]; return { review }; }

export function recordSpeakTurn(s, now = Date.now()) { return { daily: bump(s.daily, now, (d) => { d.sp += 1; }) }; }
export function recordMissedWords(s, words) {
  const m = { ...(s.missed_words || {}) };
  words.forEach((w) => { if (w && w.length > 1) m[w] = (m[w] || 0) + 1; });
  const keep = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 40);
  return { missed_words: Object.fromEntries(keep) };
}
export const sessionLog = (s, entry) => ({ speak_log: [...(s.speak_log || []), entry].slice(-40) });
