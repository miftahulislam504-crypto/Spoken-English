# Plans, purchases, limits and cost (Phase 9)

The server decides everything here. The app only shows what the server says, so a changed app or a copied request can never give a learner a plan or more usage.

## What learners get
- Lessons, listening, review, mistakes and progress are always free. A plan only sets how much the AI coach and voice recording can be used each day, and which speaking modes are open.
- Starting limits (you can change every number, see below):

| | Free | Pro | Advanced |
| --- | --- | --- | --- |
| AI conversation turns per day | 10 | 40 | 100 |
| Voice recording per day | 2 minutes | 10 minutes | 25 minutes |
| Speaking modes | Guided, Repeat After Me, Answer a Question, Review My Mistakes | all six | all six |

- Repeat After Me and review do not use AI turns. Voice recording counts every second sent to speech recognition, including silence, because the provider charges for it.
- Limits reset at midnight in Bangladesh (UTC+6). To change this set `QUOTA_TZ_OFFSET_MINUTES` (for example `0` for UTC).
- These numbers are placeholders chosen in this phase. Check them against your plan document and change them as needed.

## Changing limits and names (no release needed)
Supabase > Table Editor > `plans`. Edit the `features` column, for example:
`{"ai_turns_per_day": 15, "stt_seconds_per_day": 180, "speaking_modes": ["guided","repeat","answer","review"]}`
Changes apply within a minute. A missing or wrong value falls back to the starting value, so a typo never gives unlimited use. `speaking_modes` can contain: guided, roleplay, free, repeat, answer, review.
`AI_TURNS_PER_DAY` (Vercel variable), if set, is a ceiling for every plan. Remove it to let the plans decide.

## Setup, in this order
1. **Database.** Supabase > SQL Editor > run `supabase/migrations/0006_billing.sql` (after 0005). Safe to run again.
2. **Vercel variables** (Project Settings > Environment Variables, then redeploy):

| Variable | Needed for | Notes |
| --- | --- | --- |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | purchases | The whole JSON key of the Google service account (step 4) pasted as one value |
| `GOOGLE_PLAY_PACKAGE_NAME` | purchases | Optional. Default `com.spokenenglish.coach` (the appId in capacitor.config.json) |
| `PLAY_WEBHOOK_SECRET` | notifications | A long random text you make up. It goes in the notification address (step 5) |
| `OPS_TOKEN` | your usage summary | A long random text. Whoever has it can read the summary |
| `AI_PRICE_INPUT_PER_MTOK`, `AI_PRICE_OUTPUT_PER_MTOK` | cost estimates | Dollars per million tokens, from your AI provider's price page |
| `STT_PRICE_PER_MINUTE` | cost estimates | Dollars per minute of speech recognition |
| `AI_DAILY_BUDGET_USD`, `AI_MONTHLY_BUDGET_USD` | budgets | Optional. They can also be set in the database (see Budgets) |
| `QUOTA_TZ_OFFSET_MINUTES` | day reset | Optional. Default 360 |
| `PLAY_REQUIRE_ACCOUNT_ID` | stricter purchase check | Optional. Set to `1` once you have seen that purchases carry the account id |

   Nothing is invented: without prices, usage is still counted (tokens, seconds) but no cost is shown and budgets cannot trigger. Without the Google variables the app works and purchases say "not available right now".
3. **Play Console products.** Monetize with Play > Products > Subscriptions: create one subscription per paid plan (for example `sub_pro` and `sub_advanced`), each with one base plan (for example `monthly`). Set the prices there; the app never contains a price. Then in `plans` set `play_product_id` and `play_base_plan_id` for `pro` and `advanced`.
4. **Service account.** In Google Cloud create a service account in the project linked to your Play Console, make a JSON key, and in Play Console > Users and permissions invite the service account email with permission to view financial data and manage orders and subscriptions. Google can take a while to activate it. Paste the JSON into `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.
5. **Notifications (real-time developer notifications).** In Google Cloud create a Pub/Sub topic; give `google-play-developer-notifications@system.gserviceaccount.com` the Publisher role on it; create a Push subscription on the topic with the address
   `https://YOUR-DOMAIN/api/v1/billing/google/webhook?secret=YOUR_PLAY_WEBHOOK_SECRET`
   In Play Console > Monetization setup, enter the topic name and press Send test notification. The server answers 200.
   Notifications are only a reason to ask Google again, so a fake one cannot change anything. If the server is down or Google cannot be reached it answers 5xx and Pub/Sub tries again.
6. **Android build.** Set the repository variable `ENABLE_BILLING` to `true` (GitHub > Settings > Secrets and variables > Actions > Variables). The workflow then adds the `@capgo/native-purchases` plugin (version 6 for Capacitor 6). Without the variable the build is unchanged.
   Real purchases only work in a signed build installed from Google Play (an internal testing track with license testers). A debug APK from the workflow cannot buy. Setting up the signed release build and the test track is part of Phase 11 (closed beta).

## How a purchase works
1. The app asks the server for the learner's `billing_ref` (a random id, no personal data) and starts the Google Play purchase with it.
2. The app sends only the purchase token to `POST /api/v1/billing/google/verify`.
3. The server asks Google about that token, checks the product belongs to a plan, checks the purchase was made for this learner (the `billing_ref` must match), saves it, and acknowledges it (Google refunds unacknowledged purchases after 3 days).
4. Renewals, cancellations, holds and refunds arrive as notifications; each one makes the server ask Google again.
5. Access rules: active, in the payment grace period, and cancelled-but-not-ended give access until the end date. On hold, paused, pending and expired do not. If Google cannot be reached the old state stays.
A token already saved for one learner can never be claimed by another. Upgrading replaces the old purchase.

## Giving a plan by hand (testers, gifts)
Supabase SQL Editor (use the learner's id from Authentication > Users):
```sql
insert into public.subscriptions (user_id, plan_id, provider, provider_reference, status, current_period_end)
values ('LEARNER-ID', 'pro', 'manual', 'gift-friend-1', 'active', now() + interval '30 days');
```
Leave `current_period_end` empty for no end date. To remove it: `update public.subscriptions set status = 'canceled' where provider_reference = 'gift-friend-1';`

## Budgets and the AI switch
- Switch the AI coach off for everyone: `update public.app_settings set value = 'false'::jsonb where key = 'ai_enabled';` (back on with `'true'`). Learners see "AI coach not available right now"; lessons, listening, review and typed practice keep working.
- Daily or monthly spend limit: `update public.app_settings set value = '2.50'::jsonb where key = 'ai_daily_budget_usd';` (`'null'::jsonb` removes it). When the estimated spend reaches it, AI turns stop until the next day (or month). This needs the price variables.
- Settings are read every 30 seconds and spend every minute, so a stop can lag a little. If spend cannot be read, AI calls continue (per-learner limits still apply) and an error is logged.
- Every stop writes a log line `ai_stopped` in Vercel Logs.

## Watching usage (monitoring)
`GET https://YOUR-DOMAIN/api/v1/ops/summary` with the header `Authorization: Bearer YOUR_OPS_TOKEN` returns today's and this month's usage by type (turns, speech seconds, tokens), estimated cost, learners per type, subscriptions by plan and state, unprocessed notifications, the budget state and `warnings`:
- `budget_without_prices`: a budget is set but prices are missing, so it can never trigger.
- `play_not_configured`, `webhook_secret_missing`: purchases or notifications are not set up.
- `webhook_events_stuck`: a notification was not processed for over 10 minutes. Check Vercel Logs.
The admin dashboard in Phase 10 is built on this summary.

## What is not done yet
- A signed release build and the Play test track (Phase 11). Purchases are tested with fake Google replies in `tests/billing.test.mjs`, not on a real device.
- Free trials, introductory offers, yearly plans and plan-change proration. The server reads whatever Google reports, but the app shows one subscription per plan.
- Monthly usage caps per learner (only daily limits exist), and other payment providers.
- Costs are estimates from the prices you set. They are not the provider's invoice.
