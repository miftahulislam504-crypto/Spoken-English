// Local preference store. Field names mirror the planned `users` table (plan section 10)
// so Phase 5 can sync them to the database without renaming.
const KEY = 'sec.v1';
const DEFAULTS = {
  display_name: '', native_language: 'bn', ui_locale: 'en', explanation_language: 'bn', target_language: 'en',
  current_level: 'Pre-A1', daily_goal_minutes: 10, bengali_support: 'full', accent: 'mixed', reminders: false
};
let user = read();
function read() {
  try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
  catch { return { ...DEFAULTS }; }
}
export const get = () => user;
export function set(patch) {
  user = { ...user, ...patch, ui_locale: 'en', target_language: 'en' };
  try { localStorage.setItem(KEY, JSON.stringify(user)); } catch { /* storage unavailable */ }
}
