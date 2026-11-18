# Backend setup and API (Phase 6)

Identity: Supabase Auth. `public.profiles.id` equals `auth.users.id` (a database trigger creates the profile when someone signs up).
The app keeps working offline as a guest. An account adds backup and use on more than one phone.

## One-time setup (works from a phone)
1. Create a project at supabase.com. In Project Settings > API copy: Project URL, `anon` key, `service_role` key.
2. In the SQL Editor run, in this order: `supabase/migrations/0001_schema.sql`, `supabase/migrations/0002_rls.sql`, `supabase/seed/0003_content.sql`.
3. Supabase Authentication > URL Configuration: set Site URL to your Vercel address. Decide if email confirmation is on (the app handles both).
4. In Vercel > Project Settings > Environment Variables add: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Optional: `ALLOWED_ORIGINS` (comma separated). Redeploy.
5. Android app: set `API_BASE` in `www/src/runtime-config.js` to your Vercel address, then build the APK.
6. Check `https://YOUR-APP.vercel.app/api/v1/health`. It should return status ok.

Never put the `service_role` key in app code or in the repository. It is only read by the server (`api/`).

## Endpoints (all private ones need `Authorization: Bearer <token>`)
| Method and path | Purpose |
| --- | --- |
| GET /api/v1/health | Health check, no sign-in |
| GET /api/v1/public-config | Supabase URL and public anon key for sign-in |
| GET, PATCH /api/v1/me | Profile (DELETE moved, see the table below: it now needs a confirmation) |
| PATCH /api/v1/me/preferences | Accent, speed, Bengali support, reminder, goal, comfort, onboarded |
| GET /api/v1/me/learning-plan | Weeks, lessons and next lesson for the learner |
| GET, PUT /api/v1/me/progress | Lesson progress (PUT takes up to 100 lessons; completed never goes back) |
| GET /api/v1/courses, /courses/:id | Published courses and their lessons |
| GET /api/v1/lessons/:id, /lessons/:id/exercises | Lesson content; exercises never include answers |
| POST /api/v1/exercises/:id/attempts | Server checks the answer. Needs an `Idempotency-Key` header (8 to 80 letters, digits, - or _); a retry returns the same result |

Later phases: speaking (Phase 7), listening and review queue (Phase 8), entitlements and usage (Phase 9).

## Phase 8 additions (mistakes, review, progress)
Run `supabase/migrations/0005_study.sql` after 0004 (safe to run again). It adds columns to `mistake_records` and `review_queue`, and two tables: `listening_progress` and `daily_activity`. No new environment variables.

| Method and path | Purpose |
| --- | --- |
| GET /api/v1/me/study | Mistakes, the mistake review schedule, listening results and the last 120 days of the practice log |
| PUT /api/v1/me/study | Send the same four lists plus skill snapshots. The server checks every field, merges with what the account already has, and saves. It never removes data, so two phones cannot overwrite each other |

Limits per save: 200 mistakes, 300 review items, 80 listening items, 120 days, 10 skill snapshots. Only review items for mistakes are stored. Saved words stay on the phone for now.
The app copies this data during sync. If 0005 has not been run, lessons and settings still sync, and the Account screen says that mistakes and review could not be saved yet.
`skill_assessments` gets at most one snapshot per skill every 20 hours, marked `phone-reported` in `evidence_json`. These numbers come from the learner's own practice on the phone, not from server-checked answers.

## Phase 9 additions (plans, purchases, limits)
Run `supabase/migrations/0006_billing.sql` after 0005. Setup steps, variables, budgets and monitoring are in `docs/billing-and-limits.md`.

| Method and path | Sign-in | Purpose |
| --- | --- | --- |
| GET /api/v1/plans | no | Plans with limits and Google Play product ids |
| GET /api/v1/me/entitlements | yes | The learner's plan, today's usage against the limits, reset time, billing reference |
| POST /api/v1/billing/google/verify | yes | Check one purchase token with Google and save it (10 per minute) |
| POST /api/v1/billing/google/restore | yes | The same for up to 10 tokens |
| POST /api/v1/billing/google/webhook?secret=... | secret | Google Play notifications through Pub/Sub |
| GET /api/v1/ops/summary | OPS_TOKEN | Usage, estimated cost, subscriptions and warnings for the owner |
| GET /api/v1/ops/health | OPS_TOKEN | Deep check: database, nightly clean-up, keys, prices (Phase 11) |
| GET /api/v1/ops/maintenance | CRON_SECRET or OPS_TOKEN | Nightly retention clean-up, called by Vercel Cron (Phase 11) |
| POST /api/v1/events | none (optional sign-in) | Usage events, fixed names and values only, 50 per request (Phase 10) |
| POST /api/v1/feedback | none (optional sign-in) | Problem reports and reported AI corrections (Phase 11) |
| GET /api/v1/content/manifest, GET /api/v1/content/lessons?ids= | none | Published lessons for Downloaded lessons (Phase 11) |
| GET /api/v1/privacy-policy | none | Retention days for the Privacy screen (Phase 11) |
| GET /api/v1/me/export | sign-in | Download my data (3 an hour) |
| DELETE /api/v1/me/speaking-history | sign-in | Delete speaking history |
| GET, PUT /api/v1/me/words | sign-in | Saved words sync |
| DELETE /api/v1/me | sign-in + body {"confirm":"DELETE"} | Delete account (Phase 11 added the confirmation) |
| /api/v1/admin/* | sign-in + admin role | Admin dashboard, see docs/admin.md (Phase 10) |

New error codes: `plan_required` (403, the speaking mode is not in the plan; details name the mode) and `billing_unavailable` (503). `quota_exceeded` (429) now says what ran out in `details.what` (`ai_turns` or `stt_seconds`) with `used`, `limit` and `resets_at`.

## Error format and codes
`{ "error": { "code": "...", "message": "..." } }`
Codes: `unauthenticated` 401, `forbidden` 403, `not_found` 404, `method_not_allowed` 405, `conflict` 409, `invalid_input` 400, `rate_limited` 429, `upstream_error` 502, `server_error` 500.

## Security notes
- Row-level security is on for every table. The app token can read only its own rows; answer rules, attempts, sessions, subscriptions and usage are written only by the server.
- Input is validated on every endpoint. Upstream calls time out after 8 seconds.
- The built-in rate limiter is per server instance (best effort). Add Vercel Firewall rate limits before launch.
- Backups: turn on Supabase backups and test a restore into a new project before launch (Phase 11).

## Phase 7 additions (AI speaking)
Run `supabase/migrations/0004_speaking.sql` after the earlier files. Add these Vercel environment variables:
- `GROQ_API_KEY` for the AI coach and for voice to text (one key for both; steps in `docs/groq-setup.md`). Optional: `GROQ_MODEL` (default `openai/gpt-oss-120b`) and `STT_MODEL` (default `whisper-large-v3-turbo`). If the key is missing the coach is unavailable; typing practice that does not need AI keeps working.
- Older alternative: when `GROQ_API_KEY` is not set, `ANTHROPIC_API_KEY` (coach, optional `ANTHROPIC_MODEL`, default `claude-haiku-5-5`) and `OPENAI_API_KEY` (voice to text, `STT_MODEL` default `whisper-1`) are used. `GROQ_API_KEY` wins when set.
- Plan limits come from the `plans` table since Phase 9. `AI_TURNS_PER_DAY`, if set, is a ceiling for every plan. All Phase 9 variables are in `docs/billing-and-limits.md`.

| Method and path | Purpose |
| --- | --- |
| POST /api/v1/speaking/sessions | Start a session (mode and scenario_id); an older active session is closed |
| POST /api/v1/speaking/sessions/:id/turns | One turn: text or audio, plus Idempotency-Key. kind is reply, repeat or retry |
| POST /api/v1/speaking/sessions/:id/end | End the session and get the summary |
| GET /api/v1/speaking/sessions/:id/summary | Read the summary of an ended session |

New error codes: `quota_exceeded` 429, `ai_unavailable` 503, `stt_unavailable` 503.
