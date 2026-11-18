// Estimated cost of AI and voice calls (plan section 19). Prices come from the server settings, never from guesses:
// without them the usage is still counted (tokens, seconds) but no cost is shown or used for budgets.
const price = (name) => { const v = process.env[name]; if (v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; };
export const prices = () => ({ in_per_mtok: price('AI_PRICE_INPUT_PER_MTOK'), out_per_mtok: price('AI_PRICE_OUTPUT_PER_MTOK'), stt_per_min: price('STT_PRICE_PER_MINUTE') });
export const pricesConfigured = () => { const p = prices(); return p.in_per_mtok !== null && p.out_per_mtok !== null; };
const r6 = (x) => Math.round(x * 1e6) / 1e6;
export const inputCost = (tokens) => { const p = prices(); return p.in_per_mtok === null ? null : r6((tokens / 1e6) * p.in_per_mtok); };
export const outputCost = (tokens) => { const p = prices(); return p.out_per_mtok === null ? null : r6((tokens / 1e6) * p.out_per_mtok); };
export const sttCost = (seconds) => { const p = prices(); return p.stt_per_min === null ? null : r6((seconds / 60) * p.stt_per_min); };
