# Progress

Source plan: spoken_english_learning_app_complete_plan.md (sections 1 to 21).
Legend: [x] done, [~] partly done, [ ] not started.
Current phase: Phase 11 complete (Phase 10 and 11 were built together), then a provider change: the AI coach and voice to text now run on Groq (see "Change after Phase 11" at the end). Next: owner actions in docs/phase-10-11-setup.md and docs/groq-setup.md, then the closed beta (docs/closed-beta.md).

## Stack decision
Static ES-module web app (no build step) in `www/`, wrapped by Capacitor for Android, deployed on Vercel. Backend (Supabase PostgreSQL + Vercel API) arrives in Phase 6.

## Phase 1 - Foundation and English-only UI shell [x]
- [x] Sec 1 core principle: UI English, Bengali as support (locale constants in config.js)
- [x] Sec 3 five-item bottom navigation: Home, Learn, AI Speak, Listening, Progress
- [x] Sec 3.1 Home layout (next action, daily goal, recommended, recent mistake, weekly summary, plan) with empty states
- [x] Sec 3.2 to 3.5 section lists shown for Learn, AI Speak, Listening, Progress (marked Coming soon)
- [x] Sec 3.6 profile/settings entry; daily goal and Bengali support level work; other items listed
- [x] Sec 4 English UI string catalog, no hardcoded UI text, Bengali teaching card sample, content separate from UI
- [x] Sec 16 Phase 1 and Sec 21 step 1: design system (light/dark tokens), repository, deploy config, Android APK workflow
- [ ] Sec 16 Phase 1 remaining: full wireframes, database schema and API contracts (done in Phase 6), security requirements (Phase 11)

## Phase 2 - Onboarding, diagnostic, learning path [x]
- [x] Sec 5 flow steps 1 to 10: splash, welcome, product introduction, sign-up/sign-in/guest screen, learning goal, comfort level, daily goal, microphone explanation then permission request, short placement check, personalized learning path
- [x] Sec 5 step 14: finish returns to Home with the next week highlighted
- [~] Sec 5 steps 11 to 13: first mini lesson (listen, say aloud, self-check) and a first feedback summary exist; the real lesson engine is Phase 3 and AI speaking feedback is Phase 7
- [~] Sec 5 step 4: guest mode works; Sign up and Sign in are shown disabled until accounts exist (Phase 6)
- [x] Sec 5 onboarding questions (goal, comfort, daily time) with Bengali support lines
- [x] Sec 5 placement check: 3 scored tasks (listening, meaning, answering a personal question) plus 1 repeat-aloud task; provisional level, skippable, not an exam; can be retaken from Settings
- [~] Sec 5 repeat/produce a phrase: self-reported only; real audio assessment is Phase 7
- [x] Sec 2 six levels defined; placement reaches A2 at most; skills tracked separately (listening, vocabulary, sentence formation, speaking; speaking stays unassessed until Phase 7); level changes from practice evidence were added in Phase 8
- [x] Sec 3.6 settings now working: learning goal, daily goal, Bengali support, English accent (used for audio), reminder preference (real notifications added in Phase 11), microphone status and request, retake placement check
- [x] Learning path built from the Sec 7 four-week outline and shown in Learn and onboarding; lesson content for each week is Phase 3 and 4
- [x] Android CI adds the RECORD_AUDIO permission
- Note: audio in this phase uses the device text-to-speech voice. Recorded or generated audio assets come in Phase 5.

## Phase 3 - Lesson engine and exercises [x]
- [x] Sec 8 lesson schema (id, course_id, title_en, level, sequence_number, learning_objectives, prerequisite_lesson_ids, estimated_duration_seconds, content_version, published_status); content kept separate from UI code; a lesson restarts from the beginning if its content_version changes
- [x] Sec 6.1 and 7 lesson player with the 6 stages (Warm-up, Listen, Learn, Speak, Practice, Review); completion criteria (60% first-try score); prerequisites and locked lessons; next-lesson flow; progress saved per lesson and resumed after restart
- [x] Exercise types: choose, listen-and-choose, word order, typed answer, own-sentence pattern check, repeat aloud
- [x] Answer rules with several valid answers; case, punctuation and common contractions ignored; Check Answer, Try Again, Correct Answer flow
- [x] Sec 6.5 sentence builder: word ordering, own sentence from a pattern (I want to + verb), Bengali to English writing prompt
- [~] Sec 6.5 question formation, positive/negative/question forms, tense practice: need curriculum content (Phase 4)
- [x] Learn sections: Learning Path, Courses, Lessons, Grammar in Context, Sentence Patterns, Practice Exercises (mixed set from started lessons), Bookmarks. Vocabulary: Phase 4. Review Queue: Phase 8 (done).
- [x] Daily goal on Home now counts practice minutes
- [x] Groundwork for Phase 8: first-try mistakes are saved and the latest one shows on Home
- [~] Content: 3 sample lessons (Greetings, Names, I want to). Full 4-week curriculum: Phase 4
- [~] Speak stage is a self-check; AI feedback: Phase 7. Audio uses the device voice: Phase 5

## Phase 4A - Week 1, Week 2 and vocabulary [x]
- [x] Week 1, all 8 topics: greetings and polite expressions, names and introductions, pronouns, am/is/are, yes/no questions, simple personal information, numbers/days/classroom instructions, listening to short greetings (lessons l1, l2, l4 to l8)
- [x] Week 2, all 8 topics: common verbs, present simple, daily routines, likes and dislikes, basic question words, time and frequency, short answers, listening to routine dialogues (lessons l9 to l15 and l3)
- [x] Learn tab groups lessons by week; lessons are locked in sequence by prerequisites
- [x] Placement: a learner placed at A1 or higher starts in a later week and earlier lessons count as covered (they can still open them)
- [x] Onboarding first lesson now uses the real lesson engine; finishing it returns to Home
- [x] Sec 6.7 vocabulary and phrasebook: vocabulary from unlocked lessons, save, pronunciation (device voice), contextual example, Bengali meaning, add your own phrase, practice saved words (meaning check and own sentence), recognition and active use tracked separately
- [x] Sec 6.7 "add it to review": saved words are flagged for review and scheduled in the Review Queue (Phase 8)
- [x] Sec 6.5 question formation, positive/negative/question forms and tense practice (present, past, future): completed with Phase 4B
- [x] Default Bengali hint for every exercise type

## Phase 4B - Week 3, Week 4, review and assessment [x]
- [x] Week 3, all 8 topics: asking for help, asking for directions, shopping language, food and ordering, question formation, place and time expressions, understanding short requests, roleplay with guided hints (lessons l16 to l23)
- [x] Week 4, all 8 topics: past events, simple future plans, linking sentences, describing people and places, clarification phrases, longer listening dialogues, mixed-skill review, low-pressure progress assessment (lessons l24 to l31)
- [x] Mixed-skill review (l30): listening, grammar, sentence building, writing and own-sentence tasks from all four weeks
- [x] Progress check (l31): no pass or fail, can be taken again, with a guidance note
- [~] Guided roleplay (l23) is scripted choices with hints; real AI roleplay is Phase 7
- [~] Listening uses the device voice; recorded audio, speeds and accents are Phase 5
- [x] Progress check results feed the Progress tab (Phase 8): last result and number of attempts, with no pass or fail

## Phase 5 - Listening [x]
- [x] Sec 3.4 Listening tab with all 8 sections: Beginner Dialogues, Listen and Choose, Listen and Answer, Dictation, Short Stories, Everyday Conversations, Slow / Normal / Natural Speed, Accent Exposure
- [x] Sec 6.3 dialogues (two voices), single-clip questions, short typed answers, dictation sets, short stories with questions; 16 listening items
- [x] Replay without limit; transcript shown after the learner answers (also in lesson listening questions); transcripts always shown if the phone has no audio
- [x] Speed control (Slow, Normal, Natural) used by every audio button; also in Settings
- [x] Accent exposure: American, British, Indian, Australian; accent preference also in Settings
- [x] Listening results saved per item (best score, attempts) and counted toward the daily goal
- [~] Audio licensing: policy written (docs/audio-licensing.md) and clips carry an audio_source field; all audio is the phone's built-in voice, so no licence is needed yet
- [~] Natural speed is a faster setting of the same voice, and available accents depend on the voices installed on the phone. Real recorded clips need the licensing steps above.
- [x] Listening answers feed the Progress tab (Phase 8): first-try accuracy and items tried

## Phase 6 - Backend, auth, database, API [x]
- [x] Sec 10 PostgreSQL schema with all 12 entities (profiles for users, courses, lessons, exercises, user_lesson_progress, conversation_sessions, conversation_turns, skill_assessments, mistake_records, review_queue, subscriptions, usage_ledger) plus plans, exercise_attempts and webhook_events; foreign keys, indexes, unique pairs, check rules, versioned content
- [x] Sec 10 identity strategy chosen and written down: Supabase Auth, profile id equals auth user id
- [x] Sec 10 and 15 row-level security on every table and least-privilege grants; answer rules hidden from the app; progress can never go backwards (database trigger)
- [x] Sec 10 content seeded from the lesson files: 1 course, 31 lessons, 162 exercises (supabase/seed/0003_content.sql)
- [x] Auth in the app: sign up, sign in, sign out, password reset, delete account (onboarding and Settings); guest mode still works
- [x] Sec 11 /api/v1: health, public-config, me (get, patch, delete), me/preferences, me/learning-plan, me/progress (get, put), courses, courses/:id, lessons/:id, lessons/:id/exercises, exercises/:id/attempts
- [x] Sec 11 rules: every private route authenticated, all input validated, stable error codes with friendly messages, timeouts, idempotent attempts, no client-supplied subscription or usage values, secrets only on the server
- [x] Sync: preferences and lesson progress copied to the account after sign-in, after each lesson and on request; a new phone restores them
- [x] Setup guide and API reference: docs/backend.md
- [~] Server-side answer checking exists, but the app still checks answers on the phone so lessons work offline; progress numbers stay phone-reported (copied to the account in Phase 8 as a backup, marked phone-reported)
- [~] Sec 15 done now: RLS, server-side secrets, validation, rate limiting (per server instance), least privilege. Done in Phase 11 (see there): Vercel Firewall limits, content security policy, security testing, monitoring, backup restore test.
- [ ] Owner action needed: create the Supabase project, run the 3 SQL files, add the 3 Vercel environment variables (see docs/backend.md). Until then the app runs as a guest.
- Not in this phase by design: speaking endpoints (Phase 7), listening and review endpoints (Phase 8, done as GET and PUT /me/study), entitlements, usage and webhooks (Phase 9; tables are ready)

## Phase 7 - AI speaking coach [x]
- [x] Sec 3.3 all six modes: Guided Conversation (recommended for beginners), Roleplay, Free Conversation (unlocks after 7 finished lessons), Repeat After Me, Answer a Question, Review My Mistakes
- [x] Sec 6.2 voice conversation, guided prompts and suggested replies, AI follow-up questions, context from the last turns, one focused correction, Bengali explanation, natural alternative, repeat-the-corrected-sentence, transcript, session summary, mistake tracking (account and phone)
- [~] Sec 6.2 adjustable speed and complexity: coach voice follows the audio speed setting; complexity follows the learner level automatically; no separate complexity control
- [x] Sec 9 turn-based pipeline: sign-in and session check, microphone permission, recording (30 seconds), speech to text on the server, coach reply, phone voice, validated structured feedback, saved turns
- [x] Sec 9 tutor policy in the prompt (simple English, one correction, Bengali, retry, informal English accepted, no single accent, asks to repeat when unclear, no invented assessment, learner text treated as data)
- [x] Sec 9 E safety and cost: daily turn limit checked before AI calls, idempotent usage records (turns and speech seconds), provider errors turned into friendly messages, logs without transcripts, audio never stored
- [x] Sec 6.4 repetition, own-recording playback (phone only), stress and rhythm set, difficult sounds for Bengali speakers with Bengali tips, recognizer feedback on missed words, fluency observations when measurable, repeat after feedback
- [~] Sec 6.4 pronunciation scoring: not offered, because no audio-based scoring service is connected. The app says plainly that it shows what the recognizer heard.
- [x] Sec 6.6 the 10 initial scenarios (greeting, introducing yourself, family, daily routines, asking for help, shopping, ordering food, directions, making an appointment, phone), each with goal, roles, vocabulary, level and a short post-session review. Later scenarios (travel, school, interviews, meetings, workplace, explaining problems, opinions) are post-MVP (Sec 20).
- [x] Week 3 scripted roleplay in lesson l23 stays as practice; AI roleplay is in AI Speak
- [x] Skill evidence, review schedule and recommendations from speaking: added in Phase 8 (speaking level needs the goal reached twice at one level; see docs/learning-engine.md)
- [~] Plan-based limits: Phase 9 (a simple daily limit is used now)
- [ ] Owner action: run 0004_speaking.sql; add GROQ_API_KEY (coach and voice to text; first built with Anthropic and OpenAI keys, changed to Groq after Phase 11) in Vercel. Without a key typing practice that needs no AI still works. Guests must sign in to use AI Speak. See docs/ai-speaking.md.

## Phase 8 - Mistakes, revision, personalization, progress [x]
- [x] Sec 6.8 mistake records: every first-try mistake in lessons, practice and listening, and every AI speaking correction, becomes one record (type, skill, what the learner wrote, the better answer, Bengali explanation, how often it was seen). Repeats are counted, and a resolved mistake that returns is reopened
- [x] Sec 6.8 Mistake Notebook (Learn tab): open and resolved mistakes, hear the sentence, open the lesson, "I know this"
- [x] Sec 6.8 Review Queue (Learn tab and Home): spaced repetition for mistakes, speaking corrections and saved words; first review after 10 minutes, then 1, 3, 7, 14 and 30 days; a miss sends the item back; a mistake is resolved after 3 correct reviews in a row; short sessions of up to 8 items; the schedule is explained on screen
- [x] Sec 9 adaptive recommendations: rule-based, each shows its reason (review due, weak skill, next lesson, progress check, speaking and listening gaps, unused saved words); shown on Home and in Progress
- [x] Sec 9 scaffolding reduction: Bengali hints move behind a tap for strong skills and well-remembered items; review exercises move from tiles or choices to writing; Guided Conversation hides suggested replies after the goal was reached twice; the app offers (never forces) On request for Bengali when answers are consistently right
- [x] Sec 2 and 9 level changes from evidence: Pre-A1 to A1 and A1 to A2 by finished lessons, enough answers and first-try accuracy; only up; Home explains the change; Progress shows what is missing for the next level
- [x] Sec 9 speaking level from evidence: the goal reached twice at one scenario level, with a confidence label; otherwise "not assessed"
- [x] Sec 3.5 Progress tab with all 10 sections: Overall Learning Summary, Listening Comprehension, Sentence Formation, Grammar Accuracy, Speaking Fluency, Pronunciation / Intelligibility, Vocabulary in Use, Mistake Trends, Weekly Report, Learning Streak and Practice Time
- [x] Sec 3.1 Home: Review card, Recommended for you, Recent mistake with link to the notebook, This week summary, level-up notice
- [x] Weekly Report screen: last 7 days against the 7 before, with a focus for next week
- [x] Sec 14 honest score presentation: every figure shows how many answers are behind it; no figure under 5 answers; trends need enough answers in both periods; "words recognized" is labelled as the recognizer result and not a pronunciation score; practice time is labelled as an estimate; no invented fluency score; "How these numbers are measured" explains it
- [x] Practice log kept per day (120 days) for streaks, weekly report and trends; streak counts any practice day and never removes progress
- [x] Backend: GET and PUT /me/study (mistakes, mistake review schedule, listening results, practice log, skill snapshots); migration 0005_study.sql; input checked, merged with the account's copy, safe for two phones; a new phone restores them
- [x] The AI coach and the phone store a correction under the same key, so one correction is one record everywhere
- [x] Phone data from Phase 7 migrates by itself: old mistakes are matched to their exercises and put in the review queue; saved words get review items
- [x] Rules written down: docs/learning-engine.md
- [x] Automatic tests (46): engine rules, every screen, lessons and reviews played through the real lesson player, AI Speak with a fake server, the API with a fake database, UI string completeness. `npm test`, and GitHub Actions runs it on every change (.github/workflows/test.yml)
- [x] Saved words are copied to the account in Phase 11 (words sync); their review items are rebuilt on a new phone
- [~] Numbers are phone-reported (answers are checked on the phone so lessons work offline); the account keeps them as a backup and for analytics in Phase 10
- [~] Practice time is estimated from finished lessons, exercises and speaking turns, not measured by a timer
- [~] Levels stop at A2 because the course has 4 weeks of beginner content; more levels need new courses
- [~] Pronunciation scoring is still not offered (no audio scoring service); the recognizer result is shown honestly
- [x] Behaviour changes to know: "On request" Bengali support now applies to exercise hints in lessons too (it only affected explanations before); AI Speak time now counts toward the daily goal; the learning path highlights the week of the next lesson, not only the placement level
- [ ] Owner action: run supabase/migrations/0005_study.sql in the Supabase SQL Editor (after 0004). No new environment variables. Until then everything works on the phone and the Account screen says mistakes and review are not saved to the account yet.

## Phase 9 - Subscription, quotas, cost [x]
Sec 12, 19, 11 (entitlements/usage). Setup steps and all numbers are in docs/billing-and-limits.md.
- [x] Sec 12 plans Free, Pro and Advanced: limits live in the plans table (features column) and can be edited without a release; wrong or missing values fall back to safe starting values; lessons, listening, review, mistakes and progress stay free on every plan
- [x] Sec 12 server-side entitlements: the server decides the plan from saved subscriptions (active, payment grace period and cancelled-but-paid give access until the end date; on hold, paused, pending and expired do not; the highest plan wins; manual gifts supported); the app only shows it
- [x] Sec 11 usage ledger and quotas: AI turns and voice-recording seconds per learner per day (resets at midnight Bangladesh time, changeable), speaking modes per plan; limits are checked before any paid call so a refused turn costs nothing; Repeat After Me and review do not use AI turns; silence recordings are counted because the provider bills them
- [x] Fixed: repeat and retry turns were counted as AI turns by the old daily limit; only real AI replies count now
- [x] Sec 12 Google Play billing, server side: purchase tokens are checked with the Google Play Developer API (subscriptionsv2), saved, and acknowledged; a purchase can only be claimed by the learner it was made for (random billing reference sent as the account id) and never taken over; upgrades retire the replaced purchase; verify and restore endpoints
- [x] Sec 12 webhooks: Google Play real-time notifications through Pub/Sub with a secret in the address; every notification only triggers a fresh check with Google; duplicates are processed once; failures answer 5xx so Pub/Sub retries; refunds and expiry remove access
- [x] Sec 19 cost controls: tokens and seconds recorded for every AI and voice call; estimated cost from prices you set (never guessed); daily and monthly AI budgets and an on/off switch for the AI coach in the database (`app_settings`); when stopped, lessons, listening, review and typed practice still work; old `AI_TURNS_PER_DAY` kept as a ceiling for every plan
- [x] Sec 19 monitoring: GET /ops/summary (OPS_TOKEN) with usage, cost, subscriptions by state, budget state, stuck notifications and warnings; stop events logged as `ai_stopped`
- [x] App: Plans and usage screen (current plan, renewal or end date, usage meters, plan comparison, restore, manage subscription, auto-renew and tax note); prices come only from Google Play and are never written in the app; AI Speak shows what is left today and locks modes outside the plan with a link; limit errors say exactly what ran out and link to the plans; Settings shows the plan; the account screen warns that deleting an account does not cancel a subscription
- [x] Android build: BILLING permission added; the Play Billing plugin (@capgo/native-purchases, version 6 for Capacitor 6) is added by the workflow only when the repository variable ENABLE_BILLING is true, so builds cannot break before Play Console is ready
- [x] Automatic tests: 78 in total (32 new): plan rules, quotas and day reset, entitlement rules, cost, JWT sign-in to Google checked with a real RSA key, purchase ownership and takeover, upgrade, restore, pending and on-hold purchases, webhook secret, duplicates, retries, budgets and the AI switch, owner summary, Plans screen, purchase and restore flows with a fake billing plugin
- [~] Purchases are tested with fake Google replies, not on a real phone. Real purchases need a signed release build installed from a Google Play internal testing track with license testers; a debug APK cannot buy. That build pipeline is part of Phase 11 (closed beta)
- [~] The in-app purchase call uses the @capgo/native-purchases plugin as documented (getProducts, purchaseProduct with the account id, getPurchases); it has not run on a device. If a detail differs, only www/src/billing.js changes
- [~] Starting limits (free 10 AI turns and 2 minutes of voice per day, pro 40 and 10, advanced 100 and 25; free has four of six speaking modes) are my placeholders because the plan document sections 12 and 19 were not in the zip. Please compare them with the plan and edit the plans table
- [~] Costs are estimates from the prices you set, not the provider invoice. Without prices no cost is shown and budgets cannot trigger (the summary warns about this)
- [~] Not built: free trials and introductory offers in the app, yearly plans, plan-change proration, monthly per-learner caps, other payment providers
- [ ] Owner action 1: run supabase/migrations/0006_billing.sql in the Supabase SQL Editor (after 0005)
- [ ] Owner action 2 (when you want purchases): create the two subscriptions in Play Console, the service account, the Pub/Sub push subscription and the Vercel variables, then set ENABLE_BILLING; steps in docs/billing-and-limits.md. Until then everyone is on the Free plan and the app says purchases are not available, which is correct
- [ ] Owner action 3 (optional now): set AI_PRICE_INPUT_PER_MTOK, AI_PRICE_OUTPUT_PER_MTOK, STT_PRICE_PER_MINUTE and OPS_TOKEN in Vercel to see costs and the usage summary
- [x] Behaviour change to know: with no subscription everyone is now on Free (10 AI turns a day), not the old 40. Give testers a plan with the SQL in docs/billing-and-limits.md ("Giving a plan by hand"), or raise the Free numbers in the plans table

## Phase 10 - Admin dashboard and analytics [x]
Sec 13, 14 (product metrics). The plan sections were not in the zip, so the scope follows the Phase 10 line above; compare with the plan. Guide: docs/admin.md. Setup: docs/phase-10-11-setup.md.
- [x] Sec 13 roles: owner, content_manager, support, analyst, stored in `admin_roles`; the server checks the role on every admin route; the last owner can never be removed, demoted or deleted; the first owner is added in SQL
- [x] Sec 13 audit log: every admin change and every look at a learner is written BEFORE the change; append-only (a database rule blocks edits and deletes); account deletions leave an anonymous one-way-hash line
- [x] Sec 13 content management: list, checks, edit lesson details and exercises with strict validation (options, answers, accepted answers tested against the real checker, tiles, rules), version raised on every edit, earlier versions saved and restorable, publish and hide with dependency checks, add a new lesson as a draft from pasted JSON
- [x] Content reaches phones: public manifest and lesson routes serve only published lessons that pass the checks; phones download them (see Phase 11 Downloaded lessons)
- [x] Sec 13 AI operations: model names, key status, daily and monthly budgets, AI on/off switch (all with audit), AI cost today and month, reported AI corrections
- [x] Sec 13 business operations: plans and limits editable (strict validation), Google Play product ids, subscription counts, find a learner by exact email or id, give or take back a manual plan with a reason (support up to 31 days, owner up to 365), feedback queue
- [x] Sec 14 analytics events: 20 fixed events with fixed values (no free text, nothing personal), random id per phone, batched and retried, learner can switch off; ingest drops anything not on the list
- [x] Sec 14 product metrics: funnel, daily phones, day 1 and day 7 retention, new learners, lessons per day and per lesson, most missed exercises, speaking sessions, learner turns, open mistakes (docs/analytics-events.md)
- [x] Dashboard page `/admin/` for phones: sign in with the app account, only the sections your role allows, safe display of all text, no secret kept in the page
- [x] Migration 0007_admin.sql
- [~] Usage numbers from phones are estimates and cover only learners who left statistics on; lesson numbers are phone-reported
- [~] Lesson structure (adding or removing steps, ordering, weeks) cannot be changed in the dashboard, only content and status; new lessons use pasted JSON
- [~] Scope was chosen from the Phase 10 summary line because the plan sections 13 and 14 were not in the zip. Please compare
- [ ] Owner actions: run 0007 and 0008, make yourself owner (SQL in docs/phase-10-11-setup.md), set CRON_SECRET, open /admin/

## Phase 11 - Privacy, reliability, QA, beta [x]
Sec 15, 16 Phase 6, 17, 18, 20. The plan sections were not in the zip; scope follows the Phase 11 line above and the carry-over notes. Documents: docs/privacy.md, qa.md, runbook.md, closed-beta.md, mvp-acceptance.md, roadmap.md, release.md.
- [x] Sec 15 privacy and audio retention: recordings are never stored (proved by a test; the old `audio_reference` column stays empty); retention periods in `app_settings` (placeholders 90, 180, 180, 365 days) enforced by a nightly job (Vercel Cron, `CRON_SECRET`) that ignores wrong values; Overview warns if it stops
- [x] Sec 15 Privacy and data controls screen: what is kept and for how long (numbers come from the server), usage statistics switch, download my data (two steps; share sheet or file download on the web, copy as text in the Android app), delete my speaking history, delete my account (password again, confirmation word, last owner protected, Google Play note), clear data on this phone
- [x] Sec 15 account deletion: server needs the confirmation word; removes everything linked through cascading rules; Settings and Account now point to the Privacy screen
- [x] Offline downloads: Downloaded lessons screen; phones check once a day (staged, switched on at next start) or on request; downloaded lessons replace built-in ones only when newer and valid; hidden lessons are hidden; a broken download or corrupt storage can never break the app; remove downloads
- [x] Saved words sync (phrasebook) with removals and counters that only grow; review items for words that arrive
- [x] Reminders: real daily notifications in the Android app (local notifications plugin), morning 08:00 or evening 19:30, permission handling, off removes it; web says it needs the Android app
- [x] Error states: offline notice, friendly screen when a screen cannot draw, quiet notice for unexpected errors, clear messages for every error code
- [x] Help and feedback screen: six common answers, report a problem, report this AI correction (only the sentence and its correction are sent)
- [x] Sec 15 security: strict Content-Security-Policy and other headers (`vercel.json`), no inline code, tests for sign-in on every private route, role check on every admin route, no secrets in browser code, row-level security on every private table; Vercel Firewall rules and secret rotation written in docs/runbook.md
- [x] Sec 17 accessibility tests (13), found and fixed one real problem (light-theme focus colour too pale: 2.7 to 3.4 : 1)
- [x] Sec 17 AI evaluation set: 25 cases, grader, offline tests, live runner started from GitHub (`evals/`, `scripts/eval-coach.mjs`, workflow "AI evaluation")
- [x] Sec 17 performance tests: size and speed budgets; app is about 103 KB compressed; four months of daily use is about 214 KB of saved state
- [x] Sec 18 MVP acceptance checklist (docs/mvp-acceptance.md): what is verified and what only you or a real device can tick
- [x] Sec 16 and 18 closed beta plan (docs/closed-beta.md) including the Google Play rule for new personal accounts (12 testers, 14 days)
- [x] Sec 20 post-MVP roadmap notes v1.1, v1.2, v2.0 (docs/roadmap.md), drafted from this file
- [x] Release pipeline: "Release build" workflow (tests, then signed AAB), "Make upload key" workflow, "AI evaluation" workflow; the admin dashboard is left out of the phone app
- [x] Migration 0008_privacy.sql
- [x] Automatic tests: 78 before, now 174, run by `npm test` in about a minute. A new schema test reads the SQL files and checks every table, column, filter, sort and function the server code uses (tested by deliberately breaking a name)
- [~] The two new SQL files (0007, 0008) were checked by reading and by the schema test, but not run in a real PostgreSQL here. If Supabase shows an error when you run one, send me the error text
- [~] Nothing here has run on a real phone, in real Supabase, in real Play Console or against the real AI yet. The tests use a pretend database and pretend Google and AI replies. The device checks, live AI evaluation, backup restore and the Play build are on the acceptance checklist as [ ]
- [~] The local notifications plugin call and the share sheet for the data file are written as documented and tested with fakes only; if a detail differs on a device only `www/src/reminders.js` and `www/src/privacy.js` change
- [~] Retention days, the analytics default (on), the beta targets and the roadmap are my placeholders; see docs/roadmap.md "Decisions that need you"
- [~] Not built: a measured practice timer (estimates stay), Firewall rules in code (they are set in the Vercel dashboard), recorded audio, free trials and yearly plans
- [ ] Owner actions: all steps of docs/phase-10-11-setup.md; fill the privacy policy; Play Console setup (docs/release.md); closed beta

## Change after Phase 11 - Groq as the AI provider [x]
- [x] AI coach (item 1) now calls Groq (OpenAI-style chat API, JSON mode, default model `openai/gpt-oss-120b`, set with `GROQ_MODEL`). Same prompt rules, same server checks of every field, same retry and token counting (`api/_lib/ai.js`, `api/_lib/groq.js`)
- [x] Voice to text (item 2) now calls Groq Whisper (default `whisper-large-v3-turbo`, set with `STT_MODEL`); silence and confidence are read as before (`api/_lib/stt.js`)
- [x] One key for both: `GROQ_API_KEY` in Vercel (and in GitHub for the AI evaluation). No Anthropic or OpenAI key is needed. If only the old keys are set, the old providers still work; Groq wins when its key is set
- [x] Health check, admin AI tab, AI evaluation script and workflow, docs and privacy text updated; new guide `docs/groq-setup.md` (steps, models, prices, limits)
- [x] Tests: 174 before, now 186 (new `tests/groq.test.mjs`, 12 tests), all pass
- [~] Not run against the real Groq yet. The tests use a pretend Groq reply built from Groq's public documentation. The first real check is Actions > AI evaluation, then one typed and one voice turn in the app
- [~] The default coach model and the prices are from Groq's pages today; Groq changes model names, so see `docs/groq-setup.md` if AI Speak suddenly says not available
- [ ] Owner actions: `docs/groq-setup.md` steps 1 to 6

## Carry-over notes
- Lesson l23 (scripted roleplay with hints) was kept as practice by decision in Phase 7; AI roleplay lives in AI Speak. Nothing to carry over.
- Do not run supabase/seed/0003_content.sql again after editing lessons in the dashboard; it would overwrite them. To refresh the seed from the app files, run `npm run export:content` (output is identical to the committed seed today).
- A deleted-account line in the audit log keeps a one-way hash only. If the law or a user asks for more, change `deleteAccount` in api/_lib/privacy.js.
- Next after the beta: docs/roadmap.md.
