// Security checks (plan sections 15 and 17): every private route needs a sign-in, every admin route checks the role, no secret or inline code ships to the browser,
// the browser security headers are in place, and the nightly job is wired up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as cloud from './helpers/fakeCloud.mjs';

Object.assign(process.env, { SUPABASE_URL: 'https://fake.supabase.test', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', ANTHROPIC_API_KEY: 'k', OPENAI_API_KEY: 'k', OPS_TOKEN: 'ops', CRON_SECRET: 'cron' });
globalThis.fetch = cloud.fetch; console.error = () => {};
const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');
const { default: handler } = await import('../api/v1/[...path].js'); const { resetRateLimits } = await import('../api/_lib/http.js');
const { routes } = await import('../api/_lib/routes.js'); const { adminRoutes, PERMISSIONS, ALL_PERMISSIONS, can } = await import('../api/_lib/admin.js');
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (['node_modules', '.git', 'android'].includes(e.name) ? [] : e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const sample = (re) => re.source.replace(/^\^|\$$/g, '').replace(/\\\//g, '/').replace(/\(\[[^\]]*\]\+\)/g, 'x1').replace(/\(\\d\+\)/g, '1').replace(/\\/g, '');

test('every private route refuses a request with no sign-in, and a bad token', async () => {
  assert.ok(routes.length > 30);
  for (const [method, pattern] of routes) {
    resetRateLimits(); const path = sample(pattern);
    assert.ok(pattern.test(path), `sample path ${path} must match ${pattern}`);
    const a = await cloud.call(handler, method, path, { token: null }); assert.equal(a.code, 401, `${method} ${path} without a token`);
    resetRateLimits(); const b = await cloud.call(handler, method, path, { token: 'not-a-real-token' }); assert.equal(b.code, 401, `${method} ${path} with a bad token`);
  }
});

test('every admin route checks the role before doing anything', () => {
  assert.ok(adminRoutes.length >= 25);
  adminRoutes.forEach(([method, pattern, fn]) => { const src = fn.toString(); assert.ok(/\bneed\(user,|\broleOf\(user\.id\)/.test(src), `${method} ${pattern} does not check the role`); });
  const writes = adminRoutes.filter(([m]) => m !== 'GET'); writes.forEach(([m, p, fn]) => assert.ok(/\baudit\(/.test(fn.toString()), `${m} ${p} changes something but does not write the audit log`));
});

test('roles: nobody but the owner can manage roles, plans or AI settings; permissions only name real things', () => {
  Object.entries(PERMISSIONS).forEach(([role, list]) => list.forEach((p) => assert.ok(p === '*' || ALL_PERMISSIONS.includes(p), `${role}: unknown permission ${p}`)));
  ['roles.manage', 'plans.write', 'ai.write', 'audit.read'].forEach((p) => Object.keys(PERMISSIONS).filter((r) => r !== 'owner').forEach((r) => assert.equal(can(r, p), false, `${r} must not have ${p}`)));
  assert.equal(can('support', 'content.write'), false); assert.equal(can('analyst', 'users.read'), false); assert.equal(can('content_manager', 'users.grant'), false);
});

test('only the sign-in free routes are open, and each has a request limit', () => {
  const src = read('api/_lib/open.js'); const m = [...src.matchAll(/\['(GET|POST)', \/\^([^/]+(?:\\\/[^/]+)*)\$\/, \w+, (\d+)\]/g)];
  assert.ok(m.length >= 5); m.forEach((x) => assert.ok(Number(x[3]) <= 60, `${x[2]} has a limit of ${x[3]} per minute`));
  const ops = read('api/_lib/ops.js'); assert.match(ops, /ownerAuth\(req, process\.env\.CRON_SECRET, process\.env\.OPS_TOKEN\)/); assert.match(ops, /ownerAuth\(req, process\.env\.OPS_TOKEN\)/);
});

test('the browser gets strict security headers, with no inline or outside scripts allowed', () => {
  const v = JSON.parse(read('vercel.json')); const all = Object.fromEntries(v.headers.find((h) => h.source === '/(.*)').headers.map((h) => [h.key, h.value]));
  const csp = all['Content-Security-Policy']; assert.ok(csp, 'a Content-Security-Policy is set');
  const dir = (n) => (csp.split(';').map((x) => x.trim()).find((x) => x.startsWith(n + ' ')) || '');
  assert.equal(dir('script-src'), "script-src 'self'", 'scripts only from this site: no inline code, no eval, no other sites');
  assert.match(dir('object-src'), /'none'/); assert.match(dir('frame-ancestors'), /'none'/); assert.match(dir('base-uri'), /'self'/); assert.match(dir('connect-src'), /https:\/\/\*\.supabase\.co/); assert.match(dir('default-src'), /^default-src 'self'$/);
  assert.match(all['Strict-Transport-Security'], /max-age=\d{7,}/); assert.equal(all['X-Content-Type-Options'], 'nosniff'); assert.equal(all['X-Frame-Options'], 'DENY'); assert.equal(all['Referrer-Policy'], 'no-referrer'); assert.match(all['Permissions-Policy'], /microphone=\(self\)/);
  const admin = v.headers.find((h) => h.source === '/admin/(.*)').headers.map((h) => h.key); assert.ok(admin.includes('Cache-Control') && admin.includes('X-Robots-Tag'));
  assert.ok(v.headers.find((h) => h.source === '/api/(.*)').headers.some((h) => h.key === 'Cache-Control' && h.value === 'no-store'));
});

test('no page has inline script or inline event handlers, so the strict policy can never break it', () => {
  ['www/index.html', 'www/admin/index.html'].forEach((f) => { const h = read(f); assert.doesNotMatch(h, /<script(?![^>]*\bsrc=)[^>]*>/i, `${f}: inline script`); assert.doesNotMatch(h, /\son[a-z]+\s*=/i, `${f}: inline handler`); assert.doesNotMatch(h, /https?:\/\/(?!www\.w3\.org)/, `${f}: loads from another site`); });
  walk(join(root, 'www')).filter((f) => f.endsWith('.js')).forEach((f) => { const s = readFileSync(f, 'utf8'); assert.doesNotMatch(s, /\beval\s*\(|new Function\s*\(/, f); assert.doesNotMatch(s, /\son(click|change|input|submit)=["']/i, `${f}: inline handler in markup`); });
});

test('the nightly job is scheduled, points at a real route, and the secret names match the docs', () => {
  const v = JSON.parse(read('vercel.json')); assert.equal(v.crons.length, 1); assert.equal(v.crons[0].path, '/api/v1/ops/maintenance'); assert.match(v.crons[0].schedule, /^\d+ \d+ \* \* \*$/);
  assert.match(read('docs/admin.md'), /CRON_SECRET/); assert.match(read('docs/runbook.md'), /CRON_SECRET/);
});

test('no secret is in the code that ships, and keys are read only on the server', () => {
  const files = walk(root).filter((f) => /\.(js|mjs|html|json|yml|md|sql)$/.test(f) && !f.includes('package-lock'));
  files.forEach((f) => { const s = readFileSync(f, 'utf8'); assert.doesNotMatch(s, /sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{30,}|eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}/, `${f}: looks like a real key`); });
  walk(join(root, 'www')).filter((f) => f.endsWith('.js')).forEach((f) => assert.doesNotMatch(readFileSync(f, 'utf8'), /SERVICE_ROLE|ANTHROPIC_API_KEY|GROQ_API_KEY|OPS_TOKEN|CRON_SECRET|OPENAI_API_KEY/, `${f}: server secret named in browser code`));
  assert.equal(existsSync(join(root, '.env')), false); assert.match(read('.gitignore'), /\.env/);
});

test('the database tables for private data have row-level security and nothing is open to the public', () => {
  const sql = ['0001_schema', '0002_rls', '0004_speaking', '0005_study', '0006_billing', '0007_admin', '0008_privacy'].map((f) => read(`supabase/migrations/${f}.sql`)).join('\n');
  const tables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);
  const open = new Set(['courses', 'lessons', 'exercises', 'plans']); // public learning content
  tables.filter((t) => !open.has(t)).forEach((t) => assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`), `${t} has no row-level security`));
  ['admin_roles', 'audit_log', 'analytics_events', 'content_revisions', 'feedback_reports'].forEach((t) => assert.doesNotMatch(sql, new RegExp(`grant [a-z, ]+ on public\\.${t} to (anon|authenticated)`), `${t} must not be readable from the app`));
  assert.doesNotMatch(sql, /to anon[^;]*(insert|update|delete)/i);
});
