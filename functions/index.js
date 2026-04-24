const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const REGION = 'asia-southeast1';
const TIME_ZONE = 'Asia/Bangkok';

async function createSystemAlert(payload = {}) {
  const ref = db.collection('system_alerts').doc();
  await ref.set({
    level: String(payload.level || 'warning'),
    source: String(payload.source || 'system'),
    title: String(payload.title || 'System alert'),
    message: String(payload.message || ''),
    route: payload.route || null,
    context: payload.context || {},
    acknowledged: false,
    createdAt: FieldValue.serverTimestamp()
  });
  return ref.id;
}

async function recordMonitoringEvent(payload = {}) {
  const ref = db.collection('monitoring_events').doc();
  await ref.set({
    level: String(payload.level || 'info'),
    category: String(payload.category || 'general'),
    action: String(payload.action || 'event'),
    message: String(payload.message || ''),
    route: payload.route || null,
    href: payload.href || null,
    stack: payload.stack || '',
    userId: payload.userId || null,
    role: payload.role || null,
    appVersion: payload.appVersion || null,
    deploymentStage: payload.deploymentStage || null,
    userAgent: payload.userAgent || null,
    metadata: payload.metadata || {},
    createdAt: FieldValue.serverTimestamp()
  });
  if (['error', 'critical'].includes(String(payload.level || '').toLowerCase())) {
    await createSystemAlert({
      level: payload.level || 'error',
      source: 'client-monitoring',
      title: `${payload.category || 'client'}:${payload.action || 'event'}`,
      message: String(payload.message || 'Client monitoring event'),
      route: payload.route || null,
      context: {
        userId: payload.userId || null,
        role: payload.role || null,
        appVersion: payload.appVersion || null,
        deploymentStage: payload.deploymentStage || null
      }
    });
  }
  return ref.id;
}

function requireAuth(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  return request.auth.uid;
}

async function getUserDoc(uid) {
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

function hasRole(user, roles = []) {
  return !!user && roles.includes(user.role);
}

function isAdminLike(user) {
  return hasRole(user, ['super_admin', 'admin']);
}

function isFinanceLike(user) {
  return hasRole(user, ['super_admin', 'admin', 'finance_staff']);
}

function isStaffLike(user) {
  return hasRole(user, [
    'super_admin',
    'admin',
    'staff',
    'finance_staff',
    'fo_staff',
    'hk_staff',
    'fb_staff',
    'fitness_staff',
    'department_manager'
  ]);
}

function canProcessMode(user, mode) {
  if (isAdminLike(user) || isFinanceLike(user)) return true;
  if (!isStaffLike(user)) return false;

  const dept = user.department || user.role || '';
  if (['topup', 'deduct', 'earn_point', 'redeem_use'].includes(mode)) {
    return ['fo', 'fb', 'fitness', 'staff', 'department_manager'].includes(dept) || user.role === 'staff';
  }
  if (['towel_borrow', 'towel_return'].includes(mode)) {
    return ['hk', 'fo', 'fitness', 'staff', 'department_manager'].includes(dept) || user.role === 'staff';
  }
  return false;
}

function sanitizeRoomNo(value) {
  return String(value || '').trim().toUpperCase();
}

function sanitizeEmployeeId(value) {
  return String(value || '').trim().toUpperCase();
}

function isValidEmployeeId(value) {
  return /^[A-Z0-9_-]{3,30}$/.test(sanitizeEmployeeId(value));
}

function parseYmd(value, fieldName) {
  const text = String(value || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) {
    throw new HttpsError('invalid-argument', `${fieldName} must be YYYY-MM-DD.`);
  }
  const [_, y, m, d] = match;
  return {
    year: Number(y),
    month: Number(m),
    day: Number(d),
    raw: text
  };
}

function bangkokDateRange(ymd) {
  const parsed = parseYmd(ymd, 'date');
  const startUtc = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 0 - 7, 0, 0));
  const noonUtc = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12 - 7, 0, 0));
  const endUtc = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 23 - 7, 59, 59));
  return {
    start: admin.firestore.Timestamp.fromDate(startUtc),
    noon: admin.firestore.Timestamp.fromDate(noonUtc),
    end: admin.firestore.Timestamp.fromDate(endUtc),
    raw: parsed.raw
  };
}

function makeRewardCode() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `RW-${y}${m}${d}-${rand}`;
}

async function getSingleByFieldTx(tx, collectionName, field, value) {
  const q = db.collection(collectionName).where(field, '==', value).limit(1);
  const snap = await tx.get(q);
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { ref: doc.ref, data: doc.data() };
}

async function resolveCardTargetTx(tx, requestData) {
  if (requestData.targetUserId) {
    return { userId: requestData.targetUserId, cardId: requestData.targetCardId || null, card: null };
  }

  const code = String(requestData.code || '').trim();
  if (!code) {
    throw new HttpsError('invalid-argument', 'Missing scan code.');
  }

  const fields = ['cardNumber', 'qrValue', 'cardId'];
  for (const field of fields) {
    const result = await getSingleByFieldTx(tx, 'cards', field, code);
    if (result) {
      return {
        userId: result.data.userId,
        cardId: result.ref.id,
        card: result.data
      };
    }
  }

  throw new HttpsError('not-found', 'Card not found from scan code.');
}

async function getOrCreateWalletAccountTx(tx, userId, cardId = null) {
  const found = await getSingleByFieldTx(tx, 'wallet_accounts', 'userId', userId);
  if (found) {
    return { ref: found.ref, data: found.data };
  }
  const ref = db.collection('wallet_accounts').doc(`WA-${userId}`);
  const data = {
    walletAccountId: ref.id,
    userId,
    cardId: cardId || null,
    currency: 'THB',
    balance: 0,
    allowTopup: true,
    allowDeduct: true,
    updatedAt: FieldValue.serverTimestamp()
  };
  tx.set(ref, data, { merge: true });
  return { ref, data };
}

async function getOrCreatePointAccountTx(tx, userId, cardId = null) {
  const found = await getSingleByFieldTx(tx, 'point_accounts', 'userId', userId);
  if (found) {
    return { ref: found.ref, data: found.data };
  }
  const ref = db.collection('point_accounts').doc(`PA-${userId}`);
  const data = {
    pointAccountId: ref.id,
    userId,
    cardId: cardId || null,
    points: 0,
    updatedAt: FieldValue.serverTimestamp()
  };
  tx.set(ref, data, { merge: true });
  return { ref, data };
}


function defaultCardThemeKey(cardType, cardColor) {
  const map = {
    excom: 'excom_gold',
    hod: 'hod_silver',
    manager: 'manager_bronze',
    team_member: 'team_white',
    fitness_guest: 'fitness_black',
    guest_point: 'guest_red'
  };
  return map[String(cardType || '').trim()] || `${String(cardColor || 'white').trim()}-v1`;
}

function cardPrefixForType(cardType) {
  const map = {
    excom: 'EX',
    hod: 'HD',
    manager: 'MG',
    team_member: 'TM',
    fitness_guest: 'FG',
    guest_point: 'GC'
  };
  return map[String(cardType || '').trim()] || 'CR';
}

function requirePositiveNumber(value, fieldName) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpsError('invalid-argument', `${fieldName} must be greater than 0.`);
  }
  return amount;
}

async function writeManagedMemberDocs({ uid, operatorUid, data = {} }) {
  const userRef = db.collection('users').doc(uid);
  const cardRef = db.collection('cards').doc(`CARD-${uid}`);
  const walletRef = db.collection('wallet_accounts').doc(`WA-${uid}`);
  const pointRef = db.collection('point_accounts').doc(`PA-${uid}`);
  const displayName = String(data.displayName || [data.firstName, data.lastName].filter(Boolean).join(' ').trim() || uid);
  const role = String(data.role || 'member');
  const department = String(data.department || '') || null;
  const cardType = String(data.cardType || 'team_member');
  const cardLevel = Number(data.cardLevel || 0);
  const cardColor = String(data.cardColor || 'white');
  const status = String(data.status || 'active');
  const language = String(data.language || 'en');
  const balance = Number(data.balance || 0);
  const pts = Number(data.points || 0);
  const photoURL = String(data.photoURL || '');
  const photoStoragePath = String(data.photoStoragePath || '');
  const cardTheme = String(data.cardTheme || defaultCardThemeKey(cardType, cardColor));
  const authManaged = data.authManaged !== false;

  await db.runTransaction(async (tx) => {
    const [userSnap, cardSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(cardRef)
    ]);

    tx.set(userRef, {
      uid,
      role,
      department,
      cardType,
      cardLevel,
      cardColor,
      firstName: String(data.firstName || ''),
      lastName: String(data.lastName || ''),
      displayName,
      email: String(data.email || ''),
      authEmail: String(data.authEmail || data.email || ''),
      employeeId: sanitizeEmployeeId(data.employeeId || ''),
      phone: String(data.phone || ''),
      roomNo: sanitizeRoomNo(data.roomNo || ''),
      language,
      photoURL,
      photoStoragePath,
      hasAuthAccount: true,
      authManaged,
      status,
      createdAt: userSnap.exists ? userSnap.get('createdAt') || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: userSnap.exists ? userSnap.get('createdBy') || operatorUid : operatorUid
    }, { merge: true });

    tx.set(cardRef, {
      cardId: cardRef.id,
      userId: uid,
      cardType,
      cardLevel,
      cardColor,
      cardTheme,
      cardNumber: cardSnap.exists ? cardSnap.get('cardNumber') || `${cardPrefixForType(cardType)}-${uid.slice(-6).toUpperCase()}` : `${cardPrefixForType(cardType)}-${uid.slice(-6).toUpperCase()}`,
      qrValue: cardSnap.exists ? cardSnap.get('qrValue') || `LAYA-CARD-${uid}` : `LAYA-CARD-${uid}`,
      walletAccountId: walletRef.id,
      pointAccountId: pointRef.id,
      issuedAt: cardSnap.exists ? cardSnap.get('issuedAt') || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      active: status === 'active',
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    tx.set(walletRef, {
      walletAccountId: walletRef.id,
      userId: uid,
      cardId: cardRef.id,
      currency: 'THB',
      balance,
      allowTopup: true,
      allowDeduct: true,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    tx.set(pointRef, {
      pointAccountId: pointRef.id,
      userId: uid,
      cardId: cardRef.id,
      points: pts,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  return { uid, cardId: `CARD-${uid}`, walletAccountId: `WA-${uid}`, pointAccountId: `PA-${uid}` };
}

async function deleteManagedMemberDocs(uid) {
  const userRef = db.collection('users').doc(uid);
  const [userSnap, cards, wallets, points, guestSessions, pushTokens] = await Promise.all([
    userRef.get(),
    db.collection('cards').where('userId', '==', uid).get(),
    db.collection('wallet_accounts').where('userId', '==', uid).get(),
    db.collection('point_accounts').where('userId', '==', uid).get(),
    db.collection('guest_sessions').where('userId', '==', uid).get(),
    db.collection('push_tokens').where('userId', '==', uid).get()
  ]);

  const batch = db.batch();
  if (userSnap.exists) batch.delete(userSnap.ref);
  [cards, wallets, points, guestSessions, pushTokens].forEach((snap) => snap.docs.forEach((docSnap) => batch.delete(docSnap.ref)));
  await batch.commit();

  const photoStoragePath = userSnap.exists ? String(userSnap.get('photoStoragePath') || '') : '';
  if (photoStoragePath) {
    await admin.storage().bucket().file(photoStoragePath).delete().catch(() => null);
  }

  return { ok: true };
}

async function performTopupTx(tx, params) {
  const amount = requirePositiveNumber(params.amount, 'amount');
  const wallet = await getOrCreateWalletAccountTx(tx, params.targetUserId, params.cardId || null);
  const before = Number(wallet.data.balance || 0);
  const after = before + amount;

  tx.set(wallet.ref, {
    walletAccountId: wallet.ref.id,
    userId: params.targetUserId,
    cardId: params.cardId || wallet.data.cardId || null,
    currency: wallet.data.currency || 'THB',
    balance: after,
    allowTopup: true,
    allowDeduct: true,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const txRef = db.collection('wallet_transactions').doc();
  tx.set(txRef, {
    transactionType: 'topup',
    walletAccountId: wallet.ref.id,
    userId: params.targetUserId,
    cardId: params.cardId || wallet.data.cardId || null,
    amount,
    balanceBefore: before,
    balanceAfter: after,
    source: params.source || 'cloud_function',
    referenceType: params.referenceType || 'topup',
    referenceId: params.referenceId || null,
    operatorUid: params.operatorUid,
    operatorName: params.operatorName || '',
    department: params.department || null,
    note: params.note || '',
    createdAt: FieldValue.serverTimestamp()
  });

  return { balanceBefore: before, balanceAfter: after, amount };
}

async function performDeductTx(tx, params) {
  const amount = requirePositiveNumber(params.amount, 'amount');
  const wallet = await getOrCreateWalletAccountTx(tx, params.targetUserId, params.cardId || null);
  const before = Number(wallet.data.balance || 0);
  const after = before - amount;
  if (after < 0) {
    throw new HttpsError('failed-precondition', 'Insufficient wallet balance.');
  }

  tx.set(wallet.ref, {
    walletAccountId: wallet.ref.id,
    userId: params.targetUserId,
    cardId: params.cardId || wallet.data.cardId || null,
    currency: wallet.data.currency || 'THB',
    balance: after,
    allowTopup: true,
    allowDeduct: true,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const txRef = db.collection('wallet_transactions').doc();
  tx.set(txRef, {
    transactionType: 'deduct',
    walletAccountId: wallet.ref.id,
    userId: params.targetUserId,
    cardId: params.cardId || wallet.data.cardId || null,
    amount,
    balanceBefore: before,
    balanceAfter: after,
    source: params.source || 'cloud_function',
    referenceType: params.referenceType || 'deduct',
    referenceId: params.referenceId || null,
    operatorUid: params.operatorUid,
    operatorName: params.operatorName || '',
    department: params.department || null,
    note: params.note || '',
    createdAt: FieldValue.serverTimestamp()
  });

  return { balanceBefore: before, balanceAfter: after, amount };
}

async function performEarnPointsTx(tx, params) {
  const pointsToAdd = requirePositiveNumber(params.points, 'points');
  const pointAccount = await getOrCreatePointAccountTx(tx, params.targetUserId, params.cardId || null);
  const before = Number(pointAccount.data.points || 0);
  const after = before + pointsToAdd;

  tx.set(pointAccount.ref, {
    pointAccountId: pointAccount.ref.id,
    userId: params.targetUserId,
    cardId: params.cardId || pointAccount.data.cardId || null,
    points: after,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const txRef = db.collection('point_transactions').doc();
  tx.set(txRef, {
    transactionType: 'earn',
    pointAccountId: pointAccount.ref.id,
    userId: params.targetUserId,
    cardId: params.cardId || pointAccount.data.cardId || null,
    points: pointsToAdd,
    pointsBefore: before,
    pointsAfter: after,
    source: params.source || 'cloud_function',
    referenceType: params.referenceType || 'spend',
    referenceId: params.referenceId || null,
    operatorUid: params.operatorUid,
    operatorName: params.operatorName || '',
    note: params.note || '',
    createdAt: FieldValue.serverTimestamp()
  });

  return { pointsBefore: before, pointsAfter: after, pointsAdded: pointsToAdd };
}

async function performRewardRedemptionTx(tx, params) {
  const rewardRef = db.collection('rewards').doc(String(params.rewardId || '').trim());
  const rewardSnap = await tx.get(rewardRef);
  if (!rewardSnap.exists) {
    throw new HttpsError('not-found', 'Reward not found.');
  }
  const reward = rewardSnap.data();
  if (!reward.active) {
    throw new HttpsError('failed-precondition', 'Reward is not active.');
  }

  const pointAccount = await getOrCreatePointAccountTx(tx, params.userId, params.cardId || null);
  const currentPoints = Number(pointAccount.data.points || 0);
  const cost = requirePositiveNumber(reward.pointsRequired, 'pointsRequired');
  if (currentPoints < cost) {
    throw new HttpsError('failed-precondition', 'Not enough points.');
  }

  const user = params.user || null;
  const allowedTypes = Array.isArray(reward.cardTypesAllowed) ? reward.cardTypesAllowed : [];
  if (allowedTypes.length && user?.cardType && !allowedTypes.includes(user.cardType)) {
    throw new HttpsError('permission-denied', 'This card type cannot redeem the selected reward.');
  }

  const stock = Number(reward.stock ?? 0);
  if (Number.isFinite(stock) && stock >= 0 && stock < 1) {
    throw new HttpsError('failed-precondition', 'Reward is out of stock.');
  }

  const after = currentPoints - cost;
  tx.set(pointAccount.ref, {
    pointAccountId: pointAccount.ref.id,
    userId: params.userId,
    cardId: params.cardId || pointAccount.data.cardId || null,
    points: after,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const pointTxRef = db.collection('point_transactions').doc();
  tx.set(pointTxRef, {
    transactionType: 'redeem',
    pointAccountId: pointAccount.ref.id,
    userId: params.userId,
    cardId: params.cardId || pointAccount.data.cardId || null,
    points: cost,
    pointsBefore: currentPoints,
    pointsAfter: after,
    source: 'reward_redemption',
    referenceType: 'reward',
    referenceId: rewardRef.id,
    operatorUid: params.operatorUid || params.userId,
    operatorName: params.operatorName || params.user?.displayName || '',
    note: reward.title || 'Reward redemption',
    createdAt: FieldValue.serverTimestamp()
  });

  tx.update(rewardRef, {
    stock: Number.isFinite(stock) && stock >= 0 ? stock - 1 : reward.stock,
    updatedAt: FieldValue.serverTimestamp()
  });

  const redemptionRef = db.collection('redemptions').doc();
  const rewardCode = makeRewardCode();
  tx.set(redemptionRef, {
    rewardId: rewardRef.id,
    userId: params.userId,
    cardId: params.cardId || null,
    rewardTitle: reward.title || '',
    pointsUsed: cost,
    rewardCode,
    rewardQrValue: `LAYA-REWARD-${rewardCode}`,
    status: 'active',
    redeemedAt: FieldValue.serverTimestamp(),
    usedAt: null,
    usedBy: null,
    expiresAt: null
  });

  return {
    redemptionId: redemptionRef.id,
    rewardCode,
    rewardQrValue: `LAYA-REWARD-${rewardCode}`,
    rewardTitle: reward.title || '',
    pointsBefore: currentPoints,
    pointsAfter: after,
    pointsUsed: cost
  };
}

async function performFulfillRedemptionTx(tx, params) {
  let redemptionResult = null;
  const code = String(params.code || '').trim();

  if (params.redemptionId) {
    const ref = db.collection('redemptions').doc(params.redemptionId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Redemption not found.');
    redemptionResult = { ref, data: snap.data() };
  }

  if (!redemptionResult && code) {
    for (const field of ['rewardCode', 'rewardQrValue']) {
      const q = db.collection('redemptions').where(field, '==', code).limit(1);
      const snap = await tx.get(q);
      if (!snap.empty) {
        const doc = snap.docs[0];
        redemptionResult = { ref: doc.ref, data: doc.data() };
        break;
      }
    }
  }

  if (!redemptionResult) {
    throw new HttpsError('not-found', 'Active redemption not found from code.');
  }

  const current = redemptionResult.data;
  if (!['active', 'pending'].includes(current.status)) {
    throw new HttpsError('failed-precondition', 'Redemption is not available for fulfillment.');
  }

  tx.update(redemptionResult.ref, {
    status: 'used',
    usedAt: FieldValue.serverTimestamp(),
    usedBy: params.operatorUid,
    updatedAt: FieldValue.serverTimestamp()
  });

  return {
    redemptionId: redemptionResult.ref.id,
    userId: current.userId,
    cardId: current.cardId || null,
    rewardTitle: current.rewardTitle || '',
    rewardCode: current.rewardCode || code,
    status: 'used'
  };
}

async function performTowelBorrowTx(tx, params) {
  const roomNo = sanitizeRoomNo(params.roomNo);
  if (!roomNo) {
    throw new HttpsError('invalid-argument', 'Room number required for towel borrow.');
  }
  const qty = Math.max(1, Number(params.qty || 1));
  const ref = db.collection('towel_requests').doc();
  tx.set(ref, {
    roomNo,
    userId: params.targetUserId || null,
    location: params.location || 'room_front',
    qty,
    status: 'borrowed',
    borrowedAt: FieldValue.serverTimestamp(),
    returnedAt: null,
    processedBy: params.operatorUid,
    returnProcessedBy: null,
    note: params.note || ''
  });
  return { towelRequestId: ref.id, roomNo, qty, status: 'borrowed' };
}

async function performTowelReturnTx(tx, params) {
  const roomNo = sanitizeRoomNo(params.roomNo);
  if (!roomNo) {
    throw new HttpsError('invalid-argument', 'Room number required for towel return.');
  }
  const q = db.collection('towel_requests').where('roomNo', '==', roomNo).where('status', '==', 'borrowed').limit(10);
  const snap = await tx.get(q);
  if (snap.empty) {
    throw new HttpsError('not-found', 'No borrowed towel request found for this room.');
  }
  const docs = snap.docs.sort((a, b) => {
    const av = a.get('borrowedAt')?.toMillis?.() || 0;
    const bv = b.get('borrowedAt')?.toMillis?.() || 0;
    return bv - av;
  });
  const doc = docs[0];
  tx.update(doc.ref, {
    status: 'returned',
    returnedAt: FieldValue.serverTimestamp(),
    returnProcessedBy: params.operatorUid,
    updatedAt: FieldValue.serverTimestamp()
  });
  return { towelRequestId: doc.id, roomNo, status: 'returned' };
}

async function appendScanLogTx(tx, params) {
  const ref = db.collection('scan_logs').doc();
  tx.set(ref, {
    mode: params.mode,
    operatorUid: params.operatorUid,
    scannedValue: params.scannedValue || '',
    targetCardId: params.targetCardId || null,
    targetUserId: params.targetUserId || null,
    result: params.result || 'success',
    note: params.note || '',
    createdAt: FieldValue.serverTimestamp(),
    metadata: params.metadata || null
  });
}

async function processScanRequestInternal({ operatorUid, scanRequestId, action = 'approve', note = '' }) {
  const operator = await getUserDoc(operatorUid);
  if (!operator || !isStaffLike(operator)) {
    throw new HttpsError('permission-denied', 'Staff permission required.');
  }

  const result = await db.runTransaction(async (tx) => {
    const scanRef = db.collection('scan_requests').doc(scanRequestId);
    const scanSnap = await tx.get(scanRef);
    if (!scanSnap.exists) {
      throw new HttpsError('not-found', 'Scan request not found.');
    }
    const scan = scanSnap.data();
    const mode = String(scan.mode || '').trim();

    if (!canProcessMode(operator, mode)) {
      throw new HttpsError('permission-denied', 'You cannot process this scan mode.');
    }
    if (!['pending', 'review'].includes(scan.status || 'pending')) {
      throw new HttpsError('failed-precondition', 'Scan request is already processed.');
    }

    if (action === 'reject') {
      tx.update(scanRef, {
        status: 'rejected',
        reviewNote: note || 'Rejected',
        processedAt: FieldValue.serverTimestamp(),
        processedBy: operatorUid,
        processedByName: operator.displayName || '',
        updatedAt: FieldValue.serverTimestamp()
      });
      await appendScanLogTx(tx, {
        mode,
        operatorUid,
        scannedValue: scan.code || '',
        targetCardId: scan.targetCardId || null,
        targetUserId: scan.targetUserId || null,
        result: 'rejected',
        note: note || 'Rejected from queue',
        metadata: { scanRequestId }
      });
      return { scanRequestId, status: 'rejected', mode };
    }

    let targetUserId = scan.targetUserId || null;
    let targetCardId = scan.targetCardId || null;
    let roomNo = null;
    if (['topup', 'deduct', 'earn_point', 'towel_borrow', 'towel_return'].includes(mode)) {
      const target = await resolveCardTargetTx(tx, scan);
      targetUserId = target.userId;
      targetCardId = target.cardId || targetCardId;
      if (target.userId) {
        const targetUser = await tx.get(db.collection('users').doc(target.userId));
        roomNo = targetUser.exists ? sanitizeRoomNo(targetUser.get('roomNo')) : null;
      }
    }

    let output = { scanRequestId, mode, status: 'completed' };
    if (mode === 'topup') {
      output = { ...output, ...await performTopupTx(tx, {
        targetUserId,
        cardId: targetCardId,
        amount: scan.amount,
        operatorUid,
        operatorName: operator.displayName || '',
        department: operator.department || null,
        note: scan.note || note || 'Top-up from queue',
        source: 'scan_request',
        referenceType: 'topup',
        referenceId: scanRequestId
      }) };
    } else if (mode === 'deduct') {
      output = { ...output, ...await performDeductTx(tx, {
        targetUserId,
        cardId: targetCardId,
        amount: scan.amount,
        operatorUid,
        operatorName: operator.displayName || '',
        department: operator.department || null,
        note: scan.note || note || 'Deduct from queue',
        source: 'scan_request',
        referenceType: 'deduct',
        referenceId: scanRequestId
      }) };
    } else if (mode === 'earn_point') {
      output = { ...output, ...await performEarnPointsTx(tx, {
        targetUserId,
        cardId: targetCardId,
        points: scan.pointAmount || scan.amount,
        operatorUid,
        operatorName: operator.displayName || '',
        note: scan.note || note || 'Earn point from queue',
        source: 'scan_request',
        referenceType: 'spend',
        referenceId: scanRequestId
      }) };
    } else if (mode === 'redeem_use') {
      output = { ...output, ...await performFulfillRedemptionTx(tx, {
        redemptionId: scan.redemptionId || null,
        code: scan.code || '',
        operatorUid
      }) };
      targetUserId = output.userId || targetUserId;
      targetCardId = output.cardId || targetCardId;
    } else if (mode === 'towel_borrow') {
      output = { ...output, ...await performTowelBorrowTx(tx, {
        roomNo: roomNo || scan.roomNo || scan.note,
        qty: scan.amount || 1,
        location: scan.location || 'room_front',
        note: scan.note || '',
        operatorUid,
        targetUserId
      }) };
    } else if (mode === 'towel_return') {
      output = { ...output, ...await performTowelReturnTx(tx, {
        roomNo: roomNo || scan.roomNo || scan.note,
        operatorUid
      }) };
    } else {
      throw new HttpsError('invalid-argument', 'Unsupported scan mode.');
    }

    tx.update(scanRef, {
      status: 'completed',
      reviewNote: note || 'Processed',
      processedAt: FieldValue.serverTimestamp(),
      processedBy: operatorUid,
      processedByName: operator.displayName || '',
      updatedAt: FieldValue.serverTimestamp(),
      resultSummary: output
    });

    await appendScanLogTx(tx, {
      mode,
      operatorUid,
      scannedValue: scan.code || '',
      targetCardId,
      targetUserId,
      result: 'success',
      note: note || scan.note || 'Processed from queue',
      metadata: { scanRequestId, output }
    });

    return output;
  });

  return result;
}

exports.topUpWallet = onCall({ region: REGION }, async (request) => {
  const operatorUid = requireAuth(request);
  const operator = await getUserDoc(operatorUid);
  if (!operator || !canProcessMode(operator, 'topup')) {
    throw new HttpsError('permission-denied', 'Not allowed to top up wallet.');
  }

  const data = request.data || {};
  const result = await db.runTransaction(async (tx) => {
    const target = await resolveCardTargetTx(tx, data);
    return performTopupTx(tx, {
      targetUserId: target.userId,
      cardId: target.cardId,
      amount: data.amount,
      operatorUid,
      operatorName: operator.displayName || '',
      department: operator.department || null,
      note: data.note || 'Direct top-up',
      source: 'callable_topup',
      referenceType: 'topup'
    });
  });
  return { ok: true, ...result };
});

exports.deductWallet = onCall({ region: REGION }, async (request) => {
  const operatorUid = requireAuth(request);
  const operator = await getUserDoc(operatorUid);
  if (!operator || !canProcessMode(operator, 'deduct')) {
    throw new HttpsError('permission-denied', 'Not allowed to deduct wallet.');
  }

  const data = request.data || {};
  const result = await db.runTransaction(async (tx) => {
    const target = await resolveCardTargetTx(tx, data);
    return performDeductTx(tx, {
      targetUserId: target.userId,
      cardId: target.cardId,
      amount: data.amount,
      operatorUid,
      operatorName: operator.displayName || '',
      department: operator.department || null,
      note: data.note || 'Direct deduct',
      source: 'callable_deduct',
      referenceType: 'deduct'
    });
  });
  return { ok: true, ...result };
});

exports.earnPoints = onCall({ region: REGION }, async (request) => {
  const operatorUid = requireAuth(request);
  const operator = await getUserDoc(operatorUid);
  if (!operator || !canProcessMode(operator, 'earn_point')) {
    throw new HttpsError('permission-denied', 'Not allowed to earn points.');
  }

  const data = request.data || {};
  const result = await db.runTransaction(async (tx) => {
    const target = await resolveCardTargetTx(tx, data);
    return performEarnPointsTx(tx, {
      targetUserId: target.userId,
      cardId: target.cardId,
      points: data.points,
      operatorUid,
      operatorName: operator.displayName || '',
      note: data.note || 'Direct point earn',
      source: 'callable_earn_points',
      referenceType: 'spend'
    });
  });
  return { ok: true, ...result };
});

exports.fulfillRedemption = onCall({ region: REGION }, async (request) => {
  const operatorUid = requireAuth(request);
  const operator = await getUserDoc(operatorUid);
  if (!operator || !canProcessMode(operator, 'redeem_use')) {
    throw new HttpsError('permission-denied', 'Not allowed to fulfill redemption.');
  }

  const data = request.data || {};
  const result = await db.runTransaction(async (tx) => performFulfillRedemptionTx(tx, {
    redemptionId: data.redemptionId || null,
    code: data.code || '',
    operatorUid
  }));
  return { ok: true, ...result };
});

exports.requestRewardRedemption = onCall({ region: REGION }, async (request) => {
  const uid = requireAuth(request);
  const user = await getUserDoc(uid);
  if (!user || !['member', 'guest', 'staff', 'fo_staff', 'hk_staff', 'fb_staff', 'fitness_staff', 'department_manager', 'admin', 'super_admin'].includes(user.role)) {
    throw new HttpsError('permission-denied', 'This account cannot redeem rewards.');
  }

  const data = request.data || {};
  const cardQuery = await db.collection('cards').where('userId', '==', uid).limit(1).get();
  const card = cardQuery.empty ? null : { id: cardQuery.docs[0].id, ...cardQuery.docs[0].data() };

  const result = await db.runTransaction(async (tx) => performRewardRedemptionTx(tx, {
    rewardId: data.rewardId,
    userId: uid,
    cardId: card?.id || null,
    operatorUid: uid,
    operatorName: user.displayName || '',
    user
  }));

  return { ok: true, ...result };
});

exports.processScanRequest = onCall({ region: REGION }, async (request) => {
  const operatorUid = requireAuth(request);
  const data = request.data || {};
  try {
    const result = await processScanRequestInternal({
      operatorUid,
      scanRequestId: String(data.scanRequestId || '').trim(),
      action: String(data.action || 'approve').trim(),
      note: String(data.note || '').trim()
    });
    return { ok: true, ...result };
  } catch (error) {
    await createSystemAlert({ level: 'error', source: 'functions.processScanRequest', title: 'Scan request processing failed', message: error?.message || 'Unable to process scan request.', context: { operatorUid, scanRequestId: String(data.scanRequestId || '').trim(), action: String(data.action || 'approve').trim() } }).catch(() => null);
    throw error;
  }
});


exports.createManagedAuthUser = onCall({ region: REGION }, async (request) => {
  const operatorUid = requireAuth(request);
  const operator = await getUserDoc(operatorUid);
  if (!isAdminLike(operator)) {
    throw new HttpsError('permission-denied', 'Only admin can create managed auth users.');
  }

  const data = request.data || {};
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.authPassword || data.password || '').trim();
  const displayName = String(data.displayName || [data.firstName, data.lastName].filter(Boolean).join(' ').trim() || email);
  if (!email) throw new HttpsError('invalid-argument', 'Email is required.');
  if (password.length < 6) throw new HttpsError('invalid-argument', 'Password must be at least 6 characters.');

  let createdUid = null;
  try {
    const createPayload = {
      email,
      password,
      displayName,
      disabled: String(data.status || 'active') !== 'active'
    };
    if (data.uid) createPayload.uid = String(data.uid);
    if (data.photoURL) createPayload.photoURL = String(data.photoURL);
    const userRecord = await getAuth().createUser(createPayload);
    createdUid = userRecord.uid;
    await writeManagedMemberDocs({ uid: userRecord.uid, operatorUid, data: { ...data, email, displayName } });
    return { ok: true, uid: userRecord.uid, email: userRecord.email || email };
  } catch (error) {
    if (createdUid) {
      await getAuth().deleteUser(createdUid).catch(() => null);
    }
    await createSystemAlert({ level: 'error', source: 'functions.createManagedAuthUser', title: 'Managed auth user creation failed', message: error?.message || 'Unable to create managed auth user.', context: { operatorUid, email } }).catch(() => null);
    throw new HttpsError('internal', error?.message || 'Unable to create managed auth user.');
  }
});

exports.deleteManagedAuthUser = onCall({ region: REGION }, async (request) => {
  const operatorUid = requireAuth(request);
  const operator = await getUserDoc(operatorUid);
  if (!isAdminLike(operator)) {
    throw new HttpsError('permission-denied', 'Only admin can delete managed auth users.');
  }

  const uid = String(request.data?.uid || '').trim();
  if (!uid) throw new HttpsError('invalid-argument', 'uid is required.');

  await deleteManagedMemberDocs(uid);
  let authDeleted = false;
  try {
    await getAuth().deleteUser(uid);
    authDeleted = true;
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') {
      await createSystemAlert({ level: 'error', source: 'functions.deleteManagedAuthUser', title: 'Managed auth user deletion failed', message: error?.message || 'Unable to delete auth user.', context: { operatorUid, uid } }).catch(() => null);
      throw new HttpsError('internal', error?.message || 'Unable to delete auth user.');
    }
  }

  return { ok: true, uid, authDeleted };
});

exports.createGuestPortalSession = onCall({ region: REGION }, async (request) => {
  const uid = requireAuth(request);
  const data = request.data || {};
  const roomNo = sanitizeRoomNo(data.roomNo);
  if (!roomNo) {
    throw new HttpsError('invalid-argument', 'Room number is required.');
  }
  const start = bangkokDateRange(data.stayStart || '');
  const end = bangkokDateRange(data.stayEnd || '');
  if (end.noon.toMillis() < start.start.toMillis()) {
    throw new HttpsError('invalid-argument', 'Stay end must be the same day or later than stay start.');
  }

  const guestName = String(data.guestName || '').trim();
  const displayName = guestName || `Room ${roomNo}`;
  const userRef = db.collection('users').doc(uid);
  const cardRef = db.collection('cards').doc(`CARD-${uid}`);
  const walletRef = db.collection('wallet_accounts').doc(`WA-${uid}`);
  const pointRef = db.collection('point_accounts').doc(`PA-${uid}`);
  const guestSessionRef = db.collection('guest_sessions').doc(uid);

  await db.runTransaction(async (tx) => {
    const [userSnap, cardSnap, walletSnap, pointSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(cardRef),
      tx.get(walletRef),
      tx.get(pointRef)
    ]);

    const currentBalance = walletSnap.exists ? Number(walletSnap.get('balance') || 0) : 0;
    const currentPoints = pointSnap.exists ? Number(pointSnap.get('points') || 0) : 0;

    tx.set(userRef, {
      uid,
      role: 'guest',
      department: null,
      cardType: 'guest_point',
      cardLevel: 0,
      cardColor: 'red',
      firstName: guestName || 'Guest',
      lastName: roomNo,
      displayName,
      email: '',
      phone: '',
      roomNo,
      stayStart: start.start,
      stayEnd: end.end,
      guestExpiryAt: end.noon,
      language: String(data.language || 'en'),
      photoURL: '',
      status: 'active',
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: userSnap.exists ? userSnap.get('createdAt') || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      createdBy: uid,
      guestPortal: true
    }, { merge: true });

    tx.set(cardRef, {
      cardId: cardRef.id,
      userId: uid,
      cardType: 'guest_point',
      cardLevel: 0,
      cardColor: 'red',
      cardTheme: 'luxury-red-v1',
      cardNumber: `GP-${roomNo}`,
      qrValue: `LAYA-GUEST-${roomNo}`,
      walletAccountId: walletRef.id,
      pointAccountId: pointRef.id,
      issuedAt: cardSnap.exists ? cardSnap.get('issuedAt') || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      expiresAt: end.noon,
      active: true,
      notes: 'Guest portal card'
    }, { merge: true });

    tx.set(walletRef, {
      walletAccountId: walletRef.id,
      userId: uid,
      cardId: cardRef.id,
      currency: 'THB',
      balance: currentBalance,
      allowTopup: true,
      allowDeduct: true,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    tx.set(pointRef, {
      pointAccountId: pointRef.id,
      userId: uid,
      cardId: cardRef.id,
      points: currentPoints,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    tx.set(guestSessionRef, {
      sessionId: guestSessionRef.id,
      roomNo,
      guestName,
      userId: uid,
      stayStart: start.start,
      stayEnd: end.end,
      expiresAt: end.noon,
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  return {
    ok: true,
    profile: {
      uid,
      role: 'guest',
      displayName,
      roomNo,
      cardType: 'guest_point',
      cardColor: 'red',
      cardLevel: 0,
      language: String(data.language || 'en'),
      status: 'active',
      stayStart: start.raw,
      stayEnd: end.raw,
      guestExpiryAt: end.noon.toDate().toISOString()
    }
  };
});

exports.expireGuestSessions = onSchedule({
  region: REGION,
  schedule: 'every 15 minutes',
  timeZone: TIME_ZONE
}, async () => {
  const now = admin.firestore.Timestamp.now();
  const activeSessions = await db.collection('guest_sessions')
    .where('status', '==', 'active')
    .where('expiresAt', '<=', now)
    .limit(200)
    .get();

  if (activeSessions.empty) {
    logger.info('No guest sessions to expire.');
    return;
  }

  const batch = db.batch();
  for (const doc of activeSessions.docs) {
    const data = doc.data();
    batch.update(doc.ref, {
      status: 'expired',
      updatedAt: FieldValue.serverTimestamp()
    });
    if (data.userId) {
      batch.set(db.collection('users').doc(data.userId), {
        status: 'expired',
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }
  await batch.commit();
  logger.info(`Expired ${activeSessions.size} guest sessions.`);
});


async function listUsersByDepartment(department) {
  if (!department) return [];
  const snap = await db.collection('users').where('department', '==', department).where('status', '==', 'active').get().catch(() => null);
  return snap ? snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : [];
}

async function listAdminUsers() {
  const [admins, superAdmins] = await Promise.all([
    db.collection('users').where('role', '==', 'admin').where('status', '==', 'active').get().catch(() => null),
    db.collection('users').where('role', '==', 'super_admin').where('status', '==', 'active').get().catch(() => null)
  ]);
  const rows = [];
  [admins, superAdmins].filter(Boolean).forEach((snap) => snap.docs.forEach((doc) => rows.push({ id: doc.id, ...doc.data() })));
  return rows;
}

async function listPushTokensForUser(userId) {
  const snap = await db.collection('push_tokens').where('userId', '==', userId).where('active', '==', true).get().catch(() => null);
  return snap ? snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : [];
}

async function createNotificationsForUsers(userIds, payload = {}) {
  const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
  if (!uniqueUserIds.length) return [];
  return Promise.all(uniqueUserIds.map((userId) => db.collection('notifications').add({
    targetUserId: userId,
    type: payload.type || 'alert',
    title: payload.title || 'LAYA Card Alert',
    body: payload.body || '',
    referenceType: payload.referenceType || null,
    referenceId: payload.referenceId || null,
    clickRoute: payload.clickRoute || 'notifications',
    actorUid: payload.actorUid || null,
    department: payload.department || null,
    roomNo: payload.roomNo || null,
    isRead: false,
    createdAt: FieldValue.serverTimestamp()
  })));
}

async function sendPushToUsers(userIds, payload = {}) {
  const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
  if (!uniqueUserIds.length) return;
  const tokens = [];
  for (const userId of uniqueUserIds) {
    const rows = await listPushTokensForUser(userId);
    rows.forEach((row) => { if (row.token) tokens.push(row.token); });
  }
  const cleanTokens = [...new Set(tokens)];
  if (!cleanTokens.length) return;
  const link = `${payload.baseUrl || 'https://service-c93f2.web.app'}/index.html#${payload.clickRoute || 'notifications'}`;
  try {
    await admin.messaging().sendEachForMulticast({
      tokens: cleanTokens,
      notification: { title: payload.title || 'LAYA Card Alert', body: payload.body || '' },
      data: { title: payload.title || 'LAYA Card Alert', body: payload.body || '', route: payload.clickRoute || 'notifications', link, notificationId: payload.referenceId || '' },
      webpush: { fcmOptions: { link } }
    });
  } catch (error) {
    logger.error('Push send failed', error);
  }
}

async function announceToUsers(userIds, payload = {}) {
  await createNotificationsForUsers(userIds, payload);
  await sendPushToUsers(userIds, payload);
}


exports.reportMonitoringEvent = onCall({ region: REGION }, async (request) => {
  const data = request.data || {};
  const eventId = await recordMonitoringEvent({
    level: data.level || 'info',
    category: data.category || 'frontend',
    action: data.action || 'event',
    message: data.message || '',
    route: data.route || null,
    href: data.href || null,
    stack: data.stack || '',
    userId: request.auth?.uid || null,
    role: data.role || null,
    appVersion: data.appVersion || null,
    deploymentStage: data.deploymentStage || null,
    userAgent: data.userAgent || null,
    metadata: {
      file: data.file || null,
      line: data.line || null,
      column: data.column || null
    }
  });
  return { ok: true, eventId };
});

exports.registerPushToken = onCall({ region: REGION }, async (request) => {
  const uid = requireAuth(request);
  const data = request.data || {};
  const token = String(data.token || '').trim();
  if (!token) throw new HttpsError('invalid-argument', 'Push token is required.');
  const tokenId = Buffer.from(token).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 120);
  await db.collection('push_tokens').doc(`${uid}_${tokenId}`).set({
    userId: uid,
    token,
    active: true,
    language: String(data.language || 'en'),
    roomNo: sanitizeRoomNo(data.roomNo || ''),
    department: String(data.department || ''),
    userAgent: String(data.userAgent || ''),
    createdAt: FieldValue.serverTimestamp(),
    lastSeenAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: true };
});

exports.markAllNotificationsRead = onCall({ region: REGION }, async (request) => {
  const uid = requireAuth(request);
  const unread = await db.collection('notifications').where('targetUserId', '==', uid).where('isRead', '==', false).limit(200).get();
  if (unread.empty) return { ok: true, updated: 0 };
  const batch = db.batch();
  unread.docs.forEach((docSnap) => batch.update(docSnap.ref, { isRead: true, readAt: FieldValue.serverTimestamp() }));
  await batch.commit();
  return { ok: true, updated: unread.size };
});

exports.onHkRequestCreated = onDocumentCreated({ region: REGION, document: 'hk_requests/{requestId}' }, async (event) => {
  const data = event.data?.data(); if (!data) return;
  const deptUsers = await listUsersByDepartment('hk');
  const foUsers = await listUsersByDepartment('fo');
  const adminUsers = await listAdminUsers();
  const recipients = [...deptUsers, ...foUsers, ...adminUsers].map((item) => item.uid || item.id);
  const itemSummary = (data.items || []).map((item) => `${item.label || item.key} x${item.qty || 1}`).join(', ');
  await announceToUsers(recipients, { type: 'hk_request', title: 'New HK request', body: `${data.roomNo || 'Guest room'} requested ${itemSummary || 'housekeeping support'}.`, referenceType: 'hk_request', referenceId: event.params.requestId, clickRoute: 'hk', actorUid: data.userId || null, department: 'hk', roomNo: data.roomNo || null });
});

exports.onHkRequestUpdated = onDocumentUpdated({ region: REGION, document: 'hk_requests/{requestId}' }, async (event) => {
  const before = event.data?.before?.data(); const after = event.data?.after?.data();
  if (!before || !after || (before.status || '') === (after.status || '') || !after.userId) return;
  await announceToUsers([after.userId], { type: 'hk_status', title: 'HK request updated', body: `Your HK request is now ${after.status}.`, referenceType: 'hk_request', referenceId: event.params.requestId, clickRoute: 'hk', actorUid: after.assignedTo || null, department: 'hk', roomNo: after.roomNo || null });
});

exports.onTowelRequestCreated = onDocumentCreated({ region: REGION, document: 'towel_requests/{requestId}' }, async (event) => {
  const data = event.data?.data(); if (!data) return;
  const users = (await Promise.all(['hk', 'fo', 'fitness'].map((dept) => listUsersByDepartment(dept)))).flat();
  const admins = await listAdminUsers();
  const recipients = [...users, ...admins].map((item) => item.uid || item.id);
  await announceToUsers(recipients, { type: 'towel_request', title: 'New towel request', body: `${data.roomNo || 'Guest room'} requested ${data.qty || 1} towel(s) for ${data.location || 'pickup'}.`, referenceType: 'towel_request', referenceId: event.params.requestId, clickRoute: 'towel', actorUid: data.userId || null, roomNo: data.roomNo || null });
});

exports.onTowelRequestUpdated = onDocumentUpdated({ region: REGION, document: 'towel_requests/{requestId}' }, async (event) => {
  const before = event.data?.before?.data(); const after = event.data?.after?.data();
  if (!before || !after || (before.status || '') === (after.status || '') || !after.userId) return;
  await announceToUsers([after.userId], { type: 'towel_status', title: 'Towel request updated', body: `Your towel request is now ${after.status}.`, referenceType: 'towel_request', referenceId: event.params.requestId, clickRoute: 'towel', actorUid: after.returnProcessedBy || after.processedBy || null, roomNo: after.roomNo || null });
});

exports.onChatMessageCreated = onDocumentCreated({ region: REGION, document: 'chat_messages/{messageId}' }, async (event) => {
  const data = event.data?.data(); if (!data || !data.threadId) return;
  const threadSnap = await db.collection('chat_threads').doc(data.threadId).get(); if (!threadSnap.exists) return;
  const thread = threadSnap.data(); let recipients = [];
  if (data.senderType === 'guest') {
    const deptUsers = await listUsersByDepartment(thread.department); const admins = await listAdminUsers();
    recipients = [...deptUsers, ...admins].map((item) => item.uid || item.id).filter((uid) => uid !== data.senderId);
  } else if (thread.guestUserId) {
    recipients = [thread.guestUserId].filter((uid) => uid !== data.senderId);
  }
  if (!recipients.length) return;
  await announceToUsers(recipients, { type: 'chat_message', title: data.senderType === 'guest' ? 'New guest message' : 'New reply from staff', body: String(data.message || '').slice(0, 140), referenceType: 'chat_thread', referenceId: data.threadId, clickRoute: 'chat', actorUid: data.senderId || null, department: thread.department || null, roomNo: thread.roomNo || null });
});

exports.onChatThreadUpdated = onDocumentUpdated({ region: REGION, document: 'chat_threads/{threadId}' }, async (event) => {
  const before = event.data?.before?.data(); const after = event.data?.after?.data();
  if (!before || !after) return;
  if ((before.status || '') === (after.status || '') && (before.assignedTo || '') === (after.assignedTo || '')) return;
  const recipients = [after.guestUserId, after.assignedTo].filter(Boolean);
  if (!recipients.length) return;
  await announceToUsers(recipients, { type: 'chat_status', title: 'Conversation updated', body: `Chat status is now ${after.status || 'open'}.`, referenceType: 'chat_thread', referenceId: event.params.threadId, clickRoute: 'chat', actorUid: after.assignedTo || null, department: after.department || null, roomNo: after.roomNo || null });
});


exports.registerSelfMember = onCall({ region: REGION }, async (request) => {
  const uid = requireAuth(request);
  const data = request.data || {};
  const authRecord = await getAuth().getUser(uid).catch(() => null);
  if (!authRecord?.email) {
    throw new HttpsError('failed-precondition', 'This account must have a Firebase login before registration.');
  }

  const existing = await getUserDoc(uid);
  if (existing && !['member', 'guest'].includes(String(existing.role || ''))) {
    throw new HttpsError('already-exists', 'This account is already managed by another role.');
  }

  const firstName = String(data.firstName || '').trim();
  const lastName = String(data.lastName || '').trim();
  const employeeId = sanitizeEmployeeId(data.employeeId || '');
  const publicEmail = String(data.email || '').trim().toLowerCase();
  const displayName = String(data.displayName || [firstName, lastName].filter(Boolean).join(' ').trim() || employeeId || authRecord.displayName || authRecord.email.split('@')[0] || 'Member');
  const phone = String(data.phone || '').trim();
  const language = String(data.language || 'en');

  if (!firstName) {
    throw new HttpsError('invalid-argument', 'First name is required.');
  }
  if (!publicEmail && !employeeId) {
    throw new HttpsError('invalid-argument', 'Email or employee ID is required.');
  }
  if (employeeId && !isValidEmployeeId(employeeId)) {
    throw new HttpsError('invalid-argument', 'Employee ID format is invalid.');
  }

  if (employeeId) {
    const dup = await db.collection('users').where('employeeId', '==', employeeId).limit(1).get();
    if (!dup.empty && dup.docs[0].id !== uid) {
      throw new HttpsError('already-exists', 'This employee ID is already registered.');
    }
  }

  const isEmployeeRegistration = Boolean(employeeId);

  await writeManagedMemberDocs({
    uid,
    operatorUid: uid,
    data: {
      role: 'member',
      department: null,
      cardType: isEmployeeRegistration ? 'team_member' : 'guest_point',
      cardLevel: isEmployeeRegistration ? 1 : 0,
      cardColor: isEmployeeRegistration ? 'white' : 'red',
      cardTheme: isEmployeeRegistration ? 'team_white' : 'guest_red',
      firstName,
      lastName,
      displayName,
      employeeId,
      email: publicEmail,
      authEmail: authRecord.email,
      phone,
      language,
      balance: 0,
      points: 0,
      status: 'active',
      authManaged: false
    }
  });

  await getAuth().updateUser(uid, { displayName }).catch(() => null);
  const profile = await getUserDoc(uid);
  return { ok: true, uid, profile };
});
