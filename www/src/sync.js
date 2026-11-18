import { api, getSession } from './auth.js';
import { getState, setState } from './store.js';
import { studyPayload, mergeStudy } from './engine/studysync.js';
import { refreshEntitlement } from './entitlement.js';
import { syncWords } from './words-sync.js';

const RANK = { completed: 2, in_progress: 1 };
const iso = (ms) => (ms ? new Date(ms).toISOString() : null);
const toRow = (id, p) => ({ lesson_id: id, status: p.status, attempt_count: p.attempt_count || 0, score: p.score || 0, mastery_score: p.mastery_score || 0, content_version: p.content_version || 1, placed: !!p.placed, last_attempt_at: iso(p.last_attempt_at), completed_at: iso(p.completed_at) });

// The phone keeps working offline. Sync copies preferences and lesson progress to the account and merges what the account already has.
export async function syncNow() {
  if (!getSession()) return false;
  let s = getState();
  const me = await api('GET', '/me');
  const pr = me.preferences || {};
  if (!s.onboarded && pr.onboarded) {
    setState({ onboarded: true, ob_step: 'done', level: me.current_level, daily_goal_minutes: me.daily_goal_minutes, accent: pr.accent || s.accent, listen_speed: pr.listen_speed || s.listen_speed, bengali_support: pr.bengali_support || s.bengali_support, reminder: pr.reminder || s.reminder, goal: pr.goal || s.goal, comfort: pr.comfort || s.comfort });
  } else if (s.onboarded) {
    await api('PATCH', '/me', { current_level: s.level, daily_goal_minutes: s.daily_goal_minutes });
    await api('PATCH', '/me/preferences', { accent: s.accent, listen_speed: s.listen_speed, bengali_support: s.bengali_support, reminder: s.reminder, ...(s.goal ? { goal: s.goal } : {}), ...(s.comfort ? { comfort: s.comfort } : {}), onboarded: true });
  }
  s = getState();
  const rows = Object.entries(s.lesson_progress).filter(([, p]) => p.status).map(([id, p]) => toRow(id, p));
  if (rows.length) await api('PUT', '/me/progress', { lessons: rows.slice(0, 100) });
  const remote = await api('GET', '/me/progress');
  const merged = { ...getState().lesson_progress };
  remote.lessons.forEach((r) => {
    const l = merged[r.lesson_id];
    if (l && (RANK[r.status] < RANK[l.status] || (RANK[r.status] === RANK[l.status] && r.attempt_count <= (l.attempt_count || 0)))) return;
    merged[r.lesson_id] = { ...l, status: r.status, attempt_count: r.attempt_count, score: Number(r.score), mastery_score: Number(r.mastery_score), content_version: r.content_version, placed: r.placed, completed_at: r.completed_at ? Date.parse(r.completed_at) : null, last_attempt_at: r.last_attempt_at ? Date.parse(r.last_attempt_at) : null, run: l ? l.run : null };
  });
  setState({ lesson_progress: merged, synced_at: Date.now() });
  // Mistakes, review schedule, listening results and the practice log. A failure here never blocks lessons or settings.
  try { await syncStudy(); setState({ study_sync_ok: true }); } catch (e) { setState({ study_sync_ok: false }); }
  try { await syncWords(); } catch (e) { /* saved words are tried again at the next sync */ }
  try { await refreshEntitlement(); } catch (e) { /* the plan is shown again the next time it loads */ }
  return true;
}
export async function syncStudy() {
  const remote = await api('GET', '/me/study');
  setState(mergeStudy(getState(), remote));
  await api('PUT', '/me/study', studyPayload(getState()));
}
let timer = null;
export function syncSoon() {
  if (!getSession()) return;
  clearTimeout(timer);
  timer = setTimeout(() => { syncNow().catch(() => {}); }, 1500);
}
