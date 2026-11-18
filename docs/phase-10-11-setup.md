# Phase 10 and 11: what to do, in order

Everything can be done from a phone browser: GitHub, Vercel and Supabase websites. Do the steps in this order. After each step the app keeps working, so you can stop and continue later.

## 1. Put the files in GitHub
1. In GitHub, open your repository. Upload the contents of `spoken-english-app-phase-11.zip` over the old files (same folder structure). Replace files with the same name.
2. These are NEW files and folders: `api/_lib/admin.js`, `content.js`, `open.js`, `ops.js`, `privacy.js`, `www/admin/`, `www/src/privacy.js`, `help.js`, `downloads.js`, `reminders.js`, `analytics.js`, `errors.js`, `content-pack.js`, `words-sync.js`, `background.js`, `engine/events.js`, `supabase/migrations/0007_admin.sql`, `0008_privacy.sql`, `evals/`, `docs/`, `tests/`, `.github/workflows/release.yml`, `ai-eval.yml`.
3. These existing files CHANGED: `vercel.json`, `package.json`, `.gitignore`, `.github/workflows/android.yml`, `scripts/export-content.mjs`, `api/v1/[...path].js`, `api/_lib/routes.js`, `billing.js`, `supabase.js`, `http.js`, `www/src/main.js`, `screens.js`, `account.js`, `speak.js`, `lessonPlayer.js`, `onboarding.js`, `billing.js`, `entitlement.js`, `store.js`, `config.js`, `sync.js`, `styles.css`, `engine/lessons.js`, `engine/merge.js`, the i18n files.
4. Wait for the green mark on the commit (Actions > Tests). A red mark means a test failed; open it to see which.

## 2. Database (Supabase > SQL Editor)
Run these two files, one after the other, each by pasting the whole file and pressing Run. Both are safe to run again.
1. `supabase/migrations/0007_admin.sql` (admin roles, audit log, usage events, content history, feedback)
2. `supabase/migrations/0008_privacy.sql` (saved words, retention settings, clean-up function)

Do NOT run `supabase/seed/0003_content.sql` again after you start editing lessons in the dashboard. It would overwrite your edits with the lessons that came with the app.

## 3. Make yourself the first owner
1. Open the app (or the website) and sign up or sign in with the email you want to use as admin.
2. Supabase > SQL Editor > run (change the email):
```sql
insert into public.admin_roles (user_id, role, email)
select id, 'owner', email from auth.users where email = 'YOU@EXAMPLE.COM'
on conflict (user_id) do update set role = 'owner';
```
3. It should say "Success. 1 row". If it says 0 rows, that email has no account yet.

## 4. Vercel variables (Project Settings > Environment Variables), then Redeploy
| Variable | Value | Why |
| --- | --- | --- |
| `CRON_SECRET` | a long random text (30 or more letters and digits) | Lets Vercel run the nightly clean-up. Without it the clean-up never runs. |
| `OPS_TOKEN` | already set in Phase 9 | Also works for `/api/v1/ops/health` |
| `GROQ_API_KEY` | your Groq key (`docs/groq-setup.md`) | AI coach and voice to text. No Anthropic or OpenAI key is needed |

Vercel runs the clean-up once a day, sometime in the hour after 21:00 UTC (about 03:00 in Bangladesh; the free plan only promises the hour). It is in `vercel.json` and runs only on the production deployment. Check it worked next day: open `/admin/`, Overview, line "nightly clean-up" should say OK.

## 5. Open the dashboard
Go to `https://YOUR-SITE.vercel.app/admin/` and sign in. Bookmark it. Read `docs/admin.md` once.
- Overview should show a list of checks. Fix any ATTENTION line (they say what is missing).
- Team: add your helpers (they need an account in the app first).

## 6. Check privacy settings and the retention numbers
Supabase > Table Editor > `app_settings`. Four rows were added: `retention_analytics_days` 180, `retention_transcript_days` 90, `retention_webhook_days` 180, `retention_feedback_days` 365. These are my placeholders, because the plan document (sections 15 and 16) was not in the zip. Compare with your plan and change the numbers if needed. Minimum allowed is 7 days.

## 7. Android app
1. GitHub > Actions > Build Android APK > Run workflow. The APK now includes local notifications for reminders. No other change is needed.
2. Install the APK on a real phone and do the checks in `docs/qa.md` (section "Device checks"), especially reminders and offline use.

## 8. AI evaluation (before every beta release)
1. GitHub > Settings > Secrets and variables > Actions > New repository secret: `GROQ_API_KEY` (same key as Vercel; see `docs/groq-setup.md`).
2. Actions > AI evaluation > Run workflow. Open the run, then Summary. It must say PASSED. If a safety case fails, do not release; fix the coach prompt in `api/_lib/ai.js` (or try a stronger `GROQ_MODEL`) and run again.

## 9. Release build for testers
Follow `docs/release.md` (make the upload key once, add 4 secrets, run Release build, upload the .aab to Play Console Internal testing). Then follow `docs/closed-beta.md`.

## 10. Vercel Firewall (5 minutes, no code)
Follow `docs/runbook.md`, section "Firewall rules". This protects the open routes from floods.

## If something does not work
- Sign in to `/admin/` or the app does nothing, and the browser says "Content Security Policy": your Supabase address does not end in `.supabase.co`. Open `vercel.json` and add your Supabase address to `connect-src`.
- Overview says "nightly clean-up has never run": check `CRON_SECRET` is set for Production and redeploy. Vercel runs cron jobs only on the production deployment.
- SQL error when running 0007 or 0008: send me the exact error text. Both files are safe to run again after a fix.
- Reminders do nothing in the browser: they work only in the Android app.

## What changed for learners
- Settings now has Privacy and data controls, Downloaded lessons, Help and feedback.
- Account deletion moved to Privacy and data controls and now asks for the password again.
- Saved words now sync to the account. AI Speak corrections have a Report button.
- Usage statistics can be switched off by the learner (default is on, see `docs/privacy.md`).
