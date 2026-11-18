// Which skill an exercise practises (plan sections 6.8 and 14). Used for progress numbers and mistake records.
export const SKILLS = ['listening', 'vocabulary', 'sentence', 'grammar'];
const GRAMMAR = /correct (word|sentence|question)|negative sentence|which word asks/i;
export const isExercise = (step) => !!step && ['choose', 'listen_choose', 'order', 'type', 'pattern'].includes(step.type);
export function skillOf(step) {
  if (!step) return 'grammar';
  if (step.vocab_id) return 'vocabulary';
  if (step.type === 'listen_choose' || step.audio_en) return 'listening';
  if (step.type === 'order' || step.type === 'pattern' || step.type === 'type') return 'sentence';
  return GRAMMAR.test(step.prompt_en || '') ? 'grammar' : 'vocabulary';
}
