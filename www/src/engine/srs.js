// Spaced repetition for the Review Queue (plan section 6.8). A simple five-step schedule that a learner can understand.
// A new item is due after 10 minutes. Each correct review moves it up one step; each miss sends it back two steps.
export const DAY_MS = 86400000;
export const SOON_MS = 10 * 60 * 1000;
export const STEP_DAYS = [1, 3, 7, 14, 30];
export const RESOLVE_BOX = 3; // a mistake counts as resolved after 3 correct reviews in a row
export const SESSION_MAX = 8;

export const newQueueItem = (id, type, now, due) => ({ id, type, box: 0, due: due === undefined ? now + SOON_MS : due, reps: 0, lapses: 0, last: null, last_at: null, created_at: now });
export function record(item, correct, now) {
  if (correct) {
    if (item.due > now) return item; // practised early: no credit, no penalty
    const box = Math.min(item.box + 1, STEP_DAYS.length);
    return { ...item, box, due: now + STEP_DAYS[box - 1] * DAY_MS, reps: item.reps + 1, last: 'right', last_at: now };
  }
  return { ...item, box: Math.max(0, item.box - 2), due: now + SOON_MS, lapses: item.lapses + 1, last: 'wrong', last_at: now };
}
export const intervalDays = (item) => (item.box > 0 ? STEP_DAYS[item.box - 1] : 0);
export const isMastered = (item) => item.box >= RESOLVE_BOX;
export function dueText(due, now) {
  if (due <= now) return 'now';
  const days = Math.ceil((due - now) / DAY_MS);
  return days <= 1 ? (due - now < DAY_MS / 2 ? 'today' : 'tomorrow') : `days:${days}`;
}
