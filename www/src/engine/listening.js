import { items } from '../content/listening.js';
// Turns a listening item into player steps (same player as lessons).
export function buildListening(id) {
  const it = items.find((x) => x.id === id);
  if (!it) return [];
  const q = (x, audio) => ({ stage: 'practice', type: 'listen_choose', audio_en: audio, prompt_en: x[0], options: x[1], answer: x[2] });
  if (it.kind === 'dialogue') return [{ stage: 'listen', type: 'dialogue', title_en: it.title_en, lines: it.lines, item_id: it.id }, ...it.qs.map((x) => q(x, it.lines.map((l) => l.text).join(' ')))];
  if (it.kind === 'story') return [{ stage: 'listen', type: 'story', title_en: it.title_en, text_en: it.text }, ...it.qs.map((x) => q(x, it.text))];
  if (it.kind === 'clip') return [q(it.q, it.audio)];
  if (it.kind === 'answer') return [{ stage: 'practice', type: 'type', audio_en: it.audio, prompt_en: it.prompt, accept: it.accept }];
  return it.sentences.map((x) => ({ stage: 'practice', type: 'type', audio_en: x, prompt_en: 'Type what you hear.', accept: [x] }));
}
