// What the server says the learner's plan and today's usage are. The phone only shows it; the server decides (plan section 12).
import { track } from './analytics.js';
import { api, getSession } from './auth.js';
import { getState, setState } from './store.js';

let lastTry = 0;
export async function refreshEntitlement() {
  lastTry = Date.now();
  if (!getSession()) { if (getState().entitlement) setState({ entitlement: null }); return null; }
  const e = await api('GET', '/me/entitlements');
  setState({ entitlement: { ...e, fetched_at: Date.now() } });
  return e;
}
// Called while a screen is drawn: refreshes at most once a minute, in the background.
export function ensureEntitlement() {
  const e = getState().entitlement;
  if (!getSession() || Date.now() - lastTry < 60000 || (e && Date.now() - e.fetched_at < 60000)) return;
  lastTry = Date.now();
  refreshEntitlement().catch(() => {});
}
export const modeAllowed = (s, mode) => !s.entitlement || s.entitlement.features.speaking_modes.includes(mode);
export const turnsLeft = (s) => (s.entitlement ? Math.max(0, s.entitlement.usage.ai_turns.limit - s.entitlement.usage.ai_turns.used) : null);
export const voiceSecondsLeft = (s) => (s.entitlement ? Math.max(0, Math.round(s.entitlement.usage.stt_seconds.limit - s.entitlement.usage.stt_seconds.used)) : null);
export const noteQuotaError = (e) => {
  if (!e || (e.code !== 'quota_exceeded' && e.code !== 'plan_required')) return;
  track('quota_reached', { what: e.code === 'plan_required' ? 'plan_required' : e.details && e.details.what === 'stt_seconds' ? 'stt_seconds' : 'ai_turns' });
  refreshEntitlement().catch(() => {});
};
