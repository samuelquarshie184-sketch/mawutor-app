# Build Prompts — Mawutor Dezor Enterprise App

This file is the set of prompts used to build the app, broken into the same pieces a developer (or an AI coding tool like Claude Code) would tackle one at a time. Keep this file — if you want to extend the app later (add a feature, fix a bug, or rebuild a part of it), feeding one of these prompts to an AI coding assistant along with your existing code is the fastest way to get consistent, working results.

---

## 1. Master project prompt (the overall brief)

```
Build a full-stack bookkeeping web application called "Mawutor Dezor Enterprise" for a
mobile money merchant business located at Ho Dome, Volta Region, Ghana. This is a real
production application, not a prototype — it must persist real data and support multiple
users signing in at once.
  
Requirements:
- Dashboard with 4 tabs: MTN, Telecel, Statements, Trial Balance
- MTN and Telecel tabs are independent transaction ledgers with: auto date/time, client
  name, capital at start, amount deposited, amount withdrawn, and an auto-calculated
  balance using the formula: balance = capital + deposit - withdrawal
- All money values formatted as GHS currency with thousands separators and 2 decimal
  places, e.g. GHS1,000.00
- Full CRUD (create, view, edit, delete) on every transaction
- Statements tab: a live, unified feed of all transactions (MTN + Telecel), styled like a
  bank statement, filterable by network and date range
- Trial Balance tab: totals of capital, deposits, withdrawals, and closing balance across
  both networks, as of any selected date
- CSV and PDF export for any date range, on both the network tabs and the statements tab
- Multi-user login via email or phone number, with password reset
- All data updates live across tabs in real time when any user adds/edits/deletes a
  transaction
- Must include both a backend (API + database) and a frontend, deployed together as a
  single service — not as two separate deployments
```

This top-level prompt is what you'd give an AI tool as the starting brief. Everything below is how that brief gets broken into buildable pieces.

## 2. Backend data model prompt

```
Build a simple file-based data storage layer (db.js) for this app — no external database,
so it can deploy on Render's free tier with nothing else to set up. Store two collections
as JSON files on disk (data/users.json, data/transactions.json), auto-creating the files
and folder if they don't exist yet.
  
1. User: id (uuid), name, email, phone, hashed password, role (admin or attendant), and
   fields to support a password-reset flow (reset token + expiry).
2. Transaction: id (uuid), network (MTN or Telecel), date, client name, capital, deposit,
   withdrawal, an auto-calculated balance field, branch, which user created/last updated
   it, and a soft-delete flag (so deleted transactions are hidden but not destroyed,
   preserving an audit trail).
  
Auto-calculate balance = capital + deposit - withdrawal whenever a transaction is saved
or updated. Expose plain functions (createUser, findUserByIdentifier, createTransaction,
queryTransactions, etc.) so the rest of the app never touches the JSON files directly —
that keeps it easy to swap in a real database later without changing any routes.
```

## 3. Backend API prompt

```
Build an Express.js REST API with:
- POST /api/auth/register, /api/auth/login (JWT-based), /api/auth/forgot-password,
  /api/auth/reset-password
- Full CRUD endpoints for transactions, with query filtering by network, date range,
  and client name
- A /api/statements endpoint returning a combined, chronologically sorted feed across
  both networks
- A /api/trial-balance endpoint that aggregates totals per network as of a given date
- /api/reports/csv and /api/reports/pdf endpoints that generate downloadable reports
  for a given network and date range (use pdfkit for PDF generation)
- Use Socket.io to broadcast an event whenever a transaction is created, updated, or
  deleted, so connected clients can refresh live
- Protect all transaction/report/statement routes with JWT authentication middleware
```

## 4. Frontend prompt

```
Build a single-page frontend (vanilla HTML/CSS/JS, no build step) that:
- Shows a login/register/forgot-password screen first
- After login, shows a dashboard with 4 tabs: MTN, Telecel, Statements, Trial Balance
- Each network tab shows summary cards (capital, deposits, withdrawals, net balance),
  a filterable table of transactions with edit/delete buttons, an "Add Transaction"
  modal, and CSV/PDF export buttons
- Statements tab shows a combined running-balance feed with network + date filters
- Trial Balance tab shows totals per network as of a selectable date
- Connects to the backend's Socket.io server and refreshes data live when transactions
  change anywhere in the app
- Uses a professional, colorful theme: dark navy base with MTN yellow (#FFCC00) and
  Telecel red (#E4002B) as accent colors, card-based layout
```

## 5. Single-deployment architecture prompt

```
Configure the Express server so it serves the frontend's static files directly
(app.use(express.static('public'))) and falls back to index.html for any non-API route.
This means the whole project — API and frontend — runs as one Node.js process and
deploys as a single service, with no separate frontend hosting needed.
```

## 6. Deployment prompt

```
Prepare this project for deployment on Render's free tier as a single web service, with
no external database needed:
- package.json with a "start" script (node server.js)
- Environment variables read from process.env (JWT_SECRET, PORT)
- .env.example showing which variables are needed
- A .gitignore that excludes the generated data/*.json files (so each environment builds
  its own local data) and never commits the .env file
- A clear note in the README that Render's free-tier disk isn't guaranteed to persist
  across redeploys/sleep cycles, so this is a "get live fast" setup — real production
  data should later move to a proper database (e.g. MongoDB Atlas's free tier, which
  never expires, unlike Render's own free database tier)
```

---

## How to reuse these

If you want to add a new feature yourself later — for example, a "daily closing" feature that locks a day's transactions — you'd write a prompt in the same style:

```
Add a "close day" feature to the existing Mawutor Dezor Enterprise app (attached/pasted
below). Once a day is closed by an admin user, transactions dated that day become
read-only for all other users. Add a "Close Day" button on each network tab, a
closedDays.json file managed through db.js, and a check in the transaction edit/delete
routes that blocks changes to transactions in a closed day.
```

Paste your current `server.js`, `db.js`, and relevant frontend file alongside a prompt like that, and an AI coding tool has everything it needs to extend the app consistently with what's already built.

## Swapping in a real database later

When you're ready to move off file-based storage (see the persistence note in the README), the prompt is small and contained, because everything routes through `db.js`:

```
Replace the file-based storage in db.js with MongoDB (using Mongoose), while keeping the
exact same exported function names and behavior (createUser, findUserByIdentifier,
createTransaction, updateTransaction, softDeleteTransaction, queryTransactions, etc.).
Do not change server.js, the frontend, or any route — only db.js and the database
connection setup should change. Read MONGODB_URI from an environment variable.
```

---

## 7. v2 Update Prompt — MoMo Numbers + Mobile Friendly (July 2026)

This is the prompt that was used to upgrade v1 → v2 without breaking anything:

```
Kindly integrate add momo numbers to all tabs, so add transaction functions
should also have telephone numbers slot and this must also appear on all tabs,
statements, trial balance and live data entries on dashboard. Remember not to
strip out, duplicate, nothing freezes and audit to see if everything works
and tell me as a novice to deploy the new update, and make the app mobile
friendly to be used on mobile phones both androids and iphones.

Requirements for update:
- Backend db.js: add momoNumber field to Transaction model, normalize (trim spaces),
  backfill old records with '', expose in createTransaction, updateTransaction,
  queryTransactions - unified search should match clientName OR momoNumber.
  getTransactionById must return momoNumber default '' for backward compatibility.
- Backend server.js: accept momoNumber in POST/PUT, expose in query filters
  (search param searches both name & number), include in CSV headers,
  include in PDF with adjusted columns, include in statements & trial-balance
  detail audit feed.
- Frontend index.html: add MoMo Number input (type tel, required, pattern 9-15 digits,
  Ghana format) to modal, add MoMo Number column to MTN table, Telecel table,
  Statements table, and Trial Balance audit detail table. Search placeholders
  must say "Search client or MoMo #".
- Frontend app.js: render momoNumber everywhere, mobile cards list + tap-to-call
  tel: links, validation required 9-13 digits, include in payload, preserve live
  socket toast showing client + momoNumber, export filenames include _with_MoMo.
- Style.css: mobile-friendly overhaul - bottom nav (<900px), FAB + button,
  mobile cards replacing tables on small screens, 16px inputs to prevent iOS zoom,
  safe-area-inset-bottom for iPhone notch, min tap targets 44px, tel link styling,
  passive touch listeners, no stripping of existing navy/yellow/red theme.
- Audit: create transactions with MoMo for MTN & Telecel, query by network,
  search by partial MoMo, check statements include runningBalance + momoNumber,
  trial balance + audit feed, CSV column, PDF generation HTTP 200.
- Docs: update README with v2 notes, create DEPLOY_GUIDE.md novice steps for Render
  free tier, how to push update without data loss.
```

Result: All tabs now include MoMo numbers, search works across name/phone, exports include MoMo, mobile UI with bottom nav + FAB + card view, tel: links, no freezes/duplicates.

