import { formatRelativeTime, money, points, titleize } from '../utils/helpers.js';

const stations = [
  { key: 'fnb', label: 'F&B', icon: '🍽', subtitle: 'Deductions & reward points' },
  { key: 'fitness', label: 'Fitness', icon: '🏋', subtitle: 'Towel management' },
  { key: 'frontdesk', label: 'Front Desk', icon: '🛎', subtitle: 'Top-up, balance, and membership lookup' }
];

const locations = [
  { value: 'room_front', label: 'Room front' },
  { value: 'pool_deck', label: 'Pool deck' },
  { value: 'gym', label: 'Gym entrance' },
  { value: 'locker_room', label: 'Locker room' },
  { value: 'spa', label: 'Spa' }
];

function initials(name = '') {
  const parts = String(name || 'Member').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((item) => item[0]?.toUpperCase() || '').join('') || '?';
}

function actionButtons(item, canReview) {
  if (!canReview || item.status !== 'pending') return `<strong>${titleize(item.status || 'pending')}</strong>`;
  return `
    <div class="queue-actions-inline">
      <button class="mini-btn mini-btn-success" data-scan-action="approve" data-scan-id="${item.id}">Process</button>
      <button class="mini-btn mini-btn-danger" data-scan-action="reject" data-scan-id="${item.id}">Reject</button>
    </div>
  `;
}

function renderMemberPreview(preview) {
  if (!preview) {
    return `
      <div class="scan-v2-empty-member">
        <div class="scan-v2-question">?</div>
        <strong>No member loaded</strong>
        <p>Scan a QR or enter a card code to preview guest details before posting a transaction.</p>
      </div>
    `;
  }

  const name = preview.displayName || preview.userId || 'Member';
  const status = preview.status || 'active';
  const cardId = preview.cardNumber || preview.cardId || preview.qrValue || '-';
  const cardType = titleize(preview.cardType || 'member');

  return `
    <article class="scan-v2-member-card">
      <div class="scan-v2-member-glow" aria-hidden="true"></div>
      <div class="scan-v2-member-head">
        <div class="scan-v2-member-main">
          <div class="scan-v2-avatar">${initials(name)}</div>
          <div>
            <strong>${name}</strong>
            <p class="mono">${cardId}</p>
          </div>
        </div>
        <span class="scan-v2-status ${status === 'active' ? 'is-active' : 'is-inactive'}">${titleize(status)}</span>
      </div>

      <div class="scan-v2-member-stats">
        <div>
          <span>Balance</span>
          <strong>${money(preview.balance || 0)}</strong>
        </div>
        <div>
          <span>Points</span>
          <strong>${points(preview.points || 0)}</strong>
        </div>
        <div>
          <span>Towel</span>
          <strong>${titleize(preview.towelStatus || preview.towel || 'Available')}</strong>
        </div>
      </div>

      <div class="scan-v2-member-foot">
        <span>${cardType}${preview.roomNo ? ` · Room ${preview.roomNo}` : ''}</span>
        <span>${preview.expiryDate ? `Expires ${preview.expiryDate}` : 'ID confirmed'}</span>
      </div>
    </article>

    <article class="scan-v2-detail-box">
      <div><span>Card number</span><strong class="mono">${preview.cardNumber || '-'}</strong></div>
      <div><span>QR value</span><strong class="mono">${preview.qrValue || '-'}</strong></div>
      <div><span>Card ID</span><strong class="mono">${preview.cardId || '-'}</strong></div>
    </article>
  `;
}

function renderStationTabs() {
  return stations.map((station, index) => `
    <button type="button" class="scan-station-btn ${index === 0 ? 'is-active' : ''}" data-scan-station="${station.key}">
      <span>${station.icon}</span>
      <strong>${station.label}</strong>
    </button>
  `).join('');
}

function renderLocationButtons() {
  return locations.map((item, index) => `
    <button type="button" class="scan-location-btn ${index === 0 ? 'is-active' : ''}" data-location="${item.value}">${item.label}</button>
  `).join('');
}

function renderRecentQueue(snapshot = {}) {
  return (snapshot.recentRequests || []).map((item) => `
    <article class="transaction-item scan-v2-queue-item ${item.status === 'pending' ? 'is-pending' : ''}">
      <div>
        <strong>${item.targetDisplayName || item.code || item.id}</strong>
        <p class="muted">${titleize(item.mode || 'scan')} • ${formatRelativeTime(item.createdAt)}</p>
      </div>
      <div class="queue-actions">
        ${actionButtons(item, snapshot.canReview)}
      </div>
    </article>
  `).join('');
}

export function renderScanCenterPage(user, snapshot = {}) {
  const preview = snapshot.preview || null;
  const recent = renderRecentQueue(snapshot);
  const roleLabel = titleize(user.role || user.department || 'staff');

  return `
    <section class="scan-v2-root">
      <header class="scan-v2-header">
        <div>
          <div class="scan-v2-brand-line">
            <span></span>
            <strong>LAYA Club House</strong>
          </div>
          <p>Scan Center · Production</p>
        </div>
        <div class="scan-v2-operator">
          <div>${initials(user.displayName || user.email || 'A')}</div>
          <span>${user.displayName || 'Operator'} · ${roleLabel}</span>
        </div>
      </header>

      <nav class="scan-station-tabs" aria-label="Scan station mode">
        ${renderStationTabs()}
      </nav>

      <div class="scan-v2-station-title">
        <div>
          <h2 id="scan-station-title">F&B Station</h2>
          <p id="scan-station-subtitle">Deductions & reward points</p>
        </div>
        <button type="button" class="scan-v2-open-scanner" id="start-scan-btn">
          <span>⊡</span>
          Scan QR
        </button>
      </div>

      <div class="scan-v2-grid">
        <article class="scan-v2-panel scan-v2-action-card">
          <div class="scan-v2-panel-head">
            <span>Action</span>
            <button type="button" class="scan-v2-soft-btn" id="stop-scan-btn">Stop scanner</button>
          </div>

          <div class="scanner-box scan-v2-scanner-box">
            <video id="scanner-video" class="scanner-video" playsinline muted></video>
            <div id="scanner-reader" class="scanner-reader" aria-hidden="true"></div>
            <div class="scan-v2-camera-frame">
              <i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i>
              <span></span>
              <p>Camera preview<br>would appear here</p>
            </div>
          </div>
          <p id="scanner-status" class="scan-v2-status-line">Use camera scan first, or enter the code manually below.</p>

          <form id="scan-form" class="scan-v2-form">
            <input type="hidden" id="scan-mode" value="deduct" />
            <select id="scan-location" class="scan-v2-hidden-select" aria-label="Towel location">
              ${locations.map((item) => `<option value="${item.value}">${item.label}</option>`).join('')}
            </select>

            <div class="scan-v2-manual-row">
              <input id="scan-code" placeholder="Card / QR / reward code" autocomplete="off" />
              <button class="scan-v2-outline-btn" type="button" id="lookup-card-btn">Look up</button>
            </div>

            <section class="scan-station-panel is-active" data-station-panel="fnb">
              <div class="scan-action-toggle">
                <button type="button" class="scan-action-btn is-active" data-mode="deduct">Deduct Balance</button>
                <button type="button" class="scan-action-btn" data-mode="earn_point">Earn Points</button>
              </div>
              <label class="scan-v2-field scan-amount-wrap">
                <span>Amount (THB)</span>
                <input id="scan-amount" type="number" min="0" step="1" placeholder="0" />
              </label>
              <label class="scan-v2-field scan-points-wrap">
                <span>Points to award</span>
                <input id="scan-points" type="number" min="0" step="1" placeholder="0" />
              </label>
              <label class="scan-v2-field">
                <span>Note</span>
                <input id="scan-note" placeholder="Table number, order reference…" />
              </label>
            </section>

            <section class="scan-station-panel" data-station-panel="fitness" hidden>
              <div class="scan-action-toggle">
                <button type="button" class="scan-action-btn" data-mode="towel_borrow">Towel Borrow</button>
                <button type="button" class="scan-action-btn" data-mode="towel_return">Towel Return</button>
              </div>
              <div>
                <span class="scan-v2-mini-label">Towel location</span>
                <div class="scan-location-grid">${renderLocationButtons()}</div>
              </div>
              <div class="scan-v2-summary-box">
                <div><span>Current towel status</span><strong>${preview ? titleize(preview.towelStatus || preview.towel || 'Available') : 'Scan member first'}</strong></div>
                <div><span>Selected location</span><strong id="scan-location-label">Room front</strong></div>
              </div>
            </section>

            <section class="scan-station-panel" data-station-panel="frontdesk" hidden>
              <div class="scan-action-toggle scan-action-toggle-3">
                <button type="button" class="scan-action-btn" data-mode="topup">Top-up</button>
                <button type="button" class="scan-action-btn" data-mode="balance_check">Balance Check</button>
                <button type="button" class="scan-action-btn" data-mode="membership_lookup">Membership</button>
              </div>
              <div class="scan-quick-amounts">
                ${[500, 1000, 2000, 5000].map((value) => `<button type="button" data-quick-amount="${value}">฿${value.toLocaleString()}</button>`).join('')}
              </div>
              <label class="scan-v2-field">
                <span>Top-up Amount (THB)</span>
                <input id="scan-amount-frontdesk" type="number" min="0" step="1" placeholder="Custom amount" />
              </label>
              <div class="scan-v2-summary-box ${preview ? '' : 'is-muted'}">
                <div><span>Current Balance</span><strong>${preview ? money(preview.balance || 0) : '-'}</strong></div>
                <div><span>Reward Points</span><strong>${preview ? points(preview.points || 0) : '-'}</strong></div>
                <div><span>Membership</span><strong>${preview ? titleize(preview.cardType || 'member') : '-'}</strong></div>
              </div>
            </section>

            <button class="scan-v2-confirm" type="submit">Confirm Transaction</button>
          </form>
        </article>

        <article class="scan-v2-panel scan-v2-preview-card">
          <div class="scan-v2-panel-head">
            <span>Member Preview</span>
            ${preview ? '<strong>ID confirmed</strong>' : ''}
          </div>
          ${renderMemberPreview(preview)}
          ${!preview ? '<button type="button" class="scan-v2-open-member-scanner" id="scan-preview-open-btn">+ Open Scanner</button>' : ''}
        </article>
      </div>

      <p class="scan-v2-footer-hint">All transactions are logged · ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>

      <section class="page-section scan-v2-recent-section">
        <div class="section-head">
          <div>
            <h2>Recent queue</h2>
            <p>Latest scan requests waiting for action or already completed.</p>
          </div>
        </div>
        <div class="list">${recent || '<article class="transaction-item scan-v2-queue-item"><div><strong>No scan requests yet</strong><p class="muted">Requests created here will show in the queue.</p></div><strong>-</strong></article>'}</div>
      </section>
    </section>
  `;
}
