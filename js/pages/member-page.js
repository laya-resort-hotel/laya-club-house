import { renderDigitalCard } from '../components/digital-card.js';
import { formatRelativeTime, money, points, titleize } from '../utils/helpers.js';

export function renderMemberPage(user, snapshot = {}) {
  const transactions = (snapshot.transactions || []).map((item) => `
    <article class="transaction-item">
      <div>
        <strong>${item.title || titleize(item.type || item.source || 'activity')}</strong>
        <p class="muted">${formatRelativeTime(item.createdAt)}</p>
      </div>
      <strong>${item.source === 'points' || item.type === 'earn' ? '+' : ''}${Math.abs(Number(item.amount || 0))}</strong>
    </article>
  `).join('');

  return `
    <section class="page-section">
      <div class="section-head">
        <div>
          <h2>Member card</h2>
          <p>Your digital card, balance, and card details in one place.</p>
        </div>
      </div>
      ${renderDigitalCard(user, snapshot.card, snapshot.cardTheme)}
    </section>

    <section class="hero-summary-grid">
      <article class="stat-card">
        <span class="kpi-label">Wallet balance</span>
        <strong>${money(snapshot.wallet?.balance ?? user.balance ?? 0)}</strong>
        <span class="muted">Available for spending</span>
      </article>
      <article class="stat-card">
        <span class="kpi-label">Point balance</span>
        <strong>${points(snapshot.points?.points ?? user.points ?? 0)}</strong>
        <span class="muted">Ready for redemption</span>
      </article>
      <article class="stat-card">
        <span class="kpi-label">Status</span>
        <strong>${titleize(user.status || 'active')}</strong>
        <span class="muted">Current account state</span>
      </article>
    </section>

    <section class="page-grid-2">
      <section class="page-section">
        <div class="section-head">
          <div>
            <h2>Member info</h2>
            <p>Core profile and card identifiers.</p>
          </div>
        </div>
        <article class="card detail-card">
          <div class="detail-row"><span>Card type</span><strong>${titleize(snapshot.card?.cardType || user.cardType || 'member')}</strong></div>
          <div class="detail-row"><span>Card number</span><strong>${snapshot.card?.cardNumber || '-'}</strong></div>
          <div class="detail-row"><span>QR value</span><strong>${snapshot.card?.qrValue || '-'}</strong></div>
          <div class="detail-row"><span>Room</span><strong>${user.roomNo || '-'}</strong></div>
          <div class="detail-row"><span>Status</span><strong>${user.status || 'active'}</strong></div>
        </article>
      </section>

      <section class="page-section">
        <div class="section-head">
          <div>
            <h2>Recent activity</h2>
            <p>Latest wallet and point movement.</p>
          </div>
        </div>
        <div class="list">${transactions || '<article class="transaction-item"><div><strong>No recent activity</strong><p class="muted">Wallet and point transactions will appear here.</p></div><strong>-</strong></article>'}</div>
      </section>
    </section>
  `;
}
