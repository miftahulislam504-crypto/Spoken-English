// Routes that need no sign-in, or work with or without one (plan sections 11, 14, 15): usage events, feedback, lesson downloads, privacy facts.
import { ApiError, rateLimit } from './http.js';
import { rest } from './supabase.js';
import { optionalUser } from './supabase.js';
import * as v from './validate.js';
import { rowsToLesson, lessonProblems } from './content.js';
import { retentionDays } from './ops.js';
import { cleanEvent, INSTALL_ID, MODES, FEEDBACK_KINDS } from '../../www/src/engine/events.js';

const q = encodeURIComponent;
const ipOf = (req) => String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
const WEEK = 7 * 86400000;

// ---- usage events: fixed names and values only; anything else is dropped ----
const ingest = async ({ req, body }) => {
  const b = v.obj(body, 'body');
  if (typeof b.install_id !== 'string' || !INSTALL_ID.test(b.install_id)) throw new ApiError(400, 'invalid_input', undefined, 'install_id is invalid');
  rateLimit('ev:' + b.install_id, 20);
  if (!Array.isArray(b.events) || !b.events.length || b.events.length > 50) throw new ApiError(400, 'invalid_input', undefined, 'events must be 1 to 50 items');
  const platform = ['web', 'android'].includes(b.platform) ? b.platform : null;
  const app_version = typeof b.app_version === 'string' && /^[0-9A-Za-z.\-]{1,20}$/.test(b.app_version) ? b.app_version : null;
  const user = await optionalUser(req); const now = Date.now(); const rows = []; let dropped = 0;
  b.events.forEach((e) => {
    const c = e && typeof e === 'object' ? cleanEvent(e.name, e.props) : null;
    if (!c) { dropped += 1; return; }
    rows.push({ install_id: b.install_id, user_id: user ? user.id : null, name: c.name, props: c.props, client_at: Number.isInteger(e.at) && Math.abs(e.at - now) < WEEK ? new Date(e.at).toISOString() : null, platform, app_version });
  });
  if (rows.length) await rest('POST', 'analytics_events', { service: true, prefer: 'return=minimal', body: rows });
  return { accepted: rows.length, dropped };
};

// ---- feedback and "report this correction" ----
const CTX = { screen: (x) => v.str(x, 'screen', { max: 40 }), lesson_id: (x) => v.id(x), ref: (x) => v.str(x, 'ref', { max: 60 }), original: (x) => v.str(x, 'original', { max: 200 }), corrected: (x) => v.str(x, 'corrected', { max: 200 }), error_type: (x) => v.str(x, 'error_type', { max: 40 }), mode: (x) => v.oneOf(x, 'mode', MODES) };
const feedback = async ({ req, body }) => {
  rateLimit('fb:' + ipOf(req), 10, 600000);
  const b = v.obj(body, 'body');
  const kind = v.oneOf(b.kind, 'kind', FEEDBACK_KINDS);
  const message = v.str(typeof b.message === 'string' ? b.message.trim() : b.message, 'message', { min: 1, max: 1000 });
  const ctx = {}; const c = b.context === undefined ? {} : v.obj(b.context, 'context');
  Object.keys(c).forEach((k) => { if (CTX[k] && c[k] !== undefined && c[k] !== null && c[k] !== '') ctx[k] = CTX[k](c[k]); });
  const install_id = typeof b.install_id === 'string' && INSTALL_ID.test(b.install_id) ? b.install_id : null;
  const user = await optionalUser(req);
  const row = { user_id: user ? user.id : null, install_id, kind, message, context: ctx, app_version: typeof b.app_version === 'string' && /^[0-9A-Za-z.\-]{1,20}$/.test(b.app_version) ? b.app_version : null, platform: ['web', 'android'].includes(b.platform) ? b.platform : null };
  await rest('POST', 'feedback_reports', { service: true, prefer: 'return=minimal', body: [row] });
  return { ok: true };
};

// ---- lessons the phone can download (Downloaded lessons) ----
// Lessons come from the database after checking, so a broken edit never reaches a phone. Answer rules are included
// because lessons are checked on the phone to work offline, exactly like the lessons that ship inside the app.
const manifest = async () => {
  const rows = (await rest('GET', 'lessons?select=id,content_version,published_status,updated_at&order=sequence_number&limit=500', { service: true })) || [];
  return { generated_at: new Date().toISOString(), lessons: rows.filter((r) => r.published_status === 'published').map((r) => ({ id: r.id, content_version: r.content_version, updated_at: r.updated_at })), retired: rows.filter((r) => r.published_status !== 'published').map((r) => r.id) };
};
const lessonPack = async ({ query }) => {
  const ids = String(query.ids || '').split(',').filter(Boolean);
  if (!ids.length || ids.length > 40) throw new ApiError(400, 'invalid_input', undefined, 'ids must be 1 to 40 lesson ids');
  ids.forEach((x) => v.id(x));
  const list = ids.map(q).join(',');
  const [all, rows, ex] = await Promise.all([
    rest('GET', 'lessons?select=id,prerequisite_lesson_ids,published_status&limit=500', { service: true }),
    rest('GET', `lessons?id=in.(${list})&published_status=eq.published&select=*`, { service: true }),
    rest('GET', `exercises?lesson_id=in.(${list})&select=*&order=position&limit=2000`, { service: true })
  ]);
  const known = Object.fromEntries((all || []).filter((l) => l.published_status === 'published').map((l) => [l.id, { status: l.published_status, prerequisites: l.prerequisite_lesson_ids || [] }]));
  const lessons = [];
  (rows || []).forEach((r) => {
    const l = rowsToLesson(r, (ex || []).filter((e) => e.lesson_id === r.id)); const bad = lessonProblems(l, known);
    if (bad.length) { console.error(JSON.stringify({ event: 'content_not_served', lesson: r.id, problems: bad.slice(0, 3) })); return; }
    lessons.push(l);
  });
  return { schema: 1, lessons };
};

// ---- plain facts for the privacy screen ----
const privacyPolicy = async () => { const d = await retentionDays(); return { version: 1, audio_stored: false, retention_days: { usage_statistics: d.analytics, speaking_transcripts: d.transcript, payment_notifications: d.webhook, resolved_feedback: d.feedback } }; };

// [method, pattern, handler, requests per minute from one address]
export const openRoutes = [
  ['POST', /^events$/, ingest, 60],
  ['POST', /^feedback$/, feedback, 20],
  ['GET', /^content\/manifest$/, manifest, 30],
  ['GET', /^content\/lessons$/, lessonPack, 30],
  ['GET', /^privacy-policy$/, privacyPolicy, 60]
];
