# After the first release: roadmap notes (plan section 20)

Drafted from the "not built" and "partly done" lines in `progress.md`, because the plan document (section 20) was not in the zip. Compare with the plan and replace anything that differs. Nothing here is built.

## v1.1 - Make the first release solid (about 4 to 8 weeks after launch)
- Fix what the closed beta and the first month of real use show. Look at Feedback and Analytics first.
- Recorded audio for the most used lessons and listening items (follow `docs/audio-licensing.md`); the lesson format already has an `audio_source` field.
- A measured practice timer (today practice minutes are estimated).
- Reminders that skip the notification when the learner already practiced today, and a second reminder time.
- Plans: free trial or introductory offer, yearly plan, and a monthly cap per learner (Phase 9 notes).
- Dashboard: add and remove steps of a lesson, reorder lessons, a form for creating lessons instead of pasted JSON, scheduled publishing.
- Server-side answer checking option for lessons (today answers are checked on the phone so lessons work offline).
- Better Bengali: ask testers which explanations are unclear; review the Bengali text with a teacher.
- Evaluation set grows from real reports (aim for 60 cases) and runs automatically before each release.

## v1.2 - More to learn and more ways to pay (about 2 to 3 months after launch)
- A second course: weeks 5 to 8 (A2 to B1 start), because levels now stop at A2.
- New AI Speak scenarios beyond the first ten: travel, school, interviews, meetings, workplace, explaining a problem, giving opinions, with their vocabulary and goals.
- Local payment options (for example mobile wallets in Bangladesh) through a provider that can notify the server, behind the same entitlement rules. Needs a decision on provider, fees and Google Play rules for digital goods.
- Pronunciation: pilot an audio scoring service for a small set of sounds that are hard for Bengali speakers, labelled clearly as a pilot. Only if a provider passes the privacy review (the app promises not to store recordings).
- Progress sharing with a teacher or family member (learner controlled).
- Notifications about review due and streaks (learner controlled).

## v2.0 - Bigger changes (6 months or more)
- B1 and B2 curriculum with adaptive paths.
- Teacher or tutor mode: classes, assigned lessons, teacher dashboard.
- Bengali interface option (today the interface is English by design; this would be a product decision).
- iOS app.
- Certificates or level checks that count (needs a proper assessment design; today the progress check is low-pressure with no pass or fail).
- Offline AI practice for basics.

## Decisions that need you
1. Opt-in or opt-out for usage statistics (default now: on, with a switch).
2. Retention days (placeholders 90, 180, 180, 365).
3. Free plan numbers (placeholders from Phase 9).
4. Whether to open an organisation Play account (skips the 12 testers rule, needs a D-U-N-S number).
5. Local payment provider.
