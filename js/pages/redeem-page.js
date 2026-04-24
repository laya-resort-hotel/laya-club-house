import { points, titleize, formatRelativeTime } from '../utils/helpers.js';

function escapeHtml(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderRewardThumb(reward = {}) {
  const imageUrl = reward.imageUrl || reward.imageURL || reward.photoURL || '';
  const title = reward.title || reward.titleTh || 'Reward';
  if (imageUrl) {
    return `
      <div class="reward-thumb reward-thumb-image">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="lazy" referrerpolicy="no-referrer">
      </div>
    `;
  }
  return `
    <div class="reward-thumb reward-thumb-empty" aria-hidden="true">
      <span>🎁</span>
    </div>
  `;
}

export function renderRedeemPage(user, snapshot = {}) {
  const rewards = (snapshot.rewards || []).map((reward) => `
    <article class="reward-card card">
      ${renderRewardThumb(reward)}
      <div class="reward-meta">
        <div>
          <h3>${escapeHtml(reward.title || reward.titleTh || 'Reward')}</h3>
          <p class="muted">${escapeHtml(titleize(reward.category || 'general'))}</p>
          ${reward.description ? `<p class="reward-description">${escapeHtml(reward.description)}</p>` : ''}
        </div>
        <div class="reward-actions">
          <div class="info-row">
            <span class="badge">${points(reward.pointsRequired || 0)} pts</span>
            <span class="badge">Stock ${reward.stock ?? '-'}</span>
          </div>
          <button class="btn btn-primary" type="button" data-reward-id="${escapeHtml(reward.id)}" data-reward-title="${escapeHtml(reward.title || '')}" data-reward-points="${reward.pointsRequired || 0}">Redeem</button>
        </div>
      </div>
    </article>
  `).join('');

  const history = (snapshot.redemptions || []).slice(0, 6).map((item) => `
    <article class="transaction-item">
      <div>
        <strong>${escapeHtml(item.rewardTitle || item.title || 'Reward request')}</strong>
        <p class="muted">${formatRelativeTime(item.redeemedAt)}</p>
      </div>
      <strong>${titleize(item.status || 'pending')}</strong>
    </article>
  `).join('');

  return `
    <section class="hero-card card">
      <div class="hero-meta">
        <div class="page-intro">
          <p class="eyebrow">Available points</p>
          <h2>${points(snapshot.pointAccount?.points ?? user.points ?? 0)}</h2>
          <p>Choose a reward below. The system will create a redemption request in Firestore.</p>
        </div>
        <span class="badge">${escapeHtml((user.cardType || '').replaceAll('_', ' '))}</span>
      </div>
      <div class="info-row">
        <span class="badge">Redeem when ready</span>
        <span class="badge">Track status below</span>
      </div>
    </section>

    <section class="page-grid-2">
      <section class="page-section">
        <div class="section-head">
          <div>
            <h2>Rewards</h2>
            <p>Browse live rewards and redeem with one tap.</p>
          </div>
        </div>
        <div class="reward-list">${rewards || '<article class="card content-card"><p class="muted">No active rewards found.</p></article>'}</div>
      </section>

      <section class="page-section">
        <div class="section-head">
          <div>
            <h2>My redemptions</h2>
            <p>Your latest requests and statuses.</p>
          </div>
        </div>
        <div class="list">${history || '<article class="transaction-item"><div><strong>No redemption history</strong><p class="muted">Your new requests will appear here.</p></div><strong>-</strong></article>'}</div>
      </section>
    </section>
  `;
}
