import { getState, setState, subscribe } from './store.js';
import { t } from './i18n/index.js';
import { icon } from './icons.js';
import * as screens0 from './screens.js';
import { vocabulary, phrasebook, vbAct } from './vocabulary.js';
import { listening, lsAct } from './listening.js';
import { account, acAct } from './account.js';
import { speak, speakPick, sessionView, skAct } from './speak.js';
import { renderOnboarding, act } from './onboarding.js';
import { review, mistakes, rvAct } from './review.js';
import { progress, weekly } from './progress.js';
import { plans, blAct } from './billing.js';
import { lessonView, startRun, lpAct } from './lessonPlayer.js';
import { privacy, pvAct, resetPrivacy } from './privacy.js';
import { help, hpAct } from './help.js';
import { downloads, dlAct } from './downloads.js';
import { offlineBanner, errorBanner, errorScreen, errAct, watchConnection, watchUnexpected } from './errors.js';
import { loadStoredPack } from './content-pack.js';
import { startBackground } from './background.js';
import { track } from './analytics.js';

loadStoredPack(); // lessons downloaded earlier are switched on before the first screen is drawn

const TABS = ['home', 'learn', 'speak', 'listening', 'progress'];
const screens = { ...screens0, vocabulary, phrasebook, listening, account, speak, speakPick, review, mistakes, progress, weekly, plans, privacy, help, downloads };
const SUB = ['grammar', 'patterns', 'bookmarks', 'vocabulary', 'phrasebook', 'review', 'mistakes'];
const app = document.getElementById('app');
let timer = null;

function route() {
  const [id, param] = location.hash.replace(/^#\//, '').split('/');
  if (id === 'lesson' && param) return { id: 'lessonView', param, tab: 'learn' };
  if (id === 'speak' && param) return { id: 'speakPick', param, tab: 'speak' };
  if (id === 'session') return { id: 'session', tab: 'speak' };
  if (id === 'practice') return { id: 'lessonView', param: 'practice', tab: 'learn' };
  if (id === 'vocab-practice') return { id: 'lessonView', param: 'vocab', tab: 'learn' };
  if (id === 'review-session') return { id: 'lessonView', param: 'review', tab: 'learn' };
  if (id === 'weekly') return { id: 'weekly', tab: 'progress' };
  if (id === 'listen' && param) return { id: 'lessonView', param: 'listen:' + param, tab: 'listening' };
  if (SUB.includes(id)) return { id, tab: 'learn' };
  if (id === 'account') return { id: 'account', tab: '' };
  if (id === 'plans' || id === 'privacy' || id === 'help' || id === 'downloads') return { id, tab: '' };
  if (TABS.includes(id) || id === 'settings') return { id, tab: id };
  return { id: 'home', tab: 'home' };
}
function prepare(r) {
  if (r.id === 'plans') track('paywall_viewed');
  if (r.id !== 'privacy') resetPrivacy();
  if (getState().onboarded && r.id === 'lessonView' && !startRun(r.param)) location.hash = r.param.startsWith('listen:') ? '#/listening' : r.param === 'review' ? '#/review' : '#/learn';
}

function render(keepScroll) {
  try { draw(keepScroll); } catch (e) { console.error('Screen failed', e && e.message); app.innerHTML = errorScreen(); }
}
function draw(keepScroll) {
  const s = getState();
  document.title = t('app.name');
  if (!s.onboarded) {
    app.innerHTML = renderOnboarding(s);
    window.scrollTo(0, 0);
    if (app.classList) app.classList.remove('enter');
    if (s.ob_step === 'splash' && !timer) {
      timer = setTimeout(() => { timer = null; if (getState().ob_step === 'splash') setState({ ob_step: 'welcome' }); }, 1200);
    }
    return;
  }
  const r = route(); const y = window.scrollY;
  if (r.id === 'lessonView') app.innerHTML = lessonView(s, r.param);
  else if (r.id === 'session') app.innerHTML = sessionView(s);
  else {
    const nav = TABS.map((k) => `<a href="#/${k}" class="tab"${r.tab === k ? ' aria-current="page"' : ''}>${icon(k)}<span>${t('nav.' + k)}</span></a>`).join('');
    app.innerHTML = `<main>${offlineBanner()}${errorBanner()}${screens[r.id](s, r.param)}</main><nav class="tabs" aria-label="${t('nav.label')}">${nav}</nav>`;
  }
  window.scrollTo(0, keepScroll ? y : 0);
  if (app.classList) app.classList.toggle('enter', !keepScroll); // entrance animation plays when the screen changes, not on every small update
}

app.addEventListener('click', (e) => {
  const a = e.target.closest('[data-act]');
  if (a && !a.disabled) { const k = a.dataset.act; if (k.startsWith('lp-')) lpAct(a, route().param); else if (k.startsWith('vb-')) vbAct(a); else if (k.startsWith('ls-')) lsAct(a); else if (k.startsWith('ac-')) acAct(a); else if (k.startsWith('rv-')) rvAct(a); else if (k.startsWith('bl-')) blAct(a); else if (k.startsWith('pv-')) pvAct(a); else if (k.startsWith('hp-')) hpAct(a); else if (k.startsWith('dl-')) dlAct(a); else if (k.startsWith('er-')) errAct(a, () => render(true)); else if (k.startsWith('sk-')) skAct(a); else act(a); return; }
  const b = e.target.closest('[data-set]');
  if (!b) return;
  const v = b.dataset.value;
  setState({ [b.dataset.set]: /^\d+$/.test(v) ? Number(v) : v });
});
subscribe(() => render(true));
window.addEventListener('hashchange', () => { prepare(route()); render(false); });
watchConnection(() => render(true));
watchUnexpected(() => render(true));
prepare(route());
render(false);
startBackground();
