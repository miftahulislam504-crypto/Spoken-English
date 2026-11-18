# Privacy, retention and data controls (Phase 11)

Written to match what the code does today. Anything not true here is a bug; please tell the app team.

## Voice recordings (audio retention)
- A recording is held in memory on the phone while the learner records, sent once to the speech-to-text service through our server, and then discarded. It is never written to the database, never kept in files, and never logged. The only audio-related column is `audio_reference` on speaking turns (from Phase 1). It is never filled by any code and stays empty; a test checks this. It is reserved for a future feature and must not be used without changing this page and the privacy policy.
- Only the text that speech recognition returns is kept, in the learner's speaking history, and only for signed-in learners.
- `tests/privacy.test.mjs` proves this: after a spoken turn, no table and no request log contains the recording.
- The speech-to-text provider (Groq, or OpenAI if you chose it) receives the recording to transcribe it. The AI coach provider (Groq, or Anthropic if you chose it) receives the text of the learner's turn. Check their current data retention terms when you write your privacy policy.

## What is stored, where, for how long
| Data | Where | Why | How long | How the learner removes it |
| --- | --- | --- | --- | --- |
| Progress, mistakes, saved words, review schedule, settings | On the phone | Learning | Until cleared | Privacy > Clear data on this phone |
| The same, plus profile (name, level, goal) | Supabase, only if signed in | Use on another phone | Until deleted | Privacy > Delete my account |
| Speaking practice text and summaries | Supabase, signed in only | Show history, feedback | Deleted automatically after `retention_transcript_days` (90) | Privacy > Delete my speaking history |
| Usage statistics (fixed event names, no text) | Supabase | Improve the app | `retention_analytics_days` (180) | Switch off in Privacy; account deletion removes the ones linked to the account |
| Subscription state | Supabase | Plans | While account exists | Account deletion (Google Play subscription must be cancelled in Google Play) |
| Payment notifications from Google | Supabase | Keep plans correct | `retention_webhook_days` (180) | Automatic |
| Feedback reports | Supabase | Fix problems | Closed ones `retention_feedback_days` (365) | Account deletion removes those tied to the account |
| Audit log (admin actions) | Supabase | Accountability | Kept | Contains no learner conversation. Account deletion adds an anonymous line (a one-way hash). |

The numbers are placeholders chosen in this phase. Change them in Supabase > `app_settings` and in the plan. The server refuses values under 7 days.

## Usage statistics
- Events are listed in `docs/analytics-events.md`. Every value is a fixed word or a number in a set range, so names, answers, sentences or voice cannot be included even by mistake (tests check this).
- Default is ON, with a visible switch in Privacy and data controls. This is a product decision for you: if your lawyer or the plan wants opt-in, change `analytics: 'on'` in `www/src/store.js` to `'off'`.
- Events carry a random id made on the phone, not tied to a name or email. When signed in, the server also attaches the account id so deleting the account removes them.

## Download my data
Privacy > Prepare my data, then Save or share file (or Show as text and copy). Contains profile, lesson progress, answers reported (counts), speaking sessions with text, mistakes, review schedule, listening results, practice log, saved words, subscriptions (plan and dates only), usage totals, feedback sent, and the usage events linked to the account. Limited to 3 downloads an hour.

## Delete my account
Privacy > Delete my account asks for the password again, then removes the sign-in, which removes the profile and everything linked to it through database rules (`on delete cascade`). The server requires the confirmation word. If the account is the only admin owner, deletion is refused until another owner exists. A Google Play subscription is not cancelled by this and the screen says so.

## Retention job
`/api/v1/ops/maintenance` runs every night (Vercel Cron, `CRON_SECRET`). It deletes old usage events, old speaking turns, old session summaries, processed payment notifications and closed feedback. A wrong or tiny setting falls back to the default, so a typo cannot wipe data. The Overview tab warns if it has not run for 36 hours.

## Before you publish
1. Publish a privacy policy page at a public address (Play Console requires it). Use `docs/privacy-policy-draft.md` as a starting point and have it checked for Bangladesh and Google Play rules.
2. Fill the Play Console Data safety form from the table above: data collected = email, name, user content (speaking text), app activity (usage events), purchase history; voice is processed but not stored; encryption in transit yes; users can request deletion yes (in-app).
