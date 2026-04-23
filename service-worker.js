const CACHE = 'laya-card-scaffold-v2-0-0';
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
  apiKey: 'AIzaSyDReH8ZE8BLdSSEKoxAL4nppZOd6kO00rA',
  authDomain: 'service-c93f2.firebaseapp.com',
  projectId: 'service-c93f2',
  storageBucket: 'service-c93f2.firebasestorage.app',
  messagingSenderId: '1011741219243',
  appId: '1:1011741219243:web:0bbaa94adcb97723efdaee',
  measurementId: 'G-L0X403JZ5N'
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
