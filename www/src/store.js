import { LOCALES } from './config.js';
import { migrateState } from './engine/migrate.js';
const KEY = 'se.state.v1';
const defaults = {
  explanation_language: LOCALES.explanation_language, bengali_support: 'full', daily_goal_minutes: 10, level: 'Pre-A1',
  onboarded: false, ob_step: 'splash', account: 'guest', goal: null, comfort: null, accent: 'any', reminder: 'off', mic: 'unknown',
  skills: {}, lesson_progress: {}, ac_mode: 'signin', synced_at: null, bookmarks: [], listen_speed: 'normal', listen_progress: {}, mistakes: [], phrasebook: [], practice: { date: '', seconds: 0 }, practice_run: null, diag_i: 0, diag_answers: [], diag_done: false, first_done: false,
  schema: 2, entitlement: null, review: {}, daily: {}, speak_log: [], missed_words: {}, level_notice: null, best_streak: 0, study_sync_ok: true,
  analytics: 'on', words_known: [], content_checked_at: null, reminder_denied: false
};
let state = { ...defaults };
try { Object.assign(state, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* storage unavailable */ }
try { state = migrateState(state); } catch (e) { console.warn('State migration failed', e && e.message); }
const subs = new Set();
export const getState = () => ({ ...state, ui_locale: LOCALES.ui_locale, target_language: LOCALES.target_language });
export function setState(patch) {
  state = { ...state, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  subs.forEach((f) => f(getState()));
}
export const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
