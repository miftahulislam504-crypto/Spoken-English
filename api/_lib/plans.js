// Plans and their limits (plan section 12). The numbers below are only starting values: the real ones live in the plans table
// (features column) and can be edited there without a new release. A missing or wrong value falls back to these, so a typo can never give unlimited use.
import { rest } from './supabase.js';

export const MODES = ['guided', 'roleplay', 'free', 'repeat', 'answer', 'review'];
export const PLAN_DEFAULTS = {
  free: { id: 'free', name: 'Free - Starter', rank: 0, features: { ai_turns_per_day: 10, stt_seconds_per_day: 120, speaking_modes: ['guided', 'repeat', 'answer', 'review'] } },
  pro: { id: 'pro', name: 'Pro - Regular practice', rank: 1, features: { ai_turns_per_day: 40, stt_seconds_per_day: 600, speaking_modes: MODES } },
  advanced: { id: 'advanced', name: 'Advanced - Intensive practice', rank: 2, features: { ai_turns_per_day: 100, stt_seconds_per_day: 1500, speaking_modes: MODES } }
};
export function normalizeFeatures(raw, fallback) {
  const f = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const int = (x, d) => (Number.isInteger(x) && x >= 0 && x <= 100000 ? x : d);
  const modes = Array.isArray(f.speaking_modes) ? [...new Set(f.speaking_modes.filter((m) => MODES.includes(m)))] : [];
  return { ai_turns_per_day: int(f.ai_turns_per_day, fallback.ai_turns_per_day), stt_seconds_per_day: int(f.stt_seconds_per_day, fallback.stt_seconds_per_day), speaking_modes: modes.length ? modes : fallback.speaking_modes };
}
export function mergePlans(rows) {
  const out = {};
  Object.values(PLAN_DEFAULTS).forEach((d) => { out[d.id] = { ...d, play_product_id: null, play_base_plan_id: null, sort: d.rank + 1 }; });
  (rows || []).forEach((r) => {
    if (!r || typeof r.id !== 'string') return;
    const d = PLAN_DEFAULTS[r.id] || PLAN_DEFAULTS.free;
    out[r.id] = { id: r.id, name: typeof r.name === 'string' && r.name ? r.name : d.name, rank: Number.isInteger(r.rank) ? r.rank : d.rank, features: normalizeFeatures(r.features, d.features), play_product_id: r.play_product_id || null, play_base_plan_id: r.play_base_plan_id || null, sort: Number.isInteger(r.sort_order) && r.sort_order > 0 ? r.sort_order : (PLAN_DEFAULTS[r.id] ? d.rank + 1 : 99) };
  });
  return out;
}
let cache = null;
export const clearPlanCache = () => { cache = null; };
export async function loadPlans() {
  if (cache && cache.exp > Date.now()) return cache.plans;
  let rows = null;
  try { rows = await rest('GET', 'plans?select=id,name,features,play_product_id,play_base_plan_id,rank,sort_order', { service: true }); } catch (e) { console.error('plans_load_failed', e && e.message); }
  const plans = mergePlans(rows);
  cache = { plans, exp: Date.now() + (rows ? 60000 : 10000) };
  return plans;
}
export const sortedPlans = (plans) => Object.values(plans).sort((a, b) => a.sort - b.sort);
