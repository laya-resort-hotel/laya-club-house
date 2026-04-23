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
    ${renderDigitalCard(user, snapshot.card, snapshot.cardTheme)}

    <section class="hero-grid">
      <article class="kpi">
        <span class="muted">Wallet balance</span>
        <strong>${money(snapshot.wallet?.balance ?? user.balance ?? 0)}</strong>
      </article>
      <article class="kpi">
        <span class="muted">Point balance</span>
        <strong>${points(snapshot.points?.points ?? user.points ?? 0)}</strong>
      </article>
    </section>

    <section class="page-section">
      <h2>Member info</h2>
      <article class="card detail-card">
        <div class="detail-row"><span>Card type</span><strong>${titleize(snapshot.card?.cardType || user.cardType || 'member')}</strong></div>
        <div class="detail-row"><span>Card number</span><strong>${snapshot.card?.cardNumber || '-'}</strong></div>
        <div class="detail-row"><span>Room</span><strong>${user.roomNo || '-'}</strong></div>
        <div class="detail-row"><span>Status</span><strong>${user.status || 'active'}</strong></div>
      </article>
    </section>

    <section class="page-section">
      <h2>Recent activity</h2>
      <div class="list">${transactions || '<article class="transaction-item"><div><strong>No recent activity</strong><p class="muted">Wallet and point transactions will appear here.</p></div><strong>-</strong></article>'}</div>
    </section>
  `;
}
