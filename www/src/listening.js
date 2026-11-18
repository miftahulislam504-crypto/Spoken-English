import { t } from './i18n/index.js';
import { icon } from './icons.js';
import { esc } from './util.js';
import { getState } from './store.js';
import { canSpeak, speak, speakLines, RATE } from './audio.js';
import { items, SECTIONS, SPEED_SAMPLE, ACCENT_PHRASES } from './content/listening.js';

const chip = (key, val, label, cur) => `<button class="chip" data-set="${key}" data-value="${val}" aria-pressed="${String(cur) === String(val)}">${label}</button>`;
const count = (it) => (it.qs ? it.qs.length : it.sentences ? it.sentences.length : 1);

export function listening(s) {
  const row = (it) => {
    const p = s.listen_progress[it.id];
    return `<li class="row"><a class="stack grow" href="#/listen/${it.id}"><strong>${it.title_en}</strong><small class="muted">${it.level} - ${t('ls.questions', { n: count(it) })}</small></a><span class="badge">${p ? t('ls.best', { n: p.best }) : t('ls.new')}</span></li>`;
  };
  const sections = SECTIONS.map((k) => `<h2 class="sec">${t('ls.sections.' + k)}</h2><ul class="rows">${items.filter((i) => i.section === k).map(row).join('')}</ul>`).join('');
  const accents = ['us', 'uk', 'in', 'au'];
  const accentRows = ACCENT_PHRASES.map((p) => `<div class="card"><p>${esc(p)}</p><div class="chips">${accents.map((a) => `<button class="chip" data-act="ls-play-accent" data-accent="${a}" data-text="${esc(p)}">${t('ls.accent.' + a)}</button>`).join('')}</div></div>`).join('');
  return `<header class="top"><h1>${t('listening.title')}</h1><a class="icon-btn" href="#/settings" aria-label="${t('settings.open')}">${icon('user')}</a></header>` +
    (canSpeak() ? '' : `<p class="card">${t('ls.noaudio')}</p>`) +
    `<section class="card"><h2>${t('ls.speed')}</h2><div class="chips">${['slow', 'normal', 'natural'].map((v) => chip('listen_speed', v, t('ls.speed.' + v), s.listen_speed)).join('')}</div>` +
    `<button class="btn secondary" data-act="play" data-text="${esc(SPEED_SAMPLE)}">${t('ls.try')}</button></section>` +
    sections + `<h2 class="sec">${t('ls.accent')}</h2><p class="muted">${t('ls.accent.note')}</p>${accentRows}`;
}

export function lsAct(el) {
  const s = getState(); const d = el.dataset;
  if (d.act === 'ls-play-lines') { const it = items.find((x) => x.id === d.id); if (it) speakLines(it.lines, s.accent, RATE[s.listen_speed]); }
  if (d.act === 'ls-play-accent') speak(d.text, d.accent, RATE[s.listen_speed]);
}
