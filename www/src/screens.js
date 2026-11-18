import { APP_VERSION } from './config.js';
import { reminderNote } from './reminders.js';
import { t, tl } from './i18n/index.js';
import { icon } from './icons.js';
import { canSpeak } from './audio.js';
import { WEEKS } from './content/curriculum-outline.js';
import { esc, practiceMinutes } from './util.js';
import { getSession } from './auth.js';
import { courses, allLessons, getLesson, lessonStatus, nextLesson, practiceEligible, teachSteps, currentWeekIndex } from './engine/lessons.js';
import { dueList, upcomingList } from './engine/study.js';
import { openMistakes } from './engine/mistakes.js';
import { weekReport, minutesOf } from './engine/metrics.js';
import { recHtml, recsFor } from './progress.js';
import { whenText } from './review.js';
import { buildPath } from './engine/path.js';

const header = (title, right = '') => `<header class="top"><h1>${title}</h1>${right}</header>`;
const profileBtn = () => `<a class="icon-btn" href="#/settings" aria-label="${t('settings.open')}">${icon('user')}</a>`;
const soonList = (key) => `<ul class="rows">${tl(key).map((x) => `<li class="row"><span>${x}</span><span class="badge">${t('common.soon')}</span></li>`).join('')}</ul>`;
const chip = (key, val, label, cur) => `<button class="chip" data-set="${key}" data-value="${val}" aria-pressed="${String(cur) === String(val)}">${label}</button>`;
const chips = (key, vals, label, cur) => `<div class="chips">${vals.map((v) => chip(key, v, label(v), cur)).join('')}</div>`;

export function pathHtml(s) {
  const p = buildPath(s, currentWeekIndex(s));
  const focus = s.goal ? `<p class="muted">${t('path.focus', { goal: t('ob.goal.' + s.goal) })}</p>` : '';
  const rows = p.weeks.map((w) => `<li class="row${w.status === 'current' ? ' cur' : ''}"><span class="stack"><strong>${w.title_en}</strong>${w.status === 'current' ? `<small class="muted">${w.topics_en.join(', ')}</small>` : ''}</span><span class="badge">${t('path.' + w.status)}</span></li>`).join('');
  return `${focus}<ul class="rows">${rows}</ul>`;
}

export function home(s) {
  const now = Date.now();
  const goal = s.daily_goal_minutes;
  const week = buildPath(s, currentWeekIndex(s)).current.title_en;
  const done = practiceMinutes(s);
  const pct = Math.min(100, Math.round((done / goal) * 100));
  const nxt = nextLesson(s.lesson_progress);
  const m = openMistakes(s.mistakes)[0];
  const due = dueList(s, now); const up = upcomingList(s, now);
  const recs = recsFor(s, now); const rec = recs.find((r) => r.id !== 'lesson') || recs[0];
  const wk = weekReport(s.daily, now).cur;
  const n = s.level_notice;
  const notice = n ? `<section class="card notice"><h2>${t('lvl.up', { to: t('level.' + n.to) })}</h2><p>${t('lvl.up.body', { from: t('level.' + n.from), to: t('level.' + n.to), pct: n.pct })}</p><button class="btn secondary" data-act="rv-dismiss-level">${t('lvl.dismiss')}</button></section>` : '';
  return header(t('home.greeting'), profileBtn()) + notice + `
  <p class="level">${t('home.level')}: <strong>${t('level.' + s.level)}</strong></p>
  <a class="next" href="#/speak"><span class="next-title">${t('home.startSpeaking')}</span><span class="next-sub">${t('home.startSpeaking.sub')}</span></a>
  <a class="card" href="${nxt ? '#/lesson/' + nxt.id : '#/learn'}"><h2>${t('home.continue')}</h2><p>${nxt ? nxt.title_en : t('home.next', { week })}</p></a>
  <section class="card"><h2>${t('home.dailyGoal')}</h2>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${done}"><i style="width:${pct}%"></i></div>
    <p>${t('home.dailyGoal.value', { done, goal })}</p></section>
  <a class="card" href="#/review"><h2>${t('home.review')}</h2><p>${due.length ? t(due.length === 1 ? 'home.review.due1' : 'home.review.due', { n: due.length }) : up.length ? t('home.review.next', { when: whenText(up[0].due, now) }) : t('home.review.none')}</p></a>
  <h2 class="sec">${t('home.recommended')}</h2>${recHtml(rec)}
  <section class="card"><h2>${t('home.mistake')}</h2><p>${m ? t('home.mistake.item', { user: esc(m.user), expected: esc(m.expected) }) : t('home.mistake.empty')}</p>${s.mistakes.length ? `<a class="back" href="#/mistakes">${t('home.mistake.all')}</a>` : ''}</section>
  <a class="card" href="#/weekly"><h2>${t('home.weekly')}</h2><p>${wk.active ? t('home.week.line', { days: wk.active, min: minutesOf(wk.sec), lessons: wk.lc }) : t('home.weekly.empty')}</p></a>
  <section class="card"><h2>${t('home.plan')}</h2><p>${t('home.plan.value')}</p></section>`;
}

const statusBadge = (st) => `<span class="badge">${t('status.' + st)}</span>`;
function lessonRow(l, s) {
  const st = lessonStatus(l, s.lesson_progress);
  if (st === 'locked') {
    const need = getLesson(l.prerequisite_lesson_ids.find((id) => !(s.lesson_progress[id] && s.lesson_progress[id].status === 'completed')));
    return `<li class="row"><span class="stack"><strong>${l.title_en}</strong><small class="muted">${t('lesson.needs', { title: need ? need.title_en : '' })}</small></span>${statusBadge(st)}</li>`;
  }
  const bm = s.bookmarks.includes(l.id);
  return `<li class="row"><a class="stack grow" href="#/lesson/${l.id}"><strong>${l.title_en}</strong><small class="muted">${t('lesson.minutes', { n: Math.round(l.estimated_duration_seconds / 60) })} - ${l.learning_objectives[0]}</small></a><button class="chip" data-act="lp-bookmark" data-id="${l.id}" aria-pressed="${bm}">${t(bm ? 'bookmark.on' : 'bookmark.add')}</button>${statusBadge(st)}</li>`;
}
export function learn(s) {
  const nxt = nextLesson(s.lesson_progress);
  const courseHtml = courses.map((c) => `<section class="card"><h2>${c.title_en}</h2><p>${c.description_en}</p></section>` + WEEKS.map((w) => { const ls = allLessons().filter((l) => l.course_id === c.id && l.week === w.id); return ls.length ? `<h3 class="wk">${w.title_en}</h3><ul class="rows">${ls.map((l) => lessonRow(l, s)).join('')}</ul>` : ''; }).join('')).join('');
  const ref = (href, label, ok = true, badge = '') => `<li class="row">${ok ? `<a class="grow" href="${href}">${label}</a>${badge}` : `<span class="grow">${label}</span>${statusBadge('locked')}`}</li>`;
  const due = dueList(s, Date.now()).length;
  return header(t('learn.title'), profileBtn()) +
    (nxt ? `<a class="next" href="#/lesson/${nxt.id}"><span class="next-title">${t('home.continue')}</span><span class="next-sub">${nxt.title_en}</span></a>` : '') +
    `<h2 class="sec">${t('ob.path.title')}</h2>${pathHtml(s)}<h2 class="sec">${t('learn.courses')}</h2>${courseHtml}` +
    `<h2 class="sec">${t('learn.tools')}</h2><ul class="rows">${ref('#/grammar', t('learn.grammar'))}${ref('#/patterns', t('learn.patterns'))}${ref('#/practice', t('learn.practice'), practiceEligible(s).length > 0)}${ref('#/review', t('rv.title'), true, due ? `<span class="badge">${t('rv.dueNow', { n: due })}</span>` : '')}${ref('#/mistakes', t('mn.title'))}${ref('#/vocabulary', t('vb.vocabulary'))}${ref('#/phrasebook', t('vb.phrasebook'))}${ref('#/bookmarks', t('learn.bookmarks'))}</ul>`;
}

const back = () => `<a class="back" href="#/learn">${t('lp.back')}</a>`;
const bnP = (s, x) => (s.bengali_support === 'off' ? '' : `<p lang="bn" class="bn">${x}</p>`);
export function grammar(s) {
  const items = teachSteps(s.lesson_progress);
  return back() + header(t('learn.grammar')) + (items.length ? items.map(({ lesson, step }) => `<section class="card"><h2>${step.grammar_en}</h2><p class="pattern">${step.pattern_en}</p>${bnP(s, step.explanation_bn)}<a class="back" href="#/lesson/${lesson.id}">${t('ref.open')}</a></section>`).join('') : `<p class="muted">${t('ref.empty')}</p>`);
}
export function patterns(s) {
  const items = teachSteps(s.lesson_progress);
  const play = (e) => (canSpeak() ? `<button class="chip" data-act="play" data-text="${esc(e)}">${t('ob.play')}</button>` : '');
  return back() + header(t('learn.patterns')) + (items.length ? items.map(({ lesson, step }) => `<section class="card"><h2 class="pattern">${step.pattern_en}</h2><ul class="rows">${step.examples_en.map((e) => `<li class="row"><span>${e}</span>${play(e)}</li>`).join('')}</ul><a class="back" href="#/lesson/${lesson.id}">${t('ref.practice')}</a></section>`).join('') : `<p class="muted">${t('ref.empty')}</p>`);
}
export function bookmarks(s) {
  const ls = allLessons().filter((l) => s.bookmarks.includes(l.id));
  return back() + header(t('learn.bookmarks')) + (ls.length ? `<ul class="rows">${ls.map((l) => lessonRow(l, s)).join('')}</ul>` : `<p class="muted">${t('bookmarks.empty')}</p>`);
}

export function settings(s) {
  const sec = (title, inner) => `<section class="card"><h2>${title}</h2>${inner}</section>`;
  return `<a class="back" href="#/home">${t('settings.back')}</a>` + header(t('settings.title')) +
    sec(t('bl.open'), `<p>${s.entitlement ? t('bl.settings.plan', { name: esc(s.entitlement.plan.name) }) : t('bl.line.free')}</p><a class="btn secondary" href="#/plans">${t('bl.open')}</a>`) +
    sec(t('ac.title'), `<p>${getSession() ? t('ac.signedIn', { email: esc(getSession().user.email) }) : t('ac.guest')}</p><a class="btn secondary" href="#/account">${t(getSession() ? 'ac.manage' : 'ac.open')}</a>`) +
    sec(t('settings.goal'), chips('goal', ['conversation', 'study', 'work', 'travel', 'interviews'], (v) => t('ob.goal.' + v), s.goal)) +
    sec(t('settings.dailyGoal'), chips('daily_goal_minutes', [5, 10, 15], (n) => t('settings.minutes', { n }), s.daily_goal_minutes)) +
    sec(t('settings.bnSupport'), chips('bengali_support', ['full', 'reduced', 'off'], (v) => t('settings.bnSupport.' + v), s.bengali_support)) +
    sec(t('settings.accent'), chips('accent', ['any', 'us', 'uk', 'in', 'au'], (v) => t('settings.accent.' + v), s.accent)) +
    sec(t('settings.speed'), chips('listen_speed', ['slow', 'normal', 'natural'], (v) => t('ls.speed.' + v), s.listen_speed)) +
    sec(t('settings.reminder'), chips('reminder', ['off', 'morning', 'evening'], (v) => t('settings.reminder.' + v), s.reminder) + `<p class="muted">${reminderNote()}</p>`) +
    sec(t('settings.mic'), `<p>${t('settings.mic.' + s.mic)}</p>` + (s.mic === 'granted' ? '' : `<button class="btn secondary" data-act="mic">${t('settings.mic.allow')}</button>`)) +
    sec(t('settings.level'), `<p>${t('level.' + s.level)}</p><button class="btn secondary" data-act="retake">${t('settings.retake')}</button>`) +
    `<h2 class="sec">${t('settings.more')}</h2><ul class="rows links">${[['#/privacy', 'settings.privacy'], ['#/downloads', 'settings.downloads'], ['#/help', 'settings.help']].map(([h, k]) => `<li><a class="row" href="${h}"><span>${t(k)}</span><span aria-hidden="true">&rsaquo;</span></a></li>`).join('')}</ul><p class="muted">${t('settings.version', { v: APP_VERSION })}</p>`;
}
