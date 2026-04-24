# Staging Test Pack

## Purpose
Use this pack before pilot or production rollout to validate the full LAYA Card & Member System on a staging Firebase project.

## Test Accounts
Prepare at least these accounts before starting:
- Admin
- Staff (FO)
- Staff (HK)
- Guest room session
- Member card holder

## Core Test Matrix

### A. Authentication
1. Login with valid admin credentials
2. Login with invalid password
3. Guest login with valid room + stay period
4. Guest login with invalid room format
5. Guest login with check-out before check-in

### B. Member / Wallet / Points
1. Open member page
2. Confirm QR renders locally
3. Top-up via scan request + process
4. Deduct via scan request + process
5. Earn points via scan request + process
6. Confirm transaction history updates

### C. Rewards
1. Create reward from admin
2. Redeem from member page
3. Fulfill redemption from staff flow
4. Confirm points deduct once only

### D. Guest Services
1. Create HK request
2. Update HK request status
3. Create towel request
4. Return towel request
5. Confirm realtime updates on two devices

### E. Chat
1. Guest opens thread to FO
2. Staff sees new thread in realtime
3. Staff replies
4. Guest receives reply in realtime
5. Assign thread to staff
6. Close and reopen thread

### F. Notifications
1. In-app notification appears for new HK request
2. In-app notification appears for towel request
3. In-app notification appears for chat message
4. Mark one notification read
5. Mark all notifications read

### G. Admin CRUD
1. Create member
2. Edit member
3. Create reward
4. Edit reward
5. Create content link/banner
6. Delete reward / content using safe delete prompts

### H. Media Upload
1. Upload member profile image
2. Upload reward image
3. Upload banner image
4. Confirm image renders after reload

### I. Resilience
1. Turn browser offline and attempt save
2. Confirm app shows offline status
3. Restore network and retry
4. Confirm button busy states prevent double submit

## Sign-off Criteria
- No blocker in auth, wallet, points, reward, HK, towel, chat
- No duplicate transactions from repeated clicks
- No silent errors
- No route fails to render
- No critical console errors during main flows
