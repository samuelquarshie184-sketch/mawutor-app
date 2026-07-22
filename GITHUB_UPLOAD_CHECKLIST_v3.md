# ✅ GitHub Upload Checklist - Mawutor Dezor Enterprise v3.0 FINAL
# PWA Offline + MoMo + Mobile + Atlas Ready

This is the FINAL list after all updates (MoMo Numbers, Mobile Friendly, Atlas Hybrid, PWA Offline Installable). Upload THESE to GitHub for Render.

---

## FOLDER TO UPLOAD: /home/user/  (its CONTENTS)

On your computer, this folder contains everything. On GitHub, upload its CONTENTS (not node_modules).

### MUST HAVE - App Won't Run Without These (13 files/folders):

```
MUST:
├── server.js                 ← BACKEND + serves frontend (Atlas-ready with await)
├── db.js                     ← DATABASE - hybrid: Mongo if MONGODB_URI else file JSON + MoMo
├── package.json              ← Has start script + mongoose dependency
├── package-lock.json         ← Locks versions (important for Render)
├── public/                   ← FRONTEND FOLDER - MUST upload WHOLE folder
│   ├── index.html            → SPA with MoMo columns + offline banners + install banners + manifest link + SW registration
│   ├── style.css             → Theme navy/yellow/red + mobile bottom nav + FAB + offline/install banner CSS
│   ├── app.js                → Logic MoMo + mobile + offline queue + cache + sync + socket
│   ├── manifest.json         → PWA manifest (name, icons, shortcuts)
│   ├── service-worker.js     → Offline caching v3 + background sync
│   └── icons/                → PWA icons - MUST upload WHOLE folder
│       ├── icon-96.png
│       ├── icon-144.png
│       ├── icon-180.png      ← iPhone apple-touch-icon
│       ├── icon-192.png      ← Android
│       ├── icon-512.png
│       └── icon-512-maskable.png
└── data/
    └── .gitkeep              → Keeps empty data folder in GitHub (data/*.json auto-created, don't upload json)
```

**If you upload ONLY these, app deploys and works 100% offline + MoMo.**

### RECOMMENDED - Upload These Too (Docs & Helpers):

```
RECOMMENDED:
├── .env.example              → Shows what env vars needed (JWT_SECRET, MONGODB_URI)
├── .gitignore                → Tells GitHub to ignore node_modules & data/*.json
├── README.md                 → v3 docs with PWA + MoMo + Atlas
├── PROMPTS.md                → Build history
├── DEPLOY_GUIDE.md           → Novice deploy guide
├── ATLAS_MIGRATION_GUIDE.md  → How to move to Atlas for years
├── PWA_OFFLINE_GUIDE.md      → How offline + install works
├── migrate.js                → Script to move old file data into Atlas
└── package-lock.json         → Already in MUST but listed again
```

### OPTIONAL - Extra backups (won't break if uploaded):

```
OPTIONAL (can skip):
├── db.atlas.js               → Same as db.js (backup)
├── db.js.filebackup          → Old file-based v2 backup
├── AUDIT_REPORT.md           → Proof no old code stripped
├── GITHUB_UPLOAD_CHECKLIST.md / v3.md
├── UPLOAD_FOLDER_VIEW.html   → Visual folder view
└── mawutor-dezor-v3-final.zip (don't upload zip to GitHub, it's a bundle to download)
```

### NEVER UPLOAD - Will Break or Huge:

```
❌ NEVER:
   node_modules/              → 200MB+, Render does npm install itself
   data/users.json            → Your local users, gitignored, auto-created
   data/transactions.json     → Your local transactions, gitignored
   .env                       → Your secret JWT_SECRET, NEVER to GitHub
   .npm/ , .cache/ , dist/ , .DS_Store
   *.zip                      → Don't upload zip to GitHub
   uploads/image.png          → Screenshot, not needed
```

---

## Final Tree For GitHub (What Render Sees After Upload):

```
mawutor-app/
├── server.js
├── db.js
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
├── README.md
├── public/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── manifest.json
│   ├── service-worker.js
│   └── icons/
│       ├── icon-96.png
│       ├── icon-144.png
│       ├── icon-180.png
│       ├── icon-192.png
│       ├── icon-512.png
│       └── icon-512-maskable.png
└── data/
    └── .gitkeep
```

Docs like DEPLOY_GUIDE.md, ATLAS_MIGRATION_GUIDE.md, PWA_OFFLINE_GUIDE.md can be alongside but not required for running.

---

## How to Upload - First Time Deploy (You Are Here)

You said you haven't deployed from start yet — you already created `mawutor-app` repo with v2 files. Now you need to UPDATE it with v3 PWA files.

### Method 1: GitHub Website (Easiest)

1. Open your repo `https://github.com/YOUR_USERNAME/mawutor-app`
2. You will see old files from v2. You need to add new ones:
   - Click **Add file → Upload files**
   - From your computer (download `mawutor-dezor-v3-final.zip` from workspace → unzip on computer), drag:
     - **New/Updated:** `server.js`, `db.js`, `public/index.html`, `public/style.css`, `public/app.js` (overwrite)
     - **New Files:** `public/manifest.json`, `public/service-worker.js`, `public/icons/` (whole folder), `ATLAS_MIGRATION_GUIDE.md`, `PWA_OFFLINE_GUIDE.md`, `db.atlas.js`, `migrate.js`
   - Also drag `.env.example` and `.gitignore` if missing
   - Make sure `data/.gitkeep` exists (if data folder not visible on GitHub, create new file `data/.gitkeep` with content "keep")
3. Scroll down → **Commit directly to main**
4. Done — Render auto-detects push and redeploys in 2-3 mins

### Method 2: Git Command Line (All Files at Once)

```bash
# In folder where you unzipped v3 final
git init
git add server.js db.js package.json package-lock.json .env.example .gitignore README.md PROMPTS.md DEPLOY_GUIDE.md ATLAS_MIGRATION_GUIDE.md PWA_OFFLINE_GUIDE.md migrate.js public/ data/.gitkeep
git commit -m "v3 FINAL PWA Offline + MoMo + Atlas Ready + Mobile"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mawutor-app.git
git push -u origin main --force
# --force overwrites old v2 with v3 (OK for first deploy)
```

Replace YOUR_USERNAME.

---

## Render Settings (Same as Before)

After GitHub upload:

1. Render.com → Dashboard → Your service `mawutor-app` → Manual Deploy → Deploy latest commit (or it auto-deploys)
2. Build Command: `npm install`
3. Start Command: `npm start`
4. Environment Variables:
   - `JWT_SECRET` = long random (keep existing)
   - `PORT` = `10000`
   - For years storage: Add `MONGODB_URI` = your Atlas URI (see ATLAS_MIGRATION_GUIDE.md) — optional for now, if not set app uses file JSON
5. Logs should show:
   ```
   💾 Storage mode: File JSON (Ephemeral - use Atlas for years)  OR  MongoDB Atlas (Permanent)
   ✨ Mawutor Dezor Enterprise running...
   ```

6. Open URL → Test:
   - Register/Login (first user = admin)
   - Add MTN with MoMo 0244... → shows in table + mobile card + tel: link
   - Check Manifest: `https://your-url.onrender.com/manifest.json` → should show JSON
   - Check SW: DevTools → Application → Service Workers → should be activated
   - Install: Android Chrome menu ⋮ → Install App. iPhone Safari Share → Add to Home Screen
   - Offline test: Turn on airplane mode → refresh → app still opens (PWA) → add transaction → Queued Offline yellow row → Go online → auto sync

---

## Quick Verify After Upload

On GitHub repo page you should see:
- Root: server.js, db.js, package.json
- public folder clickable → inside: index.html, style.css, app.js, manifest.json, service-worker.js, icons folder with 6 pngs
- data folder → .gitkeep

If you see node_modules on GitHub, you uploaded too much — delete and re-upload using MUST list above.

---

You are ready! Final zip `mawutor-dezor-v3-final.zip` (5.5MB) in workspace contains exactly MUST + RECOMMENDED files ready to unzip and upload.
