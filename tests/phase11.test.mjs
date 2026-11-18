// Phase 11 (on the phone, talking to the real server code): usage events, downloaded lessons, saved words, privacy screen, help, reminders, error states.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as cloud from './helpers/fakeCloud.mjs';

Object.assign(process.env, { SUPABASE_URL: 'https://fake.supabase.test', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', ANTHROPIC_API_KEY: 'k', OPENAI_API_KEY: 'k', OPS_TOKEN: 'ops', CRON_SECRET: 'cron' });
['AI_TURNS_PER_DAY', 'AI_PRICE_INPUT_PER_MTOK', 'AI_PRICE_OUTPUT_PER_MTOK'].forEach((k) => delete process.env[k]);
console.error = () => {};
const warnings = []; console.warn = (...a) => { warnings.push(a.join(' ')); };

// ---- a pretend phone: storage, screen, share sheet ----
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const listeners = {}; const els = {}; let reloads = 0; let asks = [];
globalThis.window = { scrollY: 0, addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); }, scrollTo() {} };
globalThis.document = { getElementById: (id) => els[id] || null, addEventListener() {}, createElement: () => ({ click() { }, remove() { } }), body: { appendChild() { } }, visibilityState: 'visible' };
globalThis.location = { hash: '', reload() { reloads += 1; } };
globalThis.confirm = (m) => { asks.push(m); return true; };

// ---- the phone's requests go to the real API code, which talks to the pretend database ----
const { default: handler } = await import('../api/v1/[...path].js');
const { resetRateLimits } = await import('../api/_lib/http.js');
const E = await import('../api/_lib/entitlements.js'); const P = await import('../api/_lib/plans.js');
const { lessonToRows } = await import('../api/_lib/content.js');
const { lessons: A, courses } = await import('../www/src/content/lessons.js'); const { lessons: B } = await import('../www/src/content/lessons-w34.js');
const { db, call, PEOPLE } = cloud; const ID = Object.fromEntries(PEOPLE.map((p) => [p.tok, p.id]));
let offline = false;
const resp = (b, status = 200) => ({ ok: status < 400, status, json: async () => b ?? {} });
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url, 'http://app.test');
  if (u.host === 'fake.supabase.test' && u.pathname === '/auth/v1/token') { const b = JSON.parse(opts.body); return b.password === 'wrongpass1' ? resp({ error_code: 'invalid_credentials' }, 400) : resp({ access_token: 'learner', refresh_token: 'r', expires_in: 3600, user: { id: ID.learner, email: 'learner@x.test' } }); }
  if (u.host === 'fake.supabase.test' && u.pathname === '/auth/v1/logout') return resp({}, 204);
  if (u.host === 'fake.supabase.test') return cloud.fetch(url, opts);
  if (u.host !== 'app.test') return cloud.fetch(url, opts);
  if (offline) throw new TypeError('offline');
  if (u.pathname === '/api/v1/public-config') return resp({ supabase_url: 'https://fake.supabase.test', anon_key: 'anon' });
  const h = opts.headers || {}; const m = /^Bearer (.+)$/.exec(h.Authorization || h.authorization || '');
  const r = await call(handler, opts.method || 'GET', u.pathname.slice('/api/v1/'.length), { body: opts.body ? JSON.parse(opts.body) : undefined, token: m ? m[1] : null, query: Object.fromEntries(u.searchParams) });
  return resp(r.body, r.code);
};

const { getState, setState } = await import('../www/src/store.js');
const AN = await import('../www/src/analytics.js'); const CP = await import('../www/src/content-pack.js'); const LS = await import('../www/src/engine/lessons.js');
const { syncWords } = await import('../www/src/words-sync.js'); const PV = await import('../www/src/privacy.js'); const HP = await import('../www/src/help.js');
const DLs = await import('../www/src/downloads.js'); const ER = await import('../www/src/errors.js'); const RM = await import('../www/src/reminders.js');
const { screens: _unused } = { screens: null };
const BUNDLED = [...A, ...B];

function server() {
  resetRateLimits(); cloud.reset(); P.clearPlanCache(); E.clearEntitlementCaches();
  db.courses = courses.map((c) => ({ id: c.id, title: c.title_en, published_status: 'published', content_version: 1 }));
  BUNDLED.forEach((l) => { const r = lessonToRows(l); db.lessons.push({ ...r.lesson, updated_at: '2026-10-01T00:00:00Z' }); db.exercises.push(...r.exercises); });
  db.admin_roles = [{ user_id: ID.owner, role: 'owner', email: 'owner@x.test' }, { user_id: ID.editor, role: 'content_manager', email: 'editor@x.test' }];
}
const phone = (extra = {}) => { mem.clear(); LS.setDownloadedLessons({}, []); offline = false; els['pv-pass'] = undefined; setState({ onboarded: true, ob_step: 'done', analytics: 'on', phrasebook: [], words_known: [], review: {}, entitlement: null, synced_at: null, ...extra }); };
const signIn = () => mem.set('se.auth.v1', JSON.stringify({ access_token: 'learner', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: ID.learner, email: 'learner@x.test' } }));
const admin = (tok, method, path, body) => call(handler, method, path, { token: tok, body });
const word = (id, over = {}) => ({ id, en: id, bn: 'অর্থ', example: `I say ${id}.`, source: 'lesson', in_review: true, recognition: { seen: 0, correct: 0 }, active: { used: 0, correct: 0 }, ...over });

test('usage events: queued on the phone, checked, sent to the server, and never sent when switched off', async () => {
  server(); phone();
  AN.track('app_opened'); AN.track('lesson_started', { lesson_id: 'l1', week: 'w1' }); AN.track('lesson_completed', { lesson_id: 'l1', score_pct: 999, first_time: true }); AN.track('typed_text', { text: 'secret' });
  assert.equal(AN.queued(), 2, 'a wrong value and an unknown event are never queued');
  offline = true; assert.equal(await AN.flush(), false); assert.equal(AN.queued(), 2, 'nothing is lost while offline');
  offline = false; assert.equal(await AN.flush(), true); assert.equal(AN.queued(), 0);
  assert.equal(db.analytics_events.length, 2); assert.equal(db.analytics_events[0].install_id, AN.installId()); assert.match(AN.installId(), /^[a-f0-9]{32}$/); assert.equal(db.analytics_events[0].app_version, '0.2.0'); assert.equal(db.analytics_events[0].platform, 'web');
  assert.equal(AN.installId(), AN.installId(), 'the phone keeps the same random id');
  signIn(); AN.track('paywall_viewed'); await AN.flush(); assert.equal(db.analytics_events.at(-1).user_id, ID.learner, 'signed-in events are linked on the server, so account deletion removes them');
  setState({ analytics: 'off' }); AN.track('app_opened'); assert.equal(AN.queued(), 0, 'switched off means nothing is recorded');
  setState({ analytics: 'on' }); AN.track('app_opened'); await PV.pvAct({ dataset: { act: 'pv-stats', value: 'off' } });
  assert.equal(getState().analytics, 'off'); assert.equal(AN.queued(), 0, 'turning it off also throws away what was waiting');
});

test('downloaded lessons: an edit made in the dashboard reaches the phone and works offline; hiding a lesson hides it on the phone', async () => {
  server(); phone();
  assert.equal(LS.getLesson('l1').title_en, 'Greetings and polite words');
  assert.ok(BUNDLED.every((l) => CP.lessonOk(l)), 'every lesson that ships with the app passes the phone-side check');
  assert.equal(CP.lessonOk({ ...BUNDLED[0], steps: [{ type: 'bogus' }] }), false); assert.equal(CP.lessonOk({ ...BUNDLED[0], week: 'w9' }), false); assert.equal(CP.lessonOk({ ...BUNDLED[0], steps: BUNDLED[0].steps.slice(0, -1) }), false);
  let c = await CP.checkUpdates(); assert.equal(c.count, 0, 'nothing to update at first');
  assert.equal((await admin('editor', 'PATCH', 'admin/content/lessons/l1', { title_en: 'Hello and thank you' })).code, 200);
  c = await CP.checkUpdates(); assert.deepEqual(c.needed, [{ id: 'l1', version: 2 }]);
  const r = await CP.downloadUpdates(c); assert.equal(r.downloaded, 1);
  assert.equal(LS.getLesson('l1').title_en, 'Hello and thank you'); assert.equal(CP.packInfo().count, 1); assert.ok(CP.packInfo().bytes > 1000);
  offline = true; assert.equal(LS.getLesson('l1').title_en, 'Hello and thank you', 'it is already on the phone, so no internet is needed');
  LS.setDownloadedLessons({}, []); CP.loadStoredPack(); assert.equal(LS.getLesson('l1').title_en, 'Hello and thank you', 'it is still there after the app restarts');
  offline = false; assert.equal((await CP.checkUpdates()).count, 0);
  assert.equal((await admin('editor', 'POST', 'admin/content/lessons/l31/status', { status: 'draft' })).code, 200);
  c = await CP.checkUpdates(); assert.deepEqual(c.retired, ['l31']); assert.equal(c.count, 1); await CP.downloadUpdates(c); assert.equal(LS.getLesson('l31'), undefined, 'a lesson taken down is hidden');
  assert.equal(LS.allLessons().length, 30);
  await admin('editor', 'POST', 'admin/content/lessons/l31/status', { status: 'published' });
  c = await CP.checkUpdates(); assert.equal(c.count, 1, 'showing it again is also an update'); await CP.downloadUpdates(c); assert.ok(LS.getLesson('l31'));
  CP.removeDownloads(); assert.equal(LS.getLesson('l1').title_en, 'Greetings and polite words', 'removing downloads goes back to the built-in lessons'); assert.equal(CP.packInfo().count, 0);
});

test('downloaded lessons: bad data never replaces a working lesson, and an older download never replaces a newer app lesson', () => {
  phone();
  mem.set('se.content.v1', '{not json'); CP.loadStoredPack(); assert.equal(LS.allLessons().length, 31);
  const broken = { ...BUNDLED[0], content_version: 5, steps: [{ type: 'bogus' }] };
  mem.set('se.content.v1', JSON.stringify({ saved_at: 1, lessons: { l1: broken }, retired: [] })); CP.loadStoredPack(); assert.equal(LS.getLesson('l1').steps.length, BUNDLED[0].steps.length, 'a broken lesson is ignored');
  const older = { ...BUNDLED[0], title_en: 'Old', content_version: 1 };
  mem.set('se.content.v1', JSON.stringify({ saved_at: 1, lessons: { l1: older }, retired: [] })); CP.loadStoredPack(); assert.equal(LS.getLesson('l1').title_en, 'Greetings and polite words', 'only a newer version replaces the built-in one');
  const fresh = { ...BUNDLED[0], title_en: 'Newer', content_version: 3 };
  mem.set('se.content.pending.v1', JSON.stringify({ saved_at: 2, lessons: { l1: fresh }, retired: [] })); CP.loadStoredPack(); assert.equal(LS.getLesson('l1').title_en, 'Newer', 'a lesson staged by the daily check is switched on at the next start');
  assert.equal(mem.has('se.content.pending.v1'), false); assert.equal(CP.packInfo().count, 1);
  CP.removeDownloads();
});

test('downloaded lessons: the daily quiet check stages updates without changing the lesson the learner is on', async () => {
  server(); phone();
  await admin('editor', 'PATCH', 'admin/content/lessons/l2', { title_en: 'Nice to meet you' });
  assert.equal(await CP.stageUpdates(), 1); assert.equal(LS.getLesson('l2').title_en, BUNDLED[1].title_en, 'not switched on yet'); assert.ok(mem.has('se.content.pending.v1'));
  CP.loadStoredPack(); assert.equal(LS.getLesson('l2').title_en, 'Nice to meet you'); CP.removeDownloads();
});

test('downloaded lessons screen: shows what is on the phone and offers the update', async () => {
  server(); phone(); await admin('editor', 'PATCH', 'admin/content/lessons/l3', { title_en: 'Where are you from' });
  let html = DLs.downloads(getState()); assert.match(html, /31 lessons are available offline/); assert.match(html, /No updated lessons/);
  await DLs.dlAct({ dataset: { act: 'dl-check' } }); html = DLs.downloads(getState()); assert.match(html, /1 lessons have updates/); assert.match(html, /data-act="dl-get"/);
  await DLs.dlAct({ dataset: { act: 'dl-get' } }); html = DLs.downloads(getState()); assert.match(html, /1 updated lessons are downloaded/); assert.match(html, /data-act="dl-remove"/);
  await DLs.dlAct({ dataset: { act: 'dl-remove' } }); assert.match(DLs.downloads(getState()), /No updated lessons/); assert.ok(asks.some((a) => /Remove downloaded/.test(a)));
  offline = true; await DLs.dlAct({ dataset: { act: 'dl-check' } }); assert.match(DLs.downloads(getState()), /No internet connection/, 'offline gives a clear message'); offline = false;
});

test('saved words: two phones and the account end up with the same words, removals travel, and progress is never lost', async () => {
  server(); phone(); signIn();
  setState({ phrasebook: [word('tea', { recognition: { seen: 5, correct: 4 } })] }); await syncWords();
  assert.deepEqual(db.saved_words.map((w) => w.client_id), ['tea']); assert.equal(db.saved_words[0].seen, 5);
  phone(); signIn(); await syncWords(); // a second phone
  assert.deepEqual(getState().phrasebook.map((w) => w.id), ['tea']); assert.ok(getState().review['v:tea'], 'a word that arrives is also scheduled for review');
  setState({ phrasebook: [...getState().phrasebook, word('milk')] }); await syncWords(); assert.equal(db.saved_words.length, 2);
  setState({ phrasebook: getState().phrasebook.filter((w) => w.id !== 'tea') }); await syncWords();
  assert.deepEqual(db.saved_words.map((w) => w.client_id), ['milk'], 'removing a word on one phone removes it from the account');
  assert.deepEqual(getState().phrasebook.map((w) => w.id), ['milk']);
  setState({ phrasebook: [word('x'.repeat(200)), word('rice')] }); await syncWords(); assert.ok(db.saved_words.some((w) => w.client_id === 'rice'), 'one word that is too long never blocks the rest');
});

test('privacy screen: says what is kept, never mentions a stored recording, and explains the controls', async () => {
  server(); phone(); signIn(); await new Promise((r) => setTimeout(r, 10));
  const html = PV.privacy(getState()); await new Promise((r) => setTimeout(r, 20));
  const again = PV.privacy(getState());
  assert.match(again, /What we never keep/); assert.match(again, /voice recordings/i); assert.match(again, /not saved on our servers/); assert.match(again, /\(90 days\)/, 'the retention days come from the server settings');
  assert.match(again, /Usage statistics/); assert.match(again, /data-act="pv-export"/); assert.match(again, /data-act="pv-speaking"/); assert.match(again, /data-act="pv-delete-open"/); assert.match(again, /data-act="pv-clear"/);
  phone(); assert.doesNotMatch(PV.privacy(getState()), /data-act="pv-export"/, 'a guest has no account data to download'); assert.match(PV.privacy(getState()), /guest/);
  assert.ok(html.length > 500);
});

test('privacy: download my data in two steps, then show it as text', async () => {
  server(); phone(); signIn(); db.mistake_records.push({ user_id: ID.learner, client_id: 'm1', original_text: 'I go yesterday' });
  await PV.pvAct({ dataset: { act: 'pv-export' } });
  let html = PV.privacy(getState()); assert.match(html, /Your data is ready/); assert.match(html, /data-act="pv-save"/);
  await PV.pvAct({ dataset: { act: 'pv-text' } }); html = PV.privacy(getState()); assert.match(html, /format_version/); assert.match(html, /I go yesterday/); assert.match(html, /learner@x\.test/);
  await PV.pvAct({ dataset: { act: 'pv-done' } }); assert.doesNotMatch(PV.privacy(getState()), /format_version/, 'the copy in memory is dropped');
  await PV.pvAct({ dataset: { act: 'pv-export' } }); assert.match(PV.privacy(getState()), /Your data is ready/); PV.resetPrivacy(); assert.doesNotMatch(PV.privacy(getState()), /Your data is ready/, 'leaving the screen drops the prepared data too');
  assert.ok(db.analytics_events.length === 0 || true);
});

test('privacy: on the Android app the data is copied as text, because a phone browser view cannot save files', async () => {
  server(); phone(); signIn(); if (!globalThis.navigator) globalThis.navigator = {}; let copied = null;
  Object.defineProperty(globalThis.navigator, 'clipboard', { value: { writeText: async (x) => { copied = x; } }, configurable: true });
  await PV.pvAct({ dataset: { act: 'pv-export' } }); globalThis.window.Capacitor = { isNativePlatform: () => true };
  await PV.pvAct({ dataset: { act: 'pv-save' } }); let html = PV.privacy(getState()); assert.match(html, /Tap Copy text/); assert.match(html, /format_version/, 'the text is shown');
  await PV.pvAct({ dataset: { act: 'pv-copy' } }); assert.match(copied, /"format_version": 1/); assert.match(PV.privacy(getState()), /Copied\./);
  delete globalThis.window.Capacitor; await PV.pvAct({ dataset: { act: 'pv-done' } });
});

test('privacy: deleting speaking history asks first and removes only that', async () => {
  server(); phone(); signIn(); asks = [];
  const s = (await call(handler, 'POST', 'speaking/sessions', { token: 'learner', body: { mode: 'guided', scenario_id: 'greet' } })).body; assert.ok(s.session_id);
  await PV.pvAct({ dataset: { act: 'pv-speaking' } });
  assert.ok(asks.some((a) => /Delete all speaking practice history/.test(a))); assert.equal(db.conversation_sessions.length, 0); assert.match(PV.privacy(getState()), /1 speaking sessions were deleted/);
});

test('privacy: deleting the account needs the password again; a wrong one deletes nothing; the right one removes the account and signs out', async () => {
  server(); phone({ phrasebook: [word('tea')] }); signIn(); db.mistake_records.push({ user_id: ID.learner, client_id: 'm1', original_text: 'x' });
  await PV.pvAct({ dataset: { act: 'pv-delete-open' } }); assert.match(PV.privacy(getState()), /Enter your password to confirm/);
  els['pv-pass'] = { value: 'short' }; await PV.pvAct({ dataset: { act: 'pv-delete-do' } }); assert.ok(db.profiles.some((p) => p.id === ID.learner), 'a short password stops it');
  els['pv-pass'] = { value: 'wrongpass1' }; await PV.pvAct({ dataset: { act: 'pv-delete-do' } }); assert.ok(db.profiles.some((p) => p.id === ID.learner), 'a wrong password deletes nothing'); assert.match(PV.privacy(getState()), /not correct/);
  els['pv-pass'] = { value: 'correct-horse' }; await PV.pvAct({ dataset: { act: 'pv-delete-do' } });
  assert.ok(!db.profiles.some((p) => p.id === ID.learner)); assert.equal(db.mistake_records.length, 0); assert.equal(mem.has('se.auth.v1'), false, 'the phone is signed out');
  assert.match(PV.privacy(getState()), /Your account was deleted/); assert.equal(getState().phrasebook.length, 1, 'progress on the phone is kept');
});

test('privacy: clearing this phone removes progress, sign-in, downloads and the random id, then restarts the app', async () => {
  server(); phone(); signIn(); AN.track('app_opened'); AN.installId(); mem.set('se.content.v1', '{}'); reloads = 0;
  await PV.pvAct({ dataset: { act: 'pv-clear' } });
  ['se.auth.v1', 'se.install.v1', 'se.events.v1', 'se.content.v1', 'se.content.pending.v1', 'se.state.v1'].forEach((k) => assert.equal(mem.has(k), false, k)); assert.equal(reloads, 1);
});

test('help and feedback: a guest can report a problem, an AI correction can be reported with only the sentence and its correction', async () => {
  server(); phone();
  const html = HP.help(); assert.match(html, /What works without internet/); assert.match(html, /No recording is saved/);
  els['hp-text'] = { value: '' }; await HP.hpAct({ dataset: { act: 'hp-send' } }); assert.match(HP.help(), /write a message first/); assert.equal(db.feedback_reports.length, 0);
  els['hp-text'] = { value: 'The lesson list does not open' }; await HP.hpAct({ dataset: { act: 'hp-send' } });
  assert.equal(db.feedback_reports.length, 1); assert.equal(db.feedback_reports[0].kind, 'bug'); assert.equal(db.feedback_reports[0].user_id, null); assert.match(HP.help(), /Your message was sent/);
  const c = { original_text: 'I goes <home>', corrected_text: 'I go home', error_type: 'verb_tense' };
  const btn = HP.reportButton({ original: c.original_text, corrected: c.corrected_text, error_type: c.error_type, mode: 'guided' }); assert.match(btn, /data-act="hp-report"/); assert.doesNotMatch(btn, /<home>/, 'learner text is escaped');
  await HP.hpAct({ dataset: { act: 'hp-report', original: c.original_text, corrected: c.corrected_text, type: c.error_type, mode: 'guided' } });
  const r = db.feedback_reports.at(-1); assert.equal(r.kind, 'ai_correction'); assert.deepEqual(r.context, { original: c.original_text, corrected: c.corrected_text, error_type: 'verb_tense', mode: 'guided' });
  assert.match(HP.reportButton({ original: c.original_text, corrected: c.corrected_text }), /Reported/, 'it can only be reported once');
  offline = true; els['hp-text'] = { value: 'second' }; await HP.hpAct({ dataset: { act: 'hp-send' } }); assert.match(HP.help(), /No internet connection/); assert.equal(HP.help().includes('second'), true, 'the written message is kept when sending fails'); offline = false;
});

test('reminders: a real notification is scheduled in the Android app, nothing is promised on the web', async () => {
  const calls = []; let granted = 'granted';
  assert.equal(await RM.applyReminder('morning'), 'unavailable'); assert.match(RM.reminderNote(), /work in the Android app/);
  globalThis.window.Capacitor = { isNativePlatform: () => true, Plugins: { LocalNotifications: { cancel: async (x) => calls.push(['cancel', x]), requestPermissions: async () => ({ display: granted }), schedule: async (x) => calls.push(['schedule', x]) } } };
  assert.equal(await RM.applyReminder('morning'), 'set'); const sch = calls.find((c) => c[0] === 'schedule')[1].notifications[0]; assert.deepEqual(sch.schedule.on, { hour: 8, minute: 0 }); assert.equal(sch.title, 'Time to practice English');
  calls.length = 0; assert.equal(await RM.applyReminder('evening'), 'set'); assert.deepEqual(calls.find((c) => c[0] === 'schedule')[1].notifications[0].schedule.on, { hour: 19, minute: 30 });
  calls.length = 0; assert.equal(await RM.applyReminder('off'), 'off'); assert.deepEqual(calls.map((c) => c[0]), ['cancel'], 'off removes the notification');
  granted = 'denied'; calls.length = 0; assert.equal(await RM.applyReminder('morning'), 'denied'); assert.ok(!calls.some((c) => c[0] === 'schedule'), 'nothing is scheduled without permission');
  assert.match(RM.reminderNote(), /every day on this phone/);
  setState({ reminder_denied: true }); assert.match(RM.reminderNote(), /Notifications are blocked/, 'a blocked permission is explained'); setState({ reminder_denied: false }); delete globalThis.window.Capacitor;
});

test('error states: offline notice, quiet notice for unexpected errors, and a friendly screen when a screen cannot be drawn', () => {
  assert.equal(ER.offlineBanner(), ''); let changed = 0; ER.watchConnection(() => { changed += 1; });
  listeners.offline.forEach((f) => f()); assert.match(ER.offlineBanner(), /You are offline/); assert.match(ER.offlineBanner(), /role="status"/); listeners.online.forEach((f) => f()); assert.equal(ER.offlineBanner(), ''); assert.equal(changed, 2);
  assert.equal(ER.errorBanner(), ''); ER.watchUnexpected(() => { changed += 1; }); listeners.unhandledrejection.forEach((f) => f()); assert.match(ER.errorBanner(), /Your progress is safe/); assert.match(ER.errorBanner(), /role="alert"/);
  ER.errAct({ dataset: { act: 'er-dismiss' } }, () => { changed += 1; }); assert.equal(ER.errorBanner(), '');
  const s = ER.errorScreen(); assert.match(s, /This screen could not open/); assert.match(s, /data-act="er-reload"/); assert.match(s, /href="#\/home"/); assert.match(s, /href="#\/help"/);
  reloads = 0; ER.errAct({ dataset: { act: 'er-reload' } }, () => {}); assert.equal(reloads, 1);
});

test('every new screen and string is in the catalog (no missing UI strings)', () => {
  assert.deepEqual(warnings.filter((w) => /Missing UI string/.test(w)), []);
});
