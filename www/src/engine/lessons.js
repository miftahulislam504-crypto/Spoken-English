import { lessons as lessonsA, courses } from '../content/lessons.js';
import { lessons as lessonsB } from '../content/lessons-w34.js';
import { WEEKS } from '../content/curriculum-outline.js';
import { startWeekIndex } from './path.js';
import { isExercise } from './skills.js';
export { courses };
const lessons = [...lessonsA, ...lessonsB];
export const BUNDLED_VERSIONS = Object.fromEntries(lessons.map((l) => [l.id, l.content_version]));
const build = (over, retired) => {
  const byId = new Map(lessons.map((l) => [l.id, l]));
  Object.values(over).forEach((l) => { const b = byId.get(l.id); if (!b || l.content_version > b.content_version) byId.set(l.id, l); }); // a downloaded lesson replaces the built-in one only when it is newer
  return [...byId.values()].filter((l) => l.published_status === 'published' && !retired.includes(l.id)).sort((a, b) => a.sequence_number - b.sequence_number);
};
let pub = build({}, []);
// Lessons downloaded from the server (Phase 11). Call with the stored pack at start-up and again after a download; nothing else changes.
export function setDownloadedLessons(over = {}, retired = []) { pub = build(over, retired); }
export const allLessons = () => pub;
export const getLesson = (id) => pub.find((l) => l.id === id);
export const isUnlocked = (l, lp) => l.prerequisite_lesson_ids.every((id) => lp[id] && lp[id].status === 'completed');
export const lessonStatus = (l, lp) => (!isUnlocked(l, lp) ? 'locked' : lp[l.id] ? lp[l.id].status : 'new');
export const nextLesson = (lp) => pub.find((l) => isUnlocked(l, lp) && !(lp[l.id] && lp[l.id].status === 'completed'));
export const teachSteps = (lp) => pub.filter((l) => isUnlocked(l, lp)).flatMap((l) => l.steps.filter((x) => x.type === 'teach').map((step) => ({ lesson: l, step })));
export function practiceEligible(s) {
  const pool = pub.filter((l) => s.lesson_progress[l.id]).flatMap((l) => l.steps.map((x, i) => ({ x, i })).filter(({ x }) => x.stage === 'practice').map(({ x, i }) => ({ ...x, ref: `${l.id}:${i}` })));
  if (!pool.length) return [];
  const off = (Math.floor(Date.now() / 86400000) * 6) % pool.length;
  return Array.from({ length: Math.min(6, pool.length) }, (_, i) => pool[(off + i) % pool.length]);
}
// An exercise in a lesson, found by its reference "lessonId:stepIndex". Used by the Review Queue.
export function lessonStep(ref) {
  const [id, i] = String(ref).split(':'); const l = getLesson(id); const st = l && l.steps[Number(i)];
  return isExercise(st) ? st : null;
}
// The short Bengali grammar explanation of a lesson, shown with mistakes from that lesson.
export function lessonExplanation(id) {
  const l = getLesson(id); const t = l && l.steps.find((x) => x.type === 'teach');
  return t ? t.explanation_bn : '';
}
// The week the learner is working in now: the week of the next lesson, never earlier than the level start.
export function currentWeekIndex(s) {
  const n = nextLesson(s.lesson_progress); const i = n ? WEEKS.findIndex((w) => w.id === n.week) : WEEKS.length - 1;
  return Math.max(i, startWeekIndex(s.level));
}
export function weekCounts(lp) {
  return WEEKS.map((w) => { const ls = pub.filter((l) => l.week === w.id); return { id: w.id, total: ls.length, done: ls.filter((l) => lp[l.id] && lp[l.id].status === 'completed').length }; });
}

// Learners placed at A1 or higher start in a later week; earlier weeks count as covered by placement.
export function applyPlacement(level, lp) {
  const start = startWeekIndex(level); const out = { ...lp };
  pub.forEach((l) => {
    const wi = WEEKS.findIndex((w) => w.id === l.week);
    if (wi < start && !out[l.id]) out[l.id] = { status: 'completed', placed: true, attempt_count: 0, score: 0, mastery_score: 0, completed_at: null, last_attempt_at: null, content_version: l.content_version, run: null };
  });
  return out;
}
