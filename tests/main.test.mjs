// The app's start-up file: every route draws, a screen that fails shows the friendly error screen, and clicks reach the right feature.
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map([['se.state.v1', JSON.stringify({ onboarded: true, ob_step: 'done', level: 'A1' })]]);
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const win = {}; const app = { innerHTML: '', handlers: {}, addEventListener(n, f) { this.handlers[n] = f; } };
globalThis.window = { scrollY: 0, scrollTo() {}, addEventListener: (n, f) => { (win[n] = win[n] || []).push(f); } };
globalThis.document = { title: '', getElementById: () => app, addEventListener() {}, visibilityState: 'visible' };
globalThis.location = { hash: '', reload() {} }; globalThis.confirm = () => true;
globalThis.fetch = async () => { throw new TypeError('offline'); };
console.warn = () => {}; const errs = []; console.error = (...a) => errs.push(a.join(' '));

await import('../www/src/main.js');
const { getState, setState } = await import('../www/src/store.js');
const go = (hash) => { location.hash = hash; (win.hashchange || []).forEach((f) => f()); return app.innerHTML; };
const click = (dataset, extra = {}) => { const el = { dataset, disabled: false, ...extra }; app.handlers.click({ target: { closest: (sel) => (sel === '[data-act]' ? el : null) } }); return el; };

test('every route draws inside the app frame with the bottom navigation', () => {
  ['#/home', '#/learn', '#/speak', '#/listening', '#/progress', '#/settings', '#/review', '#/mistakes', '#/vocabulary', '#/phrasebook', '#/account', '#/plans', '#/weekly', '#/privacy', '#/downloads', '#/help'].forEach((h) => {
    const html = go(h); assert.match(html, /<main>/, h); assert.match(html, /class="tabs"/, h); assert.match(html, /<h1/, h); assert.doesNotMatch(html, /undefined|\[object/, h);
  });
  assert.equal(errs.filter((e) => /Screen failed/.test(e)).length, 0);
});

test('Settings links to the new screens and shows the app version', () => {
  const html = go('#/settings'); ['#/privacy', '#/downloads', '#/help'].forEach((h) => assert.match(html, new RegExp(`href="${h}"`))); assert.match(html, /App version 0\.2\.0/);
  assert.match(go('#/privacy'), /Privacy and data controls/); assert.match(go('#/downloads'), /Downloaded lessons/); assert.match(go('#/help'), /Help and feedback/);
});

test('going offline shows a notice on screens that need the internet, and coming back removes it', () => {
  go('#/home'); win.offline.forEach((f) => f()); assert.match(app.innerHTML, /You are offline/); win.online.forEach((f) => f()); assert.doesNotMatch(app.innerHTML, /You are offline/);
});

test('clicks reach the privacy, help, downloads and error features', () => {
  go('#/privacy'); click({ act: 'pv-stats', value: 'off' }); assert.equal(getState().analytics, 'off'); assert.match(app.innerHTML, /aria-pressed="true">Do not share/); click({ act: 'pv-stats', value: 'on' }); assert.equal(getState().analytics, 'on');
  go('#/help'); click({ act: 'hp-kind', value: 'idea' }); assert.match(app.innerHTML, /aria-pressed="true">An idea/);
});

test('a screen that fails to draw shows the friendly screen instead of a blank page, and the app recovers', () => {
  go('#/home'); setState({ lesson_progress: null }); const html = app.innerHTML;
  assert.match(html, /This screen could not open/); assert.match(html, /data-act="er-reload"/); assert.ok(errs.some((e) => /Screen failed/.test(e)));
  setState({ lesson_progress: {} }); assert.match(go('#/home'), /class="tabs"/, 'it draws normally again');
});

test('an unexpected error shows a quiet notice that can be dismissed, and the screen stays usable', () => {
  go('#/home'); (win.error || []).forEach((f) => f()); assert.match(app.innerHTML, /Something went wrong in the background/); assert.match(app.innerHTML, /class="tabs"/);
  click({ act: 'er-dismiss' }); assert.doesNotMatch(app.innerHTML, /Something went wrong in the background/);
});
