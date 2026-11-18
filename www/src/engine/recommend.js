// Adaptive recommendations (plan section 9). Every recommendation comes from a visible rule and carries its reason.
import { allLessons, nextLesson, practiceEligible, isUnlocked } from './lessons.js';
import { skillStats, DAY_MS } from './metrics.js';
import { dueList } from './study.js';
import { offerLessSupport } from './scaffold.js';

const WEAK_AT = 0.6;
function weakHref(k, s) {
  if (k === 'listening') return '#/listening';
  if (k === 'vocabulary') return s.phrasebook.length ? '#/vocab-practice' : '#/vocabulary';
  return practiceEligible(s).length ? '#/practice' : '#/learn';
}
const lastAt = (xs) => xs.reduce((m, x) => Math.max(m, x || 0), 0);

export function recommend(s, now, { signedIn = false } = {}) {
  const out = []; const due = dueList(s, now).length; const st = skillStats(s.daily, now, 30); const nxt = nextLesson(s.lesson_progress);
  const done = Object.values(s.lesson_progress).filter((p) => p.status === 'completed' && !p.placed).length;
  if (due) out.push({ id: 'review', w: 90 + Math.min(due, 9), href: '#/review', params: { n: due } });
  ['listening', 'grammar', 'sentence', 'vocabulary'].forEach((k, i) => {
    const x = st[k];
    if (x.n >= 10 && x.pct < WEAK_AT) out.push({ id: 'weak', w: 80 - i, href: weakHref(k, s), params: { skill: k, c: x.c, n: x.n } });
  });
  const chk = allLessons().find((l) => l.assessment);
  if (chk && isUnlocked(chk, s.lesson_progress) && !(s.lesson_progress[chk.id] && s.lesson_progress[chk.id].status === 'completed') && !(nxt && nxt.id === chk.id)) out.push({ id: 'check', w: 75, href: '#/lesson/' + chk.id, params: {} });
  if (nxt) out.push({ id: 'lesson', w: 70, href: '#/lesson/' + nxt.id, params: { title: nxt.title_en, first: done === 0 ? '1' : '' } });
  if (signedIn) {
    const last = lastAt((s.speak_log || []).map((x) => x.at));
    if (!last) out.push({ id: 'speak', w: 60, href: '#/speak', params: { gap: '' } });
    else if (now - last > 3 * DAY_MS) out.push({ id: 'speak', w: 60, href: '#/speak', params: { gap: String(Math.floor((now - last) / DAY_MS)) } });
  }
  const lastL = lastAt(Object.values(s.listen_progress || {}).map((x) => x.last_at));
  if (done >= 1 && (!lastL || now - lastL > 4 * DAY_MS)) out.push({ id: 'listen', w: 50, href: '#/listening', params: { gap: lastL ? String(Math.floor((now - lastL) / DAY_MS)) : '' } });
  const unused = s.phrasebook.filter((p) => !p.active.used).length;
  if (s.phrasebook.length >= 3 && unused >= s.phrasebook.length / 2) out.push({ id: 'vocab', w: 40, href: '#/vocab-practice', params: { n: unused } });
  if (offerLessSupport(s, now)) out.push({ id: 'support', w: 35, action: 'rv-reduce-bn', params: {} });
  if (!out.length) out.push({ id: 'done', w: 10, href: signedIn ? '#/speak' : '#/listening', params: {} });
  return out.sort((a, b) => b.w - a.w);
}
