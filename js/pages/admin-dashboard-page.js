import { formatRelativeTime, money, points, titleize } from '../utils/helpers.js';

function escapeHtml(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function encodePayload(record = {}) {
  return escapeHtml(encodeURIComponent(JSON.stringify(record)));
}

function boolBadge(value) {
  return value ? '<span class="badge">Active</span>' : '<span class="badge">Inactive</span>';
}

function authBadge(item) {
  return item?.hasAuthAccount ? '<span class="badge badge-outline">Firebase Auth</span>' : '<span class="badge badge-outline">Firestore only</span>';
}

function imageThumb(url, alt) {
  if (!url) return '<div class="admin-thumb admin-thumb-placeholder">No image</div>';
  return `<img class="admin-thumb" src="${escapeHtml(url)}" alt="${escapeHtml(alt || 'image')}">`;
}

function queueActionButtons(item) {
  if (item.status !== 'pending') return '';
  return `
    <div class="queue-actions-inline">
      <button class="mini-btn mini-btn-success" data-scan-action="approve" data-scan-id="${item.id}">Process</button>
      <button class="mini-btn mini-btn-danger" data-scan-action="reject" data-scan-id="${item.id}">Reject</button>
    </div>
  `;
}

function renderMemberRow(item) {
  return `
    <article class="transaction-item admin-list-item admin-media-row">
      <div class="admin-media-block">
        ${imageThumb(item.photoURL, item.displayName || item.uid)}
        <div>
          <strong>${escapeHtml(item.displayName || item.firstName || item.uid)}</strong>
          <p class="muted">${titleize(item.role || 'member')} • ${titleize(item.cardType || 'member')} ${item.roomNo ? `• Room ${escapeHtml(item.roomNo)}` : ''}</p>
          <p class="muted">${money(item.balance || 0)} • ${points(item.points || 0)} pts • ${titleize(item.status || 'active')}</p>
          <div class="info-row compact-row">${authBadge(item)} ${item.email ? `<span class="badge badge-outline">${escapeHtml(item.email)}</span>` : ''}</div>
        </div>
      </div>
      <div class="queue-actions admin-row-actions">
        <span class="badge">${escapeHtml(item.uid)}</span>
        <div class="queue-actions-inline">
          <button class="mini-btn" data-admin-edit="member" data-admin-payload="${encodePayload(item)}">Edit</button>
          <button class="mini-btn mini-btn-danger" data-admin-delete="member" data-admin-id="${escapeHtml(item.uid)}" data-admin-has-auth="${item.hasAuthAccount ? '1' : '0'}">Delete</button>
        </div>
      </div>
    </article>
  `;
}

function renderRewardRow(item) {
  return `
    <article class="transaction-item admin-list-item admin-media-row">
      <div class="admin-media-block">
        ${imageThumb(item.imageUrl, item.title || 'Reward')}
        <div>
          <strong>${escapeHtml(item.title || 'Reward')}</strong>
          <p class="muted">${titleize(item.category || 'general')} • ${points(item.pointsRequired || 0)} pts • Stock ${Number(item.stock || 0)}</p>
        </div>
      </div>
      <div class="queue-actions admin-row-actions">
        ${boolBadge(item.active !== false)}
        <div class="queue-actions-inline">
          <button class="mini-btn" data-admin-edit="reward" data-admin-payload="${encodePayload(item)}">Edit</button>
          <button class="mini-btn mini-btn-danger" data-admin-delete="reward" data-admin-id="${escapeHtml(item.id)}">Delete</button>
        </div>
      </div>
    </article>
  `;
}

function renderContentLinkRow(item) {
  return `
    <article class="transaction-item admin-list-item">
      <div>
        <strong>${escapeHtml(item.title || item.key || 'Link')}</strong>
        <p class="muted">${escapeHtml(item.key || item.id)} • ${escapeHtml(item.url || '#')}</p>
      </div>
      <div class="queue-actions admin-row-actions">
        ${boolBadge(item.active !== false)}
        <div class="queue-actions-inline">
          <button class="mini-btn" data-admin-edit="content_link" data-admin-payload="${encodePayload(item)}">Edit</button>
          <button class="mini-btn mini-btn-danger" data-admin-delete="content_link" data-admin-id="${escapeHtml(item.id)}">Delete</button>
        </div>
      </div>
    </article>
  `;
}

function renderBannerRow(item) {
  return `
    <article class="transaction-item admin-list-item admin-media-row">
      <div class="admin-media-block">
        ${imageThumb(item.imageUrl, item.title || 'Banner')}
        <div>
          <strong>${escapeHtml(item.title || 'Notice')}</strong>
          <p class="muted">${escapeHtml(item.body || item.description || 'No body yet.').slice(0, 120)}</p>
        </div>
      </div>
      <div class="queue-actions admin-row-actions">
        ${boolBadge(item.active !== false)}
        <div class="queue-actions-inline">
          <button class="mini-btn" data-admin-edit="content_banner" data-admin-payload="${encodePayload(item)}">Edit</button>
          <button class="mini-btn mini-btn-danger" data-admin-delete="content_banner" data-admin-id="${escapeHtml(item.id)}">Delete</button>
        </div>
      </div>
    </article>
  `;
}

function imageField(prefix, label, previewAlt) {
  return `
    <div class="admin-upload-block">
      <label class="stack-label">
        <span>${label}</span>
        <input name="${prefix}File" type="file" accept="image/*">
      </label>
      <div class="admin-upload-preview" data-preview-for="${prefix}">${imageThumb('', previewAlt)}</div>
    </div>
  `;
}

export function renderAdminDashboardPage(user, snapshot = {}) {
  const k = snapshot.kpis || {};
  const recentScans = (snapshot.recentScans || []).map((item) => `
    <article class="transaction-item">
      <div>
        <strong>${escapeHtml(item.targetDisplayName || item.code || item.id)}</strong>
        <p class="muted">${titleize(item.mode || 'scan')} • ${formatRelativeTime(item.createdAt)}</p>
      </div>
      <div class="queue-actions">
        <strong>${titleize(item.status || 'pending')}</strong>
        ${queueActionButtons(item)}
      </div>
    </article>
  `).join('');

  const recentTransactions = (snapshot.recentTransactions || []).map((item) => `
    <article class="transaction-item">
      <div>
        <strong>${escapeHtml(titleize(item.transactionType || item.title || 'wallet'))}</strong>
        <p class="muted">${escapeHtml(item.operatorName || item.note || 'transaction')} • ${formatRelativeTime(item.createdAt)}</p>
      </div>
      <strong>${money(item.amount || 0)}</strong>
    </article>
  `).join('');

  const members = (snapshot.members || []).map(renderMemberRow).join('');
  const rewards = (snapshot.rewards || []).map(renderRewardRow).join('');
  const contentLinks = (snapshot.contentLinks || []).map(renderContentLinkRow).join('');
  const contentBanners = (snapshot.contentBanners || []).map(renderBannerRow).join('');

  return `
    <section class="hero-card card admin-hero-card">
      <div class="hero-meta">
        <div>
          <p class="eyebrow">Admin dashboard</p>
          <h2>${escapeHtml(user.displayName || 'Administrator')}</h2>
          <p class="muted">Operational snapshot plus CRUD management for members, rewards, and home content.</p>
        </div>
        <span class="badge">${escapeHtml(user.department || user.role || 'admin')}</span>
      </div>
      <div class="info-row" style="margin-top:12px">
        <button class="mini-btn" type="button" data-admin-scroll="admin-members">Members</button>
        <button class="mini-btn" type="button" data-admin-scroll="admin-rewards">Rewards</button>
        <button class="mini-btn" type="button" data-admin-scroll="admin-content">Content</button>
      </div>
    </section>

    <section class="page-section">
      <h2>Today overview</h2>
      <div class="dashboard-grid">
        <article class="kpi"><span class="muted">Members</span><strong>${k.users || 0}</strong></article>
        <article class="kpi"><span class="muted">Active guest sessions</span><strong>${k.guestSessions || 0}</strong></article>
        <article class="kpi"><span class="muted">Open HK requests</span><strong>${k.openHkRequests || 0}</strong></article>
        <article class="kpi"><span class="muted">Borrowed towels</span><strong>${k.borrowedTowels || 0}</strong></article>
        <article class="kpi"><span class="muted">Pending scan queue</span><strong>${k.pendingScanRequests || 0}</strong></article>
        <article class="kpi"><span class="muted">Active redemptions</span><strong>${k.activeRedemptions || 0}</strong></article>
        <article class="kpi"><span class="muted">Open chat threads</span><strong>${k.openChatThreads || 0}</strong></article>
      </div>
    </section>

    <section class="page-section">
      <h2>Recent scan queue</h2>
      <div class="list">${recentScans || '<article class="transaction-item"><div><strong>No scan queue yet</strong><p class="muted">New top-up, deduct, earn point, and reward use requests will appear here.</p></div><strong>-</strong></article>'}</div>
    </section>

    <section class="page-section">
      <h2>Recent wallet activity</h2>
      <div class="list">${recentTransactions || '<article class="transaction-item"><div><strong>No wallet activity yet</strong><p class="muted">Recent financial movements will render here once collections are live.</p></div><strong>-</strong></article>'}</div>
    </section>

    <section class="page-section admin-member-page" id="admin-members">
      <div class="admin-member-titlebar">
        <div>
          <p class="eyebrow">Members management</p>
          <h2>Create Member</h2>
          <p class="muted">Create a member profile, card, wallet, point account, and optional Firebase login in one guided form.</p>
        </div>
        <span class="badge badge-gold">★ All fields marked * are required</span>
      </div>

      <article class="card admin-panel admin-member-card">
        <div class="admin-member-card-head">
          <div>
            <p class="eyebrow">Admin form</p>
            <h3>Member Profile</h3>
            <p class="muted">Start with profile details, then choose access, card, wallet, and login options.</p>
          </div>
          <span class="badge badge-outline admin-save-mode">Firestore + Firebase ready</span>
        </div>
        <form id="admin-member-form" class="admin-form admin-member-form stack-list" novalidate>
          <input type="hidden" name="uid">
          <input type="hidden" name="photoURL">
          <input type="hidden" name="photoStoragePath">
          <input type="hidden" name="hasAuthAccount">
          <input type="hidden" name="authManaged">

          <div class="admin-form-section">
            <div class="admin-section-heading">
              <strong>Profile details</strong>
              <span>Basic information shown in the Club House system.</span>
            </div>
            <div class="admin-member-grid">
              <label class="lux-field required-field"><span>Display name <b>*</b></span><div class="input-wrap"><i>👤</i><input name="displayName" placeholder="Noi Guest" required></div><small class="field-help">The name shown throughout the system.</small></label>
              <label class="lux-field"><span>Email</span><div class="input-wrap"><i>✉️</i><input name="email" type="email" placeholder="guest@example.com" autocomplete="email"></div><small class="field-help">Required when creating Firebase login.</small></label>
              <label class="lux-field"><span>First name</span><div class="input-wrap"><i>👤</i><input name="firstName" placeholder="Noi" autocomplete="given-name"></div><small class="field-help">Member's legal first name.</small></label>
              <label class="lux-field"><span>Last name</span><div class="input-wrap"><i>👤</i><input name="lastName" placeholder="Guest" autocomplete="family-name"></div><small class="field-help">Member's legal last name.</small></label>
              <label class="lux-field"><span>Phone</span><div class="input-wrap"><i>☎️</i><input name="phone" placeholder="08x-xxx-xxxx" inputmode="tel" autocomplete="tel"></div><small class="field-help">Enter a valid phone number.</small></label>
              <label class="lux-field"><span>Room no.</span><div class="input-wrap"><i>🚪</i><input name="roomNo" placeholder="D101" autocomplete="off"></div><small class="field-help">Room or residence number, if applicable.</small></label>
            </div>
          </div>

          <div class="admin-form-section">
            <div class="admin-section-heading">
              <strong>Access and card setup</strong>
              <span>Set role, department, card tier, language, status, wallet, and points.</span>
            </div>
            <div class="admin-member-grid">
              <label class="lux-field required-field"><span>Role <b>*</b></span><div class="input-wrap select-wrap"><i>🛡️</i><select name="role">
                <option value="member">member</option>
                <option value="guest">guest</option>
                <option value="staff">staff</option>
                <option value="admin">admin</option>
                <option value="fo_staff">fo_staff</option>
                <option value="hk_staff">hk_staff</option>
                <option value="fb_staff">fb_staff</option>
                <option value="fitness_staff">fitness_staff</option>
                <option value="finance_staff">finance_staff</option>
                <option value="department_manager">department_manager</option>
              </select></div><small class="field-help">Choose what this member can access.</small></label>
              <label class="lux-field"><span>Department</span><div class="input-wrap select-wrap"><i>🏢</i><select name="department">
                <option value="">-</option>
                <option value="admin">admin</option>
                <option value="fo">fo</option>
                <option value="hk">hk</option>
                <option value="fb">fb</option>
                <option value="engineering">engineering</option>
                <option value="fitness">fitness</option>
              </select></div><small class="field-help">Optional department tag for staff users.</small></label>
              <label class="lux-field"><span>Card type</span><div class="input-wrap select-wrap"><i>💳</i><select name="cardType">
                <option value="team_member" selected>team_member</option>
                <option value="excom">excom</option>
                <option value="hod">hod</option>
                <option value="manager">manager</option>
                <option value="fitness_guest">fitness_guest</option>
                <option value="guest_point">guest_point</option>
              </select></div><small class="field-help">Default is Team Member to avoid accidental Excom cards.</small></label>
              <label class="lux-field"><span>Card level</span><div class="input-wrap"><i>⭐</i><input name="cardLevel" type="number" min="0" max="10" value="1"></div><small class="field-help">Access card level assigned to this member.</small></label>
              <label class="lux-field"><span>Card color</span><div class="input-wrap select-wrap"><i>🎨</i><select name="cardColor">
                <option value="gold" selected>gold</option>
                <option value="silver">silver</option>
                <option value="bronze">bronze</option>
                <option value="white">white</option>
                <option value="black">black</option>
                <option value="red">red</option>
              </select></div><small class="field-help">Gold is the safe default for readability.</small></label>
              <label class="lux-field"><span>Status</span><div class="input-wrap select-wrap"><i>✅</i><select name="status">
                <option value="active">active</option>
                <option value="suspended">suspended</option>
                <option value="expired">expired</option>
                <option value="checked_out">checked_out</option>
              </select></div><small class="field-help">Set the current member status.</small></label>
              <label class="lux-field"><span>Language</span><div class="input-wrap select-wrap"><i>🌐</i><select name="language">
                <option value="th" selected>th</option>
                <option value="en">en</option>
                <option value="ru">ru</option>
                <option value="zh">zh</option>
              </select></div><small class="field-help">Default language is Thai for hotel operations.</small></label>
              <label class="lux-field"><span>Wallet balance</span><div class="input-wrap"><i>฿</i><input name="balance" type="number" min="0" value="0"></div><small class="field-help">Opening wallet balance in THB.</small></label>
              <label class="lux-field"><span>Points</span><div class="input-wrap"><i>🏆</i><input name="points" type="number" min="0" value="0"></div><small class="field-help">Opening point balance.</small></label>
            </div>
          </div>

          <div class="admin-form-section admin-login-section">
            <div class="admin-section-heading">
              <strong>Firebase login</strong>
              <span>Only enable this when the member needs to sign in with email and password.</span>
            </div>
            <div class="admin-member-grid">
              <label class="admin-check auth-login-toggle lux-auth-toggle admin-full-row"><input name="createAuthUser" type="checkbox"><span><strong>Create Firebase login</strong><small>Provision a password account through Firebase before saving profile docs.</small></span></label>
              <label class="auth-password-field lux-password-field admin-full-row"><span>Temporary password <em data-auth-required-label>required only when Firebase login is enabled</em></span><div class="input-wrap"><i>🔒</i><input name="authPassword" type="password" minlength="6" placeholder="Tick Firebase login first" autocomplete="new-password"></div><small class="field-help">This password is used for the first login. The member can change it later.</small></label>
            </div>
          </div>

          <p class="admin-form-note">Tip: you can choose a profile image before clicking Save. The system will create the member ID first, then upload the image automatically.</p>
          ${imageField('photo', 'Profile image', 'Profile image')}
          <div class="inline-actions admin-form-actions">
            <button class="btn btn-secondary" type="button" data-admin-reset="member">Cancel / Reset</button>
            <button class="btn btn-primary" type="submit">👤 Create / Save Member</button>
          </div>
        </form>
      </article>
      <div class="list admin-member-list">${members || '<article class="transaction-item"><div><strong>No members yet</strong><p class="muted">Create the first member profile from the form above.</p></div><strong>-</strong></article>'}</div>
    </section>

    <section class="page-section" id="admin-rewards">
      <h2>Rewards CRUD</h2>
      <article class="card admin-panel">
        <form id="admin-reward-form" class="admin-form stack-list">
          <input type="hidden" name="id">
          <input type="hidden" name="imageUrl">
          <input type="hidden" name="imageStoragePath">
          <div class="grid grid-2">
            <label><span>Title</span><input name="title" placeholder="Free Mocktail" required></label>
            <label><span>Category</span><input name="category" placeholder="beverage"></label>
            <label><span>Points required</span><input name="pointsRequired" type="number" min="0" value="0"></label>
            <label><span>Stock</span><input name="stock" type="number" min="0" value="0"></label>
            <label><span>Sort order</span><input name="sortOrder" type="number" min="0" value="0"></label>
            <label class="admin-check"><input name="active" type="checkbox" checked><span>Active</span></label>
          </div>
          ${imageField('image', 'Reward image', 'Reward image')}
          <label><span>Description</span><textarea name="description" rows="3" placeholder="Reward detail for guests or members."></textarea></label>
          <div class="inline-actions">
            <button class="btn btn-primary" type="submit">Save reward</button>
            <button class="btn btn-secondary" type="button" data-admin-reset="reward">Reset</button>
          </div>
        </form>
      </article>
      <div class="list">${rewards || '<article class="transaction-item"><div><strong>No rewards yet</strong><p class="muted">Create your first redeem item above.</p></div><strong>-</strong></article>'}</div>
    </section>

    <section class="page-section" id="admin-content">
      <h2>Content CRUD</h2>
      <article class="card admin-panel">
        <h3>Home quick links</h3>
        <form id="admin-content-link-form" class="admin-form stack-list">
          <input type="hidden" name="id">
          <div class="grid grid-2">
            <label><span>Key</span><input name="key" placeholder="food_to_room" required></label>
            <label><span>Title</span><input name="title" placeholder="Order Food to Room" required></label>
            <label><span>URL</span><input name="url" placeholder="https://example.com"></label>
            <label><span>Icon</span><input name="icon" placeholder="utensils"></label>
            <label><span>Sort order</span><input name="sortOrder" type="number" min="0" value="0"></label>
            <label class="admin-check"><input name="active" type="checkbox" checked><span>Active</span></label>
          </div>
          <label><span>Description</span><textarea name="description" rows="3" placeholder="Short description for the home card."></textarea></label>
          <div class="inline-actions">
            <button class="btn btn-primary" type="submit">Save link</button>
            <button class="btn btn-secondary" type="button" data-admin-reset="content_link">Reset</button>
          </div>
        </form>
      </article>
      <div class="list">${contentLinks || '<article class="transaction-item"><div><strong>No home links yet</strong><p class="muted">Create service shortcuts for the Home page.</p></div><strong>-</strong></article>'}</div>

      <article class="card admin-panel">
        <h3>Notices / banners</h3>
        <form id="admin-banner-form" class="admin-form stack-list">
          <input type="hidden" name="id">
          <input type="hidden" name="imageUrl">
          <input type="hidden" name="imageStoragePath">
          <div class="grid grid-2">
            <label><span>Title</span><input name="title" placeholder="Pool notice" required></label>
            <label><span>Sort order</span><input name="sortOrder" type="number" min="0" value="0"></label>
            <label class="admin-check"><input name="active" type="checkbox" checked><span>Active</span></label>
          </div>
          ${imageField('image', 'Banner image', 'Banner image')}
          <label><span>Body</span><textarea name="body" rows="4" placeholder="Notice body, promotion copy, or important service information."></textarea></label>
          <div class="inline-actions">
            <button class="btn btn-primary" type="submit">Save notice</button>
            <button class="btn btn-secondary" type="button" data-admin-reset="content_banner">Reset</button>
          </div>
        </form>
      </article>
      <div class="list">${contentBanners || '<article class="transaction-item"><div><strong>No notices yet</strong><p class="muted">Create a banner or notice for Home.</p></div><strong>-</strong></article>'}</div>
    </section>
  `;
}
