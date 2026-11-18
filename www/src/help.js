// Help and feedback (plan sections 15 and 17): short answers, a way to report a problem, and "report this correction" for AI Speak.
import { t } from './i18n/index.js';
import { getState, setState } from './store.js';
import { getSession } from './auth.js';
import { API_BASE } from './runtime-config.js';
import { APP_VERSION } from './config.js';
import { installId, track } from './analytics.js';
import { errText } from './account.js';
import { FEEDBACK_KINDS } from './engine/events.js';
import { esc } from './util.js';

const HP = { kind: 'bug', msg: null, busy: false, draft: '', reported: new Set() };
const FAQ = ['offline', 'account', 'voice', 'ai', 'plans', 'delete'];
const KINDS = FEEDBACK_KINDS.filter((k) => k !== 'ai_correction');
const platform = () => (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() ? 'android' : 'web');

export function help() {
  const faq = FAQ.map((k) => `<details class="card"><summary>${t('hp.q.' + k)}</summary><p>${t('hp.a.' + k)}</p></details>`).join('');
  return `<a class="back" href="#/settings">${t('hp.back')}</a><h1>${t('hp.title')}</h1><h2 class="sec">${t('hp.faq')}</h2>${faq}` +
    `<h2 class="sec">${t('hp.report')}</h2><section class="card"><p class="muted">${t('hp.report.note')}</p>` +
    `<div class="chips" role="group" aria-label="${t('hp.kind')}">${KINDS.map((k) => `<button class="chip" data-act="hp-kind" data-value="${k}" aria-pressed="${HP.kind === k}">${t('hp.kind.' + k)}</button>`).join('')}</div>` +
    `<textarea id="hp-text" class="field area" rows="5" maxlength="1000" placeholder="${t('hp.placeholder')}" aria-label="${t('hp.placeholder')}">${esc(HP.draft)}</textarea>` +
    (HP.msg ? `<p class="fb ${HP.msg.ok ? 'ok' : 'bad'}" role="alert">${esc(HP.msg.text)}</p>` : '') +
    `<button class="btn" data-act="hp-send"${HP.busy ? ' disabled' : ''}>${HP.busy ? t('ac.working') : t('hp.send')}</button><p class="muted">${t('hp.version', { v: APP_VERSION })}</p></section>`;
}

async function post(kind, message, context) {
  const ses = getSession();
  const r = await fetch(`${API_BASE}/api/v1/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(ses ? { Authorization: 'Bearer ' + ses.access_token } : {}) }, body: JSON.stringify({ kind, message, context, install_id: installId(), app_version: APP_VERSION, platform: platform() }) }).catch(() => { throw { code: 'network' }; });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw { code: (j.error && j.error.code) || 'server_error' }; }
}
// The button under an AI correction. The learner's sentence and the correction are sent so the team can check them; nothing else from the conversation.
export const reportKey = (c) => `${c.original}|${c.corrected}`;
export const isReported = (c) => HP.reported.has(reportKey(c));
export function reportButton(c) {
  if (!c || !c.original || !c.corrected) return '';
  return isReported(c) ? `<span class="badge">${t('hp.reported')}</span>`
    : `<button class="chip" data-act="hp-report" data-original="${esc(c.original)}" data-corrected="${esc(c.corrected)}" data-type="${esc(c.error_type || '')}" data-mode="${esc(c.mode || '')}">${t('hp.reportCorrection')}</button>`;
}

export async function hpAct(el) {
  const d = el.dataset;
  if (d.act === 'hp-kind') { HP.kind = d.value; HP.draft = (document.getElementById('hp-text') || {}).value || HP.draft; return setState({}); }
  if (d.act === 'hp-report') {
    const c = { original: d.original, corrected: d.corrected, error_type: d.type, mode: d.mode };
    HP.reported.add(reportKey(c)); setState({});
    try { await post('ai_correction', t('hp.reportCorrection.text'), { original: c.original.slice(0, 200), corrected: c.corrected.slice(0, 200), ...(c.error_type ? { error_type: c.error_type.slice(0, 40) } : {}), ...(c.mode ? { mode: c.mode } : {}) }); track('feedback_sent', { kind: 'ai_correction' }); } catch (e) { HP.reported.delete(reportKey(c)); setState({}); }
    return;
  }
  if (d.act === 'hp-send') {
    const text = ((document.getElementById('hp-text') || {}).value || '').trim(); HP.draft = text;
    if (!text) { HP.msg = { text: t('hp.empty'), ok: false }; return setState({}); }
    HP.busy = true; HP.msg = null; setState({});
    try { await post(HP.kind, text, { screen: 'help' }); HP.draft = ''; HP.busy = false; HP.msg = { text: t('hp.sent'), ok: true }; track('feedback_sent', { kind: HP.kind }); } catch (e) { HP.busy = false; HP.msg = { text: errText(e), ok: false }; }
    setState({});
  }
  void getState;
}
