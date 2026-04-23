Write-Host "Restore the previous known-good firebase files first: firestore.rules, firestore.indexes.json, storage.rules, functions/index.js"
Write-Host "Then run: firebase deploy --only firestore:rules,firestore:indexes,storage,functions"
