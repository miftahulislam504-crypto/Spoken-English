import { ApiError, rateLimit } from './http.js';
import { rest } from './supabase.js';
import * as v from './validate.js';
import { cleanAudio, transcribe } from './stt.js';
import { coachTurn } from './ai.js';
import { compareWords, fluencyObs } from '../../www/src/engine/speech.js';
import { speakMistakeId } from '../../www/src/engine/mistakes.js';
import { getEntitlement, assertMode, assertTurns, assertStt, aiAvailable } from './entitlements.js';
import { inputCost, outputCost, sttCost } from './cost.js';
import { SCENARIOS, QUESTIONS, REPEAT_SETS } from '../../www/src/content/speaking.js';

const q = encodeURIComponent;
const MODES = ['guided', 'roleplay', 'free', 'repeat', 'answer', 'review'];
const UUID = /^[0-9a-f-]{36}$/i;
const MAX_TURNS = 30;

function scenarioFor(mode, sid) {
  if (mode === 'guided' || mode === 'roleplay') return SCENARIOS.find((x) => x.id === sid);
  if (mode === 'answer') return QUESTIONS.find((x) => x.id === sid);
  if (mode === 'repeat') return REPEAT_SETS.find((x) => x.id === sid);
  return sid === mode ? { id: sid } : null;
}
async function loadSession(user, id) {
  if (!UUID.test(id)) throw new ApiError(404, 'not_found');
  const rows = await rest('GET', `conversation_sessions?id=eq.${id}&user_id=eq.${user.id}&select=*`, { service: true });
  if (!rows || !rows[0]) throw new ApiError(404, 'not_found');
  return rows[0];
}
const idemKey = (req) => {
  const k = req.headers['idempotency-key'];
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(k || '')) throw new ApiError(400, 'invalid_input', undefined, 'Idempotency-Key header is required');
  return k;
};

const createSession = async ({ user, body }) => {
  const b = v.obj(body, 'body');
  const mode = v.oneOf(b.mode, 'mode', MODES);
  const sid = v.str(b.scenario_id, 'scenario_id', { min: 1, max: 64 });
  if (!scenarioFor(mode, sid)) throw new ApiError(400, 'invalid_input', undefined, 'scenario_id is not known');
  assertMode(await getEntitlement(user.id), mode);
  const prof = await rest('GET', `profiles?id=eq.${user.id}&select=current_level`, { service: true });
  const level = (prof && prof[0] && prof[0].current_level) || 'Pre-A1';
  await rest('PATCH', `conversation_sessions?user_id=eq.${user.id}&session_status=eq.active`, { service: true, body: { session_status: 'abandoned', ended_at: new Date().toISOString() }, prefer: 'return=minimal' });
  const rows = await rest('POST', 'conversation_sessions', { service: true, prefer: 'return=representation', body: { user_id: user.id, scenario_id: `${mode}:${sid}`, mode, level_at_start: level } });
  return { session_id: rows[0].id, mode, scenario_id: sid, level, max_turns: MAX_TURNS };
};

// The key is shared with the phone (speakMistakeId), so the same correction is one record on every device. A resolved mistake that comes back is reopened.
async function recordMistake(userId, fb) {
  const cid = speakMistakeId(fb.corrected_text); const now = new Date().toISOString();
  const found = await rest('GET', `mistake_records?user_id=eq.${userId}&client_id=eq.${q(cid)}&select=id,occurrence_count&limit=1`, { service: true });
  if (found && found[0]) return rest('PATCH', `mistake_records?id=eq.${found[0].id}`, { service: true, prefer: 'return=minimal', body: { occurrence_count: found[0].occurrence_count + 1, last_seen_at: now, resolved_at: null, resolved_by: null } });
  return rest('POST', 'mistake_records', { service: true, prefer: 'return=minimal', body: { user_id: userId, client_id: cid, kind: 'speaking', skill: 'speaking', error_type: fb.error_type, original_text: fb.original_text, corrected_text: fb.corrected_text, explanation_bn: fb.explanation_bn || null, alternative_text: fb.alternative_text || null } });
}

const postTurn = async ({ req, user, params, body }) => {
  rateLimit('turn:' + user.id, 30);
  const key = idemKey(req);
  const row = (usage_type, quantity, unit, suffix, cost_usd) => ({ user_id: user.id, usage_type, quantity, unit, idempotency_key: `${key}:${suffix}`, cost_usd });
  const saveUsage = (rows) => rest('POST', 'usage_ledger?on_conflict=user_id,idempotency_key', { service: true, prefer: 'resolution=ignore-duplicates,return=minimal', body: rows });
  const sess = await loadSession(user, params[0]);
  const b = v.obj(body, 'body');
  const kind = b.kind === undefined ? 'reply' : v.oneOf(b.kind, 'kind', ['reply', 'repeat', 'retry']);
  const target = kind === 'reply' ? null : v.str(b.target_text, 'target_text', { min: 1, max: 200 });
  const hasText = typeof b.text === 'string'; const hasAudio = b.audio !== undefined;
  if (hasText === hasAudio) throw new ApiError(400, 'invalid_input', undefined, 'send either text or audio');

  const prev = await rest('GET', `conversation_turns?session_id=eq.${sess.id}&idempotency_key=eq.${q(key)}&select=feedback_json`, { service: true });
  if (prev && prev[0]) return { ...prev[0].feedback_json.result, replayed: true };
  if (sess.session_status !== 'active') throw new ApiError(409, 'conflict');
  const done = await rest('GET', `conversation_turns?session_id=eq.${sess.id}&speaker=eq.learner&select=id`, { service: true });
  if ((done || []).length >= MAX_TURNS) throw new ApiError(409, 'conflict');

  // Plan limits are checked before any paid call, so a refused turn costs nothing.
  const ent = await getEntitlement(user.id);
  if (kind === 'reply') {
    assertTurns(ent);
    const ai = await aiAvailable();
    if (!ai.ok) { console.error(JSON.stringify({ event: 'ai_stopped', reason: ai.reason })); throw new ApiError(503, 'ai_unavailable', undefined, ai.reason); }
  }
  let text; let stt = null; let fluency = null;
  if (hasAudio) {
    const audio = cleanAudio(b.audio);
    assertStt(ent, audio.duration_ms / 1000);
    const tr = await transcribe(audio);
    if (!tr.text) { await saveUsage([row('stt_seconds', Math.round(tr.duration_s * 10) / 10, 'second', 'stt', sttCost(tr.duration_s))]); return { kind, transcript: '', understood: false, no_speech: true }; } // the provider bills silence too
    text = tr.text.slice(0, 500);
    stt = { confidence: tr.confidence, duration_s: Math.round(tr.duration_s * 10) / 10 };
    fluency = fluencyObs(text, tr.duration_s, tr.segments);
  } else text = v.str(b.text, 'text', { min: 1, max: 500 }).trim();
  if (!text) throw new ApiError(400, 'invalid_input', undefined, 'text is empty');

  let result; let tokens = null;
  if (kind !== 'reply') {
    result = { kind, transcript: text, understood: true, compare: compareWords(target, text), stt, fluency };
  } else {
    const scenario = scenarioFor(sess.mode, sess.scenario_id.slice(sess.mode.length + 1));
    const hist = await rest('GET', `conversation_turns?session_id=eq.${sess.id}&select=speaker,transcript&order=created_at.desc&limit=8`, { service: true });
    const r = await coachTurn({ mode: sess.mode, scenario, level: sess.level_at_start || 'Pre-A1', history: (hist || []).reverse(), utterance: text, lowConfidence: !!(stt && stt.confidence !== null && stt.confidence < 0.6) });
    tokens = r.usage;
    result = { kind, transcript: text, understood: r.understood, goal_met: r.goal_met, coach: { reply_en: r.coach_reply_en, reply_bn: r.coach_reply_bn }, suggested_replies: r.suggested_replies, feedback: r.feedback, stt, fluency };
  }
  const now = Date.now();
  const rows = [{ session_id: sess.id, speaker: 'learner', transcript: text, kind, idempotency_key: key, feedback_json: { kind, result }, created_at: new Date(now).toISOString() }];
  if (result.coach) rows.push({ session_id: sess.id, speaker: 'coach', transcript: result.coach.reply_en, kind, created_at: new Date(now + 1).toISOString() });
  await rest('POST', 'conversation_turns', { service: true, prefer: 'return=minimal', body: rows });
  const usage = [row('speaking_turn', kind === 'reply' ? 1 : 0, 'turn', 'turn', null)];
  if (stt) usage.push(row('stt_seconds', stt.duration_s, 'second', 'stt', sttCost(stt.duration_s)));
  if (tokens) usage.push(row('ai_input_tokens', tokens.input_tokens, 'token', 'in', inputCost(tokens.input_tokens)), row('ai_output_tokens', tokens.output_tokens, 'token', 'out', outputCost(tokens.output_tokens)));
  await saveUsage(usage);
  if (result.feedback) await recordMistake(user.id, result.feedback).catch(() => {});
  return result;
};

function buildSummary(sess, turns) {
  const results = turns.map((t) => (t.feedback_json || {}).result).filter(Boolean);
  const words = results.reduce((n, r) => n + String(r.transcript || '').split(/\s+/).filter(Boolean).length, 0);
  const seen = new Set(); const corrections = [];
  results.forEach((r) => { const f = r.feedback; if (f && !seen.has(f.corrected_text) && corrections.length < 5) { seen.add(f.corrected_text); corrections.push({ original_text: f.original_text, corrected_text: f.corrected_text, explanation_bn: f.explanation_bn, error_type: f.error_type }); } });
  const cmp = results.filter((r) => r.compare); const flu = results.filter((r) => r.fluency);
  const goal_met = results.some((r) => r.goal_met === true);
  return {
    mode: sess.mode, level: sess.level_at_start, turns: results.length, words, goal_met, corrections,
    accuracy_pct: cmp.length ? Math.round((cmp.reduce((n, r) => n + r.compare.accuracy, 0) / cmp.length) * 100) : null,
    avg_wpm: flu.length ? Math.round(flu.reduce((n, r) => n + r.fluency.wpm, 0) / flu.length) : null,
    encouragement: goal_met ? 'goal_met' : results.length < 2 ? 'few' : 'good'
  };
}
const endSession = async ({ user, params }) => {
  const sess = await loadSession(user, params[0]);
  if (sess.session_status === 'ended' && sess.summary) return JSON.parse(sess.summary);
  if (sess.session_status !== 'active') throw new ApiError(409, 'conflict');
  const turns = await rest('GET', `conversation_turns?session_id=eq.${sess.id}&speaker=eq.learner&select=feedback_json&order=created_at`, { service: true });
  const summary = buildSummary(sess, turns || []);
  await rest('PATCH', `conversation_sessions?id=eq.${sess.id}`, { service: true, prefer: 'return=minimal', body: { session_status: 'ended', ended_at: new Date().toISOString(), summary: JSON.stringify(summary) } });
  return summary;
};
const getSummary = async ({ user, params }) => {
  const sess = await loadSession(user, params[0]);
  if (!sess.summary) throw new ApiError(409, 'conflict');
  return JSON.parse(sess.summary);
};

export const speakingRoutes = [
  ['POST', /^speaking\/sessions$/, createSession],
  ['POST', /^speaking\/sessions\/([\w-]+)\/turns$/, postTurn],
  ['POST', /^speaking\/sessions\/([\w-]+)\/end$/, endSession],
  ['GET', /^speaking\/sessions\/([\w-]+)\/summary$/, getSummary]
];
