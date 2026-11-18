// Daily practice reminder (plan section 2): a notification on this phone at a time the learner chooses. Works in the Android app only.
import { t } from './i18n/index.js';
import { track } from './analytics.js';
import { getState } from './store.js';

const ID = 4101;
const TIMES = { morning: { hour: 8, minute: 0 }, evening: { hour: 19, minute: 30 } };
const plugin = () => (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins ? window.Capacitor.Plugins.LocalNotifications : null);
export const remindersAvailable = () => !!plugin();

// Returns 'off', 'set', 'denied' or 'unavailable'. The choice itself is always saved by the caller; this only schedules the notification.
export async function applyReminder(mode) {
  const p = plugin(); if (!p) return 'unavailable';
  try {
    await p.cancel({ notifications: [{ id: ID }] });
    if (!TIMES[mode]) { track('reminder_set', { when: 'off' }); return 'off'; }
    const perm = await p.requestPermissions(); if (perm.display !== 'granted') return 'denied';
    await p.schedule({ notifications: [{ id: ID, title: t('rm.title'), body: t('rm.body'), schedule: { on: TIMES[mode], allowWhileIdle: true } }] });
    track('reminder_set', { when: mode }); return 'set';
  } catch (e) { return 'unavailable'; }
}
export const reminderNote = () => t(!remindersAvailable() ? 'rm.webOnly' : getState().reminder_denied ? 'rm.denied' : 'settings.reminder.note');
