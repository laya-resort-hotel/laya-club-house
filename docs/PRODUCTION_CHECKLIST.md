# Production Checklist

## Configuration
- [ ] Confirm `deploymentStage` = `production`
- [ ] Confirm `allowDemoMode` = `false`
- [ ] Confirm Firebase web config matches production project
- [ ] Confirm `functionsRegion` matches deployed functions region
- [ ] Add `publicVapidKey`
- [ ] Set `enablePush` = `true` after VAPID key is added

## Deploy
- [ ] Deploy Firestore rules
- [ ] Deploy Firestore indexes
- [ ] Deploy Storage rules
- [ ] Deploy Cloud Functions
- [ ] Clear old service worker cache on test devices

## Validation
- [ ] Staff login works
- [ ] Guest portal login works
- [ ] Home / Member / Redeem routes load without demo data
- [ ] Admin CRUD reads real Firestore rows
- [ ] Scan Center processes real requests
- [ ] HK / Towel / Chat update in realtime
- [ ] Notifications appear in-app
- [ ] Push works in foreground
- [ ] Push works in background

## Rollout safety
- [ ] Rollback ZIP prepared
- [ ] Admin tester assigned
- [ ] FO tester assigned
- [ ] HK tester assigned
- [ ] Incident contact list prepared
