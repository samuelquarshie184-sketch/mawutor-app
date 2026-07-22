# Mawutor Dezor Enterprise — Mobile Money Bookkeeping for Ghana

**Built for Ghana MoMo Merchants — Not only Ho, for all Ghana: Accra, Kumasi, Tamale, Cape Coast, Takoradi, Sunyani, all regions**

---

## 📱 Why Every MoMo Merchant in Ghana Needs This

**Real Problem:** Paper ledger loses money, mixing customers by name only, no MoMo number search, no offline, no audit.

**Our Solution:**

👤 **Client + MoMo Number Together**
- Add transaction: Client name + MoMo Number (required, Ghana format 0244...)
- Search by name OR phone 0244... in all tabs
- Tap MoMo number → Call customer directly (tel: link)

📴 **Works Offline in Market**
- No internet in market? No problem. Add transactions offline → Yellow "Queued Offline" badge → Auto-sync when back online
- Offline banner shows queued count, Statements & Trial cached for offline viewing
- PWA caches app shell, works airplane mode

🔒 **Daily Closing Lock (Admin Only) — NEW**
- MTN tab → 🔒 Close Day → Select date YYYY-MM-DD → Choose MTN / Telecel / All → Close
- Attendants cannot add/edit/delete transactions for closed day — see 🔒 Closed badge
- Only admin can reopen: Trial Balance → Manage Closed Days → Reopen
- Prevents night fraud, keeps audit clean, broadcast live to all phones
- File: closedDays.json managed through db.js, check in edit/delete routes blocks changes

💛 **MTN & Telecel Separate Ledgers**
- Auto date/time, client, MoMo, capital at start, deposit, withdrawal, auto balance = capital+deposit-withdrawal
- GHS1,000.00 formatting

📄 **Bank-Statement Feed + Running Balance**
- Unified MTN+Telecel chronologically sorted, running cumulative closing balance

⚖️ **Trial Balance Any Date**
- Totals capital, deposits, withdrawals, closing per network as of any date + audit feed with MoMo

📊 **CSV & PDF Export with MoMo**
- Any date range, with MoMo numbers, for accountant

👥 **Multi-User Live Sync**
- Admin + attendants login via email/phone, JWT, password reset, Socket.io live

📲 **Install on Android & iPhone**
- Android Chrome Menu ⋮ → Install App / Add to Home Screen
- iPhone Safari Share → Add to Home Screen
- Icon M with MTN yellow #FFCC00 + Telecel red #E4002B on navy #0f1e3a, standalone, splash screen

☁️ **Atlas Cloud Permanent for Years**
- File JSON wipes on Render free sleep, Atlas MongoDB free 512MB = 5+ years never expires

---

## 🔒 Daily Closing Feature Details

For Ghana shops to prevent fraud:
- Admin only can close: POST /api/closed-days {date, network, branch}
- Check in PUT/DELETE routes: if isDayClosed(date, network) and role != admin → 403 "Day closed"
- File fallback: data/closedDays.json managed through db.js
- Frontend: Close Day button on MTN/Telecel tabs, closed badge, info alert, Trial Balance → Manage Closed Days table with Reopen button

---

## 💰 Pricing for Ghana — General

### Starter — GHS 1,200 once
For small kiosk
- MTN + Telecel ledgers
- MoMo numbers + search
- Offline PWA + Install
- CSV/PDF
- 1 user, setup + 30min training

### Pro Merchant — MOST POPULAR — GHS 1,500 once + GHS 300/year
Best for Ho, Accra, Kumasi, Tamale
- Everything Starter
- Daily Closing Lock (Admin)
- Multi-user live sync
- Statements + Trial Balance
- Atlas permanent for years
- Offline queue + tel: links
- 2 users + 1hr training

### Monthly — GHS 120/mo
Small monthly
- All Pro features
- Atlas permanent
- Offline PWA
- Daily Closing Lock
- WhatsApp support
- Cancel anytime

Custom: AirtelTigo, extra branch, source code GHS 5k-8k

---

## 📞 Developed by Samquarsh — Contact 0558103988

**Contact:** 0558103988 | WhatsApp: https://wa.me/233558103988

For Mobile Money merchants across Ghana — Accra, Kumasi, Ho, Tamale, Cape Coast, Takoradi, Sunyani, all regions.

Built with MTN Yellow #FFCC00 + Telecel Red #E4002B + Navy #0f1e3a
Offline PWA • Atlas Permanent • Daily Closing Lock • MoMo Numbers

**Live Demo:** https://mawutor-dezor-enterprise.onrender.com
**Install:** Android Chrome Menu → Install, iPhone Safari Share → Add to Home Screen
**Works offline after first visit**

---

## WhatsApp Pitch (Copy & Send to MoMo Groups):

```
📱 Mawutor Dezor Enterprise - MoMo Bookkeeping for Ghana

Tired of paper losses? 

✅ Client + MoMo Number (search by 0244..., tap to call)
✅ Works OFFLINE in market - queued, auto-sync when online
✅ MTN & Telecel separate ledgers, balance auto = capital+deposit-withdrawal
✅ Daily Closing Lock - Admin closes day, attendants cannot edit (prevents fraud)
✅ Bank statement feed + running balance + Trial Balance any date
✅ CSV/PDF with MoMo numbers
✅ Multi-user live sync - 2 phones see same instantly
✅ Install on Android & iPhone like MTN app, works offline
✅ Atlas cloud - safe for years, never wipes like file

For ALL Ghana - Accra, Kumasi, Ho, Tamale, everywhere

Price: GHS 1,500 once + GHS 300/year OR GHS 120/month
Setup + training included

Demo: https://mawutor-dezor-enterprise.onrender.com

Developed by Samquarsh - Call 0558103988
WhatsApp: 0558103988

Not only Ho - for all Ghana MoMo merchants!
```

---

## Footer Credit (Now in App Dashboard):

App dashboard footer now shows:
> Mawutor Dezor Enterprise • Ho Dome • X txs • MoMo • PWA • Cache: ... 
> Developed by Samquarsh | Contact: 0558103988 • Ghana Mobile Money Ledger • Offline PWA • Atlas Permanent

Auth page header also shows: Developed by Samquarsh • 0558103988
