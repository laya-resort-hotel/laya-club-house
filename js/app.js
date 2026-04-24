import { appRuntimeConfig, runtimeProjectId, runtimeLabel } from './firebase-init.js';
import { getStoredSession, logout } from './auth/auth-service.js';
import { appState } from './state.js';
import { renderBottomNav } from './components/bottom-nav.js';
import { getRouteFromHash, getRouteTitle, renderRoute } from './router.js';
import {
  createHkRequest,
  createScanRequest,
  createTowelRequest,
  deleteContentBanner,
  deleteContentLink,
  deleteMemberProfile,
  deleteReward,
  deleteCardTheme,
  findCardByCode,
  loadAdminDashboardSnapshot,
  loadCardToolsSnapshot,
  loadChatSnapshot,
  loadHkSnapshot,
  loadHomeSnapshot,
  loadMemberSnapshot,
  loadNotificationSnapshot,
  loadRedeemSnapshot,
  loadScanSnapshot,
  loadTowelSnapshot,
  markAllNotificationsRead,
  markNotificationRead,
  requestRewardRedemption,
  saveContentBanner,
  saveContentLink,
  saveMemberProfile,
  saveReward,
  saveCardTheme,
  sendChatMessage,
  subscribeChatMessages,
  subscribeChatThreads,
  subscribeHkRequests,
  subscribeNotifications,
  subscribeTowelRequests,
  updateChatThread,
  updateHkRequestStatus,
  updateScanRequestStatus,
  updateTowelRequestStatus
} from './services/data-service.js';
import { subscribeForegroundPush, requestPushPermissionAndRegister } from './services/notification-service.js';
import { createManagedAuthUserCallable, deleteManagedAuthUserCallable } from './services/function-service.js';
import { uploadBannerImage, uploadProfileImage, uploadRewardImage } from './services/storage-service.js';
import { initGlobalMonitoring, reportHandledError, reportOperationalEvent } from './services/monitoring-service.js';
import { startQrScanner, stopQrScanner as stopScannerEngine, scannerCapabilities } from './services/scanner-service.js';
import { renderChatMessages, renderChatThreadList } from './pages/chat-page.js';
import { renderHkRequestList } from './pages/hk-request-page.js';
import { renderTowelList } from './pages/towel-page.js';
import { clearAppCache, installServiceWorker, isStaffLike, playAlertTone, qs, qsa, toMillis } from './utils/helpers.js';
import { createQrSvgDataUrl } from './utils/qrcode.js';
import { runBusyAction, setButtonBusy } from './services/ui-feedback.js';
import {
  validateCardThemePayload,
  validateChatPayload,
  validateContentBannerPayload,
  validateContentLinkPayload,
  validateHkRequestPayload,
  validateMemberPayload,
  validateRewardPayload,
  validateScanPayload,
  validateTowelRequestPayload
} from './utils/validation.js';

installServiceWorker();
const session = getStoredSession();
if (!session) location.href = './login.html';
appState.session = session;
appState.user = session.profile || {};
appState.projectId = runtimeProjectId;
appState.projectMode = session.mode || String(appRuntimeConfig.deploymentStage || 'production');
appState.appVersion = appRuntimeConfig.appVersion;
appState.currentRoute = getRouteFromHash(appState.user);
appState.chatState = appState.chatState || { selectedDepartment: appState.user.department || 'fo', selectedThreadId: null, lastThreadsAlertTs: 0, lastMessagesAlertTs: 0 };
appState.notificationState = appState.notificationState || { items: [], unreadCount: 0, lastAlertTs: 0, subscribed: false, pushEnabled: false, pushReason: '' };
appState.cardToolsState = appState.cardToolsState || { selectedIds: [] };
const pageRoot = qs('#page-root');
const titleNode = qs('#screen-title');
const bottomNav = qs('#bottom-nav');
const headerAction = qs('#header-action');
const headerActionBadge = qs('#header-action-badge');
const runtimeBadge = qs('#runtime-project');
const profileBadge = qs('#profile-badge');
const toastStack = qs('#toast-stack');
const appBanner = qs('#app-banner');
const networkBadge = qs('#network-badge');
const routeLoaders = { home: () => loadHomeSnapshot(appState.user), member: () => loadMemberSnapshot(appState.user), redeem: () => loadRedeemSnapshot(appState.user), hk: () => loadHkSnapshot(appState.user), towel: () => loadTowelSnapshot(appState.user), chat: () => loadChatSnapshot(appState.user, appState.chatState?.selectedDepartment || appState.user.department || 'fo'), notifications: () => loadNotificationSnapshot(appState.user), scan: () => loadScanSnapshot(appState.user), admin: () => loadAdminDashboardSnapshot(appState.user), cardtools: () => loadCardToolsSnapshot(appState.user), settings: async () => ({}) };
let routeCleanupFns = [];
function cleanupRouteResources(){ routeCleanupFns.forEach((fn)=>{ try{ fn?.(); }catch{} }); routeCleanupFns=[]; }
function registerCleanup(fn){ if(typeof fn==='function') routeCleanupFns.push(fn); }
function stopQrScanner(){ stopScannerEngine().catch(()=>{}); }
function renderNav(){ bottomNav.innerHTML = renderBottomNav(appState.currentRoute, appState.user, { notifications: appState.notificationState.unreadCount }); }
function paintHeader(){ if(runtimeBadge) runtimeBadge.textContent=`${runtimeLabel} • ${appState.projectId}`; if(profileBadge) profileBadge.textContent=`${appState.user.displayName || 'Member'} • ${appState.user.role || 'member'}`; if(headerActionBadge){ const unread=Number(appState.notificationState.unreadCount||0); headerActionBadge.hidden=unread<=0; headerActionBadge.textContent= unread>99 ? '99+' : String(unread);} }
function showToast(title, body=''){ if(!toastStack) return; const node=document.createElement('article'); node.className='toast'; node.innerHTML=`<strong>${title}</strong><p>${body}</p>`; toastStack.prepend(node); setTimeout(()=>node.remove(), 4500); }
function showBanner(message='', type='warning'){ if(!appBanner) return; if(!message){ appBanner.hidden=true; appBanner.textContent=''; appBanner.className='app-banner'; return; } appBanner.hidden=false; appBanner.textContent=message; appBanner.className=`app-banner ${type}`; }
function updateNetworkBadge(){ if(!networkBadge) return; const online=navigator.onLine!==false; networkBadge.textContent=online ? 'Online' : 'Offline'; networkBadge.className=`badge badge-status ${online ? 'is-online' : 'is-offline'}`; if(!online) showBanner('You are offline. Realtime updates and save actions may fail until the connection is restored.', 'warning'); else if(appBanner?.textContent?.includes('offline')) showBanner(''); }
function handleUiError(context, error, extra={}){ reportHandledError(context, error, { route: appState.currentRoute, userId: appState.user?.uid || null, role: appState.user?.role || null, ...extra }); return error?.message || 'Something went wrong.'; }
function promptForDelete(label, keyword='DELETE'){ const response=window.prompt(`This action is destructive. Type ${keyword} to continue deleting ${label}.`); return String(response || '').trim().toUpperCase()===keyword; }
initGlobalMonitoring(() => ({ route: appState.currentRoute, role: appState.user?.role || null, userId: appState.user?.uid || null }));
updateNetworkBadge();
window.addEventListener('online', updateNetworkBadge);
window.addEventListener('offline', updateNetworkBadge);
async function startGlobalNotificationStreams(){ if(appState.notificationState.subscribed) return; appState.notificationState.subscribed=true; subscribeNotifications(appState.user, async (items)=>{ const firstLoad = appState.notificationState.lastAlertTs===0; appState.notificationState.items=items; appState.notificationState.unreadCount=items.filter((item)=>!item.isRead).length; paintHeader(); renderNav(); const latestUnread=items.find((item)=>!item.isRead); const latestTs=toMillis(latestUnread?.createdAt); if(latestTs && latestTs>(appState.notificationState.lastAlertTs||0)){ appState.notificationState.lastAlertTs=latestTs; if(!firstLoad){ await playAlertTone({ times:2, frequency:860 }); showToast(latestUnread.title || 'New notification', latestUnread.body || 'Open notifications to review it.'); }}}); const unsubscribePush = await subscribeForegroundPush(async (payload)=>{ const title=payload?.notification?.title || payload?.data?.title || 'LAYA Card Alert'; const body=payload?.notification?.body || payload?.data?.body || 'Open the app to review the latest update.'; await playAlertTone({ times:2, frequency:920 }); showToast(title, body); }).catch(()=>()=>{}); registerCleanup(unsubscribePush); }
function bindRouteButtons(scope=document){ qsa('[data-route]', scope).forEach((button)=>button.addEventListener('click', ()=>{ location.hash=button.dataset.route; })); qsa('[data-external-url]', scope).forEach((button)=>button.addEventListener('click', ()=>{ const url=button.dataset.externalUrl; if(!url || url==='#'){ showToast('Room-service link missing', 'Configure the external room-service URL in Admin content links.'); return; } window.open(url, '_blank', 'noopener'); })); }
async function bindCommonActions(){ bindRouteButtons(bottomNav); bindRouteButtons(pageRoot); qsa('.setting-item', pageRoot).forEach((row)=>{ row.addEventListener('click', async ()=>{ const text=row.textContent.trim().toLowerCase(); if(text.includes('logout')){ await logout(); location.href='./login.html'; } if(text.includes('clear cache')){ await clearAppCache(); showToast('Cache cleared', 'Reload the app to fetch the latest files.'); } if(text.includes('install app')){ showToast('Install app', 'Use the browser install prompt for this device.'); } if(text.includes('enable push')){ const result=await requestPushPermissionAndRegister(appState.user).catch((error)=>({ ok:false, reason:error?.message || 'Push setup failed.' })); appState.notificationState.pushEnabled=!!result?.ok; appState.notificationState.pushReason=result?.ok ? 'Push alerts connected' : (result?.reason || 'Push setup failed.'); showToast(result?.ok ? 'Push alerts enabled' : 'Push setup blocked', result?.ok ? 'This device is now registered for alerts.' : appState.notificationState.pushReason); if(appState.currentRoute==='settings') await mount(); } if(text.includes('check version')){ showToast('Current version', `App version ${appState.appVersion}`); } }); }); qsa('[data-reward-id]', pageRoot).forEach((button)=>{ button.addEventListener('click', async ()=>{ try{ const reward={ id:button.dataset.rewardId, title:button.dataset.rewardTitle, pointsRequired:Number(button.dataset.rewardPoints || 0)}; const result=await requestRewardRedemption(appState.user, reward); showToast('Reward ready', result?.rewardCode || 'Reward request created successfully.'); await mount(); }catch(error){ showToast('Redeem failed', error?.message || 'Unable to create redemption request.'); } }); }); }
async function startScanner(codeInput){ const video=qs('#scanner-video', pageRoot); const reader=qs('#scanner-reader', pageRoot); const statusNode=qs('#scanner-status', pageRoot); if(!video || !codeInput) return; try{ const support=scannerCapabilities(); const result=await startQrScanner({ videoEl: video, readerEl: reader, statusEl: statusNode, onCode: async (found, engine)=>{ codeInput.value=found; if(statusNode) statusNode.textContent=`Scanned via ${engine}: ${found}`; await reportOperationalEvent('scanner', 'scan_success', { engine, route:'scan' }); } }); if(statusNode){ const supportHint=support.barcodeDetector ? 'Native detector ready.' : 'Using fallback scanner engine.'; statusNode.textContent=`Scanner started (${result?.mode || 'camera'}). ${supportHint}`; } }catch(error){ if(statusNode) statusNode.textContent=handleUiError('scanner_start', error, { route:'scan' }); showToast('Scanner unavailable', error?.message || 'Unable to start scanner.'); } }
async function bindScanActions(snapshot){ const modeInput=qs('#scan-mode', pageRoot); const codeInput=qs('#scan-code', pageRoot); const amountInput=qs('#scan-amount', pageRoot); const pointsInput=qs('#scan-points', pageRoot); const noteInput=qs('#scan-note', pageRoot); const locationInput=qs('#scan-location', pageRoot); const form=qs('#scan-form', pageRoot); const lookupBtn=qs('#lookup-card-btn', pageRoot); const startScanBtn=qs('#start-scan-btn', pageRoot); const stopScanBtn=qs('#stop-scan-btn', pageRoot); qsa('[data-mode]', pageRoot).forEach((button)=>button.addEventListener('click', ()=>{ qsa('[data-mode]', pageRoot).forEach((node)=>node.classList.remove('is-active')); button.classList.add('is-active'); if(modeInput) modeInput.value=button.dataset.mode; })); startScanBtn?.addEventListener('click', async ()=>{ await startScanner(codeInput); }); stopScanBtn?.addEventListener('click', async ()=>{ await stopQrScanner(); const statusNode=qs('#scanner-status', pageRoot); if(statusNode) statusNode.textContent='Scanner stopped.'; }); lookupBtn?.addEventListener('click', async ()=>{ try{ setButtonBusy(lookupBtn, true, { busyText:'Looking up...' }); const preview=await findCardByCode(codeInput?.value || ''); if(!preview){ showToast('Card not found', 'No card or QR value matched that code.'); return; } appState.lastSnapshot={ ...(snapshot||{}), preview }; pageRoot.innerHTML=renderRoute('scan', appState.user, appState.lastSnapshot, appState); await bindCommonActions(); await bindScanActions(appState.lastSnapshot); }catch(error){ showToast('Lookup failed', handleUiError('scan_lookup', error, { code:codeInput?.value || '' })); } finally { setButtonBusy(lookupBtn, false); } }); form?.addEventListener('submit', async (event)=>{ event.preventDefault(); const submitButton=form?.querySelector('button[type="submit"]'); try{ validateScanPayload({ mode: modeInput?.value || 'topup', code: codeInput?.value || '', amount: amountInput?.value, pointAmount: pointsInput?.value, location: locationInput?.value || 'room_front', note: noteInput?.value || '' }); const preview=appState.lastSnapshot?.preview || null; await runBusyAction({ form, button: submitButton, busyText:'Submitting...', action: async ()=>{ await createScanRequest(appState.user, { mode: modeInput?.value || 'topup', code: codeInput?.value || '', amount:Number(amountInput?.value || 0), pointAmount:Number(pointsInput?.value || 0), note: noteInput?.value || '', location: locationInput?.value || 'room_front', roomNo: preview?.roomNo || null, targetCardId: preview?.cardId || null, targetUserId: preview?.userId || null, targetDisplayName: preview?.displayName || '' }); await reportOperationalEvent('scan_request', 'created', { mode: modeInput?.value || 'topup' }); } }); showToast('Scan request created', 'Use Process to apply it via Cloud Functions.'); await mount(); }catch(error){ showToast('Scan request failed', handleUiError('scan_request_create', error, { mode: modeInput?.value || 'topup' })); } }); qsa('[data-scan-action]', pageRoot).forEach((button)=>button.addEventListener('click', async ()=>{ try{ const action=button.dataset.scanAction; await updateScanRequestStatus(button.dataset.scanId, action, action==='reject' ? 'Rejected from UI' : 'Processed from UI'); await reportOperationalEvent('scan_request', action, { scanRequestId:button.dataset.scanId }); await mount(); }catch(error){ showToast('Scan update failed', handleUiError('scan_request_update', error, { scanRequestId:button.dataset.scanId, action:button.dataset.scanAction })); } })); }
async function bindAdminActions(){
  qsa('[data-scan-action]', pageRoot).forEach((button)=>button.addEventListener('click', async ()=>{
    try{
      const action=button.dataset.scanAction;
      await updateScanRequestStatus(button.dataset.scanId, action, action==='reject' ? 'Rejected from admin dashboard' : 'Processed from admin dashboard');
      await mount();
    }catch(error){
      showToast('Scan update failed', error?.message || 'Unable to update scan request.');
    }
  }));

  const memberForm=qs('#admin-member-form', pageRoot);
  const rewardForm=qs('#admin-reward-form', pageRoot);
  const linkForm=qs('#admin-content-link-form', pageRoot);
  const bannerForm=qs('#admin-banner-form', pageRoot);
  const themeForm=qs('#admin-card-theme-form', pageRoot);

  const makeLocalId = (prefix='id') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const setPreview = (form, key, url='')=>{
    const box=qs(`[data-preview-for="${key}"]`, form);
    if(!box) return;
    box.innerHTML = url ? `<img class="admin-thumb admin-thumb-large" src="${url}" alt="${key}">` : '<div class="admin-thumb admin-thumb-placeholder admin-thumb-large">No image</div>';
  };
  const fillForm = (form, payload={})=>{
    if(!form) return;
    qsa('[name]', form).forEach((input)=>{
      const key=input.name;
      if(!key) return;
      if(input.type==='file') return;
      if(input.type==='checkbox') input.checked=!!payload[key];
      else input.value=payload[key] ?? '';
    });
    if(form===memberForm){
      setPreview(form, 'photo', payload.photoURL || '');
      const authToggle = qs('[name="createAuthUser"]', form);
      if(authToggle) authToggle.checked = false;
      const pwd = qs('[name="authPassword"]', form);
      if(pwd) pwd.value='';
    }
    if(form===rewardForm) setPreview(form, 'image', payload.imageUrl || payload.imageURL || '');
    if(form===bannerForm) setPreview(form, 'image', payload.imageUrl || payload.imageURL || '');
  };
  const resetForm = (form, type='')=>{
    if(!form) return;
    form.reset();
    qsa('input[type="hidden"]', form).forEach((input)=>{ input.value=''; });
    qsa('input[type="file"]', form).forEach((input)=>{ input.value=''; });
    if(type==='member') setPreview(form, 'photo', '');
    if(type==='reward' || type==='content_banner') setPreview(form, 'image', '');
  };
  const formPayload = (form)=>Object.fromEntries(new FormData(form).entries());

  qs('[name="photoFile"]', memberForm)?.addEventListener('change', (event)=>{
    const file=event.target.files?.[0];
    if(file) setPreview(memberForm, 'photo', URL.createObjectURL(file));
  });
  qs('[name="imageFile"]', rewardForm)?.addEventListener('change', (event)=>{
    const file=event.target.files?.[0];
    if(file) setPreview(rewardForm, 'image', URL.createObjectURL(file));
  });
  qs('[name="imageFile"]', bannerForm)?.addEventListener('change', (event)=>{
    const file=event.target.files?.[0];
    if(file) setPreview(bannerForm, 'image', URL.createObjectURL(file));
  });

  memberForm?.addEventListener('submit', async (event)=>{
    event.preventDefault();
    try{
      const payload=formPayload(memberForm);
      payload.createAuthUser = qs('[name="createAuthUser"]', memberForm)?.checked;
      payload.hasAuthAccount = payload.hasAuthAccount || false;
      payload.authManaged = payload.authManaged || false;
      validateMemberPayload(payload);
      if(payload.createAuthUser && !payload.uid){
        const authResult = await createManagedAuthUserCallable(payload);
        payload.uid = authResult?.uid;
        payload.hasAuthAccount = true;
        payload.authManaged = true;
      }
      const profileFile = qs('[name="photoFile"]', memberForm)?.files?.[0];
      if(profileFile){
        if(!payload.uid) throw new Error('Save or create the member account before uploading a profile image.');
        const uploaded = await uploadProfileImage(payload.uid, profileFile);
        payload.photoURL = uploaded?.downloadURL || '';
        payload.photoStoragePath = uploaded?.storagePath || '';
      }
      delete payload.createAuthUser;
      delete payload.authPassword;
      await saveMemberProfile(appState.user, payload);
      await reportOperationalEvent('admin_member', payload.uid ? 'updated' : 'created', { targetUid: payload.uid || null });
      resetForm(memberForm, 'member');
      await mount();
    }catch(error){
      showToast('Member save failed', handleUiError('admin_member_save', error));
    }
  });

  rewardForm?.addEventListener('submit', async (event)=>{
    event.preventDefault();
    try{
      const payload=formPayload(rewardForm);
      payload.active=qs('[name="active"]', rewardForm)?.checked;
      payload.id = payload.id || makeLocalId('reward');
      validateRewardPayload(payload);
      const imageFile = qs('[name="imageFile"]', rewardForm)?.files?.[0];
      if(imageFile){
        const uploaded = await uploadRewardImage(payload.id, imageFile);
        payload.imageUrl = uploaded?.downloadURL || '';
        payload.imageStoragePath = uploaded?.storagePath || '';
      }
      await saveReward(appState.user, payload);
      await reportOperationalEvent('admin_reward', payload.id ? 'saved' : 'created', { rewardId: payload.id });
      resetForm(rewardForm, 'reward');
      await mount();
    }catch(error){
      showToast('Reward save failed', handleUiError('admin_reward_save', error));
    }
  });

  linkForm?.addEventListener('submit', async (event)=>{
    event.preventDefault();
    try{
      const payload=formPayload(linkForm);
      payload.active=qs('[name="active"]', linkForm)?.checked;
      validateContentLinkPayload(payload);
      await saveContentLink(appState.user, payload);
      await reportOperationalEvent('admin_content_link', 'saved', { key: payload.key || payload.id || null });
      resetForm(linkForm, 'content_link');
      await mount();
    }catch(error){
      showToast('Content link save failed', handleUiError('admin_content_link_save', error));
    }
  });

  bannerForm?.addEventListener('submit', async (event)=>{
    event.preventDefault();
    try{
      const payload=formPayload(bannerForm);
      payload.active=qs('[name="active"]', bannerForm)?.checked;
      payload.id = payload.id || makeLocalId('banner');
      validateContentBannerPayload(payload);
      const imageFile = qs('[name="imageFile"]', bannerForm)?.files?.[0];
      if(imageFile){
        const uploaded = await uploadBannerImage(payload.id, imageFile);
        payload.imageUrl = uploaded?.downloadURL || '';
        payload.imageStoragePath = uploaded?.storagePath || '';
      }
      await saveContentBanner(appState.user, payload);
      await reportOperationalEvent('admin_content_banner', 'saved', { bannerId: payload.id });
      resetForm(bannerForm, 'content_banner');
      await mount();
    }catch(error){
      showToast('Banner save failed', handleUiError('admin_content_banner_save', error));
    }
  });

  themeForm?.addEventListener('submit', async (event)=>{
    event.preventDefault();
    try{
      const payload=formPayload(themeForm);
      payload.active=qs('[name="active"]', themeForm)?.checked;
      validateCardThemePayload(payload);
      await saveCardTheme(appState.user, payload);
      await reportOperationalEvent('admin_card_theme', 'saved', { themeKey: payload.key || payload.id || null });
      resetForm(themeForm, 'card_theme');
      await mount();
    }catch(error){
      showToast('Card theme save failed', handleUiError('admin_card_theme_save', error));
    }
  });

  qsa('[data-admin-reset]', pageRoot).forEach((button)=>button.addEventListener('click', ()=>{
    const type=button.dataset.adminReset;
    if(type==='member') resetForm(memberForm, 'member');
    if(type==='reward') resetForm(rewardForm, 'reward');
    if(type==='content_link') resetForm(linkForm, 'content_link');
    if(type==='content_banner') resetForm(bannerForm, 'content_banner');
    if(type==='card_theme') resetForm(themeForm, 'card_theme');
  }));

  qsa('[data-admin-edit]', pageRoot).forEach((button)=>button.addEventListener('click', ()=>{
    try{
      const payload=JSON.parse(decodeURIComponent(button.dataset.adminPayload || '%7B%7D'));
      const type=button.dataset.adminEdit;
      if(type==='member') fillForm(memberForm, payload);
      if(type==='reward') fillForm(rewardForm, payload);
      if(type==='content_link') fillForm(linkForm, payload);
      if(type==='content_banner') fillForm(bannerForm, payload);
      if(type==='card_theme') fillForm(themeForm, payload);
      window.scrollTo({ top: Math.max(0, button.getBoundingClientRect().top + window.scrollY - 120), behavior: 'smooth' });
    }catch(error){
      console.error('Unable to preload admin form', error);
    }
  }));

  qsa('[data-admin-delete]', pageRoot).forEach((button)=>button.addEventListener('click', async ()=>{
    const type=button.dataset.adminDelete;
    const id=button.dataset.adminId;
    try{
      if(type==='member'){
        const hasAuth = button.dataset.adminHasAuth==='1';
        const keyword = hasAuth ? 'PURGE' : 'DELETE';
        if(!promptForDelete(`${type.replace('_',' ')} ${id}`, keyword)) return;
        if(hasAuth) await deleteManagedAuthUserCallable({ uid:id });
        else await deleteMemberProfile(appState.user, id);
      }
      if(type==='reward'){
        if(!promptForDelete('reward', 'DELETE')) return;
        await deleteReward(appState.user, id);
      }
      if(type==='content_link'){
        if(!promptForDelete('content link', 'DELETE')) return;
        await deleteContentLink(appState.user, id);
      }
      if(type==='content_banner'){
        if(!promptForDelete('content banner', 'DELETE')) return;
        await deleteContentBanner(appState.user, id);
      }
      if(type==='card_theme'){
        if(!promptForDelete('card theme', 'DELETE')) return;
        await deleteCardTheme(appState.user, id);
      }
      await reportOperationalEvent('admin_delete', type, { targetId:id });
      await mount();
    }catch(error){
      showToast('Delete failed', handleUiError('admin_delete', error, { type, targetId:id }));
    }
  }));

  qsa('[data-admin-scroll]', pageRoot).forEach((button)=>button.addEventListener('click', ()=>{
    const target=qs(`#${button.dataset.adminScroll}`, pageRoot);
    target?.scrollIntoView({ behavior:'smooth', block:'start' });
  }));
}

async function bindHkActions(snapshot){ const form=qs('#hk-request-form', pageRoot); const itemNode=qs('#hk-item', pageRoot); const qtyNode=qs('#hk-qty', pageRoot); const noteNode=qs('#hk-note', pageRoot); const countNode=qs('#hk-count-badge', pageRoot); const listNode=qs('#hk-request-list', pageRoot); const wireStatusButtons=()=>{ qsa('[data-hk-status]', pageRoot).forEach((button)=>{ button.onclick=async ()=>{ try{ await updateHkRequestStatus(appState.user, button.dataset.hkId, button.dataset.hkStatus); await reportOperationalEvent('hk_request', 'status_update', { requestId:button.dataset.hkId, status:button.dataset.hkStatus }); }catch(error){ showToast('HK update failed', handleUiError('hk_status_update', error, { requestId:button.dataset.hkId })); } }; }); }; form?.addEventListener('submit', async (event)=>{ event.preventDefault(); const submitButton=form?.querySelector('button[type="submit"]'); try{ const itemLabel=itemNode?.selectedOptions?.[0]?.textContent || 'Item'; validateHkRequestPayload({ itemKey:itemNode?.value || '', qty:qtyNode?.value || 1, note:noteNode?.value || '' }); await runBusyAction({ form, button: submitButton, busyText:'Sending...', action: async ()=>{ await createHkRequest(appState.user, { itemKey:itemNode?.value || 'other', itemLabel, qty:Number(qtyNode?.value || 1), note:noteNode?.value || '' }); await reportOperationalEvent('hk_request', 'created', { itemKey:itemNode?.value || 'other' }); } }); if(noteNode) noteNode.value=''; if(qtyNode) qtyNode.value='1'; showToast('HK request sent', 'Your request was added to the queue.'); }catch(error){ showToast('HK request failed', handleUiError('hk_create', error)); } }); registerCleanup(subscribeHkRequests(appState.user, (requests)=>{ if(countNode) countNode.textContent=`${requests.length} items`; if(listNode) listNode.innerHTML=renderHkRequestList(requests, snapshot.canManage); wireStatusButtons(); })); wireStatusButtons(); }
async function bindTowelActions(snapshot){ const form=qs('#towel-request-form', pageRoot); const locationNode=qs('#towel-location', pageRoot); const qtyNode=qs('#towel-qty', pageRoot); const noteNode=qs('#towel-note', pageRoot); const countNode=qs('#towel-count-badge', pageRoot); const listNode=qs('#towel-request-list', pageRoot); const wireStatusButtons=()=>{ qsa('[data-towel-status]', pageRoot).forEach((button)=>{ button.onclick=async ()=>{ try{ await updateTowelRequestStatus(appState.user, button.dataset.towelId, button.dataset.towelStatus); await reportOperationalEvent('towel_request', 'status_update', { requestId:button.dataset.towelId, status:button.dataset.towelStatus }); }catch(error){ showToast('Towel update failed', handleUiError('towel_status_update', error, { requestId:button.dataset.towelId })); } }; }); }; form?.addEventListener('submit', async (event)=>{ event.preventDefault(); const submitButton=form?.querySelector('button[type="submit"]'); try{ validateTowelRequestPayload({ location:locationNode?.value || 'room_front', qty:qtyNode?.value || 1, note:noteNode?.value || '' }); await runBusyAction({ form, button: submitButton, busyText:'Sending...', action: async ()=>{ await createTowelRequest(appState.user, { location:locationNode?.value || 'room_front', qty:Number(qtyNode?.value || 1), note:noteNode?.value || '' }); await reportOperationalEvent('towel_request', 'created', { location:locationNode?.value || 'room_front' }); } }); if(noteNode) noteNode.value=''; if(qtyNode) qtyNode.value='1'; showToast('Towel request sent', 'Your towel request was added to the queue.'); }catch(error){ showToast('Towel request failed', handleUiError('towel_create', error)); } }); registerCleanup(subscribeTowelRequests(appState.user, (requests)=>{ if(countNode) countNode.textContent=`${requests.length} items`; if(listNode) listNode.innerHTML=renderTowelList(requests, snapshot.canManage); wireStatusButtons(); })); wireStatusButtons(); }
async function bindChatActions(snapshot){ let currentThreadId=appState.chatState?.selectedThreadId || snapshot.selectedThreadId || null; let currentDepartment=appState.chatState?.selectedDepartment || snapshot.selectedDepartment || appState.user.department || 'fo'; let messageUnsubscribe=null; const threadListNode=qs('#chat-thread-list', pageRoot); const messageListNode=qs('#chat-message-list', pageRoot); const form=qs('#chat-message-form', pageRoot); const threadIdInput=qs('#chat-thread-id', pageRoot); const departmentInput=qs('#chat-department', pageRoot); const messageInput=qs('#chat-message-input', pageRoot); registerCleanup(()=>{ messageUnsubscribe?.(); }); const wireStaticButtons=()=>{ qsa('[data-chat-department]', pageRoot).forEach((button)=>{ button.onclick=async ()=>{ appState.chatState.selectedDepartment=button.dataset.chatDepartment; appState.chatState.selectedThreadId=null; await mount(); }; }); qsa('[data-thread-id]', pageRoot).forEach((button)=>{ button.onclick=()=>{ appState.chatState.selectedThreadId=button.dataset.threadId; if(threadIdInput) threadIdInput.value=button.dataset.threadId; if(messageUnsubscribe) messageUnsubscribe(); subscribeMessages(button.dataset.threadId); }; }); qsa('[data-chat-action]', pageRoot).forEach((button)=>{ button.onclick=async ()=>{ try{ await updateChatThread(appState.user, button.dataset.threadId, { action:button.dataset.chatAction }); await reportOperationalEvent('chat_thread', button.dataset.chatAction, { threadId:button.dataset.threadId }); }catch(error){ showToast('Chat action failed', handleUiError('chat_thread_update', error, { threadId:button.dataset.threadId })); } }; }); }; const subscribeMessages=(threadId)=>{ if(messageUnsubscribe){ messageUnsubscribe(); messageUnsubscribe=null; } currentThreadId=threadId; appState.chatState.selectedThreadId=threadId; if(threadIdInput) threadIdInput.value=threadId || ''; if(!threadId){ if(messageListNode) messageListNode.innerHTML=renderChatMessages([], appState.user.uid); return; } messageUnsubscribe=subscribeChatMessages(threadId, async (messages)=>{ if(messageListNode){ messageListNode.innerHTML=renderChatMessages(messages, appState.user.uid); messageListNode.scrollTop=messageListNode.scrollHeight; } const latestTs=toMillis(messages[messages.length-1]?.createdAt); if(isStaffLike(appState.user.role) && latestTs && latestTs>(appState.chatState.lastMessagesAlertTs || 0) && messages[messages.length-1]?.senderId !== appState.user.uid){ appState.chatState.lastMessagesAlertTs=latestTs; await playAlertTone({ times:3, frequency:920 }); } }); }; registerCleanup(subscribeChatThreads(appState.user, currentDepartment, async (threads)=>{ if(!currentThreadId || !threads.some((item)=>item.id===currentThreadId)){ currentThreadId=threads[0]?.id || null; appState.chatState.selectedThreadId=currentThreadId; } if(threadListNode) threadListNode.innerHTML=renderChatThreadList(threads, currentThreadId); wireStaticButtons(); subscribeMessages(currentThreadId); const latestTs=toMillis(threads[0]?.updatedAt || threads[0]?.lastMessageAt); if(isStaffLike(appState.user.role) && latestTs && latestTs>(appState.chatState.lastThreadsAlertTs || 0)){ appState.chatState.lastThreadsAlertTs=latestTs; if(threads[0]?.assignedTo !== appState.user.uid) await playAlertTone({ times:2, frequency:780 }); } })); form?.addEventListener('submit', async (event)=>{ event.preventDefault(); const submitButton=form?.querySelector('button[type="submit"]'); try{ validateChatPayload({ department: departmentInput?.value || currentDepartment, message: messageInput?.value || '' }); const result=await runBusyAction({ form, button: submitButton, busyText:'Sending...', action: async ()=> sendChatMessage(appState.user, { threadId:threadIdInput?.value || currentThreadId, department:departmentInput?.value || currentDepartment, message:messageInput?.value || '' }) }); appState.chatState.selectedThreadId=result.threadId; if(threadIdInput) threadIdInput.value=result.threadId; if(messageInput) messageInput.value=''; await reportOperationalEvent('chat_message', 'sent', { threadId:result.threadId, department:departmentInput?.value || currentDepartment }); }catch(error){ showToast('Chat send failed', handleUiError('chat_send', error, { department: departmentInput?.value || currentDepartment })); } }); wireStaticButtons(); }

function escapeMarkup(value=''){ return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }
function cardQrUrl(value=''){ return createQrSvgDataUrl(value, 180); }
function buildCardPackHtml(cards=[]){
  const items = cards.map((item)=>{
    const theme = item.theme || {};
    const cardColor = theme.cardColor || item.card?.cardColor || item.profile?.cardColor || 'white';
    const background = theme.gradientFrom && theme.gradientTo ? `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` : '';
    const textColor = theme.textColor || '#fff8ef';
    const mutedColor = theme.secondaryTextColor || 'rgba(255,248,239,.78)';
    const qrValue = item.qrValue || item.card?.qrValue || `LAYA-${item.userId}`;
    return `<article class="print-card print-card-${cardColor}" style="${background ? `background:${background};` : ''}color:${textColor};--print-muted:${mutedColor}"><div class="print-top"><div><div class="print-eyebrow">${escapeMarkup(theme.title || 'LAYA Card')}</div><h2>${escapeMarkup(item.displayName || '-')}</h2><div class="print-type">${escapeMarkup(item.cardType || '-')}</div></div><div class="print-logo">${escapeMarkup(theme.logoText || 'LAYA')}</div></div><div class="print-middle"><div><div class="print-number">${escapeMarkup(item.cardNumber || '-')}</div><div class="print-room">${escapeMarkup(item.roomNo ? `Room ${item.roomNo}` : (item.profile?.role || 'member'))}</div><div class="print-footer">${escapeMarkup(theme.footerText || '')}</div></div><div class="print-qr"><img src="${cardQrUrl(qrValue)}" alt="QR"></div></div><div class="print-qr-value">${escapeMarkup(qrValue)}</div></article>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>LAYA Card Pack</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Inter,Arial,sans-serif;margin:0;padding:24px;background:#f4f2ec;color:#111827}h1{margin:0 0 18px}.sheet{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.print-card{border-radius:26px;min-height:240px;padding:20px;display:grid;gap:20px;box-shadow:0 10px 28px rgba(0,0,0,.15);break-inside:avoid}.print-card-white{color:#2e2419;background:linear-gradient(135deg,#d9d2ca,#faf6f0)}.print-card-black{background:linear-gradient(135deg,#111,#3a3a3a)}.print-card-red{background:linear-gradient(135deg,#5a1220,#b82d45)}.print-card-gold{background:linear-gradient(135deg,#8b6a1b,#e3c170)}.print-card-silver{background:linear-gradient(135deg,#66727d,#d3dae0)}.print-card-bronze{background:linear-gradient(135deg,#6c4326,#c98d59)}.print-top,.print-middle{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.print-eyebrow,.print-type,.print-room,.print-footer,.print-qr-value{font-size:12px;letter-spacing:.06em;color:var(--print-muted,rgba(255,255,255,.78))}.print-number{font-size:22px;font-weight:800;margin-top:8px}.print-logo{padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.18);font-size:12px;font-weight:700}.print-qr{width:120px;height:120px;background:#fff;border-radius:18px;padding:8px;display:grid;place-items:center}.print-qr img{width:100%;height:100%;object-fit:contain}@media print{body{padding:0;background:#fff}.sheet{gap:12mm}.print-card{box-shadow:none;page-break-inside:avoid}}</style></head><body><h1>LAYA QR Card Pack</h1><section class="sheet">${items}</section><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`;
}
function buildCardCsv(cards=[]){ const rows=[['displayName','cardNumber','qrValue','cardType','roomNo','themeKey','themeTitle','balance','points']]; cards.forEach((item)=>rows.push([item.displayName||'', item.cardNumber||'', item.qrValue||'', item.cardType||'', item.roomNo||'', item.theme?.key||item.cardTheme||'', item.theme?.title||'', item.balance||0, item.points||0])); return rows.map((row)=>row.map((value)=>`"${String(value ?? '').replaceAll('"','""')}"`).join(',')).join('\n'); }
function downloadTextFile(filename, content, type='text/plain'){ const blob=new Blob([content], { type }); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 1200); }
async function bindCardToolsActions(snapshot){ const cards=snapshot.cards || []; const itemNodes=qsa('[data-card-item]', pageRoot); const searchNode=qs('#cardtools-search', pageRoot); const typeNode=qs('#cardtools-type-filter', pageRoot); const themeNode=qs('#cardtools-theme-filter', pageRoot); const countNode=qs('#cardtools-selected-count', pageRoot); const selected=new Set(appState.cardToolsState.selectedIds || []); qsa('[data-card-select]', pageRoot).forEach((input)=>{ if(selected.has(input.value)) input.checked=true; input.addEventListener('change', ()=>{ if(input.checked) selected.add(input.value); else selected.delete(input.value); appState.cardToolsState.selectedIds=[...selected]; updateCount(); }); }); const applyFilters=()=>{ const search=(searchNode?.value || '').trim().toLowerCase(); const typeValue=typeNode?.value || ''; const themeValue=themeNode?.value || ''; itemNodes.forEach((node)=>{ const okSearch=!search || String(node.dataset.search || '').includes(search); const okType=!typeValue || node.dataset.cardType===typeValue; const okTheme=!themeValue || node.dataset.themeKey===themeValue; node.hidden=!(okSearch && okType && okTheme); }); }; const updateCount=()=>{ if(countNode) countNode.textContent=String(selected.size); }; [searchNode, typeNode, themeNode].forEach((node)=>node?.addEventListener('input', applyFilters)); [typeNode, themeNode].forEach((node)=>node?.addEventListener('change', applyFilters)); qs('#cardtools-select-visible', pageRoot)?.addEventListener('click', ()=>{ itemNodes.filter((node)=>!node.hidden).forEach((node)=>{ const input=qs('[data-card-select]', node); if(input){ input.checked=true; selected.add(input.value); } }); appState.cardToolsState.selectedIds=[...selected]; updateCount(); }); qs('#cardtools-clear-selection', pageRoot)?.addEventListener('click', ()=>{ selected.clear(); qsa('[data-card-select]', pageRoot).forEach((input)=>{ input.checked=false; }); appState.cardToolsState.selectedIds=[]; updateCount(); }); const getSelectedCards=()=>cards.filter((item)=>selected.has(item.userId)); qs('#cardtools-print-btn', pageRoot)?.addEventListener('click', ()=>{ const chosen=getSelectedCards(); if(!chosen.length){ showToast('No cards selected', 'Select at least one card first.'); return; } const html=buildCardPackHtml(chosen); const win=window.open('', '_blank', 'noopener'); if(!win){ showToast('Popup blocked', 'Allow popups in this browser to print the card pack.'); return; } win.document.open(); win.document.write(html); win.document.close(); }); qs('#cardtools-export-html-btn', pageRoot)?.addEventListener('click', ()=>{ const chosen=getSelectedCards(); if(!chosen.length){ showToast('No cards selected', 'Select at least one card first.'); return; } downloadTextFile('laya-card-pack.html', buildCardPackHtml(chosen), 'text/html'); }); qs('#cardtools-export-csv-btn', pageRoot)?.addEventListener('click', ()=>{ const chosen=getSelectedCards(); if(!chosen.length){ showToast('No cards selected', 'Select at least one card first.'); return; } downloadTextFile('laya-card-pack.csv', buildCardCsv(chosen), 'text/csv'); }); applyFilters(); updateCount(); }

async function bindNotificationActions(){ qsa('[data-notification-read]', pageRoot).forEach((button)=>button.addEventListener('click', async ()=>{ try{ await markNotificationRead(button.dataset.notificationRead); await mount(); }catch(error){ showToast('Notification update failed', error?.message || 'Unable to mark notification as read.'); } })); qsa('[data-notification-open]', pageRoot).forEach((button)=>button.addEventListener('click', async ()=>{ const notificationId=button.dataset.notificationId; const route=button.dataset.notificationOpen || 'home'; if(notificationId) await markNotificationRead(notificationId).catch(()=>{}); location.hash=route; })); qs('[data-notification-mark-all]', pageRoot)?.addEventListener('click', async ()=>{ try{ await markAllNotificationsRead(appState.user); await mount(); }catch(error){ showToast('Notification update failed', error?.message || 'Unable to mark all notifications as read.'); } }); }
async function mount(){ try{ cleanupRouteResources(); paintHeader(); renderNav(); await startGlobalNotificationStreams(); const nextRoute=getRouteFromHash(appState.user); if(nextRoute!=='scan') stopQrScanner(); appState.currentRoute=nextRoute; titleNode.textContent=getRouteTitle(appState.currentRoute); pageRoot.innerHTML=`<section class="card loading-card"><p>Loading ${getRouteTitle(appState.currentRoute)}...</p><p class="muted">${navigator.onLine===false ? 'You appear to be offline.' : 'Preparing the latest data from Firebase.'}</p></section>`; const loader=routeLoaders[appState.currentRoute] || routeLoaders.home; const snapshot=await loader(); appState.lastSnapshot=snapshot; if(snapshot?.wallet?.balance!=null) appState.user.balance=snapshot.wallet.balance; if(snapshot?.points?.points!=null) appState.user.points=snapshot.points.points; if(snapshot?.pointAccount?.points!=null) appState.user.points=snapshot.pointAccount.points; if(appState.currentRoute!=='scan' && appState.lastSnapshot) appState.lastSnapshot.preview=null; pageRoot.innerHTML=renderRoute(appState.currentRoute, appState.user, appState.lastSnapshot, { projectId:appState.projectId, mode:appState.projectMode, appVersion:appState.appVersion, pushEnabled:appState.notificationState.pushEnabled, pushReason:appState.notificationState.pushReason }); paintHeader(); renderNav(); await bindCommonActions(); if(appState.currentRoute==='scan') await bindScanActions(appState.lastSnapshot); if(appState.currentRoute==='admin') await bindAdminActions(); if(appState.currentRoute==='hk') await bindHkActions(appState.lastSnapshot); if(appState.currentRoute==='towel') await bindTowelActions(appState.lastSnapshot); if(appState.currentRoute==='chat') await bindChatActions(appState.lastSnapshot); if(appState.currentRoute==='notifications') await bindNotificationActions(appState.lastSnapshot); if(appState.currentRoute==='cardtools') await bindCardToolsActions(appState.lastSnapshot); }catch(error){ pageRoot.innerHTML=`<section class="card loading-card"><p><strong>Screen failed to load.</strong></p><p class="muted">${handleUiError('mount', error)}</p></section>`; }}
window.addEventListener('hashchange', mount); window.addEventListener('beforeunload', ()=>{ cleanupRouteResources(); stopQrScanner(); }); headerAction?.addEventListener('click', ()=>{ location.hash='notifications'; }); paintHeader(); mount();