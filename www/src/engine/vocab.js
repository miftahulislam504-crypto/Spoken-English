import { allLessons, isUnlocked } from './lessons.js';
import { normalize } from './answers.js';

// Vocabulary comes from the teach steps of unlocked lessons (plan section 6.7).
export function vocabList(s) {
  const out = [];
  allLessons().filter((l) => isUnlocked(l, s.lesson_progress)).forEach((l) => l.steps.filter((x) => x.type === 'teach').forEach((st) => st.vocabulary.forEach((w) => {
    const id = w.en.toLowerCase();
    if (out.some((o) => o.id === id)) return;
    const key = ' ' + normalize(w.en) + ' ';
    const example = st.examples_en.find((e) => (' ' + normalize(e) + ' ').includes(key)) || st.examples_en[0];
    out.push({ id, en: w.en, bn: w.bn, example, lesson_id: l.id });
  })));
  return out;
}
export const newItem = (o) => ({ ...o, saved_at: Date.now(), in_review: true, recognition: { seen: 0, correct: 0 }, active: { used: 0, correct: 0 } });

const bnPool = (s) => [...vocabList(s).map((w) => w.bn), ...s.phrasebook.map((p) => p.bn)].filter(Boolean);
// One exercise for a saved word: meaning check (recognition) or own sentence (active use). Returns null when a meaning check is not possible.
export function vocabStep(s, it, mode, i = 0) {
  if (mode === 'recognition') {
    const others = [...new Set(bnPool(s).filter((x) => x !== it.bn))];
    if (!it.bn || others.length < 2) return null;
    const opts = [others[i % others.length], others[(i + 1) % others.length]];
    const pos = i % 3;
    opts.splice(pos, 0, it.bn);
    return { stage: 'practice', type: 'choose', prompt_en: `What does "${it.en}" mean?`, options: opts, answer: pos, vocab_id: it.id, mode: 'recognition' };
  }
  return { stage: 'practice', type: 'pattern', prompt_en: `Write a sentence with "${it.en}".`, hint_bn: 'শব্দটি দিয়ে একটি ইংরেজি বাক্য লিখুন।', rule: { starts: [], min_words: 3, contains: it.en }, example_en: it.example || it.en, vocab_id: it.id, mode: 'active' };
}

// Practice set: meaning check (recognition) and own sentence (active use) for the least-practiced saved items.
export function buildVocabPractice(s) {
  const items = [...s.phrasebook].sort((a, b) => a.recognition.seen + a.active.used - (b.recognition.seen + b.active.used)).slice(0, 4);
  const steps = [];
  items.forEach((it, i) => {
    const rec = vocabStep(s, it, 'recognition', i);
    if (rec) steps.push(rec);
    steps.push(vocabStep(s, it, 'active', i));
  });
  return steps;
}
