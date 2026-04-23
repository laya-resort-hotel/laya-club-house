export const demoUsers = {
  member: { uid: 'demo-member', role: 'member', department: null, displayName: 'Noi Member', firstName: 'Noi', lastName: 'Member', cardType: 'team_member', cardColor: 'white', cardTheme: 'team_white', cardLevel: 3, language: 'en', roomNo: null, status: 'active', balance: 1450, points: 2380, email: 'member@demo.local' },
  guest: { uid: 'demo-guest', role: 'guest', department: null, displayName: 'Room D101', firstName: 'Guest', lastName: 'D101', cardType: 'guest_point', cardColor: 'red', cardTheme: 'guest_red', cardLevel: 0, language: 'en', roomNo: 'D101', status: 'active', balance: 900, points: 1260, email: 'guest@demo.local' },
  staff: { uid: 'demo-staff', role: 'staff', department: 'fo', displayName: 'FO Staff', firstName: 'FO', lastName: 'Staff', cardType: 'team_member', cardColor: 'white', cardTheme: 'team_white', cardLevel: 3, language: 'en', roomNo: null, status: 'active', balance: 0, points: 0, email: 'staff@demo.local' },
  admin: { uid: 'demo-admin', role: 'admin', department: 'admin', displayName: 'Admin User', firstName: 'Admin', lastName: 'User', cardType: 'manager', cardColor: 'bronze', cardTheme: 'manager_bronze', cardLevel: 5, language: 'en', roomNo: null, status: 'active', balance: 5000, points: 9999, email: 'admin@demo.local' }
};
export const demoRewards = [
  { id: 'rw1', title: 'Free Mocktail', pointsRequired: 500, stock: 20, category: 'beverage', active: true },
  { id: 'rw2', title: 'Late Check-out 2 PM', pointsRequired: 1200, stock: 8, category: 'benefit', active: true },
  { id: 'rw3', title: 'Coffee & Cake Set', pointsRequired: 800, stock: 12, category: 'dining', active: true }
];
export const demoTransactions = [
  { id: 'tx1', title: 'Restaurant spend', type: 'deduct', amount: -280, at: 'Today 13:45', createdAt: Date.now() - 3600000 },
  { id: 'tx2', title: 'Top-up counter', type: 'topup', amount: 1000, at: 'Yesterday 18:20', createdAt: Date.now() - 86400000 },
  { id: 'tx3', title: 'Points earned', type: 'earn', amount: 250, at: 'Yesterday 12:10', createdAt: Date.now() - 90000000 }
];
export const demoServiceLinks = [
  { id: 'food_to_room', key: 'food_to_room', title: 'Order to room', description: 'External food ordering link placeholder for future integration.', url: '#', active: true },
  { id: 'towel_borrow', key: 'towel_borrow', title: 'Borrow towel', description: 'Request towels for room front or gym pickup flow.', url: '#towel', active: true },
  { id: 'department_chat', key: 'department_chat', title: 'Chat departments', description: 'Realtime chat shortcut for FO, HK, Engineering, F&B, or Fitness.', url: '#chat', active: true },
  { id: 'hk_request', key: 'hk_request', title: 'HK request', description: 'Request pillows, blankets, water, tea, coffee, and more.', url: '#hk', active: true }
];
export const demoNotices = [
  { id: 'notice1', title: 'Welcome to the starter', body: 'Connect Firestore collections for live notices, service links, and requests.' },
  { id: 'notice2', title: 'Admin dashboard ready', body: 'Open Admin and Chat routes to monitor live service activity.' }
];
export const demoCards = {
  'GC-000001': { cardId: 'CARD-000001', cardNumber: 'GC-000001', qrValue: 'LAYA-CARD-GC-000001', userId: 'demo-guest', displayName: 'Room D101', cardType: 'guest_point', cardTheme: 'guest_red', roomNo: 'D101', balance: 900, points: 1260 },
  'TM-000123': { cardId: 'CARD-000123', cardNumber: 'TM-000123', qrValue: 'LAYA-CARD-TM-000123', userId: 'demo-member', displayName: 'Noi Member', cardType: 'team_member', cardTheme: 'team_white', roomNo: null, balance: 1450, points: 2380 }
};
export const demoScanRequests = [
  { id: 'sr1', mode: 'topup', code: 'GC-000001', targetDisplayName: 'Room D101', status: 'pending', amount: 500, pointAmount: 0, createdAt: Date.now() - 1000 * 60 * 14, operatorName: 'FO Staff' },
  { id: 'sr2', mode: 'redeem_use', code: 'RW-20260422-0001', targetDisplayName: 'Noi Member', status: 'completed', amount: 0, pointAmount: 0, createdAt: Date.now() - 1000 * 60 * 44, operatorName: 'Admin User' }
];
export const demoHkRequests = [
  { id: 'hk1', roomNo: 'D101', userId: 'demo-guest', guestName: 'Room D101', items: [{ key: 'pillow', label: 'Pillow', qty: 2 }, { key: 'water', label: 'Water', qty: 4 }], note: 'Please deliver after 6 PM.', status: 'accepted', assignedTo: 'demo-staff', assignedToName: 'FO Staff', createdAt: Date.now() - 1000 * 60 * 22, updatedAt: Date.now() - 1000 * 60 * 10 }
];
export const demoTowelRequests = [
  { id: 'tw1', roomNo: 'D101', userId: 'demo-guest', guestName: 'Room D101', location: 'gym', qty: 2, status: 'borrowed', borrowedAt: Date.now() - 1000 * 60 * 18, returnedAt: null, processedBy: 'demo-staff', returnProcessedBy: null, note: 'Gym counter' }
];
export const demoChatThreads = [
  { id: 'th1', roomNo: 'D101', guestUserId: 'demo-guest', guestName: 'Room D101', department: 'hk', subject: 'Need extra pillow', status: 'open', assignedTo: 'demo-staff', assignedToName: 'FO Staff', lastMessage: 'Can you send one more pillow please?', lastMessageAt: Date.now() - 1000 * 60 * 4, createdAt: Date.now() - 1000 * 60 * 25, updatedAt: Date.now() - 1000 * 60 * 4 }
];
export const demoChatMessages = [
  { id: 'msg1', threadId: 'th1', senderType: 'guest', senderId: 'demo-guest', senderName: 'Room D101', message: 'Hello HK, can you send one more pillow please?', createdAt: Date.now() - 1000 * 60 * 6 },
  { id: 'msg2', threadId: 'th1', senderType: 'staff', senderId: 'demo-staff', senderName: 'FO Staff', message: 'Received. We will arrange delivery shortly.', createdAt: Date.now() - 1000 * 60 * 4 }
];
export const demoNotifications = [
  { id: 'nt1', targetUserId: 'demo-guest', type: 'chat_message', title: 'New reply from Housekeeping', body: 'Received. We will arrange delivery shortly.', referenceType: 'chat_thread', referenceId: 'th1', clickRoute: 'chat', isRead: false, createdAt: Date.now() - 1000 * 60 * 3 },
  { id: 'nt2', targetUserId: 'demo-staff', type: 'hk_request', title: 'New HK request', body: 'Room D101 requested Pillow x2 and Water x4.', referenceType: 'hk_request', referenceId: 'hk1', clickRoute: 'hk', isRead: false, createdAt: Date.now() - 1000 * 60 * 9 },
  { id: 'nt3', targetUserId: 'demo-admin', type: 'scan_request', title: 'Pending scan request', body: 'A top-up request is waiting for approval.', referenceType: 'scan_request', referenceId: 'sr1', clickRoute: 'admin', isRead: true, readAt: Date.now() - 1000 * 60 * 6, createdAt: Date.now() - 1000 * 60 * 13 }
];

export const demoCardThemes = [
  { id: 'theme-excom-gold', key: 'excom_gold', title: 'Excom Gold Signature', cardColor: 'gold', gradientFrom: '#8b6a1b', gradientTo: '#e3c170', accentColor: '#fff1b8', textColor: '#fff8ef', secondaryTextColor: 'rgba(255,248,239,0.82)', logoText: 'EXCOM', footerText: 'Executive Access', sortOrder: 1, active: true },
  { id: 'theme-hod-silver', key: 'hod_silver', title: 'HOD Silver Elite', cardColor: 'silver', gradientFrom: '#66727d', gradientTo: '#d3dae0', accentColor: '#ffffff', textColor: '#f7fafc', secondaryTextColor: 'rgba(247,250,252,0.84)', logoText: 'HOD', footerText: 'Senior Leadership', sortOrder: 2, active: true },
  { id: 'theme-manager-bronze', key: 'manager_bronze', title: 'Manager Bronze', cardColor: 'bronze', gradientFrom: '#6c4326', gradientTo: '#c98d59', accentColor: '#f7d2a7', textColor: '#fff6ee', secondaryTextColor: 'rgba(255,246,238,0.82)', logoText: 'MANAGER', footerText: 'Operations Access', sortOrder: 3, active: true },
  { id: 'theme-team-white', key: 'team_white', title: 'Team Member White', cardColor: 'white', gradientFrom: '#d9d2ca', gradientTo: '#faf6f0', accentColor: '#8b6a1b', textColor: '#2e2419', secondaryTextColor: 'rgba(46,36,25,0.72)', logoText: 'TEAM', footerText: 'Employee Card', sortOrder: 4, active: true },
  { id: 'theme-fitness-black', key: 'fitness_black', title: 'Fitness Black Night', cardColor: 'black', gradientFrom: '#111111', gradientTo: '#3a3a3a', accentColor: '#d8d8d8', textColor: '#f9fafb', secondaryTextColor: 'rgba(249,250,251,0.78)', logoText: 'FITNESS', footerText: 'Guest Access', sortOrder: 5, active: true },
  { id: 'theme-guest-red', key: 'guest_red', title: 'Guest Point Red', cardColor: 'red', gradientFrom: '#5a1220', gradientTo: '#b82d45', accentColor: '#ffd4dc', textColor: '#fff8ef', secondaryTextColor: 'rgba(255,248,239,0.82)', logoText: 'GUEST', footerText: 'Reward Member', sortOrder: 6, active: true }
];
