import { points, titleize, formatRelativeTime } from '../utils/helpers.js';

export function renderRedeemPage(user, snapshot = {}) {
  const rewards = (snapshot.rewards || []).map((reward) => `
    <article class="reward-card card">
      <div class="reward-thumb"></div>
      <div class="grid">
        <div>
          <h3>${reward.title || reward.titleTh || 'Reward'}</h3>
          <p class="muted">${reward.category || 'general'}</p>
        </div>
        <div class="info-row">
          <span class="badge">${points(reward.pointsRequired || 0)} pts</span>
          <span class="badge">Stock ${reward.stock ?? '-'}</span>
        </div>
        <button class="btn btn-primary" type="button" data-reward-id="${reward.id}" data-reward-title="${reward.title || ''}" data-reward-points="${reward.pointsRequired || 0}">Redeem</button>
      </div>
    </article>
  `).join('');

  const history = (snapshot.redemptions || []).slice(0, 6).map((item) => `
    <article class="transaction-item">
      <div>
        <strong>${item.rewardTitle || item.title || 'Reward request'}</strong>
        <p class="muted">${formatRelativeTime(item.redeemedAt)}</p>
      </div>
      <strong>${titleize(item.status || 'pending')}</strong>
    </article>
  `).join('');

  return `
    <section class="hero-card card">
      <div class="hero-meta">
        <div>
          <p class="eyebrow">Available points</p>
          <h2>${points(snapshot.pointAccount?.points ?? user.points ?? 0)}</h2>
        </div>
        <span class="badge">${(user.cardType || '').replaceAll('_', ' ')}</span>
      </div>
      <p class="muted">Redeem buttons now create a redemption request in Firestore when the project rules allow it.</p>
    </section>

    <section class="page-section">
      <h2>Rewards</h2>
      <div class="reward-list">${rewards || '<article class="card" style="padding:16px"><p class="muted">No active rewards found.</p></article>'}</div>
    </section>

    <section class="page-section">
      <h2>My redemptions</h2>
      <div class="list">${history || '<article class="transaction-item"><div><strong>No redemption history</strong><p class="muted">Your new requests will appear here.</p></div><strong>-</strong></article>'}</div>
    </section>
  `;
}
