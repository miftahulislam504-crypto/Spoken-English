// What a learner can do with their own data (plan section 15): download it, delete their speaking history, sync saved words, delete the account.
import crypto from 'node:crypto';
import { ApiError, rateLimit } from './http.js';
import { rest, env, timedFetch } from './supabase.js';
import * as v from './validate.js';
import { mergeWords } from '../../www/src/engine/merge.js';

const q = encodeURIComponent;
const svc = { service: true };

// ---- download my data ----
// Everything saved under the learner's account, as one file. Voice recordings are not in it because they are never stored.
const exportMe = async ({ user }) => {
  rateLimit('export:' + user.id, 3, 3600000);
  const uid = user.id; const get = (path) => rest('GET', path, svc).then((r) => r || []);
  const [profile, progress, attempts, sessions, mistakes, review, listening, activity, words, skills, subs, usage, feedback, events] = await Promise.all([
    get(`profiles?id=eq.${uid}&select=*`), get(`user_lesson_progress?user_id=eq.${uid}&select=*&limit=500`), get(`exercise_attempts?user_id=eq.${uid}&select=exercise_id,lesson_id,is_correct,attempt_number,created_at&order=created_at.desc&limit=3000`),
    get(`conversation_sessions?user_id=eq.${uid}&select=*&order=started_at.desc&limit=300`), get(`mistake_records?user_id=eq.${uid}&select=*&limit=500`), get(`review_queue?user_id=eq.${uid}&select=*&limit=1000`),
    get(`listening_progress?user_id=eq.${uid}&select=*&limit=300`), get(`daily_activity?user_id=eq.${uid}&select=*&order=day.desc&limit=400`), get(`saved_words?user_id=eq.${uid}&select=*&limit=500`),
    get(`skill_assessments?user_id=eq.${uid}&select=*&order=assessed_at.desc&limit=300`), get(`subscriptions?user_id=eq.${uid}&select=plan_id,provider,status,store_state,current_period_end,started_at,auto_renew,is_test&limit=50`),
    get(`usage_ledger?user_id=eq.${uid}&select=usage_type,quantity,unit,created_at&order=created_at.desc&limit=3000`), get(`feedback_reports?user_id=eq.${uid}&select=kind,message,context,status,created_at&limit=200`),
    get(`analytics_events?user_id=eq.${uid}&select=name,props,at&order=at.desc&limit=3000`)
  ]);
  const ids = sessions.map((s) => s.id);
  const turns = ids.length ? await get(`conversation_turns?session_id=in.(${ids.map(q).join(',')})&select=session_id,speaker,transcript,kind,feedback_json,created_at&order=created_at&limit=5000`) : [];
  const clean = (rows) => rows.map(({ user_id, ...r }) => r); // the learner's own id is not repeated on every row
  return {
    format_version: 1, exported_at: new Date().toISOString(), account: { id: uid, email: user.email },
    note: 'Voice recordings are never stored, so none are included. Lesson answers are checked on your phone; the numbers here are what your phone reported.',
    profile: profile[0] || null, lesson_progress: clean(progress), exercise_attempts: clean(attempts), speaking_sessions: clean(sessions).map((s) => ({ ...s, turns: turns.filter((t) => t.session_id === s.id).map(({ session_id, user_id, ...t }) => t) })),
    mistakes: clean(mistakes), review_schedule: clean(review), listening_results: clean(listening), practice_log: clean(activity), saved_words: clean(words), skill_snapshots: clean(skills),
    subscriptions: clean(subs), usage: clean(usage), feedback_sent: clean(feedback), usage_statistics_events: clean(events)
  };
};

// ---- delete my speaking history ----
const deleteSpeakingHistory = async ({ user }) => {
  rateLimit('privacy:' + user.id, 10, 3600000);
  const rows = await rest('DELETE', `conversation_sessions?user_id=eq.${user.id}&select=id`, { ...svc, prefer: 'return=representation' });
  return { deleted_sessions: (rows || []).length };
};

// ---- saved words ----
const WORD_COLS = 'client_id,en,bn,example,custom,in_review,seen,seen_correct,used,used_correct,updated_at';
const wordFromRow = (r) => ({ id: r.client_id, en: r.en, bn: r.bn || '', example: r.example || '', source: r.custom ? 'custom' : 'lesson', saved_at: Date.parse(r.updated_at) || Date.now(), in_review: r.in_review, recognition: { seen: r.seen, correct: r.seen_correct }, active: { used: r.used, correct: r.used_correct } });
const wordToRow = (uid, w) => ({ user_id: uid, client_id: w.id, en: w.en, bn: w.bn || null, example: w.example || null, custom: w.source === 'custom', in_review: w.in_review !== false, seen: w.recognition.seen, seen_correct: w.recognition.correct, used: w.active.used, used_correct: w.active.correct });
export function cleanWord(x, i) {
  const o = v.obj(x, `words[${i}]`);
  const rec = v.obj(o.recognition === undefined ? { seen: 0, correct: 0 } : o.recognition, 'recognition'); const act = v.obj(o.active === undefined ? { used: 0, correct: 0 } : o.active, 'active');
  const pair = (a, b, n1, n2) => { const x1 = v.int(a, n1, 0, 1000000); const x2 = v.int(b, n2, 0, 1000000); if (x2 > x1) throw new ApiError(400, 'invalid_input', undefined, `${n2} is more than ${n1}`); return [x1, x2]; };
  const [seen, correct] = pair(rec.seen, rec.correct, 'seen', 'correct'); const [used, ucorrect] = pair(act.used, act.correct, 'used', 'correct');
  return { id: v.str(o.id, 'id', { min: 1, max: 80 }), en: v.str(o.en, 'en', { min: 1, max: 120 }), bn: o.bn ? v.str(o.bn, 'bn', { max: 200 }) : '', example: o.example ? v.str(o.example, 'example', { max: 300 }) : '', source: o.source === 'custom' ? 'custom' : 'lesson', in_review: o.in_review !== false, recognition: { seen, correct }, active: { used, correct: ucorrect } };
}
const getWords = async ({ user }) => ({ words: ((await rest('GET', `saved_words?user_id=eq.${user.id}&select=${WORD_COLS}&limit=500`, svc)) || []).map(wordFromRow) });
const putWords = async ({ user, body }) => {
  const b = v.obj(body, 'body'); const uid = user.id;
  if (!Array.isArray(b.words) || b.words.length > 300) throw new ApiError(400, 'invalid_input', undefined, 'words must be a list of at most 300');
  const removed = b.removed === undefined ? [] : b.removed;
  if (!Array.isArray(removed) || removed.length > 300) throw new ApiError(400, 'invalid_input', undefined, 'removed must be a list of at most 300');
  const gone = new Set(removed.map((x) => v.str(x, 'removed id', { min: 1, max: 80 })));
  const inc = b.words.map(cleanWord).filter((w) => !gone.has(w.id));
  const cur = ((await rest('GET', `saved_words?user_id=eq.${uid}&select=${WORD_COLS}&limit=500`, svc)) || []).map(wordFromRow).filter((w) => !gone.has(w.id));
  const merged = mergeWords(inc, cur).slice(0, 300);
  if (gone.size) await rest('DELETE', `saved_words?user_id=eq.${uid}&client_id=in.(${[...gone].map(q).join(',')})`, { ...svc, prefer: 'return=minimal' });
  if (merged.length) await rest('POST', 'saved_words?on_conflict=user_id,client_id', { ...svc, prefer: 'resolution=merge-duplicates,return=minimal', body: merged.map((w) => wordToRow(uid, w)) });
  return { saved: merged.length };
};

// ---- delete my account ----
// Removing the sign-in removes the profile and, through cascading rules, everything that belongs to it. The learner must send { "confirm": "DELETE" }.
// The Google Play subscription is not cancelled by this; the app tells the learner so.
const deleteAccount = async ({ user, body }) => {
  rateLimit('delete:' + user.id, 3, 3600000);
  if (!body || body.confirm !== 'DELETE') throw new ApiError(400, 'confirmation_required');
  const { url, svc: key } = env();
  if (!key) throw new ApiError(500, 'server_error', 'Server is not configured.');
  const owners = (await rest('GET', 'admin_roles?role=eq.owner&select=user_id', svc).catch(() => [])) || [];
  if (owners.length === 1 && owners[0].user_id === user.id) throw new ApiError(409, 'conflict', undefined, 'last_owner'); // the dashboard must always keep an owner
  // A record that an account was deleted, with no way back to the person: only a one-way hash of the id.
  await rest('POST', 'audit_log', { ...svc, prefer: 'return=minimal', body: [{ actor_role: 'learner', action: 'account.deleted', target_type: 'account', target_id: crypto.createHash('sha256').update(user.id).digest('hex').slice(0, 16), details: {} }] }).catch((e) => console.error('audit_failed', e && e.message));
  const r = await timedFetch(`${url}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new ApiError(502, 'upstream_error');
  return { status: 204 };
};

export const privacyRoutes = [
  ['GET', /^me\/export$/, exportMe],
  ['DELETE', /^me\/speaking-history$/, deleteSpeakingHistory],
  ['GET', /^me\/words$/, getWords],
  ['PUT', /^me\/words$/, putWords],
  ['DELETE', /^me$/, deleteAccount]
];
