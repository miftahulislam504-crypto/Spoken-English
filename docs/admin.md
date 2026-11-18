# Admin dashboard (Phase 10)

Address: `https://YOUR-SITE.vercel.app/admin/`. Sign in with your normal app account. The page keeps no secret. The server checks your role in the database on every request, so a copied link or a changed page gives no extra power.

## Roles
| Role | Can |
| --- | --- |
| owner | Everything: roles, plans, AI settings, audit log, content, learners, feedback |
| content_manager | See metrics; edit, publish and restore lessons; handle feedback |
| support | Find learners, give or take back a manual plan (up to 31 days), handle feedback, see plans |
| analyst | See metrics, plans, AI numbers and content; change nothing |

The first owner is added in SQL (`docs/phase-10-11-setup.md`, step 3). After that owners manage the team in the Team tab. There must always be one owner: the last owner cannot be removed, demoted or delete their own account.

## Tabs
- **Overview**: health checks (database, nightly clean-up, keys, prices), warnings, AI cost today and this month, budget state, subscriptions by plan.
- **Analytics**: funnel (different phones that opened the app, finished onboarding, started and finished a lesson, started AI Speak, viewed plans, bought), phones per day, retention (back the next day and after 7 days), learners and practice numbers, lessons started and finished, most missed exercises. Usage numbers come from phones, so they are estimates. They only cover learners who left statistics switched on.
- **Content**: checks for every lesson, list of lessons, lesson page with exercises, status buttons, earlier versions, and "add a new lesson".
- **AI**: model names, key status, budgets, on/off switch, reported AI corrections.
- **Plans**: daily AI turns, voice seconds, speaking modes, Google Play product ids. Changes apply at once.
- **Learners**: find by exact email or account id. You see level, goal, plan, counts and subscriptions. You never see conversation text.
- **Feedback**: reports from the app, with filters. Set a status and a note.
- **Team** (owner), **Audit log** (owner).

## Audit log
Every change is written to the audit log BEFORE it is made, with who, when, what, and the old and new values. The table cannot be edited or deleted (a database rule blocks it). Looking at a learner is also logged. If the audit write fails, the change is not made. A change that fails after its audit entry leaves an entry for an attempt that did not happen.

## Editing lessons safely
1. Open Content, tap a lesson. If it says "passes every check", edit the title, objectives, time, pass score or prerequisites and press Save with a reason. Or open an exercise and edit its JSON.
2. Every edit raises the lesson version by 1, saves the old version, and is checked: options must not repeat, the answer must point to an option, every accepted answer must really be accepted by the checker, tile answers must use exactly the tiles, and so on. A bad edit is refused with the reason.
3. To undo, open "Earlier versions" and press Restore. The version before the restore is kept too.
4. Status: published lessons reach phones; draft and archived lessons are hidden on phones. You cannot hide a lesson that another published lesson needs. You cannot publish a lesson that fails a check or whose prerequisites are not published.
5. How changes reach learners: phones check once a day (and when the learner taps Check for updates on Downloaded lessons), download changed lessons, and switch them on the next time the app starts. A lesson a learner is halfway through restarts from the beginning when its version changes (this is how lessons already worked).
6. You cannot add or remove steps of an existing lesson in the dashboard, only change their content. To change the structure, use "add a new lesson" and retire the old one, or change the lesson file in the app and release an update.

### Add a new lesson
Content > "Add a new lesson". Paste one lesson in the same format as the lesson files in `www/src/content/lessons.js`. It must have: `id` (letters, digits, - and _), `course_id`, `week` (w1 to w4), `title_en`, `level`, `sequence_number`, `learning_objectives`, `prerequisite_lesson_ids`, `estimated_duration_seconds`, `completion_criteria: { min_score }`, and `steps` ending with a `review` step. Copy an existing lesson from the content files and change it. It is saved as a draft with every check applied; open it, read the problems list (if any), and publish.

## What the dashboard does not do (yet)
- It cannot add recorded audio (lessons use the phone voice).
- It cannot change a Google Play subscription (Google controls it). Use Play Console.
- It cannot change lesson order or weeks of existing lessons.
- Content edits live only in the database. The lessons in the app files and in `supabase/seed/0003_content.sql` do not change. When you release a new app version that includes newer lesson files, a downloaded lesson stays in use only while its version is higher than the built-in one.

## Variables
`CRON_SECRET` (nightly clean-up), `OPS_TOKEN` (health and summary without signing in), plus the Phase 9 variables.
