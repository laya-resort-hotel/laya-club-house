# LAYA Card & Member System — Staging Test Pack + UAT Fix Pack (v2.0.0)

ชุดนี้เป็น **Staging Test Pack + UAT Fix Pack** สำหรับยกระดับจาก hardening phase ไปสู่รอบทดสอบหน้างานจริงมากขึ้น โดยเน้นความพร้อมของระบบ, การทดสอบเป็นขั้นตอน, และการลด pain point ใน UAT

## สิ่งที่แก้ในรอบนี้
- ปิด **demo mode** ใน production path (`allowDemoMode: false`)
- หน้า login / guest portal จะ **fail closed** ถ้า Firebase production ไม่พร้อม
- sync เวอร์ชันเป็น `2.0.0`
- sync service worker cache key เป็น `laya-card-scaffold-v2-0-0`
- เพิ่ม scanner fallback ให้ใช้ `BarcodeDetector` ก่อน แล้ว fallback ไป `html5-qrcode` อัตโนมัติ
- เพิ่ม validation เข้มขึ้นใน login / guest portal / scan / admin / HK / towel / chat
- เพิ่ม safe delete flow แบบพิมพ์ `DELETE` หรือ `PURGE`
- เพิ่ม monitoring hooks ฝั่ง frontend + Cloud Functions (`monitoring_events`, `system_alerts`)
- เพิ่ม deploy / rollback runbook และสคริปต์ในโฟลเดอร์ `ops/`

## ไฟล์สำคัญที่แก้
- `js/firebase-config.js`
- `js/firebase-init.js`
- `js/auth/auth-service.js`
- `js/login-page.js`
- `js/guest-page.js`
- `js/utils/qrcode.js`
- `js/components/digital-card.js`
- `js/app.js`
- `js/services/data-service.js`
- `service-worker.js`

## Runtime config สำคัญ
เปิดไฟล์ `js/firebase-config.js`

```js
export const appRuntimeConfig = {
  functionsRegion: 'asia-southeast1',
  appVersion: '2.0.0',
  appName: 'LAYA Card & Member System',
  deploymentStage: 'production',
  allowDemoMode: false,
  publicVapidKey: '',
  enablePush: false,
  qrGeneration: 'local-svg',
  requireFirebaseForLogin: true
};
```

## สิ่งที่ยังต้องใส่เองก่อนเปิด push notification
คุณยังต้องนำ **Web Push certificate key (VAPID public key)** จาก Firebase Console มาใส่ใน
- `js/firebase-config.js` → `publicVapidKey`

เมื่อใส่แล้วให้ตั้ง
- `enablePush: true`

## Deploy ขั้นต่ำ
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

## สถานะหลังรอบนี้
- เหมาะกับ **staging / internal testing / UAT prep**
- ยังควรทำ E2E tests และ operational checklist ก่อน go-live จริง

## เอกสารและสคริปต์ที่ควรเปิดต่อ
- `docs/PRODUCTION_CHECKLIST.md`
- `docs/SMOKE_TEST_CHECKLIST.md`
- `ops/DEPLOY_ROLLBACK_RUNBOOK.md`
- `ops/deploy-production.sh`
- `ops/deploy-production.ps1`


## เอกสารรอบนี้เพิ่ม
- `docs/STAGING_TEST_PACK.md`
- `docs/UAT_FIX_PACK.md`
- `docs/UAT_SIGNOFF_TEMPLATE.md`
- `ops/staging-smoke.sh`
- `ops/staging-smoke.ps1`
