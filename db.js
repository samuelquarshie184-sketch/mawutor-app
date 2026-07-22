/**
 * Mawutor Dezor Enterprise - MongoDB Atlas Data Layer v2.1
 * Replaces file-based db.js with MongoDB (Mongoose) while keeping same function names.
 * Works with MoMo Numbers everywhere.
 * If MONGODB_URI is NOT set, it falls back to original file-based JSON for local dev.
 */
const { v4: uuidv4 } = require('uuid');

// Check if we should use MongoDB
const USE_MONGO = !!process.env.MONGODB_URI;

let mongoose, User, Transaction, ClosedDay;
let fileDb = null; // fallback

// ---------- Helpers (shared) ----------
function normalizeMomoNumber(num){
  if(!num) return '';
  return String(num).trim().replace(/\s+/g,'').replace(/-/g,'');
}
function calcBalance(capital, deposit, withdrawal){
  const c = Number(capital)||0, d=Number(deposit)||0, w=Number(withdrawal)||0;
  return parseFloat((c+d-w).toFixed(2));
}
function isValidObjectId(id){
  try {
    if (!id || typeof id !== 'string') return false;
    // ObjectId is 24 hex chars
    return /^[a-fA-F0-9]{24}$/.test(id) && (() => {
      try { return mongoose && mongoose.Types && mongoose.Types.ObjectId.isValid(id); } catch { return true; }
    })();
  } catch { return false; }
}
function buildIdFilter(id){
  const or = [{ id }];
  if (isValidObjectId(id)) or.push({ _id: id });
  return { $or: or };
}
function buildIdFilterWithDeleted(id, includeDeleted){
  const base = buildIdFilter(id);
  if (!includeDeleted){
    return { $and: [base, { deleted: false }] };
  }
  return base;
}

// ---------- MONGO SETUP ----------
async function initMongo(){
  if (!USE_MONGO) return;
  if (mongoose && mongoose.connection.readyState === 1) return;

  mongoose = require('mongoose');

  // Cache connection in global for hot-reload (Render)
  if (global._mongooseConn && global._mongooseConn.readyState === 1){
    mongoose = global._mongooseConn;
    // models already registered
    User = mongoose.models.MawutorUser || mongoose.model('MawutorUser');
    Transaction = mongoose.models.MawutorTransaction || mongoose.model('MawutorTransaction');
    return;
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB || 'mawutor-dezor',
  });
  global._mongooseConn = mongoose;

  if (!mongoose.models.MawutorUser){
    const UserSchema = new mongoose.Schema({
      id: { type: String, default: () => uuidv4(), unique: true },
      name: { type: String, required: true, trim: true },
      email: { type: String, lowercase: true, trim: true, default: null },
      phone: { type: String, trim: true, default: null },
      passwordHash: { type: String, required: true },
      role: { type: String, enum: ['admin','attendant'], default: 'attendant' },
      resetToken: { type: String, default: null },
      resetExpiry: { type: String, default: null },
    }, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });
    UserSchema.index({ email: 1 }, { sparse: true });
    UserSchema.index({ phone: 1 }, { sparse: true });
    UserSchema.index({ resetToken: 1 }, { sparse: true });
    User = mongoose.model('MawutorUser', UserSchema);
  } else {
    User = mongoose.model('MawutorUser');
  }

  if (!mongoose.models.MawutorTransaction){
    const TxSchema = new mongoose.Schema({
      id: { type: String, default: () => uuidv4(), unique: true },
      network: { type: String, enum: ['MTN','Telecel'], required: true },
      date: { type: Date, required: true },
      clientName: { type: String, required: true, trim: true },
      momoNumber: { type: String, default: '', trim: true },
      capital: { type: Number, default: 0 },
      deposit: { type: Number, default: 0 },
      withdrawal: { type: Number, default: 0 },
      balance: { type: Number, default: 0 },
      branch: { type: String, default: 'Ho Dome' },
      createdBy: { type: String, default: null },
      updatedBy: { type: String, default: null },
      deleted: { type: Boolean, default: false },
      deletedAt: { type: Date, default: null },
    }, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });
    TxSchema.index({ network: 1 });
    TxSchema.index({ momoNumber: 1 });
    TxSchema.index({ clientName: 1 });
    TxSchema.index({ deleted: 1, network: 1, date: 1 });
    Transaction = mongoose.model('MawutorTransaction', TxSchema);
  } else {
    Transaction = mongoose.model('MawutorTransaction');
  }

  if (!mongoose.models.MawutorClosedDay){
    const ClosedDaySchema = new mongoose.Schema({
      id: { type: String, default: () => uuidv4(), unique: true },
      date: { type: String, required: true, index: true }, // YYYY-MM-DD
      network: { type: String, default: null }, // null = all networks, or MTN/Telecel
      closedBy: { type: String, default: null },
      closedAt: { type: Date, default: () => new Date() },
      branch: { type: String, default: 'Ho Dome' }
    }, { timestamps: true });
    ClosedDaySchema.index({ date: 1, network: 1 }, { unique: true });
    ClosedDay = mongoose.model('MawutorClosedDay', ClosedDaySchema);
  } else {
    ClosedDay = mongoose.model('MawutorClosedDay');
  }
}

// Initialize immediately if Mongo URI present
if (USE_MONGO){
  initMongo().catch(err => console.error('[DB] Mongo connect error:', err.message));
} else {
  // Fallback to file DB (original logic)
  fileDb = require('./db.js.filebackup') || null;
  // If backup not found, use require of old implementation inline? We'll just require fs version
  try {
    // Keep original file-based implementation as fallback
    if (!fileDb){
      // Lazy load original file code from ./db.js (old) - but we overwrote? So we store backup first
      // This file is expected to be renamed from old db.js -> db.js.filebackup by migration script
      // If not present, we will initialize empty file logic minimal
      const fs = require('fs'), path = require('path');
      const DATA_DIR = path.join(__dirname, 'data');
      const USERS_FILE = path.join(DATA_DIR, 'users.json');
      const TX_FILE = path.join(DATA_DIR, 'transactions.json');
      const ensure = () => {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR,{recursive:true});
        if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE,'[]');
        if (!fs.existsSync(TX_FILE)) fs.writeFileSync(TX_FILE,'[]');
      };
      fileDb = {
        ensure,
        read: (f)=>{ ensure(); try{ return JSON.parse(fs.readFileSync(f,'utf8')||'[]'); }catch{ return []; } },
        write: (f,d)=>{ ensure(); fs.writeFileSync(f, JSON.stringify(d,null,2)); },
        USERS_FILE, TX_FILE
      };
    }
  } catch(e){ console.error('File fallback init failed', e.message); }
}

// ---------- FILE FALLBACK IMPLEMENTATION (for local dev without MONGODB_URI) ----------
function fileFallback(){
  if (USE_MONGO) throw new Error('File fallback called in Mongo mode');
  const fs = require('fs');
  const path = require('path');
  const DATA_DIR = path.join(__dirname, 'data');
  const USERS_FILE = path.join(DATA_DIR, 'users.json');
  const TX_FILE = path.join(DATA_DIR, 'transactions.json');
  const CLOSED_FILE = path.join(DATA_DIR, 'closedDays.json');
  const ensure = () => {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR,{recursive:true});
    if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE,'[]');
    if (!fs.existsSync(TX_FILE)) fs.writeFileSync(TX_FILE,'[]');
    if (!fs.existsSync(CLOSED_FILE)) fs.writeFileSync(CLOSED_FILE,'[]');
  };
  const readJson = (file) => {
    ensure();
    try { return JSON.parse(fs.readFileSync(file,'utf8')||'[]'); } catch { return []; }
  };
  const writeJson = (file,data) => {
    ensure(); fs.writeFileSync(file, JSON.stringify(data,null,2));
  };
  return { ensure, readJson, writeJson, USERS_FILE, TX_FILE, CLOSED_FILE };
}

function toISODate(d){
  // Convert any date to YYYY-MM-DD
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0,10);
}

// ---------- EXPORTED FUNCTIONS — All async for Mongo compatibility ----------
async function ensureDataFiles(){
  if (USE_MONGO){
    await initMongo();
  } else {
    fileFallback().ensure();
  }
}

// Users
async function readUsers(){
  if (USE_MONGO){
    await initMongo();
    const users = await User.find({}).lean();
    return users.map(u => ({ ...u }));
  } else {
    const { readJson, USERS_FILE } = fileFallback();
    return readJson(USERS_FILE);
  }
}

async function createUser({ name, email, phone, passwordHash, role='attendant' }){
  if (USE_MONGO){
    await initMongo();
    const user = await User.create({
      id: uuidv4(),
      name: name?.trim(),
      email: email?.toLowerCase()?.trim()||null,
      phone: phone?.trim()||null,
      passwordHash,
      role: role==='admin'?'admin':'attendant',
      resetToken: null,
      resetExpiry: null,
    });
    return user.toObject();
  } else {
    const { readJson, writeJson, USERS_FILE } = fileFallback();
    const users = readJson(USERS_FILE);
    const user = {
      id: uuidv4(),
      name: name?.trim(),
      email: email?.toLowerCase()?.trim()||null,
      phone: phone?.trim()||null,
      passwordHash,
      role: role==='admin'?'admin':'attendant',
      resetToken: null,
      resetExpiry: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    users.push(user);
    writeJson(USERS_FILE, users);
    return { ...user };
  }
}

async function findUserByIdentifier(identifier){
  if (!identifier) return null;
  if (USE_MONGO){
    await initMongo();
    const cleanId = identifier.toLowerCase().trim();
    const cleanPhone = identifier.replace(/\s/g,'').trim();
    const user = await User.findOne({
      $or: [
        { email: cleanId },
        { phone: identifier.trim() },
        { phone: cleanPhone }
      ]
    }).lean();
    return user || null;
  } else {
    const { readJson, USERS_FILE } = fileFallback();
    const users = readJson(USERS_FILE);
    const id = identifier.toLowerCase().trim();
    return users.find(u =>
      (u.email && u.email.toLowerCase()===id) ||
      (u.phone && u.phone.replace(/\s/g,'')===identifier.replace(/\s/g,'').trim()) ||
      (u.phone && u.phone===identifier.trim())
    ) || null;
  }
}

async function findUserByEmail(email){
  if (!email) return null;
  if (USE_MONGO){
    await initMongo();
    return await User.findOne({ email: email.toLowerCase().trim() }).lean() || null;
  } else {
    const { readJson, USERS_FILE } = fileFallback();
    return readJson(USERS_FILE).find(u => u.email && u.email.toLowerCase()===email.toLowerCase().trim()) || null;
  }
}
async function findUserByPhone(phone){
  if (!phone) return null;
  if (USE_MONGO){
    await initMongo();
    const clean = phone.replace(/\s/g,'').trim();
    return await User.findOne({ $or: [{ phone: phone.trim() }, { phone: clean }] }).lean() || null;
  } else {
    const { readJson, USERS_FILE } = fileFallback();
    const clean = phone.replace(/\s/g,'').trim();
    return readJson(USERS_FILE).find(u => u.phone && u.phone.replace(/\s/g,'')===clean) || null;
  }
}
async function findUserById(id){
  if (USE_MONGO){
    await initMongo();
    try {
      const user = await User.findOne(buildIdFilter(id)).lean();
      return user || null;
    } catch { return null; }
  } else {
    const { readJson, USERS_FILE } = fileFallback();
    return readJson(USERS_FILE).find(u => u.id===id) || null;
  }
}
async function findUserByResetToken(token){
  if (!token) return null;
  if (USE_MONGO){
    await initMongo();
    return await User.findOne({ resetToken: token }).lean() || null;
  } else {
    const { readJson, USERS_FILE } = fileFallback();
    return readJson(USERS_FILE).find(u => u.resetToken===token) || null;
  }
}
async function updateUser(id, updates){
  if (USE_MONGO){
    await initMongo();
    try {
      const user = await User.findOneAndUpdate(
        buildIdFilter(id),
        { $set: { ...updates, updatedAt: new Date() } },
        { new: true }
      ).lean();
      return user || null;
    } catch { return null; }
  } else {
    const { readJson, writeJson, USERS_FILE } = fileFallback();
    const users = readJson(USERS_FILE);
    const idx = users.findIndex(u => u.id===id);
    if (idx===-1) return null;
    users[idx] = { ...users[idx], ...updates, updatedAt: new Date().toISOString() };
    writeJson(USERS_FILE, users);
    return { ...users[idx] };
  }
}

// Transactions
async function createTransaction({ network, date, clientName, momoNumber, capital, deposit, withdrawal, branch, createdBy }){
  if (USE_MONGO){
    await initMongo();
    const txDate = date ? new Date(date) : new Date();
    if (isNaN(txDate.getTime())) throw new Error('Invalid date');
    const tx = await Transaction.create({
      id: uuidv4(),
      network: network==='Telecel'?'Telecel':'MTN',
      date: txDate,
      clientName: clientName?.trim()||'Walk-in Customer',
      momoNumber: normalizeMomoNumber(momoNumber),
      capital: Number(capital)||0,
      deposit: Number(deposit)||0,
      withdrawal: Number(withdrawal)||0,
      balance: calcBalance(capital,deposit,withdrawal),
      branch: branch?.trim()||'Ho Dome',
      createdBy: createdBy||null,
      updatedBy: createdBy||null,
      deleted: false,
    });
    return tx.toObject();
  } else {
    const { readJson, writeJson, TX_FILE } = fileFallback();
    const txs = readJson(TX_FILE);
    const now = new Date();
    const txDate = date ? new Date(date) : now;
    if (isNaN(txDate.getTime())) throw new Error('Invalid date');
    const transaction = {
      id: uuidv4(),
      network: network==='Telecel'?'Telecel':'MTN',
      date: txDate.toISOString(),
      clientName: clientName?.trim()||'Walk-in Customer',
      momoNumber: normalizeMomoNumber(momoNumber),
      capital: Number(capital)||0,
      deposit: Number(deposit)||0,
      withdrawal: Number(withdrawal)||0,
      balance: calcBalance(capital,deposit,withdrawal),
      branch: branch?.trim()||'Ho Dome',
      createdBy: createdBy||null,
      updatedBy: createdBy||null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      deleted: false
    };
    txs.push(transaction);
    writeJson(TX_FILE, txs);
    return { ...transaction };
  }
}

async function getTransactionById(id, includeDeleted=false){
  if (USE_MONGO){
    await initMongo();
    try {
      const base = buildIdFilter(id);
      const filter = includeDeleted ? base : { $and: [base, { deleted: false }] };
      const tx = await Transaction.findOne(filter).lean();
      return tx ? { momoNumber: '', ...tx } : null;
    } catch { return null; }
  } else {
    const { readJson, TX_FILE } = fileFallback();
    const txs = readJson(TX_FILE);
    const tx = txs.find(t => t.id===id && (includeDeleted || !t.deleted));
    return tx ? { momoNumber:'', ...tx } : null;
  }
}

async function updateTransaction(id, updates, updatedBy){
  if (USE_MONGO){
    await initMongo();
    try {
      const current = await Transaction.findOne({ $and: [buildIdFilter(id), { deleted: false }] });
      if (!current) return null;
      if (updates.network) current.network = updates.network==='Telecel'?'Telecel':'MTN';
      if (updates.date) { const d=new Date(updates.date); if(!isNaN(d)) current.date=d; }
      if (updates.clientName!==undefined) current.clientName = updates.clientName?.trim()||current.clientName;
      if (updates.momoNumber!==undefined) current.momoNumber = normalizeMomoNumber(updates.momoNumber);
      if (updates.capital!==undefined) current.capital = Number(updates.capital)||0;
      if (updates.deposit!==undefined) current.deposit = Number(updates.deposit)||0;
      if (updates.withdrawal!==undefined) current.withdrawal = Number(updates.withdrawal)||0;
      if (updates.branch!==undefined) current.branch = updates.branch?.trim()||current.branch;
      current.balance = calcBalance(current.capital, current.deposit, current.withdrawal);
      current.updatedBy = updatedBy||current.updatedBy;
      await current.save();
      return current.toObject();
    } catch { return null; }
  } else {
    const { readJson, writeJson, TX_FILE } = fileFallback();
    const txs = readJson(TX_FILE);
    const idx = txs.findIndex(t => t.id===id && !t.deleted);
    if (idx===-1) return null;
    const curr = txs[idx];
    const merged = {
      ...curr,
      ...updates,
      id: curr.id,
      createdBy: curr.createdBy,
      createdAt: curr.createdAt,
      deleted: curr.deleted
    };
    if (updates.network) merged.network = updates.network==='Telecel'?'Telecel':'MTN';
    if (updates.date){ const d=new Date(updates.date); if(!isNaN(d)) merged.date=d.toISOString(); }
    if (updates.capital!==undefined) merged.capital=Number(updates.capital)||0;
    if (updates.deposit!==undefined) merged.deposit=Number(updates.deposit)||0;
    if (updates.withdrawal!==undefined) merged.withdrawal=Number(updates.withdrawal)||0;
    if (updates.clientName!==undefined) merged.clientName=updates.clientName?.trim()||curr.clientName;
    if (updates.momoNumber!==undefined) merged.momoNumber=normalizeMomoNumber(updates.momoNumber);
    if (updates.branch!==undefined) merged.branch=updates.branch?.trim()||curr.branch;
    merged.balance=calcBalance(merged.capital,merged.deposit,merged.withdrawal);
    merged.updatedBy=updatedBy||curr.updatedBy;
    merged.updatedAt=new Date().toISOString();
    txs[idx]=merged;
    writeJson(TX_FILE, txs);
    return { ...merged };
  }
}

async function softDeleteTransaction(id, deletedBy){
  if (USE_MONGO){
    await initMongo();
    try {
      const tx = await Transaction.findOneAndUpdate(
        { $and: [buildIdFilter(id), { deleted: false }] },
        { $set: { deleted: true, updatedBy: deletedBy, deletedAt: new Date() } },
        { new: true }
      ).lean();
      return tx || null;
    } catch (e) {
      console.error('[DB] softDelete error:', e.message);
      return null;
    }
  } else {
    const { readJson, writeJson, TX_FILE } = fileFallback();
    const txs = readJson(TX_FILE);
    const idx = txs.findIndex(t => t.id===id && !t.deleted);
    if (idx===-1) return null;
    txs[idx].deleted=true;
    txs[idx].updatedBy=deletedBy||txs[idx].updatedBy;
    txs[idx].updatedAt=new Date().toISOString();
    txs[idx].deletedAt=new Date().toISOString();
    writeJson(TX_FILE, txs);
    return { ...txs[idx] };
  }
}

async function queryTransactions({ network, startDate, endDate, clientName, momoNumber, search, includeDeleted=false, branch }={}){
  if (USE_MONGO){
    await initMongo();
    const filter = {};
    if (!includeDeleted) filter.deleted = false;
    if (network) filter.network = network==='Telecel'?'Telecel':'MTN';
    if (branch) filter.branch = new RegExp(`^${branch}$`,'i');
    const searchTerm = (search || clientName || '').trim();
    if (searchTerm){
      filter.$or = [
        { clientName: { $regex: searchTerm, $options: 'i' } },
        { momoNumber: { $regex: searchTerm.replace(/\s/g,''), $options: 'i' } }
      ];
    }
    if (momoNumber){
      filter.momoNumber = { $regex: momoNumber.replace(/\s/g,''), $options: 'i' };
    }
    if (startDate){
      const s=new Date(startDate); s.setHours(0,0,0,0);
      if (!isNaN(s)) filter.date = { ...(filter.date||{}), $gte: s };
    }
    if (endDate){
      const e=new Date(endDate); e.setHours(23,59,59,999);
      if (!isNaN(e)) filter.date = { ...(filter.date||{}), $lte: e };
    }
    const txs = await Transaction.find(filter).sort({ date: 1 }).lean();
    return txs.map(t => ({ momoNumber: '', ...t }));
  } else {
    const { readJson, TX_FILE } = fileFallback();
    let txs = readJson(TX_FILE);
    if (!includeDeleted) txs=txs.filter(t=>!t.deleted);
    if (network){ const n=network==='Telecel'?'Telecel':'MTN'; txs=txs.filter(t=>t.network===n); }
    if (branch) txs=txs.filter(t=>t.branch?.toLowerCase()===branch.toLowerCase());
    const searchTerm = (search||clientName||'').toLowerCase().trim();
    if (searchTerm){
      txs=txs.filter(t=>{
        const name=(t.clientName||'').toLowerCase();
        const momo=(t.momoNumber||'').toLowerCase();
        return name.includes(searchTerm) || momo.includes(searchTerm);
      });
    }
    if (momoNumber){
      const q=momoNumber.replace(/\s/g,'').toLowerCase();
      txs=txs.filter(t=>(t.momoNumber||'').replace(/\s/g,'').toLowerCase().includes(q));
    }
    if (startDate){ const s=new Date(startDate); s.setHours(0,0,0,0); if(!isNaN(s)) txs=txs.filter(t=>new Date(t.date)>=s); }
    if (endDate){ const e=new Date(endDate); e.setHours(23,59,59,999); if(!isNaN(e)) txs=txs.filter(t=>new Date(t.date)<=e); }
    txs=txs.map(t=>({ momoNumber:'', ...t }));
    txs.sort((a,b)=>new Date(a.date)-new Date(b.date));
    return txs.map(t=>({ ...t }));
  }
}

async function getStatements({ network, startDate, endDate, clientName, momoNumber, search }={}){
  const txs = await queryTransactions({ network, startDate, endDate, clientName, momoNumber, search });
  let running=0;
  return txs.map(tx=>{
    running = parseFloat((running + (Number(tx.capital)||0) + (Number(tx.deposit)||0) - (Number(tx.withdrawal)||0)).toFixed(2));
    return { ...tx, runningBalance: running };
  });
}

async function getTrialBalance({ asOfDate }={}){
  let txs;
  if (USE_MONGO){
    await initMongo();
    const filter = { deleted: false };
    if (asOfDate){
      const e=new Date(asOfDate); e.setHours(23,59,59,999);
      if (!isNaN(e)) filter.date = { $lte: e };
    }
    txs = await Transaction.find(filter).lean();
  } else {
    const { readJson, TX_FILE } = fileFallback();
    txs = readJson(TX_FILE).filter(t=>!t.deleted);
    if (asOfDate){
      const e=new Date(asOfDate); e.setHours(23,59,59,999);
      if (!isNaN(e)) txs=txs.filter(t=>new Date(t.date)<=e);
    }
  }
  const aggregate = (list)=>{
    const capital=list.reduce((s,t)=>s+(Number(t.capital)||0),0);
    const deposit=list.reduce((s,t)=>s+(Number(t.deposit)||0),0);
    const withdrawal=list.reduce((s,t)=>s+(Number(t.withdrawal)||0),0);
    const closing=parseFloat((capital+deposit-withdrawal).toFixed(2));
    return { count:list.length, capital:parseFloat(capital.toFixed(2)), deposit:parseFloat(deposit.toFixed(2)), withdrawal:parseFloat(withdrawal.toFixed(2)), closing };
  };
  return {
    asOf: asOfDate ? new Date(asOfDate).toISOString() : new Date().toISOString(),
    MTN: aggregate(txs.filter(t=>t.network==='MTN')),
    Telecel: aggregate(txs.filter(t=>t.network==='Telecel')),
    total: aggregate(txs),
    _mode: USE_MONGO ? 'mongodb' : 'file'
  };
}

// ---------- Closed Days ----------
async function getClosedDays(){
  if (USE_MONGO){
    await initMongo();
    if (ClosedDay){
      const days = await ClosedDay.find({}).sort({ date: -1 }).lean();
      return days;
    }
    return [];
  } else {
    const { readJson, CLOSED_FILE } = fileFallback();
    const days = readJson(CLOSED_FILE);
    days.sort((a,b)=> b.date.localeCompare(a.date));
    return days;
  }
}

async function isDayClosed(date, network=null){
  const iso = toISODate(date);
  if (!iso) return false;
  const days = await getClosedDays();
  return days.some(d => {
    if (d.date !== iso) return false;
    if (!d.network) return true; // closed for all networks
    if (!network) return true;
    return d.network === network;
  });
}

async function closeDay({ date, network=null, closedBy=null, branch='Ho Dome' }){
  const iso = toISODate(date);
  if (!iso) throw new Error('Invalid date for closeDay');
  const net = network === 'Telecel' ? 'Telecel' : (network === 'MTN' ? 'MTN' : null);
  if (USE_MONGO){
    await initMongo();
    const existing = await ClosedDay.findOne({ date: iso, network: net }).lean();
    if (existing) return existing;
    const doc = await ClosedDay.create({
      id: uuidv4(),
      date: iso,
      network: net,
      closedBy,
      closedAt: new Date(),
      branch
    });
    return doc.toObject();
  } else {
    const { readJson, writeJson, CLOSED_FILE } = fileFallback();
    const days = readJson(CLOSED_FILE);
    const exists = days.find(d => d.date===iso && (d.network||null)===(net||null));
    if (exists) return exists;
    const entry = {
      id: uuidv4(),
      date: iso,
      network: net,
      closedBy,
      closedAt: new Date().toISOString(),
      branch,
      createdAt: new Date().toISOString()
    };
    days.push(entry);
    writeJson(CLOSED_FILE, days);
    return entry;
  }
}

async function openDay({ date, network=null }){
  const iso = toISODate(date);
  if (!iso) throw new Error('Invalid date');
  const net = network === 'Telecel' ? 'Telecel' : (network === 'MTN' ? 'MTN' : null);
  if (USE_MONGO){
    await initMongo();
    const res = await ClosedDay.findOneAndDelete({ date: iso, network: net });
    return res ? res.toObject() : null;
  } else {
    const { readJson, writeJson, CLOSED_FILE } = fileFallback();
    let days = readJson(CLOSED_FILE);
    const idx = days.findIndex(d => d.date===iso && (d.network||null)===(net||null));
    if (idx===-1) return null;
    const removed = days[idx];
    days.splice(idx,1);
    writeJson(CLOSED_FILE, days);
    return removed;
  }
}

module.exports = {
  // users
  createUser,
  findUserByIdentifier,
  findUserByEmail,
  findUserByPhone,
  findUserById,
  findUserByResetToken,
  updateUser,
  readUsers,
  // transactions
  createTransaction,
  getTransactionById,
  updateTransaction,
  softDeleteTransaction,
  queryTransactions,
  getStatements,
  getTrialBalance,
  calcBalance,
  ensureDataFiles,
  // closed days
  getClosedDays,
  isDayClosed,
  closeDay,
  openDay,
  toISODate,
  // internal
  _USE_MONGO: USE_MONGO,
  _initMongo: initMongo
};
