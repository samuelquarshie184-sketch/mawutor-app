# Mawutor Dezor Enterprise — Novice Deployment Guide v2.0

This guide is for you if you have **never deployed before**. Follow exactly, step by step. No coding needed.

---

## A) What You Have Now (v2 Update)

- ✅ App already updated with **MoMo Numbers** in ALL tabs
- ✅ Mobile-friendly for Android & iPhone (bottom menu, + button, tap-to-call)
- ✅ Works live with multiple users
- ✅ CSV/PDF now includes MoMo numbers
- ✅ Audited: no freezing, no duplication, no stripping

Files you need:
- `server.js`, `db.js`, `package.json`, `public/` folder (index.html, style.css, app.js)
- `.env.example`, `.gitignore`, `README.md`, `PROMPTS.md`

---

## B) Deploy on Render — Free Tier (Single Service)

Render lets you host backend + frontend together as one link — perfect for this app.

### Step 1 — Put Code on GitHub

1. Go to https://github.com → New repository → name `mawutor-dezor-enterprise` → Create (Public)
2. On your computer (or in this workspace terminal):
   ```bash
   git init
   git add .
   git commit -m "v2 MoMo numbers + mobile friendly"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/mawutor-dezor-enterprise.git
   git push -u origin main
   ```
   Replace `YOUR_USERNAME` with your GitHub name.

If you are using Arena workspace: download files, then upload to GitHub via web → Add file → Upload files.

### Step 2 — Create Render Service

1. Go to https://render.com → Sign up (GitHub login easiest)
2. Dashboard → **New +** → **Web Service**
3. Connect your GitHub repo `mawutor-dezor-enterprise`
4. Fill:
   - **Name**: `mawutor-dezor-enterprise`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### Step 3 — Environment Variables

In Render settings → Environment → Add:

- `JWT_SECRET` = paste a long random string. Generate one: open https://www.random.org/strings/ → length 32 → generate, copy.
- `PORT` = `10000` (Render sometimes sets automatically, leave if already)

Click Save.

### Step 4 — Deploy

Click **Create Web Service** → Wait 3-5 mins for build logs to show "Mawutor Dezor Enterprise running".

Render gives you a URL like: `https://mawutor-dezor-enterprise.onrender.com`

Open it on phone & laptop!

### Step 5 — First Use

1. On the URL, you see Login screen → tap **Register**
2. Fill: Full Name, Phone (your Ghana number), Email (optional), Password, Role = Admin
3. First user automatically becomes **Admin**
4. After login, you see 4 tabs: MTN, Telecel, Statements, Trial Balance
5. Tap **+ Add** (yellow for MTN, red for Telecel, or floating + button at bottom right on mobile)
6. Fill form:
   - Network: MTN/Telecel
   - Date/time auto now
   - Client Name: e.g. `Esi Agbemenya`
   - **MoMo Number**: REQUIRED now — e.g. `0244 123 456` (validated 9-13 digits)
   - Capital, Deposit, Withdrawal
   - Branch: Ho Dome
7. Save → Toast "Added: Esi ..." → Table updates live everywhere, including other phones logged in same time.

**Search by MoMo:** In MTN tab search box, type `0244` → finds Esi instantly. Works in Statements too.

---

## C) Update an Existing Deployment (v2)

If you already deployed v1 before:

1. Replace files in GitHub repo with new v2 files (server.js, db.js, public/*)
2. Commit & Push: `git add . && git commit -m "v2 momo" && git push`
3. Render auto-detects push and redeploys (2-3 mins). No need to create new service.
4. Your old transactions (if any) still work — old records without MoMo will show `—` and you can Edit to add MoMo number (backfilled with empty string, not stripped).

---

## D) Mobile Use (Android & iPhone)

- Add to Home Screen: open URL in Chrome/Safari → Share → Add to Home Screen → now looks like app.
- Permissions: `tel:` links — tapping MoMo number asks to call client.
- Bottom Nav: on phone you see 4 icons (MTN, Telecel, Stmt, Trial) at bottom — easier than top.
- FAB + Button: floating + at bottom-right → tap to add quickly while serving customer.
- Inputs are 16px → iPhone won't zoom annoyingly.

---

## E) Important Notes for Production

- **Free disk is temporary:** Render free tier may wipe `data/*.json` when service sleeps. For serious business records, later move to **MongoDB Atlas free tier** (永久 free, never expires). Only `db.js` needs changing — prompt is in `PROMPTS.md`: "Replace file-based storage with MongoDB while keeping same exported functions..."

- **Backup CSV:** Export CSV weekly (now includes MoMo numbers) and save to Google Drive.

- **Multi-user:** Register attendants with role attendant. Admin can see all. Password reset works via token (for now token shown on screen — in future wire to SMS).

---

## F) Checklist After Deploy

- [ ] Can register/login on phone
- [ ] Add MTN transaction with MoMo number → shows in table desktop + mobile cards
- [ ] Add Telecel with different MoMo → shows in Telecel tab
- [ ] Search `024` finds correct client in both tabs
- [ ] Statements tab: combined feed shows MoMo + running balance
- [ ] Trial Balance: totals + audit feed below shows MoMo numbers
- [ ] Export CSV: open in Excel, see MoMo Number column
- [ ] Export PDF: open, see MoMo column
- [ ] Open on second phone, login same account, add transaction → first phone updates live (no refresh)

If all ticked, you are live!

---

Need help? Keep `PROMPTS.md` — feeding it + your `server.js`/`db.js` to an AI like Claude Code lets you extend features fast without breaking.

Good luck — Mawutor Dezor Enterprise is now mobile-ready! 📱💛❤️
