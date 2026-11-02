// BC Electric Service Worker v4.0
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({
    apiKey: "AIzaSyC4MIj9F4OVgT-MztP5Kycl3GIBYM7QrEE",
    databaseURL: "https://faddi-410e9-default-rtdb.firebaseio.com",
    projectId: "faddi-410e9",
    messagingSenderId: "115948785424078163751",
    appId: "1:382118183727:web:eb24c113ffaccee25b97da"
});

const APP_URL = 'https://chadistil.github.io/bse/BCElectric.html';
const DB_URL  = 'https://faddi-410e9-default-rtdb.firebaseio.com';
const ICON    = 'https://chadistil.github.io/bse/icon-192.png';
const BADGE   = 'https://chadistil.github.io/bse/icon-72.png';

const CALL_RING_MS   = 30000;   // مدة بقاء إشعار الرنين
const CALL_STALE_MS  = 40000;   // رسالة وصلت متأخرة عن هذا → تُعرض كمكالمة فائتة لا كرنين
// اهتزاز طويل متكرر يشبه الرنين (اهتزاز/إيقاف بالمللي ثانية)
const CALL_VIBRATE = [700, 300, 700, 300, 700, 300, 700, 300, 700, 300, 700, 300, 700];

const messaging = firebase.messaging();

// ─── إشعارات الخلفية ───
messaging.onBackgroundMessage(payload => {
    const data = payload.data || {};

    // مكالمة واردة / مكالمة فائتة (رسائل data فقط من الـ Worker)
    if (data.kind === 'call')        return showCallNotification(data);
    if (data.kind === 'call_missed') return showMissedCall(data);

    // إشعار عادي
    const title = payload.notification?.title || data.title || 'BC Electric';
    const body  = payload.notification?.body  || data.body  || '';

    return self.registration.showNotification(title, {
        body,
        icon:  ICON,
        badge: BADGE,
        tag:   data.tag || 'bc-fcm',
        dir:   'rtl',
        vibrate: [200, 100, 200],
        requireInteraction: data.requireInteraction === 'true',
        data: {
            url:        data.url        || APP_URL,
            tag:        data.tag        || '',
            callId:     data.callId     || '',
            callType:   data.callType   || '',
            callerName: data.callerName || '',
            employeeId: data.employeeId || ''
        }
    });
});

// ─── مكالمة واردة: اهتزاز طويل + أزرار رد/رفض + إغلاق تلقائي ───
async function showCallNotification(d) {
    const ts  = Number(d.ts) || Date.now();
    const age = Date.now() - ts;
    if (age > CALL_STALE_MS) return showMissedCall(d);   // وصلت متأخرة جداً

    const tag = d.tag || ('call-' + d.callId);
    await self.registration.showNotification(d.title || '📞 BC Electric', {
        body: d.body || '',
        icon: ICON,
        badge: BADGE,
        tag,
        renotify: true,
        requireInteraction: true,
        silent: false,
        dir: 'rtl',
        vibrate: CALL_VIBRATE,
        timestamp: ts,
        actions: [
            { action: 'answer', title: d.answerLabel || 'Answer' },
            { action: 'reject', title: d.rejectLabel || 'Decline' }
        ],
        data: {
            kind: 'call', url: d.url || APP_URL, tag,
            callId: d.callId || '', callType: d.callType || 'audio', callerName: d.callerName || ''
        }
    });

    // أغلق الإشعار بعد انتهاء مهلة الرنين إن بقي (أفضل جهد؛ قد يوقف المتصفح الـ SW قبلها)
    await new Promise(r => setTimeout(r, Math.max(1000, CALL_RING_MS - age)));
    const left = await self.registration.getNotifications({ tag });
    left.forEach(n => { if (n.data && n.data.kind === 'call') n.close(); });
}

// ─── مكالمة فائتة: تستبدل إشعار الرنين (نفس الوسم) ───
function showMissedCall(d) {
    return self.registration.showNotification(d.kind === 'call_missed' ? d.title : ('📵 ' + (d.callerName || '')), {
        body: d.kind === 'call_missed' ? (d.body || '') : '',
        icon: ICON,
        badge: BADGE,
        tag: d.tag || ('call-' + d.callId),
        renotify: true,
        requireInteraction: false,
        dir: 'rtl',
        vibrate: [200, 100, 200],
        data: { kind: 'call_missed', url: d.url || APP_URL }
    });
}

// ─── نقر على الإشعار أو أحد أزراره ───
self.addEventListener('notificationclick', e => {
    const data = e.notification.data || {};
    e.notification.close();

    // زر «رفض»: لا نفتح التطبيق، نكتب الرفض في Firebase مباشرة
    if (data.kind === 'call' && e.action === 'reject') {
        e.waitUntil(rejectCallFromSW(data.callId));
        return;
    }
    e.waitUntil(openApp(data));
});

async function rejectCallFromSW(callId) {
    if (!callId) return;
    try {
        const u = `${DB_URL}/calls/${encodeURIComponent(callId)}`;
        const st = await (await fetch(`${u}/status.json`)).json();
        // لا نكتب إلا إن كانت لا تزال ترنّ (حتى لا ننشئ عقدة فارغة لمكالمة انتهت)
        if (st === 'ringing') {
            await fetch(`${u}.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'rejected' })
            });
        }
    } catch (err) { /* لا شيء — انتهت المكالمة أو لا اتصال */ }
}

async function openApp(data) {
    const url = data.url || APP_URL;
    const isCall = data.kind === 'call' && data.callId;
    const cs = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) {
        if (c.url.includes('BCElectric')) {
            try { await c.focus(); } catch (err) {}
            c.postMessage({ type: 'NOTIF_CLICK', url, callId: isCall ? data.callId : '', data });
            return;
        }
    }
    // التطبيق مغلق: افتحه مع بيانات المكالمة في الرابط (الصفحة تقرأ ?callId)
    const openUrl = isCall
        ? `${url.split('#')[0]}?callId=${encodeURIComponent(data.callId)}&callType=${encodeURIComponent(data.callType || '')}&callerName=${encodeURIComponent(data.callerName || '')}`
        : url;
    return clients.openWindow(openUrl);
}

// ─── رسائل من الصفحة ───
self.addEventListener('message', e => {
    if (e.data?.type === 'SHOW_NOTIFICATION') {
        const { title, body, tag, requireInteraction } = e.data;
        self.registration.showNotification(title, {
            body,
            icon:  ICON,
            badge: BADGE,
            tag:   tag || 'bc-notif',
            dir:   'rtl',
            vibrate: [200, 100, 200],
            requireInteraction: requireInteraction || false,
        });
    }
});

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
