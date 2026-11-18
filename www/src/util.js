import { bump } from './engine/metrics.js';
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export const practiceMinutes = (s) => (s.practice && s.practice.date === todayKey() ? Math.round(s.practice.seconds / 60) : 0);
// Adds estimated practice time for today (daily goal) and to the practice log. mutate(day) can add other counts to the same day.
export const practicePatch = (s, sec, mutate) => ({
  practice: { date: todayKey(), seconds: (s.practice.date === todayKey() ? s.practice.seconds : 0) + sec },
  daily: bump(s.daily, Date.now(), (d) => { d.sec += sec; if (mutate) mutate(d); })
});
