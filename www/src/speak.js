import { t } from './i18n/index.js';
import { getState, setState } from './store.js';
import { getSession, api } from './auth.js';
import { esc, practicePatch } from './util.js';
import { recordSpeaking, recordSpeakTurn, recordMissedWords, recordSpokenReview, sessionLog } from './engine/study.js';
import { speakable } from './engine/mistakes.js';
import { hintsFaded } from './engine/scaffold.js';
import { syncSoon } from './sync.js';
import { ensureEntitlement, modeAllowed, noteQuotaError } from './entitlement.js';
import { track } from './analytics.js';
import { reportButton } from './help.js';
import { quotaLine, upgradeLink } from './billing.js';
import { speak as tts, canSpeak, RATE } from './audio.js';
import { canRecord, startRec, stopRec, toBase64 } from './recorder.js';
import { SCENARIOS, QUESTIONS, REPEAT_SETS, FREE_OPENING } from './content/speaking.js';
import { errText } from './account.js';
import { icon } from './icons.js';

const MODES = ['guided', 'roleplay', 'free', 'repeat', 'answer', 'review'];
const RETRYABLE = ['network', 'upstream_error', 'ai_unavailable', 'stt_unavailable'];
let S = null; let pickErr = null; let pickCode = null; let starting = false;

const completed = (s) => Object.values(s.lesson_progress).filter((p) => p.status === 'completed').length;
const head = (title, right = '') => `<header class="top"><h1>${title}</h1>${right}</header>`;
const newKey = () => 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const hear = (x) => (canSpeak() ? `<button class="chip" data-act="sk-hear" data-text="${esc(x)}">${t('sk.hear')}</button>` : '');
const bnTxt = (s, x) => (!x || s.bengali_support === 'off' ? '' : s.bengali_support === 'reduced' ? `<details><summary>${t('learn.showBengali')}</summary><p lang="bn">${esc(x)}</p></details>` : `<p lang="bn" class="bn">${esc(x)}</p>`);

// ---- hub and pickers ----
export function speak(s) {
  ensureEntitlement();
  const signed = !!getSession(); const beginner = s.level === 'Pre-A1' || s.level === 'A1';
  const rows = MODES.map((m) => {
    const paid = !modeAllowed(s, m); const locked = !paid && m === 'free' && completed(s) < 7;
    const inner = `<strong>${t('sk.mode.' + m)}</strong><small class="muted">${t(locked ? 'sk.locked.free' : 'sk.desc.' + m)}</small>`;
    if (paid) return `<li class="row"><a class="stack grow" href="#/plans">${inner}</a><span class="badge">${t('bl.lockedMode')}</span></li>`;
    const badge = locked ? `<span class="badge">${t('status.locked')}</span>` : m === 'guided' && beginner ? `<span class="badge">${t('sk.recommended')}</span>` : '';
    if (locked) return `<li class="row"><span class="stack grow">${inner}</span>${badge}</li>`;
    const direct = m === 'free' || m === 'review';
    return `<li class="row">${direct ? `<button class="stack grow linkbtn" data-act="sk-start" data-mode="${m}" data-id="${m}">${inner}</button>` : `<a class="stack grow" href="#/speak/${m}">${inner}</a>`}${badge}</li>`;
  }).join('');
  return head(t('sk.title'), `<a class="icon-btn" href="#/settings" aria-label="${t('settings.open')}">${icon('user')}</a>`) +
    (signed ? quotaLine(s) : `<div class="card"><p>${t('sk.signin')}</p><a class="btn secondary" href="#/account">${t('ac.open')}</a></div>`) +
    (pickErr ? `<p class="fb bad" role="alert">${esc(pickErr)}</p>${upgradeLink(pickCode)}` : '') + `<ul class="rows">${rows}</ul><p class="muted">${t('sk.privacy')}</p>`;
}

export function speakPick(s, mode) {
  const row = (id, title, sub) => `<li class="row"><button class="stack grow linkbtn" data-act="sk-start" data-mode="${mode}" data-id="${id}"><strong>${esc(title)}</strong><small class="muted">${esc(sub)}</small></button></li>`;
  let rows = '';
  if (mode === 'guided' || mode === 'roleplay') rows = SCENARIOS.map((x) => row(x.id, x.title_en, `${x.level} - ${x.goal_en}`)).join('');
  else if (mode === 'answer') rows = QUESTIONS.map((x) => row(x.id, x.text, x.level)).join('');
  else if (mode === 'repeat') rows = REPEAT_SETS.map((x) => row(x.id, x.title_en, t('sk.items', { n: x.items.length }))).join('');
  return `<a class="back" href="#/speak">${t('sk.back')}</a>` + head(t('sk.mode.' + mode)) + (pickErr ? `<p class="fb bad" role="alert">${esc(pickErr)}</p>` : '') + `<ul class="rows">${rows}</ul>`;
}

// ---- session ----
function targetsFor(mode, id, s) {
  if (mode === 'repeat') return REPEAT_SETS.find((x) => x.id === id).items;
  return speakable(s.mistakes, 5);
}
async function start(mode, id) {
  const s = getState();
  if (!getSession()) { pickErr = t('sk.signin'); return setState({}); }
  const targets = mode === 'repeat' || mode === 'review' ? targetsFor(mode, id, s) : null;
  if (mode === 'review' && !targets.length) { pickErr = t('sk.noMistakes'); return setState({}); }
  if (starting) return;
  starting = true; pickErr = null; pickCode = null;
  try {
    const r = await api('POST', '/speaking/sessions', { mode, scenario_id: id });
    const sc = mode === 'guided' || mode === 'roleplay' ? SCENARIOS.find((x) => x.id === id) : mode === 'answer' ? QUESTIONS.find((x) => x.id === id) : null;
    const open = sc ? (mode === 'answer' ? { en: sc.text, bn: sc.hint_bn } : { en: sc.opening_en, bn: sc.opening_bn }) : mode === 'free' ? FREE_OPENING : null;
    S = { mode, id, sessionId: r.session_id, sc, targets, ti: 0, lines: open ? [{ who: 'coach', text: open.en, bn: open.bn }] : [], suggest: mode === 'guided' && sc ? sc.suggest : [], hintsHidden: mode === 'guided' && !!sc && hintsFaded(s.speak_log, id), busy: false, recording: false, typing: false, draft: '', err: null, pending: null, retry: null, summary: null, goalMet: false, last: null, audioBlob: null };
    if (open) tts(open.en, s.accent, RATE[s.listen_speed]);
    track('speaking_session_started', { mode });
    starting = false; location.hash = '#/session'; setState({});
  } catch (e) { starting = false; pickErr = errText(e); pickCode = e && e.code; noteQuotaError(e); setState({}); }
}

const fbCard = (s, fb) => `<div class="card fbcard"><p>${t('sk.better')}: <strong>${esc(fb.corrected_text)}</strong></p><p class="muted">${t('sk.youSaid')}: ${esc(fb.original_text)}</p>${bnTxt(s, fb.explanation_bn)}` +
  `${fb.alternative_text ? `<p class="muted">${t('sk.alternative')}: ${esc(fb.alternative_text)}</p>` : ''}<div class="chips">${hear(fb.corrected_text)}${reportButton({ original: fb.original_text, corrected: fb.corrected_text, error_type: fb.error_type, mode: S && S.mode })}${fb.needs_retry ? `<button class="chip" data-act="sk-retry" data-text="${esc(fb.corrected_text)}">${t('sk.sayAgain')}</button>` : ''}</div></div>`;
const cmpCard = (c) => `<div class="card">${c.matched ? `<p class="fb ok">${t('sk.matched')}</p>` : `<p>${t('sk.missing', { words: esc((c.missing.length ? c.missing : c.extra).join(', ')) })}</p>`}<p class="muted">${t('sk.cmpNote')}</p></div>`;
function youExtras(s, l, i) {
  let h = '';
  if (l.audioUrl) h += `<button class="chip" data-act="sk-playmine" data-i="${i}">${t('sk.myRecording')}</button>`;
  if (l.stt && l.stt.confidence !== null && l.stt.confidence < 0.6) h += `<p class="muted">${t('sk.lowConf')}</p>`;
  if (l.fluency) h += `<p class="muted">${t('sk.fluency', { words: l.fluency.words, wpm: l.fluency.wpm })}${l.fluency.pauses ? ' ' + t('sk.pauses', { n: l.fluency.pauses }) : ''}</p>`;
  return h + (l.fb ? fbCard(s, l.fb) : '') + (l.cmp ? cmpCard(l.cmp) : '');
}
function chatBody(s) {
  const bubbles = S.lines.map((l, i) => (l.who === 'coach'
    ? `<div class="bubble coach"><p>${esc(l.text)}</p>${hear(l.text)}${bnTxt(s, l.bn)}</div>`
    : `<div class="bubble you"><p>${esc(l.text)}</p>${youExtras(s, l, i)}</div>`)).join('');
  return `<div class="chat">${bubbles}</div>${S.goalMet ? `<p class="fb ok">${t('sk.goalMet')}</p>` : ''}` +
    (S.retry ? `<div class="card"><p>${t('sk.retryBanner')} <strong>${esc(S.retry)}</strong></p><div class="chips">${hear(S.retry)}<button class="chip" data-act="sk-cancel-retry">${t('sk.cancel')}</button></div></div>` : '') +
    (S.suggest.length ? (S.hintsHidden ? `<p class="muted">${t('sk.hintsFaded')}</p><button class="chip" data-act="sk-hints">${t('sk.showHints')}</button>` : `<p class="muted">${t('sk.youCouldSay')}</p><div class="chips">${S.suggest.map((x) => `<button class="chip" data-act="sk-suggest" data-text="${esc(x)}">${esc(x)}</button>`).join('')}</div>`) : '');
}
function targetBody(s) {
  const tg = S.targets[S.ti];
  if (!tg) return `<p class="fb ok">${t('sk.allDone')}</p>`;
  const last = S.last !== null ? S.lines[S.last] : null;
  return `<p class="muted">${t('sk.count', { n: S.ti + 1, total: S.targets.length })}</p><div class="card"><p class="pattern">${esc(tg.text)}</p>` +
    (tg.stress ? `<p>${t('sk.stress')}: <strong>${esc(tg.stress)}</strong></p>` : '') + (tg.tip_bn && s.bengali_support !== 'off' ? `<p lang="bn" class="bn">${t('sk.tip')}: ${esc(tg.tip_bn)}</p>` : '') + hear(tg.text) + '</div>' +
    (last ? `<div class="bubble you"><p>${esc(last.text)}</p>${youExtras(s, last, S.last)}</div>` : '');
}
function controls() {
  if (S.targets && !S.targets[S.ti]) return `<button class="btn" data-act="sk-end"${S.busy ? ' disabled' : ''}>${t('sk.end')}</button>`;
  if (S.busy) return `<p class="muted" role="status">${S.recording ? t('sk.recording') : t('sk.thinking')}</p>`;
  const next = S.targets && S.last !== null ? `<button class="btn secondary" data-act="sk-next">${t(S.ti + 1 < S.targets.length ? 'sk.next' : 'sk.finish')}</button>` : '';
  return (S.err ? `<p class="fb bad" role="alert">${esc(S.err)}</p>${upgradeLink(S.errCode)}${S.pending ? `<button class="btn secondary" data-act="sk-resend">${t('sk.tryAgain')}</button>` : ''}` : '') +
    `<div class="ctl">${S.typing ? `<input id="sk-text" class="field" type="text" autocomplete="off" value="${esc(S.draft)}" placeholder="${t('sk.typePlaceholder')}" aria-label="${t('sk.typePlaceholder')}"><button class="btn" data-act="sk-send-text">${t('sk.send')}</button>` : ''}` +
    (canRecord() ? `<button class="mic${S.recording ? ' on' : ''}" data-act="sk-rec" aria-label="${t(S.recording ? 'sk.mic.stop' : 'sk.mic.start')}">${icon('speak')}</button><p class="muted">${t(S.recording ? 'sk.recording' : 'sk.mic.start')}</p>` : `<p class="muted">${t('sk.error.noMic')}</p>`) +
    `<button class="chip" data-act="sk-type-toggle">${t(S.typing ? 'sk.useMic' : 'sk.typeInstead')}</button></div>${next}`;
}
function summaryView(s) {
  const m = S.summary;
  const corr = m.corrections.length ? `<h2 class="sec">${t('sk.sum.corrections')}</h2>` + m.corrections.map((c) => `<div class="card"><p><strong>${esc(c.corrected_text)}</strong></p><p class="muted">${t('sk.youSaid')}: ${esc(c.original_text)}</p>${bnTxt(s, c.explanation_bn)}</div>`).join('') : '';
  return `<div class="lp"><h1>${t('sk.sum.title')}</h1><div class="card"><p>${t('sk.sum.turns', { n: m.turns })}</p>${S.targets ? '' : `<p>${t('sk.sum.words', { n: m.words })}</p>`}` +
    (S.sc ? `<p class="fb ${m.goal_met ? 'ok' : ''}">${t(m.goal_met ? 'sk.sum.goal' : 'sk.sum.goalNo')}</p>` : '') +
    (m.accuracy_pct !== null ? `<p>${t('sk.sum.accuracy', { pct: m.accuracy_pct })}</p><p class="muted">${t('sk.cmpNote')}</p>` : '') + (m.avg_wpm ? `<p>${t('sk.sum.wpm', { n: m.avg_wpm })}</p>` : '') + `</div>${corr}<p>${t('sk.sum.' + m.encouragement)}</p>` +
    `<button class="btn" data-act="sk-start" data-mode="${S.mode}" data-id="${S.id}">${t('sk.sum.again')}</button><button class="btn secondary" data-act="sk-leave">${t('sk.sum.home')}</button></div>`;
}
export function sessionView(s) {
  if (!S) return `<div class="lp"><a class="back" href="#/speak">${t('sk.back')}</a></div>`;
  if (S.summary) return summaryView(s);
  const title = S.sc ? S.sc.title_en || S.sc.text : t('sk.mode.' + S.mode);
  return `<div class="lp"><div class="line"><button class="chip" data-act="sk-leave">${t('sk.leave')}</button><button class="chip" data-act="sk-end"${S.busy ? ' disabled' : ''}>${t('sk.end')}</button></div><h1>${esc(title)}</h1>` +
    (S.sc && S.sc.goal_en ? `<p class="muted">${t('sk.goal', { goal: esc(S.sc.goal_en) })}</p>` : '') + (S.targets ? targetBody(s) : chatBody(s)) + controls() + '</div>';
}

// ---- actions ----
async function post(body, key) {
  S.busy = true; S.err = null; S.errCode = null; setState({});
  try { const r = await api('POST', `/speaking/sessions/${S.sessionId}/turns`, body, { 'Idempotency-Key': key }); S.pending = null; apply(r); }
  catch (e) { S.err = errText(e); S.errCode = e && e.code; noteQuotaError(e); if (!RETRYABLE.includes(e.code)) S.pending = null; }
  S.busy = false; setState({});
}
async function send({ text, blob, duration_ms }) {
  const kind = S.targets ? 'repeat' : S.retry ? 'retry' : 'reply';
  const body = { kind, ...(kind !== 'reply' ? { target_text: S.targets ? S.targets[S.ti].text : S.retry } : {}) };
  S.audioBlob = blob || null;
  try { if (blob) body.audio = { data: await toBase64(blob), mime: blob.type, duration_ms }; else body.text = text; } catch (e) { S.err = t('err.server_error'); return setState({}); }
  S.pending = { body, key: newKey() };
  return post(S.pending.body, S.pending.key);
}
function apply(r) {
  if (r.no_speech) { S.err = t('sk.noSpeech'); return; }
  const s = getState();
  S.lines.push({ who: 'you', text: r.transcript, stt: r.stt, fluency: r.fluency, fb: r.feedback || null, cmp: r.compare || null, audioUrl: S.audioBlob ? URL.createObjectURL(S.audioBlob) : null });
  S.audioBlob = null; S.last = S.lines.length - 1;
  if (r.kind === 'retry') S.retry = null;
  if (r.coach) { S.lines.push({ who: 'coach', text: r.coach.reply_en, bn: r.coach.reply_bn }); tts(r.coach.reply_en, s.accent, RATE[s.listen_speed]); }
  if (r.kind === 'reply') { S.suggest = r.suggested_replies || []; if (r.goal_met) S.goalMet = true; }
  // Learning engine: speaking turns, corrections (mistake record and review item), words the recognizer missed, and spoken review.
  let patch = {};
  const add = (p) => { patch = { ...patch, ...p }; };
  if (r.kind === 'reply') add(recordSpeakTurn({ ...s, ...patch }));
  if (r.feedback) add(recordSpeaking({ ...s, ...patch }, r.feedback));
  if (r.compare && r.compare.missing && r.compare.missing.length) add(recordMissedWords({ ...s, ...patch }, r.compare.missing));
  const tg = S.targets && S.targets[S.ti];
  if (S.mode === 'review' && r.kind === 'repeat' && r.compare && r.compare.matched && tg && tg.mid) add(recordSpokenReview({ ...s, ...patch }, tg.mid));
  if (Object.keys(patch).length) setState(patch);
}
async function finishRec() {
  if (!S || !S.recording) return;
  S.recording = false;
  const { blob, duration_ms } = await stopRec();
  if (!blob || duration_ms < 600) { S.err = t('sk.noSpeech'); return setState({}); }
  return send({ blob, duration_ms });
}
async function toggleRec() {
  if (S.recording) return finishRec();
  try { await startRec(finishRec); S.recording = true; S.err = null; S.errCode = null; } catch (e) { S.err = t('sk.error.noMic'); S.errCode = null; S.typing = true; }
  return setState({});
}
function logSession(m) {
  const s = getState();
  const entry = { at: Date.now(), mode: S.mode, scenario_id: S.id, level: S.sc && S.sc.level ? S.sc.level : null, turns: m.turns, words: m.words, goal_met: !!m.goal_met, accuracy_pct: m.accuracy_pct === undefined ? null : m.accuracy_pct, avg_wpm: m.avg_wpm || null };
  track('speaking_session_ended', { mode: S.mode, turns: Math.min(100, m.turns || 0), goal_met: !!m.goal_met });
  setState({ ...practicePatch(s, Math.max(60, m.turns * 45), (d) => { d.ss += 1; }), ...sessionLog(s, entry) });
  syncSoon();
}
async function endSession() {
  if (S.busy || S.summary) return;
  S.busy = true; setState({});
  try { S.summary = await api('POST', `/speaking/sessions/${S.sessionId}/end`); logSession(S.summary); } catch (e) { S.err = errText(e); }
  S.busy = false; setState({});
}
function leave() {
  if (canSpeak()) speechSynthesis.cancel();
  if (S && S.recording) stopRec();
  if (S) S.lines.forEach((l) => { if (l.audioUrl) URL.revokeObjectURL(l.audioUrl); });
  S = null; location.hash = '#/speak'; setState({});
}
export async function skAct(el) {
  const d = el.dataset; const s = getState();
  if (d.act === 'sk-start') return start(d.mode, d.id);
  if (d.act === 'sk-leave') return leave();
  if (!S) return;
  switch (d.act) {
    case 'sk-hear': tts(d.text, s.accent, RATE[s.listen_speed]); return;
    case 'sk-type-toggle': S.typing = !S.typing; return setState({});
    case 'sk-suggest': tts(d.text, s.accent, RATE[s.listen_speed]); S.typing = true; S.draft = d.text; return setState({});
    case 'sk-send-text': { const text = ((document.getElementById('sk-text') || {}).value || '').trim(); if (!text) return; S.draft = ''; return send({ text }); }
    case 'sk-rec': return toggleRec();
    case 'sk-retry': S.retry = d.text; tts(d.text, s.accent, RATE[s.listen_speed]); return setState({});
    case 'sk-cancel-retry': S.retry = null; return setState({});
    case 'sk-resend': if (S.pending) return post(S.pending.body, S.pending.key); return;
    case 'sk-playmine': { const l = S.lines[Number(d.i)]; if (l && l.audioUrl) new Audio(l.audioUrl).play().catch(() => {}); return; }
    case 'sk-next': S.ti += 1; S.last = null; S.err = null; return setState({});
    case 'sk-hints': S.hintsHidden = false; return setState({});
    case 'sk-end': return endSession();
  }
}
