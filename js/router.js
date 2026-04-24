import { isAdminLike, isStaffLike } from './utils/helpers.js';
import { renderHomePage } from './pages/home-page.js';
import { renderMemberPage } from './pages/member-page.js';
import { renderRedeemPage } from './pages/redeem-page.js';
import { renderSettingsPage } from './pages/settings-page.js';
import { renderAdminDashboardPage } from './pages/admin-dashboard-page.js';
import { renderScanCenterPage } from './pages/scan-center-page.js';
import { renderHkRequestPage } from './pages/hk-request-page.js';
import { renderTowelPage } from './pages/towel-page.js';
import { renderChatPage } from './pages/chat-page.js';
import { renderNotificationsPage } from './pages/notifications-page.js';
import { renderCardToolsPage } from './pages/card-tools-page.js';
const titles = { home: 'Home', member: 'Member', redeem: 'Redeem', hk: 'HK Request', towel: 'Towel Borrow', chat: 'Department Chat', notifications: 'Notifications', scan: 'Scan Center', admin: 'Admin Dashboard', cardtools: 'Card Studio', settings: 'Settings' };
export function getAllowedRoutes(user = {}) { const routes = ['home', 'member', 'redeem', 'hk', 'towel', 'chat', 'notifications']; if (isStaffLike(user.role)) routes.push('scan'); if (isAdminLike(user.role)) routes.push('admin', 'cardtools'); routes.push('settings'); return routes; }
export function getRouteFromHash(user = {}) { const route = location.hash.replace('#', '') || 'home'; return getAllowedRoutes(user).includes(route) ? route : 'home'; }
export function getRouteTitle(route) { return titles[route] || 'Home'; }
export function renderRoute(route, user, snapshot = {}, appContext = {}) { switch (route) { case 'member': return renderMemberPage(user, snapshot); case 'redeem': return renderRedeemPage(user, snapshot); case 'hk': return renderHkRequestPage(user, snapshot); case 'towel': return renderTowelPage(user, snapshot); case 'chat': return renderChatPage(user, snapshot); case 'notifications': return renderNotificationsPage(user, snapshot); case 'scan': return renderScanCenterPage(user, snapshot); case 'admin': return renderAdminDashboardPage(user, snapshot); case 'cardtools': return renderCardToolsPage(user, snapshot); case 'settings': return renderSettingsPage(user, appContext); case 'home': default: return renderHomePage(user, snapshot); } }
