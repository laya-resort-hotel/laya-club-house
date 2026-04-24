import { formatDateTime, formatRelativeTime, titleize } from '../utils/helpers.js';

function renderTowelActions(item, canManage) {
  if (!canManage) return `<span class="badge">${titleize(item.status || 'borrowed')}</span>`;
  if (item.status === 'returned') return `<span class="badge">Returned</span>`;
  return `
    <div class="queue-actions-inline">
      <button class="mini-btn mini-btn-success" data-towel-status="returned" data-towel-id="${item.id}">Mark returned</button>
    </div>
  `;
}

export function renderTowelList(requests = [], canManage = false) {
  if (!requests.length) {
    return `<article class="transaction-item"><div><strong>No towel activity yet</strong><p class="muted">Borrowed towels and returns will appear here in realtime.</p></div><strong>-</strong></article>`;
  }

  return requests.map((item) => `
    <article class="request-board-card card-soft">
      <div class="request-board-head">
        <div>
          <strong>${item.roomNo || '-'} • ${item.guestName || 'Guest'}</strong>
          <p class="muted">${titleize(item.location || 'room_front')} • ${item.qty || 1} towels${item.note ? ` • ${item.note}` : ''}</p>
        </div>
        <span class="badge">${titleize(item.status || 'borrowed')}</span>
      </div>
      <div class="request-board-meta">
        <span class="muted">Borrowed ${formatRelativeTime(item.borrowedAt)}</span>
        <span class="muted">${item.returnedAt ? `Returned ${formatDateTime(item.returnedAt)}` : 'Not returned yet'}</span>
      </div>
      ${renderTowelActions(item, canManage)}
    </article>
  `).join('');
}

export function renderTowelPage(user, snapshot = {}) {
  return `
    <section class="grid grid-2 service-layout">
      <article class="card service-form-card">
        <div class="hero-meta">
          <div>
            <p class="eyebrow">Towel borrow</p>
            <h2>Borrow towels</h2>
            <p class="muted">Create a realtime towel request for room front or gym pickup. Staff can mark return from the same board.</p>
          </div>
          <span class="badge">${user.roomNo ? `Room ${user.roomNo}` : user.role || 'member'}</span>
        </div>

        <form id="towel-request-form" class="grid" style="margin-top:14px">
          <label>
            <span>Pickup location</span>
            <select id="towel-location">
              <option value="room_front">Room front</option>
              <option value="gym">Gym</option>
            </select>
          </label>
          <label>
            <span>Quantity</span>
            <input id="towel-qty" type="number" min="1" step="1" value="1" />
          </label>
          <label>
            <span>Note</span>
            <textarea id="towel-note" rows="4" placeholder="Example: send to gym counter or room front"></textarea>
          </label>
          <button class="btn btn-primary" type="submit">Create towel request</button>
        </form>
      </article>

      <article class="card service-board-card">
        <div class="hero-meta">
          <div>
            <p class="eyebrow">Realtime board</p>
            <h2>${snapshot.canManage ? 'Borrow / return board' : 'My towel requests'}</h2>
          </div>
          <span class="badge" id="towel-count-badge">${(snapshot.requests || []).length} items</span>
        </div>
        <div id="towel-request-list" class="stack-list service-board-list">${renderTowelList(snapshot.requests || [], snapshot.canManage)}</div>
      </article>
    </section>
  `;
}
