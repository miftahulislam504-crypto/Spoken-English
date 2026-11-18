# Learning engine rules (Phase 8)

All rules are in `www/src/engine/` and are tested in `tests/`. Change a number there, run `npm test`, and the tests show what else depends on it. Nothing here uses AI: every result comes from a fixed rule that the learner can read on screen.

## What is recorded
- **First-try answers.** Each exercise is counted once, on the first try. Retries and warm-up questions are not counted. The skill of an exercise comes from `engine/skills.js`: listening, vocabulary, sentence formation or grammar.
- **Practice log** (`s.daily`, one entry per day, last 120 days): estimated seconds, answers per skill [asked, correct], review answers, mistakes made and resolved, speaking turns and sessions, listening items and lessons finished.
- **Speaking sessions** (`s.speak_log`, last 40): mode, scenario, level, turns, words, goal reached, words recognized (%), speaking pace.
- **Words the recognizer missed** (`s.missed_words`, top 40).

## Mistake records
- One record per mistake. A lesson, practice or listening exercise is keyed by its place (`x:l4:4`). An AI correction is keyed by the corrected sentence (`sp:i go to school`).
- Repeating a mistake adds to its count. A resolved mistake that comes back is reopened.
- A mistake is resolved after 3 correct reviews in a row, or when the learner presses "I know this".
- Up to 200 records are kept; resolved ones are dropped first.

## Review Queue (spaced repetition)
- Sources: first-try mistakes, AI speaking corrections, and saved words.
- A new item is due after **10 minutes**. Each correct review moves it up one step and the next review comes after **1, 3, 7, 14, then 30 days**. A miss sends it back **two steps** and it is due again in 10 minutes.
- Practising an item before it is due changes nothing when correct. A wrong answer always brings it back.
- A session has up to 8 items, oldest due first.
- Support is reduced as an item is remembered: at step 2 and above the Bengali hint is behind a tap, a corrected sentence is written instead of built from word tiles, and a saved word is used in an own sentence instead of a meaning check. Options are shuffled so the position is not memorised.
- Saying a corrected sentence aloud in "Review My Mistakes" and having it recognized word for word counts as a correct review.

## Level changes
- Only up, never down. Checked after every lesson, practice set, review and listening item.
- Pre-A1 to A1: at least 12 lessons finished from Weeks 1 and 2 (placed lessons do not count), at least 30 first-try answers in the last 30 days, and at least 70% of them right.
- A1 to A2: the same with Weeks 3 and 4 and at least 75%.
- A2 is the top of this beginner course. The Progress tab says what is still missing for the next level.
- Speaking level: the highest scenario level where the goal was reached in at least 2 conversations (guided, roleplay or answer a question). Confidence is low under 6 conversations. With fewer than 2 goal-reached conversations it stays "not assessed".

## Recommendations
Sorted by weight, each with its reason shown to the learner: review due (90+), a skill under 60% with at least 10 answers (80), the progress check (75), the next lesson (70), speaking after 3 days without it (60), listening after 4 days (50), saved words never used in a sentence (40), offer to reduce Bengali hints (35).

## Scaffolding reduction
- Bengali hints under exercises move behind "Show Bengali hint" when the setting is On request, when the review item is at step 2 or above, or when the learner has answered at least 20 questions of that skill with 85% or more right.
- Bengali explanations follow the setting only. The learner can always open them.
- Guided Conversation hides suggested replies once the goal of that scenario was reached twice. "Show hints" brings them back.
- When 40 or more answers are 85% right, the app offers to switch Bengali support to On request. It never changes the setting by itself.

## Honest presentation
- Every figure shows how many answers are behind it. Under 5 answers there is no figure ("Not enough practice yet"). Evidence is called very little, some, good or strong at 5, 20 and 50 answers.
- A trend compares two 14-day periods and needs at least 10 answers in each.
- Practice time is an estimate from finished lessons and exercises, and is labelled that way.
- "Words recognized" is what the speech recognizer understood. It is not a pronunciation score, and the screen says so.
- No combined or invented score (for example a fluency number) is shown. Speaking shows observations only.

## What is not decided by the server
Answers are checked on the phone so lessons work offline, so all numbers are phone-reported. The server stores them as a backup and for later analytics (`skill_assessments.evidence_json.source = phone-reported`).
