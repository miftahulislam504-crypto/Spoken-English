# Spoken English App

AI spoken-English learning app for Bengali speakers. UI is English; teaching support is Bengali.
See `progress.md` for what is done and what remains.

- Web app: static files in `www/` (no build step). Vercel serves `www/` (see `vercel.json`).
- Android: Capacitor wraps `www/`. Run the "Build Android APK" workflow in GitHub Actions and download the APK artifact.
- UI strings: `www/src/i18n/en.js`. Lesson content: `www/src/content/`. Never hardcode UI text in screens.
- Audio: see `docs/audio-licensing.md` before adding any recorded audio.
- Plans, Google Play purchases, limits, budgets and monitoring: `docs/billing-and-limits.md`.
- Learning rules (mistakes, review schedule, levels, recommendations): `docs/learning-engine.md`. Tests: `npm test` (also run by GitHub Actions on every change).
- Admin dashboard (roles, content, AI, plans, learners, analytics, audit log): open `/admin/` on your site; guide in `docs/admin.md`.
- Privacy, retention, data download and deletion: `docs/privacy.md`. Usage events: `docs/analytics-events.md`.
- Running the app (monitoring, backups, firewall, problems): `docs/runbook.md`. Quality checks and device checks: `docs/qa.md`.
- Release and closed beta: `docs/release.md`, `docs/closed-beta.md`, `docs/mvp-acceptance.md`. After launch: `docs/roadmap.md`.
- What to do after Phase 10 and 11, step by step: `docs/phase-10-11-setup.md`.
