// Error states (plan section 17): offline notice, a friendly screen when a screen cannot be drawn, and a quiet notice for unexpected errors.
import { t } from './i18n/index.js';
import { track } from './analytics.js';

let online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
let notice = false;
export const isOnline = () => online;
export function watchConnection(onChange) {
  if (typeof window === 'undefined' || !window.addEventListener) return;
  window.addEventListener('online', () => { online = true; onChange(); });
  window.addEventListener('offline', () => { online = false; onChange(); });
}
export const offlineBanner = () => (online ? '' : `<p class="card notice" role="status">${t('er.offline')}</p>`);
export const errorBanner = () => (notice ? `<p class="card notice" role="alert">${t('er.notice')} <button class="linkbtn" data-act="er-dismiss"><u>${t('er.dismiss')}</u></button></p>` : '');
export function noteUnexpected(onChange) {
  if (notice) return; notice = true; track('error_shown', { code: 'client_error' }); onChange();
}
export function watchUnexpected(onChange) {
  if (typeof window === 'undefined' || !window.addEventListener) return;
  window.addEventListener('error', () => noteUnexpected(onChange));
  window.addEventListener('unhandledrejection', () => noteUnexpected(onChange));
}
export function errorScreen() {
  track('error_shown', { code: 'render_error' });
  return `<main><h1>${t('er.title')}</h1><p class="muted">${t('er.body')}</p><button class="btn" data-act="er-reload">${t('er.reload')}</button><a class="btn secondary" href="#/home">${t('er.home')}</a><a class="btn secondary" href="#/help">${t('er.report')}</a></main>`;
}
export function errAct(a, onChange) {
  if (a.dataset.act === 'er-reload') { if (typeof location !== 'undefined' && location.reload) location.reload(); return; }
  if (a.dataset.act === 'er-dismiss') { notice = false; onChange(); }
}
