import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { auth, db, demoModeEnabled, firebaseReady, assertProductionReady, runtimeProjectId } from '../firebase-init.js';
import { demoUsers } from '../demo-data.js';
import { createGuestPortalSessionCallable, registerSelfMemberCallable } from '../services/function-service.js';

const SESSION_KEY = 'laya-card-session';
const EMPLOYEE_AUTH_DOMAIN = `employee.${runtimeProjectId}.local`;

function normalizeEmployeeId(value = '') {
  return String(value || '').trim().toUpperCase();
}

function employeeIdToAuthEmail(value = '') {
  const employeeId = normalizeEmployeeId(value);
  return employeeId ? `${employeeId}@${EMPLOYEE_AUTH_DOMAIN}`.toLowerCase() : '';
}

function isEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function resolveAuthLogin(value = '') {
  const text = String(value || '').trim();
  if (!text) return { identifier: '', employeeId: '', authEmail: '' };
  if (isEmail(text)) return { identifier: text.toLowerCase(), employeeId: '', authEmail: text.toLowerCase() };
  const employeeId = normalizeEmployeeId(text);
  return { identifier: employeeId, employeeId, authEmail: employeeIdToAuthEmail(employeeId) };
}


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

export async function loginWithFirebase(identifier, password) {
  assertProductionReady('Login');
  const { authEmail } = resolveAuthLogin(identifier);
  const credential = await signInWithEmailAndPassword(auth, authEmail, password);
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


export async function signUpMember({ firstName, lastName = '', phone = '', employeeId = '', password, language = 'en' }) {
  assertProductionReady('Sign up');
  const safeFirstName = String(firstName || '').trim();
  const safeLastName = String(lastName || '').trim();
  const safeEmployeeId = normalizeEmployeeId(employeeId);
  const safePublicEmail = '';
  const authEmail = safeEmployeeId ? employeeIdToAuthEmail(safeEmployeeId) : safePublicEmail;
  const safeDisplayName = [safeFirstName, safeLastName].filter(Boolean).join(' ').trim() || safeEmployeeId || authEmail?.split('@')[0] || 'Member';
  const credential = await createUserWithEmailAndPassword(auth, authEmail, String(password || ''));
  await updateProfile(credential.user, { displayName: safeDisplayName }).catch(() => null);
  let result;
  try {
    result = await registerSelfMemberCallable({
      firstName: safeFirstName,
      lastName: safeLastName,
      displayName: safeDisplayName,
      phone: String(phone || '').trim(),
      employeeId: safeEmployeeId,
      email: safePublicEmail,
      language: String(language || 'en')
    });
  } catch (error) {
    await deleteUser(credential.user).catch(() => null);
    throw error;
  }
  const profile = result?.profile || await fetchProfile(credential.user.uid, { ...credential.user, displayName: safeDisplayName, email: safePublicEmail || '' });
  const payload = {
    mode: 'production',
    uid: credential.user.uid,
    email: profile?.email || safePublicEmail || '',
    profile
  };
  saveSession(payload);
  return payload;
}

export async function login(identifier, password) {
  if (!firebaseReady) {
    if (demoModeEnabled) return loginDemo('member');
    throw new Error('Login is blocked because production Firebase is not ready.');
  }
  return loginWithFirebase(identifier, password);
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
      email: profile?.email || '',
      profile
    };
    saveSession(payload);
    cb(payload);
  });
}
