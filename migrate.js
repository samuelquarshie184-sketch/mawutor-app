/**
 * migrate.js - Move existing data/users.json & data/transactions.json into MongoDB Atlas
 * Usage: MONGODB_URI=mongodb+srv://... node migrate.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function migrate(){
  const uri = process.env.MONGODB_URI;
  if (!uri){
    console.error('❌ Set MONGODB_URI env first: MONGODB_URI=mongodb+srv://... node migrate.js');
    process.exit(1);
  }

  console.log('🔌 Connecting to Atlas...');
  const dbAtlas = require('./db.atlas.js');
  await dbAtlas.ensureDataFiles();
  await dbAtlas._initMongo();

  // Load file JSON if exists
  const usersFile = path.join(__dirname, 'data', 'users.json');
  const txFile = path.join(__dirname, 'data', 'transactions.json');

  let users = [];
  let txs = [];

  if (fs.existsSync(usersFile)){
    try { users = JSON.parse(fs.readFileSync(usersFile,'utf8')||'[]'); console.log(`📄 Found ${users.length} users in file`); } catch(e){ console.warn('No users file or invalid'); }
  }
  if (fs.existsSync(txFile)){
    try { txs = JSON.parse(fs.readFileSync(txFile,'utf8')||'[]'); console.log(`📄 Found ${txs.length} transactions in file`); } catch(e){ console.warn('No tx file'); }
  }

  // Migrate users
  let migratedUsers = 0;
  for (const u of users){
    try {
      const existing = await dbAtlas.findUserById(u.id);
      if (existing) { console.log(`⏭️ User ${u.email||u.phone} already exists, skip`); continue; }
      // Need to re-create with same id? Atlas version generates new id by default, but we pass id manually via model
      // Use direct model create
      const mongoose = require('mongoose');
      const User = mongoose.model('MawutorUser');
      await User.create({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        passwordHash: u.passwordHash,
        role: u.role,
        resetToken: u.resetToken||null,
        resetExpiry: u.resetExpiry||null,
        createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
        updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date()
      });
      migratedUsers++;
      console.log(`✅ Migrated user ${u.name} ${u.email||u.phone}`);
    } catch(e){ console.error(`❌ User ${u.id} failed:`, e.message); }
  }

  // Migrate transactions
  let migratedTx = 0;
  for (const t of txs){
    try {
      if (t.deleted) continue; // skip soft-deleted unless you want audit
      const existing = await dbAtlas.getTransactionById(t.id, true);
      if (existing) { console.log(`⏭️ Tx ${t.id} ${t.clientName} already exists, skip`); continue; }
      const mongoose = require('mongoose');
      const Transaction = mongoose.model('MawutorTransaction');
      await Transaction.create({
        id: t.id,
        network: t.network,
        date: t.date ? new Date(t.date) : new Date(),
        clientName: t.clientName,
        momoNumber: t.momoNumber||'',
        capital: Number(t.capital)||0,
        deposit: Number(t.deposit)||0,
        withdrawal: Number(t.withdrawal)||0,
        balance: Number(t.balance)||0,
        branch: t.branch||'Ho Dome',
        createdBy: t.createdBy||null,
        updatedBy: t.updatedBy||null,
        deleted: t.deleted||false,
        deletedAt: t.deletedAt ? new Date(t.deletedAt) : null,
        createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
        updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date()
      });
      migratedTx++;
      console.log(`✅ Migrated tx ${t.network} ${t.clientName} ${t.momoNumber||''} GHS${t.balance}`);
    } catch(e){ console.error(`❌ Tx ${t.id} failed:`, e.message); }
  }

  console.log(`\n🎉 Done! Migrated ${migratedUsers} users, ${migratedTx} transactions to Atlas`);
  console.log('Check Atlas Data Explorer: mawutor-dezor database -> Mawutorusers & Mawutortransactions');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });
