// Checks one coach reply against what a case expects. Used by the offline tests and by scripts/eval-coach.mjs.
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);
const lower = (s) => String(s || '').toLowerCase();
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const strip = (s) => lower(s).replace(/[.,!?;:"]/g, '');
export const editRatio = (original, corrected) => { const a = words(strip(original)); const b = words(strip(corrected)); return a.length ? editDistance(a, b) / a.length : 0; };

export function gradeCase(c, reply) {
  const e = c.expect || {}; const fails = []; const f = reply && reply.feedback;
  if (!reply) return { pass: false, failures: ['no valid reply'] };
  const everything = [reply.coach_reply_en, reply.coach_reply_bn, ...(reply.suggested_replies || []), f ? f.corrected_text : '', f ? f.alternative_text : ''].join(' \n ');
  if (!words(reply.coach_reply_en).length) fails.push('empty reply');
  if (/\p{Extended_Pictographic}/u.test(everything)) fails.push('reply contains an emoji');
  const sentences = String(reply.coach_reply_en || '').split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > 3) fails.push(`reply has ${sentences.length} sentences (the coach should use at most 2 short ones)`);
  if ('understood' in e && reply.understood !== e.understood) fails.push(`understood should be ${e.understood}`);
  if ('goal_met' in e && reply.goal_met !== e.goal_met) fails.push(`goal_met should be ${e.goal_met}`);
  if (e.feedback === 'none' && f) fails.push(`no correction was expected but got "${f.corrected_text}"`);
  if (e.feedback === 'required') {
    if (!f) fails.push('a correction was expected');
    else {
      if (e.error_types && !e.error_types.includes(f.error_type)) fails.push(`error type ${f.error_type} is not one of ${e.error_types.join(', ')}`);
      (e.corrected_contains || []).forEach((x) => { if (!lower(f.corrected_text).includes(lower(x))) fails.push(`correction should contain "${x}"`); });
      if (e.max_edit_ratio !== undefined && editRatio(f.original_text, f.corrected_text) > e.max_edit_ratio) fails.push('the correction changes too much of the sentence');
    }
  }
  if (e.reply_max_words !== undefined && words(reply.coach_reply_en).length > e.reply_max_words) fails.push(`reply is longer than ${e.reply_max_words} words`);
  if (e.reply_max_sentence_words !== undefined && sentences.some((s) => words(s).length > e.reply_max_sentence_words)) fails.push(`a sentence is longer than ${e.reply_max_sentence_words} words`);
  (e.reply_must_not_match || []).forEach((p) => { if (new RegExp(p, 'i').test(everything)) fails.push(`reply must not match /${p}/`); });
  if (e.reply_must_match_any && !e.reply_must_match_any.some((p) => new RegExp(p, 'i').test(reply.coach_reply_en))) fails.push(`reply should mention one of: ${e.reply_must_match_any.join(', ')}`);
  (e.must_not_echo || []).forEach((x) => { if (lower(everything).includes(lower(x))) fails.push(`reply must not repeat "${x}"`); });
  return { pass: !fails.length, failures: fails };
}
