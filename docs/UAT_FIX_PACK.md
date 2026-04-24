# UAT Fix Pack

## Included in this pack
- Inline feedback on login and guest portal
- Busy-state protection on key forms
- Offline / online status badge in app shell
- Sticky offline banner for realtime/save risk
- Friendlier in-app toasts replacing several blocking alerts
- Safer submit flow for scan, HK, towel, and chat
- Staging test pack documentation
- Sign-off template and smoke scripts for handover

## User-facing changes
- Login no longer relies only on alert popups
- Guest portal shows inline validation/result feedback
- Scan lookup shows progress and friendly result messages
- HK/Towel/Chat submit buttons lock while sending
- App clearly shows when device is offline

## Operational changes
- Added staging smoke scripts in `ops/`
- Added sign-off template for UAT rounds
- Added route loading copy that explains if app is offline
