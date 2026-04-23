export function money(value = 0) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export function points(value = 0) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

export function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

export function qsa(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

export function installServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}

export async function clearAppCache() {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

export function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatRelativeTime(value) {
  const timestamp = toMillis(value);
  if (!timestamp) return '-';
  const diffMinutes = Math.round((Date.now() - timestamp) / 60000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day ago`;
}

export function formatDateTime(value) {
  const timestamp = toMillis(value);
  if (!timestamp) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp));
}

export function titleize(value = '') {
  return String(value || '')
    .replaceAll('_', ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function isAdminLike(role = '') {
  return ['super_admin', 'admin'].includes(role);
}

export function isStaffLike(role = '') {
  return ['super_admin', 'admin', 'staff', 'finance_staff', 'fo_staff', 'hk_staff', 'fb_staff', 'fitness_staff', 'department_manager'].includes(role);
}

export function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function initials(name = '') {
  const text = String(name || '').trim();
  if (!text) return '?';
  const parts = text.split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

export async function playAlertTone(options = {}) {
  const times = Number(options.times || 2);
  const duration = Number(options.duration || 0.12);
  const gap = Number(options.gap || 0.08);
  const frequency = Number(options.frequency || 880);
  const volume = Number(options.volume || 0.03);

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();
  const playOnce = (offsetSeconds) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const startAt = ctx.currentTime + offsetSeconds;
    osc.start(startAt);
    osc.stop(startAt + duration);
  };

  for (let i = 0; i < times; i += 1) {
    playOnce(i * (duration + gap));
  }

  const endDelay = Math.max(250, (times * (duration + gap) * 1000) + 100);
  setTimeout(() => {
    ctx.close().catch(() => {});
  }, endDelay);
}
