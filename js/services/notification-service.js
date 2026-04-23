import { getMessaging, getToken, isSupported, onMessage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js";
import { app, appRuntimeConfig, hasFirebaseConfig } from '../firebase-init.js';
import { registerPushTokenCallable } from './function-service.js';
let foregroundUnsubscribe = null;
export async function pushMessagingAvailable() { if (!hasFirebaseConfig || !appRuntimeConfig.enablePush || !app) return false; if (!('Notification' in window) || !('serviceWorker' in navigator)) return false; try { return await isSupported(); } catch { return false; } }
export async function requestPushPermissionAndRegister(user = {}) {
  if (!(await pushMessagingAvailable())) return { ok: false, reason: 'Push messaging is not supported on this browser.' };
  if (!appRuntimeConfig.publicVapidKey) return { ok: false, reason: 'Missing publicVapidKey in js/firebase-config.js.' };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: `Notification permission is ${permission}.` };
  const registration = await navigator.serviceWorker.register('./service-worker.js');
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: appRuntimeConfig.publicVapidKey, serviceWorkerRegistration: registration });
  if (!token) return { ok: false, reason: 'No push token returned from Firebase Messaging.' };
  await registerPushTokenCallable({ token, language: user.language || navigator.language || 'en', roomNo: user.roomNo || null, department: user.department || null, userAgent: navigator.userAgent || '' });
  return { ok: true, token };
}
export async function subscribeForegroundPush(onPayload) { if (!(await pushMessagingAvailable())) return () => {}; await navigator.serviceWorker.register('./service-worker.js').catch(() => null); const messaging = getMessaging(app); if (foregroundUnsubscribe) foregroundUnsubscribe(); foregroundUnsubscribe = onMessage(messaging, (payload) => onPayload?.(payload)); return () => { foregroundUnsubscribe?.(); foregroundUnsubscribe = null; }; }
