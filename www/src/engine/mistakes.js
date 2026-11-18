// Mistake records (plan section 6.8). One record per mistake, counted when it repeats.
import { normalize } from './answers.js';
export const MAX_MISTAKES = 200;
// The same key is used by the app and by the database, so a correction is never stored twice.
export const simpleKey = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
export const speakMistakeId = (corrected) => 'sp:' + simpleKey(corrected);
export const stepMistakeId = (ref) => 'x:' + ref;
export const lessonOfRef = (ref) => (ref && !String(ref).startsWith('listen:') ? String(ref).split(':')[0] : null);
const TEXT = ['kind', 'ref', 'lesson_id', 'skill', 'error_type', 'prompt', 'user', 'expected', 'explanation_bn', 'alternative'];
// Text is clipped to the limits the account accepts, so a very long answer can never block syncing.
const LIMIT = { explanation_bn: 400, kind: 20, skill: 20, error_type: 40, ref: 60, lesson_id: 64 };
const pick = (rec) => TEXT.reduce((o, k) => { if (rec[k] !== undefined && rec[k] !== null) o[k] = typeof rec[k] === 'string' ? rec[k].slice(0, LIMIT[k] || 300) : rec[k]; return o; }, {});

function trim(list) {
  const out = [...list];
  while (out.length > MAX_MISTAKES) {
    let i = out.length - 1;
    for (let k = out.length - 1; k >= 0; k--) if (out[k].resolved_at) { i = k; break; }
    out.splice(i, 1);
  }
  return out;
}
export function addMistake(list, rec, now) {
  const i = list.findIndex((m) => m.id === rec.id);
  if (i >= 0) {
    const m = list[i];
    const next = { ...m, ...pick(rec), count: m.count + 1, last_at: now, resolved_at: null, resolved_by: null };
    return { list: [next, ...list.filter((_, k) => k !== i)], reopened: !!m.resolved_at, isNew: false };
  }
  const base = { kind: 'step', ref: null, lesson_id: null, skill: null, error_type: null, prompt: '', user: '', expected: '', explanation_bn: '', alternative: '' };
  const m = { id: rec.id, ...base, ...pick(rec), count: 1, first_at: now, last_at: now, resolved_at: null, resolved_by: null };
  return { list: trim([m, ...list]), reopened: false, isNew: true };
}
export const resolveMistake = (list, id, now, by) => list.map((m) => (m.id === id && !m.resolved_at ? { ...m, resolved_at: now, resolved_by: by } : m));
export const openMistakes = (list) => list.filter((m) => !m.resolved_at);
export const resolvedMistakes = (list) => list.filter((m) => m.resolved_at);
export const categoryOf = (m) => m.error_type || m.skill || 'other';
// Corrections the learner can say aloud again (Review My Mistakes in AI Speak).
export function speakable(list, max = 5) {
  const seen = new Set(); const out = [];
  [...openMistakes(list)].sort((a, b) => b.count - a.count || b.last_at - a.last_at).forEach((m) => {
    const key = normalize(m.expected);
    if (out.length >= max || !m.expected || key.split(' ').length < 3 || seen.has(key)) return;
    seen.add(key); out.push({ text: m.expected, mid: m.id });
  });
  return out;
}
