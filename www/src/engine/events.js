// What the app may report about its own use (plan section 14). Event names and values come from fixed lists and numbers,
// so a name, an answer, a sentence or a voice recording can never be sent. The phone and the server use this same list.
const LEVELS = ['Pre-A1', 'A1', 'A2', 'B1', 'B2', 'Advanced'];
export const MODES = ['guided', 'roleplay', 'free', 'repeat', 'answer', 'review'];
const PLANS = ['free', 'pro', 'advanced'];
export const ERROR_CODES = ['network', 'unauthenticated', 'rate_limited', 'upstream_error', 'server_error', 'quota_exceeded', 'ai_unavailable', 'stt_unavailable', 'plan_required', 'client_error', 'render_error'];
export const FEEDBACK_KINDS = ['bug', 'content_error', 'ai_correction', 'idea', 'other'];
const pct = ['int', 0, 100];

export const EVENTS = {
  app_opened: {},
  onboarding_started: {},
  onboarding_completed: { level: ['enum', LEVELS], placed: ['bool'] },
  signup_completed: {},
  signin_completed: {},
  lesson_started: { lesson_id: ['id'], week: ['enum', ['w1', 'w2', 'w3', 'w4']] },
  lesson_completed: { lesson_id: ['id'], score_pct: pct, first_time: ['bool'] },
  review_session_completed: { items: ['int', 0, 100], correct: ['int', 0, 100] },
  listening_item_completed: { score_pct: pct },
  speaking_session_started: { mode: ['enum', MODES] },
  speaking_session_ended: { mode: ['enum', MODES], turns: ['int', 0, 100], goal_met: ['bool'] },
  paywall_viewed: {},
  purchase_started: { plan: ['enum', PLANS] },
  purchase_completed: { plan: ['enum', PLANS] },
  quota_reached: { what: ['enum', ['ai_turns', 'stt_seconds', 'plan_required']] },
  content_updated: { lessons: ['int', 0, 500] },
  error_shown: { code: ['enum', ERROR_CODES] },
  feedback_sent: { kind: ['enum', FEEDBACK_KINDS] },
  data_exported: {},
  reminder_set: { when: ['enum', ['off', 'morning', 'evening']] }
};

const ok = (rule, x) => {
  if (rule[0] === 'bool') return typeof x === 'boolean';
  if (rule[0] === 'int') return Number.isInteger(x) && x >= rule[1] && x <= rule[2];
  if (rule[0] === 'enum') return rule[1].includes(x);
  if (rule[0] === 'id') return typeof x === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(x);
  return false;
};
// Returns { name, props } with only the known properties, or null when the name is unknown or a value is not allowed.
export function cleanEvent(name, props) {
  const spec = EVENTS[name]; if (!spec) return null;
  const p = props && typeof props === 'object' && !Array.isArray(props) ? props : {};
  const out = {};
  for (const [k, rule] of Object.entries(spec)) { if (!ok(rule, p[k])) return null; out[k] = p[k]; }
  return { name, props: out };
}
export const INSTALL_ID = /^[a-f0-9]{16,64}$/;
