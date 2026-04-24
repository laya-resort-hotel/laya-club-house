export function isValidEmail(value = '') {
  const text = String(value || '').trim();
  if (!text) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

export function isStrongEnoughPassword(value = '') {
  return String(value || '').length >= 6;
}

export function normalizeEmployeeId(value = '') {
  return String(value || '').trim().toUpperCase();
}

export function isValidEmployeeId(value = '') {
  const text = normalizeEmployeeId(value);
  return /^[A-Z0-9_-]{3,30}$/.test(text);
}

export function normalizeRoomNo(value = '') {
  return String(value || '').trim().toUpperCase();
}

export function isValidRoomNo(value = '') {
  const text = normalizeRoomNo(value);
  return /^[A-Z]{1,3}\d{1,4}$/.test(text) || /^\d{3,5}$/.test(text);
}

export function isSafeUrl(value = '') {
  const text = String(value || '').trim();
  if (!text) return false;
  if (text === '#') return true;
  return /^(https?:\/\/|mailto:|tel:|\.\/|\/)/i.test(text);
}

export function toYmdDate(value = '') {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function daysBetween(startYmd, endYmd) {
  const start = toYmdDate(startYmd);
  const end = toYmdDate(endYmd);
  if (!start || !end) return NaN;
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function requireNonEmpty(value, message) {
  const text = String(value || '').trim();
  if (!text) throw new Error(message);
  return text;
}

export function requireNumber(value, message, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(message);
  if (options.min != null && number < options.min) throw new Error(options.minMessage || message);
  if (options.max != null && number > options.max) throw new Error(options.maxMessage || message);
  return number;
}

export function validateLoginPayload({ identifier, password }) {
  const safeIdentifier = String(identifier || '').trim();
  assert(isValidEmail(safeIdentifier) || isValidEmployeeId(safeIdentifier), 'Please enter a valid email or employee ID.');
  assert(isStrongEnoughPassword(password), 'Password must be at least 6 characters.');
  return {
    identifier: isValidEmail(safeIdentifier) ? safeIdentifier.toLowerCase() : normalizeEmployeeId(safeIdentifier)
  };
}


export function validateSignupPayload({ firstName, lastName, phone, employeeId, email, password, confirmPassword }) {
  const safeFirstName = requireNonEmpty(firstName, 'First name is required.');
  const safeLastName = String(lastName || '').trim();
  const safePhone = String(phone || '').trim();
  assert(safeFirstName.length <= 80, 'First name is too long.');
  assert(safeLastName.length <= 80, 'Last name is too long.');
  const safeEmployeeId = normalizeEmployeeId(employeeId || '');
  const safeEmail = String(email || '').trim().toLowerCase();
  assert(safePhone.length <= 30, 'Phone number is too long.');
  // v2.2.4: self-registration requires employee ID only (email field removed from form)
  assert(safeEmployeeId, 'Employee ID is required.');
  assert(isValidEmployeeId(safeEmployeeId), 'Employee ID format is invalid. Use letters, numbers, hyphens or underscores (3–30 chars).');
  if (safeEmail) assert(isValidEmail(safeEmail), 'Please enter a valid email address.');
  assert(isStrongEnoughPassword(password), 'Password must be at least 6 characters.');
  assert(String(password || '') === String(confirmPassword || ''), 'Password confirmation does not match.');
  return {
    firstName: safeFirstName,
    lastName: safeLastName,
    phone: safePhone,
    employeeId: safeEmployeeId,
    email: safeEmail
  };
}

export function validateGuestLoginPayload({ roomNo, stayStart, stayEnd, guestName }) {
  requireNonEmpty(roomNo, 'Please enter room number.');
  assert(isValidRoomNo(roomNo), 'Room number format looks invalid. Example: D101 or 101.');
  const start = toYmdDate(stayStart);
  const end = toYmdDate(stayEnd);
  assert(start && end, 'Please enter valid check-in and check-out dates.');
  const duration = daysBetween(stayStart, stayEnd);
  assert(duration >= 0, 'Check-out date must be the same day or after check-in date.');
  assert(duration <= 60, 'Stay period is too long. Please verify the dates.');
  assert(String(guestName || '').trim().length <= 100, 'Guest name is too long.');
  return {
    roomNo: normalizeRoomNo(roomNo),
    stayStart,
    stayEnd,
    guestName: String(guestName || '').trim()
  };
}

export function validateScanPayload({ mode, code, amount, pointAmount, location, note }) {
  requireNonEmpty(mode, 'Scan mode is missing.');
  requireNonEmpty(code, 'Please scan or enter a card / QR / reward code.');
  const safeNote = String(note || '').trim();
  assert(safeNote.length <= 300, 'Note is too long.');
  if (['topup', 'deduct'].includes(mode)) requireNumber(amount, 'Amount must be greater than 0.', { min: 1 });
  if (mode === 'earn_point') requireNumber(pointAmount, 'Points must be greater than 0.', { min: 1 });
  if (['towel_borrow', 'towel_return'].includes(mode)) {
    assert(['room_front', 'gym'].includes(location), 'Invalid towel location.');
  }
}

export function validateHkRequestPayload({ itemKey, qty, note }) {
  requireNonEmpty(itemKey, 'Please select an HK item.');
  requireNumber(qty, 'Quantity must be at least 1.', { min: 1, max: 20, maxMessage: 'Quantity is too large.' });
  assert(String(note || '').trim().length <= 300, 'Note is too long.');
}

export function validateTowelRequestPayload({ location, qty, note }) {
  assert(['room_front', 'gym'].includes(location), 'Please select a valid towel pickup location.');
  requireNumber(qty, 'Quantity must be at least 1.', { min: 1, max: 20, maxMessage: 'Quantity is too large.' });
  assert(String(note || '').trim().length <= 300, 'Note is too long.');
}

export function validateChatPayload({ department, message }) {
  requireNonEmpty(department, 'Please choose a department.');
  const text = requireNonEmpty(message, 'Message cannot be empty.');
  assert(text.length <= 2000, 'Message is too long.');
}

export function validateMemberPayload(payload = {}) {
  const displayName = requireNonEmpty(payload.displayName || payload.firstName, 'Display name is required.');
  const email = String(payload.email || '').trim();
  if (email) assert(isValidEmail(email), 'Member email format is invalid.');
  const role = requireNonEmpty(payload.role, 'Role is required.');
  const cardType = requireNonEmpty(payload.cardType, 'Card type is required.');
  requireNumber(payload.cardLevel ?? 0, 'Card level must be a number.', { min: 0, max: 10, maxMessage: 'Card level is too high.' });
  requireNumber(payload.balance ?? 0, 'Balance must be a number.', { min: 0 });
  requireNumber(payload.points ?? 0, 'Points must be a number.', { min: 0 });
  const roomNo = String(payload.roomNo || '').trim();
  if (roomNo) assert(isValidRoomNo(roomNo), 'Room number format looks invalid.');
  if (payload.createAuthUser) {
    assert(email, 'Email is required when creating Firebase login.');
    assert(isStrongEnoughPassword(payload.authPassword), 'Temporary password must be at least 6 characters.');
  }
  return { displayName, email, role, cardType, roomNo: normalizeRoomNo(roomNo) };
}

export function validateRewardPayload(payload = {}) {
  requireNonEmpty(payload.title, 'Reward title is required.');
  requireNumber(payload.pointsRequired ?? 0, 'Points required must be a number.', { min: 0 });
  requireNumber(payload.stock ?? 0, 'Stock must be a number.', { min: 0 });
  requireNumber(payload.sortOrder ?? 0, 'Sort order must be a number.', { min: 0 });
  assert(String(payload.description || '').trim().length <= 1000, 'Reward description is too long.');
}

export function validateContentLinkPayload(payload = {}) {
  requireNonEmpty(payload.key, 'Content link key is required.');
  requireNonEmpty(payload.title, 'Content link title is required.');
  assert(isSafeUrl(payload.url || '#'), 'Content link URL must start with https://, http://, mailto:, tel:, ./ or /.');
  requireNumber(payload.sortOrder ?? 0, 'Sort order must be a number.', { min: 0 });
}

export function validateContentBannerPayload(payload = {}) {
  requireNonEmpty(payload.title, 'Banner title is required.');
  requireNumber(payload.sortOrder ?? 0, 'Sort order must be a number.', { min: 0 });
  assert(String(payload.body || '').trim().length <= 1000, 'Banner body is too long.');
}

export function validateCardThemePayload(payload = {}) {
  requireNonEmpty(payload.key, 'Card theme key is required.');
  requireNonEmpty(payload.title, 'Card theme title is required.');
  requireNonEmpty(payload.cardColor, 'Card color is required.');
  requireNumber(payload.sortOrder ?? 0, 'Sort order must be a number.', { min: 0 });
}
