import { ApiError } from './http.js';
import { rest } from './supabase.js';
import * as v from './validate.js';
import { checkAnswer } from '../../www/src/engine/answers.js';
import { speakingRoutes } from './speaking.js';
import { studyRoutes } from './study.js';
import { billingRoutes } from './billing.js';
import { privacyRoutes } from './privacy.js';
import { adminRoutes } from './admin.js';
import { startWeekIndex } from '../../www/src/engine/path.js';
import { WEEKS } from '../../www/src/content/curriculum-outline.js';

const LEVELS = ['Pre-A1', 'A1', 'A2', 'B1', 'B2', 'Advanced'];
const PREFS = { accent: ['any', 'us', 'uk', 'in', 'au'], listen_speed: ['slow', 'normal', 'natural'], bengali_support: ['full', 'reduced', 'off'], reminder: ['off', 'morning', 'evening'], goal: ['conversation', 'study', 'work', 'travel', 'interviews'], comfort: ['start', 'some', 'little'] };
const PROFILE = 'id,display_name,native_language,ui_locale,explanation_language,target_language,current_level,daily_goal_minutes,preferences,created_at,updated_at';
const PROGRESS = 'lesson_id,status,attempt_count,score,mastery_score,content_version,placed,last_attempt_at,completed_at';
const q = encodeURIComponent;
const noFields = () => { throw new ApiError(400, 'invalid_input', undefined, 'No valid fields'); };

async function profile(user) {
  const rows = await rest('GET', `profiles?id=eq.${user.id}&select=${PROFILE}`, { token: user.token });
  if (!rows || !rows[0]) throw new ApiError(404, 'not_found');
  return rows[0];
}
const getMe = async ({ user }) => ({ ...(await profile(user)), email: user.email });
const patchMe = async ({ user, body }) => {
  const b = v.obj(body, 'body'); const patch = {};
  if ('display_name' in b) patch.display_name = v.str(b.display_name, 'display_name', { max: 80 });
  if ('current_level' in b) patch.current_level = v.oneOf(b.current_level, 'current_level', LEVELS);
  if ('daily_goal_minutes' in b) patch.daily_goal_minutes = v.int(b.daily_goal_minutes, 'daily_goal_minutes', 1, 240);
  if ('explanation_language' in b) patch.explanation_language = v.oneOf(b.explanation_language, 'explanation_language', ['bn', 'en']);
  if (!Object.keys(patch).length) noFields();
  const rows = await rest('PATCH', `profiles?id=eq.${user.id}&select=${PROFILE}`, { token: user.token, body: patch, prefer: 'return=representation' });
  return rows[0];
};
const patchPrefs = async ({ user, body }) => {
  const b = v.obj(body, 'body'); const add = {};
  for (const [k, allowed] of Object.entries(PREFS)) if (k in b) add[k] = v.oneOf(b[k], k, allowed);
  if ('onboarded' in b) add.onboarded = v.bool(b.onboarded, 'onboarded');
  if (!Object.keys(add).length) noFields();
  const cur = (await profile(user)).preferences || {};
  const rows = await rest('PATCH', `profiles?id=eq.${user.id}&select=${PROFILE}`, { token: user.token, body: { preferences: { ...cur, ...add } }, prefer: 'return=representation' });
  return rows[0];
};
const learningPlan = async ({ user }) => {
  const token = user.token;
  const [p, lessons, prog] = await Promise.all([
    profile(user),
    rest('GET', 'lessons?published_status=eq.published&select=id,title_en,week,sequence_number,prerequisite_lesson_ids&order=sequence_number', { token }),
    rest('GET', 'user_lesson_progress?select=lesson_id,status', { token })
  ]);
  const done = new Set(prog.filter((r) => r.status === 'completed').map((r) => r.lesson_id));
  const start = startWeekIndex(p.current_level);
  const weeks = WEEKS.map((w, i) => ({ id: w.id, title_en: w.title_en, status: i < start ? 'review' : i === start ? 'current' : 'later', lessons: lessons.filter((l) => l.week === w.id).map((l) => ({ id: l.id, title_en: l.title_en, completed: done.has(l.id) })) }));
  const next = lessons.find((l) => !done.has(l.id) && (l.prerequisite_lesson_ids || []).every((x) => done.has(x)));
  return { level: p.current_level, weeks, next_lesson_id: next ? next.id : null };
};
const getProgress = async ({ user }) => ({ lessons: await rest('GET', `user_lesson_progress?select=${PROGRESS}&order=lesson_id`, { token: user.token }) });
const putProgress = async ({ user, body }) => {
  const b = v.obj(body, 'body');
  if (!Array.isArray(b.lessons) || !b.lessons.length || b.lessons.length > 100) throw new ApiError(400, 'invalid_input', undefined, 'lessons must have 1 to 100 items');
  const rows = b.lessons.map((x, i) => {
    const o = v.obj(x, `lessons[${i}]`);
    return {
      user_id: user.id, lesson_id: v.id(o.lesson_id), status: v.oneOf(o.status, 'status', ['in_progress', 'completed']),
      attempt_count: v.int(o.attempt_count, 'attempt_count', 0, 10000), score: v.num(o.score, 'score', 0, 1), mastery_score: v.num(o.mastery_score, 'mastery_score', 0, 1),
      content_version: v.int(o.content_version, 'content_version', 1, 1000), placed: v.bool(o.placed === undefined ? false : o.placed, 'placed'),
      last_attempt_at: v.date(o.last_attempt_at, 'last_attempt_at'), completed_at: v.date(o.completed_at, 'completed_at')
    };
  });
  await rest('POST', 'user_lesson_progress?on_conflict=user_id,lesson_id', { token: user.token, body: rows, prefer: 'resolution=merge-duplicates,return=minimal' });
  return { saved: rows.length };
};

const COURSE = 'id,title,description,level,content_version';
const LESSON_LIST = 'id,title_en,level,week,sequence_number,learning_objectives,prerequisite_lesson_ids,estimated_duration_seconds,is_assessment,content_version';
const listCourses = async ({ user }) => ({ courses: await rest('GET', `courses?published_status=eq.published&select=${COURSE}&order=id`, { token: user.token }) });
const getCourse = async ({ user, params }) => {
  const id = v.id(params[0]);
  const [c, l] = await Promise.all([
    rest('GET', `courses?id=eq.${q(id)}&published_status=eq.published&select=${COURSE}`, { token: user.token }),
    rest('GET', `lessons?course_id=eq.${q(id)}&published_status=eq.published&select=${LESSON_LIST}&order=sequence_number`, { token: user.token })
  ]);
  if (!c[0]) throw new ApiError(404, 'not_found');
  return { ...c[0], lessons: l };
};
const getLesson = async ({ user, params }) => {
  const id = v.id(params[0]);
  const r = await rest('GET', `lessons?id=eq.${q(id)}&published_status=eq.published&select=${LESSON_LIST},course_id,completion_min_score,content_json`, { token: user.token });
  if (!r[0]) throw new ApiError(404, 'not_found');
  return r[0];
};
// Exercises are listed without answer rules. The answer is only checked on the server.
const getExercises = async ({ user, params }) => {
  const id = v.id(params[0]);
  return { exercises: await rest('GET', `exercises?lesson_id=eq.${q(id)}&select=id,lesson_id,position,stage,exercise_type,content_json,difficulty,scored,content_version&order=position`, { token: user.token }) };
};
function cleanAnswer(type, a) {
  if (type === 'choose' || type === 'listen_choose') return v.int(a, 'answer', 0, 9);
  if (type === 'order') {
    if (!Array.isArray(a) || a.length < 1 || a.length > 20) throw new ApiError(400, 'invalid_input', undefined, 'answer is invalid');
    return a.map((x) => v.str(x, 'answer', { max: 40 }));
  }
  return v.str(a, 'answer', { max: 300 });
}
const postAttempt = async ({ req, user, params, body }) => {
  const key = req.headers['idempotency-key'];
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(key || '')) throw new ApiError(400, 'invalid_input', undefined, 'Idempotency-Key header is required');
  const exId = v.id(params[0]); const b = v.obj(body, 'body');
  const prev = await rest('GET', `exercise_attempts?user_id=eq.${user.id}&idempotency_key=eq.${q(key)}&select=exercise_id,result_json`, { service: true });
  if (prev && prev[0]) { if (prev[0].exercise_id !== exId) throw new ApiError(409, 'conflict'); return { ...prev[0].result_json, replayed: true }; }
  const rows = await rest('GET', `exercises?id=eq.${q(exId)}&select=id,lesson_id,exercise_type,content_json,answer_rules_json,scored,lessons(published_status)`, { service: true });
  const ex = rows && rows[0];
  if (!ex || !ex.lessons || ex.lessons.published_status !== 'published') throw new ApiError(404, 'not_found');
  const answer = cleanAnswer(ex.exercise_type, b.answer);
  const r = ex.answer_rules_json || {};
  const res = checkAnswer({ type: ex.exercise_type, options: (ex.content_json || {}).options, answer: r.answer, accept: r.accept, rule: r.rule, example_en: r.example_en }, answer);
  const before = await rest('GET', `exercise_attempts?user_id=eq.${user.id}&exercise_id=eq.${q(exId)}&select=id`, { service: true });
  const n = (before || []).length + 1;
  const result = { exercise_id: exId, is_correct: res.correct, attempt_number: n, scored: ex.scored, ...(res.correct || n >= 2 ? { correct_answer: res.expected } : {}) };
  await rest('POST', 'exercise_attempts?on_conflict=user_id,idempotency_key', { service: true, prefer: 'resolution=ignore-duplicates,return=minimal', body: { user_id: user.id, exercise_id: exId, lesson_id: ex.lesson_id, answer_json: answer, is_correct: res.correct, attempt_number: n, idempotency_key: key, result_json: result } });
  return result;
};

export const routes = [
  ['GET', /^me$/, getMe], ['PATCH', /^me$/, patchMe],
  ['PATCH', /^me\/preferences$/, patchPrefs], ['GET', /^me\/learning-plan$/, learningPlan],
  ['GET', /^me\/progress$/, getProgress], ['PUT', /^me\/progress$/, putProgress],
  ['GET', /^courses$/, listCourses], ['GET', /^courses\/([\w-]+)$/, getCourse],
  ['GET', /^lessons\/([\w-]+)$/, getLesson], ['GET', /^lessons\/([\w-]+)\/exercises$/, getExercises],
  ['POST', /^exercises\/([\w-]+)\/attempts$/, postAttempt],
  ...speakingRoutes,
  ...studyRoutes,
  ...billingRoutes,
  ...privacyRoutes,
  ...adminRoutes
];
