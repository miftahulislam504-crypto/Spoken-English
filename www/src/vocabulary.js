import { t } from './i18n/index.js';
import { getState, setState } from './store.js';
import { esc } from './util.js';
import { canSpeak } from './audio.js';
import { vocabList, newItem } from './engine/vocab.js';
import { addVocabQueue, removeVocabQueue } from './engine/study.js';

const back = () => `<a class="back" href="#/learn">${t('lp.back')}</a>`;
const head = (title) => `<header class="top"><h1>${title}</h1></header>`;
const playBtn = (x) => (canSpeak() ? `<button class="chip" data-act="play" data-text="${esc(x)}">${t('ob.play')}</button>` : '');

export function vocabulary(s) {
  const list = vocabList(s);
  const rows = list.map((w) => {
    const saved = s.phrasebook.some((p) => p.id === w.id);
    return `<li class="row"><span class="stack grow"><strong>${esc(w.en)}</strong>${s.bengali_support === 'off' ? '' : `<span lang="bn">${esc(w.bn)}</span>`}<small class="muted">${esc(w.example)}</small></span>${playBtn(w.en)}<button class="chip" data-act="vb-save" data-id="${esc(w.id)}" aria-pressed="${saved}">${t(saved ? 'vb.saved' : 'vb.save')}</button></li>`;
  }).join('');
  return back() + head(t('vb.vocabulary')) + (list.length ? `<ul class="rows">${rows}</ul>` : `<p class="muted">${t('vb.vocab.empty')}</p>`);
}

export function phrasebook(s) {
  const items = s.phrasebook.map((p) => `<section class="card"><div class="line"><strong>${esc(p.en)}</strong>${playBtn(p.en)}</div>` +
    (p.bn && s.bengali_support !== 'off' ? `<p lang="bn">${esc(p.bn)}</p>` : '') + (p.example ? `<p class="muted">${t('vb.example')}: ${esc(p.example)}</p>` : '') +
    `<p class="muted">${t('vb.recognition')}: ${t('vb.stats', { c: p.recognition.correct, n: p.recognition.seen })}. ${t('vb.active')}: ${t('vb.stats', { c: p.active.correct, n: p.active.used })}.</p>` +
    `<button class="chip" data-act="vb-remove" data-id="${esc(p.id)}">${t('vb.remove')}</button></section>`).join('');
  return back() + head(t('vb.phrasebook')) +
    `<section class="card"><h2>${t('vb.addTitle')}</h2><input id="vb-en" class="field" type="text" autocomplete="off" aria-label="${t('vb.en')}" placeholder="${t('vb.en')}"><input id="vb-bn" class="field" type="text" autocomplete="off" aria-label="${t('vb.bn')}" placeholder="${t('vb.bn')}"><button class="btn secondary" data-act="vb-add">${t('vb.add')}</button></section>` +
    (s.phrasebook.length ? `<a class="next" href="#/vocab-practice"><span class="next-title">${t('vb.practice')}</span></a><h2 class="sec">${t('vb.yourWords')}</h2>${items}` : `<p class="muted">${t('vb.empty')}</p>`);
}

export function vbAct(el) {
  const s = getState(); const d = el.dataset;
  if (d.act === 'vb-save') {
    if (s.phrasebook.some((p) => p.id === d.id)) return setState({ phrasebook: s.phrasebook.filter((p) => p.id !== d.id), ...removeVocabQueue(s, d.id) });
    const w = vocabList(s).find((x) => x.id === d.id);
    return w && setState({ phrasebook: [...s.phrasebook, newItem({ id: w.id, en: w.en, bn: w.bn, example: w.example, source: 'lesson' })], ...addVocabQueue(s, w.id) });
  }
  if (d.act === 'vb-remove') return setState({ phrasebook: s.phrasebook.filter((p) => p.id !== d.id), ...removeVocabQueue(s, d.id) });
  if (d.act === 'vb-add') {
    const en = ((document.getElementById('vb-en') || {}).value || '').trim();
    const bn = ((document.getElementById('vb-bn') || {}).value || '').trim();
    const id = 'c:' + en.toLowerCase();
    if (!en || s.phrasebook.some((p) => p.id === id)) return;
    setState({ phrasebook: [...s.phrasebook, newItem({ id, en, bn, example: '', source: 'custom' })], ...addVocabQueue(s, id) });
  }
}
