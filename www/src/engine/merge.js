// Merging data from two phones, or from a phone and the account. Used by the app and the server.
const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

export function mergeMistakes(a, b) {
  const map = new Map();
  [...(a || []), ...(b || [])].forEach((m) => {
    const p = map.get(m.id);
    if (!p) return map.set(m.id, { ...m });
    const [newer, older] = num(m.last_at) >= num(p.last_at) ? [m, p] : [p, m];
    const last = Math.max(num(m.last_at), num(p.last_at));
    const res = [p, m].filter((x) => x.resolved_at).sort((x, y) => y.resolved_at - x.resolved_at)[0];
    const resolved = res && res.resolved_at >= last ? res : null;
    map.set(m.id, { ...older, ...newer, count: Math.max(num(p.count), num(m.count)), first_at: [p.first_at, m.first_at].filter((x) => num(x) > 0).reduce((a, b) => Math.min(a, b), Infinity) === Infinity ? last : [p.first_at, m.first_at].filter((x) => num(x) > 0).reduce((a, b) => Math.min(a, b), Infinity), last_at: last, resolved_at: resolved ? resolved.resolved_at : null, resolved_by: resolved ? resolved.resolved_by || null : null });
  });
  return [...map.values()].sort((x, y) => num(y.last_at) - num(x.last_at));
}
const stamp = (x) => num(x.last_at) || num(x.created_at);
export function mergeReview(a, b) {
  const out = { ...(a || {}) };
  Object.values(b || {}).forEach((it) => {
    const p = out[it.id];
    if (!p || stamp(it) > stamp(p) || (stamp(it) === stamp(p) && it.box > p.box)) out[it.id] = it;
  });
  return out;
}
export function mergeDaily(a, b) {
  const out = { ...(a || {}) };
  Object.entries(b || {}).forEach(([k, d]) => {
    const p = out[k];
    if (!p) { out[k] = d; return; }
    const o = { ...p };
    ['sec', 'mis', 'res', 'sp', 'ss', 'ls', 'lc'].forEach((f) => { o[f] = Math.max(num(p[f]), num(d[f])); });
    o.rv = (d.rv || [0, 0])[0] > (p.rv || [0, 0])[0] ? d.rv : p.rv || [0, 0];
    o.ex = { ...(p.ex || {}) };
    Object.entries(d.ex || {}).forEach(([s, v]) => { if (!o.ex[s] || v[0] > o.ex[s][0]) o.ex[s] = v; });
    out[k] = o;
  });
  return out;
}
export function mergeListening(a, b) {
  const out = { ...(a || {}) };
  Object.entries(b || {}).forEach(([id, r]) => {
    const p = out[id];
    if (!p) { out[id] = r; return; }
    const later = num(r.last_at) > num(p.last_at) ? r : p;
    out[id] = { attempts: Math.max(num(p.attempts), num(r.attempts)), best: Math.max(num(p.best), num(r.best)), last_score: later.last_score, last_at: Math.max(num(p.last_at), num(r.last_at)) || null };
  });
  return out;
}
// Saved words (phrasebook). Union by id; the phone's own text and review switch win, the counters only grow (Phase 11).
export function mergeWords(local, remote) {
  const out = new Map((local || []).map((w) => [w.id, w]));
  (remote || []).forEach((r) => {
    const p = out.get(r.id);
    if (!p) { out.set(r.id, r); return; }
    const rec = (x) => ({ seen: Math.max(num(p.recognition && p.recognition.seen), num(x.recognition && x.recognition.seen)), correct: Math.max(num(p.recognition && p.recognition.correct), num(x.recognition && x.recognition.correct)) });
    const act = (x) => ({ used: Math.max(num(p.active && p.active.used), num(x.active && x.active.used)), correct: Math.max(num(p.active && p.active.correct), num(x.active && x.active.correct)) });
    out.set(r.id, { ...r, ...p, recognition: rec(r), active: act(r) });
  });
  return [...out.values()];
}
