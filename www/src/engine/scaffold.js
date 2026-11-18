// Scaffolding reduction (plan section 9). Support goes down as a skill gets stronger, and the learner can always bring it back.
import { skillOf } from './skills.js';
import { skillStats } from './metrics.js';

// How the Bengali hint under an exercise is shown: 'show', 'tap' (behind a button) or 'off'.
export function hintMode(s, step, now = Date.now()) {
  if (s.bengali_support === 'off') return 'off';
  if (s.bengali_support === 'reduced' || (step && step.hint_tap)) return 'tap';
  const st = skillStats(s.daily, now, 30)[skillOf(step)];
  return st && st.n >= 20 && st.pct >= 0.85 ? 'tap' : 'show';
}
// Bengali explanations in teaching steps follow the learner's own setting only.
export const bnMode = (s) => (s.bengali_support === 'off' ? 'off' : s.bengali_support === 'reduced' ? 'tap' : 'show');
// Suggested replies in Guided Conversation are hidden once the learner has reached the goal of that scenario twice.
export const hintsFaded = (log, scenarioId) => (log || []).filter((x) => x.mode === 'guided' && x.scenario_id === scenarioId && x.goal_met).length >= 2;
// Offer to reduce Bengali support when the evidence is strong. The learner decides.
export function offerLessSupport(s, now) {
  const a = skillStats(s.daily, now, 30).all;
  return s.bengali_support === 'full' && a.n >= 40 && a.pct >= 0.85;
}
