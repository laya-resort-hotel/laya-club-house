#!/usr/bin/env bash
set -euo pipefail

echo "[1/4] Deploying Firebase backend..."
firebase deploy --only firestore:rules,firestore:indexes,storage,functions

echo "[2/4] Reminder: publish static web files to GitHub Pages or your static host."
echo "[3/4] Run smoke test checklist: docs/SMOKE_TEST_CHECKLIST.md"
echo "[4/4] Confirm service worker cache version matches app version."
