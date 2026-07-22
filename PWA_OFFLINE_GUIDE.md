# Mawutor Dezor Enterprise — Offline PWA Guide v3.0

Your app now **works offline** and **installs on phones** like a real app (Android & iPhone).

---

## ✅ What Was Added for Offline + Install

### 1. PWA Manifest (`public/manifest.json`)
- Name: Mawutor Dezor Enterprise
- Short name: Mawutor
- Display: standalone (no browser bar when installed)
- Icons: 96, 144, 180, 192, 512, 512 maskable
- Shortcuts: Add MTN, Add Telecel, Statements
- Start URL: `/?source=pwa`

### 2. Icons (`public/icons/`)
- `icon-96.png`, `icon-144.png`, `icon-180.png` (iOS), `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`
- Gradient M logo: MTN yellow #FFCC00 → Telecel red #E4002B on navy #0f1e3a

### 3. Service Worker (`public/service-worker.js` v3)
- **Caches app shell**: `/`, `/index.html`, `/style.css`, `/app.js`, `/manifest.json`, icons
- **Offline strategy:**
  - Static assets: Cache first, network fallback
  - Navigation (HTML): Network first, cache fallback, offline HTML fallback
  - API GET (`/api/transactions`, `/api/statements`, `/api/trial-balance`): Network first, cache fallback for offline viewing
  - API POST/PUT/DELETE: Network only, if offline returns 202 queued — client handles queue
- **Background Sync:** Listens for `sync-momo-transactions` tag, notifies clients to sync
- **Cache version:** `mawutor-v3-momo-pwa` — auto cleans old caches on activate

### 4. Frontend Offline Queue (`public/app.js` v3)
- **LocalStorage queue:** `mde_offline_queue` = array of {type:create|update|delete, payload, id, _queuedAt, _localId}
- **When offline:**
  - Add transaction → saved to queue, optimistically shown in tables with "Queued Offline" badge + yellow background
  - Edit/Delete → queued similarly
  - Toast: "📴 Offline — Queued..."
  - Offline banner at top shows `X queued`
- **When online:**
  - `online` event → auto sync after 1 sec
  - Sync function: iterates queue, calls `api()` POST/PUT/DELETE, removes on success, keeps on network failure
  - Shows "Synced X offline transactions"
  - Periodic sync every 30 sec
- **Offline cache for viewing:**
  - After successful GET, caches to `localStorage` `mde_cache_transactions_MTN`, `mde_cache_transactions_Telecel`, `mde_cache_statements`, `mde_cache_trial_...`
  - When GET fails (offline), loads from cache and shows badge "Offline cache" or "Offline cache" row
- **Queue UI:** In Trial Balance tab → Offline Manual box → View Offline Queue / Sync Now / Clear Cache

### 5. Installability (`public/index.html` v3)
- `<link rel="manifest" href="/manifest.json">`
- `<link rel="apple-touch-icon" href="/icons/icon-180.png">`
- Theme color `#0f1e3a`, apple-mobile-web-app-capable
- **Install banner:** Shows when `beforeinstallprompt` fires (Android Chrome), with Install + Dismiss
- **Install menu button:** 📲 in topbar when installable, also explains manual install for iPhone
- **Offline banner:** Sticky top, shows "📴 Offline Mode — you can still add..."
- **Connection status:** Topbar shows 📶 Online / 📴 Offline + Live dot
- **Modal note:** When offline, shows yellow alert "Offline — transaction will be queued locally"
- **Footer:** Shows PWA status (Installable / Installed ✓) and Cache status

---

## 📲 How to Install on Phone

### Android (Chrome, Edge, Samsung Internet)
1. Open your Render URL `https://mawutor-app-xxxx.onrender.com`
2. Wait for banner "Install Mawutor App" at bottom → tap **Install**
   - Or Chrome menu ⋮ → **Install app** / **Add to Home Screen**
3. App icon appears on home screen with M logo
4. Open from home screen → runs **standalone** (no browser bar), splash screen navy, works offline

### iPhone (Safari)
1. Open URL in **Safari** (must be Safari, not Chrome on iOS for install)
2. Tap **Share button** (square with arrow up) → **Add to Home Screen**
3. Name: Mawutor Dezor → Add
4. Icon appears on home screen
5. Open → standalone, works offline after first visit

### Desktop (Chrome/Edge on Windows/Mac)
- Address bar shows install icon (monitor with +) → Click Install
- Or menu → Install Mawutor Dezor Enterprise

---

## 📴 How Offline Works Correctly

### Scenario 1: Market with poor network (Ho Dome)
1. First time: Visit app online, login (caches shell + token + data)
2. Go offline (turn on airplane mode)
3. Still opens from home screen (service worker serves cached index.html, style.css, app.js)
4. You can:
   - View MTN/Telecel tables from cache (shows "Offline cache" badge)
   - Add new transaction with client name + MoMo number + amounts → App shows **Queued Offline** yellow row, saves to `localStorage` queue, updates summary cards optimistically
   - Edit/delete → queued similarly
5. When internet returns:
   - Top banner changes to Online
   - Toast "📶 Back online — syncing..."
   - Queue syncs automatically: POSTs each queued transaction to Atlas (or file DB)
   - Toast "✅ Synced X offline transactions!"
   - Socket.io live update to other devices

### Scenario 2: No internet at all for hours
- Queue persists in localStorage (survives page refresh, browser close)
- You can add dozens of transactions offline
- Count shown: "3 queued" in banner + Trial Balance manual box
- View queue: Trial Balance tab → View Offline Queue → list with timestamp + MoMo

### Data Integrity
- Each queued item gets `_localId` and `_queuedAt` ISO
- When synced, server generates real UUID and balance auto-calculated same formula
- No duplication: removes from queue only after 2xx success
- If server rejects (e.g., validation), removes and shows error toast, prevents infinite retry

---

## 🧪 How to Test Offline

1. Local: `npm start` → open http://localhost:3000 → login → add 2 txs → check DevTools → Application → Cache Storage → `mawutor-v3-momo-pwa` → should have assets
2. DevTools → Network → Throttle → Offline → Refresh page → should still load (from SW cache)
3. Add transaction while offline → should show Queued badge and yellow background
4. Go online → should auto-sync within 1-3 sec
5. DevTools → Application → Local Storage → `mde_offline_queue` → should be `[]` after sync
6. Lighthouse → PWA audit → should score 90+ (installable, offline, icons, manifest, theme color)

---

## 🔒 Security & Limits Offline

- **Auth offline:** Uses cached token/user (`mde_cached_user`). If offline on first visit with no prior login, shows login screen but allows cached login if token exists. Registration needs online (first time only).
- **Exports (CSV/PDF):** Require online (needs server PDF generation). Shows error "Export needs internet"
- **Socket live sync:** Works only online, falls back to polling/sync queue offline
- **Cache size:** localStorage ~5MB limit (enough for ~1000 transactions). Service Worker cache ~50MB for assets.
- **iOS limits:** iOS Safari PWA cache ~50MB, background sync not supported but manual online event sync works

---

## 🚀 Deployment Notes (PWA needs HTTPS)

- **Render provides HTTPS automatically** — PWA installability requires HTTPS (except localhost). Your Render URL `https://...onrender.com` is already HTTPS → PWA install works.
- No extra env vars needed for PWA
- After deploy, first visit on phone must be online to cache shell + register SW. After that, works offline.

---

## 📁 Files Added for PWA

```
public/
├── manifest.json          ← PWA manifest
├── service-worker.js      ← Offline caching + background sync
├── icons/
│   ├── icon-96.png
│   ├── icon-144.png
│   ├── icon-180.png       ← iOS apple-touch-icon
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon-512-maskable.png
├── index.html             ← Now links manifest, registers SW, offline banners
├── app.js                 ← Offline queue + cache + sync
└── style.css              ← Offline banner + install banner styles
```

---

## Next Steps (Optional Upgrades)

- **IndexedDB instead of localStorage** for larger offline storage (10k+ txs) — use `idb` library
- **Background Sync API** for automatic sync even if app closed (Chrome only)
- **Push Notifications** when sync completes (service-worker.js already has push listener placeholder)
- **Periodic Background Sync** for trial balance refresh daily

Your app now installs like Play Store app and works market-day offline with MoMo numbers intact!
