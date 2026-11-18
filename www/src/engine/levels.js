// Six levels from plan section 2. The placement check only places up to A2;
// higher levels are reached later through practice evidence (Phase 8).
export const LEVELS = ['Pre-A1', 'A1', 'A2', 'B1', 'B2', 'Advanced'];
export function placeLevel(comfort, results) {
  const scored = results.filter((r) => r.correct !== null);
  const right = scored.filter((r) => r.correct).length;
  let idx = 0;
  if (scored.length) {
    if (right === scored.length) idx = comfort === 'start' ? 1 : 2;
    else if (right / scored.length >= 0.5) idx = 1;
  }
  const skills = {};
  scored.forEach((r) => { skills[r.skill] = { level: r.correct ? 'A1' : 'Pre-A1', confidence: 'low' }; });
  skills.speaking = { level: null, confidence: 'none' }; // not assessed until AI Speak exists
  return { level: LEVELS[idx], skills };
}
