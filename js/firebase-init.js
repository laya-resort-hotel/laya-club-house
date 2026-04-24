import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";
import { firebaseWebConfig, appRuntimeConfig } from './firebase-config.js';

const firebaseConfig = firebaseWebConfig || {};
const demoModeEnabled = appRuntimeConfig.allowDemoMode === true;
const productionMode = String(appRuntimeConfig.deploymentStage || '').toLowerCase() === 'production';

const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

let app = null;
let auth = null;
let db = null;
let functions = null;
let storage = null;
let firebaseBootError = null;

if (hasFirebaseConfig) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    functions = getFunctions(app, appRuntimeConfig.functionsRegion || 'asia-southeast1');
    storage = getStorage(app);
  } catch (error) {
    firebaseBootError = error;
    console.error('Firebase boot failed', error);
  }
}

const firebaseReady = Boolean(app && auth && db && storage && functions);
const runtimeProjectId = firebaseConfig.projectId || 'unconfigured';
const runtimeLabel = productionMode ? 'Production' : (demoModeEnabled ? 'Demo' : 'Staging');

function assertProductionReady(context = 'This action') {
  if (firebaseReady) return true;
  if (demoModeEnabled) return false;
  const reason = firebaseBootError?.message || (!hasFirebaseConfig ? 'Firebase config is missing.' : 'Firebase failed to initialize.');
  throw new Error(`${context} is blocked because production Firebase is not ready. ${reason}`.trim());
}

export {
  app,
  auth,
  db,
  functions,
  storage,
  firebaseConfig,
  hasFirebaseConfig,
  firebaseBootError,
  runtimeProjectId,
  appRuntimeConfig,
  demoModeEnabled,
  productionMode,
  firebaseReady,
  runtimeLabel,
  assertProductionReady
};
