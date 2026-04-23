$root = Split-Path -Parent $PSScriptRoot
Write-Host "[1/5] checking critical files"
@(
  "js/firebase-config.js",
  "firestore.rules",
  "storage.rules",
  "functions/index.js",
  "service-worker.js"
) | ForEach-Object {
  $path = Join-Path $root $_
  if (!(Test-Path $path)) { throw "Missing file: $_" }
}
Write-Host "[2/5] checking version sync"
if (-not (Select-String -Path (Join-Path $root "js/firebase-config.js") -Pattern "2.0.0" -Quiet)) { throw "firebase-config version mismatch" }
if (-not (Select-String -Path (Join-Path $root "README.md") -Pattern "2.0.0" -Quiet)) { throw "README version mismatch" }
Write-Host "[3/5] checking docs"
@(
  "docs/STAGING_TEST_PACK.md",
  "docs/UAT_FIX_PACK.md",
  "docs/UAT_SIGNOFF_TEMPLATE.md"
) | ForEach-Object {
  $path = Join-Path $root $_
  if (!(Test-Path $path)) { throw "Missing doc: $_" }
}
Write-Host "[4/5] checking production checklist"
if (!(Test-Path (Join-Path $root "docs/PRODUCTION_CHECKLIST.md"))) { throw "Missing production checklist" }
Write-Host "[5/5] basic smoke checks passed"
