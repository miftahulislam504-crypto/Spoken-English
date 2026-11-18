// Builds a Review Queue session from the items that are due (plan section 6.8).
// Support is reduced as an item is remembered: Bengali hints move behind a tap, options are shuffled, and answers move from choosing to writing.
import { lessonStep, lessonExplanation } from './lessons.js';
import { buildListening } from './listening.js';
import { vocabStep } from './vocab.js';
import { dueList } from './study.js';
import { SESSION_MAX } from './srs.js';

export function hashSeed(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function shuffled(arr, seed) {
  const r = rng(seed); const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// An exercise by reference: a lesson step ("l4:4") or a listening step ("listen:ld1:2").
export function resolveStep(ref) {
  if (!ref) return null;
  if (String(ref).startsWith('listen:')) {
    const [, id, i] = String(ref).split(':'); const st = buildListening(id)[Number(i)];
    return st && ['listen_choose', 'type'].includes(st.type) ? st : null;
  }
  return lessonStep(ref);
}
function shuffleOptions(step, seed) {
  if (!step.options || step.options.length < 2) return step;
  const idx = shuffled(step.options.map((_, i) => i), seed);
  return { ...step, options: idx.map((i) => step.options[i]), answer: idx.indexOf(step.answer) };
}
function fixStep(m, box, seed) {
  const accept = [m.expected, m.alternative].filter(Boolean);
  const base = { stage: 'practice', hint_bn: 'বাক্যটি ঠিক করে লিখুন।', explain_bn: m.explanation_bn || '' };
  const words = m.expected.split(/\s+/).filter(Boolean);
  if (box < 2 && words.length >= 2 && words.length <= 12) {
    let tiles = shuffled(words, seed);
    if (tiles.join(' ') === words.join(' ')) tiles = [...words.slice(1), words[0]];
    return { ...base, type: 'order', prompt_en: `Fix the sentence: "${m.user}"`, tiles, accept };
  }
  return { ...base, type: 'type', prompt_en: `Fix the sentence: "${m.user}"`, accept };
}
export function buildReviewStep(s, it, i = 0) {
  const seed = hashSeed(`${it.id}:${it.reps}:${it.lapses}`);
  if (it.type === 'mistake') {
    const m = s.mistakes.find((x) => x.id === it.id.slice(2));
    if (!m) return null;
    const extra = { review_id: it.id, hint_tap: it.box >= 2, explain_bn: m.explanation_bn || lessonExplanation(m.lesson_id) };
    if (m.kind === 'speaking') return { ...fixStep(m, it.box, seed), ...extra };
    const step = resolveStep(m.ref);
    if (!step) return null;
    return { ...(step.type === 'choose' || step.type === 'listen_choose' ? shuffleOptions(step, seed) : step), stage: 'practice', ref: m.ref, ...extra };
  }
  const p = s.phrasebook.find((x) => x.id === it.id.slice(2));
  if (!p) return null;
  const st = (it.box < 2 && vocabStep(s, p, 'recognition', i)) || vocabStep(s, p, 'active', i);
  return { ...st, review_id: it.id, hint_tap: it.box >= 2 };
}
export function buildReview(s, now, max = SESSION_MAX) {
  const steps = [];
  dueList(s, now).forEach((it) => { if (steps.length >= max) return; const st = buildReviewStep(s, it, steps.length); if (st) steps.push(st); });
  return steps;
}
