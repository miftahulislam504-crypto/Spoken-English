// Admin dashboard (plan sections 13 and 14). Signs in with the same account as the app; the server checks the role on every request.
// Everything shown here comes from /api/v1/admin/*. No secret is kept in this page. The session lives only in this tab.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = (x) => (x ? new Date(x).toLocaleString() : '');
const SKEY = 'admin.session';
let C = null; let me = null; let tab = 'overview'; let msg = null; let ctx = {};
const TABS = [['overview', 'Overview', 'metrics.read'], ['analytics', 'Analytics', 'metrics.read'], ['content', 'Content', 'content.read'], ['ai', 'AI', 'ai.read'], ['plans', 'Plans', 'billing.read'], ['learners', 'Learners', 'users.read'], ['feedback', 'Feedback', 'feedback.manage'], ['team', 'Team', 'roles.manage'], ['audit', 'Audit log', 'audit.read']];

// ---- sign in and requests ----
const session = () => { try { return JSON.parse(sessionStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } };
const save = (r) => sessionStorage.setItem(SKEY, JSON.stringify({ access_token: r.access_token, refresh_token: r.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (r.expires_in || 3600), email: r.user && r.user.email }));
async function cfg() { if (!C) C = await (await fetch('/api/v1/public-config')).json(); return C; }
async function gotrue(query, body) {
  const c = await cfg(); const r = await fetch(`${c.supabase_url}/auth/v1/token?${query}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: c.anon_key }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error_description || j.msg || 'Sign in failed'); return j;
}
async function token() {
  let s = session(); if (!s) throw new Error('signed_out');
  if (s.expires_at - 60 < Date.now() / 1000) { try { save(await gotrue('grant_type=refresh_token', { refresh_token: s.refresh_token })); s = session(); } catch (e) { sessionStorage.removeItem(SKEY); throw new Error('signed_out'); } }
  return s.access_token;
}
async function api(method, path, body, query) {
  const q = query ? '?' + new URLSearchParams(query) : '';
  const r = await fetch(`/api/v1/${path}${q}`, { method, headers: { Authorization: 'Bearer ' + await token(), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error((j.error && (typeof j.error.details === 'string' ? j.error.details : j.error.details && j.error.details.reason) || j.error.message) || 'Request failed'); e.code = j.error && j.error.code; throw e; }
  return j;
}
const can = (p) => !!me && me.permissions.includes(p);

// ---- small building blocks ----
const kv = (o) => `<dl class="kv">${Object.entries(o).map(([k, v]) => `<dt>${esc(k.replace(/_/g, ' '))}</dt><dd>${esc(typeof v === 'object' && v !== null ? JSON.stringify(v) : v)}</dd>`).join('')}</dl>`;
const card = (title, inner) => `<section class="card"><h2>${esc(title)}</h2>${inner}</section>`;
const table = (head, rows) => `<div class="tbl"><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${head.length}" class="muted">Nothing yet.</td></tr>`}</tbody></table></div>`;
const tr = (cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
const note = () => (msg ? `<p class="fb ${msg.ok ? 'ok' : 'bad'}" role="alert">${esc(msg.text)}</p>` : '');
const field = (id, label, value = '', type = 'text', extra = '') => `<label>${esc(label)}<input id="${id}" class="field" type="${type}" value="${esc(value)}" ${extra}></label>`;
const area = (id, label, value = '', rows = 5) => `<label>${esc(label)}<textarea id="${id}" class="field" rows="${rows}">${esc(value)}</textarea></label>`;
const val = (id) => (document.getElementById(id) || {}).value || '';
const num = (id) => { const v = val(id).trim(); return v === '' ? null : Number(v); };
const bars = (rows, key) => { const max = Math.max(1, ...rows.map((r) => r[key])); return `<div class="spark" role="img" aria-label="${rows.length} days">${rows.map((r) => `<i style="height:${Math.round((r[key] / max) * 100)}%" title="${esc(r.day)}: ${r[key]}"></i>`).join('')}</div>`; };
async function go(f) { try { msg = null; await f(); } catch (e) { if (e.message === 'signed_out') { me = null; } else msg = { text: e.message, ok: false }; } draw(); }

// ---- screens ----
async function viewOverview() {
  const o = await api('GET', 'admin/overview'); const h = o.health || { checks: [] };
  return note() + card('Health: ' + (h.status === 'ok' ? 'all good' : 'needs attention'), table(['Check', 'State', 'Detail'], h.checks.map((c) => tr([esc(c.name), `<span class="${c.ok ? 'ok' : 'warn'}">${c.ok ? 'OK' : 'ATTENTION'}</span>`, esc(c.detail)])))) +
    (o.warnings && o.warnings.length ? card('Warnings', `<ul class="plain">${o.warnings.map((w) => `<li>${esc(w.replace(/_/g, ' '))}</li>`).join('')}</ul>`) : '') +
    card('AI today', kv({ cost_usd: o.today.cost_usd, ...Object.fromEntries(Object.entries(o.today.usage || {}).map(([k, v]) => [k, JSON.stringify(v)])) })) + card('AI this month', kv({ cost_usd: o.month.cost_usd })) + card('Budget', kv(o.budget || {})) +
    card('Subscriptions', table(['Plan', 'Status', 'Store state', 'Count'], (o.subscriptions || []).map((s) => tr([esc(s.plan_id), esc(s.status), esc(s.store_state || ''), esc(s.count)]))));
}
async function viewAnalytics() {
  const days = ctx.days || 30; const [a, st] = await Promise.all([api('GET', 'admin/analytics', null, { days }), api('GET', 'admin/content/stats')]);
  const top = Math.max(1, a.funnel[0].actors); const opened = {}; a.daily.filter((d) => d.name === 'app_opened').forEach((d) => { opened[d.day] = d.actors; });
  const dayRows = Object.entries(opened).map(([day, n]) => ({ day, n }));
  return note() + `<div class="chips">${[7, 30, 90].map((d) => `<button class="chip" data-act="days" data-v="${d}" aria-pressed="${days === d}">${d} days</button>`).join('')}</div>` +
    card('Funnel (different phones)', `<div class="fun">${a.funnel.map((f) => `<div class="r"><span>${esc(f.name.replace(/_/g, ' '))}</span><div class="b"><i style="width:${Math.round((f.actors / top) * 100)}%"></i></div><span>${f.actors}</span></div>`).join('')}</div>`) +
    card('Phones that opened the app, per day', dayRows.length ? bars(dayRows, 'n') : '<p class="muted">No events yet. Usage events appear after learners use the app.</p>') +
    card('Retention', table(['First opened', 'Phones', 'Back next day', 'Back after 7 days'], a.retention.map((r) => tr([esc(r.cohort), r.size, `${r.d1} (${r.size ? Math.round((r.d1 / r.size) * 100) : 0}%)`, `${r.d7} (${r.size ? Math.round((r.d7 / r.size) * 100) : 0}%)`])))) +
    card('Learners and practice', kv({ learners_total: a.product.learners_total, speaking_sessions: a.product.sessions && a.product.sessions.total, sessions_ended: a.product.sessions && a.product.sessions.ended, learner_turns: a.product.learner_turns, open_mistakes: a.product.open_mistakes, new_feedback: a.product.feedback_new })) +
    card('Lessons completed per day', (a.product.lessons_completed || []).length ? bars(a.product.lessons_completed.map((x) => ({ day: x.day, n: x.n })), 'n') : '<p class="muted">None in this period.</p>') +
    card('Lessons: started and finished (as reported by phones)', table(['Lesson', 'Started', 'Finished', 'Average score'], st.lessons.map((l) => tr([esc(l.lesson_id), l.started, l.completed, l.avg_score_pct === null ? '' : l.avg_score_pct + '%'])))) +
    card('Most missed exercises', table(['Exercise (lesson:step)', 'Misses'], st.most_missed.map((m) => tr([esc(m.ref), m.misses]))) + `<p class="muted small">${esc(st.note)}</p>`);
}
async function viewContent() {
  if (ctx.lesson) return viewLesson(ctx.lesson);
  const [r, ch] = await Promise.all([api('GET', 'admin/content/lessons'), api('GET', 'admin/content/checks')]);
  return note() + card('Checks', ch.with_problems ? `<p class="warn">${ch.with_problems} of ${ch.checked} lessons have problems.</p>${ch.lessons.map((l) => `<details><summary>${esc(l.id)} ${esc(l.title_en)}</summary><ul class="plain">${l.problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></details>`).join('')}` : `<p class="ok">All ${ch.checked} lessons pass every check.</p>`) +
    `<div class="tbl"><table><thead><tr><th>Lesson</th><th>Status</th><th>Version</th><th>Exercises</th></tr></thead><tbody>${r.lessons.map((l) => tr([`<button class="linkbtn" data-act="lesson" data-id="${esc(l.id)}">${l.sequence_number}. ${esc(l.title_en)}</button>`, `<span class="badge">${esc(l.published_status)}</span>`, l.content_version, l.exercise_count])).join('')}</tbody></table></div>` +
    (can('content.write') ? card('Add a new lesson (starts as a draft)', `<p class="muted small">Paste one lesson in the same format as the lesson files in the app (docs/admin.md has an example). It is checked fully before it is saved. A lesson reaches phones only after you publish it.</p><div class="ad-form">${area('imp-json', 'Lesson JSON', '', 8)}${field('imp-reason', 'Reason')}<button class="btn" data-act="import">Check and save as draft</button></div>`) : '');
}
async function viewLesson(id) {
  const [v, revs] = await Promise.all([api('GET', 'admin/content/lessons/' + id), api('GET', `admin/content/lessons/${id}/revisions`)]); const l = v.lesson; const w = can('content.write'); const pub = can('content.publish');
  return note() + `<button class="back linkbtn" data-act="back">Back to lessons</button><h1>${esc(l.title_en)}</h1><p class="muted">${esc(l.id)} - version ${l.content_version} - <span class="badge">${esc(l.published_status)}</span> - ${esc(l.level)} - ${esc(l.week)}</p>` +
    (v.problems.length ? card('Problems', `<ul class="plain">${v.problems.map((p) => `<li class="warn">${esc(p)}</li>`).join('')}</ul>`) : `<p class="ok">This lesson passes every check.</p>`) +
    (pub ? card('Status', `<p class="muted small">Publishing runs every check. A lesson other lessons need cannot be hidden. Phones pick up changes within a day, or when the learner taps Check for updates.</p><div class="row2">${['published', 'draft', 'archived'].filter((s) => s !== l.published_status).map((s) => `<button class="btn secondary" data-act="status" data-id="${esc(l.id)}" data-v="${s}">Set to ${s}</button>`).join('')}</div>`) : '') +
    (w ? card('Details', `<div class="ad-form">${field('ls-title', 'Title', l.title_en)}${area('ls-obj', 'Learning objectives (one per line)', (l.learning_objectives || []).join('\n'), 4)}${field('ls-dur', 'Estimated seconds', l.estimated_duration_seconds, 'number')}${field('ls-min', 'Completion score (0 to 1)', l.completion_min_score, 'number', 'step="0.05"')}${field('ls-pre', 'Prerequisite lesson ids (comma separated)', (l.prerequisite_lesson_ids || []).join(', '))}${field('ls-reason', 'Reason for this change')}<button class="btn" data-act="save-lesson" data-id="${esc(l.id)}">Save details</button></div>`) : card('Details', kv({ objectives: (l.learning_objectives || []).join('; '), seconds: l.estimated_duration_seconds, completion_score: l.completion_min_score, prerequisites: (l.prerequisite_lesson_ids || []).join(', ') }))) +
    `<h2 class="sec">Exercises (${v.exercises.length})</h2>` + v.exercises.map((e) => `<details class="card"><summary>${e.position + 1}. ${esc(e.exercise_type)} - ${esc((e.content_json.prompt_en || '').slice(0, 60))}</summary>` + (w ? `<div class="ad-form">${area('ex-c-' + e.id, 'Content (JSON)', JSON.stringify(e.content_json, null, 2), 8)}${area('ex-a-' + e.id, 'Answer rules (JSON)', JSON.stringify(e.answer_rules_json, null, 2), 6)}${field('ex-r-' + e.id, 'Reason')}<button class="btn secondary" data-act="save-ex" data-id="${esc(e.id)}">Save exercise</button></div>` : `<div class="pre">${esc(JSON.stringify({ content: e.content_json, rules: e.answer_rules_json }, null, 2))}</div>`) + `</details>`).join('') +
    card('Earlier versions', table(['Version', 'By', 'When', 'Reason', ''], revs.revisions.map((r) => tr([r.content_version, esc(r.changed_by_email || ''), esc(when(r.created_at)), esc(r.reason || ''), w ? `<button class="linkbtn" data-act="restore" data-id="${esc(l.id)}" data-rev="${r.id}">Restore</button>` : '']))));
}
async function viewAi() {
  const a = await api('GET', 'admin/ai'); const s = a.settings; const w = can('ai.write');
  return note() + card('AI coach', kv({ coach_model: a.coach_model, voice_model: a.stt_model, coach_key_set: a.anthropic_key_set, voice_key_set: a.stt_key_set, prices_configured: a.prices_configured, daily_turn_ceiling: a.ai_turns_ceiling === null ? 'none' : a.ai_turns_ceiling })) +
    card('Spending', kv({ today_usd: a.today.cost_usd, month_usd: a.month.cost_usd, ...a.budget })) +
    (w ? card('Switch and budgets', `<div class="ad-form"><label class="row2"><span>AI Speak is on</span><input id="ai-on" type="checkbox" ${s.ai_enabled ? 'checked' : ''}></label>${field('ai-day', 'Daily budget in USD (empty for none)', s.daily_usd === null ? '' : s.daily_usd, 'number', 'step="0.5" min="0"')}${field('ai-mon', 'Monthly budget in USD (empty for none)', s.monthly_usd === null ? '' : s.monthly_usd, 'number', 'step="1" min="0"')}${field('ai-reason', 'Reason')}<button class="btn" data-act="save-ai">Save</button></div>`) : '') +
    card('Reported AI corrections waiting for review', a.correction_reports.length ? a.correction_reports.map((r) => `<div class="card"><p><strong>${esc(r.context.corrected || '')}</strong></p><p class="muted">Learner said: ${esc(r.context.original || '')} (${esc(r.context.error_type || '')})</p><p class="muted small">${esc(when(r.created_at))}</p></div>`).join('') + '<p class="muted small">Handle these in Feedback. Add confirmed mistakes to the evaluation set (evals/coach-cases.json).</p>' : '<p class="muted">None waiting.</p>');
}
async function viewPlans() {
  const p = await api('GET', 'admin/plans'); const w = can('plans.write');
  const subsOf = (id) => p.subscriptions.filter((s) => s.plan_id === id).map((s) => `${s.status}${s.store_state ? '/' + s.store_state : ''} ${s.count}`).join(', ') || 'none';
  const mode = (x, m) => `<label class="chip"><input type="checkbox" id="pl-m-${x.id}-${m}" ${x.features.speaking_modes.includes(m) ? 'checked' : ''}> ${m}</label>`;
  const form = (x) => `<div class="ad-form">${field('pl-n-' + x.id, 'Name', x.name)}${field('pl-t-' + x.id, 'AI turns per day', x.features.ai_turns_per_day, 'number', 'min="0"')}${field('pl-s-' + x.id, 'Voice seconds per day', x.features.stt_seconds_per_day, 'number', 'min="0"')}` +
    `<div class="chips" role="group" aria-label="Speaking modes">${p.modes.map((m) => mode(x, m)).join('')}</div>` +
    (x.id === 'free' ? '' : field('pl-p-' + x.id, 'Google Play product id', x.play_product_id || '') + field('pl-b-' + x.id, 'Google Play base plan id', x.play_base_plan_id || '')) +
    `${field('pl-r-' + x.id, 'Reason')}<button class="btn" data-act="save-plan" data-id="${x.id}">Save ${esc(x.id)}</button></div>`;
  const view = (x) => kv({ turns: x.features.ai_turns_per_day, voice_seconds: x.features.stt_seconds_per_day, modes: x.features.speaking_modes.join(', ') });
  return note() + p.plans.map((x) => card(`${x.name} (${x.id})`, `<p class="muted small">Active or pending subscriptions: ${esc(subsOf(x.id))}</p>` + (w ? form(x) : view(x)))).join('');
}
function grantForm(u) {
  const max = me.role === 'owner' ? 365 : 31;
  return `<h2 class="sec">Give or take back a plan</h2><div class="ad-form"><div class="row2"><label>Plan<select id="gr-plan" class="field"><option>pro</option><option>advanced</option></select></label>${field('gr-days', `Days (up to ${max})`, 14, 'number', 'min="1"')}</div>${field('gr-reason', 'Reason (required)')}` +
    `<div class="row2"><button class="btn" data-act="grant" data-id="${esc(u.profile.id)}">Give plan</button><button class="btn secondary" data-act="revoke" data-id="${esc(u.profile.id)}">Take back manual plan</button></div><p class="muted small">Google Play subscriptions are managed by Google and cannot be changed here.</p></div>`;
}
function userCard(u) {
  const info = kv({ name: u.profile.display_name, level: u.profile.current_level, daily_goal: u.profile.daily_goal_minutes, joined: when(u.profile.created_at), plan: u.entitlement.plan.name, source: u.entitlement.source, renews: when(u.entitlement.renews_at), lessons_completed: u.counts.lessons_completed, speaking_sessions: u.counts.speaking_sessions, feedback_reports: u.counts.feedback_reports });
  const subs = table(['Plan', 'Provider', 'Status', 'Ends'], u.subscriptions.map((s) => tr([esc(s.plan_id), esc(s.provider), esc(s.status + (s.store_state ? '/' + s.store_state : '')), esc(when(s.current_period_end))])));
  return card(u.email || u.profile.id, info + subs + (can('users.grant') ? grantForm(u) : ''));
}
async function viewLearners() {
  const found = ctx.found || []; const u = ctx.user;
  const search = card('Find a learner', `<div class="ad-form">${field('us-q', 'Exact email or account id', ctx.q || '', 'text', 'autocomplete="off"')}<button class="btn" data-act="search">Search</button></div><p class="muted small">Looking at a learner is recorded in the audit log. Conversation text is never shown here.</p>`);
  const list = found.length ? table(['Email', 'Joined', 'Last sign in', ''], found.map((x) => tr([esc(x.email), esc(when(x.created_at)), esc(when(x.last_sign_in_at)), `<button class="linkbtn" data-act="user" data-id="${esc(x.id)}">Open</button>`]))) : '';
  return note() + search + list + (u ? userCard(u) : '');
}
async function viewFeedback() {
  const f = ctx.fb || {}; const r = await api('GET', 'admin/feedback', null, { ...(f.status ? { status: f.status } : {}), ...(f.kind ? { kind: f.kind } : {}) });
  return note() + `<div class="chips">${['', 'new', 'reviewing', 'resolved', 'dismissed'].map((s) => `<button class="chip" data-act="fbf" data-k="status" data-v="${s}" aria-pressed="${(f.status || '') === s}">${s || 'all'}</button>`).join('')}</div><div class="chips">${['', 'bug', 'content_error', 'ai_correction', 'idea', 'other'].map((s) => `<button class="chip" data-act="fbf" data-k="kind" data-v="${s}" aria-pressed="${(f.kind || '') === s}">${(s || 'all kinds').replace('_', ' ')}</button>`).join('')}</div>` +
    r.reports.map((x) => card(`${x.kind.replace('_', ' ')} - ${x.status}`, `<p>${esc(x.message)}</p>${Object.keys(x.context).length ? `<div class="pre">${esc(JSON.stringify(x.context, null, 1))}</div>` : ''}<p class="muted small">${esc(when(x.created_at))} - ${esc(x.platform || '')} ${esc(x.app_version || '')}</p><div class="ad-form">${field('fb-n-' + x.id, 'Note', x.admin_note || '')}<div class="row2">${['reviewing', 'resolved', 'dismissed'].map((s) => `<button class="btn secondary" data-act="fbs" data-id="${esc(x.id)}" data-v="${s}">${s}</button>`).join('')}</div></div>`)).join('') || '<p class="muted">No reports.</p>';
}
async function viewTeam() {
  const t = await api('GET', 'admin/roles');
  return note() + card('Team', table(['Email', 'Role', ''], t.roles.map((x) => tr([esc(x.email || x.user_id), `<span class="badge">${esc(x.role)}</span>`, `<button class="linkbtn" data-act="rm-role" data-id="${esc(x.user_id)}">Remove</button>`])))) +
    card('Add or change a role', `<p class="muted small">The person must already have an account in the app.</p><div class="ad-form">${field('rl-email', 'Email', '', 'email')}<label>Role<select id="rl-role" class="field">${t.available.map((r) => `<option>${esc(r)}</option>`).join('')}</select></label><button class="btn" data-act="set-role">Save role</button></div>`) +
    card('What each role can do', table(['Role', 'Can'], Object.entries(t.permissions).map(([k, v]) => tr([esc(k), esc(v.join(', '))]))));
}
async function viewAudit() {
  const a = await api('GET', 'admin/audit', null, { limit: 50, ...(ctx.before ? { before: ctx.before } : {}) }); ctx.last = a.entries.length ? a.entries[a.entries.length - 1].id : null;
  return note() + table(['When', 'Who', 'What', 'Target', 'Details'], a.entries.map((e) => tr([esc(when(e.at)), esc((e.actor_email || e.actor_role || '') + (e.actor_role && e.actor_email ? ' (' + e.actor_role + ')' : '')), esc(e.action), esc((e.target_type || '') + ' ' + (e.target_id || '')), `<details><summary>show</summary><div class="pre">${esc(JSON.stringify(e.details, null, 1))}</div></details>`]))) + (a.entries.length === 50 ? `<button class="btn secondary" data-act="older">Older entries</button>` : '') + (ctx.before ? `<button class="btn secondary" data-act="newest">Back to newest</button>` : '');
}
const VIEWS = { overview: viewOverview, analytics: viewAnalytics, content: viewContent, ai: viewAi, plans: viewPlans, learners: viewLearners, feedback: viewFeedback, team: viewTeam, audit: viewAudit };

// ---- drawing and actions ----
function login(err) {
  return `<main class="admin"><h1>Admin sign in</h1><p class="muted">Use the account you use in the app. Only people with an admin role can continue.</p><div class="ad-form">${field('li-email', 'Email', '', 'email', 'autocomplete="username"')}${field('li-pass', 'Password', '', 'password', 'autocomplete="current-password"')}${err ? `<p class="fb bad" role="alert">${esc(err)}</p>` : ''}<button class="btn" data-act="login">Sign in</button></div></main>`;
}
let loginErr = '';
async function draw() {
  const app = $('#app');
  if (!me) { app.innerHTML = login(loginErr); return; }
  const tabs = TABS.filter(([, , p]) => can(p)); if (!tabs.some(([k]) => k === tab)) tab = tabs[0] ? tabs[0][0] : 'overview';
  app.innerHTML = `<main class="admin"><div class="top"><h1>Admin</h1><span class="badge">${esc(me.role)}</span></div><nav class="atabs" aria-label="Sections">${tabs.map(([k, n]) => `<button class="chip" data-act="tab" data-v="${k}" aria-pressed="${k === tab}">${esc(n)}</button>`).join('')}<button class="chip" data-act="logout">Sign out</button></nav><div id="view" aria-live="polite"><p class="muted">Loading...</p></div></main>`;
  try { $('#view').innerHTML = await VIEWS[tab](); } catch (e) { if (e.message === 'signed_out') { me = null; return draw(); } $('#view').innerHTML = `<p class="fb bad" role="alert">${esc(e.message)}</p>`; }
}
const lines = (id) => val(id).split('\n').map((x) => x.trim()).filter(Boolean);
const ACTS = {
  login: async () => { loginErr = ''; try { save(await gotrue('grant_type=password', { email: val('li-email').trim(), password: val('li-pass') })); me = await api('GET', 'admin/me'); } catch (e) { sessionStorage.removeItem(SKEY); me = null; loginErr = e.message === 'forbidden' || /access/i.test(e.message) ? 'This account has no admin role.' : e.message; } draw(); },
  logout: () => { sessionStorage.removeItem(SKEY); me = null; ctx = {}; draw(); },
  tab: (d) => { tab = d.v; ctx = {}; msg = null; draw(); }, days: (d) => { ctx.days = Number(d.v); draw(); },
  lesson: (d) => { ctx.lesson = d.id; draw(); }, back: () => { ctx.lesson = null; draw(); },
  'save-lesson': (d) => go(async () => { const b = { title_en: val('ls-title'), learning_objectives: lines('ls-obj'), estimated_duration_seconds: num('ls-dur'), completion_min_score: num('ls-min'), prerequisite_lesson_ids: val('ls-pre').split(',').map((x) => x.trim()).filter(Boolean), reason: val('ls-reason') }; const r = await api('PATCH', 'admin/content/lessons/' + d.id, b); msg = { text: 'Saved. Version ' + r.content_version + '.', ok: true }; }),
  'save-ex': (d) => go(async () => { const r = await api('PUT', 'admin/content/exercises/' + d.id, { content_json: JSON.parse(val('ex-c-' + d.id)), answer_rules_json: JSON.parse(val('ex-a-' + d.id)), reason: val('ex-r-' + d.id) }); msg = { text: 'Saved. Version ' + r.content_version + '.', ok: true }; }),
  status: (d) => go(async () => { if (!confirm('Set this lesson to ' + d.v + '?')) return; await api('POST', `admin/content/lessons/${d.id}/status`, { status: d.v }); msg = { text: 'Status is now ' + d.v + '.', ok: true }; }),
  restore: (d) => go(async () => { if (!confirm('Restore this earlier version? The current version is kept in the history.')) return; const r = await api('POST', `admin/content/lessons/${d.id}/restore`, { revision_id: Number(d.rev) }); msg = { text: 'Restored as version ' + r.content_version + '.', ok: true }; }),
  import: () => go(async () => { const r = await api('POST', 'admin/content/lessons', { lesson: JSON.parse(val('imp-json')), reason: val('imp-reason') }); msg = { text: 'Saved as a draft with ' + r.exercises + ' exercises. Open it and publish when ready.', ok: true }; }),
  'save-ai': () => go(async () => { await api('PUT', 'admin/ai/settings', { ai_enabled: document.getElementById('ai-on').checked, daily_usd: num('ai-day'), monthly_usd: num('ai-mon'), reason: val('ai-reason') }); msg = { text: 'Saved.', ok: true }; }),
  'save-plan': (d) => go(async () => { const modes = ['guided', 'roleplay', 'free', 'repeat', 'answer', 'review'].filter((m) => (document.getElementById(`pl-m-${d.id}-${m}`) || {}).checked); const b = { name: val('pl-n-' + d.id), features: { ai_turns_per_day: num('pl-t-' + d.id), stt_seconds_per_day: num('pl-s-' + d.id), speaking_modes: modes }, reason: val('pl-r-' + d.id) }; if (d.id !== 'free') { b.play_product_id = val('pl-p-' + d.id).trim() || null; b.play_base_plan_id = val('pl-b-' + d.id).trim() || null; } await api('PUT', 'admin/plans/' + d.id, b); msg = { text: 'Saved. The new limits apply at once.', ok: true }; }),
  search: () => go(async () => { ctx.q = val('us-q').trim(); ctx.user = null; ctx.found = (await api('GET', 'admin/users/search', null, { q: ctx.q })).users; if (!ctx.found.length) msg = { text: 'No learner has exactly this email or id.', ok: false }; }),
  user: (d) => go(async () => { ctx.user = await api('GET', 'admin/users/' + d.id); }),
  grant: (d) => go(async () => { await api('POST', `admin/users/${d.id}/grant`, { plan_id: val('gr-plan'), days: num('gr-days'), reason: val('gr-reason') }); ctx.user = await api('GET', 'admin/users/' + d.id); msg = { text: 'Plan given.', ok: true }; }),
  revoke: (d) => go(async () => { await api('POST', `admin/users/${d.id}/revoke`, { reason: val('gr-reason') }); ctx.user = await api('GET', 'admin/users/' + d.id); msg = { text: 'Manual plan taken back.', ok: true }; }),
  fbf: (d) => { ctx.fb = { ...(ctx.fb || {}), [d.k]: d.v }; draw(); },
  fbs: (d) => go(async () => { await api('PATCH', 'admin/feedback/' + d.id, { status: d.v, admin_note: val('fb-n-' + d.id) }); }),
  'set-role': () => go(async () => { await api('PUT', 'admin/roles', { email: val('rl-email').trim(), role: val('rl-role') }); msg = { text: 'Role saved.', ok: true }; }),
  'rm-role': (d) => go(async () => { if (!confirm('Remove this role?')) return; await api('DELETE', 'admin/roles/' + d.id); msg = { text: 'Role removed.', ok: true }; }),
  older: () => { ctx.before = ctx.last; draw(); }, newest: () => { ctx.before = null; draw(); }
};
document.addEventListener('click', (e) => { const a = e.target.closest('[data-act]'); if (a && ACTS[a.dataset.act]) ACTS[a.dataset.act](a.dataset); });
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'li-pass') ACTS.login(); });
(async () => { if (session()) { try { me = await api('GET', 'admin/me'); } catch (e) { sessionStorage.removeItem(SKEY); me = null; } } draw(); })();
