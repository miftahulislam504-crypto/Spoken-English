// The pretend database used in the other tests accepts any column name, a real database does not. This test reads the SQL files and checks that every table,
// column, filter, sort and function the server code asks for really exists, so a wrong name is found here and not by a learner.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const sql = readdirSync(join(root, 'supabase/migrations')).sort().map((f) => readFileSync(join(root, 'supabase/migrations', f), 'utf8')).join('\n');
const KEYWORDS = new Set(['primary', 'unique', 'check', 'foreign', 'constraint', 'references']);
const tables = {};
for (const m of sql.matchAll(/create table if not exists public\.(\w+) \(([\s\S]*?)\n\);/g)) {
  const cols = new Set();
  m[2].split('\n').forEach((line) => { const c = /^\s{2}"?(\w+)"?\s+\w/.exec(line); if (c && !KEYWORDS.has(c[1])) cols.add(c[1]); });
  tables[m[1]] = cols;
}
for (const m of sql.matchAll(/alter table public\.(\w+)((?:\s+add column if not exists \w+[^;]*?)+);/g)) { (tables[m[1]] = tables[m[1]] || new Set()); for (const c of m[2].matchAll(/add column if not exists (\w+)/g)) tables[m[1]].add(c[1]); }
for (const m of sql.matchAll(/alter table public\.(\w+) add column if not exists (\w+)/g)) (tables[m[1]] = tables[m[1]] || new Set()).add(m[2]);
const functions = {}; for (const m of sql.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)/g)) functions[m[1]] = [...m[2].matchAll(/(p_\w+|since)\s+/g)].map((x) => x[1]);

const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
// Text inside ${...} (which can hold quotes of its own) is replaced by a marker so each query string is read whole.
const plain = (src) => { let out = src; for (let i = 0; i < 6; i++) out = out.replace(/\$\{[^{}]*\}/g, '_X_'); return out; };
const code = walk(join(root, 'api')).filter((f) => f.endsWith('.js')).map((f) => [f.replace(root, ''), plain(readFileSync(f, 'utf8'))]);
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'or', 'and']);

test('the schema reader found the tables', () => {
  ['profiles', 'lessons', 'exercises', 'subscriptions', 'plans', 'mistake_records', 'admin_roles', 'audit_log', 'analytics_events', 'feedback_reports', 'saved_words', 'content_revisions'].forEach((t) => assert.ok(tables[t] && tables[t].size > 3, `table ${t} not found`));
  assert.ok(tables.mistake_records.has('occurrence_count') && tables.mistake_records.has('ref'), 'columns added later are found');
  assert.ok(tables.plans.has('play_product_id'));
});

test('every table, column, filter, sort and conflict target in the server code exists in the database files', () => {
  const problems = []; let checked = 0;
  for (const [file, src] of code) {
    for (const m of src.matchAll(/['`]((?:[a-z_]+)\?[^'`\n]*)['`]/g)) {
      const [table, query] = [m[1].split('?')[0], m[1].split('?').slice(1).join('?')];
      if (!tables[table]) { if (/^[a-z_]+$/.test(table) && /select=|=eq\.|=in\.|order=|on_conflict=/.test(query)) problems.push(`${file}: unknown table ${table}`); continue; }
      query.split('&').forEach((part) => {
        const [k, v = ''] = part.split(/=(.*)/s); if (!k || k.includes('_X_')) return; checked += 1;
        if (k === 'select') v.split(',').filter((c) => c && c !== '*' && !c.includes('_X_') && !c.includes('(')).forEach((c) => { if (!tables[table].has(c)) problems.push(`${file}: ${table}.${c} (select)`); });
        else if (k === 'order') v.split(',').forEach((o) => { const c = o.split('.')[0]; if (c && !tables[table].has(c)) problems.push(`${file}: ${table}.${c} (order)`); });
        else if (k === 'on_conflict') v.split(',').forEach((c) => { if (!tables[table].has(c)) problems.push(`${file}: ${table}.${c} (on_conflict)`); });
        else if (!RESERVED.has(k) && !tables[table].has(k)) problems.push(`${file}: ${table}.${k} (filter)`);
      });
    }
  }
  assert.ok(checked > 120, `only ${checked} query parts were checked`); assert.deepEqual(problems, []);
});

test('every database function the server calls exists and gets the right parameter names', () => {
  const problems = []; let n = 0;
  for (const [file, src] of code) for (const m of src.matchAll(/rpc\/(\w+)'(?:, \{[^}]*?body: (\{[^}]*\}|[a-z]+)\s*\})?/g)) {
    n += 1; const fn = functions[m[1]]; if (!fn) { problems.push(`${file}: function ${m[1]} does not exist`); continue; }
    if (m[2] && m[2].startsWith('{')) [...m[2].matchAll(/\b(p_\w+|since)\b\s*:/g)].forEach((p) => { if (!fn.includes(p[1])) problems.push(`${file}: ${m[1]} has no parameter ${p[1]}`); });
  }
  assert.ok(n >= 8, `only ${n} calls were checked`); assert.deepEqual(problems, []);
});

test('rows the server writes use real columns (insert and update bodies for the tables added in Phase 10 and 11)', () => {
  const WRITES = { analytics_events: ['install_id', 'user_id', 'name', 'props', 'client_at', 'platform', 'app_version'], feedback_reports: ['user_id', 'install_id', 'kind', 'message', 'context', 'app_version', 'platform', 'status', 'admin_note'], audit_log: ['actor_id', 'actor_email', 'actor_role', 'action', 'target_type', 'target_id', 'details'],
    content_revisions: ['lesson_id', 'content_version', 'snapshot', 'reason', 'changed_by', 'changed_by_email'], admin_roles: ['user_id', 'role', 'email', 'created_by'], saved_words: ['user_id', 'client_id', 'en', 'bn', 'example', 'custom', 'in_review', 'seen', 'seen_correct', 'used', 'used_correct'],
    subscriptions: ['user_id', 'plan_id', 'provider', 'provider_reference', 'status', 'current_period_end', 'started_at', 'is_test'], app_settings: ['key', 'value', 'updated_at'], plans: ['name', 'features', 'play_product_id', 'play_base_plan_id'],
    lessons: ['id', 'course_id', 'title_en', 'level', 'sequence_number', 'week', 'learning_objectives', 'prerequisite_lesson_ids', 'estimated_duration_seconds', 'completion_min_score', 'is_assessment', 'content_json', 'content_version', 'published_status'],
    exercises: ['id', 'lesson_id', 'position', 'stage', 'exercise_type', 'content_json', 'answer_rules_json', 'difficulty', 'scored', 'content_version'] };
  Object.entries(WRITES).forEach(([t, cols]) => cols.forEach((c) => assert.ok(tables[t].has(c), `${t}.${c} is written by the server but is not in the database files`)));
});

test('the nightly clean-up touches only columns that exist', () => {
  const body = /function public\.run_retention[\s\S]*?end \$\$;/.exec(sql)[0];
  [['analytics_events', 'at'], ['conversation_turns', 'created_at'], ['conversation_sessions', 'summary'], ['conversation_sessions', 'started_at'], ['webhook_events', 'processed_at'], ['webhook_events', 'created_at'], ['feedback_reports', 'updated_at']].forEach(([t, c]) => { assert.ok(tables[t] && tables[t].has(c), `${t}.${c}`); assert.ok(body.includes(c)); });
});
