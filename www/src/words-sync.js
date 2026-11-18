// Saved words travel with the account (Phase 11): the phone's words and the account's words are merged, removals are passed on, and counters only grow.
import { api } from './auth.js';
import { getState, setState } from './store.js';
import { mergeWords } from './engine/merge.js';
import { vocabQid } from './engine/study.js';
import { newQueueItem } from './engine/srs.js';

const send = (w) => ({ id: w.id, en: w.en, bn: (w.bn || '').slice(0, 200), example: (w.example || '').slice(0, 300), source: w.source === 'custom' ? 'custom' : 'lesson', in_review: w.in_review !== false, recognition: w.recognition, active: w.active });
const fits = (w) => w && typeof w.id === 'string' && w.id.length <= 80 && typeof w.en === 'string' && w.en.length >= 1 && w.en.length <= 120;
export async function syncWords() {
  const s = getState(); const local = s.phrasebook || []; const known = s.words_known || [];
  const remote = ((await api('GET', '/me/words')) || {}).words || [];
  const removed = known.filter((id) => !local.some((w) => w.id === id)); // taken out on this phone since the last sync
  const merged = mergeWords(local, remote.filter((w) => !removed.includes(w.id))).slice(0, 300);
  const added = merged.filter((w) => !local.some((x) => x.id === w.id));
  const review = { ...(s.review || {}) }; const now = Date.now();
  added.forEach((w) => { const q = vocabQid(w.id); if (w.in_review !== false && !review[q]) review[q] = newQueueItem(q, 'vocab', now); });
  setState({ phrasebook: merged, review });
  await api('PUT', '/me/words', { words: merged.filter(fits).map(send), removed: removed.slice(0, 300) });
  setState({ words_known: merged.map((w) => w.id) });
}
