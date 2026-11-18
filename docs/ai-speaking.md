# AI speaking coach (Phase 7)

## Mistake records (Phase 8)
Each correction is stored as one mistake record with the key `sp:` plus the corrected sentence in lower case (letters, digits and apostrophes only). The phone and the server use the same key (`speakMistakeId` in `www/src/engine/mistakes.js`), so one correction is one record on every device. A resolved mistake that comes back is reopened.

## How a turn works (turn-based, plan section 9)
1. The learner signs in and starts a session. The server checks identity and closes any older active session.
2. The learner taps the microphone (the app asks permission first). Up to 30 seconds are recorded in memory. Typing is always available.
3. The server sends the recording to the speech-to-text provider for this one request. The recording is never stored by us. If nothing is heard, the turn is not charged.
4. Before an AI call the server checks the daily turn limit.
5. The coach (Claude, called from the server only) gets the scenario, the learner level, the last 8 turns and the text. It must answer through a fixed tool schema. The server then checks every field: allowed error types, lengths, Bengali explanation present, original and corrected text actually different. Invalid output is retried once and then reported as unavailable. Nothing invalid reaches the app.
6. The reply is saved with the turn, usage is written to the ledger (idempotent), the correction is added to the learner's mistake record, and the app reads the reply aloud with the phone voice.

## Tutor policy built into the prompt
Simple English for the level, one correction per turn at most, communication first, Bengali explanations, retry of the corrected sentence, informal English accepted, no single "correct" accent, asks to repeat when the text looks unclear, never scores pronunciation, no sensitive personal data requests, and the learner's words are treated as data, not instructions.

## Pronunciation and fluency (plan section 6.4)
The app shows which words the recognizer heard or missed, and, when the recording is long enough, words per minute and long pauses. It does not give a pronunciation score because no pronunciation scoring service is connected. Do not add one without audio-based assessment.

## Privacy
Audio: sent for transcription only, never stored. Own-recording playback happens on the phone and is discarded when the session closes. Transcripts and corrections are stored on the account and removed when the account is deleted. Logs contain error codes, not what the learner said. The coach never receives name, email or other account details.

## Cost controls
Repeat and review modes do not call the AI. The coach model is small by default. Daily turn limit and speech seconds are recorded in `usage_ledger` for Phase 9.
