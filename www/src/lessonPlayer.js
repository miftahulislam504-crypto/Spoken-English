import { t } from './i18n/index.js';
import { getState, setState } from './store.js';
import { checkAnswer } from './engine/answers.js';
import { getLesson, isUnlocked, nextLesson, practiceEligible } from './engine/lessons.js';
import { esc, practicePatch } from './util.js';
import { canSpeak } from './audio.js';
import { buildVocabPractice } from './engine/vocab.js';
import { buildListening } from './engine/listening.js';
import { syncSoon } from './sync.js';
import { track } from './analytics.js';
import { skillOf } from './engine/skills.js';
import { recordAnswer } from './engine/study.js';
import { levelPatch } from './engine/evidence.js';
import { buildReview } from './engine/review.js';
import { hintMode, bnMode } from './engine/scaffold.js';

const isRun = (id) => id === 'practice' || id === 'vocab' || id === 'review' || String(id).startsWith('listen:');
const runKind = (id) => (isRun(id) ? (String(id).startsWith('listen:') ? 'listening' : id) : 'lesson');
const BN_HINT = { choose: 'সঠিক উত্তরটি বেছে নিন।', listen_choose: 'শুনুন এবং সঠিক উত্তরটি বেছে নিন।', order: 'শব্দগুলো সাজিয়ে বাক্য বানান।', type: 'ইংরেজিতে লিখুন।', pattern: 'নিজের বাক্য লিখুন।' };

let ui;
const resetUi = () => { ui = { sel: null, tiles: [], tries: 0, res: null, val: '', expected: '' }; };
resetUi();

const btn = (label, attrs, cls = '') => `<button class="btn ${cls}" ${attrs}>${label}</button>`;
const play = (x) => (canSpeak() ? btn(t('ob.play'), `data-act="play" data-text="${esc(x)}"`, 'secondary') : `<p class="card pattern">${esc(x)}</p>`);
// Bengali support follows the learner's setting. Hints also move behind a tap when the skill is strong or the item is well remembered (scaffolding reduction).
const hint = (s, step) => {
  const x = step.hint_bn || BN_HINT[step.type]; const m = x ? hintMode(s, step) : 'off';
  if (m === 'off') return '';
  return m === 'tap' ? `<details><summary>${t('lp.showHint')}</summary><p lang="bn" class="muted">${esc(x)}</p></details>` : `<p lang="bn" class="muted">${esc(x)}</p>`;
};
const bnBlock = (s, x) => {
  const m = bnMode(s);
  if (!x || m === 'off') return '';
  return m === 'tap' ? `<details><summary>${t('learn.showBengali')}</summary><p lang="bn" class="bn">${esc(x)}</p></details>` : `<p lang="bn" class="bn">${esc(x)}</p>`;
};
const freshRun = () => ({ step_index: 0, correct: 0, total: 0, missed: [] });

function ctx(s, param) {
  if (isRun(param)) {
    const r = s.practice_run && s.practice_run.kind === param ? s.practice_run : null;
    return r ? { id: param, lesson: { id: param, title_en: t('lp.practice'), steps: [...r.steps, { stage: 'review', type: 'review' }], completion_criteria: { min_score: 0 } }, run: r } : null;
  }
  const lesson = getLesson(param); const p = s.lesson_progress[param];
  return lesson && p && p.run ? { id: param, lesson, run: p.run } : null;
}
function saveRun(s, id, run, extra = {}) {
  if (isRun(id)) return setState({ ...extra, practice_run: run });
  setState({ ...extra, lesson_progress: { ...s.lesson_progress, [id]: { ...s.lesson_progress[id], run } } });
}

export function startRun(param) {
  const s = getState(); resetUi();
  if (isRun(param)) {
    if (s.practice_run && s.practice_run.kind === param) return true;
    const steps = param.startsWith('listen:') ? buildListening(param.slice(7)) : param === 'vocab' ? buildVocabPractice(s) : param === 'review' ? buildReview(s, Date.now()) : practiceEligible(s);
    if (!steps.length) return false;
    setState({ practice_run: { ...freshRun(), steps, kind: param } });
    return true;
  }
  const l = getLesson(param);
  if (!l || !isUnlocked(l, s.lesson_progress)) return false;
  const p = s.lesson_progress[param];
  if (p && p.run && p.content_version === l.content_version) return true;
  track('lesson_started', { lesson_id: l.id, week: l.week });
  setState({ lesson_progress: { ...s.lesson_progress, [param]: { status: p ? p.status : 'in_progress', attempt_count: (p ? p.attempt_count : 0) + 1, score: p ? p.score : 0, mastery_score: p ? p.mastery_score : 0, completed_at: p ? p.completed_at : null, last_attempt_at: Date.now(), content_version: l.content_version, run: freshRun() } } });
  return true;
}

const feedback = (s, step) => {
  const why = bnBlock(s, step.explain_bn);
  if (ui.res === 'ok') return `<p class="fb ok">${t('lp.correct')}</p>${why}` + btn(t('lp.continue'), 'data-act="lp-next"');
  if (ui.res === 'retry') return `<p class="fb bad">${t('lp.notquite')}</p>` + btn(t('lp.again'), 'data-act="lp-again"');
  if (ui.res === 'show') return `<p class="fb bad">${t('lp.answer')}: <strong>${esc(ui.expected)}</strong></p>${why}` + btn(t('lp.continue'), 'data-act="lp-next"');
  return '';
};
const checkBtn = (on) => (ui.res ? '' : btn(t('lp.check'), `data-act="lp-check"${on ? '' : ' disabled'}`));
const heading = (s, step) => `<h1>${esc(step.prompt_en)}</h1>${hint(s, step)}`;

const transcript = (step) => (step.audio_en && (ui.res === 'ok' || ui.res === 'show') ? `<details><summary>${t('lp.transcript')}</summary><p class="card pattern">${esc(step.audio_en)}</p></details>` : '');

const STEP = {
  teach: (step, s) => `<h1>${step.grammar_en}</h1><p class="card pattern">${step.pattern_en}</p>` +
    step.examples_en.map((e) => `<div class="card line"><span>${e}</span>${canSpeak() ? `<button class="chip" data-act="play" data-text="${esc(e)}">${t('ob.play')}</button>` : ''}</div>`).join('') +
    `<h2 class="sec">${t('lp.vocab')}</h2><ul class="rows">${step.vocabulary.map((v) => `<li class="row"><span>${v.en}</span>${s.bengali_support === 'off' ? '' : `<span lang="bn" class="muted">${v.bn}</span>`}</li>`).join('')}</ul>` +
    bnBlock(s, step.explanation_bn) + btn(t('lp.continue'), 'data-act="lp-next"'),
  listen: (step, s) => `${play(step.audio_en)}<details><summary>${t('lp.showText')}</summary><p class="card pattern">${step.audio_en}</p></details>${bnBlock(s, step.meaning_bn)}` + btn(t('lp.continue'), 'data-act="lp-next"'),
  repeat: (step) => `<p class="card pattern">${step.text_en}</p>${play(step.text_en)}` + btn(t('ob.repeat.done'), 'data-act="lp-next"'),
  choose: (step, s) => heading(s, step) + (step.type === 'listen_choose' ? play(step.audio_en) : '') +
    step.options.map((o, k) => {
      const locked = ui.res === 'ok' || ui.res === 'show';
      const cls = locked && k === step.answer ? ' ok' : ui.res && ui.sel === k && k !== step.answer ? ' bad' : '';
      return `<button class="opt${cls}" data-act="lp-sel" data-value="${k}" aria-pressed="${ui.sel === k}"${ui.res ? ' disabled' : ''}>${esc(o)}</button>`;
    }).join('') + checkBtn(ui.sel !== null) + feedback(s, step) + transcript(step),
  order: (step, s) => heading(s, step) +
    `<div class="slot">${ui.tiles.map((i, pos) => `<button class="tile" data-act="lp-untile" data-i="${pos}"${ui.res ? ' disabled' : ''}>${esc(step.tiles[i])}</button>`).join('')}</div>` +
    `<div class="tiles">${step.tiles.map((w, i) => (ui.tiles.includes(i) ? '' : `<button class="tile" data-act="lp-tile" data-i="${i}"${ui.res ? ' disabled' : ''}>${esc(w)}</button>`)).join('')}</div>` + checkBtn(ui.tiles.length > 0) + feedback(s, step),
  type: (step, s) => heading(s, step) + (step.audio_en ? play(step.audio_en) : '') + `<input id="ans" class="field" type="text" value="${esc(ui.val)}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="${t('lp.typeHere')}"${ui.res ? ' disabled' : ''}>` + checkBtn(true) + feedback(s, step) + transcript(step),
  review: (step, s, c) => {
    const { correct, total, missed } = c.run; const min = c.lesson.completion_criteria.min_score;
    const pass = total === 0 || correct / total >= min;
    const list = missed.length ? `<h2 class="sec">${t('lp.review.missed')}</h2>` + missed.map((m) => `<div class="card"><p>${esc(m.prompt)}</p><p>${t('lp.review.you')}: ${esc(m.user)}</p><p>${t('lp.review.better')}: <strong>${esc(m.expected)}</strong></p></div>`).join('') : '';
    return `<h1>${t('lp.review.title')}</h1><div class="card"><p>${t('lp.review.score', { correct, total })}</p></div>${c.lesson.assessment ? `<p class="muted">${t('lp.assessment.note')}</p>` : ''}${list}` +
      (pass ? btn(t(isRun(c.id) ? 'lp.finishRun' : 'lp.finish'), 'data-act="lp-finish"') : `<p class="muted">${t('lp.review.retryNote', { min: Math.round(min * 100) })}</p>` + btn(t('lp.review.retry'), 'data-act="lp-retry"'));
  }
};
STEP.listen_choose = STEP.choose; STEP.pattern = STEP.type;
STEP.dialogue = (step) => `<h1>${esc(step.title_en)}</h1>` + (canSpeak() ? btn(t('lp.playAll'), `data-act="ls-play-lines" data-id="${step.item_id}"`, 'secondary') : `<p class="muted">${t('ls.noaudio')}</p>`) +
  `<details${canSpeak() ? '' : ' open'}><summary>${t('lp.transcript')}</summary>${step.lines.map((l) => `<p class="card"><strong>${l.who}:</strong> ${esc(l.text)}</p>`).join('')}</details>` + btn(t('lp.continue'), 'data-act="lp-next"');
STEP.story = (step) => `<h1>${esc(step.title_en)}</h1>${play(step.text_en)}<details><summary>${t('lp.transcript')}</summary><p class="card">${esc(step.text_en)}</p></details>` + btn(t('lp.continue'), 'data-act="lp-next"');
const listenPatch = (s, c) => {
  const id = c.id.slice(7); const score = c.run.total ? Math.round((c.run.correct / c.run.total) * 100) : 100; const prev = s.listen_progress[id] || { attempts: 0, best: 0 };
  return { listen_progress: { ...s.listen_progress, [id]: { attempts: prev.attempts + 1, best: Math.max(prev.best, score), last_score: score, last_at: Date.now() } } };
};

export function lessonView(s, param) {
  const c = ctx(s, param);
  const bk = String(param).startsWith('listen:') ? ['#/listening', t('lp.backListening')] : param === 'review' ? ['#/review', t('lp.backReview')] : ['#/learn', t('lp.back')];
  if (!c) return `<div class="lp"><a class="back" href="${bk[0]}">${bk[1]}</a><p>${t('lp.missing')}</p></div>`;
  const steps = c.lesson.steps; const i = Math.min(c.run.step_index, steps.length - 1); const step = steps[i];
  const pct = Math.round((i / (steps.length - 1)) * 100);
  return `<div class="lp"><a class="back" href="${bk[0]}">${bk[1]}</a><div class="steps" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>` +
    `<p class="muted">${t('stage.' + (step.stage || 'review'))} - ${t('lp.step', { n: i + 1, total: steps.length })}</p>${STEP[step.type](step, s, c)}</div>`;
}

function check(s, c, step) {
  const val = step.type === 'order' ? ui.tiles.map((i) => step.tiles[i]) : step.type === 'type' || step.type === 'pattern' ? (document.getElementById('ans') || {}).value || '' : ui.sel;
  const r = checkAnswer(step, val);
  ui.tries += 1; ui.expected = r.expected;
  ui.val = Array.isArray(val) ? val.join(' ') : val === null ? '' : String(val);
  ui.res = r.correct ? 'ok' : ui.tries >= 2 ? 'show' : 'retry';
  let run = c.run; const extra = {};
  if (ui.tries === 1 && step.scored !== false) {
    const user = step.options ? step.options[val] || '' : ui.val;
    run = { ...run, total: run.total + 1, correct: run.correct + (r.correct ? 1 : 0), missed: r.correct ? run.missed : [...run.missed, { prompt: step.prompt_en, user, expected: r.expected }] };
    if (step.vocab_id) extra.phrasebook = s.phrasebook.map((p) => (p.id !== step.vocab_id ? p : step.mode === 'active' ? { ...p, active: { used: p.active.used + 1, correct: p.active.correct + (r.correct ? 1 : 0) } } : { ...p, recognition: { seen: p.recognition.seen + 1, correct: p.recognition.correct + (r.correct ? 1 : 0) } }));
    const kind = runKind(c.id);
    const ref = step.ref || (kind === 'lesson' || kind === 'listening' ? `${c.id}:${c.run.step_index}` : null);
    Object.assign(extra, recordAnswer(s, { source: kind, skill: skillOf(step), correct: r.correct, ref, review_id: step.review_id, vocab_id: step.vocab_id, user, expected: r.expected, prompt: step.prompt_en }));
  }
  saveRun(s, c.id, run, extra);
}

export function lpAct(el, param) {
  const s = getState(); const d = el.dataset;
  if (d.act === 'lp-bookmark') return setState({ bookmarks: s.bookmarks.includes(d.id) ? s.bookmarks.filter((x) => x !== d.id) : [...s.bookmarks, d.id] });
  const c = ctx(s, param);
  if (!c) return;
  const step = c.lesson.steps[c.run.step_index];
  switch (d.act) {
    case 'lp-sel': ui.sel = Number(d.value); return setState({});
    case 'lp-tile': ui.tiles = [...ui.tiles, Number(d.i)]; return setState({});
    case 'lp-untile': ui.tiles = ui.tiles.filter((_, k) => k !== Number(d.i)); return setState({});
    case 'lp-again': ui.res = null; ui.sel = null; ui.tiles = []; ui.val = ''; return setState({});
    case 'lp-next': resetUi(); return saveRun(s, c.id, { ...c.run, step_index: c.run.step_index + 1 });
    case 'lp-check': return check(s, c, step);
    case 'lp-retry': {
      resetUi();
      if (isRun(c.id)) return setState({ practice_run: { ...freshRun(), steps: s.practice_run.steps, kind: c.id } });
      const p = s.lesson_progress[c.id];
      return setState({ lesson_progress: { ...s.lesson_progress, [c.id]: { ...p, attempt_count: p.attempt_count + 1, last_attempt_at: Date.now(), run: freshRun() } } });
    }
    case 'lp-finish': {
      resetUi(); const now = Date.now();
      if (isRun(c.id)) {
        const lis = c.id.startsWith('listen:');
        const patch = { ...practicePatch(s, c.lesson.steps.length * 40, lis ? (d) => { d.ls += 1; } : undefined), ...(lis ? listenPatch(s, c) : {}), practice_run: null };
        if (lis) track('listening_item_completed', { score_pct: Math.round((c.run.total ? c.run.correct / c.run.total : 1) * 100) }); else if (c.id === 'review') track('review_session_completed', { items: Math.min(100, c.run.total || 0), correct: Math.min(100, c.run.correct || 0) });
        setState({ ...patch, ...(levelPatch({ ...s, ...patch }, now) || {}) });
        location.hash = lis ? '#/listening' : c.id === 'vocab' ? '#/phrasebook' : c.id === 'review' ? '#/review' : '#/learn';
        syncSoon(); return;
      }
      const p = s.lesson_progress[c.id]; const score = c.run.total ? c.run.correct / c.run.total : 1;
      const lp = { ...s.lesson_progress, [c.id]: { ...p, status: 'completed', score, mastery_score: Math.max(p.mastery_score || 0, score), completed_at: now, run: null } };
      track('lesson_completed', { lesson_id: c.id, score_pct: Math.round(score * 100), first_time: !p.completed_at });
      const n = nextLesson(lp);
      const first = !s.first_done;
      const patch = { ...practicePatch(s, c.lesson.estimated_duration_seconds, (d) => { d.lc += 1; }), lesson_progress: lp, ...(first ? { first_done: true } : {}) };
      setState({ ...patch, ...(levelPatch({ ...s, ...patch }, now) || {}) });
      location.hash = first ? '#/home' : n ? '#/lesson/' + n.id : '#/learn';
      syncSoon();
    }
  }
}
