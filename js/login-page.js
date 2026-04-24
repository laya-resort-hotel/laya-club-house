import { login, loginDemo, signUpMember } from './auth/auth-service.js';
import { appRuntimeConfig, firebaseBootError, firebaseReady, runtimeProjectId, runtimeLabel, demoModeEnabled } from './firebase-init.js';
import { clearAppCache, installServiceWorker, qs, qsa } from './utils/helpers.js';
import { validateLoginPayload, validateSignupPayload } from './utils/validation.js';
import { initGlobalMonitoring, reportHandledError, reportOperationalEvent } from './services/monitoring-service.js';
import { runBusyAction } from './services/ui-feedback.js';

installServiceWorker();
initGlobalMonitoring(() => ({ route: 'login', role: 'public', userId: null }));

const form = qs('#login-form');
const signupForm = qs('#signup-form');
const emailInput = qs('#email');
const passwordInput = qs('#password');
const signupFirstNameInput = qs('#signup-first-name');
const signupLastNameInput = qs('#signup-last-name');
const signupPhoneInput = qs('#signup-phone');
const signupEmployeeIdInput = qs('#signup-employee-id');
const signupEmailInput = qs('#signup-email');
const signupPasswordInput = qs('#signup-password');
const signupConfirmPasswordInput = qs('#signup-confirm-password');
const clearCacheLink = qs('#clear-cache-link');
const installAppLink = qs('#install-app-link');
const appVersionNode = qs('#app-version');
const runtimeNode = qs('#runtime-badge');
const modeHelpNode = qs('#mode-help');
const authTitleNode = qs('#auth-title');
const demoSection = qs('#demo-section');
const feedbackNode = qs('#login-feedback');
const signupFeedbackNode = qs('#signup-feedback');
const loginView = qs('#login-view');
const signupView = qs('#signup-view');
const authSwitchButtons = qsa('[data-auth-view]');
let deferredPrompt = null;

function setAuthView(view = 'login') {
  const loginActive = view !== 'signup';
  if (loginView) {
    loginView.hidden = !loginActive;
    loginView.classList.toggle('active', loginActive);
    loginView.setAttribute('aria-hidden', String(!loginActive));
  }
  if (signupView) {
    signupView.hidden = loginActive;
    signupView.classList.toggle('active', !loginActive);
    signupView.setAttribute('aria-hidden', String(loginActive));
  }
  if (authTitleNode) {
    authTitleNode.textContent = loginActive ? 'Welcome back' : 'Create account';
  }
  if (modeHelpNode) {
    modeHelpNode.textContent = firebaseBootError
      ? `Firebase boot error: ${firebaseBootError.message || firebaseBootError}`
      : loginActive
        ? (firebaseReady
            ? 'Production Firebase is connected. Sign in with your account to access your card, balance, rewards, and service pages.'
            : 'Production login is blocked until Firebase config and services are ready.')
        : (firebaseReady
            ? 'Create a new account with email or employee ID. After signup, the system will prepare your member profile automatically.'
            : 'Account creation is blocked until Firebase config and services are ready.');
  }
  if (feedbackNode) feedbackNode.hidden = true;
  if (signupFeedbackNode) signupFeedbackNode.hidden = true;
  authSwitchButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.authView === (loginActive ? 'login' : 'signup'));
  });
}

if (appVersionNode) appVersionNode.textContent = `v${appRuntimeConfig.appVersion}`;
if (runtimeNode) runtimeNode.textContent = `${runtimeLabel} • ${runtimeProjectId}`;
if (demoSection) demoSection.hidden = !demoModeEnabled;
if (form) {
  const disabled = !firebaseReady && !demoModeEnabled;
  qsa('input', form).forEach((node) => { node.disabled = disabled; });
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = disabled;
}
if (signupForm) {
  const disabled = !firebaseReady;
  qsa('input', signupForm).forEach((node) => { node.disabled = disabled; });
  const submitButton = signupForm.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = disabled;
}

setAuthView('login');

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
});

authSwitchButtons.forEach((button) => {
  button.addEventListener('click', () => setAuthView(button.dataset.authView || 'login'));
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = form?.querySelector('button[type="submit"]');
  try {
    const loginPayload = validateLoginPayload({ identifier: emailInput?.value, password: passwordInput?.value });
    await runBusyAction({
      form,
      button: submitButton,
      feedbackNode,
      busyText: 'Signing in...',
      action: async () => {
        await login(loginPayload.identifier, passwordInput.value);
        await reportOperationalEvent('auth', 'login_success', { loginType: loginPayload.identifier.includes('@') ? 'email' : 'employee_id' });
      }
    });
    location.href = './index.html#home';
  } catch (error) {
    reportHandledError('login_submit', error, { route: 'login' });
  }
});

signupForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = signupForm?.querySelector('button[type="submit"]');
  try {
    const payload = validateSignupPayload({
      firstName: signupFirstNameInput?.value,
      lastName: signupLastNameInput?.value,
      phone: signupPhoneInput?.value,
      employeeId: signupEmployeeIdInput?.value,
      email: signupEmailInput?.value,
      password: signupPasswordInput?.value,
      confirmPassword: signupConfirmPasswordInput?.value
    });
    await runBusyAction({
      form: signupForm,
      button: submitButton,
      feedbackNode: signupFeedbackNode,
      busyText: 'Creating account...',
      successMessage: 'Account created successfully. Redirecting...',
      action: async () => {
        await signUpMember({
          ...payload,
          password: signupPasswordInput.value,
          language: navigator.language?.slice(0, 2) || 'en'
        });
        await reportOperationalEvent('auth', 'signup_success', { signupMethod: payload.employeeId ? (payload.email ? 'email_and_employee_id' : 'employee_id') : 'email' });
      }
    });
    location.href = './index.html#home';
  } catch (error) {
    reportHandledError('signup_submit', error, { route: 'login' });
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
