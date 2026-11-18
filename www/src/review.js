import { t } from './i18n/index.js';
import { getState, setState } from './store.js';
import { esc } from './util.js';
import { canSpeak } from './audio.js';
import { dueList, upcomingList, markKnown } from './engine/study.js';
import { dueText } from './engine/srs.js';
import { openMistakes, resolvedMistakes, categoryOf } from './engine/mistakes.js';
import { getLesson, lessonExplanation } from './engine/lessons.js';
import { syncSoon } from './sync.js';

let filter = 'open';
const back = (href, label) => `<a class="back" href="${href}">${label}</a>`;
const head = (title) => `<header class="top"><h1>${title}</h1></header>`;
export const whenText = (due, now) => { const d = dueText(due, now); return d.startsWith('days:') ? t('rv.due.days', { n: d.slice(5) }) : t('rv.due.' + d); };
const hearBtn = (x) => (canSpeak() ? `<button class="chip" data-act="play" data-text="${esc(x)}">${t('sk.hear')}</button>` : '');

function itemLabel(s, it) {
  if (it.type === 'mistake') { const m = s.mistakes.find((x) => x.id === it.id.slice(2)); return m ? (m.kind === 'step' && m.prompt ? m.prompt : m.expected) : ''; }
  const p = s.phrasebook.find((x) => x.id === it.id.slice(2));
  return p ? p.en : '';
}

// ---- Review Queue (plan section 6.8) ----
export function review(s) {
  const now = Date.now(); const due = dueList(s, now); const up = upcomingList(s, now);
  const running = !!(s.practice_run && s.practice_run.kind === 'review');
  const all = [...due, ...up]; const shown = all.slice(0, 12);
  let top;
  if (!all.length && !running) top = `<p class="muted">${t('rv.empty')}</p>`;
  else top = `<section class="card"><h2>${t('rv.dueNow', { n: due.length })}</h2><p>${t('rv.comingUp', { n: up.length })}</p>` +
    (due.length || running ? `<a class="btn" href="#/review-session">${t(running ? 'rv.continue' : 'rv.start')}</a><p class="muted">${t('rv.size')}</p>` : `<p class="muted">${t('rv.none')}</p>${up.length ? `<p class="muted">${t('rv.next', { when: whenText(up[0].due, now) })}</p>` : ''}`) + '</section>';
  const rows = shown.map((it) => `<li class="row"><span class="stack grow"><strong>${esc(itemLabel(s, it))}</strong><small class="muted">${t('rv.type.' + it.type)}</small></span><span class="badge">${whenText(it.due, now)}</span></li>`).join('');
  return back('#/learn', t('lp.back')) + head(t('rv.title')) + top +
    (rows ? `<h2 class="sec">${t('rv.upcoming')}</h2><ul class="rows">${rows}</ul>${all.length > shown.length ? `<p class="muted">${t('rv.more', { n: all.length - shown.length })}</p>` : ''}` : '') +
    `<a class="btn secondary" href="#/mistakes">${t('rv.notebook')}</a>` +
    `<details><summary>${t('rv.how')}</summary><p class="muted">${t('rv.how.body')}</p></details>`;
}

// ---- Mistake Notebook ----
function bnLine(s, x) {
  if (!x || s.bengali_support === 'off') return '';
  return s.bengali_support === 'reduced' ? `<details><summary>${t('learn.showBengali')}</summary><p lang="bn">${esc(x)}</p></details>` : `<p lang="bn" class="bn">${esc(x)}</p>`;
}
function mistakeCard(s, m) {
  const why = m.explanation_bn || lessonExplanation(m.lesson_id);
  const lesson = m.lesson_id && getLesson(m.lesson_id) ? `<a class="chip" href="#/lesson/${m.lesson_id}">${t('mn.openLesson')}</a>` : '';
  const known = m.resolved_at ? `<p class="muted">${t('mn.by.' + (m.resolved_by || 'review'))}</p>` : `<button class="chip" data-act="rv-known" data-id="${esc(m.id)}">${t('mn.known')}</button>`;
  return `<section class="card"><p class="muted">${t('cat.' + categoryOf(m))}</p>` + (m.prompt ? `<p>${esc(m.prompt)}</p>` : '') +
    (m.user ? `<p>${t(m.kind === 'speaking' ? 'mn.said' : 'mn.yours')}: ${esc(m.user)}</p>` : '') +
    `<p>${t('mn.better')}: <strong>${esc(m.expected)}</strong></p>` + (m.alternative ? `<p class="muted">${t('mn.alt')}: ${esc(m.alternative)}</p>` : '') + bnLine(s, why) +
    `<p class="muted">${m.count > 1 ? t('mn.seen.many', { n: m.count }) : t('mn.seen.one')}</p><div class="chips">${hearBtn(m.expected)}${lesson}${known}</div></section>`;
}
export function mistakes(s) {
  const open = openMistakes(s.mistakes); const res = resolvedMistakes(s.mistakes);
  const list = filter === 'resolved' ? res : open;
  const chip = (v, label, n) => `<button class="chip" data-act="rv-filter" data-value="${v}" aria-pressed="${filter === v}">${label} (${n})</button>`;
  return back('#/learn', t('lp.back')) + head(t('mn.title')) +
    `<div class="chips">${chip('open', t('mn.open'), open.length)}${chip('resolved', t('mn.resolved'), res.length)}</div>` +
    (filter === 'open' && open.length ? `<a class="btn" href="#/review">${t('mn.review')}</a>` : '') +
    (list.length ? list.map((m) => mistakeCard(s, m)).join('') : `<p class="muted">${t(filter === 'resolved' ? 'mn.empty.resolved' : 'mn.empty.open')}</p>`);
}

export function rvAct(el) {
  const s = getState(); const d = el.dataset;
  switch (d.act) {
    case 'rv-filter': filter = d.value; return setState({});
    case 'rv-known': setState(markKnown(s, d.id)); syncSoon(); return;
    case 'rv-dismiss-level': return setState({ level_notice: null });
    case 'rv-reduce-bn': return setState({ bengali_support: 'reduced' });
  }
}
