import { t } from './i18n/index.js';
import { icon } from './icons.js';
import { esc, practiceMinutes } from './util.js';
import { getSession } from './auth.js';
import { canSpeak } from './audio.js';
import { WEEKS } from './content/curriculum-outline.js';
import { items as LISTEN_ITEMS } from './content/listening.js';
import { skillStats, streakInfo, weekReport, trend, minutesOf, windowKeys } from './engine/metrics.js';
import { levelEvidence, speakingEvidence, RULES } from './engine/evidence.js';
import { recommend } from './engine/recommend.js';
import { allLessons, currentWeekIndex, practiceEligible } from './engine/lessons.js';
import { openMistakes, resolvedMistakes, categoryOf } from './engine/mistakes.js';

const pct = (x) => Math.round(x * 100);
const head = (title, right = '') => `<header class="top"><h1>${title}</h1>${right}</header>`;
const profileBtn = () => `<a class="icon-btn" href="#/settings" aria-label="${t('settings.open')}">${icon('user')}</a>`;
const meter = (p, label) => `<div class="bar" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}"><i style="width:${p}%"></i></div>`;
const card = (title, inner, badge = '') => `<section class="card"><div class="line"><h2>${title}</h2>${badge}</div>${inner}</section>`;
const link = (href, label) => `<a class="chip" href="${href}">${label}</a>`;

// ---- recommendations (shared with Home) ----
export function recHtml(r) {
  const p = { ...r.params }; let title; let reason;
  if (r.id === 'weak') p.skill = t('pg.skill.' + p.skill + '.short');
  if (r.id === 'review') title = t(p.n === 1 ? 'rec.review.title1' : 'rec.review.title', p);
  else if (r.id === 'lesson') { title = t(p.first ? 'rec.lesson.first' : 'rec.lesson.title', p); reason = t(p.first ? 'rec.lesson.reasonFirst' : 'rec.lesson.reason'); } else title = t('rec.' + r.id + '.title', p);
  if (!reason) reason = t(r.id === 'speak' || r.id === 'listen' ? (p.gap ? `rec.${r.id}.reason` : `rec.${r.id}.reasonFirst`) : `rec.${r.id}.reason`, p);
  if (r.action) return `<section class="card"><h2>${esc(title)}</h2><p>${esc(reason)}</p><button class="btn secondary" data-act="${r.action}">${t('rec.reduce')}</button></section>`;
  return `<a class="card" href="${r.href}"><h2>${esc(title)}</h2><p>${esc(reason)}</p></a>`;
}
export const recsFor = (s, now) => recommend(s, now, { signedIn: !!getSession() });

// ---- sections ----
function overall(s, now) {
  const all = allLessons(); const done = all.filter((l) => s.lesson_progress[l.id] && s.lesson_progress[l.id].status === 'completed').length;
  const ev = levelEvidence(s, now);
  let next;
  if (!ev) next = `<p class="muted">${t('pg.next.done')}</p>`;
  else if (ev.met) next = `<p>${t('pg.next.ok')}</p>`;
  else {
    const weeks = t('pg.weeks.' + RULES[s.level].weeks.join(''));
    const line = { lessons: (c) => t('pg.next.lessons', { have: c.have, need: c.need, weeks }), answers: (c) => t('pg.next.answers', { have: c.have, need: c.need }), accuracy: (c) => t(ev.checks[1].ok ? 'pg.next.accuracy' : 'pg.next.accuracy.none', { have: c.have, need: c.need }) };
    next = `<p>${t('pg.next', { to: t('level.' + ev.next) })}</p><ul class="plain">${ev.checks.filter((c) => !c.ok).map((c) => `<li>${line[c.key](c)}</li>`).join('')}</ul>`;
  }
  const chk = all.find((l) => l.assessment); const cp = chk && s.lesson_progress[chk.id];
  const checkLine = cp && cp.status === 'completed' && !cp.placed ? t('pg.check', { pct: pct(cp.score || 0), n: cp.attempt_count || 1 }) : t('pg.check.none');
  return card(t('pg.overall'), `<p>${t('pg.level')}: <strong>${t('level.' + s.level)}</strong></p><p class="muted">${t('pg.level.note')}</p>` +
    `<p>${t('pg.lessons', { done, total: all.length })}</p>${meter(all.length ? pct(done / all.length) : 0, t('pg.overall'))}<p class="muted">${t('pg.week', { week: WEEKS[currentWeekIndex(s)].title_en })}</p>${next}<p class="muted">${checkLine}</p>`);
}
function practiceHref(k, s) {
  if (k === 'listening') return '#/listening';
  if (k === 'vocabulary') return s.phrasebook.length ? '#/vocab-practice' : '#/vocabulary';
  return practiceEligible(s).length ? '#/practice' : '#/learn';
}
function skillCard(s, st, k, extra = '') {
  const x = st[k];
  return card(t('pg.skill.' + k), (x.n >= 5 ? `<p>${t('pg.skill.line', { c: x.c, n: x.n })}</p>${meter(pct(x.pct), t('pg.skill.' + k))}` : `<p class="muted">${t('pg.skill.none')}</p>`) +
    `<p class="muted">${t('pg.conf.' + x.confidence)}</p>${extra}<div class="chips">${link(practiceHref(k, s), t('pg.practice'))}</div>`, `<span class="badge">${t('pg.status.' + x.status)}</span>`);
}
function speakingCard(s) {
  const e = speakingEvidence(s.speak_log);
  if (!e.sessions) return card(t('pg.speaking'), `<p class="muted">${t('pg.speaking.none')}</p><div class="chips">${link('#/speak', t('nav.speak'))}</div>`);
  return card(t('pg.speaking'), `<p>${t('pg.speaking.sessions', { n: e.sessions, m: e.goal_met })}</p>` +
    `<p>${e.level ? t('pg.speaking.level', { level: t('level.' + e.level), conf: t('pg.conf.speak.' + e.confidence) }) : t('pg.speaking.level.none')}</p>` +
    (e.avg_wpm ? `<p>${t('pg.speaking.wpm', { n: e.avg_wpm })}</p>` : '') + (e.words_per_turn ? `<p>${t('pg.speaking.wpt', { n: e.words_per_turn })}</p>` : '') + `<p class="muted">${t('pg.speaking.note')}</p>`);
}
function pronCard(s) {
  const e = speakingEvidence(s.speak_log);
  const words = Object.entries(s.missed_words || {}).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w]) => w);
  return card(t('pg.pron'), `<p>${e.recognized_sessions ? t('pg.pron.pct', { pct: e.recognized_pct, n: e.recognized_sessions }) : t('pg.pron.none')}</p>` +
    (words.length ? `<h3 class="wk">${t('pg.pron.words')}</h3><div class="chips">${words.map((w) => (canSpeak() ? `<button class="chip" data-act="play" data-text="${esc(w)}" aria-label="${t('pg.pron.hear')}: ${esc(w)}">${esc(w)}</button>` : `<span class="badge">${esc(w)}</span>`)).join('')}</div>` : '') +
    `<p class="muted">${t('pg.pron.note')}</p>`);
}
function mistakeCard(s, now) {
  const open = openMistakes(s.mistakes); const res = resolvedMistakes(s.mistakes);
  const groups = {}; open.forEach((m) => { const k = categoryOf(m); groups[k] = (groups[k] || 0) + 1; });
  const top = Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const tr = trend(s.daily, now);
  return card(t('pg.mistakes'), (s.mistakes.length ? `<p>${t('pg.mistakes.counts', { open: open.length, resolved: res.length })}</p>` : `<p class="muted">${t('pg.mistakes.none')}</p>`) +
    (top.length ? `<h3 class="wk">${t('pg.mistakes.top')}</h3><ul class="rows">${top.map(([k, n]) => `<li class="row"><span>${t('cat.' + k)}</span><span class="badge">${n}</span></li>`).join('')}</ul>` : '') +
    `<p class="muted">${tr ? t('pg.trend.' + tr.direction, { now: pct(tr.now), before: pct(tr.before) }) : t('pg.trend.none')}</p><div class="chips">${link('#/mistakes', t('pg.mistakes.open'))}</div>`);
}
function weekCard(s, now) {
  const c = weekReport(s.daily, now).cur;
  return card(t('pg.weekly'), `<p>${t('pg.week.line', { days: c.active, min: minutesOf(c.sec), lessons: c.lc })}</p><div class="chips">${link('#/weekly', t('pg.weekly.open'))}</div>`);
}
const dayLabel = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'narrow' }); };
function chart(daily, now, n, label) {
  const keys = windowKeys(now, n); const vals = keys.map((k) => minutesOf(((daily || {})[k] || {}).sec || 0)); const max = Math.max(5, ...vals);
  return `<ul class="days" aria-label="${label}">${keys.map((k, i) => `<li><i style="height:${Math.round((vals[i] / max) * 100)}%"></i><span class="dl" aria-hidden="true">${dayLabel(k)}</span><span class="sr">${t('pg.chart.day', { day: k, min: vals[i] })}</span></li>`).join('')}</ul>`;
}
function streakCard(s, now) {
  const k = streakInfo(s.daily, now); const best = Math.max(k.longest, s.best_streak || 0);
  const total = windowKeys(now, 14).reduce((n, key) => n + (((s.daily || {})[key] || {}).sec || 0), 0);
  return card(t('pg.streak'), `<p>${k.current === 1 ? t('pg.streak.cur1') : t('pg.streak.cur', { n: k.current })}. ${t('pg.streak.best', { n: best })}</p><p class="muted">${t('pg.streak.note')}</p>` +
    `<p>${t('pg.time.today', { done: practiceMinutes(s), goal: s.daily_goal_minutes })}</p>${chart(s.daily, now, 14, t('pg.chart'))}<p>${t('pg.time.total', { min: minutesOf(total) })}</p><p class="muted">${t('pg.time.note')}</p>`);
}

// ---- Progress tab (plan section 3.5) ----
export function progress(s) {
  const now = Date.now(); const st = skillStats(s.daily, now, 30); const recs = recsFor(s, now).slice(0, 3);
  const tried = Object.keys(s.listen_progress || {}).length; const used = s.phrasebook.filter((p) => p.active.used > 0).length;
  return head(t('pg.title'), profileBtn()) + overall(s, now) +
    `<h2 class="sec">${t('rec.title')}</h2>${recs.map(recHtml).join('')}` +
    skillCard(s, st, 'listening', `<p class="muted">${t('pg.listen.items', { n: tried, total: LISTEN_ITEMS.length })}</p>`) + skillCard(s, st, 'sentence') + skillCard(s, st, 'grammar') +
    speakingCard(s) + pronCard(s) + skillCard(s, st, 'vocabulary', `<p class="muted">${t('pg.vocab.saved', { n: s.phrasebook.length, m: used })}</p>`) +
    mistakeCard(s, now) + weekCard(s, now) + streakCard(s, now) +
    `<details><summary>${t('pg.how')}</summary><p class="muted">${t('pg.how.body')}</p></details><p class="muted">${t('pg.data.note')}</p>`;
}

// ---- Weekly Report ----
export function weekly(s) {
  const now = Date.now(); const wr = weekReport(s.daily, now); const c = wr.cur; const p = wr.prev;
  const acc = (x) => (x.n >= 5 ? `${pct(x.c / x.n)}%` : t('wk.na'));
  const rows = [['wk.days', c.active, p.active], ['wk.time', t('wk.min', { n: minutesOf(c.sec) }), t('wk.min', { n: minutesOf(p.sec) })], ['wk.lessons', c.lc, p.lc], ['wk.answers', c.n, p.n], ['wk.accuracy', acc(c), acc(p)],
    ['wk.speak', c.sp, p.sp], ['wk.listen', c.ls, p.ls], ['wk.review', c.rv[0], p.rv[0]], ['wk.mis', c.mis, p.mis], ['wk.res', c.res, p.res]];
  const empty = !c.active && !p.active;
  const focus = recsFor(s, now)[0];
  return `<a class="back" href="#/progress">${t('pg.back')}</a>` + head(t('wk.title')) + (empty ? `<p class="muted">${t('wk.empty')}</p>` : '') +
    `<ul class="rows"><li class="row"><span class="grow muted">&nbsp;</span><strong>${t('wk.this')}</strong><span class="muted">${t('wk.prev')}</span></li>${rows.map(([k, a, b]) => `<li class="row"><span class="grow">${t(k)}</span><strong>${a}</strong><span class="muted">${b}</span></li>`).join('')}</ul>` +
    `<h2 class="sec">${t('pg.streak')}</h2>${chart(s.daily, now, 7, t('wk.chart'))}<h2 class="sec">${t('wk.focus')}</h2>${recHtml(focus)}<p class="muted">${t('wk.note')}</p>`;
}
