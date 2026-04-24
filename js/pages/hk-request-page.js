import { formatDateTime, formatRelativeTime, titleize } from '../utils/helpers.js';

export const HK_ITEMS = [
  { key: 'pillow', label: 'Pillow' },
  { key: 'blanket', label: 'Blanket' },
  { key: 'towel', label: 'Towel' },
  { key: 'water', label: 'Water' },
  { key: 'tea', label: 'Tea' },
  { key: 'coffee', label: 'Coffee' },
  { key: 'toiletries', label: 'Toiletries' }
];

function renderRequestActions(item, canManage) {
  if (!canManage) return `<span class="badge">${titleize(item.status || 'new')}</span>`;
  const buttons = [];
  if (item.status === 'new') buttons.push(`<button class="mini-btn" data-hk-status="accepted" data-hk-id="${item.id}">Accept</button>`);
  if (['new', 'accepted'].includes(item.status)) buttons.push(`<button class="mini-btn" data-hk-status="delivering" data-hk-id="${item.id}">Delivering</button>`);
  if (item.status !== 'completed') buttons.push(`<button class="mini-btn mini-btn-success" data-hk-status="completed" data-hk-id="${item.id}">Complete</button>`);
  return `<div class="queue-actions-inline">${buttons.join('')}</div>`;
}

export function renderHkRequestList(requests = [], canManage = false) {
  if (!requests.length) {
    return `<article class="transaction-item"><div><strong>No HK requests yet</strong><p class="muted">New housekeeping requests will appear here in realtime.</p></div><strong>-</strong></article>`;
  }

  return requests.map((item) => {
    const itemsText = (item.items || []).map((row) => `${row.label || titleize(row.key)} × ${row.qty || 1}`).join(', ');
    return `
      <article class="request-board-card card-soft">
        <div class="request-board-head">
          <div>
            <strong>${item.roomNo || '-'} • ${item.guestName || 'Guest'}</strong>
            <p class="muted">${itemsText || 'No items'}${item.note ? ` • ${item.note}` : ''}</p>
          </div>
          <span class="badge">${titleize(item.status || 'new')}</span>
        </div>
        <div class="request-board-meta">
          <span class="muted">Created ${formatRelativeTime(item.createdAt)}</span>
          <span class="muted">Updated ${formatDateTime(item.updatedAt || item.createdAt)}</span>
        </div>
        ${renderRequestActions(item, canManage)}
      </article>
    `;
  }).join('');
}

export function renderHkRequestPage(user, snapshot = {}) {
  const options = HK_ITEMS.map((item) => `<option value="${item.key}">${item.label}</option>`).join('');
  return `
    <section class="grid grid-2 service-layout">
      <article class="card service-form-card">
        <div class="hero-meta">
          <div>
            <p class="eyebrow">Housekeeping request</p>
            <h2>Request items from HK</h2>
            <p class="muted">Send a realtime request for pillows, blankets, towels, water, tea, coffee, and more.</p>
          </div>
          <span class="badge">${user.roomNo ? `Room ${user.roomNo}` : user.role || 'member'}</span>
        </div>

        <form id="hk-request-form" class="grid" style="margin-top:14px">
          <label>
            <span>Item</span>
            <select id="hk-item">${options}</select>
          </label>
          <label>
            <span>Quantity</span>
            <input id="hk-qty" type="number" min="1" step="1" value="1" />
          </label>
          <label>
            <span>Note</span>
            <textarea id="hk-note" rows="4" placeholder="Example: please deliver after 6 PM"></textarea>
          </label>
          <button class="btn btn-primary" type="submit">Send HK request</button>
        </form>
      </article>

      <article class="card service-board-card">
        <div class="hero-meta">
          <div>
            <p class="eyebrow">Realtime board</p>
            <h2>${snapshot.canManage ? 'Department queue' : 'My HK requests'}</h2>
          </div>
          <span class="badge" id="hk-count-badge">${(snapshot.requests || []).length} items</span>
        </div>
        <div id="hk-request-list" class="stack-list service-board-list">${renderHkRequestList(snapshot.requests || [], snapshot.canManage)}</div>
      </article>
    </section>
  `;
}
