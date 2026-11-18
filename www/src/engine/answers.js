// Answer checking with multiple valid answers (plan sections 6.5 and 8).
const CONTR = { "i'm": 'i am', "you're": 'you are', "he's": 'he is', "she's": 'she is', "it's": 'it is', "we're": 'we are', "they're": 'they are', "isn't": 'is not', "aren't": 'are not', "don't": 'do not', "doesn't": 'does not', "what's": 'what is', "can't": 'cannot' };
export function normalize(s) {
  const x = String(s || '').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return x ? x.split(' ').map((w) => CONTR[w] || w).join(' ') : '';
}
export function checkAnswer(step, value) {
  if (step.type === 'choose' || step.type === 'listen_choose') return { correct: Number(value) === step.answer, expected: step.options[step.answer] };
  const n = normalize(Array.isArray(value) ? value.join(' ') : value);
  if (step.type === 'pattern') {
    const r = step.rule;
    const ok = n.split(' ').filter(Boolean).length >= r.min_words && (!r.starts || !r.starts.length || r.starts.some((p) => n.startsWith(p + ' '))) && (!r.contains || (' ' + n + ' ').includes(' ' + normalize(r.contains) + ' '));
    return { correct: ok, expected: step.example_en };
  }
  return { correct: n !== '' && step.accept.map(normalize).includes(n), expected: step.accept[0] };
}
