import { formatDateTime, formatRelativeTime, initials, titleize } from '../utils/helpers.js';

export const CHAT_DEPARTMENTS = [
  { key: 'fo', label: 'Front Office' },
  { key: 'hk', label: 'Housekeeping' },
  { key: 'eng', label: 'Engineering' },
  { key: 'fb', label: 'F&B' },
  { key: 'fitness', label: 'Fitness' }
];

export function renderChatThreadList(threads = [], selectedThreadId = null) {
  if (!threads.length) {
    return `<article class="thread-card empty-state"><strong>No conversations yet</strong><p class="muted">Start a new department chat using the message box.</p></article>`;
  }

  return threads.map((item) => `
    <button class="thread-card ${item.id === selectedThreadId ? 'is-active' : ''}" data-thread-id="${item.id}">
      <div class="thread-avatar">${initials(item.roomNo || item.guestName || item.department)}</div>
      <div class="thread-copy">
        <strong>${item.roomNo || '-'} • ${titleize(item.department || 'chat')}</strong>
        <p class="muted">${item.lastMessage || item.subject || 'Open thread'}</p>
        <span class="thread-meta">${formatRelativeTime(item.updatedAt || item.lastMessageAt || item.createdAt)} • ${titleize(item.status || 'open')}</span>
      </div>
    </button>
  `).join('');
}

export function renderChatMessages(messages = [], currentUserId = '') {
  if (!messages.length) {
    return `<div class="empty-state"><strong>No messages yet</strong><p class="muted">Send the first message to open this department chat.</p></div>`;
  }

  return messages.map((item) => `
    <article class="chat-bubble ${item.senderId === currentUserId ? 'is-self' : ''}">
      <div class="chat-bubble-head">
        <strong>${item.senderName || titleize(item.senderType || 'user')}</strong>
        <span class="muted">${formatDateTime(item.createdAt)}</span>
      </div>
      <p>${item.message || ''}</p>
    </article>
  `).join('');
}

export function renderChatPage(user, snapshot = {}) {
  const departments = CHAT_DEPARTMENTS.map((dept) => `
    <button class="mode-btn ${snapshot.selectedDepartment === dept.key ? 'is-active' : ''}" type="button" data-chat-department="${dept.key}">${dept.label}</button>
  `).join('');

  const selectedThread = (snapshot.threads || []).find((item) => item.id === snapshot.selectedThreadId) || null;

  return `
    <section class="grid grid-2 chat-layout">
      <article class="card service-board-card">
        <div class="hero-meta">
          <div>
            <p class="eyebrow">Department chat</p>
            <h2>${isStaffTitle(user) ? 'Department queue' : 'Choose a department'}</h2>
            <p class="muted">Realtime chat powered by Firestore listeners.</p>
          </div>
          <span class="badge">${(snapshot.threads || []).length} threads</span>
        </div>
        <div class="mode-grid">${departments}</div>
        <div id="chat-thread-list" class="thread-list">${renderChatThreadList(snapshot.threads || [], snapshot.selectedThreadId)}</div>
      </article>

      <article class="card service-form-card chat-window-card">
        <div class="hero-meta">
          <div>
            <p class="eyebrow">Conversation</p>
            <h2>${selectedThread ? `${selectedThread.roomNo || '-'} • ${titleize(selectedThread.department || 'chat')}` : 'New message'}</h2>
            <p class="muted">${selectedThread ? `${titleize(selectedThread.status || 'open')} • Updated ${formatRelativeTime(selectedThread.updatedAt || selectedThread.lastMessageAt)}` : 'Send the first message to open a thread.'}</p>
          </div>
          ${selectedThread ? `<span class="badge">${titleize(selectedThread.status || 'open')}</span>` : ''}
        </div>

        <div class="chat-actions-inline">
          ${isStaffTitle(user) && selectedThread ? `<button class="mini-btn" type="button" data-chat-action="assign" data-thread-id="${selectedThread.id}">Assign to me</button>` : ''}
          ${selectedThread ? `<button class="mini-btn" type="button" data-chat-action="${selectedThread.status === 'closed' ? 'reopen' : 'close'}" data-thread-id="${selectedThread.id}">${selectedThread.status === 'closed' ? 'Reopen' : 'Close'}</button>` : ''}
        </div>

        <div id="chat-message-list" class="chat-message-list">${renderChatMessages(snapshot.messages || [], user.uid)}</div>

        <form id="chat-message-form" class="chat-form">
          <input type="hidden" id="chat-thread-id" value="${snapshot.selectedThreadId || ''}" />
          <input type="hidden" id="chat-department" value="${snapshot.selectedDepartment || 'fo'}" />
          <textarea id="chat-message-input" rows="4" placeholder="Type your message here..."></textarea>
          <button class="btn btn-primary" type="submit">Send message</button>
        </form>
      </article>
    </section>
  `;
}

function isStaffTitle(user) {
  return ['super_admin', 'admin', 'staff', 'finance_staff', 'fo_staff', 'hk_staff', 'fb_staff', 'fitness_staff', 'department_manager'].includes(user?.role || '');
}
