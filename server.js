/**
 * Mawutor Dezor Enterprise - Express API + Single Deployment Server v2.1
 * Atlas-ready: all db calls awaited, works with file JSON OR MongoDB Atlas
 * If MONGODB_URI env present, db.js uses Mongo; if not, falls back to file.
 */
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const { Server } = require('socket.io');

const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mawutor-dezor-enterprise-secret-2024-ho-dome';
const JWT_EXPIRES = '7d';

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Helpers ----------
function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, phone: user.phone, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// Auth middleware now async for Atlas
async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.findUserById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Admin only - attendants cannot close/open days' });
}

io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
});

function broadcastChange(action, transaction) {
  io.emit('transactions:changed', {
    action,
    transaction,
    timestamp: new Date().toISOString()
  });
}

function broadcastClosedDaysChange(action, closedDay) {
  io.emit('closedDays:changed', {
    action, // closed, opened
    closedDay,
    timestamp: new Date().toISOString()
  });
}

// ---------- Auth Routes ----------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    if (!name || !password) return res.status(400).json({ error: 'Name and password are required' });
    if (!email && !phone) return res.status(400).json({ error: 'Email or phone is required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    if (email && await db.findUserByEmail(email)) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    if (phone && await db.findUserByPhone(phone)) {
      return res.status(400).json({ error: 'Phone already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const allUsers = await db.readUsers();
    const finalRole = allUsers.length === 0 ? 'admin' : (role === 'admin' ? 'admin' : 'attendant');

    const user = await db.createUser({ name, email, phone, passwordHash, role: finalRole });
    const token = generateToken(user);
    const { passwordHash: _, resetToken, resetExpiry, ...safeUser } = user;

    res.status(201).json({ user: safeUser, token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, email, phone, password } = req.body;
    const loginId = identifier || email || phone;
    if (!loginId || !password) return res.status(400).json({ error: 'Identifier and password required' });

    const user = await db.findUserByIdentifier(loginId);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken(user);
    const { passwordHash: _, resetToken, resetExpiry, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error during login' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { identifier, email, phone } = req.body;
    const searchId = identifier || email || phone;
    if (!searchId) return res.status(400).json({ error: 'Email or phone required' });

    const user = await db.findUserByIdentifier(searchId);
    if (!user) return res.status(404).json({ error: 'No account found with that email/phone' });

    const resetToken = uuidv4() + '-' + Date.now().toString(36);
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await db.updateUser(user.id, { resetToken, resetExpiry });
    console.log(`[Password Reset] User ${user.id} token: ${resetToken}`);
    res.json({
      message: 'Password reset token generated. Use it within 1 hour.',
      resetToken,
      expiresAt: resetExpiry
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, resetToken, newPassword, password } = req.body;
    const t = token || resetToken;
    const pwd = newPassword || password;
    if (!t || !pwd) return res.status(400).json({ error: 'Token and new password required' });
    if (pwd.length < 6) return res.status(400).json({ error: 'Password must be at least 6 chars' });

    const user = await db.findUserByResetToken(t);
    if (!user) return res.status(400).json({ error: 'Invalid reset token' });
    if (!user.resetExpiry || new Date(user.resetExpiry) < new Date()) {
      return res.status(400).json({ error: 'Reset token expired. Request a new one.' });
    }

    const passwordHash = await bcrypt.hash(pwd, 10);
    await db.updateUser(user.id, { passwordHash, resetToken: null, resetExpiry: null });

    res.json({ message: 'Password reset successful. You can now login.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const { passwordHash, resetToken, resetExpiry, ...safe } = req.user;
  res.json({ user: safe });
});

// ---------- Transaction CRUD ----------
app.get('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const { network, startDate, endDate, clientName, momoNumber, search, branch } = req.query;
    const txs = await db.queryTransactions({ network, startDate, endDate, clientName, momoNumber, search: search || clientName, branch });
    res.json(txs);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.get('/api/transactions/:id', authMiddleware, async (req, res) => {
  const tx = await db.getTransactionById(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  res.json(tx);
});

app.post('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const { network, date, clientName, momoNumber, capital, deposit, withdrawal, branch } = req.body;
    if (!network || !['MTN', 'Telecel'].includes(network)) {
      return res.status(400).json({ error: 'Network must be MTN or Telecel' });
    }
    if (!clientName) return res.status(400).json({ error: 'Client name required' });

    // Check if day is closed for non-admin
    if (date){
      const closed = await db.isDayClosed(date, network);
      if (closed && req.user.role !== 'admin'){
        return res.status(403).json({ error: `Day ${db.toISODate(date)} is closed. Only admin can add transactions for closed days.` });
      }
    }

    const tx = await db.createTransaction({
      network,
      date,
      clientName,
      momoNumber: momoNumber || '',
      capital: capital || 0,
      deposit: deposit || 0,
      withdrawal: withdrawal || 0,
      branch: branch || 'Ho Dome',
      createdBy: req.user.id
    });

    broadcastChange('created', tx);
    res.status(201).json(tx);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Failed to create transaction' });
  }
});

app.put('/api/transactions/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await db.getTransactionById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Transaction not found' });

    // Check if existing transaction's day is closed for non-admin
    if (existing.date){
      const closedExisting = await db.isDayClosed(existing.date, existing.network);
      if (closedExisting && req.user.role !== 'admin'){
        return res.status(403).json({ error: `Cannot edit — Day ${db.toISODate(existing.date)} is closed. Only admin can edit closed days.` });
      }
    }
    // If trying to change date to a closed day, block
    if (req.body.date){
      const closedNew = await db.isDayClosed(req.body.date, req.body.network || existing.network);
      if (closedNew && req.user.role !== 'admin'){
        return res.status(403).json({ error: `Cannot move to closed day ${db.toISODate(req.body.date)}. Only admin.` });
      }
    }

    const updates = {};
    if (req.body.network !== undefined) updates.network = req.body.network;
    if (req.body.date !== undefined) updates.date = req.body.date;
    if (req.body.clientName !== undefined) updates.clientName = req.body.clientName;
    if (req.body.momoNumber !== undefined) updates.momoNumber = req.body.momoNumber;
    if (req.body.capital !== undefined) updates.capital = req.body.capital;
    if (req.body.deposit !== undefined) updates.deposit = req.body.deposit;
    if (req.body.withdrawal !== undefined) updates.withdrawal = req.body.withdrawal;
    if (req.body.branch !== undefined) updates.branch = req.body.branch;

    const updated = await db.updateTransaction(req.params.id, updates, req.user.id);
    if (!updated) return res.status(404).json({ error: 'Update failed' });

    broadcastChange('updated', updated);
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

app.delete('/api/transactions/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await db.getTransactionById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Transaction not found' });
    // Check closed day
    if (existing.date){
      const closed = await db.isDayClosed(existing.date, existing.network);
      if (closed && req.user.role !== 'admin'){
        return res.status(403).json({ error: `Cannot delete — Day ${db.toISODate(existing.date)} is closed. Only admin can delete closed days.` });
      }
    }
    const deleted = await db.softDeleteTransaction(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ error: 'Transaction not found' });
    broadcastChange('deleted', deleted);
    res.json({ message: 'Transaction deleted', id: req.params.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// ---------- Statements ----------
app.get('/api/statements', authMiddleware, async (req, res) => {
  try {
    const { network, startDate, endDate, clientName, momoNumber, search, branch } = req.query;
    let statements = await db.getStatements({ network, startDate, endDate, clientName, momoNumber, search: search || clientName });
    if (branch) statements = statements.filter(s => s.branch?.toLowerCase() === branch.toLowerCase());
    res.json(statements);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch statements' });
  }
});

// ---------- Trial Balance ----------
app.get('/api/trial-balance', authMiddleware, async (req, res) => {
  try {
    const { date, asOfDate } = req.query;
    const result = await db.getTrialBalance({ asOfDate: asOfDate || date });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch trial balance' });
  }
});

// ---------- Closed Days (Daily Closing Feature) ----------
app.get('/api/closed-days', authMiddleware, async (req, res) => {
  try {
    const days = await db.getClosedDays();
    res.json(days);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch closed days' });
  }
});

app.post('/api/closed-days', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { date, network, branch } = req.body;
    if (!date) return res.status(400).json({ error: 'Date required (YYYY-MM-DD)' });
    const iso = db.toISODate(date);
    if (!iso) return res.status(400).json({ error: 'Invalid date' });

    // Prevent closing future dates? Allow but warn - allow only today or past for business logic
    const today = new Date().toISOString().slice(0,10);
    if (iso > today) {
      return res.status(400).json({ error: 'Cannot close future date' });
    }

    const closed = await db.closeDay({ date: iso, network: network||null, closedBy: req.user.id, branch: branch||'Ho Dome' });
    broadcastClosedDaysChange('closed', closed);
    res.status(201).json(closed);
  } catch (e) {
    console.error(e);
    if (e.message && e.message.includes('duplicate') || e.code===11000){
      return res.status(400).json({ error: 'Day already closed' });
    }
    res.status(500).json({ error: e.message || 'Failed to close day' });
  }
});

app.delete('/api/closed-days/:date', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { date } = req.params;
    const { network } = req.query;
    const iso = db.toISODate(date);
    if (!iso) return res.status(400).json({ error: 'Invalid date' });
    const opened = await db.openDay({ date: iso, network: network||null });
    if (!opened) return res.status(404).json({ error: 'Closed day not found' });
    broadcastClosedDaysChange('opened', opened);
    res.json({ message: 'Day reopened', closedDay: opened });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to reopen day' });
  }
});

// ---------- Reports ----------
app.get('/api/reports/csv', authMiddleware, async (req, res) => {
  try {
    const { network, startDate, endDate, clientName, momoNumber, search } = req.query;
    const txs = await db.queryTransactions({ network, startDate, endDate, clientName, momoNumber, search: search || clientName });

    const headers = ['Date', 'Network', 'Client Name', 'MoMo Number', 'Capital (GHS)', 'Deposit (GHS)', 'Withdrawal (GHS)', 'Balance (GHS)', 'Branch', 'By'];
    const rows = txs.map(t => {
      const d = new Date(t.date).toLocaleString('en-GH');
      return [
        `"${d}"`,
        t.network,
        `"${(t.clientName||'').replace(/"/g,'""')}"`,
        `"${(t.momoNumber||'').replace(/"/g,'""')}"`,
        (Number(t.capital)||0).toFixed(2),
        (Number(t.deposit)||0).toFixed(2),
        (Number(t.withdrawal)||0).toFixed(2),
        (Number(t.balance)||0).toFixed(2),
        `"${(t.branch||'').replace(/"/g,'""')}"`,
        t.createdBy || ''
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const filename = `Mawutor_${network||'All'}_${new Date().toISOString().slice(0,10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'CSV export failed' });
  }
});

app.get('/api/reports/pdf', authMiddleware, async (req, res) => {
  try {
    const { network, startDate, endDate, clientName, momoNumber, search } = req.query;
    const txs = await db.queryTransactions({ network, startDate, endDate, clientName, momoNumber, search: search || clientName });
    const trial = await db.getTrialBalance({ asOfDate: endDate });

    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    const filename = `Mawutor_${network||'All'}_${new Date().toISOString().slice(0,10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    doc.fontSize(16).font('Helvetica-Bold').text('Mawutor Dezor Enterprise', { align: 'center' });
    doc.fontSize(9).font('Helvetica').text('Ho Dome, Volta Region, Ghana | Mobile Money Merchant Bookkeeping', { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(11).font('Helvetica-Bold').text(`${network ? network + ' ' : ''}Transactions Report`, { align: 'center' });
    if (startDate || endDate || clientName || search) {
      doc.fontSize(8).font('Helvetica').text(`Filters: ${network||'All'} | ${startDate||'Start'} to ${endDate||'Today'} | Search: ${search||clientName||momoNumber||'None'}`, { align: 'center' });
    }
    doc.moveDown(0.3);
    doc.fontSize(7).text(`Generated: ${new Date().toLocaleString()} | User: ${req.user.name} | Total Records: ${txs.length} | Mode: ${trial._mode||'file'}`, { align: 'center' });
    doc.moveDown(0.8);

    const tableTop = doc.y;
    const col = {
      date: 30,
      network: 105,
      client: 150,
      momo: 250,
      capital: 345,
      deposit: 405,
      withdrawal: 465,
      balance: 530,
      branch: 595,
      by: 660
    };

    function drawHeader(y) {
      doc.fontSize(7).font('Helvetica-Bold');
      doc.text('Date/Time', col.date, y, { width: 70 });
      doc.text('Net', col.network, y, { width: 35 });
      doc.text('Client', col.client, y, { width: 90 });
      doc.text('MoMo Number', col.momo, y, { width: 85 });
      doc.text('Capital', col.capital, y, { width: 55, align: 'right' });
      doc.text('Deposit', col.deposit, y, { width: 55, align: 'right' });
      doc.text('Withdraw', col.withdrawal, y, { width: 55, align: 'right' });
      doc.text('Balance', col.balance, y, { width: 55, align: 'right' });
      doc.text('Branch', col.branch, y, { width: 60 });
      doc.text('By', col.by, y, { width: 70 });
      doc.moveTo(30, y+10).lineTo(810, y+10).stroke();
    }

    drawHeader(tableTop);
    let y = tableTop + 14;

    doc.font('Helvetica').fontSize(6.5);
    for (let i = 0; i < txs.length; i++) {
      const t = txs[i];
      if (y > 540) {
        doc.addPage();
        y = 30;
        drawHeader(y);
        y += 14;
        doc.font('Helvetica').fontSize(6.5);
      }
      const dt = new Date(t.date).toLocaleString('en-GH', { dateStyle: 'short', timeStyle: 'short' });
      doc.text(dt, col.date, y, { width: 70 });
      doc.text(t.network, col.network, y, { width: 35 });
      doc.text((t.clientName||'').slice(0,22), col.client, y, { width: 90 });
      doc.text((t.momoNumber||'-').slice(0,15), col.momo, y, { width: 85 });
      doc.text((Number(t.capital)||0).toFixed(2), col.capital, y, { width: 55, align: 'right' });
      doc.text((Number(t.deposit)||0).toFixed(2), col.deposit, y, { width: 55, align: 'right' });
      doc.text((Number(t.withdrawal)||0).toFixed(2), col.withdrawal, y, { width: 55, align: 'right' });
      doc.text((Number(t.balance)||0).toFixed(2), col.balance, y, { width: 55, align: 'right' });
      doc.text((t.branch||'').slice(0,12), col.branch, y, { width: 60 });
      doc.text((t.createdBy||'').slice(0,8), col.by, y, { width: 70 });
      y += 11;
      if (i % 5 === 0) {
        doc.moveTo(30, y-2).lineTo(810, y-2).strokeOpacity(0.08).stroke().strokeOpacity(1);
      }
    }

    y += 8;
    if (y > 520) { doc.addPage(); y = 40; }
    doc.moveTo(30, y).lineTo(810, y).stroke();
    y += 5;
    doc.font('Helvetica-Bold').fontSize(7);
    const agg = network ? trial[network] : trial.total;
    doc.text(`TOTALS (${network||'All Networks'}):`, col.client, y, { width: 90 });
    doc.text(agg.capital.toFixed(2), col.capital, y, { width: 55, align: 'right' });
    doc.text(agg.deposit.toFixed(2), col.deposit, y, { width: 55, align: 'right' });
    doc.text(agg.withdrawal.toFixed(2), col.withdrawal, y, { width: 55, align: 'right' });
    doc.text(agg.closing.toFixed(2), col.balance, y, { width: 55, align: 'right' });

    y += 16;
    doc.font('Helvetica').fontSize(6).text('Balance formula: balance = capital + deposit - withdrawal | All amounts in GHS | MoMo Number = Client telephone', 30, y);
    doc.text('Mawutor Dezor Enterprise - Confidential - Includes MoMo Numbers - ' + (trial._mode==='mongodb'?'MongoDB Atlas Permanent':'File Storage'), { align: 'center' });

    doc.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'PDF export failed: ' + e.message });
  }
});

// ---------- Fallback for SPA ----------
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- Start ----------
(async () => {
  try {
    await db.ensureDataFiles();
    console.log(`💾 Storage mode: ${db._USE_MONGO ? 'MongoDB Atlas (Permanent for years)' : 'File JSON (Ephemeral - use Atlas for years)'}`);
  } catch (e) {
    console.error('DB init error:', e.message);
  }
  server.listen(PORT, () => {
    console.log(`\n✨ Mawutor Dezor Enterprise running on http://localhost:${PORT}`);
    console.log(`📍 Ho Dome, Volta Region, Ghana`);
    console.log(`🔐 JWT_SECRET: ${JWT_SECRET === 'mawutor-dezor-enterprise-secret-2024-ho-dome' ? 'Using default (set JWT_SECRET env for production)' : 'Custom set'}`);
  });
})();
