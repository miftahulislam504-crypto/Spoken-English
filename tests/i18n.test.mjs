// Every UI string used in the code exists in the English catalog (plan section 4: no hardcoded or missing UI text).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const warnings = [];
console.warn = (...a) => warnings.push(a.join(' '));
const { t } = await import('../www/src/i18n/index.js');
const has = (k) => { warnings.length = 0; t(k); return warnings.length === 0; };

function files(dir) { return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? (f === 'i18n' || f === 'content' ? [] : files(p)) : p.endsWith('.js') ? [p] : []; }); }

test('every literal t(\'key\') in the code has a string', () => {
  const missing = [];
  files('www/src').forEach((f) => { const src = readFileSync(f, 'utf8'); for (const m of src.matchAll(/\bt\('([A-Za-z0-9_.-]+)'(?!\s*\+)/g)) if (!has(m[1])) missing.push(`${f}: ${m[1]}`); });
  assert.deepEqual(missing, []);
});

test('keys built from a prefix exist for every possible value', () => {
  const ERR = ['verb_tense', 'subject_verb_agreement', 'word_order', 'article', 'preposition', 'vocabulary', 'pluralization', 'pronoun', 'spelling_or_unclear', 'other'];
  const keys = [
    ...[...ERR, 'listening', 'sentence', 'grammar', 'speaking'].map((k) => 'cat.' + k),
    ...['listening', 'vocabulary', 'sentence', 'grammar'].flatMap((k) => ['pg.skill.' + k, 'pg.skill.' + k + '.short']),
    ...['unknown', 'needs', 'developing', 'strong'].map((k) => 'pg.status.' + k), ...['none', 'low', 'medium', 'high'].map((k) => 'pg.conf.' + k),
    ...['none', 'low', 'medium'].map((k) => 'pg.conf.speak.' + k), ...['better', 'worse', 'steady'].map((k) => 'pg.trend.' + k),
    'pg.weeks.w1w2', 'pg.weeks.w3w4', 'rv.type.mistake', 'rv.type.vocab', 'rv.due.now', 'rv.due.today', 'rv.due.tomorrow', 'mn.by.review', 'mn.by.learner',
    ...['Pre-A1', 'A1', 'A2', 'B1', 'B2', 'Advanced'].map((k) => 'level.' + k),
    ...['review', 'weak', 'check', 'lesson', 'speak', 'listen', 'vocab', 'support', 'done'].flatMap((k) => ['rec.' + k + '.title', 'rec.' + k + '.reason']),
    ...['ai_turns', 'stt_seconds'].map((k) => 'err.quota_exceeded.' + k), 'err.plan_required', 'err.billing_unavailable', 'err.quota_exceeded',
    'rec.review.title1', 'rec.lesson.first', 'rec.lesson.reasonFirst', 'rec.speak.reasonFirst', 'rec.listen.reasonFirst'
  ];
  // titles/reasons that are built a different way are allowed to be absent only where the code never asks for them
  const skip = new Set(['rec.lesson.title.x']);
  const missing = keys.filter((k) => !skip.has(k) && !has(k));
  assert.deepEqual(missing, []);
});
