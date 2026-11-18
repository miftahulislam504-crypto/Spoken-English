// Lessons as database rows and back (plan sections 8 and 13). The app's own lesson files and the database hold the same lessons;
// these functions turn one into the other without losing anything, so content edited in the admin dashboard can reach the phones.
import { checkAnswer } from '../../www/src/engine/answers.js';
import { WEEKS } from '../../www/src/content/curriculum-outline.js';

export const EX_TYPES = ['choose', 'listen_choose', 'order', 'type', 'pattern'];
export const STAGES = ['warmup', 'listen', 'learn', 'speak', 'practice', 'review'];
const STEP_TYPES = [...EX_TYPES, 'listen', 'teach', 'repeat', 'review'];
const LEVELS = ['Pre-A1', 'A1', 'A2', 'B1', 'B2', 'Advanced'];
const DIFF = { 'Pre-A1': 1, A1: 2, A2: 3, B1: 4, B2: 4, Advanced: 5 };
const isEx = (t) => EX_TYPES.includes(t);

// A lesson in the app's format -> one lesson row plus one row per exercise.
export function lessonToRows(l) {
  const exercises = []; const skeleton = [];
  l.steps.forEach((s, i) => {
    if (!isEx(s.type)) { skeleton.push({ position: i, ...s }); return; }
    const id = `${l.id}-${i}`;
    skeleton.push({ position: i, exercise_id: id });
    exercises.push({
      id, lesson_id: l.id, position: i, stage: s.stage, exercise_type: s.type,
      content_json: JSON.parse(JSON.stringify({ stage: s.stage, prompt_en: s.prompt_en, hint_bn: s.hint_bn, options: s.options, tiles: s.tiles, audio_en: s.audio_en })),
      answer_rules_json: JSON.parse(JSON.stringify({ answer: s.answer, accept: s.accept, rule: s.rule, example_en: s.example_en })),
      difficulty: DIFF[l.level] || 1, scored: s.scored !== false, content_version: l.content_version
    });
  });
  return {
    lesson: {
      id: l.id, course_id: l.course_id, title_en: l.title_en, level: l.level, sequence_number: l.sequence_number, week: l.week,
      learning_objectives: l.learning_objectives, prerequisite_lesson_ids: l.prerequisite_lesson_ids, estimated_duration_seconds: l.estimated_duration_seconds,
      completion_min_score: l.completion_criteria.min_score, is_assessment: !!l.assessment, content_json: skeleton, content_version: l.content_version, published_status: l.published_status
    },
    exercises
  };
}

// The database rows -> a lesson in the app's format.
export function rowsToLesson(row, exRows) {
  const by = new Map((exRows || []).map((e) => [e.id, e]));
  const steps = (row.content_json || []).slice().sort((a, b) => a.position - b.position).map((sk) => {
    if (sk.exercise_id) {
      const e = by.get(sk.exercise_id); if (!e) return null;
      const c = e.content_json || {}; const r = e.answer_rules_json || {};
      const step = { ...c, ...r, type: e.exercise_type };
      if (e.scored === false) step.scored = false;
      Object.keys(step).forEach((k) => { if (step[k] === undefined || step[k] === null) delete step[k]; });
      return step;
    }
    const { position, ...rest } = sk; return rest;
  });
  const lesson = {
    id: row.id, course_id: row.course_id, week: row.week, title_en: row.title_en, level: row.level, sequence_number: row.sequence_number,
    learning_objectives: row.learning_objectives || [], prerequisite_lesson_ids: row.prerequisite_lesson_ids || [], estimated_duration_seconds: row.estimated_duration_seconds,
    content_version: row.content_version, published_status: row.published_status, completion_criteria: { min_score: Number(row.completion_min_score) }, steps: steps.filter(Boolean)
  };
  if (row.is_assessment) lesson.assessment = true;
  return lesson;
}

// ---- checks ----
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);
// Problems with one exercise step. An empty list means the exercise is safe to show.
export function exerciseProblems(step) {
  const out = []; const t = step.type;
  if (!isEx(t)) return ['unknown exercise type'];
  if (!STAGES.includes(step.stage)) out.push('stage is not valid');
  if (typeof step.prompt_en !== 'string' || !step.prompt_en.trim() || step.prompt_en.length > 300) out.push('prompt is missing or too long');
  if (step.hint_bn !== undefined && (typeof step.hint_bn !== 'string' || step.hint_bn.length > 300)) out.push('Bengali hint is too long');
  if (t === 'choose' || t === 'listen_choose') {
    const o = step.options;
    if (!Array.isArray(o) || o.length < 2 || o.length > 6 || o.some((x) => typeof x !== 'string' || !x.trim() || x.length > 80)) out.push('options must be 2 to 6 short texts');
    else if (new Set(o.map((x) => x.trim().toLowerCase())).size !== o.length) out.push('options repeat');
    else if (!Number.isInteger(step.answer) || step.answer < 0 || step.answer >= o.length) out.push('answer must point to one option');
    if (t === 'listen_choose' && (typeof step.audio_en !== 'string' || !step.audio_en.trim())) out.push('audio text is missing');
  } else if (t === 'order') {
    const tiles = step.tiles; const acc = step.accept;
    if (!Array.isArray(tiles) || tiles.length < 2 || tiles.length > 20 || tiles.some((x) => typeof x !== 'string' || !x.trim())) out.push('tiles must be 2 to 20 words');
    else if (!Array.isArray(acc) || !acc.length || acc.some((x) => typeof x !== 'string')) out.push('accepted answers are missing');
    else {
      const key = (a) => a.map((w) => w.toLowerCase()).sort().join('|');
      if (acc.some((a) => key(words(a).map((w) => w.replace(/[.?!,]+$/, ''))) !== key(tiles.map((w) => w.replace(/[.?!,]+$/, ''))))) out.push('an accepted answer does not use exactly the tiles');
    }
  } else if (t === 'type') {
    if (!Array.isArray(step.accept) || !step.accept.length || step.accept.some((x) => typeof x !== 'string' || !x.trim() || x.length > 300)) out.push('accepted answers are missing');
  } else if (t === 'pattern') {
    const r = step.rule;
    if (!r || typeof r !== 'object' || !Number.isInteger(r.min_words) || r.min_words < 1 || r.min_words > 20) out.push('rule needs min_words');
    else if (r.starts !== undefined && (!Array.isArray(r.starts) || r.starts.some((x) => typeof x !== 'string'))) out.push('rule starts must be a list');
    if (typeof step.example_en !== 'string' || !step.example_en.trim()) out.push('an example answer is required');
  }
  if (!out.length) { // the answers the author accepts must really be accepted by the checker
    try {
      if (t === 'type' || t === 'order') step.accept.forEach((a) => { if (!checkAnswer(step, t === 'order' ? words(a) : a).correct) out.push(`accepted answer "${String(a).slice(0, 30)}" is not accepted by the checker`); });
      if (t === 'pattern' && !checkAnswer(step, step.example_en).correct) out.push('the example answer does not pass its own rule');
    } catch (e) { out.push('the answer rules cannot be checked'); }
  }
  return out;
}

// Problems with a whole lesson (in the app's format) before it can be published. known = ids of other lessons { id: status }.
export function lessonProblems(l, known = {}) {
  const out = [];
  if (!l || typeof l !== 'object') return ['lesson is missing'];
  if (typeof l.id !== 'string' || !/^[A-Za-z0-9_-]{1,30}$/.test(l.id)) out.push('id is not valid');
  if (typeof l.title_en !== 'string' || !l.title_en.trim() || l.title_en.length > 120) out.push('title is missing or too long');
  if (!LEVELS.includes(l.level)) out.push('level is not valid');
  if (!WEEKS.some((w) => w.id === l.week)) out.push('week must be one of ' + WEEKS.map((w) => w.id).join(', '));
  if (!Number.isInteger(l.sequence_number) || l.sequence_number < 1) out.push('sequence number is not valid');
  if (!Array.isArray(l.learning_objectives) || !l.learning_objectives.length || l.learning_objectives.length > 6 || l.learning_objectives.some((x) => typeof x !== 'string' || !x.trim() || x.length > 120)) out.push('1 to 6 short learning objectives are needed');
  if (!Number.isInteger(l.estimated_duration_seconds) || l.estimated_duration_seconds < 60 || l.estimated_duration_seconds > 3600) out.push('duration must be 1 to 60 minutes');
  const min = l.completion_criteria && l.completion_criteria.min_score;
  if (typeof min !== 'number' || min < 0 || min > 1) out.push('completion score must be between 0 and 1');
  if (!Array.isArray(l.prerequisite_lesson_ids) || l.prerequisite_lesson_ids.some((p) => p === l.id || !(p in known))) out.push('a prerequisite is unknown or is the lesson itself');
  if (!Number.isInteger(l.content_version) || l.content_version < 1) out.push('content version is not valid');
  if (!Array.isArray(l.steps) || !l.steps.length || l.steps.length > 60) out.push('1 to 60 steps are needed');
  else {
    l.steps.forEach((s, i) => {
      if (!s || !STEP_TYPES.includes(s.type)) { out.push(`step ${i + 1}: unknown type`); return; }
      if (isEx(s.type)) exerciseProblems(s).forEach((p) => out.push(`step ${i + 1}: ${p}`));
      if (s.type === 'teach' && (!s.grammar_en || !s.pattern_en || !Array.isArray(s.examples_en) || !s.examples_en.length)) out.push(`step ${i + 1}: teaching card is incomplete`);
      if (s.type === 'repeat' && (typeof s.text_en !== 'string' || !s.text_en.trim())) out.push(`step ${i + 1}: text to repeat is missing`);
    });
    if (!l.steps.some((s) => isEx(s.type) && s.scored !== false) && !l.assessment) out.push('at least one scored exercise is needed');
    if (l.steps[l.steps.length - 1].type !== 'review') out.push('the last step must be the review step');
  }
  if (Array.isArray(l.prerequisite_lesson_ids)) { // no loops: following prerequisites must never lead back to this lesson
    const seen = new Set(); const walk = (id) => { if (id === l.id) return true; if (seen.has(id)) return false; seen.add(id); return ((known[id] && known[id].prerequisites) || []).some(walk); };
    if (l.prerequisite_lesson_ids.some((p) => walk(p))) out.push('prerequisites form a loop');
  }
  return out;
}
