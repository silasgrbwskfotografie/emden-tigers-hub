/* Emden Tigers Hub: Service Worker für die App auf dem Startbildschirm.
   Speichert bewusst nichts zwischen (keine Vereinsdaten auf dem Handy), zeigt ohne Netz nur einen Hinweis. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Keine Verbindung</title><body style="font-family:system-ui,sans-serif;background:#0b0b0b;color:#fff;display:grid;place-items:center;height:100vh;margin:0;text-align:center">' +
    '<div><h2>Keine Verbindung</h2><p>Der Hub braucht Internet. Bitte später erneut versuchen.</p>' +
    '<button onclick="location.reload()" style="padding:10px 18px;border-radius:8px;border:0;background:#B3121D;color:#fff">Erneut laden</button></div></body></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
