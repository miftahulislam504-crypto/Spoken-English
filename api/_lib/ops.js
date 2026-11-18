// Nightly clean-up and a deeper health check for the owner (plan sections 15 and 19).
import { ApiError } from './http.js';
import { rest } from './supabase.js';
import { bearerIs } from './billing.js';
import { playConfig } from './play.js';
import { pricesConfigured } from './cost.js';

export const RETENTION_DEFAULTS = { analytics: 180, transcript: 90, webhook: 180, feedback: 365 };
const KEYS = { analytics: 'retention_analytics_days', transcript: 'retention_transcript_days', webhook: 'retention_webhook_days', feedback: 'retention_feedback_days' };
// How many days things are kept. Values come from app_settings; a missing or wrong value falls back to the default, so a typo can never keep or delete too much.
export async function retentionDays() {
  let rows = [];
  try { rows = (await rest('GET', 'app_settings?select=key,value', { service: true })) || []; } catch (e) { console.error('retention_settings_failed', e && e.message); }
  const out = {};
  Object.entries(KEYS).forEach(([k, key]) => { const r = rows.find((x) => x.key === key); const n = r ? r.value : undefined; out[k] = Number.isInteger(n) && n >= 7 && n <= 3650 ? n : RETENTION_DEFAULTS[k]; });
  return out;
}
const ownerAuth = (req, ...secrets) => { if (!secrets.some((s) => s)) throw new ApiError(503, 'billing_unavailable'); if (!secrets.some((s) => bearerIs(req, s))) throw new ApiError(401, 'unauthenticated'); };

// Vercel Cron calls this once a day and sends the CRON_SECRET it is given. OPS_TOKEN also works, for running it by hand.
const maintenance = async ({ req }) => {
  ownerAuth(req, process.env.CRON_SECRET, process.env.OPS_TOKEN);
  const d = await retentionDays();
  const removed = await rest('POST', 'rpc/run_retention', { service: true, body: { p_analytics_days: d.analytics, p_transcript_days: d.transcript, p_webhook_days: d.webhook, p_feedback_days: d.feedback } });
  const run = { at: new Date().toISOString(), removed, days: d };
  await rest('POST', 'app_settings?on_conflict=key', { service: true, prefer: 'resolution=merge-duplicates,return=minimal', body: [{ key: 'maintenance_last_run', value: run }] });
  console.log(JSON.stringify({ event: 'maintenance_done', removed }));
  return { ok: true, ...run };
};

export async function healthChecks() {
  const checks = []; const add = (name, ok, detail) => checks.push({ name, ok, detail });
  const t0 = Date.now();
  try { await rest('GET', 'plans?select=id&limit=1', { service: true }); add('database', true, `${Date.now() - t0} ms`); } catch (e) { add('database', false, 'cannot read the database'); }
  let last = null;
  try { const r = await rest('GET', 'app_settings?key=eq.maintenance_last_run&select=value', { service: true }); last = r && r[0] ? r[0].value : null; } catch (e) { /* reported below */ }
  const age = last && last.at ? (Date.now() - Date.parse(last.at)) / 3600000 : null;
  add('nightly clean-up', age !== null && age < 36, age === null ? 'has never run (set CRON_SECRET and redeploy)' : `last run ${Math.round(age)} hours ago`);
  add('AI coach key', !!process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_API_KEY ? 'set' : 'ANTHROPIC_API_KEY is missing');
  add('voice to text key', !!process.env.OPENAI_API_KEY, process.env.OPENAI_API_KEY ? 'set' : 'OPENAI_API_KEY is missing (typing still works)');
  add('Google Play billing', !!playConfig(), playConfig() ? 'set' : 'not configured (everyone is on Free)');
  add('cost prices', pricesConfigured(), pricesConfigured() ? 'set' : 'prices are missing, budgets cannot trigger');
  add('allowed origins', !!process.env.ALLOWED_ORIGINS, process.env.ALLOWED_ORIGINS ? 'set' : 'ALLOWED_ORIGINS is not set (only the app defaults are allowed)');
  return { status: checks.every((c) => c.ok) ? 'ok' : 'attention', checks, last_maintenance: last };
}
const health = async ({ req }) => { ownerAuth(req, process.env.OPS_TOKEN); return healthChecks(); };

export const opsRoutes = [
  ['GET', /^ops\/maintenance$/, maintenance, 10],
  ['GET', /^ops\/health$/, health, 30]
];
