import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";
import { functions, hasFirebaseConfig } from '../firebase-init.js';

function assertCallableReady(name) {
  if (!hasFirebaseConfig || !functions) throw new Error(`${name} is not available because Firebase Functions is not connected.`);
}

async function invokeCallable(name, payload) {
  assertCallableReady(name);
  const callable = httpsCallable(functions, name);
  const response = await callable(payload || {});
  return response?.data || null;
}

export async function requestRewardRedemptionCallable(rewardId) { return invokeCallable('requestRewardRedemption', { rewardId }); }
export async function processScanRequestCallable(scanRequestId, action = 'approve', note = '') { return invokeCallable('processScanRequest', { scanRequestId, action, note }); }
export async function createGuestPortalSessionCallable(payload) { return invokeCallable('createGuestPortalSession', payload); }
export async function topUpWalletCallable(payload) { return invokeCallable('topUpWallet', payload); }
export async function deductWalletCallable(payload) { return invokeCallable('deductWallet', payload); }
export async function earnPointsCallable(payload) { return invokeCallable('earnPoints', payload); }
export async function fulfillRedemptionCallable(payload) { return invokeCallable('fulfillRedemption', payload); }
export async function registerPushTokenCallable(payload) { return invokeCallable('registerPushToken', payload); }
export async function markAllNotificationsReadCallable() { return invokeCallable('markAllNotificationsRead', {}); }
export async function createManagedAuthUserCallable(payload) { return invokeCallable('createManagedAuthUser', payload); }
export async function deleteManagedAuthUserCallable(payload) { return invokeCallable('deleteManagedAuthUser', payload); }
export async function reportMonitoringEventCallable(payload) { return invokeCallable('reportMonitoringEvent', payload); }
