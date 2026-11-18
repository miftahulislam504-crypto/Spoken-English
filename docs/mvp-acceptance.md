# MVP acceptance checklist (plan section 18)

Legend: [x] verified by an automatic test or by reading the code (evidence given), [~] built but only partly verified or with a known gap, [ ] needs you or a real device or Play Console, so it cannot be ticked from here.
The plan's own acceptance list (section 18) was not in the zip, so this list is built from every phase in `progress.md`. Compare it with the plan and add or remove lines.

## Learning
- [x] Four weeks of lessons, 31 lessons, 162 exercises, all pass the publishing checks (`admin.test.mjs`)
- [x] Lesson player: six stages, completion rule, prerequisites, locked lessons, restart when a lesson version changes (`app.test.mjs`)
- [x] Answer checking with several valid answers and punctuation or case ignored (`engine.test.mjs`)
- [x] Listening: 16 items, speeds, accents, replay, transcripts (`app.test.mjs`)
- [x] Vocabulary and phrasebook, saved words sync to the account (`phase11.test.mjs`)
- [x] Mistake notebook, spaced review (10 minutes, then 1, 3, 7, 14, 30 days), recommendations, level changes from evidence (`engine.test.mjs`)
- [x] Progress screens show how many answers are behind every figure (`app.test.mjs`)
- [~] Audio is the phone's built-in voice; quality depends on the voices installed (known, roadmap v1.1)
- [ ] A real beginner finishes onboarding and a first lesson alone (beta, `docs/closed-beta.md`)

## AI Speak
- [x] Six modes, ten scenarios, one correction per turn, Bengali explanation, retry (`speak.test.mjs`, `api.test.mjs`)
- [x] Prompt rules for injection, sensitive data, pronunciation, accent, off-topic, level; learner text cannot leave its tag; model output validated (`aieval.test.mjs`)
- [x] Evaluation set of 25 cases and a grader (`evals/`)
- [ ] Live evaluation PASSED on the release build (GitHub > Actions > AI evaluation)
- [ ] Voice recording works on real phones: allow, deny, deny forever, 30 seconds, poor network (`docs/qa.md` device checks)
- [x] Voice recordings are never stored (`privacy.test.mjs`)

## Accounts, data, sync
- [x] Sign up, sign in, sign out, reset password; guest mode (`app.test.mjs`)
- [x] Progress, preferences, mistakes, review, listening, practice log, saved words sync between phones and never lose data (`api.test.mjs`, `phase11.test.mjs`)
- [x] Download my data, delete speaking history, delete account with password and confirmation word (`privacy.test.mjs`, `phase11.test.mjs`)
- [x] Retention clean-up runs nightly and cannot be tricked by a typo (`privacy.test.mjs`)
- [ ] Deleting a real account in the real Supabase project removes everything (try with a test account, then check the tables)

## Plans and limits
- [x] Plans, daily limits, speaking modes by plan, day reset, ceilings (`plans.test.mjs`)
- [x] Entitlements decided only by the server; purchase ownership; upgrades; webhooks; refunds (`billing.test.mjs`)
- [ ] Real purchase, renewal, cancellation and refund with a License tester on a Play build (`docs/closed-beta.md` exit criteria)
- [x] AI cost recorded; budgets and the AI switch stop AI and nothing else (`billing.test.mjs`, `admin.test.mjs`)

## Admin
- [x] Roles, role checks on every admin route, last owner protected (`admin.test.mjs`, `security.test.mjs`)
- [x] Audit log written first, append-only, covers every change and every look at a learner (`admin.test.mjs`)
- [x] Content: edit, validate, version, restore, import, publish and hide, reach phones (`admin.test.mjs`, `phase11.test.mjs`)
- [x] AI operations, plans, learners, manual plans, feedback queue (`admin.test.mjs`, `adminui.test.mjs`)
- [x] Analytics events with fixed names and values; funnel, retention, daily counts (`admin.test.mjs`)
- [ ] Open the dashboard on your phone against the real project and complete each tab once

## Security and privacy
- [x] Every private route needs sign-in; every admin route checks a role; row-level security on every private table (`security.test.mjs`)
- [x] Strict browser security headers; no inline script; no secret in browser code (`security.test.mjs`)
- [x] Answer rules and keys never returned by admin or learner routes (`admin.test.mjs`)
- [ ] Vercel Firewall rules added (`docs/runbook.md`)
- [ ] Privacy policy published; Play Data safety form filled (`docs/privacy.md`)
- [ ] A person who is not you reviews the privacy policy and the Row Level Security rules (`supabase/migrations/0002_rls.sql`)

## Reliability and quality
- [x] Offline use: lessons, listening, review, mistakes, saved words, downloaded lessons (`phase11.test.mjs`, `main.test.mjs`)
- [x] Error states: offline notice, friendly failure screen, quiet notice, clear messages for every error code (`main.test.mjs`, `phase11.test.mjs`, `app.test.mjs`)
- [x] Accessibility rules checked automatically in both themes (`a11y.test.mjs`)
- [ ] TalkBack check and large text check on a real phone (`docs/qa.md`)
- [x] Size and speed budgets (`perf.test.mjs`)
- [ ] The three-phone device check and the Play build checks (`docs/qa.md`)
- [ ] A backup was restored into a fresh project once (`docs/runbook.md`)
- [x] Reminders: scheduling logic and permission handling (`phase11.test.mjs`)
- [ ] Reminders actually appear on a real phone at the chosen time

## Release
- [x] Release workflow builds and signs a bundle after all tests pass (`.github/workflows/release.yml`)
- [ ] The workflow has run once for real and the bundle was accepted by Play Console (`docs/release.md`)
- [ ] Closed beta: 12 or more testers for 14 days, exit criteria met (`docs/closed-beta.md`)

## Go or no-go
Go to the closed beta when every line in Learning, AI Speak, Accounts and Plans that is [ ] and marked "device" or "live" has been done once. Go to production when the whole list is [x] or has a written reason.
