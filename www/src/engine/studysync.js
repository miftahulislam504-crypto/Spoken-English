// What is sent to the account and how the account's copy is merged back (plan sections 10 and 11).
// Saved words stay on the phone for now; mistakes, the mistake review schedule, listening results and the practice log are copied.
import { mergeMistakes, mergeReview, mergeDaily, mergeListening } from './merge.js';
import { newQueueItem } from './srs.js';
import { skillStats } from './metrics.js';
import { speakingEvidence } from './evidence.js';

export function studyPayload(s) {
  const st = skillStats(s.daily, Date.now(), 30); const sp = speakingEvidence(s.speak_log);
  const skills = ['listening', 'vocabulary', 'sentence', 'grammar'].filter((k) => st[k].n >= 5).map((k) => ({ skill_type: k, score: Math.round(st[k].pct * 100), confidence: st[k].confidence, n: st[k].n, c: st[k].c }));
  if (sp.talks) skills.push({ skill_type: 'speaking', score: null, confidence: sp.confidence, n: sp.talks, c: sp.goal_met, level: sp.level });
  return {
    mistakes: (s.mistakes || []).slice(0, 200),
    review: Object.values(s.review || {}).filter((it) => it.type === 'mistake').slice(0, 300),
    listening: Object.entries(s.listen_progress || {}).slice(0, 80).map(([item_id, r]) => ({ item_id, attempts: r.attempts || 0, best: r.best || 0, last_score: r.last_score || 0, last_at: r.last_at || null })),
    activity: Object.entries(s.daily || {}).slice(-120).map(([day, data]) => ({ day, data })),
    skills
  };
}
export function mergeStudy(s, remote, now = Date.now()) {
  const mistakes = mergeMistakes(s.mistakes, remote.mistakes);
  const review = mergeReview(s.review, Object.fromEntries((remote.review || []).map((x) => [x.id, x])));
  Object.keys(review).forEach((k) => {
    if (!k.startsWith('m:')) return;
    const m = mistakes.find((x) => x.id === k.slice(2));
    if (!m || m.resolved_at) delete review[k];
  });
  mistakes.forEach((m) => { const q = 'm:' + m.id; if (!m.resolved_at && m.kind !== 'note' && !review[q]) review[q] = newQueueItem(q, 'mistake', now, now); });
  const listen = Object.fromEntries((remote.listening || []).map((x) => [x.item_id, { attempts: x.attempts, best: x.best, last_score: x.last_score, last_at: x.last_at }]));
  const daily = Object.fromEntries((remote.activity || []).map((x) => [x.day, x.data]));
  return { mistakes, review, listen_progress: mergeListening(s.listen_progress, listen), daily: mergeDaily(s.daily, daily) };
}
