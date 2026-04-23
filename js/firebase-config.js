const APP_VERSION = '2.0.0';
const PUBLIC_VAPID_KEY = '';

export const firebaseWebConfig = {
  apiKey: "AIzaSyDReH8ZE8BLdSSEKoxAL4nppZOd6kO00rA",
  authDomain: "service-c93f2.firebaseapp.com",
  projectId: "service-c93f2",
  storageBucket: "service-c93f2.firebasestorage.app",
  messagingSenderId: "1011741219243",
  appId: "1:1011741219243:web:0bbaa94adcb97723efdaee",
  measurementId: "G-L0X403JZ5N"
};

export const appRuntimeConfig = {
  functionsRegion: 'asia-southeast1',
  appVersion: APP_VERSION,
  appName: 'LAYA Card & Member System',
  deploymentStage: 'production',
  allowDemoMode: false,
  publicVapidKey: PUBLIC_VAPID_KEY,
  enablePush: Boolean(PUBLIC_VAPID_KEY),
  qrGeneration: 'local-svg',
  requireFirebaseForLogin: true
};
