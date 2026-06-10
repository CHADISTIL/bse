// BC Electric Service Worker v3.0
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({
    apiKey: "AIzaSyC4MIj9F4OVgT-MztP5Kycl3GIBYM7QrEE",
    databaseURL: "https://faddi-410e9-default-rtdb.firebaseio.com",
    projectId: "faddi-410e9",
    messagingSenderId: "115948785424078163751",
    appId: "1:382118183727:web:eb24c113ffaccee25b97da"
});

const messaging = firebase.messaging();

// ─── إشعارات الخلفية ───
messaging.onBackgroundMessage(payload => {
    const title = payload.notification?.title || 'BC Electric';
    const body  = payload.notification?.body  || '';
    const data  = payload.data || {};

    return self.registration.showNotification(title, {
        body,
        icon:  'https://chadistil.github.io/bse/icon-192.png',
        badge: 'https://chadistil.github.io/bse/icon-72.png',
        tag:   data.tag || 'bc-fcm',
        dir:   'rtl',
        vibrate: [200, 100, 200],
        requireInteraction: data.requireInteraction !== 'false',
        // حفظ كل البيانات لاستخدامها عند النقر
        data: {
            url:        data.url        || 'https://chadistil.github.io/bse/BCElectric.html',
            tag:        data.tag        || '',
            callId:     data.callId     || '',
            callType:   data.callType   || '',
            callerName: data.callerName || '',
            employeeId: data.employeeId || ''
        }
    });
});

// ─── نقر على الإشعار ───
self.addEventListener('notificationclick', e => {
    e.notification.close();
    const data = e.notification.data || {};
    const url  = data.url || 'https://chadistil.github.io/bse/BCElectric.html';

    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
            // إذا الصفحة مفتوحة — ركّز وأرسل البيانات
            for (const c of cs) {
                if (c.url.includes('BCElectric')) {
                    c.focus();
                    c.postMessage({ type: 'NOTIF_CLICK', url, data });
                    return;
                }
            }
            // إذا مغلقة — افتحها مع البيانات في الـ URL
            const openUrl = data.callId
                ? `${url}?callId=${data.callId}&callType=${data.callType}&callerName=${encodeURIComponent(data.callerName)}`
                : url;
            return clients.openWindow(openUrl);
        })
    );
});

// ─── رسائل من الصفحة ───
self.addEventListener('message', e => {
    if (e.data?.type === 'SHOW_NOTIFICATION') {
        const { title, body, tag, requireInteraction } = e.data;
        self.registration.showNotification(title, {
            body,
            icon:  'https://chadistil.github.io/bse/icon-192.png',
            badge: 'https://chadistil.github.io/bse/icon-72.png',
            tag:   tag || 'bc-notif',
            dir:   'rtl',
            vibrate: [200, 100, 200],
            requireInteraction: requireInteraction || false,
        });
    }
});

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
