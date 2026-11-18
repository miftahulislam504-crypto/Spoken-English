import { WEEKS } from '../content/curriculum-outline.js';
const START = { 'Pre-A1': 0, A1: 1, A2: 2 };
export const startWeekIndex = (level) => (START[level] !== undefined ? START[level] : 0);
export function buildPath(s, current) {
  const start = current !== undefined ? current : START[s.level] !== undefined ? START[s.level] : 0;
  const weeks = WEEKS.map((w, i) => ({ ...w, status: i < start ? 'review' : i === start ? 'current' : 'later' }));
  return { weeks, current: weeks[start] };
}
