// Downloaded lessons (plan section 15, offline downloads). Lessons are built into the app and always work offline. This adds updated or new
// lessons published from the admin dashboard, kept on the phone so they work offline too. A bad download can never replace a working lesson.
import { publicGet } from './auth.js';
import { setDownloadedLessons, BUNDLED_VERSIONS, getLesson } from './engine/lessons.js';
import { WEEKS } from './content/curriculum-outline.js';
import { track } from './analytics.js';

export const PACK_KEY = 'se.content.v1'; export const PENDING_KEY = 'se.content.pending.v1';
const TYPES = ['choose', 'listen_choose', 'order', 'type', 'pattern', 'listen', 'teach', 'repeat', 'review'];
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const write = (k, v) => { localStorage.setItem(k, JSON.stringify(v)); };

// A lesson from the server is used only when it has everything the player needs.
export function lessonOk(l) {
  return !!l && typeof l === 'object' && typeof l.id === 'string' && /^[A-Za-z0-9_-]{1,30}$/.test(l.id) && typeof l.title_en === 'string' && WEEKS.some((w) => w.id === l.week) &&
    Number.isInteger(l.sequence_number) && Number.isInteger(l.content_version) && l.content_version >= 1 && l.published_status === 'published' && Array.isArray(l.prerequisite_lesson_ids) &&
    Array.isArray(l.learning_objectives) && !!l.completion_criteria && typeof l.completion_criteria.min_score === 'number' &&
    Array.isArray(l.steps) && l.steps.length > 0 && l.steps.length <= 60 && l.steps.every((x) => x && TYPES.includes(x.type)) && l.steps[l.steps.length - 1].type === 'review';
}
const packOk = (p) => !!p && typeof p === 'object' && p.lessons && typeof p.lessons === 'object' && Array.isArray(p.retired || []);
const clean = (p) => ({ saved_at: p.saved_at || Date.now(), lessons: Object.fromEntries(Object.entries(p.lessons).filter(([id, l]) => lessonOk(l) && l.id === id)), retired: (p.retired || []).filter((x) => typeof x === 'string') });

// At start-up: a pack staged by an earlier automatic check becomes the active one, then the active pack is switched on.
export function loadStoredPack() {
  try {
    const pending = read(PENDING_KEY);
    if (packOk(pending)) { const cur = read(PACK_KEY); const base = packOk(cur) ? clean(cur) : { lessons: {}, retired: [] }; const add = clean(pending); write(PACK_KEY, { saved_at: Date.now(), lessons: { ...base.lessons, ...add.lessons }, retired: add.retired }); }
    localStorage.removeItem(PENDING_KEY);
    const p = read(PACK_KEY); if (!packOk(p)) return setDownloadedLessons({}, []);
    const c = clean(p); setDownloadedLessons(c.lessons, c.retired);
  } catch (e) { try { setDownloadedLessons({}, []); } catch (x) { /* built-in lessons stay */ } }
}
export function packInfo() {
  const raw = (() => { try { return localStorage.getItem(PACK_KEY) || ''; } catch (e) { return ''; } })(); const p = read(PACK_KEY);
  const c = packOk(p) ? clean(p) : { lessons: {}, retired: [], saved_at: null };
  return { count: Object.keys(c.lessons).length, retired: c.retired.length, bytes: raw.length, saved_at: c.saved_at, ids: Object.keys(c.lessons) };
}
const effective = (id) => { const p = read(PACK_KEY); const d = packOk(p) && p.lessons[id] ? p.lessons[id].content_version : 0; return Math.max(d, BUNDLED_VERSIONS[id] || 0); };

// Asks the server what is published and compares with what this phone has. count is how many lessons would change if the learner downloads.
export async function checkUpdates() {
  const m = await publicGet('/content/manifest'); const p = read(PACK_KEY); const have = packOk(p) ? p : { lessons: {}, retired: [] };
  const needed = (m.lessons || []).filter((l) => Number.isInteger(l.content_version) && l.content_version > effective(l.id)).map((l) => ({ id: l.id, version: l.content_version }));
  const retired = (m.retired || []).filter((id) => BUNDLED_VERSIONS[id] !== undefined || have.lessons[id]);
  const before = new Set(have.retired || []); const after = new Set(retired);
  const changed = [...before].filter((x) => !after.has(x)).length + [...after].filter((x) => !before.has(x)).length; // hidden or shown again since the last download
  return { needed, retired, changed, count: needed.length + changed, checked_at: Date.now() };
}
async function fetchLessons(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 20) { const r = await publicGet('/content/lessons?ids=' + ids.slice(i, i + 20).join(',')); (r.lessons || []).forEach((l) => { if (lessonOk(l)) out.push(l); }); }
  return out;
}
// Downloads and switches on at once (the learner asked for it on the Downloaded lessons screen).
export async function downloadUpdates(check) {
  const c = check || await checkUpdates(); const got = c.needed.length ? await fetchLessons(c.needed.map((x) => x.id)) : [];
  const cur = read(PACK_KEY); const base = packOk(cur) ? clean(cur) : { lessons: {}, retired: [] };
  const lessons = { ...base.lessons }; got.forEach((l) => { lessons[l.id] = l; });
  write(PACK_KEY, { saved_at: Date.now(), lessons, retired: c.retired });
  loadStoredPack();
  if (got.length) track('content_updated', { lessons: Math.min(got.length, 500) });
  return { downloaded: got.length, skipped: c.needed.length - got.length, retired: c.retired.length };
}
// Quiet daily check: downloads into a waiting area, switched on the next time the app starts, so a lesson never changes under a learner's hands.
export async function stageUpdates() {
  const c = await checkUpdates();
  if (!c.count) return 0;
  const got = c.needed.length ? await fetchLessons(c.needed.map((x) => x.id)) : [];
  write(PENDING_KEY, { saved_at: Date.now(), lessons: Object.fromEntries(got.map((l) => [l.id, l])), retired: c.retired });
  return got.length;
}
export function removeDownloads() {
  try { localStorage.removeItem(PACK_KEY); localStorage.removeItem(PENDING_KEY); } catch (e) { /* none */ }
  setDownloadedLessons({}, []);
}
export const lessonTitle = (id) => { const l = getLesson(id); return l ? l.title_en : id; };
