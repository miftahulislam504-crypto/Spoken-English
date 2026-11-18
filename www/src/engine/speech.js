import { normalize } from './answers.js';
// Word-by-word comparison of a target sentence and what the speech recognizer heard (plan section 6.4).
// This measures recognition, not pronunciation quality.
export function compareWords(target, said) {
  const a = normalize(target).split(' ').filter(Boolean); const b = normalize(said).split(' ').filter(Boolean);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const hitA = new Set(); const hitB = new Set(); let i = a.length; let j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { hitA.add(i - 1); hitB.add(j - 1); i--; j--; } else if (dp[i - 1][j] >= dp[i][j - 1]) i--; else j--;
  }
  const missing = a.filter((_, k) => !hitA.has(k)); const extra = b.filter((_, k) => !hitB.has(k));
  return { matched: !missing.length && !extra.length, accuracy: a.length ? Math.round((hitA.size / a.length) * 100) / 100 : 0, missing, extra };
}
// Fluency observations, only when there is enough audio to measure (no score, no judgement).
export function fluencyObs(text, durationS, segments = []) {
  const words = normalize(text).split(' ').filter(Boolean).length;
  if (!words || !durationS || durationS < 2) return null;
  let pauses = 0;
  for (let i = 1; i < segments.length; i++) if (segments[i].start - segments[i - 1].end > 1.0) pauses++;
  return { words, wpm: Math.round((words / durationS) * 60), pauses };
}
