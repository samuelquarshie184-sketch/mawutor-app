# Move Mawutor Dezor Enterprise to MongoDB Atlas (Permanent Storage for Years)

This guide makes your app run **forever / years** instead of losing data on Render free disk.

You already deployed file-based version (works but ephemeral). This upgrades `db.js` to use Atlas.

---

## Step 1 — Create Atlas Free Account (5 mins)

1. Go to https://www.mongodb.com/cloud/atlas → Sign Up (Google is easiest)
2. Create Organization → Create Project named `mawutor-dezor`
3. Create Cluster:
   - Choose **FREE M0** (512MB, forever free, never expires like Render)
   - Provider: AWS
   - Region: Choose **Frankfurt (eu-central-1)** closest to Ghana
   - Cluster Name: `MawutorCluster`
   - Create (takes 2-3 mins)

4. **Database Access** (left menu):
   - Add New Database User
   - Username: `mawutor_admin`
   - Password: Generate secure password (copy it! e.g. `MyStrongPass123!`)
   - Role: Read and write to any database → Add User

5. **Network Access** (left menu):
   - Add IP Address → **Allow Access From Anywhere** → `0.0.0.0/0` → Confirm
   - (Needed because Render IP changes)

6. **Get Connection String:**
   - Database → Clusters → Connect → Drivers → Node.js
   - Copy string like:
     ```
     mongodb+srv://mawutor_admin:<password>@mawutorcluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```
   - Replace `<password>` with the password you created
   - Add database name at end: `...mongodb.net/mawutor-dezor?retryWrites...`
   - Final example:
     ```
     mongodb+srv://mawutor_admin:MyStrongPass123!@mawutorcluster.xxxxx.mongodb.net/mawutor-dezor?retryWrites=true&w=majority
     ```
   Keep this URI safe.

---

## Step 2 — Update Your Project Locally

In your project folder (`/home/user` or your local copy):

1. **Install mongoose:**
   ```bash
   npm install mongoose
   ```

2. **Backup old file-based db.js:**
   ```bash
   cp db.js db.js.filebackup
   ```

3. **Replace db.js with Atlas version:**
   ```bash
   cp db.atlas.js db.js
   ```
   (I already created `db.atlas.js` in this workspace — it's the Mongo version that keeps same function names: createUser, findUserByIdentifier, createTransaction, queryTransactions, etc.)

4. **Update .env file:**
   Create `.env` in root (copy from `.env.example`):
   ```
   PORT=3000
   JWT_SECRET=your-long-random-secret-32-chars
   MONGODB_URI=mongodb+srv://mawutor_admin:YOUR_PASSWORD@cluster.../mawutor-dezor?retryWrites=true&w=majority
   MONGODB_DB=mawutor-dezor
   ```

5. **Update package.json** (already done if you installed mongoose):
   Must contain `mongoose` in dependencies.

6. **Update server.js to await db calls** (important):
   Your old server.js called db functions without await. Mongo needs await.
   I created a patched server? If not, do this quick fix:
   - Open server.js
   - Search `db.findUserByIdentifier` → change to `await db.findUserByIdentifier`
   - Do same for ALL db calls: `readUsers`, `createUser`, `findUserByEmail`, `findUserByPhone`, `findUserById`, `findUserByResetToken`, `updateUser`, `createTransaction`, `getTransactionById`, `updateTransaction`, `softDeleteTransaction`, `queryTransactions`, `getStatements`, `getTrialBalance`

   **Easier:** I prepared `server.atlas.patch` instructions — just make every route handler already async (they are) and add `await` before each `db.*`.

   Example change:
   ```js
   // Before (file version, sync):
   const user = db.findUserByIdentifier(loginId);

   // After (Atlas, async):
   const user = await db.findUserByIdentifier(loginId);
   ```

7. **Test locally:**
   ```bash
   npm start
   # open http://localhost:3000, Register, Add transaction with MoMo 0244...
   ```
   Check Atlas → Data Explorer → mawutor-dezor database → collections Mawutorusers, Mawutortransactions → you should see docs.

---

## Step 3 — Migrate Existing Data (if you have old file data)

If you already have `data/users.json` & `data/transactions.json` from file version and want to keep them:

1. I created `migrate.js` in workspace:
   ```bash
   node migrate.js
   ```
   It reads local JSON files and inserts into Atlas (skips duplicates by id).

2. Or manually re-enter first admin via Register (easier for small data).

---

## Step 4 — Push to GitHub & Deploy on Render

1. Commit:
   ```bash
   git add db.js package.json package-lock.json db.atlas.js ATLAS_MIGRATION_GUIDE.md
   git commit -m "Migrate to MongoDB Atlas for permanent years storage + MoMo"
   git push
   ```

2. Render Dashboard → Your service `mawutor-app` → Environment → Add:
   - `MONGODB_URI` = same Atlas URI you used locally
   - `MONGODB_DB` = `mawutor-dezor`
   - `JWT_SECRET` = keep existing
   - `PORT` = `10000`

3. Render auto-redeploys. Check logs:
   ```
   [DB] Mongo connected - mawutor-dezor
   ✨ Mawutor Dezor Enterprise running...
   ```

4. Open Render URL → login → all old data now from Atlas (if migrated) and new data will persist for years even if Render sleeps.

---

## Step 5 — Verify It Works for Years

- Add transaction with MoMo `0244...` on phone
- Go to Atlas → Data Explorer → see transaction with momoNumber field
- Delete service on Render and redeploy — data still there in Atlas (permanent)
- Search by MoMo works same as before

### What you get now:
- **Free forever**: Atlas M0 512MB = ~200k transactions = 5+ years for 100 tx/day
- **No sleep loss**: Even if Render free sleeps, data safe in cloud
- **Same code**: All function names same, frontend unchanged, CSV/PDF with MoMo still works
- **Scalable**: If business grows, upgrade Atlas M10 ($57/mo) never need file again

---

## Quick Checklist

- [ ] Atlas account + M0 cluster created (Frankfurt)
- [ ] DB user `mawutor_admin` + password
- [ ] Network Access 0.0.0.0/0
- [ ] Copied MONGODB_URI
- [ ] Local: `npm install mongoose`, replaced db.js with db.atlas.js, added MONGODB_URI to .env, added await to server.js db calls
- [ ] Local test: register + add MoMo tx → visible in Atlas Explorer
- [ ] Git push
- [ ] Render env vars added MONGODB_URI
- [ ] Render logs show Mongo connected
- [ ] Export CSV backup weekly to Google Drive (still good practice)

---

## Fallback

If you ever want to go back to file-based: unset MONGODB_URI env var → app automatically falls back to file JSON (because db.atlas.js has `USE_MONGO` check).

Need the actual code files? They are in workspace:
- `db.atlas.js` = new Mongo version (replace db.js)
- `migrate.js` = migration script
- This guide = `ATLAS_MIGRATION_GUIDE.md`
