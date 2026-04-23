import { loginGuestPortal } from './auth/auth-service.js';
import { appRuntimeConfig, firebaseBootError, firebaseReady, runtimeProjectId, runtimeLabel } from './firebase-init.js';
import { clearAppCache, installServiceWorker, qs } from './utils/helpers.js';
import { validateGuestLoginPayload } from './utils/validation.js';
import { initGlobalMonitoring, reportHandledError, reportOperationalEvent } from './services/monitoring-service.js';
import { runBusyAction } from './services/ui-feedback.js';

installServiceWorker();
initGlobalMonitoring(() => ({ route: 'guest_login', role: 'guest', userId: null }));

const form = qs('#guest-login-form');
const roomInput = qs('#guest-room');
const nameInput = qs('#guest-name');
const startInput = qs('#guest-stay-start');
const endInput = qs('#guest-stay-end');
const runtimeNode = qs('#guest-runtime-badge');
const helpNode = qs('#guest-mode-help');
const versionNode = qs('#guest-app-version');
const clearCacheLink = qs('#guest-clear-cache-link');
const feedbackNode = qs('#guest-feedback');

if (versionNode) versionNode.textContent = `v${appRuntimeConfig.appVersion}`;
if (runtimeNode) runtimeNode.textContent = `${runtimeLabel} • ${runtimeProjectId}`;
if (helpNode) {
  helpNode.textContent = firebaseBootError
    ? `Firebase boot error: ${firebaseBootError.message || firebaseBootError}`
    : firebaseReady
      ? 'Guest portal is connected. Sign in with room number and stay period.'
      : 'Guest portal is blocked until production Firebase is ready.';
}

const today = new Date();
const y = today.getFullYear();
const m = String(today.getMonth() + 1).padStart(2, '0');
const d = String(today.getDate()).padStart(2, '0');
const todayValue = `${y}-${m}-${d}`;
if (startInput && !startInput.value) startInput.value = todayValue;
if (endInput && !endInput.value) endInput.value = todayValue;
const submitButton = form?.querySelector('button[type="submit"]');
if (submitButton) submitButton.disabled = !firebaseReady;

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = form?.querySelector('button[type="submit"]');
  try {
    const payload = validateGuestLoginPayload({
      roomNo: roomInput?.value,
      stayStart: startInput?.value,
      stayEnd: endInput?.value,
      guestName: nameInput?.value
    });
    await runBusyAction({
      form,
      button: submitButton,
      feedbackNode,
      busyText: 'Opening portal...',
      action: async () => {
        await loginGuestPortal({ ...payload, language: 'en' });
        await reportOperationalEvent('guest_portal', 'session_created', { roomNo: payload.roomNo, stayEnd: payload.stayEnd });
      }
    });
    location.href = './index.html#home';
  } catch (error) {
    reportHandledError('guest_login_submit', error, { route: 'guest_login', roomNo: roomInput?.value || '' });
  }
});

clearCacheLink?.addEventListener('click', async (event) => {
  event.preventDefault();
  await clearAppCache();
  if (feedbackNode) { feedbackNode.hidden = false; feedbackNode.className = 'inline-feedback success'; feedbackNode.textContent = 'Cache cleared. Reload if you need the newest files.'; }
});
