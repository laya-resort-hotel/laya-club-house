import { points, titleize, formatRelativeTime } from '../utils/helpers.js';

const CATEGORY_STYLE = {
  beverages: { label: 'Beverages', icon: '🍷', color: '#c9a84c' },
  beverage: { label: 'Beverages', icon: '🍷', color: '#c9a84c' },
  wellness: { label: 'Wellness', icon: '🌿', color: '#6aab8a' },
  spa: { label: 'Wellness', icon: '🌿', color: '#6aab8a' },
  dining: { label: 'Dining', icon: '🍽️', color: '#e07b5a' },
  food: { label: 'Dining', icon: '🍽️', color: '#e07b5a' },
  fitness: { label: 'Fitness', icon: '💪', color: '#7b9fd4' },
  sport: { label: 'Sport', icon: '⛳', color: '#b07fc8' },
  general: { label: 'General', icon: '🎁', color: '#c9a84c' }
};

function escapeHtml(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeCategory(value = '') {
  return String(value || 'general').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function getCategoryMeta(value = '') {
  const key = normalizeCategory(value);
  return CATEGORY_STYLE[key] || { label: titleize(String(value || 'general')), icon: '🎁', color: '#c9a84c' };
}

function getRewardImage(reward = {}) {
  return reward.imageUrl || reward.imageURL || reward.image || reward.photoURL || '';
}

function renderRewardImage(reward = {}) {
  const imageUrl = getRewardImage(reward);
  const title = reward.title || reward.titleTh || 'Reward';
  if (!imageUrl) {
    return `
      <div class="redeem-luxury-image redeem-luxury-image-empty" aria-hidden="true">
        <span>🎁</span>
      </div>
    `;
  }
  return `
    <div class="redeem-luxury-image">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="lazy" referrerpolicy="no-referrer">
    </div>
  `;
}

function renderRewardCard(reward = {}, availablePoints = 0) {
  const rewardId = reward.id || reward.rewardId || '';
  const title = reward.title || reward.titleTh || 'Reward';
  const description = reward.description || reward.descriptionTh || 'Redeem this reward with your available points.';
  const requiredPoints = toNumber(reward.pointsRequired ?? reward.points ?? reward.cost ?? 0);
  const stock = reward.stock ?? reward.quantity ?? '-';
  const categoryMeta = getCategoryMeta(reward.category || 'general');
  const canRedeem = availablePoints >= requiredPoints && requiredPoints > 0 && toNumber(stock, 1) !== 0;
  const buttonText = canRedeem ? 'Redeem' : (requiredPoints > availablePoints ? 'Need points' : 'Unavailable');

  return `
    <article class="redeem-luxury-card" style="--reward-accent:${categoryMeta.color}">
      <div class="redeem-luxury-media">
        ${renderRewardImage(reward)}
        <div class="redeem-luxury-media-shade" aria-hidden="true"></div>
        <span class="redeem-category-pill"><span>${categoryMeta.icon}</span>${escapeHtml(categoryMeta.label)}</span>
        <span class="redeem-stock-pill">${escapeHtml(String(stock))} left</span>
      </div>

      <div class="redeem-luxury-body">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>

        <div class="redeem-luxury-foot">
          <strong>${points(requiredPoints)}<span>pts</span></strong>
          <button
            class="redeem-luxury-btn"
            type="button"
            data-reward-id="${escapeHtml(rewardId)}"
            data-reward-title="${escapeHtml(title)}"
            data-reward-points="${requiredPoints}"
            ${canRedeem ? '' : 'disabled'}
          >${buttonText}</button>
        </div>
      </div>
    </article>
  `;
}

function renderRedemptionItem(item = {}) {
  const title = item.rewardTitle || item.title || 'Reward request';
  const status = titleize(item.status || 'pending');
  const timestamp = item.redeemedAt || item.createdAt || item.updatedAt;
  return `
    <article class="redeem-history-item">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${formatRelativeTime(timestamp)}</p>
      </div>
      <span>${escapeHtml(status)}</span>
    </article>
  `;
}

export function renderRedeemPage(user, snapshot = {}) {
  const availablePoints = toNumber(snapshot.pointAccount?.points ?? snapshot.points?.points ?? user.points ?? 0);
  const rewards = (snapshot.rewards || []).map((reward) => renderRewardCard(reward, availablePoints)).join('');
  const redemptions = (snapshot.redemptions || []).slice(0, 8).map(renderRedemptionItem).join('');
  const cardType = escapeHtml(String(user.cardType || 'member').replaceAll('_', ' '));
  const totalRedeemed = (snapshot.redemptions || []).reduce((sum, item) => sum + toNumber(item.pointsRequired ?? item.points ?? item.amount ?? 0), 0);
  const pendingCount = (snapshot.redemptions || []).filter((item) => String(item.status || 'pending').toLowerCase() === 'pending').length;

  return `
    <section class="redeem-luxury-page">
      <div class="redeem-orb redeem-orb-top" aria-hidden="true"></div>
      <div class="redeem-orb redeem-orb-bottom" aria-hidden="true"></div>

      <section class="redeem-points-hero">
        <div class="redeem-grid-texture" aria-hidden="true"></div>
        <div class="redeem-points-main">
          <p class="redeem-eyebrow">Available points</p>
          <h2>${points(availablePoints)}</h2>
          <p>Choose a reward below. The system will create a redemption request in Firestore.</p>
        </div>
        <div class="redeem-points-side">
          <span class="redeem-member-pill">${cardType || 'member'}</span>
          <div class="redeem-hero-actions">
            <span>Redeem when ready</span>
            <span>Track status below</span>
          </div>
        </div>
      </section>

      <section class="redeem-luxury-layout">
        <div class="redeem-rewards-column">
          <div class="redeem-section-head">
            <div>
              <h2>Rewards</h2>
              <p>Browse live rewards and redeem with one tap.</p>
            </div>
          </div>

          <div class="redeem-luxury-grid">
            ${rewards || `
              <article class="redeem-empty-card">
                <span>🎁</span>
                <strong>No active rewards found.</strong>
                <p>Active reward items from Admin will appear here.</p>
                ${snapshot.rewardLoadError ? `<small>Reward load note: ${escapeHtml(snapshot.rewardLoadError)}</small>` : ''}
              </article>
            `}
          </div>
        </div>

        <aside class="redeem-history-column">
          <div class="redeem-section-head">
            <div>
              <h2>My Redemptions</h2>
              <p>Your latest requests and statuses.</p>
            </div>
          </div>

          <div class="redeem-history-panel">
            ${redemptions || `
              <div class="redeem-empty-history">
                <div>🎁</div>
                <strong>No Redemption History</strong>
                <p>Your new requests will appear here once you redeem a reward.</p>
              </div>
            `}
          </div>

          <div class="redeem-stats-list">
            <div><span>Points available</span><strong>${points(availablePoints)} pts</strong></div>
            <div><span>Total redeemed</span><strong>${points(totalRedeemed)} pts</strong></div>
            <div><span>Pending requests</span><strong>${pendingCount}</strong></div>
          </div>
        </aside>
      </section>
    </section>
  `;
}
