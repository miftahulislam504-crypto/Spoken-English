import { t, SECTIONS } from './strings.js';
import * as store from './store.js';

const ICON = {
  home: 'M3 11l9-8 9 8v10h-6v-6H9v6H3z',
  learn: 'M4 5h6a2 2 0 012 2v12a2 2 0 00-2-2H4zM20 5h-6a2 2 0 00-2 2v12a2 2 0 012-2h6z',
  speak: 'M12 3a3 3 0 013 3v6a3 3 0 01-6 0V6a3 3 0 013-3zM5 11a7 7 0 0014 0M12 18v3',
  listening: 'M4 14v-2a8 8 0 0116 0v2M4 14h3v6H4zM17 14h3v6h-3z',
  progress: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  profile: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0'
};
const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICON[k]}"/></svg>`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TABS = ['home', 'learn', 'speak', 'listening', 'progress'];

const rows = (items) => `<ul class="list">${items.map(([n, p]) => `<li><span>${esc(n)}</span><small>${t('phase')} ${p}</small></li>`).join('')}</ul>`;
const section = (key, intro, label) => `<h2>${t(key)}</h2><p class="muted">${t(intro)}</p><h3>${t(label)}</h3>${rows(SECTIONS[key])}`;
const opts = (list, cur) => list.map(([v, l]) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${t(l)}</option>`).join('');

const VIEWS = {
  home() {
    const u = store.get();
    return `<h2>${t('hello')}${u.display_name ? ', ' + esc(u.display_name) : ''}</h2>
      <p class="muted">${t('level')}: ${t('starter')}</p>
      <div class="hero"><h2>${t('continueLearning')}</h2><p>${t('continueEmpty')}</p><a class="btn" href="#/speak">${t('startSpeaking')}</a></div>
      <div class="card"><strong>${t('dailyGoal')}</strong><div class="muted">0 / ${u.daily_goal_minutes} ${t('today')}</div><div class="meter"><i></i></div></div>
      <div class="card"><strong>${t('recommended')}</strong><div class="muted">${t('recommendedEmpty')}</div></div>
      <div class="card"><strong>${t('weekly')}</strong><div class="muted">${t('weeklyEmpty')}</div></div>`;
  },
  learn: () => section('learn', 'learnIntro', 'sections'),
  speak: () => section('speak', 'speakIntro', 'modes'),
  listening: () => section('listening', 'listeningIntro', 'sections'),
  progress: () => section('progress', 'progressIntro', 'sections'),
  settings() {
    const u = store.get();
    return `<h2>${t('profile')}</h2>
      <label class="field"><span>${t('displayName')}</span><input type="text" data-k="display_name" value="${esc(u.display_name)}" maxlength="40" autocomplete="given-name"></label>
      <label class="field"><span>${t('explanationLanguage')}</span><select data-k="explanation_language">${opts([['bn', 'optBengali'], ['en', 'optEnglish']], u.explanation_language)}</select></label>
      <label class="field"><span>${t('bengaliSupport')}</span><select data-k="bengali_support">${opts([['full', 'optFull'], ['some', 'optSome'], ['minimal', 'optMinimal']], u.bengali_support)}</select></label>
      <label class="field"><span>${t('accent')}</span><select data-k="accent">${opts([['mixed', 'optMixed'], ['american', 'optAmerican'], ['british', 'optBritish']], u.accent)}</select></label>
      <label class="field"><span>${t('dailyGoal')}</span><select data-k="daily_goal_minutes" data-n="1">${[5, 10, 15].map((m) => `<option value="${m}"${u.daily_goal_minutes === m ? ' selected' : ''}>${m} ${t('minutes')}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" data-k="reminders"${u.reminders ? ' checked' : ''}>${t('reminders')}</label>
      <p class="muted">${t('prefsNote')}</p><h3>${t('moreSettings')}</h3>${rows(SECTIONS.settings)}`;
  }
};

function render() {
  const route = (location.hash.replace('#/', '') || 'home');
  const name = VIEWS[route] ? route : 'home';
  const isSettings = name === 'settings';
  document.getElementById('app').innerHTML = `
    <header class="top">
      ${isSettings ? `<a class="back" href="#/home">${t('back')}</a><h1>${t('settings')}</h1><span class="icon-btn"></span>`
        : `<h1>${t('appName')}</h1><a class="icon-btn" href="#/settings" aria-label="${t('profile')}">${svg('profile')}</a>`}
    </header>
    <main id="main" tabindex="-1">${VIEWS[name]()}</main>
    <nav class="tabs" aria-label="Primary">${TABS.map((k) => `<a href="#/${k}"${k === name ? ' aria-current="page"' : ''}>${svg(k)}<span>${t(k)}</span></a>`).join('')}</nav>`;
  document.getElementById('main').focus({ preventScroll: true });
}

document.getElementById('app').addEventListener('change', (e) => {
  const el = e.target.closest('[data-k]');
  if (!el) return;
  const v = el.type === 'checkbox' ? el.checked : el.dataset.n ? Number(el.value) : el.value.trim();
  store.set({ [el.dataset.k]: v });
});
window.addEventListener('hashchange', render);
render();
