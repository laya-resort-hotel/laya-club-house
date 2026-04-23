import { login, loginDemo } from './auth/auth-service.js';
import { appRuntimeConfig, firebaseBootError, firebaseReady, runtimeProjectId, runtimeLabel, demoModeEnabled } from './firebase-init.js';
import { clearAppCache, installServiceWorker, qs, qsa } from './utils/helpers.js';
import { validateLoginPayload } from './utils/validation.js';
import { initGlobalMonitoring, reportHandledError, reportOperationalEvent } from './services/monitoring-service.js';
import { runBusyAction } from './services/ui-feedback.js';

installServiceWorker();
initGlobalMonitoring(() => ({ route: 'login', role: 'public', userId: null }));

const form = qs('#login-form');
const emailInput = qs('#email');
const passwordInput = qs('#password');
const clearCacheLink = qs('#clear-cache-link');
const installAppLink = qs('#install-app-link');
const appVersionNode = qs('#app-version');
const runtimeNode = qs('#runtime-badge');
const modeHelpNode = qs('#mode-help');
const demoSection = qs('#demo-section');
const feedbackNode = qs('#login-feedback');
let deferredPrompt = null;

if (appVersionNode) appVersionNode.textContent = `v${appRuntimeConfig.appVersion}`;
if (runtimeNode) runtimeNode.textContent = `${runtimeLabel} • ${runtimeProjectId}`;
if (modeHelpNode) {
  modeHelpNode.textContent = firebaseBootError
    ? `Firebase boot error: ${firebaseBootError.message || firebaseBootError}`
    : firebaseReady
      ? 'Production Firebase is connected. Sign in with a real account from this project, or open the separate guest portal below.'
      : 'Production login is blocked until Firebase config and services are ready.';
}
if (demoSection) demoSection.hidden = !demoModeEnabled;
if (form) {
  const disabled = !firebaseReady && !demoModeEnabled;
  qsa('input', form).forEach((node) => { node.disabled = disabled; });
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = disabled;
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = form?.querySelector('button[type="submit"]');
  try {
    validateLoginPayload({ email: emailInput?.value, password: passwordInput?.value });
    await runBusyAction({
      form,
      button: submitButton,
      feedbackNode,
      busyText: 'Signing in...',
      action: async () => {
        await login(emailInput.value.trim(), passwordInput.value);
        await reportOperationalEvent('auth', 'login_success', { emailDomain: emailInput.value.split('@')[1] || '' });
      }
    });
    location.href = './index.html#home';
  } catch (error) {
    reportHandledError('login_submit', error, { route: 'login' });
  }
});

qsa('[data-demo-role]').forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      await loginDemo(button.dataset.demoRole);
      location.href = './index.html#home';
    } catch (error) {
      reportHandledError('demo_login', error, { route: 'login' });
      if (feedbackNode) { feedbackNode.hidden = false; feedbackNode.className = 'inline-feedback error'; feedbackNode.textContent = error?.message || 'Demo login is unavailable.'; }
    }
  });
});

clearCacheLink?.addEventListener('click', async (event) => {
  event.preventDefault();
  await clearAppCache();
  if (feedbackNode) { feedbackNode.hidden = false; feedbackNode.className = 'inline-feedback success'; feedbackNode.textContent = 'Cache cleared. Reload if you need the newest files.'; }
});

installAppLink?.addEventListener('click', async (event) => {
  event.preventDefault();
  if (!deferredPrompt) {
    if (feedbackNode) { feedbackNode.hidden = false; feedbackNode.className = 'inline-feedback info'; feedbackNode.textContent = 'Install prompt is not available yet on this browser.'; }
    return;
  }
  await deferredPrompt.prompt();
  deferredPrompt = null;
});
