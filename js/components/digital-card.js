import { titleize } from '../utils/helpers.js';
import { createQrSvgDataUrl } from '../utils/qrcode.js';

export function getQrImageUrl(value = '', size = 160) {
  return createQrSvgDataUrl(value, size);
}

function resolveTheme(card = {}, user = {}, theme = null) {
  // Default changed from 'white' → 'gold' for better contrast
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

export function renderDigitalCard(user = {}, card = null, theme = null) {
  const cardType = titleize(card?.cardType || user.cardType || 'member');
  const cardNumber = card?.cardNumber || `${String(user.cardType || 'CARD').slice(0, 2).toUpperCase()}-${String(user.uid || '000001').slice(-6).toUpperCase()}`;
  const qrValue = card?.qrValue || `LAYA-${cardNumber}`;
  const qrImage = getQrImageUrl(qrValue, 140);
  const themeConfig = resolveTheme(card, user, theme);
  const styleParts = [];
  if (themeConfig.gradientFrom && themeConfig.gradientTo) styleParts.push(`background:linear-gradient(135deg, ${themeConfig.gradientFrom}, ${themeConfig.gradientTo})`);
  if (themeConfig.textColor) styleParts.push(`color:${themeConfig.textColor}`);
  if (themeConfig.accentColor) styleParts.push(`--card-accent:${themeConfig.accentColor}`);
  if (themeConfig.secondaryTextColor) styleParts.push(`--card-muted:${themeConfig.secondaryTextColor}`);

  return `
    <section class="digital-card card-${themeConfig.color}" style="${styleParts.join(';')}">
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
