// Level changes from practice evidence (plan sections 2 and 9). A level goes up only when the learner has really done the work.
// It never goes down by itself. Speaking is estimated only from AI Speak conversations the learner completed.
import { allLessons } from './lessons.js';
import { skillStats } from './metrics.js';

// Learning checks per level. The beginner course ends at A2, so there is nothing to reach above it yet.
export const RULES = {
  'Pre-A1': { next: 'A1', weeks: ['w1', 'w2'], lessons: 12, pct: 0.7, answers: 30 },
  A1: { next: 'A2', weeks: ['w3', 'w4'], lessons: 12, pct: 0.75, answers: 30 }
};
export function levelEvidence(s, now) {
  const rule = RULES[s.level]; if (!rule) return null;
  const ls = allLessons().filter((l) => rule.weeks.includes(l.week));
  const done = ls.filter((l) => { const p = s.lesson_progress[l.id]; return p && p.status === 'completed' && !p.placed; }).length;
  const need = Math.min(rule.lessons, ls.length);
  const st = skillStats(s.daily, now, 30).all; const pct = st.pct === null ? 0 : Math.round(st.pct * 100);
  const checks = [
    { key: 'lessons', have: done, need, ok: done >= need },
    { key: 'answers', have: st.n, need: rule.answers, ok: st.n >= rule.answers },
    { key: 'accuracy', have: pct, need: Math.round(rule.pct * 100), ok: st.n >= rule.answers && st.pct >= rule.pct }
  ];
  return { from: s.level, next: rule.next, met: checks.every((c) => c.ok), checks };
}
export function levelPatch(s, now) {
  const ev = levelEvidence(s, now);
  if (!ev || !ev.met) return null;
  return { level: ev.next, level_notice: { from: ev.from, to: ev.next, at: now, pct: ev.checks[2].have } };
}

// Speaking: the highest scenario level where the goal was reached in at least 2 conversations. No score is made up.
const ORDER = ['Pre-A1', 'A1', 'A2'];
export function speakingEvidence(log) {
  const talks = (log || []).filter((x) => ['guided', 'roleplay', 'answer'].includes(x.mode));
  const goal = talks.filter((x) => x.goal_met);
  const level = [...ORDER].reverse().find((l) => goal.filter((x) => x.level === l).length >= 2) || null;
  const all = log || [];
  const wpm = all.filter((x) => x.avg_wpm); const acc = all.filter((x) => x.accuracy_pct !== null && x.accuracy_pct !== undefined);
  const withTurns = all.filter((x) => x.turns > 0 && x.mode !== 'repeat' && x.mode !== 'review');
  const turns = withTurns.reduce((n, x) => n + x.turns, 0); const words = withTurns.reduce((n, x) => n + (x.words || 0), 0);
  return {
    sessions: all.length, talks: talks.length, goal_met: goal.length, level,
    confidence: talks.length >= 6 ? 'medium' : talks.length >= 2 ? 'low' : 'none',
    avg_wpm: wpm.length ? Math.round(wpm.reduce((n, x) => n + x.avg_wpm, 0) / wpm.length) : null,
    words_per_turn: turns ? Math.round((words / turns) * 10) / 10 : null,
    recognized_pct: acc.length ? Math.round(acc.reduce((n, x) => n + x.accuracy_pct, 0) / acc.length) : null, recognized_sessions: acc.length
  };
}
