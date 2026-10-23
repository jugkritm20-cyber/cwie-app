/* =====================================================================
 *  Service Worker — แอประบบรับสมัครฝึกงานและสหกิจศึกษา (CWIE App)
 *  - เก็บไฟล์ตัวแอป (หน้าหลัก ไอคอน) ไว้ในเครื่อง เปิดแอปได้ทันทีแม้เน็ตช้า/ไม่มีเน็ต
 *  - ตัวระบบจริง (Google Apps Script) โหลดจากอินเทอร์เน็ตทุกครั้ง ข้อมูลจึงเป็นปัจจุบันเสมอ
 *  ★ แก้ไขไฟล์ใด ๆ ในโฟลเดอร์แอปแล้ว ให้เปลี่ยนเลข CACHE_VERSION ด้านล่างทุกครั้ง
 * ===================================================================== */
const CACHE_VERSION = 'cwie-app-v1.0.0';

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './vendor/qrcode.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-96.png',
  './icons/logo-256.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** โหลดจากเน็ตก่อน (ได้ไฟล์ล่าสุด) ถ้าเกินเวลา/ไม่มีเน็ต ใช้ไฟล์ที่เก็บไว้ */
function networkFirst(request, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const fromCache = () => caches.match(request, { ignoreSearch: true })
      .then((r) => r || caches.match('./index.html'));

    const timer = setTimeout(() => {
      fromCache().then((r) => { if (r && !settled) { settled = true; resolve(r); } });
    }, timeoutMs);

    fetch(request).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put('./index.html', copy)).catch(() => {});
      }
      if (!settled) { settled = true; clearTimeout(timer); resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      fromCache().then((r) => {
        if (!settled) {
          settled = true;
          resolve(r || new Response('<h1>ออฟไลน์</h1>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
        }
      });
    });
  });
}

/** ใช้ไฟล์ในเครื่องก่อน แล้วอัปเดตเบื้องหลัง */
function staleWhileRevalidate(request) {
  return caches.open(CACHE_VERSION).then((cache) =>
    cache.match(request, { ignoreSearch: true }).then((cached) => {
      const net = fetch(request).then((res) => {
        if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // ไม่ยุ่งกับ Google Apps Script / CDN

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, 4000));
    return;
  }
  event.respondWith(staleWhileRevalidate(req));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
