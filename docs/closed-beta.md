# Closed beta plan (plan sections 16 and 18)

## Why 15 to 20 testers, and why it starts early
If your Google Play developer account is a PERSONAL account created after 13 November 2023, Google requires a closed test with at least 12 testers who stay opted in for 14 days in a row before you may apply for production. Internal testing does not count. Open testing does not count. Recruit 15 to 20 people so that drop-outs do not reset the clock. Organisation accounts are not subject to this rule. Check the current rule in Play Console (Help) before you start, because Google changes policies.

## Goals
1. Learners can finish onboarding, 5 lessons, a review session and 3 AI Speak sessions without help.
2. Nothing breaks on real phones, on slow mobile data, or offline.
3. AI corrections are mostly right and never unsafe (use the report button).
4. Costs per active learner stay inside the budget you set.
5. Meet the Google Play testing requirement.

## Who
15 to 20 adult Bengali speakers: 5 true beginners, 5 at A1 to A2, 3 to 5 comfortable with English who will judge correction quality, 2 with low-end phones, 1 or 2 who use TalkBack or large text. Mix of mobile data and Wi-Fi. Include 2 testers who will try to break things.

## Schedule (4 weeks)
| Week | What | Gate to continue |
| --- | --- | --- |
| 0 | Run all tests, AI evaluation (PASSED), device checks in `docs/qa.md` on 3 phones, privacy policy published, Data safety form filled | No severity 1 or 2 bug open |
| 1 | Internal testing track: 5 people (you, helpers). Fix what they find | 5 people finished a full day of use |
| 2 and 3 | Closed testing track: 15 to 20 testers, 14 days continuous. Weekly message and weekly review of the dashboard | Retention and bug numbers below |
| 4 | Fix, release a second build to the same testers, ask the final questions, decide go or no-go | Exit criteria below |

## How to give testers a plan without payment
Dashboard > Learners > find by email > Give plan (Pro, 31 days or less for support, longer for owner) with the reason "closed beta". Purchases can also be tested by adding testers as License testers in Play Console, who are never charged.

## What to watch (Dashboard)
| Number | Where | Beta target (my starting values, change them) |
| --- | --- | --- |
| Finished onboarding of those who opened | Analytics > Funnel | 80 percent or more |
| Started a lesson after onboarding | Funnel | 70 percent or more |
| Back the next day (day 1) | Retention | 35 percent or more |
| Back after 7 days (day 7) | Retention | 15 percent or more |
| AI Speak sessions per active tester per week | Analytics | 2 or more |
| AI cost per active tester per week | Overview, AI | Under your budget (decide the number first) |
| New severity 1 or 2 reports per week | Feedback | 0 in the last week |
| Reported AI corrections | Feedback | Fewer than 1 in 20 corrections |

## Tester message (copy and edit)
English: "Thank you for helping test Spoken English. 1) Open this link on your Android phone and join the test: [link]. 2) Install the app. 3) Use it for at least 10 minutes a day for 14 days. 4) If something is wrong or confusing, open Settings > Help and feedback and tell us. If an AI correction looks wrong, tap Report this correction. Please do not write passwords or private information. You can delete all your data any time in Settings > Privacy and data controls."
Bengali version: have a native speaker check the translation before you send it.

Keep the testers opted in for the whole 14 days. Remind them in the middle of week 2. Do not remove testers.

## Weekly routine (30 minutes)
1. Dashboard Overview: all OK? 2. Feedback: answer every new report (status and note). 3. Analytics: compare with the table. 4. AI: cost and reported corrections. 5. Fix list: severity 1 and 2 first. 6. Send the testers a short update of what you fixed (people stay when they see their reports matter).

## Exit criteria (go to production)
- Closed test ran 14 days with 12 or more testers continuously opted in (Play Console shows this).
- No open severity 1 or 2 bug. AI evaluation PASSED on the final build.
- Day 1 and day 7 retention at or near target, or a written reason and a plan.
- 3 successful test purchases and 1 successful cancellation with a License tester, and a webhook arrived (Overview shows no stuck notifications).
- Privacy policy published and linked, Data safety form accepted, account deletion works from the app.
- You can restore a backup (`docs/runbook.md`).
If Google asks for more testing, keep going with the same group.

## After the beta
Write what you learned at the bottom of this file, update `docs/roadmap.md`, and decide the first production release date.
