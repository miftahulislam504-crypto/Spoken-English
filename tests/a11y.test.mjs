// Accessibility checks (plan section 17): every screen is drawn for a learner and checked for names on controls, labels on fields,
// headings, language marks for Bengali, colour contrast in the app theme, touch target sizes, zoom, motion and focus.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
globalThis.window = { scrollY: 0, addEventListener() {} }; globalThis.document = { getElementById: () => null, addEventListener() {} }; globalThis.location = { hash: '' };
console.warn = () => {};
const css = readFileSync(new URL('../www/src/styles.css', import.meta.url), 'utf8');
const index = readFileSync(new URL('../www/index.html', import.meta.url), 'utf8');
const { setState, getState } = await import('../www/src/store.js');
const screens0 = await import('../www/src/screens.js'); const { vocabulary, phrasebook } = await import('../www/src/vocabulary.js'); const { listening } = await import('../www/src/listening.js');
const { account } = await import('../www/src/account.js'); const { speak, speakPick } = await import('../www/src/speak.js'); const { review, mistakes } = await import('../www/src/review.js');
const { progress, weekly } = await import('../www/src/progress.js'); const { plans } = await import('../www/src/billing.js'); const { privacy } = await import('../www/src/privacy.js');
const { help } = await import('../www/src/help.js'); const { downloads } = await import('../www/src/downloads.js'); const { renderOnboarding } = await import('../www/src/onboarding.js');
const { lessonView, startRun } = await import('../www/src/lessonPlayer.js'); const { errorScreen } = await import('../www/src/errors.js');
const S = { ...screens0, vocabulary, phrasebook, listening, account, speak, speakPick, review, mistakes, progress, weekly, plans, privacy, help, downloads };

setState({ onboarded: true, ob_step: 'done', level: 'A1', phrasebook: [{ id: 'tea', en: 'tea', bn: 'চা', example: 'I like tea.', source: 'lesson', in_review: true, recognition: { seen: 1, correct: 1 }, active: { used: 0, correct: 0 }, saved_at: 1 }] });
const names = ['home', 'learn', 'speak', 'listening', 'progress', 'settings', 'grammar', 'patterns', 'bookmarks', 'vocabulary', 'phrasebook', 'review', 'mistakes', 'account', 'plans', 'weekly', 'privacy', 'help', 'downloads'].filter((n) => S[n]);
const pages = names.map((n) => [n, S[n](getState())]);
startRun('l1'); pages.push(['lesson player', lessonView(getState(), 'l1')]);
pages.push(['error screen', errorScreen()]);
pages.push(['onboarding welcome', renderOnboarding({ ...getState(), onboarded: false, ob_step: 'welcome' })]);
const text = (h) => h.replace(/<[^>]*>/g, '').replace(/&[a-z#0-9]+;/g, 'x').trim();

test('screens drawn for the check', () => { assert.ok(pages.length >= 20); pages.forEach(([n, h]) => assert.ok(h.length > 50, n)); });

test('every button and link has a name a screen reader can read', () => {
  pages.forEach(([n, h]) => {
    [...h.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g)].forEach((m) => {
      const named = /aria-label="[^"]+"/.test(m[2]) || text(m[3]).length > 0; assert.ok(named, `${n}: unnamed ${m[1]}: ${m[0].slice(0, 90)}`);
      if (m[1] === 'a') assert.match(m[2], /href=/, `${n}: link without href`);
    });
  });
});

test('every field has a label', () => {
  pages.forEach(([n, h]) => [...h.matchAll(/<(input|textarea|select)\b([^>]*)>/g)].forEach((m) => {
    if (/type="(hidden|radio|checkbox)"/.test(m[2])) return;
    assert.ok(/aria-label="[^"]+"|aria-labelledby=/.test(m[2]) || (/id="([^"]+)"/.test(m[2]) && h.includes(`for="${/id="([^"]+)"/.exec(m[2])[1]}"`)), `${n}: field without a label: ${m[0].slice(0, 90)}`);
  }));
});

test('each screen has one main heading, no inline click code, no positive tabindex, no images without text', () => {
  pages.forEach(([n, h]) => {
    if (n === 'onboarding welcome' || n === 'lesson player') assert.ok((h.match(/<h1\b/g) || []).length <= 1, n); else assert.equal((h.match(/<h1\b/g) || []).length, 1, `${n}: needs exactly one h1`);
    assert.doesNotMatch(h, /\bonclick=|\bonchange=/, n); assert.doesNotMatch(h, /tabindex="[1-9]/, n); assert.doesNotMatch(h, /<img\b(?![^>]*\balt=)/, n);
  });
});

test('messages are announced: error and success lines have a live role', () => {
  pages.forEach(([n, h]) => [...h.matchAll(/<p class="[^"]*\bfb\b[^"]*"([^>]*)>/g)].forEach((m) => assert.match(m[1], /role="(alert|status)"/, `${n}: message not announced`)));
});

test('Bengali text is marked as Bengali so screen readers use the right voice', () => {
  const bn = /[\u0980-\u09FF]/; let found = 0;
  pages.forEach(([n, h]) => [...h.matchAll(/<([a-z0-9]+)\b([^>]*)>([^<]*)<\/\1>/g)].forEach((m) => { if (bn.test(m[3])) { found += 1; assert.match(m[2], /lang="bn"/, `${n}: Bengali without lang: ${m[0].slice(0, 80)}`); } }));
  assert.ok(found > 0, 'the check found Bengali text to look at');
});

test('the bottom navigation is named and marks the current page', () => {
  const nav = S.home && pages.length; assert.ok(nav);
  const main = readFileSync(new URL('../www/src/main.js', import.meta.url), 'utf8');
  assert.match(main, /<nav class="tabs" aria-label=/); assert.match(main, /aria-current="page"/); assert.match(main, /<main>/);
});

// ---- colours: WCAG 2.1 contrast ratios for the colour pairs the app really uses, in the app theme ----
const lum = (hex) => { if (hex.length === 4) hex = '#' + [...hex.slice(1)].map((x) => x + x).join(''); const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const tokens = (block) => Object.fromEntries([...block.matchAll(/--([a-z-]+):(#[0-9a-fA-F]{3,6})\b/g)].map((m) => [m[1], m[2]]));
const light = tokens(/:root\{([^}]*)\}/.exec(css)[1]);
for (const [name, th] of [['light', light]]) {
  test(`colour contrast, ${name} theme: body text, secondary text, links, buttons and badges are readable (4.5 : 1)`, () => {
    const pairs = [['ink', 'bg'], ['ink', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['primary', 'bg'], ['primary', 'surface'], ['on-primary', 'primary'], ['ink', 'soft'], ['muted', 'soft'], ['primary', 'soft']];
    pairs.forEach(([f, b]) => assert.ok(ratio(th[f], th[b]) >= 4.5, `${name}: ${f} on ${b} is ${ratio(th[f], th[b]).toFixed(2)}`));
  });
  test(`colour contrast, ${name} theme: the accent used for the focus ring and progress is visible (3 : 1)`, () => {
    assert.ok(ratio(th.accent, th.bg) >= 3, `${name}: accent on bg is ${ratio(th.accent, th.bg).toFixed(2)}`); assert.ok(ratio(th.accent, th.surface) >= 3, `${name}: accent on surface is ${ratio(th.accent, th.surface).toFixed(2)}`);
  });
}

test('touch targets are at least 44 px high', () => {
  const rule = (sel) => { const m = new RegExp(`(?:^|\\n|\\})\\s*${sel.replace(/[.#]/g, '\\$&')}\\{([^}]*)\\}`).exec(css); return m ? m[1] : ''; };
  const min = (sel) => { const r = rule(sel); const m = /min-height:(\d+)px/.exec(r) || /(?:^|;)height:(\d+)px/.exec(r); return m ? Number(m[1]) : 0; };
  ['.chip', '.btn', '.tab', '.back', '.opt', '.tile', '.row', '.field'].forEach((s) => assert.ok(min(s) >= 44, `${s} is ${min(s)} px`));
  assert.ok(/\.icon-btn\{[^}]*width:44px;height:44px/.test(css)); assert.ok(/summary\{[^}]*min-height:44px/.test(css));
});

test('zoom, motion and keyboard focus are respected', () => {
  assert.match(index, /<html lang="en">/); assert.doesNotMatch(index, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?!\d)/);
  assert.match(css, /prefers-reduced-motion:reduce/); assert.match(css, /:focus-visible\{outline:/); assert.match(css, /color-scheme:light/); assert.doesNotMatch(css, /prefers-color-scheme:dark/, 'the app keeps its white and dark blue look on every phone');
  assert.match(css, /html,body\{[^}]*font:16px/, 'text starts at 16 px and scales with the phone font setting');
  assert.doesNotMatch(css, /font-size:\s*\d+px/, 'font sizes use rem, so they follow the phone font size');
});
