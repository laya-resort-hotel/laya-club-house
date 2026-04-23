# Deploy / Rollback Runbook

## Production deploy
1. Confirm `js/firebase-config.js` has the correct project and VAPID key.
2. Confirm `service-worker.js`, `README.md`, and `js/firebase-config.js` versions match.
3. Run local smoke test from `docs/SMOKE_TEST_CHECKLIST.md`.
4. Deploy:
   - `firebase deploy --only firestore:rules,firestore:indexes,storage,functions`
   - upload static files to GitHub Pages branch or hosting target
5. Open the production URL and verify:
   - login
   - guest portal login
   - member card
   - scan center camera
   - admin CRUD
   - HK / towel / chat realtime
   - notifications center

## Hot rollback
Use rollback when the newest static build is bad but Firebase backend is still healthy.
1. Restore the previous static build in GitHub Pages.
2. Bump `service-worker.js` cache key to force clients to refresh.
3. Ask users to use Settings → Clear Cache or hard-refresh.

## Full rollback
Use rollback when rules/functions caused the failure.
1. Restore previous known-good files for:
   - `firestore.rules`
   - `firestore.indexes.json`
   - `storage.rules`
   - `functions/index.js`
2. Redeploy Firebase resources.
3. Restore previous static build.
4. Run smoke test again.
