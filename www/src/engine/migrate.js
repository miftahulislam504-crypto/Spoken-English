// Brings saved phone data from older versions up to date (Phase 8 changes how mistakes are stored).
import { allLessons, getLesson } from './lessons.js';
import { buildListening } from './listening.js';
import { addMistake, speakMistakeId, stepMistakeId, lessonOfRef } from './mistakes.js';
import { newQueueItem } from './srs.js';
import { skillOf, isExercise } from './skills.js';
import { checkAnswer } from './answers.js';

const expectedOf = (step) => checkAnswer(step, step.type === 'type' || step.type === 'order' ? '' : 0).expected;
function findRef(lessonId, prompt, expected) {
  const same = (st) => isExercise(st) && st.prompt_en === prompt && expectedOf(st) === expected;
  if (String(lessonId).startsWith('listen:')) {
    const id = String(lessonId).slice(7); const i = buildListening(id).findIndex(same);
    return i >= 0 ? { ref: `listen:${id}:${i}`, step: buildListening(id)[i] } : null;
  }
  const pool = getLesson(lessonId) ? [getLesson(lessonId)] : lessonId === 'practice' ? allLessons() : [];
  for (const l of pool) { const i = l.steps.findIndex(same); if (i >= 0) return { ref: `${l.id}:${i}`, step: l.steps[i] }; }
  return null;
}
export function migrateState(st, now = Date.now()) {
  if ((st.schema || 1) >= 2) return st;
  let mistakes = []; const review = { ...(st.review || {}) };
  [...(st.mistakes || [])].reverse().forEach((o) => {
    if (!o || o.id) return;
    const at = o.at || now;
    let rec;
    if (o.lesson_id === 'speaking') rec = { id: speakMistakeId(o.expected), kind: 'speaking', skill: 'speaking', error_type: 'other', user: o.user, expected: o.expected };
    else {
      const f = findRef(o.lesson_id, o.prompt, o.expected);
      rec = f ? { id: stepMistakeId(f.ref), kind: 'step', ref: f.ref, lesson_id: lessonOfRef(f.ref), skill: skillOf(f.step), prompt: o.prompt, user: o.user, expected: o.expected } : { id: 'n:' + at + ':' + mistakes.length, kind: 'note', skill: null, prompt: o.prompt || '', user: o.user || '', expected: o.expected || '' };
    }
    const r = addMistake(mistakes, rec, at); mistakes = r.list;
    if (rec.kind !== 'note') review['m:' + rec.id] = review['m:' + rec.id] || newQueueItem('m:' + rec.id, 'mistake', now, now);
  });
  (st.mistakes || []).filter((o) => o && o.id).forEach((o) => { mistakes = [...mistakes, o]; });
  (st.phrasebook || []).forEach((p) => { if (p.in_review !== false && !review['v:' + p.id]) review['v:' + p.id] = newQueueItem('v:' + p.id, 'vocab', now, now); });
  return { ...st, schema: 2, mistakes, review };
}
