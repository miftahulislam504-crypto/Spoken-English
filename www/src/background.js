// Quiet things that happen after the app opens: send waiting usage events, check once a day for updated lessons, set the reminder.
import { getState, setState, subscribe } from './store.js';
import { flush, track } from './analytics.js';
import { stageUpdates } from './content-pack.js';
import { applyReminder } from './reminders.js';
import { isOnline } from './errors.js';

const DAY = 86400000;
const later = (f, ms) => { if (typeof setTimeout !== 'function') return; const h = setTimeout(f, ms); if (h && h.unref) h.unref(); };
export function startBackground() {
  track('app_opened');
  if (!getState().onboarded) track('onboarding_started');
  later(() => { flush(); }, 8000);
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  later(() => {
    const s = getState();
    if (!isOnline() || (s.content_checked_at && Date.now() - s.content_checked_at < DAY)) return;
    stageUpdates().then(() => setState({ content_checked_at: Date.now() })).catch(() => { /* tried again tomorrow */ });
  }, 5000);
  let last = getState().reminder;
  subscribe((s) => { if (s.reminder !== last) { last = s.reminder; applyReminder(s.reminder).then((r) => { if (r !== 'unavailable') setState({ reminder_denied: r === 'denied' }); }); } });
}
