import { t } from './i18n/index.js';
import { getState, setState } from './store.js';
import { getSession, signUp, signIn, signOut, resetPassword, api } from './auth.js';
import { syncNow } from './sync.js';
import { esc } from './util.js';
import { track } from './analytics.js';

let msg = null; let busy = false; let form = { email: '', name: '' };
const say = (text, ok = false) => { msg = { text, ok }; busy = false; setState({}); };
const val = (id) => (document.getElementById(id) || {}).value || '';
const CODES = ['network', 'unauthenticated', 'invalid_credentials', 'user_exists', 'weak_password', 'email_not_confirmed', 'rate_limited', 'upstream_error', 'invalid_input', 'forbidden', 'not_found', 'conflict', 'confirmation_required', 'config', 'quota_exceeded', 'ai_unavailable', 'stt_unavailable', 'plan_required', 'billing_unavailable'];
// A quota error says which limit was reached, so the message can be exact.
export const errText = (e) => {
  if (e && e.code === 'quota_exceeded' && e.details && ['ai_turns', 'stt_seconds'].includes(e.details.what)) return t('err.quota_exceeded.' + e.details.what);
  return t('err.' + (e && CODES.includes(e.code) ? e.code : 'server_error'));
};
const msgHtml = () => (msg ? `<p class="fb ${msg.ok ? 'ok' : 'bad'}" role="alert">${esc(msg.text)}</p>` : '');

export function accountForm(s) {
  const up = s.ac_mode === 'signup';
  return `<h1>${t(up ? 'ac.signup' : 'ac.signin')}</h1><p class="muted">${t('ac.note')}</p>` +
    `<div class="chips"><button class="chip" data-act="ac-mode" data-mode="signin" aria-pressed="${!up}">${t('ac.signin')}</button><button class="chip" data-act="ac-mode" data-mode="signup" aria-pressed="${up}">${t('ac.signup')}</button></div>` +
    (up ? `<input id="ac-name" class="field" type="text" autocomplete="name" value="${esc(form.name)}" placeholder="${t('ac.name')}" aria-label="${t('ac.name')}">` : '') +
    `<input id="ac-email" class="field" type="email" autocomplete="email" value="${esc(form.email)}" placeholder="${t('ac.email')}" aria-label="${t('ac.email')}">` +
    `<input id="ac-pass" class="field" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" placeholder="${t('ac.password')}" aria-label="${t('ac.password')}">` +
    msgHtml() + `<button class="btn" data-act="ac-submit"${busy ? ' disabled' : ''}>${busy ? t('ac.working') : t(up ? 'ac.signup' : 'ac.signin')}</button>` +
    (up ? '' : `<button class="btn secondary" data-act="ac-reset">${t('ac.forgot')}</button>`);
}

export function account(s) {
  const ses = getSession();
  const back = `<a class="back" href="#/settings">${t('ac.back')}</a>`;
  if (!ses) return back + `<div class="col">${accountForm(s)}</div>`;
  return back + `<div class="col"><h1>${t('ac.title')}</h1><p>${t('ac.signedIn', { email: esc(ses.user.email) })}</p>` +
    `<p class="muted">${s.synced_at ? t('ac.synced', { when: esc(new Date(s.synced_at).toLocaleString()) }) : t('ac.neverSynced')}</p>${s.study_sync_ok === false ? `<p class="muted">${t('ac.studyNotSynced')}</p>` : ''}${msgHtml()}` +
    `<button class="btn" data-act="ac-sync"${busy ? ' disabled' : ''}>${t('ac.sync')}</button><button class="btn secondary" data-act="ac-signout">${t('ac.signout')}</button>` +
    `<a class="btn secondary" href="#/privacy">${t('pv.title')}</a></div>`;
}

async function submit(s) {
  const email = val('ac-email').trim(); const pass = val('ac-pass'); const name = val('ac-name').trim();
  form = { email, name };
  if (!email.includes('@')) return say(t('err.invalid_input'));
  if (pass.length < 8) return say(t('err.weak_password'));
  busy = true; msg = null; setState({});
  try {
    if (s.ac_mode === 'signup') { if ((await signUp(email, pass, name)) === 'confirm_email') return say(t('ac.confirm'), true); track('signup_completed'); } else { await signIn(email, pass); track('signin_completed'); }
    await syncNow().catch(() => {});
    const n = getState();
    busy = false;
    if (!n.onboarded && n.ob_step === 'account') setState({ ob_step: 'goal' }); else say(t('ac.syncOk'), true);
  } catch (e) { say(errText(e)); }
}

export async function acAct(el) {
  const s = getState(); const d = el.dataset;
  switch (d.act) {
    case 'ac-open': msg = null; return setState({ ac_mode: d.mode, ob_step: 'account' });
    case 'ac-mode': msg = null; return setState({ ac_mode: d.mode });
    case 'ac-submit': return submit(s);
    case 'ac-reset': {
      const email = val('ac-email').trim(); form.email = email;
      if (!email.includes('@')) return say(t('err.invalid_input'));
      try { await resetPassword(email); say(t('ac.resetSent'), true); } catch (e) { say(errText(e)); }
      return;
    }
    case 'ac-signout': await signOut(); msg = null; return setState({ synced_at: null, entitlement: null });
    case 'ac-sync': busy = true; msg = null; setState({}); try { await syncNow(); say(t('ac.syncOk'), true); } catch (e) { say(errText(e)); } return;
  }
}
