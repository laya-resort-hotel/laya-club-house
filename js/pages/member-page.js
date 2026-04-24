import { renderDigitalCard } from '../components/digital-card.js';
import { formatRelativeTime, money, points, titleize } from '../utils/helpers.js';

function txIcon(item) {
  if (item.type === 'earn' || item.source === 'points') return '⭐';
  if (item.type === 'redeem') return '🎁';
  if (item.type === 'topup' || item.type === 'deposit') return '💳';
  if (item.type === 'spend' || item.type === 'charge') return '💸';
  return '📋';
}

function renderTransaction(item) {
  const title = item.title || titleize(item.type || item.source || 'activity');
  const amount = Math.abs(Number(item.amount || 0));
  const isPositive = item.source === 'points' || item.type === 'earn' || item.type === 'topup';
  const sign = isPositive ? '+' : (item.type === 'spend' || item.type === 'redeem' ? '−' : '');
  const amountColor = isPositive ? 'tx-positive' : (sign === '−' ? 'tx-negative' : '');
  return `
    <article class="activity-item">
      <div class="activity-icon">${txIcon(item)}</div>
      <div class="activity-body">
        <strong>${title}</strong>
        <p class="muted">${formatRelativeTime(item.createdAt)}</p>
      </div>
      <strong class="${amountColor}">${sign}${amount}</strong>
    </article>
  `;
}

export function renderMemberPage(user, snapshot = {}) {
  const transactions = (snapshot.transactions || []).map(renderTransaction).join('');
  const walletBalance = money(snapshot.wallet?.balance ?? user.balance ?? 0);
  const pointBalance = points(snapshot.points?.points ?? user.points ?? 0);
  const status = titleize(user.status || 'active');

  return `
    <!-- Member Hero: Digital Card (left) + Stats (right) -->
    <section class="page-section">
      <div class="section-head">
        <div>
          <h2>My member card</h2>
          <p>Your digital card, balance, and details in one place.</p>
        </div>
      </div>

      <div class="member-hero">
        <div class="home-card-wrap">
          ${renderDigitalCard(user, snapshot.card, snapshot.cardTheme)}
        </div>

        <div class="kpi-stack">
          <article class="kpi-tile kpi-tile-gold">
            <div class="kpi-tile-icon">💰</div>
            <div class="kpi-tile-body">
              <span class="kpi-label">Wallet balance</span>
              <strong>${walletBalance}</strong>
              <span class="muted">Available for spending</span>
            </div>
          </article>
          <article class="kpi-tile">
            <div class="kpi-tile-icon">⭐</div>
            <div class="kpi-tile-body">
              <span class="kpi-label">Point balance</span>
              <strong>${pointBalance}</strong>
              <span class="muted">Ready for redemption</span>
            </div>
          </article>
          <article class="kpi-tile kpi-tile-success">
            <div class="kpi-tile-icon">✓</div>
            <div class="kpi-tile-body">
              <span class="kpi-label">Status</span>
              <strong>${status}</strong>
              <span class="muted">Current account state</span>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- Member Info + Recent Activity -->
    <section class="page-grid-2">
      <section class="page-section">
        <div class="section-head">
          <div>
            <h2>Member info</h2>
            <p>Core profile and card identifiers.</p>
          </div>
        </div>
        <article class="card info-grid-card">
          <div class="info-tile">
            <span class="info-label">Card type</span>
            <strong>${titleize(snapshot.card?.cardType || user.cardType || 'member')}</strong>
          </div>
          <div class="info-tile">
            <span class="info-label">Card number</span>
            <strong class="mono">${snapshot.card?.cardNumber || '-'}</strong>
          </div>
          <div class="info-tile info-tile-wide">
            <span class="info-label">QR value</span>
            <strong class="mono qr-value-text">${snapshot.card?.qrValue || '-'}</strong>
          </div>
          <div class="info-tile">
            <span class="info-label">Room</span>
            <strong>${user.roomNo || '—'}</strong>
          </div>
          <div class="info-tile">
            <span class="info-label">Status</span>
            <strong><span class="badge badge-green">${user.status || 'active'}</span></strong>
          </div>
        </article>
      </section>

      <section class="page-section">
        <div class="section-head">
          <div>
            <h2>Recent activity</h2>
            <p>Latest wallet and point movement.</p>
          </div>
        </div>
        <div class="activity-list">${transactions || `
          <article class="empty-state">
            <span style="font-size:32px;">📊</span>
            <strong>No recent activity</strong>
            <p>Wallet and point transactions will appear here.</p>
          </article>`}
        </div>
      </section>
    </section>
  `;
}
