# Running the app: monitoring, backups, firewall, problems (Phase 11)

## Every day (2 minutes)
Open `/admin/` > Overview. Everything should say OK. A line that says ATTENTION tells you what to fix. Check the Feedback tab for new reports.

## Alerts you can set up without code
- **Vercel**: Project > Settings > Notifications: turn on failed deployments and function error alerts. Project > Logs: filter by "error" to see server errors. Server errors are logged as one line of JSON with an `event` name (for example `content_not_served`, `audit_failed`).
- **Supabase**: Project Settings > Billing and Usage: turn on usage alerts. Reports > Database: watch size and connections.
- **Uptime**: any free uptime checker pointed at `https://YOUR-SITE.vercel.app/api/v1/health` (public) every 5 minutes.
- **Costs**: Overview shows AI cost. Set budgets in the AI tab. Also set a spending limit in the Anthropic and OpenAI dashboards.

## Firewall rules (Vercel > Project > Firewall, about 5 minutes)
The open routes have their own limits in code, but the code limits work per server instance. Add these Firewall rules as a second layer (rate limit rules, per IP):
| Path | Limit |
| --- | --- |
| `/api/v1/events` | 60 requests per minute |
| `/api/v1/feedback` | 10 requests per 10 minutes |
| `/api/v1/content/*` | 30 per minute |
| `/api/v1/auth/*` and sign-in related | 20 per minute |
| `/api/v1/ops/*` | 10 per minute |
Turn on "Attack Challenge Mode" only during an attack. Log what the rules block for a week before tightening.

## Nightly clean-up
Vercel Cron calls `/api/v1/ops/maintenance` (GET) once a day in the hour after 21:00 UTC, sending `CRON_SECRET` as a Bearer token. Only the production deployment runs it. To run it by hand: open Vercel > Project > Settings > Cron Jobs > Run. If Overview says it has not run: check `CRON_SECRET` is set, redeploy, and check Vercel > Cron Jobs.

## Backups and restore test (do this once before the beta, then every 3 months)
1. Supabase > Database > Backups. Free projects have no automatic backups you can restore. Turn on the paid daily backups before real learners, or use step 2.
2. Manual backup (works on any plan): Supabase > Database > Backups > download, or SQL Editor export of the important tables: `profiles`, `user_lesson_progress`, `mistake_records`, `review_queue`, `saved_words`, `subscriptions`, `plans`, `lessons`, `exercises`, `app_settings`, `admin_roles`. Save the files somewhere other than Supabase.
3. Restore test: create a second, empty Supabase project. Run migrations 0001 to 0008 in order, then `supabase/seed/0003_content.sql`. Import the backup tables. Open the dashboard against it (temporary Vercel preview with the second project's variables) and check: you can sign in, Content shows 31 lessons, Learners finds a test account, a test account shows its progress.
4. Write the date and result at the bottom of this file. A backup that was never restored is not a backup.

## Secrets and keys
- Rotate immediately if leaked: `SUPABASE_SERVICE_ROLE_KEY` (Supabase > API), `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPS_TOKEN`, `CRON_SECRET`, `PLAY_WEBHOOK_SECRET`, Google service account key. Update in Vercel and redeploy.
- No secret is ever in the browser code (a test checks this).
- Only people who need it should have owner. Review Team every month.

## Problems and what to do
| Problem | First steps |
| --- | --- |
| Many learners cannot sign in | Supabase status page; Auth settings; Vercel logs |
| AI Speak says "not available" | Overview: AI key set? budget reached (AI tab)? Anthropic status |
| Costs jump | AI tab: lower the daily budget or switch AI off; Overview shows which usage type grew |
| A lesson is wrong | Content: open it, fix or set to draft, add a reason. Phones update within a day |
| A bad AI correction is reported | Feedback > AI corrections; add the case to `evals/coach-cases.json`; run AI evaluation |
| Someone asks to delete data | They can do it in the app. If they cannot sign in: Learners > find by email > note the id; delete the user in Supabase > Authentication; everything linked is removed. Write the date in your own log |
| Data leak suspected | Rotate keys, check Audit log, tell affected users as the law requires |

## Restore test log
(date, who, result)
