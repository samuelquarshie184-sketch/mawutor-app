# Mawutor Dezor Enterprise — Mobile Money Bookkeeping v3.0 PWA

Full-stack bookkeeping web app for **Ho Dome, Volta Region, Ghana** — now with **MoMo Numbers everywhere**, **mobile-friendly**, **offline PWA** that installs on Android & iPhone and works without internet.

**Version 3.0 Updates (July 2026) — Offline PWA:**
- ✅ **Works Offline Correctly:** Service Worker caches app shell, transactions cached for offline viewing, add/edit/delete queue when offline
- ✅ **Install on Phone:** Add to Home Screen → standalone app icon, splash screen, no browser bar. Android Chrome menu → Install App. iPhone Safari Share → Add to Home Screen
- ✅ **MoMo Numbers everywhere** (v2): Required field, shows in MTN/Telecel/Statements/Trial audit, search by name OR MoMo, CSV/PDF includes MoMo, tel: links
- ✅ **Offline Queue:** Banner "📴 Offline Mode — X queued", yellow queued rows, Trial Balance → View Offline Queue / Sync Now / Clear Cache
- ✅ **Auto Sync:** When online returns, queued transactions sync automatically to Atlas/file DB, toast "✅ Synced X"
- ✅ **PWA Files:** `manifest.json`, `service-worker.js` v3, icons 96-512, theme color navy
- ✅ **Atlas Ready:** `db.js` now hybrid — if `MONGODB_URI` set uses MongoDB Atlas (permanent years), else file JSON

**Version 2.0 Updates:**
- MoMo Number field, search unified, mobile bottom nav, FAB, tel links

---

## Stacks
- Backend: Node.js + Express + Socket.io + **file JSON OR MongoDB Atlas** (hybrid db.js)
- Frontend: Vanilla HTML/CSS/JS (no build step) + **PWA Service Worker**
- PWA: `manifest.json` + `service-worker.js` + icons, offline cache
- Auth: JWT, bcrypt, email/phone login, cached login for offline
- Reports: CSV/PDF with MoMo

## Features (v3)

- **Dashboard 4 tabs:** MTN, Telecel, Statements, Trial Balance — all show MoMo Number, all work offline from cache
- **Transaction:** date, clientName, **momoNumber**, capital, deposit, withdrawal, balance auto `capital+deposit-withdrawal`, branch, audit
- **Offline:**
  - Service Worker caches `/`, `index.html`, `style.css`, `app.js`, icons, manifest
  - API GET cached for offline viewing (offline badge)
  - Writes queued in `localStorage` `mde_offline_queue`, optimistic UI yellow "Queued Offline"
  - Online event → auto sync, socket live sync when online
  - Trial Balance → Offline Manual: View Queue, Sync Now, Clear Cache
- **Installable:**
  - Android: Chrome menu ⋮ → Install App / Add to Home Screen
  - iPhone: Safari Share → Add to Home Screen → standalone
  - Desktop: Chrome address bar install icon
  - Shortcuts: Add MTN, Add Telecel, Statements
- **Mobile-friendly:** bottom nav <900px, FAB +, cards replace tables, 16px inputs no iOS zoom, safe-area, 44px tap targets
- **GHS formatting:** `GHS1,000.00`
- **Full CRUD** + soft-delete + MoMo
- **CSV/PDF** with MoMo, filters

## Quick Start Local

```bash
npm install
cp .env.example .env   # set JWT_SECRET, optional MONGODB_URI
npm start
# http://localhost:3000
```

First user → admin. Add with MoMo `0244123456`. Turn on airplane mode → add another → shows Queued → Go online → auto syncs.

## PWA Test

1. Open https://your-url.onrender.com → login → DevTools Application → Cache Storage → mawutor-v3-momo-pwa → assets cached
2. DevTools Network → Offline → Refresh → app still loads (SW)
3. Add transaction offline → yellow Queued row
4. Go online → Sync toast + appears in Atlas/file
5. Lighthouse → PWA 90+ score

## Project Structure v3

```
server.js          # Atlas-ready with await db calls, serves PWA assets
db.js              # Hybrid: MONGODB_URI? Mongo else file JSON, with MoMo
db.atlas.js        # Same hybrid (backup)
public/
  index.html       # v3 PWA: manifest link, offline banner, install banner, SW registration
  manifest.json    # PWA manifest with icons + shortcuts
  service-worker.js# v3 offline caching + background sync
  icons/           # 96,144,180,192,512,512-maskable
    icon-192.png
    icon-512.png etc
  style.css        # v3 + offline banner + install banner styles
  app.js           # v3 MoMo + offline queue + cache + sync
data/
  .gitkeep
ATLAS_MIGRATION_GUIDE.md
PWA_OFFLINE_GUIDE.md
DEPLOY_GUIDE.md
```

## Deploy on Render (Still Single Service)

See `DEPLOY_GUIDE.md` and `PWA_OFFLINE_GUIDE.md`.

- HTTPS required for PWA install — Render provides https:// automatically → install works
- Env: `JWT_SECRET`, `MONGODB_URI` (Atlas for years), `PORT=10000`
- Build: `npm install`, Start: `npm start`

**Persistence:** For years, set `MONGODB_URI` Atlas free (never expires). File JSON resets on Render sleep.

---

Business: Mawutor Dezor Enterprise, Ho Dome, Volta Region, Ghana | GHS | MTN MoMo + Telecel | Offline PWA
