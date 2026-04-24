import { renderDigitalCard } from '../components/digital-card.js';
import { money, points, titleize } from '../utils/helpers.js';

function escapeHtml(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderCardItem(item) {
  const searchText = [item.displayName, item.cardNumber, item.roomNo, item.cardType, item.theme?.title, item.theme?.key].filter(Boolean).join(' ').toLowerCase();
  return `
    <article class="card-tools-item card" data-card-item data-card-id="${escapeHtml(item.userId)}" data-card-type="${escapeHtml(item.cardType || '')}" data-theme-key="${escapeHtml(item.theme?.key || item.cardTheme || '')}" data-search="${escapeHtml(searchText)}">
      <div class="card-tools-select-row">
        <label class="card-tools-checkbox"><input type="checkbox" data-card-select value="${escapeHtml(item.userId)}"> <span>Select</span></label>
        <div class="info-row compact-row">
          <span class="badge">${escapeHtml(titleize(item.cardType || 'member'))}</span>
          ${item.theme?.title ? `<span class="badge badge-outline">${escapeHtml(item.theme.title)}</span>` : ''}
        </div>
      </div>
      ${renderDigitalCard(item.profile || {}, item.card || {}, item.theme || null)}
      <div class="detail-card">
        <div class="detail-row"><span>Name</span><strong>${escapeHtml(item.displayName || '-')}</strong></div>
        <div class="detail-row"><span>Card no.</span><strong>${escapeHtml(item.cardNumber || '-')}</strong></div>
        <div class="detail-row"><span>Room</span><strong>${escapeHtml(item.roomNo || '-')}</strong></div>
        <div class="detail-row"><span>Balance</span><strong>${money(item.balance || 0)}</strong></div>
        <div class="detail-row"><span>Points</span><strong>${points(item.points || 0)} pts</strong></div>
      </div>
    </article>
  `;
}

export function renderCardToolsPage(user, snapshot = {}) {
  const themes = snapshot.cardThemes || [];
  const cards = snapshot.cards || [];
  const themeOptions = themes.map((item) => `<option value="${escapeHtml(item.key || item.id)}">${escapeHtml(item.title || item.key || item.id)}</option>`).join('');
  const list = cards.map(renderCardItem).join('');
  return `
    <section class="hero-card card">
      <div class="hero-meta">
        <div>
          <p class="eyebrow">Card studio</p>
          <h2>Print / Export QR Card</h2>
          <p class="muted">Filter members, preview their themed cards, then print or export a selected card pack.</p>
        </div>
        <span class="badge">${escapeHtml(user.department || user.role || 'admin')}</span>
      </div>
      <div class="info-row">
        <button class="mini-btn" type="button" data-route="admin">Back to Admin</button>
      </div>
    </section>

    <section class="page-section">
      <article class="card admin-panel">
        <div class="grid grid-2">
          <label><span>Search</span><input id="cardtools-search" placeholder="Name, room, card number, theme"></label>
          <label><span>Card type</span>
            <select id="cardtools-type-filter">
              <option value="">All card types</option>
              <option value="excom">Excom</option>
              <option value="hod">HOD</option>
              <option value="manager">Manager</option>
              <option value="team_member">Team member</option>
              <option value="fitness_guest">Fitness guest</option>
              <option value="guest_point">Guest point</option>
            </select>
          </label>
          <label><span>Theme</span>
            <select id="cardtools-theme-filter">
              <option value="">All themes</option>
              ${themeOptions}
            </select>
          </label>
          <div class="detail-card card-tools-summary">
            <p class="muted">Selected cards</p>
            <strong id="cardtools-selected-count">0</strong>
          </div>
        </div>
        <div class="inline-actions card-tools-actions">
          <button class="btn btn-secondary" type="button" id="cardtools-select-visible">Select visible</button>
          <button class="btn btn-secondary" type="button" id="cardtools-clear-selection">Clear selection</button>
          <button class="btn btn-primary" type="button" id="cardtools-print-btn">Print selected</button>
          <button class="btn btn-secondary" type="button" id="cardtools-export-html-btn">Export HTML</button>
          <button class="btn btn-secondary" type="button" id="cardtools-export-csv-btn">Export CSV</button>
        </div>
      </article>
    </section>

    <section class="page-section">
      <h2>Card pack preview</h2>
      <div class="card-sheet-grid" id="cardtools-grid">${list || '<article class="empty-state"><strong>No cards available</strong><p class="muted">Create member cards first from Admin Dashboard.</p></article>'}</div>
    </section>
  `;
}
