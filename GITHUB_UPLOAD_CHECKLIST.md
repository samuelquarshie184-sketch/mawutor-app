# GitHub Upload Checklist - Mawutor Dezor Enterprise v2

## ✅ EXACT Folders & Files to Upload to GitHub for Render

Upload **ALL** of these — nothing more, nothing less:

### Root Files (8 files):
```
/.must have:
  server.js               ← Main backend + serves frontend
  db.js                   ← Database layer (now with MoMo Number)
  package.json            ← Has "start": "node server.js"
  package-lock.json       ← Locks versions (recommended)
  .env.example            ← Shows what env vars needed
  .gitignore              ← Tells GitHub to ignore node_modules & data/*.json
  README.md               ← Project docs v2
  PROMPTS.md              ← Build prompts history
  DEPLOY_GUIDE.md         ← Novice deploy guide
  GITHUB_UPLOAD_CHECKLIST.md ← This file (optional but helpful)
```

### Folders (2 folders):
```
public/                   ← FRONTEND (must include all 3 files)
  public/index.html       ← SPA with MoMo columns + mobile bottom nav
  public/style.css        ← Mobile-friendly theme (navy/yellow/red)
  public/app.js           ← Logic for MoMo, mobile cards, tel: links

data/                     ← DATA FOLDER (only .gitkeep)
  data/.gitkeep           ← Keeps empty folder in GitHub
  // DO NOT upload data/users.json
  // DO NOT upload data/transactions.json (gitignored, auto-created by app)
```

### Final Tree to Upload:
```
mawutor-dezor-enterprise/
├── server.js
├── db.js
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
├── README.md
├── PROMPTS.md
├── DEPLOY_GUIDE.md
├── GITHUB_UPLOAD_CHECKLIST.md
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── data/
    └── .gitkeep
```

---

## ❌ DO NOT Upload These (Will Break or Large)

```
❌ node_modules/          ← 180+ MB, Render installs via npm install
❌ data/users.json         ← Your local users, gitignored
❌ data/transactions.json  ← Your local transactions, gitignored
❌ .env                    ← Your secret JWT_SECRET, NEVER push to GitHub
❌ .npm/ or .cache/        ← Temp files
❌ .DS_Store, dist/, etc.
```

Your `.gitignore` already handles this:
```
node_modules/
data/*.json
.env
.env.local
.DS_Store
```

---

## How to Upload - Two Methods

### Method 1: GitHub Website (Easiest for Novice)

1. Go to https://github.com → New Repository → Name: `mawutor-dezor-enterprise` → Public → Create
2. Click "Add file" → "Upload files"
3. **Drag these from your computer:**
   - All root files listed above
   - The `public` folder (drag the whole folder, GitHub will keep structure)
   - The `data` folder (only .gitkeep inside)
4. Commit directly to main
5. Done! Your repo should look exactly like the tree above.

### Method 2: Git Command Line (Faster)

```bash
# In your project folder where server.js is
git init
git add server.js db.js package.json package-lock.json .env.example .gitignore README.md PROMPTS.md DEPLOY_GUIDE.md GITHUB_UPLOAD_CHECKLIST.md public/ data/.gitkeep
git commit -m "v2 MoMo numbers + mobile friendly - ready for Render"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mawutor-dezor-enterprise.git
git push -u origin main
```

Replace YOUR_USERNAME with your GitHub username.

---

## Render Deployment Settings

Once uploaded to GitHub, go to Render:

1. Render.com → Dashboard → New + → Web Service → Connect your repo
2. Settings:
   - Name: mawutor-dezor-enterprise
   - Root Directory: (leave empty)
   - Environment: Node
   - Region: Closest to Ghana (Frankfurt or Ohio)
   - Branch: main
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free

3. Environment Variables → Add:
   - Key: `JWT_SECRET` Value: `a-long-random-string-like-9f3b82a1c7e...` (generate at random.org → 32 chars)
   - Key: `PORT` Value: `10000` (Render auto-sets if you leave blank)

4. Click "Create Web Service" → Wait for logs to say:
   ```
   ✨ Mawutor Dezor Enterprise running on http://localhost:10000
   ```

5. Open the URL Render gives you: `https://mawutor-dezor-enterprise-xxxx.onrender.com`

6. Register first user → becomes Admin → Start adding transactions with MoMo numbers from phone!

---

## Verify Upload Was Correct

After pushing to GitHub, check your repo page shows:
- Root has server.js, db.js, package.json visible
- public folder clickable with 3 files inside
- data folder has .gitkeep

If you see node_modules folder on GitHub, you uploaded too much — delete repo and re-upload using checklist above.

---

## For v2 Update (If You Already Deployed v1)

Just replace these files in GitHub with new versions:
- server.js (updated for MoMo)
- db.js (updated for MoMo)
- public/index.html (new columns + mobile nav)
- public/style.css (mobile friendly)
- public/app.js (MoMo logic + mobile cards)
- README.md, PROMPTS.md, DEPLOY_GUIDE.md

Commit → Push → Render redeploys automatically in 2-3 mins. No data loss (old tx show — for MoMo, edit to add).

---

You are ready! 📱💛❤️
