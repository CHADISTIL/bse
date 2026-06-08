// BC Electric Service Worker v2.0 — FCM + Local Notifications
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// ─── Firebase Init ───
firebase.initializeApp({
    apiKey: "AIzaSyC4MIj9F4OVgT-MztP5Kycl3GIBYM7QrEE",
    databaseURL: "https://faddi-410e9-default-rtdb.firebaseio.com",
    projectId: "faddi-410e9",
    messagingSenderId: "115948785424078163751",
    appId: "faddi-410e9"
});

const messaging = firebase.messaging();

// ─── إشعارات الخلفية (التطبيق مغلق أو في الخلفية) ───
messaging.onBackgroundMessage(payload => {
    console.log('[SW] Background message:', payload);
    const title = payload.notification?.title || 'BC Electric';
    const body  = payload.notification?.body  || '';
    const tag   = payload.data?.tag || 'bc-fcm';

    return self.registration.showNotification(title, {
        body,
        icon:  '/bse/icon-192.png',
        badge: '/bse/icon-72.png',
        tag,
        dir:   'rtl',
        vibrate: [200, 100, 200],
        requireInteraction: payload.data?.requireInteraction === 'true',
        data: payload.data?.url || '/bse/BCElectric.html'
    });
});

// ─── نقر على الإشعار ───
self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
            for (const c of cs) {
                if (c.url.includes('BCElectric') && 'focus' in c) return c.focus();
            }
            return clients.openWindow(e.notification.data || '/bse/BCElectric.html');
        })
    );
});

// ─── رسائل من التطبيق (إشعارات محلية) ───
self.addEventListener('message', e => {
    if (e.data?.type === 'SHOW_NOTIFICATION') {
        const { title, body, tag, requireInteraction } = e.data;
        self.registration.showNotification(title, {
            body,
            icon:  '/bse/icon-192.png',
            badge: '/bse/icon-72.png',
            tag:   tag || 'bc-notif',
            dir:   'rtl',
            vibrate: [200, 100, 200],
            requireInteraction: requireInteraction || false,
        });
    }
});

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
