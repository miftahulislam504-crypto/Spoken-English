// Practice log and statistics (plan sections 3.5, 6.8 and 14).
// Everything is computed from what the learner actually did. Nothing is guessed or invented.
export const DAY_MS = 86400000;
const KEEP_DAYS = 120;
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const shiftDay = (key, n) => { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(y, m - 1, d + n).getTime()); };
// One entry per day: sec = practice seconds (estimated), ex = first-try answers per skill [asked, correct], rv = review answers [asked, correct],
// mis = mistakes made, res = mistakes resolved, sp = speaking turns, ss = speaking sessions, ls = listening items finished, lc = lessons completed.
export const blankDay = () => ({ sec: 0, ex: {}, rv: [0, 0], mis: 0, res: 0, sp: 0, ss: 0, ls: 0, lc: 0 });

export function bump(daily, ms, fn) {
  const key = dayKey(ms); const base = daily || {};
  const cur = { ...blankDay(), ...base[key] }; cur.ex = { ...cur.ex };
  fn(cur);
  const out = { ...base, [key]: cur };
  const keys = Object.keys(out).sort();
  if (keys.length > KEEP_DAYS) keys.slice(0, keys.length - KEEP_DAYS).forEach((k) => { delete out[k]; });
  return out;
}
export const addAnswer = (daily, ms, skill, correct) => bump(daily, ms, (d) => { const p = d.ex[skill] || [0, 0]; d.ex[skill] = [p[0] + 1, p[1] + (correct ? 1 : 0)]; });
export const addReview = (daily, ms, correct) => bump(daily, ms, (d) => { d.rv = [d.rv[0] + 1, d.rv[1] + (correct ? 1 : 0)]; });

export const isActive = (d) => !!d && ((d.sec || 0) > 0 || (d.sp || 0) > 0 || (d.ls || 0) > 0 || (d.lc || 0) > 0 || ((d.rv || [0])[0]) > 0 || Object.values(d.ex || {}).some((x) => x[0] > 0));
export function windowKeys(now, days, offset = 0) {
  const today = dayKey(now);
  return Array.from({ length: days }, (_, i) => shiftDay(today, -(offset + days - 1 - i)));
}
export function sumDays(daily, keys) {
  const o = { sec: 0, ex: {}, n: 0, c: 0, rv: [0, 0], mis: 0, res: 0, sp: 0, ss: 0, ls: 0, lc: 0, active: 0 };
  keys.forEach((k) => {
    const d = (daily || {})[k]; if (!d) return;
    ['sec', 'mis', 'res', 'sp', 'ss', 'ls', 'lc'].forEach((f) => { o[f] += d[f] || 0; });
    if (d.rv) o.rv = [o.rv[0] + d.rv[0], o.rv[1] + d.rv[1]];
    Object.entries(d.ex || {}).forEach(([sk, v]) => { const p = o.ex[sk] || [0, 0]; o.ex[sk] = [p[0] + v[0], p[1] + v[1]]; o.n += v[0]; o.c += v[1]; });
    if (isActive(d)) o.active += 1;
  });
  return o;
}

// How much evidence is behind a number. Small samples are never shown as a confident score.
export const confidenceOf = (n) => (n < 5 ? 'none' : n < 20 ? 'low' : n < 50 ? 'medium' : 'high');
export const statusOf = (n, pct) => (n < 5 ? 'unknown' : pct < 0.6 ? 'needs' : pct < 0.8 ? 'developing' : 'strong');
export function stat(pair) {
  const [n, c] = pair || [0, 0]; const pct = n ? c / n : null;
  return { n, c, pct, confidence: confidenceOf(n), status: statusOf(n, pct) };
}
export function skillStats(daily, now, days = 30) {
  const sum = sumDays(daily, windowKeys(now, days));
  const out = { all: stat([sum.n, sum.c]) };
  ['listening', 'vocabulary', 'sentence', 'grammar'].forEach((k) => { out[k] = stat(sum.ex[k]); });
  return out;
}
export function streakInfo(daily, now) {
  const d = daily || {}; const today = dayKey(now); const activeToday = isActive(d[today]);
  let cur = 0; let k = activeToday ? today : shiftDay(today, -1);
  while (isActive(d[k])) { cur += 1; k = shiftDay(k, -1); }
  let longest = 0; let run = 0; let prev = null;
  Object.keys(d).filter((x) => isActive(d[x])).sort().forEach((x) => { run = prev && shiftDay(prev, 1) === x ? run + 1 : 1; longest = Math.max(longest, run); prev = x; });
  return { current: cur, longest: Math.max(longest, cur), activeToday };
}
export function weekReport(daily, now) {
  const keys = windowKeys(now, 7);
  return { cur: sumDays(daily, keys), prev: sumDays(daily, windowKeys(now, 7, 7)), days: keys.map((k) => ({ key: k, sec: ((daily || {})[k] || {}).sec || 0, active: isActive((daily || {})[k]) })) };
}
// Compares the last 14 days with the 14 before. Only when both periods have enough answers.
export function trend(daily, now) {
  const a = sumDays(daily, windowKeys(now, 14)); const b = sumDays(daily, windowKeys(now, 14, 14));
  if (a.n < 10 || b.n < 10) return null;
  const diff = a.c / a.n - b.c / b.n;
  return { now: a.c / a.n, before: b.c / b.n, direction: diff >= 0.05 ? 'better' : diff <= -0.05 ? 'worse' : 'steady' };
}
export const minutesOf = (sec) => (sec > 0 ? Math.max(1, Math.round(sec / 60)) : 0);
