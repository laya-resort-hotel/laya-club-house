# Firestore Schema Overview

## Core collections
- `users`
- `cards`
- `wallet_accounts`
- `wallet_transactions`
- `point_accounts`
- `point_transactions`
- `rewards`
- `redemptions`
- `guest_sessions`
- `hk_requests`
- `towel_requests`
- `chat_threads`
- `chat_messages`
- `notifications`
- `scan_logs`
- `content_links`
- `content_banners`
- `system_settings`
- `app_versions`
- `audit_logs`

## Key idea
Sensitive financial writes should eventually move to Cloud Functions.  
This starter ruleset allows a secure-enough first phase while keeping the app practical to build.
