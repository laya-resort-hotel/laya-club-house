Write-Host "[1/4] Deploying Firebase backend..."
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
Write-Host "[2/4] Publish static web files to GitHub Pages or your static host."
Write-Host "[3/4] Run smoke test checklist: docs/SMOKE_TEST_CHECKLIST.md"
Write-Host "[4/4] Confirm service worker cache version matches app version."
