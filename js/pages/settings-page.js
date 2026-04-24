export function renderSettingsPage(user, context = {}) {
  const pushStatus = context.pushEnabled ? 'Push alerts connected' : (context.pushReason || 'Push alerts not enabled yet');

  const row = (title, desc) => `
    <article class="setting-item">
      <div class="setting-copy">
        <strong>${title}</strong>
        <span class="muted">${desc}</span>
      </div>
      <span>›</span>
    </article>
  `;

  return `
    <section class="page-section">
      <article class="card profile-card">
        <div class="page-intro">
          <p class="eyebrow">Profile</p>
          <h2>${user.displayName || 'Member'}</h2>
          <p>${user.role || 'member'}${user.roomNo ? ` • Room ${user.roomNo}` : ''}</p>
        </div>
        <div class="info-row" style="margin-top:12px">
          <span class="badge">Mode ${context.mode || 'production'}</span>
          <span class="badge">${context.projectId || 'unconfigured'}</span>
          <span class="badge">${pushStatus}</span>
        </div>
        ${user.profileMissing ? '<p class="warning-copy">This account signed in to Firebase successfully, but `users/{uid}` was not found yet.</p>' : ''}
      </article>
    </section>

    <section class="setting-group">
      <span class="setting-group-title">Account</span>
      ${row('Edit profile', 'Change your visible name and personal details.')}
      ${row('Change password', 'Update your password for future logins.')}
      ${row('Change language', 'Switch app language and display preferences.')}
    </section>

    <section class="setting-group">
      <span class="setting-group-title">App</span>
      ${row('Install app', 'Add this app to your device home screen.')}
      ${row('Enable push alerts', 'Receive realtime updates and request alerts.')}
      ${row('Check version', 'Review the currently loaded application version.')}
      ${row('Clear cache', 'Force refresh cached files when updates are deployed.')}
    </section>

    <section class="setting-group">
      <span class="setting-group-title">Session</span>
      ${row('Logout', 'Sign out from this device and return to the login page.')}
    </section>
  `;
}
