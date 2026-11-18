# Making a release build for Google Play (Phase 11)

You never need a computer. GitHub does the building; Play Console is a website.

## A. Make the upload key (once)
The upload key signs the files you upload. Google keeps the real app signing key (Play App Signing), so a lost upload key can be replaced, but protect it anyway.
1. GitHub > Actions > "Make upload key" > Run workflow. It makes a key and a short text file.
2. Open the run, download the artifact `upload-key` (valid for 1 day) to your phone. Unzip it. You get `upload.jks.base64.txt` and `key-details.txt`.
3. GitHub > Settings > Secrets and variables > Actions > New repository secret, four times:
   - `ANDROID_KEYSTORE_BASE64`: the whole content of `upload.jks.base64.txt`
   - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`: from `key-details.txt`
4. Save a copy of both files in a place only you control (password manager or encrypted storage). Then delete the artifact in GitHub (the run page > delete artifact) and the files from your phone Downloads.
5. Anyone with access to your repository secrets can build signed releases. Keep the repository private and the collaborator list short.

## B. Play Console (once)
1. Create the app. Choose "App", "Free", enable Play App Signing when asked.
2. Fill: store listing, privacy policy URL (`docs/privacy-policy-draft.md`), Data safety (see `docs/privacy.md`), content rating, target audience (adults), ads (none), app access (explain that testers need an account or can use guest mode).
3. Subscriptions: follow `docs/billing-and-limits.md` (products, service account, Pub/Sub). Then set the repository variable `ENABLE_BILLING` to `true`.
4. Testing > Internal testing: create a list of testers by email. Testing > Closed testing: create a track and a tester list (see `docs/closed-beta.md`). Setup > License testing: add tester emails so purchases are free.

## C. Each build
1. GitHub > Actions > Tests must be green. Run "AI evaluation": PASSED.
2. Update the version in `package.json` and `www/src/config.js` (`APP_VERSION`) if you want a new visible version number. The Play version code goes up by itself with every run.
3. Actions > "Release build" > Run workflow. It runs all tests, then builds and signs `spoken-english-release.aab`. Download the artifact.
4. Play Console > Testing > Internal (or Closed) > Create new release > upload the `.aab` > add release notes > Save > Review > Start rollout.
5. Testers get the update from the Play Store. Check `docs/qa.md` device checks on the Play build, not the debug APK, because purchases and the notification permission only work on the Play build.

## D. What cannot be tested earlier
Real purchases, real renewal and cancellation notifications, and the Play review need a Play build. Nothing in this repository has run against the real Google Play yet (`progress.md` says so).

## Troubleshooting
- "Version code already used": run the workflow again; the number grows with each run.
- "The upload key does not match": you used a different key than the first upload. Ask Play Console support to reset the upload key.
- Build fails at the sed line for the manifest: open the run log; the Capacitor template may have changed. Send the lines around the error.
