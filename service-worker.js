const CACHE = 'laya-card-scaffold-v2-2-4';
const ASSETS = [
  './',
  './login.html',
  './guest.html',
  './index.html',
  './notifications.html',
  './css/base.css',
  './css/pages/login.css',
  './css/pages/app.css',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});

importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDO1nqHOHzpwGgK9OhxlNAhZevUBsyprS8',
  authDomain: 'laya-club-house.firebaseapp.com',
  projectId: 'laya-club-house',
  storageBucket: 'laya-club-house.firebasestorage.app',
  messagingSenderId: '458696969105',
  appId: '1:458696969105:web:e584a06395a37324bae830',
  measurementId: 'G-2HLG605QZ9'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload?.notification || {};
  const data = payload?.data || {};
  const title = notification.title || data.title || 'LAYA Card Alert';
  const options = {
    body: notification.body || data.body || 'You have a new hotel service alert.',
    data: {
      link: data.link || data.click_action || './index.html#notifications',
      route: data.route || 'notifications',
      notificationId: data.notificationId || null
    }
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification?.data?.link || './index.html#notifications';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client && client.url.includes('index.html')) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : null;
    })
  );
});
