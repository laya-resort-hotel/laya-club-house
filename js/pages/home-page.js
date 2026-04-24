import { formatRelativeTime, money, points, titleize } from '../utils/helpers.js';

function renderQuickAction(item) {
  const actionAttr = item.type === 'external'
    ? `data-external-url="${item.url || '#'}"`
    : `data-route="${item.route}"`;

  const actionLabel = item.type === 'external' ? 'Open link' : 'Open';

  return `
    <button class="quick-card card quick-card-btn" ${actionAttr}>
      <h3>${item.title}</h3>
      <p>${item.description || ''}</p>
      <span class="badge">${actionLabel}</span>
    </button>
  `;
}

function renderLatestItem(item) {
  const title = item.targetDisplayName || item.roomNo || item.title || item.department || item.id;
  const subtitle = item.kind
    ? `${titleize(item.kind)} • ${item.status || item.mode || 'active'}`
    : `${item.mode || item.status || 'request'}`;
  return `
    <article class="transaction-item">
      <div>
        <strong>${title}</strong>
        <p class="muted">${subtitle} • ${formatRelativeTime(item.updatedAt || item.createdAt || item.borrowedAt || item.lastMessageAt)}</p>
      </div>
      <strong>${titleize(item.status || item.mode || 'open')}</strong>
    </article>
  `;
}

export function renderHomePage(user, snapshot = {}) {
  const links = (snapshot.quickServices || []).slice(0, 6).map(renderQuickAction).join('');
  const notices = (snapshot.notices || []).slice(0, 3).map((item) => `
    <article class="notice-card">
      <strong>${item.title || 'Notice'}</strong>
      <p class="muted">${item.body || item.description || 'No detail yet.'}</p>
    </article>
  `).join('');
  const latest = (snapshot.latestRequests || []).slice(0, 5).map(renderLatestItem).join('');

  const stayCopy = user.stayStart && user.stayEnd
    ? `Stay ${user.stayStart} → ${user.stayEnd}`
    : ((user.cardType || '').replaceAll('_', ' '));

  return `
    <section class="hero-card card">
      <div class="hero-meta">
        <div class="page-intro">
          <p class="eyebrow">Welcome</p>
          <h2>${user.displayName || 'Member'}</h2>
          <p>${stayCopy}${user.roomNo ? ` • Room ${user.roomNo}` : ''}</p>
        </div>
        <span class="badge">${user.role || 'member'}</span>
      </div>

      <div class="hero-summary-grid">
        <article class="stat-card">
          <span class="kpi-label">Balance</span>
          <strong>${money(user.balance || 0)}</strong>
          <span class="muted">Available to spend</span>
        </article>
        <article class="stat-card">
          <span class="kpi-label">Points</span>
          <strong>${points(user.points || 0)}</strong>
          <span class="muted">Reward balance</span>
        </article>
        <article class="stat-card">
          <span class="kpi-label">Notifications</span>
          <strong>${snapshot.unreadNotifications || 0}</strong>
          <span class="muted">Unread alerts</span>
        </article>
      </div>

      <div class="feature-callout">
        <strong>Today at a glance</strong>
        <p class="muted">Use quick services below to open room dining, request housekeeping items, or chat with hotel departments in real time.</p>
        <div class="info-row">
          ${user.guestExpiryAt ? `<span class="badge">Guest expires ${String(user.guestExpiryAt).slice(0, 16)}</span>` : '<span class="badge">Member card ready</span>'}
          <span class="badge">Fast access from this screen</span>
        </div>
      </div>
    </section>

    <section class="page-section">
      <div class="section-head">
        <div>
          <h2>Quick services</h2>
          <p>Shortcuts for the tasks people use most often.</p>
        </div>
      </div>
      <div class="quick-grid">${links || '<article class="quick-card card"><h3>No service links</h3><p>Configure Firestore content links to show hotel actions here.</p></article>'}</div>
    </section>

    <section class="page-grid-2">
      <section class="page-section">
        <div class="section-head">
          <div>
            <h2>Latest activity</h2>
            <p>Recent requests and operational updates linked to your account.</p>
          </div>
        </div>
        <div class="list">${latest || '<article class="transaction-item"><div><strong>No recent activity</strong><p class="muted">HK requests, towel activity, and department chat will appear here.</p></div><strong>-</strong></article>'}</div>
      </section>

      <section class="page-section">
        <div class="section-head">
          <div>
            <h2>Notices</h2>
            <p>Important messages and hotel updates.</p>
          </div>
        </div>
        <div class="stack-list">${notices || '<article class="notice-card"><strong>No notices yet</strong><p class="muted">Connect content_banners for live hotel messages.</p></article>'}</div>
      </section>
    </section>
  `;
}
