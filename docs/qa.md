# Quality assurance (plan section 17)

## Automatic tests (run on every change, and before every release)
`npm test` runs everything below in about a minute. GitHub: Actions > Tests.

| File | What it proves |
| --- | --- |
| `engine.test.mjs` | Lesson engine, scoring, review schedule, mistakes, speech checks |
| `app.test.mjs` | Screens and learner flows |
| `speak.test.mjs` | AI Speak screens and session flow |
| `api.test.mjs`, `billing.test.mjs`, `plans.test.mjs` | Server routes, plans, limits, purchases |
| `i18n.test.mjs` | Every text is in the catalog; no hard-coded text |
| `admin.test.mjs` | Roles, audit log, content edits, restore, import, plans, AI settings, learners, feedback, analytics views |
| `adminui.test.mjs` | The dashboard page against the real API; safe display of text |
| `privacy.test.mjs` | Download my data, delete history and account, saved words, nightly clean-up, voice never stored |
| `phase11.test.mjs` | Usage events, downloaded lessons end to end, saved words sync, privacy screen, help, reminders, error states |
| `main.test.mjs` | Every route draws; a failing screen shows the friendly screen; clicks reach features |
| `a11y.test.mjs` | Accessibility checks, see below |
| `perf.test.mjs` | Size and speed budgets, see below |
| `aieval.test.mjs` | The AI evaluation set, grader, prompt rules and request packing (no AI call) |
| `schema.test.mjs` | Every table, column, filter, sort and function the server code uses exists in the SQL files (the pretend database used elsewhere would accept any name) |
| `docs.test.mjs` | Documents match the code: events, settings, files, no emojis, every test is in `npm test` |
| `security.test.mjs` | Sign-in required on every private route, role check on every admin route, headers, no secrets, row-level security |

### Error states covered
Offline notice on screens, friendly screen if a screen cannot draw, quiet notice for unexpected errors, clear messages for network, sign-in, limit, plan, server and AI failures (`err.*` texts, tested for every code), failed downloads keep the written feedback, failed events are kept and retried, bad downloaded lessons are ignored.

### Accessibility checks (automatic)
Every button and link has a readable name; every field has a label; each screen has one main heading; messages are announced (role alert or status); Bengali text is marked `lang="bn"`; the bottom navigation is named and marks the current page; colour contrast is at least 4.5 : 1 for text and 3 : 1 for focus and progress colours in both light and dark themes; touch targets are at least 44 px; zoom is not blocked; reduced motion and focus outlines are respected; font sizes use rem. The first run found one real problem (the light theme focus colour was too pale, 2.7 : 1); it is fixed.

### Performance budgets (automatic)
Download size after compression: code 130 KB, lessons 60 KB, styles 8 KB, total 200 KB (now about 103 KB). Saved state for four months of daily use under 600 KB. Every main screen draws in under 60 ms with that much history. Server routes answer in under 40 ms (our own code, not the network). The lesson download is under 300 KB.

## AI evaluation set
`evals/coach-cases.json` has 25 learner turns: correct sentences that must NOT be corrected, informal speech that must not be corrected, single errors (tense, agreement, article, preposition, word order) with the expected fix, many errors (one small correction only), unclear speech, Bengali input, prompt injection (3 cases), sensitive data, pronunciation claims, accent claims, off-topic, abuse, medical advice, goal reached, level fit.
- Offline (every `npm test`): checks the set, the grader, that the prompt contains every rule, that learner text cannot break out of its tag, and that bad model output is cleaned.
- Live (before each beta release, after any prompt or model change): GitHub > Actions > AI evaluation > Run workflow. Passing needs 90 percent overall and 100 percent of the safety categories. Run with `runs` = 3 once to see how steady the coach is.
- To add a case from a learner report: copy the sentence and the wrong correction from Feedback into a new case with what a good reply must or must not do.

## Device checks (manual, before every beta build)
Use at least 3 real phones: a low-end Android 8 or 9 phone with 2 GB RAM, a mid-range Android 12 or 13, and a recent one. Include the owner's Galaxy A13.
1. Fresh install, open, finish onboarding. Check the first lesson and sound.
2. Airplane mode: lessons, listening, review, mistakes, saved words work. AI Speak shows the offline notice. Switch back on: the notice goes.
3. Slow network (Developer options or a weak signal): AI Speak shows a working state, then a result or a clear error, never a frozen screen.
4. Microphone: allow, deny, and deny permanently; each gives a clear message. Record 5 seconds, speak, see text.
5. Reminders: choose Morning, allow notifications, set the phone clock to just before 08:00, see the notification, tap it. Choose Off: no notification. Deny permission: the app explains. On Android 12 and newer the notification can arrive a few minutes after the chosen time.
6. Downloaded lessons: edit a lesson in the dashboard, open Check for updates, download, open that lesson. Then airplane mode: still works.
7. Privacy: download my data (in the Android app the data is shown as text and Copy text works; on the website the file downloads), delete speaking history, delete a test account (needs password), clear data on this phone.
8. Rotate the screen, switch to another app and back during a lesson and during AI Speak. Progress stays.
9. Large text (phone Settings > Display > Font size largest) and dark mode: nothing is cut off.
10. TalkBack on (see below). Low storage: app still opens.
11. Purchase with a licensed tester account in Play Console (Internal testing): subscribe, the plan appears, cancel, restore.
12. Update install: install the old build, then the new one over it; progress and sign-in are kept.

### TalkBack check (10 minutes)
Turn on TalkBack. Move through Home, Learn, a lesson, review, AI Speak, Settings, Privacy. Every control is announced with a sensible name, the order makes sense, errors are announced, Bengali text is read with a Bengali voice (install the Google Bengali voice), and nothing needs a gesture without an alternative.

## Bug reports
Use Feedback in the dashboard as the queue. Each bug: what you did, what you expected, what happened, phone model and Android version, app version (Settings shows it). Severity: 1 data loss or cannot learn, 2 feature broken, 3 annoying, 4 cosmetic. Fix 1 and 2 before the next tester build.
