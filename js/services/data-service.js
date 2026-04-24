import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db, hasFirebaseConfig, demoModeEnabled, assertProductionReady } from '../firebase-init.js';
import {
  clone,
  isAdminLike,
  isStaffLike,
  titleize,
  toMillis
} from '../utils/helpers.js';
import {
  demoCards,
  demoChatMessages,
  demoChatThreads,
  demoHkRequests,
  demoNotices,
  demoRewards,
  demoScanRequests,
  demoServiceLinks,
  demoTowelRequests,
  demoTransactions,
  demoUsers,
  demoNotifications,
  demoCardThemes
} from '../demo-data.js';
import {
  processScanRequestCallable,
  requestRewardRedemptionCallable,
  markAllNotificationsReadCallable
} from './function-service.js';
import { deleteStoragePath } from './storage-service.js';

const demoStore = {
  users: Object.values(clone(demoUsers)),
  rewards: clone(demoRewards),
  serviceLinks: clone(demoServiceLinks),
  notices: clone(demoNotices),
  scanRequests: clone(demoScanRequests),
  redemptions: [],
  hkRequests: clone(demoHkRequests),
  towelRequests: clone(demoTowelRequests),
  chatThreads: clone(demoChatThreads),
  chatMessages: clone(demoChatMessages),
  notifications: clone(demoNotifications),
  cardThemes: clone(demoCardThemes)
};

function shouldUseDemoData() {
  return demoModeEnabled && (!hasFirebaseConfig || !db);
}

function assertDataReady(context = 'This action') {
  if (shouldUseDemoData()) return false;
  assertProductionReady(context);
  return true;
}

function safeRole(user = {}) {
  return user?.role || 'member';
}

function safeDept(user = {}) {
  return user?.department || null;
}

function safeSortByCreatedAt(items = [], field = 'createdAt') {
  return [...items].sort((a, b) => toMillis(b?.[field]) - toMillis(a?.[field]));
}

function getDefaultThemeKey(cardType = '', cardColor = '') {
  const map = { excom: 'excom_gold', hod: 'hod_silver', manager: 'manager_bronze', team_member: 'team_white', fitness_guest: 'fitness_black', guest_point: 'guest_red' };
  return map[cardType] || (cardColor ? `${cardType}_${cardColor}` : 'team_white');
}

function sortBySortOrder(items = []) {
  return [...items].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

function buildDemoNotification(targetUserId, record = {}) {
  const item = {
    id: `demo-nt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    targetUserId,
    type: record.type || 'alert',
    title: record.title || 'New notification',
    body: record.body || '',
    referenceType: record.referenceType || null,
    referenceId: record.referenceId || null,
    clickRoute: record.clickRoute || 'notifications',
    isRead: false,
    createdAt: Date.now()
  };
  demoStore.notifications.unshift(item);
  return item;
}

function getDemoNotificationsForUser(user) {
  return safeSortByCreatedAt(demoStore.notifications.filter((item) => item.targetUserId === user.uid));
}

function hkManagerAllowed(user) {
  return isAdminLike(safeRole(user)) || ['hk', 'fo', 'admin'].includes(safeDept(user)) || safeRole(user) === 'department_manager';
}

function towelManagerAllowed(user) {
  return isAdminLike(safeRole(user)) || ['hk', 'fo', 'fitness', 'admin'].includes(safeDept(user)) || safeRole(user) === 'department_manager';
}

function mapFirestoreRows(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function countDocs(refOrQuery) {
  try {
    const snap = await getCountFromServer(refOrQuery);
    return snap.data().count || 0;
  } catch {
    return 0;
  }
}

async function readCollection(path, options = {}) {
  const parts = [];
  if (options.where) {
    for (const item of options.where) {
      parts.push(where(item.field, item.op, item.value));
    }
  }
  if (options.orderBy) {
    parts.push(orderBy(options.orderBy.field, options.orderBy.dir || 'asc'));
  }
  if (options.limit) {
    parts.push(limit(options.limit));
  }

  const ref = collection(db, path);
  const snap = await getDocs(parts.length ? query(ref, ...parts) : ref);
  return mapFirestoreRows(snap);
}

async function readSingleByUserId(path, uid) {
  const rows = await readCollection(path, { where: [{ field: 'userId', op: '==', value: uid }], limit: 1 });
  return rows[0] || null;
}

async function readUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function readActiveContent() {
  const [serviceLinks, notices] = await Promise.all([
    readCollection('content_links', { where: [{ field: 'active', op: '==', value: true }], orderBy: { field: 'sortOrder', dir: 'asc' }, limit: 8 }).catch(() => []),
    readCollection('content_banners', { where: [{ field: 'active', op: '==', value: true }], orderBy: { field: 'updatedAt', dir: 'desc' }, limit: 4 }).catch(() => [])
  ]);
  return { serviceLinks, notices };
}

async function readRecentUserTransactions(uid) {
  const [walletTx, pointTx] = await Promise.all([
    readCollection('wallet_transactions', { where: [{ field: 'userId', op: '==', value: uid }], orderBy: { field: 'createdAt', dir: 'desc' }, limit: 5 }).catch(() => []),
    readCollection('point_transactions', { where: [{ field: 'userId', op: '==', value: uid }], orderBy: { field: 'createdAt', dir: 'desc' }, limit: 5 }).catch(() => [])
  ]);

  const mappedWallet = walletTx.map((item) => ({
    id: item.id,
    title: titleize(item.transactionType || 'wallet'),
    type: item.transactionType || 'wallet',
    amount: Number(item.amount || 0),
    createdAt: item.createdAt,
    source: item.source || 'wallet'
  }));

  const mappedPoints = pointTx.map((item) => ({
    id: item.id,
    title: titleize(item.transactionType || 'points'),
    type: item.transactionType || 'points',
    amount: Number(item.points || 0),
    createdAt: item.createdAt,
    source: 'points'
  }));

  return safeSortByCreatedAt([...mappedWallet, ...mappedPoints]).slice(0, 8);
}

function getBuiltinServiceCards(user, serviceLinks = []) {
  const byKey = Object.fromEntries((serviceLinks || []).map((item) => [item.key || item.id, item]));
  return [
    {
      id: 'food_to_room',
      title: byKey.food_to_room?.title || 'Order Food to Room',
      description: byKey.food_to_room?.description || 'Open your room dining ordering link.',
      type: 'external',
      url: byKey.food_to_room?.url || '#'
    },
    {
      id: 'towel_borrow',
      title: 'Borrow Towel',
      description: 'Request towels for room front or gym pickup and return tracking.',
      type: 'route',
      route: 'towel'
    },
    {
      id: 'department_chat',
      title: 'Chat with Staff',
      description: 'Open realtime department chat with FO, HK, Engineering, F&B, or Fitness.',
      type: 'route',
      route: 'chat'
    },
    {
      id: 'hk_request',
      title: 'HK Request',
      description: 'Request pillows, blankets, water, tea, coffee, and more.',
      type: 'route',
      route: 'hk'
    },
    {
      id: 'member',
      title: 'Open Member Card',
      description: 'View your card, QR code, balance, and points.',
      type: 'route',
      route: 'member'
    },
    {
      id: 'redeem',
      title: 'Redeem Rewards',
      description: 'Use your points to redeem hotel rewards.',
      type: 'route',
      route: 'redeem'
    }
  ].filter((item) => item.type !== 'external' || item.url);
}

async function readHomeLatestActivity(user) {
  if (isStaffLike(safeRole(user))) {
    const [hk, towel, chats] = await Promise.all([
      readCollection('hk_requests', { orderBy: { field: 'createdAt', dir: 'desc' }, limit: 3 }).catch(() => []),
      readCollection('towel_requests', { orderBy: { field: 'borrowedAt', dir: 'desc' }, limit: 3 }).catch(() => []),
      readCollection('chat_threads', { orderBy: { field: 'updatedAt', dir: 'desc' }, limit: 3 }).catch(() => [])
    ]);
    return safeSortByCreatedAt([
      ...hk.map((item) => ({ ...item, kind: 'hk', title: item.roomNo || item.id })),
      ...towel.map((item) => ({ ...item, createdAt: item.borrowedAt || item.createdAt, kind: 'towel', title: item.roomNo || item.id })),
      ...chats.map((item) => ({ ...item, createdAt: item.updatedAt || item.lastMessageAt, kind: 'chat', title: item.roomNo || item.department }))
    ]).slice(0, 5);
  }

  const [hk, towel, chats] = await Promise.all([
    readCollection('hk_requests', { where: [{ field: 'userId', op: '==', value: user.uid }], orderBy: { field: 'createdAt', dir: 'desc' }, limit: 3 }).catch(() => []),
    readCollection('towel_requests', { where: [{ field: 'userId', op: '==', value: user.uid }], orderBy: { field: 'borrowedAt', dir: 'desc' }, limit: 3 }).catch(() => []),
    readCollection('chat_threads', { where: [{ field: 'guestUserId', op: '==', value: user.uid }], orderBy: { field: 'updatedAt', dir: 'desc' }, limit: 3 }).catch(() => [])
  ]);

  return safeSortByCreatedAt([
    ...hk.map((item) => ({ ...item, kind: 'hk', title: item.roomNo || item.id })),
    ...towel.map((item) => ({ ...item, createdAt: item.borrowedAt || item.createdAt, kind: 'towel', title: item.roomNo || item.id })),
    ...chats.map((item) => ({ ...item, createdAt: item.updatedAt || item.lastMessageAt, kind: 'chat', title: item.department || item.roomNo }))
  ]).slice(0, 5);
}

export async function loadShellData(user) {
  if (!user?.uid && !shouldUseDemoData()) return { serviceLinks: [], notices: [] };
  if (shouldUseDemoData()) {
    return {
      serviceLinks: clone(demoStore.serviceLinks),
      notices: clone(demoStore.notices)
    };
  }
  return readActiveContent();
}

export async function loadHomeSnapshot(user) {
  if (!user?.uid && !shouldUseDemoData()) throw new Error('Home snapshot requires an authenticated production user.');
  if (shouldUseDemoData()) {
    const serviceLinks = clone(demoStore.serviceLinks);
    return {
      serviceLinks,
      quickServices: getBuiltinServiceCards(user, serviceLinks),
      notices: clone(demoNotices),
      unreadNotifications: getDemoNotificationsForUser(user).filter((item) => !item.isRead).length,
      latestRequests: safeSortByCreatedAt([
        ...demoStore.hkRequests.map((item) => ({ ...item, kind: 'hk', title: item.roomNo })),
        ...demoStore.towelRequests.map((item) => ({ ...item, createdAt: item.borrowedAt, kind: 'towel', title: item.roomNo })),
        ...demoStore.chatThreads.map((item) => ({ ...item, createdAt: item.updatedAt, kind: 'chat', title: item.department }))
      ]).slice(0, 5)
    };
  }

  const [content, notificationCount, latestRequests, card, wallet, pointAccount] = await Promise.all([
    readActiveContent(),
    countDocs(query(collection(db, 'notifications'), where('targetUserId', '==', user.uid), where('isRead', '==', false))).catch(() => 0),
    readHomeLatestActivity(user).catch(() => []),
    readCollection('cards', { where: [{ field: 'userId', op: '==', value: user.uid }], limit: 1 }).then((rows) => rows[0] || null).catch(() => null),
    readSingleByUserId('wallet_accounts', user.uid).catch(() => null),
    readSingleByUserId('point_accounts', user.uid).catch(() => null)
  ]);

  const themeKey = card?.cardTheme || user.cardTheme || getDefaultThemeKey(card?.cardType || user.cardType, card?.cardColor || user.cardColor);
  const cardTheme = themeKey
    ? await readCollection('card_themes', { where: [{ field: 'key', op: '==', value: themeKey }], limit: 1 }).then((rows) => rows[0] || null).catch(() => null)
    : null;

  return {
    ...content,
    quickServices: getBuiltinServiceCards(user, content.serviceLinks),
    unreadNotifications: notificationCount,
    latestRequests,
    card,
    cardTheme,
    wallet: wallet || { balance: Number(user.balance || 0) },
    points: pointAccount || { points: Number(user.points || 0) }
  };
}

export async function loadMemberSnapshot(user) {
  if (!user?.uid && !shouldUseDemoData()) throw new Error('Member snapshot requires an authenticated production user.');
  if (shouldUseDemoData()) {
    const card = Object.values(demoCards).find((item) => item.userId === user.uid) || null;
    const cardTheme = demoStore.cardThemes.find((item) => item.key === (card?.cardTheme || user.cardTheme || getDefaultThemeKey(card?.cardType || user.cardType, card?.cardColor || user.cardColor))) || null;
    return {
      card,
      cardTheme,
      wallet: { balance: Number(user.balance || 0) },
      points: { points: Number(user.points || 0) },
      transactions: clone(demoTransactions)
    };
  }

  const [card, wallet, pointAccount, transactions] = await Promise.all([
    readCollection('cards', { where: [{ field: 'userId', op: '==', value: user.uid }], limit: 1 }).then((rows) => rows[0] || null).catch(() => null),
    readSingleByUserId('wallet_accounts', user.uid).catch(() => null),
    readSingleByUserId('point_accounts', user.uid).catch(() => null),
    readRecentUserTransactions(user.uid).catch(() => [])
  ]);
  const themeKey = card?.cardTheme || user.cardTheme || getDefaultThemeKey(card?.cardType || user.cardType, card?.cardColor || user.cardColor);
  const cardTheme = themeKey ? await readCollection('card_themes', { where: [{ field: 'key', op: '==', value: themeKey }], limit: 1 }).then((rows) => rows[0] || null).catch(() => null) : null;

  return {
    card,
    cardTheme,
    wallet,
    points: pointAccount,
    transactions
  };
}

export async function loadRedeemSnapshot(user) {
  if (!user?.uid && !shouldUseDemoData()) throw new Error('Redeem snapshot requires an authenticated production user.');
  if (shouldUseDemoData()) {
    return {
      rewards: clone(demoRewards),
      redemptions: clone(demoStore.redemptions),
      pointAccount: { points: Number(user.points || 0) }
    };
  }

  const [rewards, redemptions, pointAccount] = await Promise.all([
    readCollection('rewards', { where: [{ field: 'active', op: '==', value: true }], orderBy: { field: 'sortOrder', dir: 'asc' }, limit: 30 }).catch(() => []),
    readCollection('redemptions', { where: [{ field: 'userId', op: '==', value: user.uid }], orderBy: { field: 'redeemedAt', dir: 'desc' }, limit: 20 }).catch(() => []),
    readSingleByUserId('point_accounts', user.uid).catch(() => null)
  ]);

  return { rewards, redemptions, pointAccount };
}

export async function requestRewardRedemption(user, reward) {
  if (!user?.uid || !reward?.id) throw new Error('Missing redemption data.');

  if (shouldUseDemoData()) {
    const record = {
      id: `demo-rd-${Date.now()}`,
      rewardId: reward.id,
      rewardTitle: reward.title,
      userId: user.uid,
      status: 'active',
      pointsUsed: Number(reward.pointsRequired || 0),
      redeemedAt: Date.now(),
      rewardCode: `RW-DEMO-${Date.now()}`
    };
    demoStore.redemptions.unshift(record);
    return record;
  }

  try {
    const result = await requestRewardRedemptionCallable(reward.id);
    return result;
  } catch (error) {
    console.error('Callable reward redemption failed', error);
    throw new Error(error?.message || 'Unable to redeem reward right now.');
  }
}

export async function loadAdminDashboardSnapshot(user) {
  if (shouldUseDemoData()) {
    return {
      kpis: {
        users: demoStore.users.length,
        guestSessions: 1,
        openHkRequests: demoStore.hkRequests.filter((item) => ['new', 'accepted', 'delivering'].includes(item.status)).length,
        borrowedTowels: demoStore.towelRequests.filter((item) => item.status === 'borrowed').length,
        pendingScanRequests: demoStore.scanRequests.filter((item) => item.status === 'pending').length,
        activeRedemptions: demoStore.redemptions.filter((item) => item.status === 'active').length,
        openChatThreads: demoStore.chatThreads.filter((item) => item.status !== 'closed').length
      },
      recentScans: clone(demoStore.scanRequests).slice(0, 6),
      recentTransactions: clone(demoTransactions).slice(0, 6),
      members: safeSortByCreatedAt(demoStore.users.map((item) => ({ ...item }))).slice(0, 30),
      rewards: safeSortByCreatedAt(demoStore.rewards.map((item) => ({ ...item, createdAt: item.createdAt || Date.now() }))).slice(0, 30),
      contentLinks: [...demoStore.serviceLinks].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
      contentBanners: [...demoStore.notices].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
      cardThemes: sortBySortOrder(demoStore.cardThemes)
    };
  }

  const [
    usersCount,
    guestSessions,
    openHkRequests,
    borrowedTowels,
    pendingScanRequests,
    activeRedemptions,
    openChatThreads,
    recentScans,
    recentTransactions,
    members,
    rewards,
    contentLinks,
    contentBanners,
    cardThemes,
    walletAccounts,
    pointAccounts
  ] = await Promise.all([
    countDocs(collection(db, 'users')),
    countDocs(query(collection(db, 'guest_sessions'), where('status', '==', 'active'))).catch(() => 0),
    countDocs(query(collection(db, 'hk_requests'), where('status', 'in', ['new', 'accepted', 'delivering']))).catch(() => 0),
    countDocs(query(collection(db, 'towel_requests'), where('status', '==', 'borrowed'))).catch(() => 0),
    countDocs(query(collection(db, 'scan_requests'), where('status', '==', 'pending'))).catch(() => 0),
    countDocs(query(collection(db, 'redemptions'), where('status', 'in', ['pending', 'active']))).catch(() => 0),
    countDocs(query(collection(db, 'chat_threads'), where('status', 'in', ['open', 'assigned']))).catch(() => 0),
    readCollection('scan_requests', { orderBy: { field: 'createdAt', dir: 'desc' }, limit: 8 }).catch(() => []),
    readCollection('wallet_transactions', { orderBy: { field: 'createdAt', dir: 'desc' }, limit: 8 }).catch(() => []),
    readCollection('users', { orderBy: { field: 'createdAt', dir: 'desc' }, limit: 30 }).catch(() => []),
    readCollection('rewards', { orderBy: { field: 'updatedAt', dir: 'desc' }, limit: 30 }).catch(() => []),
    readCollection('content_links', { orderBy: { field: 'sortOrder', dir: 'asc' }, limit: 30 }).catch(() => []),
    readCollection('content_banners', { orderBy: { field: 'sortOrder', dir: 'asc' }, limit: 30 }).catch(() => []),
    readCollection('card_themes', { orderBy: { field: 'sortOrder', dir: 'asc' }, limit: 50 }).catch(() => []),
    readCollection('wallet_accounts', { limit: 200 }).catch(() => []),
    readCollection('point_accounts', { limit: 200 }).catch(() => [])
  ]);

  const walletByUserId = Object.fromEntries(walletAccounts.map((item) => [item.userId, Number(item.balance || 0)]));
  const pointsByUserId = Object.fromEntries(pointAccounts.map((item) => [item.userId, Number(item.points || 0)]));
  const mappedMembers = members.map((item) => ({
    ...item,
    balance: walletByUserId[item.uid] || 0,
    points: pointsByUserId[item.uid] || 0
  }));

  return {
    kpis: { users: usersCount, guestSessions, openHkRequests, borrowedTowels, pendingScanRequests, activeRedemptions, openChatThreads },
    recentScans,
    recentTransactions,
    members: mappedMembers,
    rewards,
    contentLinks,
    contentBanners,
    cardThemes
  };
}

function makeId(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readCollectionByUserId(pathName, userId) {
  return readCollection(pathName, { where: [{ field: 'userId', op: '==', value: userId }] });
}

export async function saveMemberProfile(adminUser, payload = {}) {
  if (!adminUser?.uid) throw new Error('Missing admin profile.');
  const now = hasFirebaseConfig && db ? serverTimestamp() : Date.now();
  const uid = payload.uid || makeId('member');
  const displayName = payload.displayName || [payload.firstName, payload.lastName].filter(Boolean).join(' ').trim() || uid;
  const role = payload.role || 'member';
  const department = payload.department || null;
  const cardType = payload.cardType || 'team_member';
  const cardLevel = Number(payload.cardLevel || 0);
  const cardColor = payload.cardColor || 'gold';
  const cardTheme = payload.cardTheme || getDefaultThemeKey(cardType, cardColor);
  const status = payload.status || 'active';
  const language = payload.language || 'th';
  const balance = Number(payload.balance || 0);
  const pts = Number(payload.points || 0);
  const photoURL = payload.photoURL || '';
  const photoStoragePath = payload.photoStoragePath || '';
  const hasAuthAccount = payload.hasAuthAccount === true || payload.hasAuthAccount === 'true' || payload.authManaged === true || payload.authManaged === 'true';
  const authManaged = payload.authManaged === true || payload.authManaged === 'true';

  if (shouldUseDemoData()) {
    const existingIndex = demoStore.users.findIndex((item) => item.uid === uid);
    const record = {
      uid,
      role,
      department,
      cardType,
      cardLevel,
      cardColor,
      cardTheme,
      firstName: payload.firstName || '',
      lastName: payload.lastName || '',
      displayName,
      email: payload.email || '',
      phone: payload.phone || '',
      roomNo: payload.roomNo || '',
      language,
      photoURL,
      photoStoragePath,
      hasAuthAccount,
      authManaged,
      status,
      createdAt: existingIndex >= 0 ? demoStore.users[existingIndex].createdAt || Date.now() : Date.now(),
      updatedAt: Date.now(),
      createdBy: adminUser.uid,
      balance,
      points: pts
    };
    if (existingIndex >= 0) demoStore.users[existingIndex] = { ...demoStore.users[existingIndex], ...record };
    else demoStore.users.unshift(record);
    return record;
  }

  const [existingProfile, existingCards, existingWallets, existingPoints] = await Promise.all([
    readUserProfile(uid).catch(() => null),
    readCollectionByUserId('cards', uid).catch(() => []),
    readCollectionByUserId('wallet_accounts', uid).catch(() => []),
    readCollectionByUserId('point_accounts', uid).catch(() => [])
  ]);

  const cardId = existingCards[0]?.id || makeId('CARD');
  const walletAccountId = existingWallets[0]?.id || makeId('WA');
  const pointAccountId = existingPoints[0]?.id || makeId('PA');
  const cardNumber = existingCards[0]?.cardNumber || `${String(cardType || 'CARD').slice(0, 2).toUpperCase()}-${uid.slice(-6).toUpperCase()}`;

  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid), {
    uid,
    role,
    department,
    cardType,
    cardLevel,
    cardColor,
    cardTheme,
    firstName: payload.firstName || '',
    lastName: payload.lastName || '',
    displayName,
    email: payload.email || '',
    phone: payload.phone || '',
    roomNo: payload.roomNo || '',
    language,
    photoURL,
    photoStoragePath,
    hasAuthAccount,
    authManaged,
    status,
    createdAt: existingProfile?.createdAt || now,
    updatedAt: now,
    createdBy: existingProfile?.createdBy || adminUser.uid
  }, { merge: true });
  batch.set(doc(db, 'cards', cardId), {
    cardId,
    userId: uid,
    cardType,
    cardLevel,
    cardColor,
    cardTheme,
    cardNumber,
    qrValue: existingCards[0]?.qrValue || `LAYA-CARD-${cardNumber}`,
    walletAccountId,
    pointAccountId,
    issuedAt: existingCards[0]?.issuedAt || now,
    active: status === 'active',
    updatedAt: now
  }, { merge: true });
  batch.set(doc(db, 'wallet_accounts', walletAccountId), {
    walletAccountId,
    userId: uid,
    cardId,
    currency: 'THB',
    balance,
    allowTopup: true,
    allowDeduct: true,
    updatedAt: now
  }, { merge: true });
  batch.set(doc(db, 'point_accounts', pointAccountId), {
    pointAccountId,
    userId: uid,
    cardId,
    points: pts,
    updatedAt: now
  }, { merge: true });
  await batch.commit();
  return { uid, cardId, walletAccountId, pointAccountId, photoURL, photoStoragePath, hasAuthAccount, authManaged };
}

export async function deleteMemberProfile(adminUser, uid) {
  if (!adminUser?.uid || !uid) throw new Error('Missing member id.');
  if (shouldUseDemoData()) {
    demoStore.users = demoStore.users.filter((item) => item.uid !== uid);
    return { ok: true };
  }
  const existingProfile = await readUserProfile(uid).catch(() => null);
  const [cards, wallets, pointAccounts, guestSessions, pushTokens] = await Promise.all([
    readCollectionByUserId('cards', uid).catch(() => []),
    readCollectionByUserId('wallet_accounts', uid).catch(() => []),
    readCollectionByUserId('point_accounts', uid).catch(() => []),
    readCollection('guest_sessions', { where: [{ field: 'userId', op: '==', value: uid }] }).catch(() => []),
    readCollection('push_tokens', { where: [{ field: 'userId', op: '==', value: uid }] }).catch(() => [])
  ]);
  if (existingProfile?.photoStoragePath) {
    await deleteStoragePath(existingProfile.photoStoragePath).catch(() => null);
  }
  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', uid));
  cards.forEach((item) => batch.delete(doc(db, 'cards', item.id)));
  wallets.forEach((item) => batch.delete(doc(db, 'wallet_accounts', item.id)));
  pointAccounts.forEach((item) => batch.delete(doc(db, 'point_accounts', item.id)));
  guestSessions.forEach((item) => batch.delete(doc(db, 'guest_sessions', item.id)));
  pushTokens.forEach((item) => batch.delete(doc(db, 'push_tokens', item.id)));
  await batch.commit();
  return { ok: true };
}

export async function saveReward(adminUser, payload = {}) {
  if (!adminUser?.uid) throw new Error('Missing admin profile.');
  const id = payload.id || makeId('reward');
  const existing = hasFirebaseConfig && db && payload.id ? await getDoc(doc(db, 'rewards', id)).catch(() => null) : null;
  const existingData = existing?.exists?.() ? existing.data() : null;
  const now = hasFirebaseConfig && db ? serverTimestamp() : Date.now();
  const record = {
    title: payload.title || 'Reward',
    description: payload.description || '',
    imageUrl: payload.imageUrl || existingData?.imageUrl || '',
    imageStoragePath: payload.imageStoragePath || existingData?.imageStoragePath || '',
    pointsRequired: Number(payload.pointsRequired || 0),
    stock: Number(payload.stock || 0),
    active: !!payload.active,
    category: payload.category || 'general',
    sortOrder: Number(payload.sortOrder || 0),
    updatedAt: now,
    createdAt: existingData?.createdAt || payload.createdAt || now
  };
  if (shouldUseDemoData()) {
    const index = demoStore.rewards.findIndex((item) => item.id === id);
    const demo = { id, ...record, updatedAt: Date.now(), createdAt: index >= 0 ? demoStore.rewards[index].createdAt || Date.now() : Date.now() };
    if (index >= 0) demoStore.rewards[index] = demo; else demoStore.rewards.unshift(demo);
    return demo;
  }
  await setDoc(doc(db, 'rewards', id), record, { merge: true });
  return { id, ...record };
}

export async function deleteReward(adminUser, id) {
  if (!adminUser?.uid || !id) throw new Error('Missing reward id.');
  if (shouldUseDemoData()) {
    demoStore.rewards = demoStore.rewards.filter((item) => item.id !== id);
    return { ok: true };
  }
  const rewardSnap = await getDoc(doc(db, 'rewards', id)).catch(() => null);
  if (rewardSnap?.exists?.()) {
    const data = rewardSnap.data();
    if (data?.imageStoragePath) await deleteStoragePath(data.imageStoragePath).catch(() => null);
  }
  await deleteDoc(doc(db, 'rewards', id));
  return { ok: true };
}

export async function saveContentLink(adminUser, payload = {}) {
  if (!adminUser?.uid) throw new Error('Missing admin profile.');
  const id = payload.id || makeId('link');
  const existing = hasFirebaseConfig && db && payload.id ? await getDoc(doc(db, 'content_links', id)).catch(() => null) : null;
  const existingData = existing?.exists?.() ? existing.data() : null;
  const now = hasFirebaseConfig && db ? serverTimestamp() : Date.now();
  const record = {
    key: payload.key || id,
    title: payload.title || payload.key || 'Link',
    description: payload.description || '',
    url: payload.url || '#',
    icon: payload.icon || 'link',
    active: !!payload.active,
    sortOrder: Number(payload.sortOrder || 0),
    updatedAt: now,
    createdAt: existingData?.createdAt || payload.createdAt || now
  };
  if (shouldUseDemoData()) {
    const index = demoStore.serviceLinks.findIndex((item) => item.id === id);
    const demo = { id, ...record, updatedAt: Date.now(), createdAt: index >= 0 ? demoStore.serviceLinks[index].createdAt || Date.now() : Date.now() };
    if (index >= 0) demoStore.serviceLinks[index] = demo; else demoStore.serviceLinks.unshift(demo);
    return demo;
  }
  await setDoc(doc(db, 'content_links', id), record, { merge: true });
  return { id, ...record };
}

export async function deleteContentLink(adminUser, id) {
  if (!adminUser?.uid || !id) throw new Error('Missing content link id.');
  if (shouldUseDemoData()) {
    demoStore.serviceLinks = demoStore.serviceLinks.filter((item) => item.id !== id);
    return { ok: true };
  }
  await deleteDoc(doc(db, 'content_links', id));
  return { ok: true };
}

export async function saveContentBanner(adminUser, payload = {}) {
  if (!adminUser?.uid) throw new Error('Missing admin profile.');
  const id = payload.id || makeId('banner');
  const existing = hasFirebaseConfig && db && payload.id ? await getDoc(doc(db, 'content_banners', id)).catch(() => null) : null;
  const existingData = existing?.exists?.() ? existing.data() : null;
  const now = hasFirebaseConfig && db ? serverTimestamp() : Date.now();
  const record = {
    title: payload.title || 'Notice',
    body: payload.body || '',
    imageUrl: payload.imageUrl || existingData?.imageUrl || '',
    imageStoragePath: payload.imageStoragePath || existingData?.imageStoragePath || '',
    active: !!payload.active,
    sortOrder: Number(payload.sortOrder || 0),
    updatedAt: now,
    createdAt: existingData?.createdAt || payload.createdAt || now
  };
  if (shouldUseDemoData()) {
    const index = demoStore.notices.findIndex((item) => item.id === id);
    const demo = { id, ...record, updatedAt: Date.now(), createdAt: index >= 0 ? demoStore.notices[index].createdAt || Date.now() : Date.now() };
    if (index >= 0) demoStore.notices[index] = demo; else demoStore.notices.unshift(demo);
    return demo;
  }
  await setDoc(doc(db, 'content_banners', id), record, { merge: true });
  return { id, ...record };
}

export async function deleteContentBanner(adminUser, id) {
  if (!adminUser?.uid || !id) throw new Error('Missing content banner id.');
  if (shouldUseDemoData()) {
    demoStore.notices = demoStore.notices.filter((item) => item.id !== id);
    return { ok: true };
  }
  const bannerSnap = await getDoc(doc(db, 'content_banners', id)).catch(() => null);
  if (bannerSnap?.exists?.()) {
    const data = bannerSnap.data();
    if (data?.imageStoragePath) await deleteStoragePath(data.imageStoragePath).catch(() => null);
  }
  await deleteDoc(doc(db, 'content_banners', id));
  return { ok: true };
}

async function readCardBy(field, value) {
  const rows = await readCollection('cards', { where: [{ field, op: '==', value }], limit: 1 });
  return rows[0] || null;
}

export async function saveCardTheme(adminUser, payload = {}) {
  if (!adminUser?.uid) throw new Error('Missing admin profile.');
  const id = payload.id || payload.key || makeId('theme');
  const key = String(payload.key || id).trim();
  const existing = hasFirebaseConfig && db && payload.id ? await getDoc(doc(db, 'card_themes', id)).catch(() => null) : null;
  const existingData = existing?.exists?.() ? existing.data() : null;
  const now = hasFirebaseConfig && db ? serverTimestamp() : Date.now();
  const record = {
    key,
    title: payload.title || key,
    cardColor: payload.cardColor || existingData?.cardColor || 'white',
    gradientFrom: payload.gradientFrom || existingData?.gradientFrom || '',
    gradientTo: payload.gradientTo || existingData?.gradientTo || '',
    accentColor: payload.accentColor || existingData?.accentColor || '',
    textColor: payload.textColor || existingData?.textColor || '',
    secondaryTextColor: payload.secondaryTextColor || existingData?.secondaryTextColor || '',
    logoText: payload.logoText || existingData?.logoText || 'LAYA',
    footerText: payload.footerText || existingData?.footerText || '',
    active: payload.active !== false && payload.active !== 'false',
    sortOrder: Number(payload.sortOrder || 0),
    updatedAt: now,
    createdAt: existingData?.createdAt || payload.createdAt || now
  };
  if (shouldUseDemoData()) {
    const index = demoStore.cardThemes.findIndex((item) => item.id === id || item.key === key);
    const demo = { id, ...record, updatedAt: Date.now(), createdAt: index >= 0 ? demoStore.cardThemes[index].createdAt || Date.now() : Date.now() };
    if (index >= 0) demoStore.cardThemes[index] = demo; else demoStore.cardThemes.push(demo);
    demoStore.cardThemes = sortBySortOrder(demoStore.cardThemes);
    return demo;
  }
  await setDoc(doc(db, 'card_themes', id), record, { merge: true });
  return { id, ...record };
}

export async function deleteCardTheme(adminUser, id) {
  if (!adminUser?.uid || !id) throw new Error('Missing card theme id.');
  if (shouldUseDemoData()) {
    demoStore.cardThemes = demoStore.cardThemes.filter((item) => item.id !== id && item.key !== id);
    return { ok: true };
  }
  await deleteDoc(doc(db, 'card_themes', id));
  return { ok: true };
}

export async function loadCardToolsSnapshot(user) {
  if (!user?.uid) throw new Error('Missing user profile.');
  if (shouldUseDemoData()) {
    const themeMap = Object.fromEntries(demoStore.cardThemes.map((item) => [item.key, item]));
    const cards = demoStore.users.map((profile) => {
      const card = Object.values(demoCards).find((item) => item.userId === profile.uid) || { userId: profile.uid, cardType: profile.cardType, cardColor: profile.cardColor, cardTheme: profile.cardTheme, cardNumber: `${String(profile.cardType || 'CARD').slice(0,2).toUpperCase()}-${profile.uid.slice(-6).toUpperCase()}`, qrValue: `LAYA-${profile.uid}` };
      const theme = themeMap[card.cardTheme || profile.cardTheme || getDefaultThemeKey(card.cardType, card.cardColor)] || null;
      return { id: profile.uid, userId: profile.uid, displayName: profile.displayName, roomNo: profile.roomNo || null, cardType: card.cardType || profile.cardType, cardNumber: card.cardNumber, qrValue: card.qrValue, cardTheme: card.cardTheme || profile.cardTheme, balance: Number(profile.balance || 0), points: Number(profile.points || 0), profile, card, theme };
    });
    return { cards, cardThemes: sortBySortOrder(demoStore.cardThemes) };
  }

  const [users, cards, walletAccounts, pointAccounts, cardThemes] = await Promise.all([
    readCollection('users', { orderBy: { field: 'createdAt', dir: 'desc' }, limit: 200 }).catch(() => []),
    readCollection('cards', { limit: 200 }).catch(() => []),
    readCollection('wallet_accounts', { limit: 200 }).catch(() => []),
    readCollection('point_accounts', { limit: 200 }).catch(() => []),
    readCollection('card_themes', { orderBy: { field: 'sortOrder', dir: 'asc' }, limit: 50 }).catch(() => [])
  ]);

  const cardByUserId = Object.fromEntries(cards.map((item) => [item.userId, item]));
  const walletByUserId = Object.fromEntries(walletAccounts.map((item) => [item.userId, Number(item.balance || 0)]));
  const pointsByUserId = Object.fromEntries(pointAccounts.map((item) => [item.userId, Number(item.points || 0)]));
  const themeMap = Object.fromEntries(cardThemes.map((item) => [item.key, item]));
  const rows = users.map((profile) => {
    const card = cardByUserId[profile.uid] || { userId: profile.uid, cardType: profile.cardType, cardColor: profile.cardColor, cardTheme: profile.cardTheme, cardNumber: `${String(profile.cardType || 'CARD').slice(0,2).toUpperCase()}-${profile.uid.slice(-6).toUpperCase()}`, qrValue: `LAYA-${profile.uid}` };
    const themeKey = card.cardTheme || profile.cardTheme || getDefaultThemeKey(card.cardType, card.cardColor);
    return { id: profile.uid, userId: profile.uid, displayName: profile.displayName || profile.firstName || profile.uid, roomNo: profile.roomNo || null, cardType: card.cardType || profile.cardType, cardNumber: card.cardNumber || '-', qrValue: card.qrValue || `LAYA-${profile.uid}`, cardTheme: themeKey, balance: walletByUserId[profile.uid] || 0, points: pointsByUserId[profile.uid] || 0, profile, card, theme: themeMap[themeKey] || null };
  });

  return { cards: rows, cardThemes };
}

export async function findCardByCode(code) {
  const clean = String(code || '').trim();
  if (!clean) return null;

  if (shouldUseDemoData()) {
    const card = demoCards[clean] || Object.values(demoCards).find((item) => item.qrValue === clean || item.cardId === clean) || null;
    return card ? { ...card } : null;
  }

  const card = await readCardBy('cardNumber', clean).catch(() => null)
    || await readCardBy('qrValue', clean).catch(() => null)
    || await readCardBy('cardId', clean).catch(() => null);

  if (!card) return null;
  const [profile, wallet, pointAccount] = await Promise.all([
    readUserProfile(card.userId).catch(() => null),
    readSingleByUserId('wallet_accounts', card.userId).catch(() => null),
    readSingleByUserId('point_accounts', card.userId).catch(() => null)
  ]);

  return {
    ...card,
    displayName: profile?.displayName || profile?.firstName || card.userId,
    roomNo: profile?.roomNo || null,
    balance: wallet?.balance || 0,
    points: pointAccount?.points || 0
  };
}

export async function createScanRequest(user, payload) {
  if (!user?.uid) throw new Error('Missing operator profile.');
  const record = {
    mode: payload.mode,
    code: payload.code,
    targetCardId: payload.targetCardId || null,
    targetUserId: payload.targetUserId || null,
    targetDisplayName: payload.targetDisplayName || '',
    amount: Number(payload.amount || 0),
    pointAmount: Number(payload.pointAmount || 0),
    note: payload.note || '',
    location: payload.location || null,
    roomNo: payload.roomNo || null,
    redemptionId: payload.redemptionId || null,
    status: 'pending',
    userId: payload.targetUserId || null,
    operatorUid: user.uid,
    operatorName: user.displayName || user.email || 'Operator',
    department: user.department || null,
    createdAt: hasFirebaseConfig && db ? serverTimestamp() : Date.now(),
    updatedAt: hasFirebaseConfig && db ? serverTimestamp() : Date.now()
  };

  if (shouldUseDemoData()) {
    const demoRecord = { id: `demo-sr-${Date.now()}`, ...record, createdAt: Date.now(), updatedAt: Date.now() };
    demoStore.scanRequests.unshift(demoRecord);
    buildDemoNotification('demo-admin', { type: 'scan_request', title: 'Pending scan request', body: `${titleize(record.mode)} request is waiting for review.`, referenceType: 'scan_request', referenceId: demoRecord.id, clickRoute: 'admin' });
    return demoRecord;
  }

  const ref = await addDoc(collection(db, 'scan_requests'), record);
  return { id: ref.id, ...record };
}

export async function loadScanSnapshot(user) {
  if (shouldUseDemoData()) {
    const recent = isAdminLike(safeRole(user))
      ? clone(demoStore.scanRequests)
      : clone(demoStore.scanRequests).filter((item) => item.operatorName === user.displayName || item.department === user.department);
    return { recentRequests: safeSortByCreatedAt(recent).slice(0, 10), canReview: true };
  }

  const recentRequests = isAdminLike(safeRole(user))
    ? await readCollection('scan_requests', { orderBy: { field: 'createdAt', dir: 'desc' }, limit: 10 }).catch(() => [])
    : await readCollection('scan_requests', { where: [{ field: 'operatorUid', op: '==', value: user.uid }], orderBy: { field: 'createdAt', dir: 'desc' }, limit: 10 }).catch(() => []);

  return { recentRequests, canReview: isStaffLike(safeRole(user)) };
}

export async function updateScanRequestStatus(id, action, note = '') {
  if (!id) throw new Error('Missing scan request id.');
  if (shouldUseDemoData()) {
    const item = demoStore.scanRequests.find((row) => row.id === id);
    if (!item) return null;
    item.status = action === 'reject' ? 'rejected' : 'completed';
    item.reviewNote = note;
    item.updatedAt = Date.now();
    return item;
  }

  try {
    return await processScanRequestCallable(id, action, note);
  } catch (error) {
    console.error('Callable processScanRequest failed', error);
    throw new Error(error?.message || 'Unable to process scan request.');
  }
}

function demoImmediateSubscription(callback, payload) {
  callback(payload);
  return () => {};
}

function getRelevantDemoHk(user) {
  if (hkManagerAllowed(user)) return safeSortByCreatedAt(demoStore.hkRequests);
  return safeSortByCreatedAt(demoStore.hkRequests.filter((item) => item.userId === user.uid));
}

function getRelevantDemoTowel(user) {
  if (towelManagerAllowed(user)) return safeSortByCreatedAt(demoStore.towelRequests, 'borrowedAt');
  return safeSortByCreatedAt(demoStore.towelRequests.filter((item) => item.userId === user.uid), 'borrowedAt');
}

function getRelevantDemoThreads(user, department = null) {
  let rows = clone(demoStore.chatThreads);
  if (isAdminLike(safeRole(user))) {
    // keep all
  } else if (isStaffLike(safeRole(user))) {
    rows = rows.filter((item) => item.department === (safeDept(user) || department || 'fo'));
  } else {
    rows = rows.filter((item) => item.guestUserId === user.uid);
  }
  if (department && !isStaffLike(safeRole(user))) {
    rows = rows.filter((item) => item.department === department);
  }
  return safeSortByCreatedAt(rows, 'updatedAt');
}

export async function loadHkSnapshot(user) {
  if (shouldUseDemoData()) {
    return {
      requests: getRelevantDemoHk(user).slice(0, 20),
      canManage: hkManagerAllowed(user)
    };
  }

  const requests = hkManagerAllowed(user)
    ? await readCollection('hk_requests', { orderBy: { field: 'createdAt', dir: 'desc' }, limit: 30 }).catch(() => [])
    : await readCollection('hk_requests', { where: [{ field: 'userId', op: '==', value: user.uid }], orderBy: { field: 'createdAt', dir: 'desc' }, limit: 30 }).catch(() => []);

  return { requests, canManage: hkManagerAllowed(user) };
}

export function subscribeHkRequests(user, callback) {
  if (shouldUseDemoData()) {
    return demoImmediateSubscription(callback, getRelevantDemoHk(user));
  }

  const ref = collection(db, 'hk_requests');
  const q = hkManagerAllowed(user)
    ? query(ref, orderBy('createdAt', 'desc'), limit(30))
    : query(ref, where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(30));

  return onSnapshot(q, (snapshot) => callback(mapFirestoreRows(snapshot)));
}

export async function createHkRequest(user, payload) {
  if (!user?.uid) throw new Error('Missing member profile.');
  const itemKey = String(payload.itemKey || 'other').trim();
  const itemLabel = payload.itemLabel || titleize(itemKey);
  const qty = Math.max(1, Number(payload.qty || 1));
  const record = {
    roomNo: user.roomNo || payload.roomNo || null,
    userId: user.uid,
    guestName: user.displayName || user.firstName || 'Guest',
    items: [{ key: itemKey, label: itemLabel, qty }],
    note: payload.note || '',
    status: 'new',
    assignedTo: null,
    assignedToName: null,
    createdAt: hasFirebaseConfig && db ? serverTimestamp() : Date.now(),
    updatedAt: hasFirebaseConfig && db ? serverTimestamp() : Date.now()
  };

  if (shouldUseDemoData()) {
    const demoRecord = { id: `demo-hk-${Date.now()}`, ...record, createdAt: Date.now(), updatedAt: Date.now() };
    demoStore.hkRequests.unshift(demoRecord);
    buildDemoNotification('demo-staff', { type: 'hk_request', title: 'New HK request', body: `${demoRecord.roomNo || 'Guest room'} requested ${itemLabel} x${qty}.`, referenceType: 'hk_request', referenceId: demoRecord.id, clickRoute: 'hk' });
    return demoRecord;
  }

  const ref = await addDoc(collection(db, 'hk_requests'), record);
  return { id: ref.id, ...record };
}

export async function updateHkRequestStatus(user, requestId, status) {
  if (!requestId) throw new Error('Missing HK request id.');
  if (shouldUseDemoData()) {
    const item = demoStore.hkRequests.find((row) => row.id === requestId);
    if (!item) return null;
    item.status = status;
    item.updatedAt = Date.now();
    if (['accepted', 'delivering', 'completed'].includes(status)) {
      item.assignedTo = user.uid;
      item.assignedToName = user.displayName || user.email || 'Staff';
      buildDemoNotification(item.userId, { type: 'hk_status', title: 'HK request updated', body: `${titleize(status)} for room ${item.roomNo || '-'}.`, referenceType: 'hk_request', referenceId: item.id, clickRoute: 'hk' });
    }
    return item;
  }

  await updateDoc(doc(db, 'hk_requests', requestId), {
    status,
    assignedTo: ['accepted', 'delivering', 'completed'].includes(status) ? user.uid : null,
    assignedToName: ['accepted', 'delivering', 'completed'].includes(status) ? (user.displayName || user.email || 'Staff') : null,
    updatedAt: serverTimestamp()
  });
  return true;
}

export async function loadTowelSnapshot(user) {
  if (shouldUseDemoData()) {
    return {
      requests: getRelevantDemoTowel(user).slice(0, 20),
      canManage: towelManagerAllowed(user)
    };
  }

  const requests = towelManagerAllowed(user)
    ? await readCollection('towel_requests', { orderBy: { field: 'borrowedAt', dir: 'desc' }, limit: 30 }).catch(() => [])
    : await readCollection('towel_requests', { where: [{ field: 'userId', op: '==', value: user.uid }], orderBy: { field: 'borrowedAt', dir: 'desc' }, limit: 30 }).catch(() => []);

  return { requests, canManage: towelManagerAllowed(user) };
}

export function subscribeTowelRequests(user, callback) {
  if (shouldUseDemoData()) {
    return demoImmediateSubscription(callback, getRelevantDemoTowel(user));
  }

  const ref = collection(db, 'towel_requests');
  const q = towelManagerAllowed(user)
    ? query(ref, orderBy('borrowedAt', 'desc'), limit(30))
    : query(ref, where('userId', '==', user.uid), orderBy('borrowedAt', 'desc'), limit(30));

  return onSnapshot(q, (snapshot) => callback(mapFirestoreRows(snapshot)));
}

export async function createTowelRequest(user, payload) {
  if (!user?.uid) throw new Error('Missing member profile.');
  const qty = Math.max(1, Number(payload.qty || 1));
  const record = {
    roomNo: user.roomNo || payload.roomNo || null,
    userId: user.uid,
    guestName: user.displayName || user.firstName || 'Guest',
    location: payload.location || 'room_front',
    qty,
    status: 'borrowed',
    borrowedAt: hasFirebaseConfig && db ? serverTimestamp() : Date.now(),
    returnedAt: null,
    processedBy: null,
    returnProcessedBy: null,
    note: payload.note || ''
  };

  if (shouldUseDemoData()) {
    const demoRecord = { id: `demo-tw-${Date.now()}`, ...record, borrowedAt: Date.now() };
    demoStore.towelRequests.unshift(demoRecord);
    buildDemoNotification('demo-staff', { type: 'towel_request', title: 'New towel request', body: `${demoRecord.roomNo || 'Guest room'} requested ${qty} towel(s).`, referenceType: 'towel_request', referenceId: demoRecord.id, clickRoute: 'towel' });
    return demoRecord;
  }

  const ref = await addDoc(collection(db, 'towel_requests'), record);
  return { id: ref.id, ...record };
}

export async function updateTowelRequestStatus(user, requestId, status) {
  if (!requestId) throw new Error('Missing towel request id.');
  if (shouldUseDemoData()) {
    const item = demoStore.towelRequests.find((row) => row.id === requestId);
    if (!item) return null;
    item.status = status;
    if (status === 'returned') {
      item.returnedAt = Date.now();
      item.returnProcessedBy = user.uid;
      buildDemoNotification(item.userId, { type: 'towel_returned', title: 'Towel request closed', body: `Towel return recorded for room ${item.roomNo || '-'}.`, referenceType: 'towel_request', referenceId: item.id, clickRoute: 'towel' });
    }
    if (status === 'borrowed') {
      item.processedBy = user.uid;
    }
    return item;
  }

  await updateDoc(doc(db, 'towel_requests', requestId), {
    status,
    returnedAt: status === 'returned' ? serverTimestamp() : null,
    processedBy: status === 'borrowed' ? user.uid : null,
    returnProcessedBy: status === 'returned' ? user.uid : null
  });
  return true;
}

async function findExistingGuestThread(user, department) {
  if (shouldUseDemoData()) {
    return demoStore.chatThreads.find((row) => row.guestUserId === user.uid && row.department === department && row.status !== 'closed') || null;
  }

  const rows = await readCollection('chat_threads', {
    where: [
      { field: 'guestUserId', op: '==', value: user.uid },
      { field: 'department', op: '==', value: department }
    ],
    orderBy: { field: 'updatedAt', dir: 'desc' },
    limit: 1
  }).catch(() => []);
  return rows[0] || null;
}

export async function loadChatSnapshot(user, selectedDepartment = null) {
  const department = selectedDepartment || safeDept(user) || 'fo';
  if (shouldUseDemoData()) {
    const threads = getRelevantDemoThreads(user, department);
    const selectedThreadId = threads[0]?.id || null;
    const messages = selectedThreadId ? demoStore.chatMessages.filter((item) => item.threadId === selectedThreadId) : [];
    return {
      selectedDepartment: department,
      threads,
      selectedThreadId,
      messages: safeSortByCreatedAt(messages, 'createdAt').reverse()
    };
  }

  const threads = isAdminLike(safeRole(user))
    ? await readCollection('chat_threads', { orderBy: { field: 'updatedAt', dir: 'desc' }, limit: 30 }).catch(() => [])
    : isStaffLike(safeRole(user))
      ? await readCollection('chat_threads', { where: [{ field: 'department', op: '==', value: safeDept(user) || department }], orderBy: { field: 'updatedAt', dir: 'desc' }, limit: 30 }).catch(() => [])
      : await readCollection('chat_threads', { where: [{ field: 'guestUserId', op: '==', value: user.uid }], orderBy: { field: 'updatedAt', dir: 'desc' }, limit: 30 }).catch(() => []);

  const selectedThreadId = threads[0]?.id || null;
  const messages = selectedThreadId
    ? await readCollection('chat_messages', { where: [{ field: 'threadId', op: '==', value: selectedThreadId }], orderBy: { field: 'createdAt', dir: 'asc' }, limit: 100 }).catch(() => [])
    : [];

  return {
    selectedDepartment: department,
    threads,
    selectedThreadId,
    messages
  };
}

export function subscribeChatThreads(user, department, callback) {
  if (shouldUseDemoData()) {
    return demoImmediateSubscription(callback, getRelevantDemoThreads(user, department));
  }

  const ref = collection(db, 'chat_threads');
  let q;
  if (isAdminLike(safeRole(user))) {
    q = query(ref, orderBy('updatedAt', 'desc'), limit(50));
  } else if (isStaffLike(safeRole(user))) {
    q = query(ref, where('department', '==', safeDept(user) || department || 'fo'), orderBy('updatedAt', 'desc'), limit(50));
  } else {
    q = query(ref, where('guestUserId', '==', user.uid), orderBy('updatedAt', 'desc'), limit(50));
  }

  return onSnapshot(q, (snapshot) => {
    let rows = mapFirestoreRows(snapshot);
    if (!isStaffLike(safeRole(user)) && department) {
      rows = rows.filter((item) => item.department === department);
    }
    callback(rows);
  });
}

export function subscribeChatMessages(threadId, callback) {
  if (!threadId) return () => {};
  if (shouldUseDemoData()) {
    const rows = demoStore.chatMessages.filter((item) => item.threadId === threadId).sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
    return demoImmediateSubscription(callback, rows);
  }

  const q = query(collection(db, 'chat_messages'), where('threadId', '==', threadId), orderBy('createdAt', 'asc'), limit(200));
  return onSnapshot(q, (snapshot) => callback(mapFirestoreRows(snapshot)));
}

export async function sendChatMessage(user, payload) {
  if (!user?.uid) throw new Error('Missing profile.');
  const text = String(payload.message || '').trim();
  if (!text) throw new Error('Please enter a message.');

  const senderType = isStaffLike(safeRole(user)) ? 'staff' : 'guest';
  let threadId = payload.threadId || null;
  let threadData = null;

  if (!threadId) {
    const department = payload.department || 'fo';
    const existing = await findExistingGuestThread(user, department);
    if (existing) {
      threadId = existing.id;
      threadData = existing;
    } else {
      const baseThread = {
        roomNo: user.roomNo || null,
        guestUserId: user.uid,
        guestName: user.displayName || user.firstName || 'Guest',
        department,
        subject: payload.subject || `Chat with ${titleize(department)}`,
        status: 'open',
        assignedTo: null,
        assignedToName: null,
        lastMessage: text,
        lastMessageAt: hasFirebaseConfig && db ? serverTimestamp() : Date.now(),
        createdAt: hasFirebaseConfig && db ? serverTimestamp() : Date.now(),
        updatedAt: hasFirebaseConfig && db ? serverTimestamp() : Date.now()
      };

      if (shouldUseDemoData()) {
        const newThread = { id: `demo-th-${Date.now()}`, ...baseThread, lastMessageAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now() };
        demoStore.chatThreads.unshift(newThread);
        threadId = newThread.id;
        threadData = newThread;
      } else {
        const ref = await addDoc(collection(db, 'chat_threads'), baseThread);
        threadId = ref.id;
        threadData = { id: ref.id, ...baseThread };
      }
    }
  }

  const messageRecord = {
    threadId,
    senderType,
    senderId: user.uid,
    senderName: user.displayName || user.email || 'User',
    message: text,
    attachments: [],
    createdAt: hasFirebaseConfig && db ? serverTimestamp() : Date.now(),
    readBy: [user.uid]
  };

  if (shouldUseDemoData()) {
    const demoMsg = { id: `demo-msg-${Date.now()}`, ...messageRecord, createdAt: Date.now() };
    demoStore.chatMessages.push(demoMsg);
    const thread = demoStore.chatThreads.find((row) => row.id === threadId);
    if (thread) {
      thread.lastMessage = text;
      thread.lastMessageAt = Date.now();
      thread.updatedAt = Date.now();
      thread.status = thread.status === 'closed' ? 'open' : thread.status;
      const targetUserId = senderType === 'guest' ? 'demo-staff' : thread.guestUserId;
      buildDemoNotification(targetUserId, { type: 'chat_message', title: senderType === 'guest' ? 'New guest message' : 'New reply from staff', body: text, referenceType: 'chat_thread', referenceId: threadId, clickRoute: 'chat' });
    }
    return { threadId, messageId: demoMsg.id };
  }

  const messageRef = await addDoc(collection(db, 'chat_messages'), messageRecord);
  await updateDoc(doc(db, 'chat_threads', threadId), {
    lastMessage: text,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: 'open',
    guestName: threadData?.guestName || user.displayName || user.firstName || 'Guest',
    roomNo: threadData?.roomNo || user.roomNo || null
  });

  return { threadId, messageId: messageRef.id };
}

export async function updateChatThread(user, threadId, patch = {}) {
  if (!threadId) throw new Error('Missing thread id.');
  const payload = {
    updatedAt: hasFirebaseConfig && db ? serverTimestamp() : Date.now()
  };

  if (patch.action === 'assign') {
    payload.assignedTo = user.uid;
    payload.assignedToName = user.displayName || user.email || 'Staff';
    payload.status = 'assigned';
  }

  if (patch.action === 'close') {
    payload.status = 'closed';
  }

  if (patch.action === 'reopen') {
    payload.status = 'open';
  }

  if (shouldUseDemoData()) {
    const thread = demoStore.chatThreads.find((row) => row.id === threadId);
    if (!thread) return null;
    Object.assign(thread, { ...payload, updatedAt: Date.now() });
    if (patch.action === 'close' || patch.action === 'assign' || patch.action === 'reopen') {
      buildDemoNotification(thread.guestUserId, { type: 'chat_status', title: 'Conversation updated', body: `Chat is now ${titleize(thread.status || patch.action)}.`, referenceType: 'chat_thread', referenceId: threadId, clickRoute: 'chat' });
    }
    return thread;
  }

  await updateDoc(doc(db, 'chat_threads', threadId), payload);
  return true;
}

export async function loadNotificationSnapshot(user) {
  if (!user?.uid) return { items: [], unreadCount: 0 };

  if (shouldUseDemoData()) {
    const items = getDemoNotificationsForUser(user).slice(0, 50);
    return { items, unreadCount: items.filter((item) => !item.isRead).length };
  }

  const items = await readCollection('notifications', {
    where: [{ field: 'targetUserId', op: '==', value: user.uid }],
    orderBy: { field: 'createdAt', dir: 'desc' },
    limit: 50
  }).catch(() => []);

  return { items, unreadCount: items.filter((item) => !item.isRead).length };
}

export function subscribeNotifications(user, callback) {
  if (!user?.uid) return () => {};
  if (shouldUseDemoData()) {
    return demoImmediateSubscription(callback, getDemoNotificationsForUser(user));
  }

  const q = query(
    collection(db, 'notifications'),
    where('targetUserId', '==', user.uid),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(q, (snapshot) => callback(mapFirestoreRows(snapshot)));
}

export async function markNotificationRead(notificationId) {
  if (!notificationId) return false;
  if (shouldUseDemoData()) {
    const item = demoStore.notifications.find((row) => row.id === notificationId);
    if (!item) return false;
    item.isRead = true;
    item.readAt = Date.now();
    return true;
  }
  await updateDoc(doc(db, 'notifications', notificationId), {
    isRead: true,
    readAt: serverTimestamp()
  });
  return true;
}

export async function markAllNotificationsRead(user) {
  if (!user?.uid) return false;
  if (shouldUseDemoData()) {
    demoStore.notifications.forEach((item) => {
      if (item.targetUserId === user.uid && !item.isRead) {
        item.isRead = true;
        item.readAt = Date.now();
      }
    });
    return true;
  }

  try {
    await markAllNotificationsReadCallable();
    return true;
  } catch {
    const unread = await readCollection('notifications', {
      where: [
        { field: 'targetUserId', op: '==', value: user.uid },
        { field: 'isRead', op: '==', value: false }
      ],
      orderBy: { field: 'createdAt', dir: 'desc' },
      limit: 50
    }).catch(() => []);
    await Promise.all(unread.map((item) => updateDoc(doc(db, 'notifications', item.id), { isRead: true, readAt: serverTimestamp() })));
    return true;
  }
}

export async function createNotification(record) {
  if (shouldUseDemoData()) return null;
  const ref = await addDoc(collection(db, 'notifications'), {
    ...record,
    isRead: false,
    createdAt: serverTimestamp()
  });
  return ref.id;
}
