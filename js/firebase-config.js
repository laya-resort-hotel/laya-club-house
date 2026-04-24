const APP_VERSION = '2.2.0';
const PUBLIC_VAPID_KEY = '';

export const firebaseWebConfig = {
  apiKey: "AIzaSyDO1nqHOHzpwGgK9OhxlNAhZevUBsyprS8",
  authDomain: "laya-club-house.firebaseapp.com",
  projectId: "laya-club-house",
  storageBucket: "laya-club-house.firebasestorage.app",
  messagingSenderId: "458696969105",
  appId: "1:458696969105:web:e584a06395a37324bae830",
  measurementId: "G-2HLG605QZ9"
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
