import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { auth, db, demoModeEnabled, firebaseReady, assertProductionReady } from '../firebase-init.js';
import { demoUsers } from '../demo-data.js';
import { createGuestPortalSessionCallable } from '../services/function-service.js';

const SESSION_KEY = 'laya-card-session';

function saveSession(payload) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function fetchProfile(uid, fallbackUser = null) {
  if (!db) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  if (snap.exists()) return { uid, ...snap.data() };
  if (!fallbackUser) return null;
  return {
    uid,
    role: 'member',
    department: null,
    displayName: fallbackUser.displayName || fallbackUser.email?.split('@')[0] || 'User',
    firstName: fallbackUser.displayName || fallbackUser.email?.split('@')[0] || 'User',
    lastName: '',
    email: fallbackUser.email || '',
    cardType: 'team_member',
    cardColor: 'white',
    cardLevel: 1,
    status: 'active',
    language: 'en',
    roomNo: null,
    balance: 0,
    points: 0,
    profileMissing: true
  };
}

export async function loginWithFirebase(email, password) {
  assertProductionReady('Login');
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;
  const profile = await fetchProfile(uid, credential.user);

  const payload = {
    mode: 'production',
    uid,
    email: credential.user.email || '',
    profile
  };

  saveSession(payload);
  return payload;
}

export async function loginDemo(role = 'member') {
  if (!demoModeEnabled) {
    throw new Error('Demo login is disabled in production mode.');
  }
  const profile = demoUsers[role] || demoUsers.member;
  const payload = {
    mode: 'demo',
    uid: profile.uid,
    email: profile.email || '',
    profile
  };
  saveSession(payload);
  return payload;
}

export async function loginGuestPortal({ roomNo, stayStart, stayEnd, guestName = '', language = 'en' }) {
  if (!firebaseReady) {
    if (demoModeEnabled) {
      const profile = {
        ...demoUsers.guest,
        roomNo: String(roomNo || '').trim().toUpperCase(),
        stayStart,
        stayEnd,
        guestExpiryAt: `${stayEnd}T12:00:00+07:00`,
        displayName: guestName?.trim() || `Room ${String(roomNo || '').trim().toUpperCase()}`
      };
      const payload = { mode: 'demo', uid: profile.uid, email: profile.email || '', profile };
      saveSession(payload);
      return payload;
    }
    throw new Error('Guest portal is blocked because production Firebase is not ready.');
  }

  const credential = await signInAnonymously(auth);
  const result = await createGuestPortalSessionCallable({ roomNo, stayStart, stayEnd, guestName, language });
  const payload = {
    mode: 'production',
    uid: credential.user.uid,
    email: '',
    profile: result?.profile || {
      uid: credential.user.uid,
      role: 'guest',
      displayName: guestName?.trim() || `Room ${String(roomNo || '').trim().toUpperCase()}`,
      roomNo: String(roomNo || '').trim().toUpperCase(),
      stayStart,
      stayEnd,
      guestExpiryAt: `${stayEnd}T12:00:00+07:00`,
      cardType: 'guest_point',
      cardColor: 'red',
      cardLevel: 0,
      status: 'active',
      language
    },
    guestPortal: true
  };
  saveSession(payload);
  return payload;
}

export async function login(email, password) {
  if (!firebaseReady) {
    if (demoModeEnabled) return loginDemo('member');
    throw new Error('Login is blocked because production Firebase is not ready.');
  }
  return loginWithFirebase(email, password);
}

export async function logout() {
  if (auth) {
    await signOut(auth);
  }
  clearSession();
}

export function subscribeAuth(cb) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      cb(null);
      return;
    }
    const profile = await fetchProfile(user.uid, user);
    const payload = {
      mode: demoModeEnabled ? 'demo' : 'production',
      uid: user.uid,
      email: user.email || '',
      profile
    };
    saveSession(payload);
    cb(payload);
  });
}
