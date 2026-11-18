// Privacy and data controls (plan section 15): what is kept and for how long, usage statistics, download my data, delete my speaking history,
// delete my account, and clear this phone. Voice recordings are never stored, and the screen says so plainly.
import { t } from './i18n/index.js';
import { getState, setState } from './store.js';
import { getSession, signIn, signOut, api, publicGet } from './auth.js';
import { errText } from './account.js';
import { clearEvents, track } from './analytics.js';
import { removeDownloads } from './content-pack.js';
import { esc } from './util.js';

const KEYS = ['se.state.v1', 'se.auth.v1', 'se.install.v1', 'se.events.v1', 'se.content.v1', 'se.content.pending.v1'];
const PV = { policy: null, loading: false, msg: null, busy: false, deleting: false, data: null, text: false };
// Leaving the screen drops anything it was holding, including a prepared copy of the learner's data.
export const resetPrivacy = () => { PV.msg = null; PV.deleting = false; PV.data = null; PV.text = false; PV.busy = false; };
const say = (text, ok = false) => { PV.msg = { text, ok }; PV.busy = false; setState({}); };
const done = () => { PV.busy = false; setState({}); };
const num = (n) => (Number.isInteger(n) ? n : null);

async function loadPolicy() {
  PV.loading = true;
  try { PV.policy = await publicGet('/privacy-policy'); } catch (e) { PV.policy = { retention_days: {} }; }
  PV.loading = false; setState({});
}
const days = (k) => { const n = PV.policy && PV.policy.retention_days ? num(PV.policy.retention_days[k]) : null; return n === null ? '' : ` ${t('pv.days', { n })}`; };

export function privacy(s) {
  if (!PV.policy && !PV.loading) queueMicrotask(loadPolicy);
  const ses = getSession(); const on = s.analytics !== 'off';
  const li = (k, extra = '') => `<li>${t(k)}${extra}</li>`;
  const stats = `<section class="card"><h2>${t('pv.stats')}</h2><p>${t('pv.stats.note')}</p><div class="chips" role="group" aria-label="${t('pv.stats')}">` +
    ['on', 'off'].map((v) => `<button class="chip" data-act="pv-stats" data-value="${v}" aria-pressed="${(v === 'on') === on}">${t('pv.stats.' + v)}</button>`).join('') + `</div></section>`;
  const account = ses
    ? `<section class="card"><h2>${t('pv.yours')}</h2><p class="muted">${t('pv.signedIn', { email: esc(ses.user.email) })}</p>` +
      (PV.data ? exportReady() : `<button class="btn secondary" data-act="pv-export"${PV.busy ? ' disabled' : ''}>${t('pv.export')}</button><p class="muted">${t('pv.export.note')}</p>`) +
      `<button class="btn secondary" data-act="pv-speaking"${PV.busy ? ' disabled' : ''}>${t('pv.speaking')}</button><p class="muted">${t('pv.speaking.note')}</p>` +
      (PV.deleting ? deleteForm(s) : `<button class="btn secondary" data-act="pv-delete-open">${t('pv.delete')}</button>`) + `</section>`
    : `<section class="card"><h2>${t('pv.yours')}</h2><p class="muted">${t('pv.guest')}</p></section>`;
  return `<a class="back" href="#/settings">${t('pv.back')}</a><h1>${t('pv.title')}</h1><p class="muted">${t('pv.intro')}</p>` +
    `<section class="card"><h2>${t('pv.never')}</h2><p>${t('pv.never.audio')}</p></section>` +
    `<section class="card"><h2>${t('pv.keep')}</h2><ul class="plain">${li('pv.keep.phone')}${li('pv.keep.account')}${li('pv.keep.speaking', days('speaking_transcripts'))}${li('pv.keep.stats', days('usage_statistics'))}</ul></section>` +
    stats + account +
    `<section class="card"><h2>${t('pv.local')}</h2><p class="muted">${t('pv.local.note')}</p><button class="btn secondary" data-act="pv-clear">${t('pv.local.clear')}</button></section>` +
    (PV.msg ? `<p class="fb ${PV.msg.ok ? 'ok' : 'bad'}" role="alert">${esc(PV.msg.text)}</p>` : '');
}
function exportReady() {
  return `<p class="fb ok" role="status">${t('pv.export.ready')}</p><div class="chips"><button class="btn secondary" data-act="pv-save">${t('pv.export.save')}</button><button class="btn secondary" data-act="pv-text">${t(PV.text ? 'pv.export.hide' : 'pv.export.show')}</button><button class="btn secondary" data-act="pv-copy">${t('pv.export.copy')}</button><button class="btn secondary" data-act="pv-done">${t('pv.export.done')}</button></div>` +
    (PV.text ? `<textarea class="field area" rows="8" readonly aria-label="${t('pv.export')}">${esc(PV.data)}</textarea>` : '');
}
function deleteForm(s) {
  const gp = s.entitlement && s.entitlement.source === 'google_play' && s.entitlement.plan.id !== 'free';
  return `<div class="card notice"><h2>${t('pv.delete')}</h2><p>${t('pv.delete.warn')}</p>${gp ? `<p>${t('bl.deleteNote')}</p>` : ''}` +
    `<input id="pv-pass" class="field" type="password" autocomplete="current-password" placeholder="${t('pv.delete.password')}" aria-label="${t('pv.delete.password')}">` +
    `<button class="btn" data-act="pv-delete-do"${PV.busy ? ' disabled' : ''}>${t('pv.delete.do')}</button><button class="btn secondary" data-act="pv-delete-cancel">${t('pv.cancel')}</button></div>`;
}

// Hands the file to the phone's share sheet when it can, otherwise downloads it. The text view is always there as a fallback.
const native = () => typeof window !== 'undefined' && !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
async function deliver(text) {
  const name = 'spoken-english-my-data.json';
  try { const f = new File([text], name, { type: 'application/json' }); if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return 'shared'; } } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  if (native()) return 'text'; // a phone's built-in browser view cannot save a downloaded file, so the learner copies the text instead
  try { const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); return 'downloaded'; } catch (e) { return 'failed'; }
}
export function clearLocalData() {
  KEYS.forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* none */ } });
  try { removeDownloads(); } catch (e) { /* none */ }
  if (typeof location !== 'undefined' && location.reload) location.reload();
}

export async function pvAct(el) {
  const d = el.dataset; const s = getState();
  switch (d.act) {
    case 'pv-stats': if (d.value === 'off') clearEvents(); return setState({ analytics: d.value === 'off' ? 'off' : 'on' });
    case 'pv-export':
      PV.busy = true; PV.msg = null; setState({});
      try { PV.data = JSON.stringify(await api('GET', '/me/export'), null, 2); PV.text = false; track('data_exported'); done(); } catch (e) { say(errText(e)); }
      return;
    case 'pv-save': { const r = await deliver(PV.data); if (r === 'text') { PV.text = true; return say(t('pv.export.native'), true); } if (r === 'failed') { PV.text = true; return say(t('pv.export.failed')); } if (r !== 'cancelled') PV.msg = { text: t('pv.export.' + r), ok: true }; return setState({}); }
    case 'pv-text': PV.text = !PV.text; return setState({});
    case 'pv-copy': try { await navigator.clipboard.writeText(PV.data); return say(t('pv.export.copied'), true); } catch (e) { PV.text = true; return say(t('pv.export.failed')); }
    case 'pv-done': PV.data = null; PV.text = false; PV.msg = null; return setState({});
    case 'pv-speaking':
      if (!confirm(t('pv.speaking.confirm'))) return;
      PV.busy = true; PV.msg = null; setState({});
      try { const r = await api('DELETE', '/me/speaking-history'); say(t('pv.speaking.done', { n: r.deleted_sessions }), true); } catch (e) { say(errText(e)); }
      return;
    case 'pv-delete-open': PV.deleting = true; PV.msg = null; return setState({});
    case 'pv-delete-cancel': PV.deleting = false; return setState({});
    case 'pv-delete-do': {
      const pass = (document.getElementById('pv-pass') || {}).value || ''; const ses = getSession();
      if (!ses || pass.length < 8) return say(t('err.weak_password'));
      if (!confirm(t('ac.deleteConfirm'))) return;
      PV.busy = true; PV.msg = null; setState({});
      try {
        await signIn(ses.user.email, pass); // the password is checked again before anything is deleted
        await api('DELETE', '/me', { confirm: 'DELETE' });
        await signOut(); PV.deleting = false; PV.data = null;
        setState({ synced_at: null, entitlement: null, words_known: [] }); say(t('pv.deleted'), true);
      } catch (e) { say(e && e.code === 'conflict' && e.details === 'last_owner' ? t('pv.lastOwner') : errText(e)); }
      return;
    }
    case 'pv-clear':
      if (!confirm(t('pv.local.confirm'))) return;
      try { await signOut(); } catch (e) { /* clearing anyway */ }
      return clearLocalData();
  }
  void s;
}
