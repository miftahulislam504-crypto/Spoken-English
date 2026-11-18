// Admin dashboard API (plan sections 13 and 14): roles, audit log, content management, AI operations, business operations, analytics.
// Every route checks the signed-in person's role in the database. Every change is written to the audit log BEFORE it is made,
// so nothing can change without a record (a failed change still leaves the record of the attempt).
import crypto from 'node:crypto';
import { ApiError } from './http.js';
import { rest } from './supabase.js';
import * as v from './validate.js';
import { loadPlans, sortedPlans, clearPlanCache, MODES } from './plans.js';
import { getEntitlement, clearEntitlementCaches, loadSettings, quotaOffsetMs } from './entitlements.js';
import { buildSummary } from './billing.js';
import { healthChecks, retentionDays } from './ops.js';
import { lessonToRows, rowsToLesson, lessonProblems, exerciseProblems, EX_TYPES } from './content.js';
import { pricesConfigured } from './cost.js';
import { EVENTS } from '../../www/src/engine/events.js';
import { coachProvider, coachModel } from './ai.js';
import { sttProvider, sttModel } from './stt.js';

const q = encodeURIComponent;
const svc = { service: true };
const UUID = /^[0-9a-f-]{36}$/i;
const uuid = (x) => (typeof x === 'string' && UUID.test(x) ? x : (() => { throw new ApiError(400, 'invalid_input', undefined, 'id is invalid'); })());
const iso = (n) => new Date(n).toISOString();

// ---- roles ----
export const PERMISSIONS = {
  owner: ['*'],
  content_manager: ['metrics.read', 'content.read', 'content.write', 'content.publish', 'feedback.manage'],
  support: ['users.read', 'users.grant', 'feedback.manage', 'billing.read'],
  analyst: ['metrics.read', 'billing.read', 'ai.read', 'content.read']
};
export const ALL_PERMISSIONS = ['metrics.read', 'billing.read', 'content.read', 'content.write', 'content.publish', 'ai.read', 'ai.write', 'plans.write', 'users.read', 'users.grant', 'feedback.manage', 'audit.read', 'roles.manage'];
export const can = (role, perm) => (PERMISSIONS[role] || []).some((p) => p === '*' || p === perm);
async function roleOf(userId) { const r = await rest('GET', `admin_roles?user_id=eq.${userId}&select=role`, svc); return r && r[0] ? r[0].role : null; }
async function need(user, perm) { const role = await roleOf(user.id); if (!role || !can(role, perm)) throw new ApiError(403, 'forbidden'); return role; }
async function audit(user, role, action, targetType, targetId, details = {}) {
  const s = JSON.stringify(details);
  await rest('POST', 'audit_log', { ...svc, prefer: 'return=minimal', body: [{ actor_id: user.id, actor_email: user.email || null, actor_role: role, action, target_type: targetType, target_id: String(targetId).slice(0, 80), details: s.length > 8000 ? { truncated: true, start: s.slice(0, 1500) } : details }] });
}
const reason = (b, min = 0) => v.str(b.reason === undefined || b.reason === null ? '' : b.reason, 'reason', { min, max: 200 });
const limitOf = (x, def, max) => { const n = x === undefined ? def : Number(x); return Number.isInteger(n) && n >= 1 && n <= max ? n : def; };

const me = async ({ user }) => {
  const role = await roleOf(user.id); if (!role) throw new ApiError(403, 'forbidden');
  return { email: user.email, role, permissions: PERMISSIONS[role].includes('*') ? ALL_PERMISSIONS : PERMISSIONS[role] };
};

// ---- overview and analytics (plan section 14) ----
const overview = async ({ user }) => {
  await need(user, 'metrics.read');
  const [ops, health] = await Promise.all([buildSummary(), healthChecks()]);
  return { ...ops, health };
};
const FUNNEL = ['app_opened', 'onboarding_completed', 'lesson_started', 'lesson_completed', 'speaking_session_started', 'paywall_viewed', 'purchase_completed'];
const analytics = async ({ user, query }) => {
  await need(user, 'metrics.read');
  const days = limitOf(query.days, 30, 90); const since = iso(Date.now() - days * 86400000); const off = quotaOffsetMs() / 60000;
  const call = (fn, body) => rest('POST', `rpc/${fn}`, { ...svc, body }).then((r) => r || []);
  const [product, daily, totals, retention] = await Promise.all([rest('POST', 'rpc/product_metrics', { ...svc, body: { p_since: since, p_offset: off } }), call('analytics_daily', { p_since: since, p_offset: off }), call('analytics_totals', { p_since: since }), call('analytics_retention', { p_since: since, p_offset: off })]);
  const n = (x) => Number(x) || 0;
  return {
    days, since, product: product || {}, daily: daily.map((r) => ({ day: r.day, name: r.name, events: n(r.events), actors: n(r.actors) })),
    totals: totals.map((r) => ({ name: r.name, events: n(r.events), actors: n(r.actors) })),
    retention: retention.map((r) => ({ cohort: r.cohort, size: n(r.size), d1: n(r.d1), d7: n(r.d7) })),
    funnel: FUNNEL.map((name) => ({ name, actors: n((totals.find((t) => t.name === name) || {}).actors) })), event_names: Object.keys(EVENTS)
  };
};

// ---- content management (plan sections 8 and 13) ----
const LESSON_LIST = 'id,course_id,title_en,level,sequence_number,week,estimated_duration_seconds,content_version,published_status,updated_at';
const bump = (n) => n + 1;
async function knownLessons() {
  const rows = (await rest('GET', 'lessons?select=id,prerequisite_lesson_ids,published_status&limit=500', svc)) || [];
  return Object.fromEntries(rows.map((r) => [r.id, { status: r.published_status, prerequisites: r.prerequisite_lesson_ids || [] }]));
}
async function loadLesson(id) {
  v.id(id);
  const rows = await rest('GET', `lessons?id=eq.${q(id)}&select=*`, svc);
  if (!rows || !rows[0]) throw new ApiError(404, 'not_found');
  const ex = (await rest('GET', `exercises?lesson_id=eq.${q(id)}&select=*&order=position&limit=200`, svc)) || [];
  return { row: rows[0], ex };
}
const snapshotOf = (row, ex) => { const { created_at, updated_at, ...lesson } = row; return { lesson, exercises: ex }; };
async function saveRevision(user, row, ex, why) {
  await rest('POST', 'content_revisions', { ...svc, prefer: 'return=minimal', body: [{ lesson_id: row.id, content_version: row.content_version, snapshot: snapshotOf(row, ex), reason: why || null, changed_by: user.id, changed_by_email: user.email || null }] });
}
async function setVersion(id, version) {
  await rest('PATCH', `lessons?id=eq.${q(id)}`, { ...svc, prefer: 'return=minimal', body: { content_version: version } });
  await rest('PATCH', `exercises?lesson_id=eq.${q(id)}`, { ...svc, prefer: 'return=minimal', body: { content_version: version } });
}
const lessonView = (row, ex, known) => ({ lesson: { ...row, content_json: undefined }, exercises: ex.map((e) => ({ id: e.id, position: e.position, exercise_type: e.exercise_type, stage: e.stage, content_json: e.content_json, answer_rules_json: e.answer_rules_json, difficulty: e.difficulty, scored: e.scored })), problems: lessonProblems(rowsToLesson(row, ex), known) });

const listLessons = async ({ user }) => {
  await need(user, 'content.read');
  const [rows, ex, known] = await Promise.all([rest('GET', `lessons?select=${LESSON_LIST}&order=sequence_number&limit=500`, svc), rest('GET', 'exercises?select=lesson_id&limit=3000', svc), knownLessons()]);
  const count = {}; (ex || []).forEach((e) => { count[e.lesson_id] = (count[e.lesson_id] || 0) + 1; });
  return { lessons: (rows || []).map((r) => ({ ...r, exercise_count: count[r.id] || 0 })), known: Object.keys(known) };
};
const getLessonRoute = async ({ user, params }) => { await need(user, 'content.read'); const { row, ex } = await loadLesson(params[0]); return lessonView(row, ex, await knownLessons()); };

const LESSON_FIELDS = {
  title_en: (x) => v.str(x, 'title_en', { min: 1, max: 120 }),
  learning_objectives: (x) => { if (!Array.isArray(x) || !x.length || x.length > 6) throw new ApiError(400, 'invalid_input', undefined, 'learning_objectives must have 1 to 6 items'); return x.map((o) => v.str(o, 'objective', { min: 1, max: 120 })); },
  estimated_duration_seconds: (x) => v.int(x, 'estimated_duration_seconds', 60, 3600),
  completion_min_score: (x) => v.num(x, 'completion_min_score', 0, 1),
  prerequisite_lesson_ids: (x) => { if (!Array.isArray(x) || x.length > 5) throw new ApiError(400, 'invalid_input', undefined, 'prerequisite_lesson_ids must have at most 5 items'); return x.map(v.id); }
};
const patchLesson = async ({ user, params, body }) => {
  const role = await need(user, 'content.write'); const b = v.obj(body, 'body');
  const { row, ex } = await loadLesson(params[0]); const patch = {};
  Object.keys(LESSON_FIELDS).forEach((k) => { if (k in b) patch[k] = LESSON_FIELDS[k](b[k]); });
  if (!Object.keys(patch).length) throw new ApiError(400, 'invalid_input', undefined, 'No valid fields');
  const after = { ...row, ...patch };
  if (row.published_status === 'published') { const bad = lessonProblems(rowsToLesson(after, ex), await knownLessons()); if (bad.length) throw new ApiError(400, 'invalid_input', undefined, bad.slice(0, 5).join('; ')); }
  const why = reason(b);
  await audit(user, role, 'content.lesson.update', 'lesson', row.id, { reason: why, before: Object.fromEntries(Object.keys(patch).map((k) => [k, row[k]])), after: patch, from_version: row.content_version });
  await saveRevision(user, row, ex, why);
  await rest('PATCH', `lessons?id=eq.${q(row.id)}`, { ...svc, prefer: 'return=minimal', body: patch });
  await setVersion(row.id, bump(row.content_version));
  return { id: row.id, content_version: bump(row.content_version) };
};

const CONTENT_KEYS = { stage: (x) => v.str(x, 'stage', { max: 20 }), prompt_en: (x) => v.str(x, 'prompt_en', { min: 1, max: 300 }), hint_bn: (x) => v.str(x, 'hint_bn', { max: 300 }), options: (x) => { if (!Array.isArray(x) || x.length > 6) throw new ApiError(400, 'invalid_input', undefined, 'options is invalid'); return x.map((o) => v.str(o, 'option', { max: 80 })); }, tiles: (x) => { if (!Array.isArray(x) || x.length > 20) throw new ApiError(400, 'invalid_input', undefined, 'tiles is invalid'); return x.map((o) => v.str(o, 'tile', { max: 40 })); }, audio_en: (x) => v.str(x, 'audio_en', { max: 300 }) };
const RULE_KEYS = { answer: (x) => (typeof x === 'number' ? v.int(x, 'answer', 0, 9) : v.str(x, 'answer', { max: 300 })), accept: (x) => { if (!Array.isArray(x) || x.length > 30) throw new ApiError(400, 'invalid_input', undefined, 'accept is invalid'); return x.map((o) => v.str(o, 'accept', { max: 300 })); }, rule: (x) => { const o = v.obj(x, 'rule'); return { ...(o.starts !== undefined ? { starts: (Array.isArray(o.starts) ? o.starts.map((s) => v.str(s, 'starts', { max: 40 })) : (() => { throw new ApiError(400, 'invalid_input', undefined, 'rule.starts is invalid'); })()) } : {}), min_words: v.int(o.min_words, 'min_words', 1, 20), ...(o.contains ? { contains: v.str(o.contains, 'contains', { max: 80 }) } : {}) }; }, example_en: (x) => v.str(x, 'example_en', { max: 300 }) };
const pickKeys = (src, keys, name) => { const o = v.obj(src, name); const out = {}; Object.keys(o).forEach((k) => { if (!keys[k]) throw new ApiError(400, 'invalid_input', undefined, `${name}.${k} is not allowed`); out[k] = keys[k](o[k]); }); return out; };
const putExercise = async ({ user, params, body }) => {
  const role = await need(user, 'content.write'); const b = v.obj(body, 'body'); const id = v.id(params[0]);
  const found = await rest('GET', `exercises?id=eq.${q(id)}&select=*`, svc);
  if (!found || !found[0]) throw new ApiError(404, 'not_found');
  const e = found[0]; const { row, ex } = await loadLesson(e.lesson_id);
  const patch = {};
  if (b.content_json !== undefined) patch.content_json = { ...e.content_json, ...pickKeys(b.content_json, CONTENT_KEYS, 'content_json') };
  if (b.answer_rules_json !== undefined) patch.answer_rules_json = { ...e.answer_rules_json, ...pickKeys(b.answer_rules_json, RULE_KEYS, 'answer_rules_json') };
  if (b.difficulty !== undefined) patch.difficulty = v.int(b.difficulty, 'difficulty', 1, 5);
  if (b.scored !== undefined) patch.scored = v.bool(b.scored, 'scored');
  if (!Object.keys(patch).length) throw new ApiError(400, 'invalid_input', undefined, 'No valid fields');
  const merged = { ...e, ...patch }; const step = { ...merged.content_json, ...merged.answer_rules_json, type: e.exercise_type };
  Object.keys(step).forEach((k) => { if (step[k] === undefined || step[k] === null) delete step[k]; });
  const bad = exerciseProblems(step); if (bad.length) throw new ApiError(400, 'invalid_input', undefined, bad.slice(0, 5).join('; '));
  const why = reason(b);
  await audit(user, role, 'content.exercise.update', 'exercise', id, { reason: why, lesson_id: row.id, before: { content_json: e.content_json, answer_rules_json: e.answer_rules_json }, after: patch, from_version: row.content_version });
  await saveRevision(user, row, ex, why);
  await rest('PATCH', `exercises?id=eq.${q(id)}`, { ...svc, prefer: 'return=minimal', body: patch });
  await setVersion(row.id, bump(row.content_version));
  return { id, lesson_id: row.id, content_version: bump(row.content_version) };
};

const setStatus = async ({ user, params, body }) => {
  const role = await need(user, 'content.publish'); const b = v.obj(body, 'body');
  const status = v.oneOf(b.status, 'status', ['published', 'draft', 'archived']); const { row, ex } = await loadLesson(params[0]);
  if (row.published_status === status) return { id: row.id, status };
  const known = await knownLessons();
  if (status === 'published') {
    const bad = lessonProblems(rowsToLesson(row, ex), known);
    const unpublished = (row.prerequisite_lesson_ids || []).filter((p) => !known[p] || known[p].status !== 'published');
    if (unpublished.length) bad.push('these prerequisites are not published: ' + unpublished.join(', '));
    if (bad.length) throw new ApiError(400, 'invalid_input', undefined, bad.slice(0, 6).join('; '));
  } else {
    const dependents = Object.entries(known).filter(([id, k]) => id !== row.id && k.status === 'published' && k.prerequisites.includes(row.id)).map(([id]) => id);
    if (dependents.length) throw new ApiError(409, 'conflict', undefined, { reason: 'other published lessons need this one', dependents });
  }
  await audit(user, role, 'content.lesson.status', 'lesson', row.id, { reason: reason(b), from: row.published_status, to: status });
  await rest('PATCH', `lessons?id=eq.${q(row.id)}`, { ...svc, prefer: 'return=minimal', body: { published_status: status } });
  return { id: row.id, status };
};

const listRevisions = async ({ user, params }) => {
  await need(user, 'content.read'); const id = v.id(params[0]);
  const rows = await rest('GET', `content_revisions?lesson_id=eq.${q(id)}&select=id,content_version,reason,changed_by_email,created_at&order=id.desc&limit=30`, svc);
  return { revisions: rows || [] };
};
const restoreRevision = async ({ user, params, body }) => {
  const role = await need(user, 'content.write'); const b = v.obj(body, 'body'); const rid = v.int(b.revision_id, 'revision_id', 1, 1e12);
  const { row, ex } = await loadLesson(params[0]);
  const rev = await rest('GET', `content_revisions?id=eq.${rid}&lesson_id=eq.${q(row.id)}&select=*`, svc);
  if (!rev || !rev[0]) throw new ApiError(404, 'not_found');
  const snap = rev[0].snapshot; if (!snap || !snap.lesson || !Array.isArray(snap.exercises)) throw new ApiError(409, 'conflict');
  const after = rowsToLesson(snap.lesson, snap.exercises); const bad = lessonProblems(after, await knownLessons());
  if (row.published_status === 'published' && bad.length) throw new ApiError(400, 'invalid_input', undefined, 'that version has problems: ' + bad.slice(0, 3).join('; '));
  const next = bump(row.content_version); const why = reason(b);
  await audit(user, role, 'content.lesson.restore', 'lesson', row.id, { reason: why, restored_revision: rid, restored_version: rev[0].content_version, new_version: next });
  await saveRevision(user, row, ex, why || `before restoring version ${rev[0].content_version}`);
  const { id, course_id, created_at, ...fields } = snap.lesson; const { published_status, ...rest1 } = fields; // the published state is never changed by a restore
  await rest('PATCH', `lessons?id=eq.${q(row.id)}`, { ...svc, prefer: 'return=minimal', body: { ...rest1, content_version: next } });
  for (const e of snap.exercises) await rest('PATCH', `exercises?id=eq.${q(e.id)}`, { ...svc, prefer: 'return=minimal', body: { content_json: e.content_json, answer_rules_json: e.answer_rules_json, difficulty: e.difficulty, scored: e.scored, content_version: next } });
  return { id: row.id, content_version: next };
};

// A new lesson, pasted in the app's own lesson format. It starts as a draft and must pass every check before it can be published.
const importLesson = async ({ user, body }) => {
  const role = await need(user, 'content.write'); const b = v.obj(body, 'body'); const l = v.obj(b.lesson, 'lesson');
  const known = await knownLessons();
  if (typeof l.id === 'string' && known[l.id]) throw new ApiError(409, 'conflict', undefined, 'a lesson with this id already exists');
  const bad = lessonProblems({ ...l, content_version: 1 }, known);
  if (bad.length) throw new ApiError(400, 'invalid_input', undefined, bad.slice(0, 8).join('; '));
  const course = await rest('GET', `courses?id=eq.${q(String(l.course_id))}&select=id`, svc);
  if (!course || !course[0]) throw new ApiError(400, 'invalid_input', undefined, 'course_id is unknown');
  const { lesson, exercises } = lessonToRows({ ...l, content_version: 1, published_status: 'draft' });
  await audit(user, role, 'content.lesson.import', 'lesson', l.id, { reason: reason(b), title: l.title_en, exercises: exercises.length });
  await rest('POST', 'lessons', { ...svc, prefer: 'return=minimal', body: [lesson] });
  try { if (exercises.length) await rest('POST', 'exercises', { ...svc, prefer: 'return=minimal', body: exercises }); }
  catch (e) { await rest('DELETE', `lessons?id=eq.${q(l.id)}`, { ...svc, prefer: 'return=minimal' }).catch(() => {}); throw e; }
  return { id: l.id, status: 'draft', exercises: exercises.length };
};

const contentChecks = async ({ user }) => {
  await need(user, 'content.read');
  const [rows, ex] = await Promise.all([rest('GET', 'lessons?select=*&order=sequence_number&limit=500', svc), rest('GET', 'exercises?select=*&order=position&limit=3000', svc)]);
  const known = Object.fromEntries((rows || []).map((r) => [r.id, { status: r.published_status, prerequisites: r.prerequisite_lesson_ids || [] }]));
  const report = (rows || []).map((r) => ({ id: r.id, title_en: r.title_en, status: r.published_status, problems: lessonProblems(rowsToLesson(r, (ex || []).filter((e) => e.lesson_id === r.id)), known) }));
  return { checked: report.length, with_problems: report.filter((x) => x.problems.length).length, lessons: report.filter((x) => x.problems.length) };
};
// Where learners struggle: how many started and finished each lesson (as reported by phones) and which exercises are missed most.
const contentStats = async ({ user }) => {
  await need(user, 'metrics.read');
  const [prog, miss] = await Promise.all([rest('GET', 'user_lesson_progress?select=lesson_id,status,score&placed=eq.false&limit=5000', svc), rest('GET', 'mistake_records?kind=eq.step&select=ref,occurrence_count&limit=3000', svc)]);
  const by = {}; (prog || []).forEach((p) => { const x = by[p.lesson_id] || (by[p.lesson_id] = { lesson_id: p.lesson_id, started: 0, completed: 0, score_sum: 0 }); x.started += 1; if (p.status === 'completed') { x.completed += 1; x.score_sum += Number(p.score) || 0; } });
  const lessons = Object.values(by).map((x) => ({ lesson_id: x.lesson_id, started: x.started, completed: x.completed, avg_score_pct: x.completed ? Math.round((x.score_sum / x.completed) * 100) : null }));
  const hot = {}; (miss || []).forEach((m) => { if (m.ref) hot[m.ref] = (hot[m.ref] || 0) + (Number(m.occurrence_count) || 1); });
  return { lessons, most_missed: Object.entries(hot).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([ref, misses]) => ({ ref, misses })), note: 'Numbers are reported by phones, not checked on the server.' };
};

// ---- AI operations (plan sections 9 and 19) ----
const aiInfo = async ({ user }) => {
  await need(user, 'ai.read');
  const [settings, summary, reports] = await Promise.all([loadSettings(), buildSummary(), rest('GET', 'feedback_reports?kind=eq.ai_correction&status=eq.new&select=id,message,context,created_at&order=created_at.desc&limit=10', svc)]);
  return {
    settings, coach_provider: coachProvider(), coach_model: coachModel(), stt_provider: sttProvider(), stt_model: sttModel(), coach_key_set: !!coachProvider(), stt_key_set: !!sttProvider(),
    prices_configured: pricesConfigured(), ai_turns_ceiling: process.env.AI_TURNS_PER_DAY ? Number(process.env.AI_TURNS_PER_DAY) : null, today: summary.today, month: summary.month, budget: summary.budget, warnings: summary.warnings, correction_reports: reports || []
  };
};
const money = (x, name) => (x === null ? null : v.num(x, name, 0, 1000000));
const putAiSettings = async ({ user, body }) => {
  const role = await need(user, 'ai.write'); const b = v.obj(body, 'body'); const rows = []; const after = {};
  if ('ai_enabled' in b) { after.ai_enabled = v.bool(b.ai_enabled, 'ai_enabled'); rows.push({ key: 'ai_enabled', value: after.ai_enabled }); }
  if ('daily_usd' in b) { after.daily_usd = money(b.daily_usd, 'daily_usd'); rows.push({ key: 'ai_daily_budget_usd', value: after.daily_usd }); }
  if ('monthly_usd' in b) { after.monthly_usd = money(b.monthly_usd, 'monthly_usd'); rows.push({ key: 'ai_monthly_budget_usd', value: after.monthly_usd }); }
  if (!rows.length) throw new ApiError(400, 'invalid_input', undefined, 'No valid fields');
  if ((after.daily_usd || after.monthly_usd) && !pricesConfigured()) throw new ApiError(400, 'invalid_input', undefined, 'Set the AI price variables first; without prices a budget can never trigger');
  const before = await loadSettings();
  await audit(user, role, 'ai.settings.update', 'settings', 'ai', { reason: reason(b), before, after });
  await rest('POST', 'app_settings?on_conflict=key', { ...svc, prefer: 'resolution=merge-duplicates,return=minimal', body: rows.map((r) => ({ ...r, updated_at: iso(Date.now()) })) });
  clearEntitlementCaches();
  return { settings: await loadSettings() };
};

// ---- plans and learners (plans 11, 12) ----
const listPlans = async ({ user }) => {
  await need(user, 'billing.read');
  const [plans, counts] = await Promise.all([loadPlans(), rest('POST', 'rpc/subscription_counts', { ...svc, body: {} })]);
  return { plans: sortedPlans(plans).map((p) => ({ id: p.id, name: p.name, rank: p.rank, features: p.features, play_product_id: p.play_product_id, play_base_plan_id: p.play_base_plan_id })), subscriptions: (counts || []).map((r) => ({ plan_id: r.plan_id, status: r.status, store_state: r.store_state, count: Number(r.n) })), modes: MODES };
};
const putPlan = async ({ user, params, body }) => {
  const role = await need(user, 'plans.write'); const b = v.obj(body, 'body'); const id = v.oneOf(params[0], 'plan', ['free', 'pro', 'advanced']);
  const cur = (await loadPlans())[id]; const patch = {};
  if ('name' in b) patch.name = v.str(b.name, 'name', { min: 1, max: 60 });
  if ('features' in b) {
    const f = v.obj(b.features, 'features'); const modes = Array.isArray(f.speaking_modes) && f.speaking_modes.length ? f.speaking_modes.map((m) => v.oneOf(m, 'speaking_modes', MODES)) : (() => { throw new ApiError(400, 'invalid_input', undefined, 'speaking_modes must list at least one mode'); })();
    patch.features = { ai_turns_per_day: v.int(f.ai_turns_per_day, 'ai_turns_per_day', 0, 100000), stt_seconds_per_day: v.int(f.stt_seconds_per_day, 'stt_seconds_per_day', 0, 100000), speaking_modes: [...new Set(modes)] };
  }
  ['play_product_id', 'play_base_plan_id'].forEach((k) => { if (k in b) { if (id === 'free' && b[k]) throw new ApiError(400, 'invalid_input', undefined, 'the Free plan has no store product'); patch[k] = b[k] === null || b[k] === '' ? null : v.str(b[k], k, { max: 100 }); } });
  if (!Object.keys(patch).length) throw new ApiError(400, 'invalid_input', undefined, 'No valid fields');
  await audit(user, role, 'plan.update', 'plan', id, { reason: reason(b), before: { name: cur.name, features: cur.features, play_product_id: cur.play_product_id, play_base_plan_id: cur.play_base_plan_id }, after: patch });
  await rest('PATCH', `plans?id=eq.${id}`, { ...svc, prefer: 'return=minimal', body: patch });
  clearPlanCache();
  return { id, ...patch };
};

const searchUsers = async ({ user, query }) => {
  const role = await need(user, 'users.read'); const term = v.str(String(query.q || '').trim(), 'q', { min: 3, max: 120 });
  const rows = (await rest('POST', 'rpc/admin_find_user', { ...svc, body: { p_query: term } })) || [];
  await audit(user, role, 'user.search', 'search', crypto.createHash('sha256').update(term.toLowerCase()).digest('hex').slice(0, 12), { results: rows.length });
  return { users: rows.map((r) => ({ id: r.id, email: r.email, created_at: r.created_at, last_sign_in_at: r.last_sign_in_at })) };
};
const getUser = async ({ user, params }) => {
  const role = await need(user, 'users.read'); const id = uuid(params[0]);
  const [prof, found, subs, prog, sessions, reports, ent] = await Promise.all([
    rest('GET', `profiles?id=eq.${id}&select=id,display_name,current_level,daily_goal_minutes,created_at`, svc), rest('POST', 'rpc/admin_find_user', { ...svc, body: { p_query: id } }),
    rest('GET', `subscriptions?user_id=eq.${id}&select=plan_id,provider,status,store_state,current_period_end,started_at,is_test,updated_at&order=updated_at.desc&limit=20`, svc),
    rest('GET', `user_lesson_progress?user_id=eq.${id}&status=eq.completed&select=lesson_id&limit=500`, svc), rest('GET', `conversation_sessions?user_id=eq.${id}&select=id&limit=1000`, svc),
    rest('GET', `feedback_reports?user_id=eq.${id}&select=id&limit=200`, svc), getEntitlement(id)
  ]);
  if (!prof || !prof[0]) throw new ApiError(404, 'not_found');
  await audit(user, role, 'user.view', 'user', id, {}); // looking at a learner is recorded too; conversation text is never shown here
  return { profile: prof[0], email: found && found[0] ? found[0].email : null, entitlement: ent, subscriptions: subs || [], counts: { lessons_completed: (prog || []).length, speaking_sessions: (sessions || []).length, feedback_reports: (reports || []).length } };
};
const grant = async ({ user, params, body }) => {
  const role = await need(user, 'users.grant'); const b = v.obj(body, 'body'); const id = uuid(params[0]);
  const plan = v.oneOf(b.plan_id, 'plan_id', ['pro', 'advanced']); const max = role === 'owner' ? 365 : 31; const days = v.int(b.days, 'days', 1, max);
  const prof = await rest('GET', `profiles?id=eq.${id}&select=id`, svc); if (!prof || !prof[0]) throw new ApiError(404, 'not_found');
  const end = iso(Date.now() + days * 86400000);
  await audit(user, role, 'user.grant', 'user', id, { reason: reason(b, 3), plan, days, ends: end });
  await rest('POST', 'subscriptions', { ...svc, prefer: 'return=minimal', body: [{ user_id: id, plan_id: plan, provider: 'manual', provider_reference: 'manual:' + crypto.randomUUID(), status: 'active', current_period_end: end, started_at: iso(Date.now()), is_test: false }] });
  return { entitlement: await getEntitlement(id) };
};
const revoke = async ({ user, params, body }) => {
  const role = await need(user, 'users.grant'); const b = v.obj(body, 'body'); const id = uuid(params[0]);
  await audit(user, role, 'user.revoke', 'user', id, { reason: reason(b, 3) });
  await rest('PATCH', `subscriptions?user_id=eq.${id}&provider=eq.manual&status=eq.active`, { ...svc, prefer: 'return=minimal', body: { status: 'canceled', current_period_end: iso(Date.now()) } });
  return { entitlement: await getEntitlement(id) };
};

// ---- feedback queue, audit log, team ----
const listFeedback = async ({ user, query }) => {
  await need(user, 'feedback.manage');
  const f = []; if (query.status) f.push('status=eq.' + v.oneOf(query.status, 'status', ['new', 'reviewing', 'resolved', 'dismissed'])); if (query.kind) f.push('kind=eq.' + v.oneOf(query.kind, 'kind', ['bug', 'content_error', 'ai_correction', 'idea', 'other']));
  const rows = await rest('GET', `feedback_reports?${f.join('&')}${f.length ? '&' : ''}select=id,kind,message,context,status,admin_note,app_version,platform,created_at&order=created_at.desc&limit=${limitOf(query.limit, 50, 100)}`, svc);
  return { reports: rows || [] };
};
const patchFeedback = async ({ user, params, body }) => {
  const role = await need(user, 'feedback.manage'); const b = v.obj(body, 'body'); const id = uuid(params[0]); const patch = {};
  if ('status' in b) patch.status = v.oneOf(b.status, 'status', ['new', 'reviewing', 'resolved', 'dismissed']);
  if ('admin_note' in b) patch.admin_note = v.str(b.admin_note, 'admin_note', { max: 500 });
  if (!Object.keys(patch).length) throw new ApiError(400, 'invalid_input', undefined, 'No valid fields');
  const cur = await rest('GET', `feedback_reports?id=eq.${id}&select=id,status`, svc); if (!cur || !cur[0]) throw new ApiError(404, 'not_found');
  await audit(user, role, 'feedback.update', 'feedback', id, { from: cur[0].status, ...patch });
  await rest('PATCH', `feedback_reports?id=eq.${id}`, { ...svc, prefer: 'return=minimal', body: patch });
  return { id, ...patch };
};
const listAudit = async ({ user, query }) => {
  await need(user, 'audit.read'); const f = [];
  if (query.action) f.push('action=like.' + q(v.str(String(query.action), 'action', { max: 40 }).replace(/[^a-z._]/g, '')) + '*');
  if (query.before) f.push('id=lt.' + v.int(Number(query.before), 'before', 1, 1e12));
  const rows = await rest('GET', `audit_log?${f.join('&')}${f.length ? '&' : ''}select=*&order=id.desc&limit=${limitOf(query.limit, 50, 100)}`, svc);
  return { entries: rows || [] };
};
const listRoles = async ({ user }) => { await need(user, 'roles.manage'); return { roles: (await rest('GET', 'admin_roles?select=user_id,role,email,created_at&order=created_at', svc)) || [], available: Object.keys(PERMISSIONS), permissions: PERMISSIONS }; };
async function ownerCount() { return ((await rest('GET', 'admin_roles?role=eq.owner&select=user_id', svc)) || []).length; }
const putRole = async ({ user, body }) => {
  const me = await need(user, 'roles.manage'); const b = v.obj(body, 'body'); const role = v.oneOf(b.role, 'role', Object.keys(PERMISSIONS));
  const found = ((await rest('POST', 'rpc/admin_find_user', { ...svc, body: { p_query: v.str(b.email, 'email', { min: 3, max: 200 }) } })) || [])[0];
  if (!found) throw new ApiError(404, 'not_found', undefined, 'no learner account has this email; they must sign up in the app first');
  const cur = await roleOf(found.id);
  if (cur === 'owner' && role !== 'owner' && (await ownerCount()) <= 1) throw new ApiError(409, 'conflict', undefined, 'there must always be one owner');
  await audit(user, me, 'role.set', 'user', found.id, { email: found.email, from: cur, to: role });
  await rest('POST', 'admin_roles?on_conflict=user_id', { ...svc, prefer: 'resolution=merge-duplicates,return=minimal', body: [{ user_id: found.id, role, email: found.email, created_by: user.id }] });
  return { user_id: found.id, role };
};
const deleteRole = async ({ user, params }) => {
  const me = await need(user, 'roles.manage'); const id = uuid(params[0]); const cur = await roleOf(id);
  if (!cur) throw new ApiError(404, 'not_found');
  if (cur === 'owner' && (await ownerCount()) <= 1) throw new ApiError(409, 'conflict', undefined, 'there must always be one owner');
  await audit(user, me, 'role.remove', 'user', id, { was: cur });
  await rest('DELETE', `admin_roles?user_id=eq.${id}`, { ...svc, prefer: 'return=minimal' });
  return { status: 204 };
};
const settingsInfo = async ({ user }) => { await need(user, 'metrics.read'); return { retention_days: await retentionDays() }; };

export const adminRoutes = [
  ['GET', /^admin\/me$/, me],
  ['GET', /^admin\/overview$/, overview], ['GET', /^admin\/analytics$/, analytics], ['GET', /^admin\/settings$/, settingsInfo],
  ['GET', /^admin\/content\/lessons$/, listLessons], ['POST', /^admin\/content\/lessons$/, importLesson],
  ['GET', /^admin\/content\/lessons\/([\w-]+)$/, getLessonRoute], ['PATCH', /^admin\/content\/lessons\/([\w-]+)$/, patchLesson],
  ['POST', /^admin\/content\/lessons\/([\w-]+)\/status$/, setStatus], ['GET', /^admin\/content\/lessons\/([\w-]+)\/revisions$/, listRevisions], ['POST', /^admin\/content\/lessons\/([\w-]+)\/restore$/, restoreRevision],
  ['PUT', /^admin\/content\/exercises\/([\w-]+)$/, putExercise], ['GET', /^admin\/content\/checks$/, contentChecks], ['GET', /^admin\/content\/stats$/, contentStats],
  ['GET', /^admin\/ai$/, aiInfo], ['PUT', /^admin\/ai\/settings$/, putAiSettings],
  ['GET', /^admin\/plans$/, listPlans], ['PUT', /^admin\/plans\/([\w-]+)$/, putPlan],
  ['GET', /^admin\/users\/search$/, searchUsers], ['GET', /^admin\/users\/([\w-]+)$/, getUser], ['POST', /^admin\/users\/([\w-]+)\/grant$/, grant], ['POST', /^admin\/users\/([\w-]+)\/revoke$/, revoke],
  ['GET', /^admin\/feedback$/, listFeedback], ['PATCH', /^admin\/feedback\/([\w-]+)$/, patchFeedback],
  ['GET', /^admin\/audit$/, listAudit],
  ['GET', /^admin\/roles$/, listRoles], ['PUT', /^admin\/roles$/, putRole], ['DELETE', /^admin\/roles\/([\w-]+)$/, deleteRole]
];
