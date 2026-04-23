#!/usr/bin/env bash
set -euo pipefail

echo "Restore the previous known-good firebase files first: firestore.rules, firestore.indexes.json, storage.rules, functions/index.js"
echo "Then run: firebase deploy --only firestore:rules,firestore:indexes,storage,functions"
