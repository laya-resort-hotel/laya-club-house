# Smoke Test Checklist

## Login
- [ ] Login page shows Production badge
- [ ] Login succeeds with real Firebase account
- [ ] Login fails cleanly with wrong password
- [ ] Guest portal blocks when Firebase is unavailable

## Member
- [ ] Member card loads real balance / points
- [ ] QR renders locally without external API dependency
- [ ] Transaction list loads

## Admin
- [ ] Members list loads
- [ ] Create member works
- [ ] Edit member works
- [ ] Delete member works
- [ ] Rewards CRUD works
- [ ] Content CRUD works

## Scan
- [ ] Manual code input works
- [ ] Camera opens on supported browser
- [ ] Top-up request can be created and processed
- [ ] Deduct request can be created and processed
- [ ] Earn points request can be created and processed

## Guest Services
- [ ] HK request creates row
- [ ] Towel request creates row
- [ ] Chat thread opens and message sends
- [ ] Staff sees new rows in realtime

## Notifications
- [ ] Notification Center loads
- [ ] Unread badge updates
- [ ] Mark read works
- [ ] Mark all read works
