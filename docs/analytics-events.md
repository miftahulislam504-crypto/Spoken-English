# Usage events (plan section 14)

The list lives in one file, `www/src/engine/events.js`, used by both the phone and the server. The server drops any event whose name or values are not on the list. A test checks that every event below is documented here.

Every event also carries: a random install id, the platform (web or android), the app version, and the time. Signed-in learners are linked on the server by account id.

| Event | When | Values |
| --- | --- | --- |
| `app_opened` | The app starts | none |
| `onboarding_started` | The app starts and onboarding is not finished | none |
| `onboarding_completed` | The learner finishes onboarding | `level`, `placed` (took the check) |
| `signup_completed` | Account created | none |
| `signin_completed` | Signed in | none |
| `lesson_started` | A lesson attempt begins | `lesson_id`, `week` |
| `lesson_completed` | A lesson is finished | `lesson_id`, `score_pct`, `first_time` |
| `review_session_completed` | A review session ends | `items`, `correct` |
| `listening_item_completed` | A listening item ends | `score_pct` |
| `speaking_session_started` | AI Speak session starts | `mode` |
| `speaking_session_ended` | AI Speak session ends | `mode`, `turns`, `goal_met` |
| `paywall_viewed` | Plans screen opened | none |
| `purchase_started` | Learner taps a plan | `plan` |
| `purchase_completed` | Plan is active after purchase | `plan` |
| `quota_reached` | A limit or plan lock was hit | `what` (ai_turns, stt_seconds, plan_required) |
| `content_updated` | Downloaded lessons were switched on | `lessons` |
| `error_shown` | The app showed an error screen or notice | `code` |
| `feedback_sent` | Feedback or a correction report was sent | `kind` |
| `data_exported` | The learner prepared a data download | none |
| `reminder_set` | The learner set a reminder | `when` (off, morning, evening) |

## Product metrics (plan section 14) and where to see them
| Metric | Where | Source |
| --- | --- | --- |
| New learners per day, total learners | Analytics > Learners and practice | database |
| Phones that opened the app per day | Analytics | `app_opened` |
| Onboarding completion, first lesson started and finished | Analytics > Funnel | events |
| Day 1 and day 7 retention | Analytics > Retention | `app_opened` |
| Lessons completed per day, per lesson, average score | Analytics | database (phone-reported) |
| Most missed exercises | Analytics | mistakes |
| AI Speak sessions, turns, goal reached | Analytics | database and events |
| Paywall views to purchases | Analytics > Funnel | events |
| AI cost per day and month, budget | Overview, AI | usage ledger |
| Reports from learners | Feedback | database |
