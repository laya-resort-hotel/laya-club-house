import { appRuntimeConfig } from '../firebase-init.js';
import { reportMonitoringEventCallable } from './function-service.js';

const RECENT_EVENTS = new Map();
let initialized = false;

function fingerprint(event = {}) {
  return [event.category, event.action, event.message, event.route].filter(Boolean).join('::');
}

function shouldSend(event = {}) {
  const key = fingerprint(event);
  if (!key) return true;
  const now = Date.now();
  const prev = RECENT_EVENTS.get(key) || 0;
  if (now - prev < 15000) return false;
  RECENT_EVENTS.set(key, now);
  return true;
}

async function send(event = {}) {
  if (!shouldSend(event)) return { ok: false, skipped: true };
  try {
    return await reportMonitoringEventCallable({
      ...event,
      appVersion: appRuntimeConfig.appVersion,
      deploymentStage: appRuntimeConfig.deploymentStage,
      href: location.href,
      userAgent: navigator.userAgent || ''
    });
  } catch (error) {
    console.warn('Monitoring event send failed', error);
    return { ok: false, reason: error?.message || 'monitoring_send_failed' };
  }
}

export async function reportMonitoringEvent(event = {}) {
  return send(event);
}

export async function reportHandledError(context = 'frontend', error, extra = {}) {
  const message = error?.message || String(error || 'Unknown error');
  return send({
    level: 'error',
    category: 'client_error',
    action: context,
    message,
    stack: error?.stack || '',
    ...extra
  });
}

export async function reportOperationalEvent(category, action, extra = {}) {
  return send({
    level: 'info',
    category,
    action,
    ...extra
  });
}

export function initGlobalMonitoring(getContext = () => ({})) {
  if (initialized) return;
  initialized = true;

  window.addEventListener('error', (event) => {
    reportHandledError('window_error', event.error || new Error(event.message || 'Unhandled error'), {
      route: getContext()?.route,
      file: event.filename || '',
      line: event.lineno || 0,
      column: event.colno || 0,
      userId: getContext()?.userId || null,
      role: getContext()?.role || null
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason || 'Unhandled promise rejection'));
    reportHandledError('unhandled_rejection', reason, {
      route: getContext()?.route,
      userId: getContext()?.userId || null,
      role: getContext()?.role || null
    });
  });
}
