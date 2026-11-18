// Mistakes, review schedule, listening results, practice log and skill snapshots (plan sections 10, 11 and 6.8).
// The phone sends what the learner did; the server checks every field, merges it with what the account already has, and saves it.
import { ApiError } from './http.js';
import { rest } from './supabase.js';
import * as v from './validate.js';
import { mergeMistakes, mergeReview, mergeDaily, mergeListening } from '../../www/src/engine/merge.js';
import { STEP_DAYS } from '../../www/src/engine/srs.js';

const q = encodeURIComponent;
const SKILL = ['listening', 'vocabulary', 'sentence', 'grammar', 'speaking'];
const KIND = ['speaking', 'step', 'note'];
const ERR = ['verb_tense', 'subject_verb_agreement', 'word_order', 'article', 'preposition', 'vocabulary', 'pluralization', 'pronoun', 'spelling_or_unclear', 'other'];
const CONF = ['none', 'low', 'medium', 'high'];
const MAX_MS = 4102444800000;
const ms = (x, name) => v.int(x, name, 0, MAX_MS);
const msOrNull = (x, name) => (x === null || x === undefined ? null : ms(x, name));
const iso = (n) => (n === null || n === undefined ? null : new Date(n).toISOString());
const toMs = (s) => (s ? Date.parse(s) : null);
const text = (x, name, max) => (x === undefined || x === null ? '' : v.str(x, name, { max }));
const list = (x, name, max) => (Array.isArray(x) && x.length <= max ? x : x === undefined ? [] : (() => { throw new ApiError(400, 'invalid_input', undefined, `${name} must be a list of at most ${max}`); })());

// ---- checking what the phone sends ----
export function cleanMistake(x, i) {
  const o = v.obj(x, `mistakes[${i}]`);
  const kind = v.oneOf(o.kind, 'kind', KIND);
  const skill = o.skill === null || o.skill === undefined ? null : v.oneOf(o.skill, 'skill', SKILL);
  const err = o.error_type === null || o.error_type === undefined ? null : v.oneOf(o.error_type, 'error_type', ERR);
  const resolved = msOrNull(o.resolved_at, 'resolved_at');
  return {
    id: v.str(o.id, 'id', { min: 3, max: 220 }), kind, ref: o.ref ? v.str(o.ref, 'ref', { max: 60 }) : null, lesson_id: o.lesson_id ? v.id(o.lesson_id) : null,
    skill, error_type: err, prompt: text(o.prompt, 'prompt', 300), user: text(o.user, 'user', 300), expected: text(o.expected, 'expected', 300),
    explanation_bn: text(o.explanation_bn, 'explanation_bn', 400), alternative: text(o.alternative, 'alternative', 300),
    count: v.int(o.count, 'count', 1, 100000), first_at: ms(o.first_at, 'first_at'), last_at: ms(o.last_at, 'last_at'),
    resolved_at: resolved, resolved_by: resolved ? (['review', 'learner'].includes(o.resolved_by) ? o.resolved_by : 'review') : null
  };
}
export function cleanReview(x, i) {
  const o = v.obj(x, `review[${i}]`);
  const id = v.str(o.id, 'id', { min: 3, max: 223 });
  if (!id.startsWith('m:')) throw new ApiError(400, 'invalid_input', undefined, 'only mistake review items are stored');
  return {
    id, type: 'mistake', box: v.int(o.box, 'box', 0, STEP_DAYS.length), due: ms(o.due, 'due'), reps: v.int(o.reps, 'reps', 0, 100000), lapses: v.int(o.lapses, 'lapses', 0, 100000),
    last: o.last === null || o.last === undefined ? null : v.oneOf(o.last, 'last', ['right', 'wrong']), last_at: msOrNull(o.last_at, 'last_at'), created_at: ms(o.created_at, 'created_at')
  };
}
export function cleanListening(x, i) {
  const o = v.obj(x, `listening[${i}]`);
  return { item_id: v.id(o.item_id), attempts: v.int(o.attempts, 'attempts', 0, 100000), best: v.int(o.best, 'best', 0, 100), last_score: v.int(o.last_score === undefined ? 0 : o.last_score, 'last_score', 0, 100), last_at: msOrNull(o.last_at, 'last_at') };
}
const DAY_NUM = ['sec', 'mis', 'res', 'sp', 'ss', 'ls', 'lc'];
const pair = (x, name) => (Array.isArray(x) && x.length === 2 && Number.isInteger(x[0]) && Number.isInteger(x[1]) && x[0] >= 0 && x[1] >= 0 && x[1] <= x[0] && x[0] <= 100000 ? [x[0], x[1]] : (() => { throw new ApiError(400, 'invalid_input', undefined, `${name} is invalid`); })());
export function cleanDay(x, i) {
  const o = v.obj(x, `activity[${i}]`); const day = v.str(o.day, 'day', { min: 10, max: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) throw new ApiError(400, 'invalid_input', undefined, 'day is invalid');
  const d = v.obj(o.data, 'data'); const data = {};
  DAY_NUM.forEach((k) => { data[k] = d[k] === undefined ? 0 : v.int(d[k], k, 0, 1000000); });
  data.rv = d.rv === undefined ? [0, 0] : pair(d.rv, 'rv');
  data.ex = {}; const ex = d.ex === undefined ? {} : v.obj(d.ex, 'ex');
  Object.keys(ex).forEach((k) => { data.ex[v.oneOf(k, 'skill', SKILL)] = pair(ex[k], 'ex'); });
  return { day, data };
}
export function cleanSkill(x, i) {
  const o = v.obj(x, `skills[${i}]`);
  return { skill_type: v.oneOf(o.skill_type, 'skill_type', SKILL), score: o.score === null || o.score === undefined ? null : v.num(o.score, 'score', 0, 100), confidence: v.oneOf(o.confidence, 'confidence', CONF), n: v.int(o.n, 'n', 0, 1000000), c: v.int(o.c, 'c', 0, 1000000), level: o.level ? v.oneOf(o.level, 'level', ['Pre-A1', 'A1', 'A2', 'B1', 'B2', 'Advanced']) : null };
}
export function cleanStudy(body) {
  const b = v.obj(body, 'body');
  return {
    mistakes: list(b.mistakes, 'mistakes', 200).map(cleanMistake), review: list(b.review, 'review', 300).map(cleanReview), listening: list(b.listening, 'listening', 80).map(cleanListening),
    activity: list(b.activity, 'activity', 120).map(cleanDay), skills: list(b.skills, 'skills', 10).map(cleanSkill)
  };
}

// ---- database rows <-> the shapes the phone uses ----
export const mistakeFromRow = (r) => ({
  id: r.client_id, kind: r.kind, ref: r.ref, lesson_id: r.ref && !r.ref.startsWith('listen:') ? r.ref.split(':')[0] : null, skill: r.skill, error_type: r.kind === 'speaking' ? r.error_type : null,
  prompt: r.prompt || '', user: r.original_text || '', expected: r.corrected_text || '', explanation_bn: r.explanation_bn || '', alternative: r.alternative_text || '',
  count: r.occurrence_count, first_at: toMs(r.first_seen_at), last_at: toMs(r.last_seen_at), resolved_at: toMs(r.resolved_at), resolved_by: r.resolved_by || null
});
export const mistakeToRow = (userId, m) => ({
  user_id: userId, client_id: m.id, kind: m.kind, ref: m.ref, skill: m.skill, error_type: m.error_type || m.skill || 'other', prompt: m.prompt || null, original_text: m.user || null, corrected_text: m.expected || null,
  explanation_bn: m.explanation_bn || null, alternative_text: m.alternative || null, occurrence_count: m.count, first_seen_at: iso(m.first_at), last_seen_at: iso(m.last_at), resolved_at: iso(m.resolved_at), resolved_by: m.resolved_by
});
export const reviewFromRow = (r) => ({ id: r.content_reference, type: r.review_type, box: r.box, due: toMs(r.due_at), reps: r.reps, lapses: r.lapses, last: r.last_result, last_at: toMs(r.last_reviewed_at), created_at: toMs(r.updated_at) });
export const reviewToRow = (userId, it) => ({ user_id: userId, content_reference: it.id, review_type: 'mistake', due_at: iso(it.due), interval_days: it.box > 0 ? STEP_DAYS[it.box - 1] : 0, last_result: it.last, box: it.box, reps: it.reps, lapses: it.lapses, last_reviewed_at: iso(it.last_at) });
export const listeningFromRow = (r) => ({ item_id: r.item_id, attempts: r.attempts, best: r.best_score, last_score: r.last_score, last_at: toMs(r.last_at) });
export const listeningToRow = (userId, x) => ({ user_id: userId, item_id: x.item_id, attempts: x.attempts, best_score: x.best, last_score: x.last_score, last_at: iso(x.last_at) });

const MISTAKE_COLS = 'client_id,kind,ref,skill,error_type,prompt,original_text,corrected_text,explanation_bn,alternative_text,occurrence_count,first_seen_at,last_seen_at,resolved_at,resolved_by';
const REVIEW_COLS = 'content_reference,review_type,due_at,box,reps,lapses,last_result,last_reviewed_at,updated_at';
const LISTEN_COLS = 'item_id,attempts,best_score,last_score,last_at';
const since = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

async function readAll(userId, token, service = false) {
  const opt = service ? { service: true } : { token };
  const [m, r, l, a] = await Promise.all([
    rest('GET', `mistake_records?user_id=eq.${userId}&client_id=not.is.null&select=${MISTAKE_COLS}&order=last_seen_at.desc&limit=400`, opt),
    rest('GET', `review_queue?user_id=eq.${userId}&review_type=eq.mistake&select=${REVIEW_COLS}&limit=600`, opt),
    rest('GET', `listening_progress?user_id=eq.${userId}&select=${LISTEN_COLS}&limit=200`, opt),
    rest('GET', `daily_activity?user_id=eq.${userId}&day=gte.${since(120)}&select=day,data&order=day&limit=200`, opt)
  ]);
  return { mistakes: (m || []).map(mistakeFromRow), review: (r || []).map(reviewFromRow), listening: (l || []).map(listeningFromRow), activity: a || [] };
}

const getStudy = async ({ user }) => readAll(user.id, user.token);

// Saves what the phone sent after merging it with what the account already has, so two phones never overwrite each other.
const putStudy = async ({ user, body }) => {
  const inc = cleanStudy(body); const uid = user.id;
  const cur = await readAll(uid, null, true);
  const mistakes = mergeMistakes(cur.mistakes, inc.mistakes).slice(0, 300);
  const review = Object.values(mergeReview(Object.fromEntries(cur.review.map((x) => [x.id, x])), Object.fromEntries(inc.review.map((x) => [x.id, x])))).filter((it) => mistakes.some((m) => 'm:' + m.id === it.id && !m.resolved_at)).slice(0, 300);
  const listening = Object.entries(mergeListening(Object.fromEntries(cur.listening.map((x) => [x.item_id, x])), Object.fromEntries(inc.listening.map((x) => [x.item_id, x])))).map(([item_id, r]) => ({ item_id, ...r }));
  const activity = Object.entries(mergeDaily(Object.fromEntries(cur.activity.map((x) => [x.day, x.data])), Object.fromEntries(inc.activity.map((x) => [x.day, x.data])))).map(([day, data]) => ({ user_id: uid, day, data }));
  const post = (table, conflict, rows) => (rows.length ? rest('POST', `${table}?on_conflict=${conflict}`, { service: true, prefer: 'resolution=merge-duplicates,return=minimal', body: rows }) : null);
  await post('mistake_records', 'user_id,client_id', mistakes.map((m) => mistakeToRow(uid, m)));
  await post('review_queue', 'user_id,content_reference,review_type', review.map((it) => reviewToRow(uid, it)));
  await post('listening_progress', 'user_id,item_id', listening.map((x) => listeningToRow(uid, x)));
  await post('daily_activity', 'user_id,day', activity);
  // Skill snapshots for later analytics: at most one per skill every 20 hours.
  if (inc.skills.length) {
    const recent = await rest('GET', `skill_assessments?user_id=eq.${uid}&assessed_at=gte.${q(new Date(Date.now() - 20 * 3600000).toISOString())}&select=skill_type`, { service: true });
    const have = new Set((recent || []).map((x) => x.skill_type));
    const rows = inc.skills.filter((x) => !have.has(x.skill_type)).map((x) => ({ user_id: uid, skill_type: x.skill_type, score: x.score, confidence: x.confidence, evidence_json: { n: x.n, c: x.c, level: x.level, source: 'phone-reported' }, assessment_version: 1 }));
    if (rows.length) await rest('POST', 'skill_assessments', { service: true, prefer: 'return=minimal', body: rows });
  }
  return { saved: { mistakes: mistakes.length, review: review.length, listening: listening.length, activity: activity.length } };
};

export const studyRoutes = [
  ['GET', /^me\/study$/, getStudy],
  ['PUT', /^me\/study$/, putStudy]
];
