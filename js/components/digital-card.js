import { titleize } from '../utils/helpers.js';
import { createQrSvgDataUrl } from '../utils/qrcode.js';

const FITNESS_GUEST_FRONT_IMAGE = './assets/cards/fitness-guest-front.png';
const FITNESS_GUEST_BACK_IMAGE = './assets/cards/fitness-guest-back.png';

export function getQrImageUrl(value = '', size = 160, options = {}) {
  return createQrSvgDataUrl(value, size, options);
}

function resolveTheme(card = {}, user = {}, theme = null) {
  const color = theme?.cardColor || card?.cardColor || user?.cardColor || 'gold';
  const gradientFrom = theme?.gradientFrom || '';
  const gradientTo = theme?.gradientTo || '';
  const accentColor = theme?.accentColor || '';
  const textColor = theme?.textColor || '';
  const secondaryTextColor = theme?.secondaryTextColor || '';
  const logoText = theme?.logoText || 'LAYA';
  const footerText = theme?.footerText || titleize(card?.cardType || user?.cardType || 'member');
  return { color, gradientFrom, gradientTo, accentColor, textColor, secondaryTextColor, logoText, footerText };
}

function buildCardStyle(themeConfig = {}) {
  const styleParts = [];
  if (themeConfig.gradientFrom && themeConfig.gradientTo) {
    styleParts.push(`background:linear-gradient(135deg, ${themeConfig.gradientFrom}, ${themeConfig.gradientTo})`);
  }
  if (themeConfig.textColor) styleParts.push(`color:${themeConfig.textColor}`);
  if (themeConfig.accentColor) styleParts.push(`--card-accent:${themeConfig.accentColor}`);
  if (themeConfig.secondaryTextColor) styleParts.push(`--card-muted:${themeConfig.secondaryTextColor}`);
  return styleParts.join(';');
}

function normalizeToken(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function isFitnessGuestCard(user = {}, card = null) {
  const tokens = [
    normalizeToken(card?.cardType),
    normalizeToken(user?.cardType),
    normalizeToken(card?.cardLevelName),
    normalizeToken(user?.cardLevelName),
    normalizeToken(card?.memberType),
    normalizeToken(user?.memberType),
    normalizeToken(card?.role),
    normalizeToken(user?.role)
  ].filter(Boolean);

  return tokens.some((token) => token === 'fitness_guest' || token === 'fitnessguest');
}

function renderCardFront({ user, theme, cardType, cardNumber, qrValue, qrImage, themeConfig }) {
  return `
    <section class="digital-card digital-card-face digital-card-front card-${themeConfig.color}" style="${buildCardStyle(themeConfig)}">
      <div class="dc-top">
        <div class="dc-brand-block">
          <p class="dc-eyebrow">${theme?.title || 'LAYA CARD'}</p>
          <h2 class="dc-name">${user.displayName || 'Member'}</h2>
          <p class="dc-role">${cardType}${user.roomNo ? ` · Room ${user.roomNo}` : ''}</p>
        </div>
        <div class="dc-logo-pill">${themeConfig.logoText}</div>
      </div>

      <div class="dc-chip-row">
        <div class="dc-chip" aria-hidden="true"></div>
        <div class="dc-number">${cardNumber}</div>
      </div>

      <div class="dc-bottom">
        <div class="dc-identity">
          <p class="dc-label">${themeConfig.footerText}</p>
          <p class="dc-qr-value">${qrValue}</p>
        </div>
        <div class="qr-box qr-box-image">
          <img src="${qrImage}" alt="QR code for ${cardNumber}" loading="lazy" referrerpolicy="no-referrer">
        </div>
      </div>
    </section>
  `;
}

function renderCardBack({ user, cardType, cardNumber, qrValue, qrImage, themeConfig }) {
  return `
    <section class="digital-card digital-card-face digital-card-back card-${themeConfig.color}" style="${buildCardStyle(themeConfig)}" aria-hidden="true">
      <div class="dc-back-top">
        <div>
          <p class="dc-eyebrow">MEMBER BACK</p>
          <h3 class="dc-back-title">Present this card to staff</h3>
        </div>
        <div class="dc-logo-pill">${themeConfig.logoText}</div>
      </div>

      <div class="dc-back-body">
        <div class="dc-back-copy">
          <div class="dc-back-row">
            <span class="dc-label">Name</span>
            <strong>${user.displayName || 'Member'}</strong>
          </div>
          <div class="dc-back-row">
            <span class="dc-label">Card type</span>
            <strong>${cardType}</strong>
          </div>
          <div class="dc-back-row">
            <span class="dc-label">Room</span>
            <strong>${user.roomNo || '—'}</strong>
          </div>
          <div class="dc-back-row">
            <span class="dc-label">Card no.</span>
            <strong class="mono">${cardNumber}</strong>
          </div>
        </div>

        <div class="dc-back-qr-wrap">
          <div class="qr-box qr-box-image qr-box-large">
            <img src="${qrImage}" alt="QR code for ${cardNumber}" loading="lazy" referrerpolicy="no-referrer">
          </div>
          <p class="dc-back-note">Use this QR for identification, scan, balance, and point services.</p>
        </div>
      </div>

      <div class="dc-back-footer">
        <p class="dc-qr-value">${qrValue}</p>
      </div>
    </section>
  `;
}

function renderFitnessGuestCard({ cardNumber, qrImage }) {
  return `
    <div class="digital-card-widget is-fitness-card" data-card-flip-widget>
      <div class="card-flip-toolbar">
        <span class="card-flip-hint">Tap the card to view front / back</span>
        <button
          type="button"
          class="card-flip-btn"
          data-card-flip-toggle
          aria-label="Show back of card"
          aria-pressed="false"
          data-front-label="Show back"
          data-back-label="Show front"
        >Show back</button>
      </div>

      <div
        class="digital-card-flip"
        data-card-flip-stage
        tabindex="0"
        role="button"
        aria-label="Flip member card"
      >
        <div class="digital-card-flip-inner">
          <section class="digital-card digital-card-face digital-card-front fitness-card-image-shell" aria-hidden="false">
            <img class="fitness-card-image" src="${FITNESS_GUEST_FRONT_IMAGE}" alt="Fitness Guest member card front" loading="lazy" referrerpolicy="no-referrer">
          </section>

          <section class="digital-card digital-card-face digital-card-back fitness-card-image-shell" aria-hidden="true">
            <img class="fitness-card-image" src="${FITNESS_GUEST_BACK_IMAGE}" alt="Fitness Guest member card back" loading="lazy" referrerpolicy="no-referrer">
            <div class="fitness-qr-slot" aria-label="QR code area">
              <div class="qr-box qr-box-image fitness-qr-box">
                <img src="${qrImage}" alt="QR code for ${cardNumber}" loading="lazy" referrerpolicy="no-referrer">
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}

export function renderDigitalCard(user = {}, card = null, theme = null) {
  const cardType = titleize(card?.cardType || user.cardType || 'member');
  const cardNumber = card?.cardNumber || `${String(user.cardType || 'CARD').slice(0, 2).toUpperCase()}-${String(user.uid || '000001').slice(-6).toUpperCase()}`;
  const qrValue = card?.qrValue || `LAYA-${cardNumber}`;
  const qrImage = getQrImageUrl(qrValue, 240);
  const fitnessQrImage = getQrImageUrl(qrValue, 640, { margin: 0, ecc: 'H', dark: '#111111', light: '#ffffff' });
  const themeConfig = resolveTheme(card, user, theme);

  if (isFitnessGuestCard(user, card)) {
    return renderFitnessGuestCard({ cardNumber, qrImage: fitnessQrImage });
  }

  return `
    <div class="digital-card-widget" data-card-flip-widget>
      <div class="card-flip-toolbar">
        <span class="card-flip-hint">Tap the card to view front / back</span>
        <button
          type="button"
          class="card-flip-btn"
          data-card-flip-toggle
          aria-label="Show back of card"
          aria-pressed="false"
          data-front-label="Show back"
          data-back-label="Show front"
        >Show back</button>
      </div>

      <div
        class="digital-card-flip"
        data-card-flip-stage
        tabindex="0"
        role="button"
        aria-label="Flip member card"
      >
        <div class="digital-card-flip-inner">
          ${renderCardFront({ user, theme, cardType, cardNumber, qrValue, qrImage, themeConfig })}
          ${renderCardBack({ user, cardType, cardNumber, qrValue, qrImage, themeConfig })}
        </div>
      </div>
    </div>
  `;
}
