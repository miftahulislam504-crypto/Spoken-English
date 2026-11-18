// Runs the AI Speak evaluation set against the real coach (needs ANTHROPIC_API_KEY). Normally started from GitHub: Actions, "AI evaluation".
// Run: node scripts/eval-coach.mjs [--only category] [--runs 1]
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { coachTurn } from '../api/_lib/ai.js';
import { SCENARIOS, QUESTIONS } from '../www/src/content/speaking.js';
import { gradeCase } from '../evals/grader.mjs';

if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY is not set.'); process.exit(2); }
const set = JSON.parse(readFileSync(new URL('../evals/coach-cases.json', import.meta.url), 'utf8'));
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const only = arg('only', null); const runs = Math.max(1, Number(arg('runs', 1)));
const scenarioOf = (c) => (c.mode === 'answer' ? QUESTIONS.find((q) => q.id === c.question) : c.mode === 'free' ? null : SCENARIOS.find((s) => s.id === c.scenario));
const cases = set.cases.filter((c) => !only || c.category === only);
const results = []; const byCat = {};
for (const c of cases) {
  for (let r = 0; r < runs; r++) {
    let out; let error = null;
    try { out = await coachTurn({ mode: c.mode, scenario: scenarioOf(c), level: c.level, history: c.history || [], utterance: c.utterance, lowConfidence: !!c.low_confidence }); } catch (e) { error = e.message || String(e.code || e); }
    const g = error ? { pass: false, failures: ['the coach call failed: ' + error] } : gradeCase(c, out);
    results.push({ id: c.id, category: c.category, run: r + 1, pass: g.pass, failures: g.failures, reply: out ? out.coach_reply_en : null, feedback: out ? out.feedback : null });
    const x = byCat[c.category] || (byCat[c.category] = { pass: 0, total: 0 }); x.total += 1; if (g.pass) x.pass += 1;
    console.log(`${g.pass ? 'PASS' : 'FAIL'} ${c.id}${g.pass ? '' : ' - ' + g.failures.join('; ')}`);
  }
}
const pass = results.filter((r) => r.pass).length; const rate = results.length ? pass / results.length : 0;
const safetyFail = set.safety_categories.filter((k) => byCat[k] && byCat[k].pass < byCat[k].total);
const ok = rate >= set.pass_rate_required && !safetyFail.length;
const lines = [`## AI evaluation: ${ok ? 'PASSED' : 'FAILED'}`, '', `Overall: ${pass} of ${results.length} (${Math.round(rate * 100)} percent). Needed: ${Math.round(set.pass_rate_required * 100)} percent, and every safety case must pass.`, '', '| Category | Passed | Total |', '|---|---|---|', ...Object.entries(byCat).map(([k, v]) => `| ${k}${set.safety_categories.includes(k) ? ' (safety)' : ''} | ${v.pass} | ${v.total} |`)];
const failed = results.filter((r) => !r.pass); if (failed.length) lines.push('', '### Failures', ...failed.map((r) => `- ${r.id}: ${r.failures.join('; ')}${r.reply ? ` (reply: "${r.reply}")` : ''}`));
console.log('\n' + lines.join('\n'));
writeFileSync(new URL('../evals/last-run.json', import.meta.url), JSON.stringify({ at: new Date().toISOString(), model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5', ok, rate, byCat, results }, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
process.exit(ok ? 0 : 1);
