import { track } from './analytics.js';
import { t } from './i18n/index.js';
import { getState, setState } from './store.js';
import { tasks } from './content/diagnostic.js';
import BN from './content/onboarding_bn.js';
import { placeLevel } from './engine/levels.js';
import { applyPlacement, nextLesson } from './engine/lessons.js';
import { speak, canSpeak, requestMic, RATE } from './audio.js';
import { pathHtml } from './screens.js';
import { accountForm } from './account.js';
import { icon } from './icons.js';

const STEPS = ['splash', 'welcome', 'intro', 'auth', 'goal', 'comfort', 'daily', 'mic', 'diag', 'path'];
const btn = (label, attrs, cls = '') => `<button class="btn ${cls}" ${attrs}>${label}</button>`;
const opt = (attrs, label) => `<button class="opt" ${attrs}>${label}</button>`;
const bn = (s, k) => (s.bengali_support === 'off' || !BN[k] ? '' : `<p lang="bn" class="muted">${BN[k]}</p>`);
const picks = (key, vals, next, label) => vals.map((v) => opt(`data-act="pick" data-key="${key}" data-value="${v}" data-next="${next}"`, label(v))).join('');
const play = (text) => (canSpeak() ? btn(t('ob.play'), `data-act="play" data-text="${text}"`, 'secondary') : `<p class="card pattern">${text}</p>`);

const mark = `<span class="mark" aria-hidden="true">${icon('speak')}</span>`;
const VIEWS = {
  splash: () => `${mark}<h1>${t('app.name')}</h1><p>${t('ob.splash.tag')}</p>`,
  welcome: (s) => `${mark}<h1>${t('ob.welcome.title')}</h1><p class="muted">${t('ob.welcome.sub')}</p>${bn(s, 'welcome')}${btn(t('ob.start'), 'data-act="go" data-next="intro"')}`,
  intro: () => [1, 2, 3].map((n) => `<div class="card"><h2>${t(`ob.intro.${n}.t`)}</h2><p>${t(`ob.intro.${n}.p`)}</p></div>`).join('') + btn(t('ob.continue'), 'data-act="go" data-next="auth"'),
  auth: () => `<h1>${t('ob.auth.title')}</h1>${btn(t('ob.auth.signup'), 'data-act="ac-open" data-mode="signup"', 'secondary')}${btn(t('ob.auth.signin'), 'data-act="ac-open" data-mode="signin"', 'secondary')}${btn(t('ob.auth.guest'), 'data-act="go" data-next="goal"')}<p class="muted">${t('ob.auth.note')}</p>`,
  goal: (s) => `<h1>${t('ob.goal.title')}</h1>${bn(s, 'goal')}${picks('goal', ['conversation', 'study', 'work', 'travel', 'interviews'], 'comfort', (v) => t('ob.goal.' + v))}`,
  comfort: (s) => `<h1>${t('ob.comfort.title')}</h1>${bn(s, 'comfort')}${picks('comfort', ['start', 'some', 'little'], 'daily', (v) => t('ob.comfort.' + v))}`,
  daily: (s) => `<h1>${t('ob.daily.title')}</h1>${bn(s, 'daily')}${picks('daily_goal_minutes', [5, 10, 15], 'mic', (n) => t('settings.minutes', { n }))}`,
  account: (s) => accountForm(s) + btn(t('ob.auth.guest'), 'data-act="go" data-next="goal"', 'secondary'),
  mic: (s) => `<h1>${t('ob.mic.title')}</h1><p>${t('ob.mic.body')}</p>${bn(s, 'mic')}${btn(t('ob.mic.allow'), 'data-act="mic"')}${btn(t('ob.mic.skip'), 'data-act="skip-mic"', 'secondary')}`,
  diag(s) {
    const task = tasks[s.diag_i] || tasks[0];
    let h = `<p class="muted">${t('ob.diag.note')}</p><h1>${task.prompt_en}</h1>`;
    if (s.bengali_support !== 'off') h += `<p lang="bn" class="muted">${task.hint_bn}</p>`;
    if (task.text_en) h += `<p class="card pattern">${task.text_en}</p>`;
    if (task.audio_en) h += play(task.audio_en);
    h += task.type === 'repeat' ? btn(t('ob.repeat.done'), 'data-act="answer" data-value="done"') : task.options.map((o, k) => opt(`data-act="answer" data-value="${k}"`, o)).join('');
    return h + `<p class="muted">${t('ob.diag.count', { n: s.diag_i + 1, total: tasks.length })}</p>` + btn(t('ob.diag.skip'), 'data-act="skip-diag"', 'secondary');
  },
  path: (s) => `<h1>${t('ob.path.title')}</h1><p class="muted">${t('ob.path.level')}: <strong>${t('level.' + s.level)}</strong> (${t('ob.provisional')})</p>${pathHtml(s)}` +
    (s.first_done ? btn(t('ob.finish'), 'data-act="finish"') : btn(t('ob.path.start'), 'data-act="start-first"'))
};

export function renderOnboarding(s) {
  const step = VIEWS[s.ob_step] ? s.ob_step : 'welcome';
  const pct = Math.round(((STEPS.indexOf(step) - 3) / 6) * 100);
  const bar = pct > 0 ? `<div class="steps" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>` : '';
  return `<div class="ob${step === 'splash' ? ' splash' : ''}">${bar}<div class="ob-body">${VIEWS[step](s)}</div></div>`;
}

function answer(s, value) {
  const task = tasks[s.diag_i];
  const correct = task.type === 'repeat' ? null : Number(value) === task.answer;
  const answers = [...s.diag_answers, { id: task.id, skill: task.skill, correct }];
  if (s.diag_i + 1 < tasks.length) return setState({ diag_answers: answers, diag_i: s.diag_i + 1 });
  const p = placeLevel(s.comfort, answers);
  setState({ diag_answers: answers, level: p.level, skills: p.skills, diag_done: true, ob_step: 'path', lesson_progress: applyPlacement(p.level, s.lesson_progress) });
}

export async function act(el) {
  const s = getState(); const d = el.dataset;
  switch (d.act) {
    case 'go': return setState({ ob_step: d.next });
    case 'pick': return setState({ [d.key]: /^\d+$/.test(d.value) ? Number(d.value) : d.value, ob_step: d.next });
    case 'play': speak(d.text, s.accent, RATE[s.listen_speed]); return;
    case 'mic': { const m = await requestMic(); return setState(s.onboarded ? { mic: m } : { mic: m, ob_step: 'diag' }); }
    case 'skip-mic': return setState({ mic: 'skipped', ob_step: 'diag' });
    case 'answer': return answer(s, d.value);
    case 'skip-diag': return setState({ level: 'Pre-A1', diag_done: false, ob_step: 'path' });
    case 'start-first': { const n = nextLesson(s.lesson_progress); track('onboarding_completed', { level: s.level, placed: !!s.diag_done }); setState({ onboarded: true, ob_step: 'done' }); location.hash = n ? '#/lesson/' + n.id : '#/home'; return; }
    case 'finish': track('onboarding_completed', { level: s.level, placed: !!s.diag_done }); setState({ onboarded: true, ob_step: 'done' }); location.hash = '#/home'; return;
    case 'retake': location.hash = '#/home'; return setState({ onboarded: false, ob_step: 'diag', diag_i: 0, diag_answers: [] });
  }
}
