import { renderDigitalCard } from '../components/digital-card.js';
import { formatRelativeTime, money, points, titleize } from '../utils/helpers.js';

// Icon mapping for quick service cards
const SERVICE_ICONS = {
  food: '🍽️',
  dining: '🍽️',
  room: '🛏️',
  towel: '🛁',
  housekeeping: '🧺',
  hk: '🧺',
  chat: '💬',
  message: '💬',
  card: '💳',
  member: '💳',
  redeem: '🎁',
  reward: '🎁',
  scan: '📷',
  spa: '🌿',
  gym: '💪',
  pool: '🏊',
  laundry: '👔',
  transport: '🚗',
  default: '✨'
};

function pickIcon(item) {
  if (item.icon) return item.icon;
  const text = `${item.title || ''} ${item.route || ''} ${item.description || ''}`.toLowerCase();
  for (const [key, icon] of Object.entries(SERVICE_ICONS)) {
    if (text.includes(key)) return icon;
  }
  return SERVICE_ICONS.default;
}

function renderQuickAction(item) {
  const actionAttr = item.type === 'external'
    ? `data-external-url="${item.url || '#'}"`
    : `data-route="${item.route}"`;

  const icon = pickIcon(item);

  return `
    <button class="quick-card card quick-card-btn" ${actionAttr}>
      <div class="qc-icon">${icon}</div>
      <div class="qc-body">
        <h3>${item.title}</h3>
        <p>${item.description || ''}</p>
      </div>
      <span class="qc-arrow" aria-hidden="true">→</span>
    </button>
  `;
}

function renderLatestItem(item) {
  const title = item.targetDisplayName || item.roomNo || item.title || item.department || item.id;
  const subtitle = item.kind
    ? `${titleize(item.kind)} · ${item.status || item.mode || 'active'}`
    : `${item.mode || item.status || 'request'}`;
  const timeAgo = formatRelativeTime(item.updatedAt || item.createdAt || item.borrowedAt || item.lastMessageAt);
  const statusLabel = titleize(item.status || item.mode || 'open');

  return `
    <article class="activity-item">
      <div class="activity-icon">📋</div>
      <div class="activity-body">
        <strong>${title}</strong>
        <p class="muted">${subtitle} · ${timeAgo}</p>
      </div>
      <span class="badge">${statusLabel}</span>
    </article>
  `;
}

function renderNotice(item) {
  return `
    <article class="notice-card">
      <div class="notice-icon">📢</div>
      <div class="notice-body">
        <strong>${item.title || 'Notice'}</strong>
        <p class="muted">${item.body || item.description || 'No detail yet.'}</p>
      </div>
    </article>
  `;
}

export function renderHomePage(user, snapshot = {}) {
  const links = (snapshot.quickServices || []).slice(0, 6).map(renderQuickAction).join('');
  const notices = (snapshot.notices || []).slice(0, 3).map(renderNotice).join('');
  const latest = (snapshot.latestRequests || []).slice(0, 4).map(renderLatestItem).join('');

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const firstName = (user.displayName || 'Member').split(' ')[0];
  const balance = money(snapshot.wallet?.balance ?? user.balance ?? 0);
  const pointBalance = points(snapshot.points?.points ?? user.points ?? 0);
  const unread = snapshot.unreadNotifications || 0;

  return `
    <!-- Welcome + Digital Card + KPI dashboard -->
    <section class="home-hero home-hero-dashboard">
      <div class="home-hero-main">
        <div class="home-greeting">
          <p class="eyebrow">${greeting}</p>
          <h2>${firstName} 👋</h2>
          <p class="muted">${user.stayStart && user.stayEnd ? `Stay ${user.stayStart} → ${user.stayEnd}` : 'Welcome back to LAYA Club House'}${user.roomNo ? ` · Room ${user.roomNo}` : ''}</p>
        </div>

        <section class="kpi-row-3 home-kpi-row" aria-label="Account summary">
          <article class="kpi-tile kpi-tile-gold">
            <div class="kpi-tile-icon">💰</div>
            <div class="kpi-tile-body">
              <span class="kpi-label">Balance</span>
              <strong>${balance}</strong>
              <span class="muted">Available to spend</span>
            </div>
          </article>
          <article class="kpi-tile">
            <div class="kpi-tile-icon">⭐</div>
            <div class="kpi-tile-body">
              <span class="kpi-label">Reward points</span>
              <strong>${pointBalance}</strong>
              <span class="muted">Ready to redeem</span>
            </div>
          </article>
          <article class="kpi-tile ${unread > 0 ? 'kpi-tile-alert' : ''}">
            <div class="kpi-tile-icon">🔔</div>
            <div class="kpi-tile-body">
              <span class="kpi-label">Notifications</span>
              <strong>${unread}</strong>
              <span class="muted">${unread > 0 ? 'Unread alerts' : 'All caught up'}</span>
            </div>
          </article>
        </section>
      </div>

      <div class="home-card-wrap">
        ${renderDigitalCard(user, snapshot.card, snapshot.cardTheme)}
      </div>
    </section>

    <!-- Quick services -->
    <section class="page-section">
      <div class="section-head">
        <div>
          <h2>Quick services</h2>
          <p>Shortcuts for the tasks people use most often.</p>
        </div>
      </div>
      <div class="quick-grid">${links || `
        <article class="quick-card card">
          <div class="qc-icon">✨</div>
          <div class="qc-body">
            <h3>No service links</h3>
            <p>Configure Firestore content links to show hotel actions here.</p>
          </div>
        </article>`}
      </div>
    </section>

    <!-- Activity + Notices -->
    <section class="page-grid-2">
      <section class="page-section">
        <div class="section-head">
          <div>
            <h2>Latest activity</h2>
            <p>Recent requests and updates linked to your account.</p>
          </div>
        </div>
        <div class="activity-list">${latest || `
          <article class="empty-state">
            <span style="font-size:32px;">📭</span>
            <strong>No recent activity yet</strong>
            <p>HK requests, towel activity, and department chat will appear here.</p>
          </article>`}
        </div>
      </section>

      <section class="page-section">
        <div class="section-head">
          <div>
            <h2>Notices</h2>
            <p>Important messages and hotel updates.</p>
          </div>
        </div>
        <div class="stack-list">${notices || `
          <article class="empty-state">
            <span style="font-size:32px;">📬</span>
            <strong>No notices yet</strong>
            <p>Hotel messages and updates will appear here.</p>
          </article>`}
        </div>
      </section>
    </section>
  `;
}
