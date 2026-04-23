import { formatRelativeTime, money, points, titleize } from '../utils/helpers.js';

const modes = [
  { key: 'topup', label: 'Top-up' },
  { key: 'deduct', label: 'Deduct' },
  { key: 'earn_point', label: 'Earn Points' },
  { key: 'redeem_use', label: 'Reward Use' },
  { key: 'towel_borrow', label: 'Towel Borrow' },
  { key: 'towel_return', label: 'Towel Return' }
];

function actionButtons(item, canReview) {
  if (!canReview || item.status !== 'pending') return `<strong>${titleize(item.status || 'pending')}</strong>`;
  return `
    <div class="queue-actions-inline">
      <button class="mini-btn mini-btn-success" data-scan-action="approve" data-scan-id="${item.id}">Process</button>
      <button class="mini-btn mini-btn-danger" data-scan-action="reject" data-scan-id="${item.id}">Reject</button>
    </div>
  `;
}

export function renderScanCenterPage(user, snapshot = {}) {
  const preview = snapshot.preview || null;
  const recent = (snapshot.recentRequests || []).map((item) => `
    <article class="transaction-item ${item.status === 'pending' ? 'is-pending' : ''}">
      <div>
        <strong>${item.targetDisplayName || item.code || item.id}</strong>
        <p class="muted">${titleize(item.mode || 'scan')} • ${formatRelativeTime(item.createdAt)}</p>
      </div>
      <div class="queue-actions">
        <strong>${titleize(item.status || 'pending')}</strong>
        ${actionButtons(item, snapshot.canReview)}
      </div>
    </article>
  `).join('');

  const modeButtons = modes.map((mode, index) => `
    <button type="button" class="mode-btn ${index === 0 ? 'is-active' : ''}" data-mode="${mode.key}">${mode.label}</button>
  `).join('');

  return `
    <section class="grid grid-2 scan-layout">
      <article class="card scan-panel">
        <div class="hero-meta">
          <div>
            <p class="eyebrow">Scan center</p>
            <h2>Operations queue</h2>
          </div>
          <span class="badge">${user.department || user.role || 'staff'}</span>
        </div>

        <div class="scanner-box">
          <video id="scanner-video" class="scanner-video" playsinline muted></video>
          <div id="scanner-reader" class="scanner-reader" hidden></div>
          <div class="scanner-overlay">QR Scanner</div>
        </div>
        <div class="scanner-toolbar">
          <button type="button" class="btn btn-secondary" id="start-scan-btn">Start camera scanner</button>
          <button type="button" class="btn btn-secondary" id="stop-scan-btn">Stop scanner</button>
        </div>
        <p id="scanner-status" class="muted scanner-status">Use the camera to scan a QR code. BarcodeDetector runs first, and the scanner will fall back automatically if this browser needs a more compatible engine.</p>

        <div class="mode-grid">${modeButtons}</div>

        <form id="scan-form" class="grid" style="margin-top:14px">
          <input type="hidden" id="scan-mode" value="topup" />
          <label>
            <span>Card / QR / reward code</span>
            <input id="scan-code" placeholder="GC-000001 / LAYA-CARD-GC-000001 / RW-20260422-XXXXXX" />
          </label>
          <div class="inline-actions">
            <button class="btn btn-secondary" type="button" id="lookup-card-btn">Lookup card</button>
          </div>
          <label>
            <span>Amount (THB)</span>
            <input id="scan-amount" type="number" min="0" step="1" placeholder="0" />
          </label>
          <label>
            <span>Points</span>
            <input id="scan-points" type="number" min="0" step="1" placeholder="0" />
          </label>
          <label>
            <span>Towel location</span>
            <select id="scan-location">
              <option value="room_front">Room front</option>
              <option value="gym">Gym</option>
            </select>
          </label>
          <label>
            <span>Note</span>
            <textarea id="scan-note" rows="4" placeholder="Front desk top-up / restaurant deduct / reward fulfillment note"></textarea>
          </label>
          <button class="btn btn-primary" type="submit">Create scan request</button>
        </form>
      </article>

      <article class="card scan-preview-card">
        <p class="eyebrow">Member preview</p>
        ${preview ? `
          <div class="scan-preview">
            <h3>${preview.displayName || preview.userId}</h3>
            <p class="muted">${titleize(preview.cardType || 'card')}${preview.roomNo ? ` • Room ${preview.roomNo}` : ''}</p>
            <div class="hero-grid" style="margin-top:14px">
              <div class="kpi"><span class="muted">Balance</span><strong>${money(preview.balance || 0)}</strong></div>
              <div class="kpi"><span class="muted">Points</span><strong>${points(preview.points || 0)}</strong></div>
            </div>
            <div class="detail-card" style="margin-top:14px">
              <div class="detail-row"><span>Card number</span><strong>${preview.cardNumber || '-'}</strong></div>
              <div class="detail-row"><span>QR value</span><strong>${preview.qrValue || '-'}</strong></div>
              <div class="detail-row"><span>Card ID</span><strong>${preview.cardId || '-'}</strong></div>
            </div>
          </div>
        ` : `
          <div class="empty-state">
            <strong>No member loaded</strong>
            <p class="muted">Use the camera or Lookup to preview a card before creating a scan request.</p>
          </div>
        `}
      </article>
    </section>

    <section class="page-section">
      <h2>Recent queue</h2>
      <div class="list">${recent || '<article class="transaction-item"><div><strong>No scan requests yet</strong><p class="muted">Requests created here will show in the queue.</p></div><strong>-</strong></article>'}</div>
    </section>
  `;
}
