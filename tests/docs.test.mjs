// The documents and the code must say the same thing: every usage event, every server setting and every document the other documents point to.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { EVENTS } from '../www/src/engine/events.js';

const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (['node_modules', '.git', 'android'].includes(e.name) ? [] : e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const all = walk(root);
const docs = readdirSync(join(root, 'docs')).filter((f) => f.endsWith('.md')).map((f) => 'docs/' + f);
const docText = [...docs, 'README.md', 'progress.md'].map(read).join('\n');

test('every usage event is documented, and nothing is documented that does not exist', () => {
  const doc = read('docs/analytics-events.md');
  Object.keys(EVENTS).forEach((n) => assert.ok(doc.includes('`' + n + '`'), `${n} is missing from docs/analytics-events.md`));
  [...doc.matchAll(/^\| `([a-z_]+)` \|/gm)].forEach((m) => assert.ok(EVENTS[m[1]], `${m[1]} is documented but does not exist`));
});

test('every server setting the code reads is described somewhere in the documents', () => {
  const names = new Set(); all.filter((f) => /\/api\/.*\.js$/.test(f)).forEach((f) => [...readFileSync(f, 'utf8').matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)].forEach((m) => names.add(m[1])));
  assert.ok(names.size >= 15);
  names.forEach((n) => assert.ok(docText.includes(n), `${n} is read by the server but not described in any document`));
});

test('every database file is named in the setup guide, and every file named in the documents exists', () => {
  readdirSync(join(root, 'supabase/migrations')).forEach((f) => assert.ok(docText.includes(f) || docText.includes(f.replace('.sql', '')), `${f} is not mentioned in any document`));
  const missing = [];
  docs.concat(['README.md', 'progress.md']).forEach((d) => [...read(d).matchAll(/`((?:docs|supabase|evals|scripts|\.github|www|api|tests)\/[A-Za-z0-9_./\[\]-]+\.[a-z]+)`/g)].forEach((m) => { if (!/YOUR|\*/.test(m[1]) && !existsSync(join(root, m[1]))) missing.push(`${d}: ${m[1]}`); }));
  assert.deepEqual(missing, []);
});

test('no emojis anywhere in the project (a rule from the start)', () => {
  const bad = []; all.filter((f) => /\.(js|mjs|html|css|md|json|sql|yml|webmanifest)$/.test(f)).forEach((f) => { if (/\p{Extended_Pictographic}/u.test(readFileSync(f, 'utf8'))) bad.push(f.replace(root, '')); });
  assert.deepEqual(bad, []);
});

test('every test file is part of npm test', () => {
  const script = JSON.parse(read('package.json')).scripts.test;
  readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.test.mjs')).forEach((f) => assert.ok(script.includes('tests/' + f), `${f} is not run by npm test`));
});

test('the version in the app, the package and Help all agree', () => {
  const v = JSON.parse(read('package.json')).version; assert.match(read('www/src/config.js'), new RegExp(`APP_VERSION = '${v.replace(/\./g, '\\.')}'`));
});
