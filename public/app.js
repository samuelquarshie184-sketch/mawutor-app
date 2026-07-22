/**
 * Mawutor Dezor Enterprise - Frontend v3.0
 * MoMo Numbers + Mobile Friendly + Offline PWA + Installable
 * Features:
 * - Offline queue: add/edit/delete transactions offline, sync when online
 * - Local cache: MTN/Telecel/Statements cached for offline viewing
 * - PWA installable, service worker, background sync
 */
const API = '';
let token = localStorage.getItem('mde_token') || null;
let user = JSON.parse(localStorage.getItem('mde_user') || 'null');
let socket = null;
let currentTab = localStorage.getItem('mde_tab') || 'mtn';
let transactionsCache = { MTN: [], Telecel: [], statements: [], trialDetail: [] };

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ---------- Offline Constants ----------
const OFFLINE_QUEUE_KEY = 'mde_offline_queue';
const CACHE_PREFIX = 'mde_cache_';

// ---------- Utils ----------
function toast(msg, type='success'){
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.remove('hidden');
  setTimeout(()=> el.classList.add('hidden'), 4000);
}

function fmtGHSCompact(n){
  return `GHS${(Number(n)||0).toLocaleString('en-GH',{minimumFractionDigits:2, maximumFractionDigits:2})}`;
}

function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function formatMomoLink(num){
  if(!num) return '<span class="muted">—</span>';
  const clean = String(num).replace(/\s/g,'');
  return `<a href="tel:${clean}" class="momo-link" onclick="event.stopPropagation()">${escapeHtml(num)}</a>`;
}

// ---------- Offline Queue Helpers ----------
function getOfflineQueue(){
  try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'); }
  catch { return []; }
}
function saveOfflineQueue(q){
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
  updateOfflineUI();
}
function addToOfflineQueue(item){
  const q = getOfflineQueue();
  item._queuedAt = new Date().toISOString();
  item._localId = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
  q.push(item);
  saveOfflineQueue(q);
  toast(`📴 Offline — Queued ${item.type} for ${item.payload.clientName||''} ${item.payload.momoNumber||''}`, 'success');
  updateOfflineUI();
  return item;
}
function removeFromQueue(localId){
  let q = getOfflineQueue();
  q = q.filter(i => i._localId !== localId);
  saveOfflineQueue(q);
}
function clearOfflineQueue(){
  saveOfflineQueue([]);
}
function cacheTransactionsLocally(key, data){
  try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now() })); } catch(e){ console.warn('Cache write fail', e.message); }
}
function loadCachedTransactions(key){
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.data;
  } catch { return null; }
}
function updateOfflineUI(){
  const q = getOfflineQueue();
  const qc = $('#offlineQueueCount');
  const qb = $('#queueCountBtn');
  if(qc) qc.textContent = `${q.length} queued`;
  if(qb) qb.textContent = q.length;
  const banner = $('#offlineBanner');
  if(banner){
    if(!navigator.onLine || q.length>0){
      banner.classList.remove('hidden');
    }
    // Keep visible if offline, hide if online and queue empty handled by updateOnlineStatus elsewhere
    if(navigator.onLine && q.length===0){
      // leave handling to online status function
    }
  }
  // Update queue list UI
  const list = $('#offlineQueueList');
  if(list && q.length>0){
    list.innerHTML = q.map(item => {
      const p = item.payload;
      return `<div class="q-item"><span><b>${item.type.toUpperCase()}</b> ${escapeHtml(p.clientName||'')} <small>${escapeHtml(p.momoNumber||'')}</small><br><small>${new Date(item._queuedAt).toLocaleString()}</small></span><button class="btn ghost sm" onclick="removeQueued('${item._localId}')">✕</button></div>`;
    }).join('');
  } else if(list){
    list.innerHTML = '<div class="center muted" style="padding:10px">No offline queued items</div>';
  }
}
window.removeQueued = (id)=>{ removeFromQueue(id); updateOfflineUI(); };

// Sync offline queue when online
async function syncOfflineQueue(){
  const q = getOfflineQueue();
  if(q.length===0) return;
  if(!navigator.onLine){
    toast('Still offline — will sync when online', 'error');
    return;
  }
  if(!token){
    toast('Login required to sync offline queue', 'error');
    return;
  }
  toast(`🔄 Syncing ${q.length} offline transactions...`, 'success');
  let synced = 0, failed = 0;
  for (const item of [...q]){
    try {
      if(item.type==='create'){
        await api('/api/transactions', { method:'POST', body: JSON.stringify(item.payload) });
      } else if(item.type==='update'){
        await api(`/api/transactions/${item.id}`, { method:'PUT', body: JSON.stringify(item.payload) });
      } else if(item.type==='delete'){
        await api(`/api/transactions/${item.id}`, { method:'DELETE' });
      }
      removeFromQueue(item._localId);
      synced++;
    } catch(e){
      console.error('Sync failed for', item, e.message);
      failed++;
      // Keep in queue for retry if offline error, else remove if validation error?
      if(e.message.includes('Offline') || e.message.includes('Failed to fetch')){
        // keep
      } else {
        // If server rejected (e.g., validation), remove and alert
        removeFromQueue(item._localId);
        toast(`Queued item failed: ${e.message}`, 'error');
      }
    }
  }
  updateOfflineUI();
  if(synced>0){
    toast(`✅ Synced ${synced} offline transactions! ${failed? failed+' failed':''}`, 'success');
    loadAllData();
  } else if(failed===0){
    toast('Offline queue empty', 'success');
  }
}
window.syncOfflineQueue = syncOfflineQueue; // exposed for SW message

// ---------- API Wrapper with Offline Detection ----------
async function api(path, opts={}){
  // If offline and it's a write, let caller decide to queue (we throw)
  if(!navigator.onLine && opts.method && opts.method!=='GET'){
    throw new Error('Offline - transaction will be queued');
  }
  try {
    const res = await fetch(API + path, {
      ...opts,
      headers: { ...(opts.headers||{}), ...(token? {Authorization:`Bearer ${token}`}:{}), 'Content-Type':'application/json' }
    });
    if(res.status===401){
      logout();
      throw new Error('Session expired. Please login again.');
    }
    // Check if SW returned offline queued response
    const data = await res.json().catch(()=> ({}));
    if(res.status===202 && data.offlineQueued){
      throw new Error('Offline - queued by SW');
    }
    if(!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch(e){
    // Network failure
    if(e.message === 'Failed to fetch' || e.message.includes('NetworkError')){
      throw new Error('Offline - Failed to fetch');
    }
    throw e;
  }
}

// ---------- Auth ----------
function setAuthView(){
  $('#authView').classList.remove('hidden');
  $('#dashboardView').classList.add('hidden');
  token=null; user=null;
  localStorage.removeItem('mde_token');
  localStorage.removeItem('mde_user');
  if(socket){ socket.disconnect(); socket=null; }
}
function setDashboardView(){
  $('#authView').classList.add('hidden');
  $('#dashboardView').classList.remove('hidden');
  $('#userName').textContent = user?.name || 'User';
  $('#userRole').textContent = user?.role || 'attendant';
  initSocket();
  switchTab(currentTab);
  loadAllData();
}

// Auth Tabs
$$('.auth-tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    $$('.auth-tab').forEach(b=>b.classList.remove('active'));
    $$('.auth-form').forEach(f=>f.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.authTab;
    if(tab==='login') $('#loginForm').classList.add('active');
    if(tab==='register') $('#registerForm').classList.add('active');
    if(tab==='forgot'){
      $('#forgotForm').classList.add('active');
      $('#resetForm').classList.add('active');
    }
  });
});

// Auth Forms
$('#loginForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  $('#authError').classList.add('hidden');
  try{
    const identifier = $('#loginId').value.trim();
    const password = $('#loginPwd').value;
    const data = await api('/api/auth/login', { method:'POST', body: JSON.stringify({ identifier, password }) });
    token = data.token; user = data.user;
    localStorage.setItem('mde_token', token);
    localStorage.setItem('mde_user', JSON.stringify(user));
    // Cache user for offline shell
    localStorage.setItem('mde_cached_user', JSON.stringify(user));
    toast(`Welcome back, ${user.name}`);
    setDashboardView();
    // Try sync offline queue after login
    setTimeout(syncOfflineQueue, 1500);
  }catch(err){
    // Allow offline login if cached user exists and password matches? Simplified: allow if same email/phone cached
    // For security, we only allow if token previously cached and identifier matches cached user
    // Here just show error
    $('#authError').textContent = err.message + (navigator.onLine?'':' (Offline)');
    $('#authError').classList.remove('hidden');
    // If offline and we have cached token/user, allow offline view
    if(!navigator.onLine){
      const cachedUser = JSON.parse(localStorage.getItem('mde_cached_user')||'null');
      const cachedToken = localStorage.getItem('mde_token');
      if(cachedUser && cachedToken){
        toast('Offline mode—using cached login', 'success');
        token = cachedToken; user = cachedUser;
        setDashboardView();
      }
    }
  }
});

$('#registerForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  $('#authError').classList.add('hidden');
  if(!navigator.onLine){
    toast('Cannot register offline — need internet for first registration', 'error');
    return;
  }
  try{
    const body = {
      name: $('#regName').value.trim(),
      email: $('#regEmail').value.trim()||undefined,
      phone: $('#regPhone').value.trim()||undefined,
      password: $('#regPwd').value,
      role: $('#regRole').value
    };
    if(!body.email && !body.phone) throw new Error('Provide email or phone');
    const data = await api('/api/auth/register', { method:'POST', body: JSON.stringify(body) });
    token = data.token; user = data.user;
    localStorage.setItem('mde_token', token);
    localStorage.setItem('mde_user', JSON.stringify(user));
    localStorage.setItem('mde_cached_user', JSON.stringify(user));
    toast(`Account created! Role: ${user.role}`);
    setDashboardView();
  }catch(err){
    $('#authError').textContent = err.message;
    $('#authError').classList.remove('hidden');
  }
});

$('#forgotForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!navigator.onLine){ toast('Need internet for password reset', 'error'); return; }
  try{
    const identifier = $('#forgotId').value.trim();
    const data = await api('/api/auth/forgot-password', { method:'POST', body: JSON.stringify({ identifier }) });
    $('#forgotResult').classList.remove('hidden');
    $('#forgotResult').innerHTML = `✅ Token generated (valid 1h).<br><code style="user-select:all">${data.resetToken}</code><br><small>Copy token to reset form below.</small>`;
    $('#resetToken').value = data.resetToken;
    toast('Reset token generated');
  }catch(err){
    $('#forgotResult').classList.remove('hidden');
    $('#forgotResult').textContent = err.message;
  }
});

$('#resetForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!navigator.onLine){ toast('Need internet for reset', 'error'); return; }
  try{
    const resetToken = $('#resetToken').value.trim();
    const newPassword = $('#resetPwd').value;
    await api('/api/auth/reset-password', { method:'POST', body: JSON.stringify({ resetToken, newPassword }) });
    toast('Password reset! Now login.');
    $$('.auth-tab').forEach(b=>b.classList.remove('active'));
    $(`[data-auth-tab="login"]`).classList.add('active');
    $$('.auth-form').forEach(f=>f.classList.remove('active'));
    $('#loginForm').classList.add('active');
  }catch(err){
    toast(err.message,'error');
  }
});

// ---------- Tabs ----------
function switchTab(tab){
  currentTab = tab;
  localStorage.setItem('mde_tab', tab);
  $$('.tab').forEach(b=> b.classList.toggle('active', b.dataset.tab===tab));
  $$('.m-tab').forEach(b=> b.classList.toggle('active', b.dataset.tab===tab));
  $$('.tab-pane').forEach(p=> p.classList.toggle('active', p.id===`tab-${tab}`));
  const fab = $('#fabAdd');
  if(fab){
    if(tab==='telecel') fab.className='fab telecel';
    else if(tab==='mtn') fab.className='fab mtn';
    else fab.className='fab';
    fab.style.display = (tab==='mtn' || tab==='telecel') ? 'grid' : 'none';
  }
  if(tab==='trial') loadTrialBalance();
  if(tab==='statements') loadStatements();
  if(tab==='mtn') renderNetwork('MTN');
  if(tab==='telecel') renderNetwork('Telecel');
}
$$('.tab').forEach(btn=> btn.addEventListener('click', ()=> switchTab(btn.dataset.tab)));
$$('.m-tab').forEach(btn=> btn.addEventListener('click', ()=> switchTab(btn.dataset.tab)));

// ---------- Socket ----------
function initSocket(){
  if(!navigator.onLine){
    $('#liveDot').style.background = '#ff3b3b';
    return;
  }
  if(socket) socket.disconnect();
  socket = io({ transports:['websocket','polling'] });
  socket.on('connect', ()=>{ $('#liveDot').style.background = '#00c27a'; });
  socket.on('disconnect', ()=>{ $('#liveDot').style.background = '#ff3b3b'; });
  socket.on('transactions:changed', (payload)=>{
    toast(`${payload.action.toUpperCase()}: ${payload.transaction.network} • ${escapeHtml(payload.transaction.clientName)} • ${escapeHtml(payload.transaction.momoNumber||'')}`, 'success');
    if(currentTab==='mtn' || currentTab==='telecel' || currentTab==='statements'){
      loadTransactions(payload.transaction.network, true);
      loadStatements(true);
    }
    loadTrialBalance();
    updateTxCount();
  });
}

// ---------- Data Loading with Offline Cache ----------
async function loadTransactions(network, silent=false){
  const cacheKey = `transactions_${network}`;
  const badgeId = `${network==='MTN'?'mtn':'telecel'}OfflineBadge`;
  try{
    const params = new URLSearchParams();
    if(network) params.set('network', network);
    const start = $(`#filterStart${network==='MTN'?'MTN':'Telecel'}`)?.value;
    const end = $(`#filterEnd${network==='MTN'?'MTN':'Telecel'}`)?.value;
    const search = $(`#search${network==='MTN'?'MTN':'Telecel'}`)?.value?.trim();
    if(start) params.set('startDate', start);
    if(end) params.set('endDate', end);
    if(search) params.set('search', search);

    const txs = await api(`/api/transactions?${params.toString()}`, { method:'GET' });
    transactionsCache[network] = txs;
    cacheTransactionsLocally(cacheKey, txs);
    if(!silent) renderNetwork(network);
    updateBgCards();
    $('#txCount').textContent = (transactionsCache.MTN.length + transactionsCache.Telecel.length);
    const label = $(`#${network==='MTN'?'mtn':'telecel'}CountLabel`);
    if(label) label.textContent = `(${txs.length})`;
    const badge = document.getElementById(badgeId);
    if(badge) badge.style.display='none';
  }catch(err){
    console.warn(`Load ${network} failed (offline?), trying cache`, err.message);
    const cached = loadCachedTransactions(cacheKey);
    if(cached){
      transactionsCache[network] = cached;
      if(!silent) renderNetwork(network);
      const badge = document.getElementById(badgeId);
      if(badge) badge.style.display='inline-block';
      if(!silent) toast(`${network} loaded from offline cache`, 'success');
    } else {
      console.error(err);
      if(!silent) toast(err.message.includes('Offline') ? `${network} offline — no cache` : err.message,'error');
    }
    // Also include offline queued creates for this network in view
    const q = getOfflineQueue().filter(i=>i.type==='create' && i.payload.network===network);
    if(q.length>0 && !silent){
      // Show queued items as if in cache
      const queuedTxs = q.map(item => ({
        id: item._localId,
        network: item.payload.network,
        date: item.payload.date,
        clientName: item.payload.clientName + ' (Queued Offline)',
        momoNumber: item.payload.momoNumber,
        capital: item.payload.capital,
        deposit: item.payload.deposit,
        withdrawal: item.payload.withdrawal,
        balance: (Number(item.payload.capital)||0)+(Number(item.payload.deposit)||0)-(Number(item.payload.withdrawal)||0),
        branch: item.payload.branch,
        _isOfflineQueued: true
      }));
      const combined = [...(transactionsCache[network]||[]), ...queuedTxs];
      transactionsCache[network] = combined;
      renderNetwork(network);
    }
  }
}

async function loadAllData(){
  await Promise.all([loadTransactions('MTN'), loadTransactions('Telecel'), loadClosedDays(true)]);
  loadStatements();
  loadTrialBalance();
  updateClosedDayBadges();
}

function calcSummaries(txs){
  const capital = txs.reduce((s,t)=>s + (Number(t.capital)||0),0);
  const deposit = txs.reduce((s,t)=>s + (Number(t.deposit)||0),0);
  const withdrawal = txs.reduce((s,t)=>s + (Number(t.withdrawal)||0),0);
  const balance = capital + deposit - withdrawal;
  return { capital, deposit, withdrawal, balance, count: txs.length };
}

function renderNetwork(network){
  const txs = transactionsCache[network] || [];
  const summary = calcSummaries(txs);
  const cardsEl = $(`#cards${network==='MTN'?'MTN':'Telecel'}`);
  cardsEl.innerHTML = `
    <div class="card accent-navy"><div class="label">Capital at Start</div><div class="value">${fmtGHSCompact(summary.capital)}</div><div class="trend">${summary.count} txs • MoMo tracked${!navigator.onLine?' • Offline':''}</div></div>
    <div class="card accent-yellow"><div class="label">Total Deposits</div><div class="value">${fmtGHSCompact(summary.deposit)}</div><div class="trend">Money in</div></div>
    <div class="card accent-red"><div class="label">Total Withdrawals</div><div class="value">${fmtGHSCompact(summary.withdrawal)}</div><div class="trend">Money out</div></div>
    <div class="card accent-green"><div class="label">Net Balance</div><div class="value">${fmtGHSCompact(summary.balance)}</div><div class="trend">capital+deposit-withdrawal</div></div>
  `;

  const tbody = $(`#tbody${network==='MTN'?'MTN':'Telecel'}`);
  const mobileWrap = $(`#mobile${network==='MTN'?'MTN':'Telecel'}`);

  if(txs.length===0){
    tbody.innerHTML = `<tr><td colspan="9" class="center muted">No transactions for ${network} in this period. ${!navigator.onLine?'Offline cache empty.':''}</td></tr>`;
    if(mobileWrap) mobileWrap.innerHTML = `<div class="empty-mobile">No ${network} transactions.<br><small>Tap + to add${!navigator.onLine?' (offline queue)':''}</small></div>`;
    return;
  }
  const sorted = [...txs].sort((a,b)=> new Date(b.date)-new Date(a.date));
  tbody.innerHTML = sorted.map(t=>{
    const d = new Date(t.date);
    const dateStr = d.toLocaleDateString('en-GH') + ' ' + d.toLocaleTimeString('en-GH',{hour:'2-digit',minute:'2-digit'});
    const offlineLabel = t._isOfflineQueued ? '<span class="badge" style="background:#fff3cd;color:#856404">Queued</span> ' : '';
    const closedInfo = isDateClosed(t.date, t.network);
    const isLocked = closedInfo && user?.role !== 'admin';
    const lockLabel = isLocked ? `<span class="badge" style="background:#f8d7da;color:#721c24">🔒 Closed</span> ` : '';
    return `<tr style="${t._isOfflineQueued?'background:#fffbe6': isLocked?'background:#f8f9fa;opacity:.8':''}">
      <td>${dateStr}</td>
      <td>${offlineLabel}${lockLabel}<b>${escapeHtml(t.clientName)}</b></td>
      <td>${formatMomoLink(t.momoNumber)}</td>
      <td class="ghs">${fmtGHSCompact(t.capital)}</td>
      <td class="ghs" style="color:var(--green)">${fmtGHSCompact(t.deposit)}</td>
      <td class="ghs" style="color:var(--red)">${fmtGHSCompact(t.withdrawal)}</td>
      <td class="ghs">${fmtGHSCompact(t.balance)}</td>
      <td>${escapeHtml(t.branch||'Ho Dome')}</td>
      <td>
        ${t._isOfflineQueued ? `<button class="action-btn del" onclick="removeQueued('${t.id}')">Remove</button>` : isLocked ? `<small class="muted">🔒 Locked<br>Admin only</small>` : `<button class="action-btn edit" onclick="openEdit('${t.id}')">Edit</button><button class="action-btn del" onclick="deleteTx('${t.id}')">Del</button>`}
      </td>
    </tr>`;
  }).join('');

  if(mobileWrap){
    mobileWrap.innerHTML = sorted.map(t=>{
      const d = new Date(t.date);
      const badgeClass = t.network==='MTN' ? 'mtn' : 'telecel';
      const closedInfo = isDateClosed(t.date, t.network);
      const isLocked = closedInfo && user?.role !== 'admin';
      return `<div class="m-card" style="${t._isOfflineQueued?'border-color:#ffcc00;background:#fffbe6': isLocked?'border-color:#f5c6cb':''}">
        <div class="m-card-head">
          <span class="badge ${badgeClass}">${t.network}</span>
          <small>${d.toLocaleDateString('en-GH')} ${d.toLocaleTimeString('en-GH',{hour:'2-digit',minute:'2-digit'})} ${t._isOfflineQueued?'<span class="badge" style="background:#fff3cd;color:#856404">Queued Offline</span>': isLocked?'<span class="badge" style="background:#f8d7da;color:#721c24">🔒 Closed</span>':''}</small>
        </div>
        <div class="m-card-body">
          <div class="m-row"><span>Client:</span><b>${escapeHtml(t.clientName)}</b></div>
          <div class="m-row"><span>MoMo #:</span><b>${formatMomoLink(t.momoNumber)}</b></div>
          <div class="m-row"><span>Deposit:</span><span style="color:var(--green);font-weight:700">${fmtGHSCompact(t.deposit)}</span></div>
          <div class="m-row"><span>Withdraw:</span><span style="color:var(--red);font-weight:700">${fmtGHSCompact(t.withdrawal)}</span></div>
          <div class="m-row total"><span>Balance:</span><b>${fmtGHSCompact(t.balance)}</b></div>
          <div class="m-row"><span>Branch:</span><span>${escapeHtml(t.branch||'Ho Dome')}</span></div>
          ${isLocked?'<div class="alert" style="background:#f8d7da;border-color:#f5c6cb;color:#721c24;padding:6px;font-size:11px">🔒 Day closed — read only for attendants. Only admin can edit.</div>':''}
        </div>
        <div class="m-card-actions">
          ${t._isOfflineQueued ? `<button class="btn ghost sm" style="color:var(--red)" onclick="removeQueued('${t.id}')">Remove Queued</button>` : isLocked ? `<small class="muted">🔒 Locked - Admin only</small>` : `<button class="btn ghost sm" onclick="openEdit('${t.id}')">Edit</button><button class="btn ghost sm" style="color:var(--red)" onclick="deleteTx('${t.id}')">Delete</button><a class="btn ghost sm" href="tel:${(t.momoNumber||'').replace(/\s/g,'')}" style="margin-left:auto">📞 Call</a>`}
        </div>
      </div>`;
    }).join('');
  }
}

async function loadStatements(silent=false){
  const cacheKey = 'statements';
  try{
    const params = new URLSearchParams();
    const network = $('#filterNetworkStmt').value;
    const start = $('#filterStartStmt').value;
    const end = $('#filterEndStmt').value;
    const search = $('#searchStmt').value.trim();
    if(network) params.set('network', network);
    if(start) params.set('startDate', start);
    if(end) params.set('endDate', end);
    if(search) params.set('search', search);

    const stmts = await api(`/api/statements?${params.toString()}`, { method:'GET' });
    transactionsCache.statements = stmts;
    cacheTransactionsLocally(cacheKey, stmts);
    if(!silent) renderStatements();
  }catch(err){
    const cached = loadCachedTransactions(cacheKey);
    if(cached){
      transactionsCache.statements = cached;
      if(!silent) renderStatements();
      toast('Statements from offline cache', 'success');
    } else {
      console.error(err);
      if(!silent) toast(err.message,'error');
    }
  }
}

function renderStatements(){
  const stmts = transactionsCache.statements || [];
  const tbody = $('#tbodyStmt');
  const mobileWrap = $('#mobileStmt');

  if(stmts.length===0){
    tbody.innerHTML = `<tr><td colspan="9" class="center muted">No statements matching filters.</td></tr>`;
    if(mobileWrap) mobileWrap.innerHTML = `<div class="empty-mobile">No statements.</div>`;
    return;
  }
  tbody.innerHTML = stmts.map(t=>{
    const d = new Date(t.date);
    const dateStr = d.toLocaleDateString('en-GH') + ' ' + d.toLocaleTimeString('en-GH',{hour:'2-digit',minute:'2-digit'});
    const badge = t.network==='MTN' ? '<span class="badge mtn">MTN</span>' : '<span class="badge telecel">Telecel</span>';
    return `<tr>
      <td>${dateStr}</td>
      <td>${badge}</td>
      <td><b>${escapeHtml(t.clientName)}</b></td>
      <td>${formatMomoLink(t.momoNumber)}</td>
      <td class="ghs">${fmtGHSCompact(t.capital)}</td>
      <td class="ghs" style="color:var(--green)">${fmtGHSCompact(t.deposit)}</td>
      <td class="ghs" style="color:var(--red)">${fmtGHSCompact(t.withdrawal)}</td>
      <td class="ghs">${fmtGHSCompact(t.balance)}</td>
      <td class="ghs" style="font-weight:800">${fmtGHSCompact(t.runningBalance)}</td>
    </tr>`;
  }).join('');

  if(mobileWrap){
    mobileWrap.innerHTML = stmts.map(t=>{
      const d = new Date(t.date);
      return `<div class="m-card statement">
        <div class="m-card-head">
          <span class="badge ${t.network==='MTN'?'mtn':'telecel'}">${t.network}</span>
          <small>${d.toLocaleDateString('en-GH')} • ${fmtGHSCompact(t.balance)}</small>
        </div>
        <div class="m-card-body">
          <div class="m-row"><span>Client:</span><b>${escapeHtml(t.clientName)}</b></div>
          <div class="m-row"><span>MoMo:</span><b>${formatMomoLink(t.momoNumber)}</b></div>
          <div class="m-row"><span>Deposit:</span><span style="color:var(--green)">${fmtGHSCompact(t.deposit)}</span><span style="margin-left:8px">W/D:</span><span style="color:var(--red)">${fmtGHSCompact(t.withdrawal)}</span></div>
          <div class="m-row total"><span>Running:</span><b>${fmtGHSCompact(t.runningBalance)}</b></div>
        </div>
      </div>`;
    }).join('');
  }
}

async function loadTrialBalance(){
  const cacheKey = 'trial_' + ($('#trialDate').value||'today');
  try{
    const date = $('#trialDate').value;
    const params = date ? `?asOfDate=${date}` : '';
    const data = await api(`/api/trial-balance${params}`, { method:'GET' });

    const tbody = $('#tbodyTrial');
    tbody.innerHTML = `
      <tr><td><span class="badge mtn">MTN</span></td><td>${data.MTN.count}</td><td class="ghs">${fmtGHSCompact(data.MTN.capital)}</td><td class="ghs">${fmtGHSCompact(data.MTN.deposit)}</td><td class="ghs">${fmtGHSCompact(data.MTN.withdrawal)}</td><td class="ghs" style="font-weight:800">${fmtGHSCompact(data.MTN.closing)}</td></tr>
      <tr><td><span class="badge telecel">Telecel</span></td><td>${data.Telecel.count}</td><td class="ghs">${fmtGHSCompact(data.Telecel.capital)}</td><td class="ghs">${fmtGHSCompact(data.Telecel.deposit)}</td><td class="ghs">${fmtGHSCompact(data.Telecel.withdrawal)}</td><td class="ghs" style="font-weight:800">${fmtGHSCompact(data.Telecel.closing)}</td></tr>
      <tr style="background:#f7f9fc;font-weight:700"><td>TOTAL</td><td>${data.total.count}</td><td>${fmtGHSCompact(data.total.capital)}</td><td>${fmtGHSCompact(data.total.deposit)}</td><td>${fmtGHSCompact(data.total.withdrawal)}</td><td>${fmtGHSCompact(data.total.closing)}</td></tr>
    `;

    $('#trialCards').innerHTML = `
      <div class="card accent-yellow"><div class="label">MTN Closing</div><div class="value">${fmtGHSCompact(data.MTN.closing)}</div><div class="trend">As of ${new Date(data.asOf).toLocaleDateString()} • ${data.MTN.count} txs</div></div>
      <div class="card accent-red"><div class="label">Telecel Closing</div><div class="value">${fmtGHSCompact(data.Telecel.closing)}</div><div class="trend">${data.Telecel.count} txs • ${data._mode||'file'}</div></div>
      <div class="card accent-navy"><div class="label">Combined Closing</div><div class="value">${fmtGHSCompact(data.total.closing)}</div><div class="trend">${data.total.count} total • ${!navigator.onLine?'Offline cache':''}</div></div>
    `;
    cacheTransactionsLocally(cacheKey, data);
    await loadTrialDetail($('#trialDate').value);
  }catch(err){
    const cached = loadCachedTransactions(cacheKey);
    if(cached){
      // Render from cache
      const data = cached;
      const tbody = $('#tbodyTrial');
      tbody.innerHTML = `
        <tr><td><span class="badge mtn">MTN</span></td><td>${data.MTN.count}</td><td class="ghs">${fmtGHSCompact(data.MTN.capital)}</td><td class="ghs">${fmtGHSCompact(data.MTN.deposit)}</td><td class="ghs">${fmtGHSCompact(data.MTN.withdrawal)}</td><td class="ghs" style="font-weight:800">${fmtGHSCompact(data.MTN.closing)}</td></tr>
        <tr><td><span class="badge telecel">Telecel</span></td><td>${data.Telecel.count}</td><td class="ghs">${fmtGHSCompact(data.Telecel.capital)}</td><td class="ghs">${fmtGHSCompact(data.Telecel.deposit)}</td><td class="ghs">${fmtGHSCompact(data.Telecel.withdrawal)}</td><td class="ghs" style="font-weight:800">${fmtGHSCompact(data.Telecel.closing)}</td></tr>
        <tr style="background:#fff3cd;font-weight:700"><td>TOTAL (Offline cache)</td><td>${data.total.count}</td><td>${fmtGHSCompact(data.total.capital)}</td><td>${fmtGHSCompact(data.total.deposit)}</td><td>${fmtGHSCompact(data.total.withdrawal)}</td><td>${fmtGHSCompact(data.total.closing)}</td></tr>
      `;
      toast('Trial Balance from offline cache', 'success');
    } else {
      toast(err.message,'error');
    }
  }
}

async function loadTrialDetail(asOfDate){
  try{
    const params = new URLSearchParams();
    if(asOfDate) params.set('endDate', asOfDate);
    const all = await api(`/api/transactions?${params.toString()}`, { method:'GET' });
    const sorted = [...all].sort((a,b)=> new Date(b.date)-new Date(a.date)).slice(0,20);
    transactionsCache.trialDetail = sorted;

    const tbody = $('#tbodyTrialDetail');
    const mobileWrap = $('#mobileTrialDetail');

    if(sorted.length===0){
      tbody.innerHTML = `<tr><td colspan="7" class="center muted">No transactions as of ${asOfDate||'today'}</td></tr>`;
      if(mobileWrap) mobileWrap.innerHTML = `<div class="empty-mobile">No data</div>`;
      return;
    }

    tbody.innerHTML = sorted.map(t=>{
      const d = new Date(t.date);
      const dateStr = d.toLocaleDateString('en-GH') + ' ' + d.toLocaleTimeString('en-GH',{hour:'2-digit',minute:'2-digit'});
      const badge = t.network==='MTN' ? '<span class="badge mtn">MTN</span>' : '<span class="badge telecel">Telecel</span>';
      return `<tr>
        <td>${dateStr}</td>
        <td>${badge}</td>
        <td><b>${escapeHtml(t.clientName)}</b></td>
        <td>${formatMomoLink(t.momoNumber)}</td>
        <td class="ghs" style="color:var(--green)">${fmtGHSCompact(t.deposit)}</td>
        <td class="ghs" style="color:var(--red)">${fmtGHSCompact(t.withdrawal)}</td>
        <td class="ghs">${fmtGHSCompact(t.balance)}</td>
      </tr>`;
    }).join('');

    if(mobileWrap){
      mobileWrap.innerHTML = sorted.map(t=>{
        const d = new Date(t.date);
        return `<div class="m-card trial">
          <div class="m-card-head">
            <span class="badge ${t.network==='MTN'?'mtn':'telecel'}">${t.network}</span>
            <small>${d.toLocaleDateString('en-GH')}</small>
          </div>
          <div class="m-card-body">
            <div class="m-row"><span>Client:</span><b>${escapeHtml(t.clientName)}</b></div>
            <div class="m-row"><span>MoMo:</span><b>${formatMomoLink(t.momoNumber)}</b></div>
            <div class="m-row"><span>Bal:</span><b>${fmtGHSCompact(t.balance)}</b></div>
          </div>
        </div>`;
      }).join('');
    }
  }catch(e){
    console.error('Trial detail error', e);
  }
}

function updateBgCards(){
  const mtnSum = calcSummaries(transactionsCache.MTN);
  const telSum = calcSummaries(transactionsCache.Telecel);
  $('#bgMtn').textContent = fmtGHSCompact(mtnSum.balance);
  $('#bgTelecel').textContent = fmtGHSCompact(telSum.balance);
}
function updateTxCount(){
  const total = (transactionsCache.MTN?.length||0)+(transactionsCache.Telecel?.length||0);
  $('#txCount').textContent = total;
}

// ---------- Search & Filter ----------
function debounce(fn,ms){let t; return (...a)=>{clearTimeout(t); t=setTimeout(()=>fn(...a),ms)}}

$('#searchMTN')?.addEventListener('input', debounce(()=>loadTransactions('MTN'),400));
$('#filterStartMTN')?.addEventListener('change', ()=>loadTransactions('MTN'));
$('#filterEndMTN')?.addEventListener('change', ()=>loadTransactions('MTN'));

$('#searchTelecel')?.addEventListener('input', debounce(()=>loadTransactions('Telecel'),400));
$('#filterStartTelecel')?.addEventListener('change', ()=>loadTransactions('Telecel'));
$('#filterEndTelecel')?.addEventListener('change', ()=>loadTransactions('Telecel'));

$('#searchStmt')?.addEventListener('input', debounce(()=>loadStatements(),400));
$('#filterNetworkStmt')?.addEventListener('change', ()=>loadStatements());
$('#filterStartStmt')?.addEventListener('change', ()=>loadStatements());
$('#filterEndStmt')?.addEventListener('change', ()=>loadStatements());

$('#refreshTrial')?.addEventListener('click', ()=>loadTrialBalance());
$('#trialDate')?.addEventListener('change', ()=>loadTrialBalance());

// ---------- Exports ----------
function exportFile(network, type){
  if(!navigator.onLine){ toast('Export needs internet — using cached data not possible for PDF', 'error'); return; }
  let start, end, search;
  if(network==='MTN' || network==='Telecel'){
    start = $(`#filterStart${network==='MTN'?'MTN':'Telecel'}`)?.value;
    end = $(`#filterEnd${network==='MTN'?'MTN':'Telecel'}`)?.value;
    search = $(`#search${network==='MTN'?'MTN':'Telecel'}`)?.value?.trim();
  } else {
    start = $('#filterStartStmt').value;
    end = $('#filterEndStmt').value;
    search = $('#searchStmt').value.trim();
    network = $('#filterNetworkStmt').value || '';
  }
  const params = new URLSearchParams();
  if(network) params.set('network', network);
  if(start) params.set('startDate', start);
  if(end) params.set('endDate', end);
  if(search) params.set('search', search);

  const url = `${API}/api/reports/${type}?${params.toString()}`;
  fetch(url, { headers:{ Authorization:`Bearer ${token}` } })
    .then(r=>{ if(!r.ok) throw new Error('Export failed'); return r.blob(); })
    .then(blob=>{
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Mawutor_${network||'All'}_${new Date().toISOString().slice(0,10)}_${type.toUpperCase()}_with_MoMo.${type}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast(`${type.toUpperCase()} exported with MoMo numbers`);
    })
    .catch(e=> toast(e.message,'error'));
}

$('#exportCsvMTN').addEventListener('click', ()=>exportFile('MTN','csv'));
$('#exportPdfMTN').addEventListener('click', ()=>exportFile('MTN','pdf'));
$('#exportCsvTelecel').addEventListener('click', ()=>exportFile('Telecel','csv'));
$('#exportPdfTelecel').addEventListener('click', ()=>exportFile('Telecel','pdf'));
$('#exportCsvStmt').addEventListener('click', ()=>exportFile('','csv'));
$('#exportPdfStmt').addEventListener('click', ()=>exportFile('','pdf'));

// ---------- Modal ----------
const modal = $('#txModal');
function openModal(network='MTN', tx=null){
  modal.classList.remove('hidden');
  document.body.style.overflow='hidden';
  if(tx){
    if(tx._isOfflineQueued){
      toast('Cannot edit queued offline transaction — remove and re-add', 'error');
      closeModal();
      return;
    }
    $('#modalTitle').textContent = 'Edit Transaction — MoMo #';
    $('#txId').value = tx.id;
    $('#txNetwork').value = tx.network;
    $('#txDate').value = new Date(tx.date).toISOString().slice(0,16);
    $('#txClient').value = tx.clientName;
    $('#txMomo').value = tx.momoNumber||'';
    $('#txCapital').value = tx.capital;
    $('#txDeposit').value = tx.deposit;
    $('#txWithdrawal').value = tx.withdrawal;
    $('#txBranch').value = tx.branch||'Ho Dome';
  } else {
    $('#modalTitle').textContent = `Add ${network} Transaction ${!navigator.onLine?' (Offline Queued)':''}`;
    $('#txId').value = '';
    $('#txNetwork').value = network;
    $('#txDate').value = new Date().toISOString().slice(0,16);
    $('#txClient').value = '';
    $('#txMomo').value = '';
    $('#txCapital').value = 0;
    $('#txDeposit').value = 0;
    $('#txWithdrawal').value = 0;
    $('#txBranch').value = 'Ho Dome';
  }
  calcPreview();
  setTimeout(()=> $('#txClient').focus(), 100);
}
function closeModal(){
  modal.classList.add('hidden');
  document.body.style.overflow='';
}
$('#closeModal').addEventListener('click', closeModal);
$('#cancelTx').addEventListener('click', closeModal);
modal.addEventListener('click', (e)=>{ if(e.target===modal) closeModal(); });

$('#addMTNBtn').addEventListener('click', ()=>openModal('MTN'));
$('#addTelecelBtn').addEventListener('click', ()=>openModal('Telecel'));
$('#fabAdd')?.addEventListener('click', ()=>{
  const net = currentTab==='telecel' ? 'Telecel' : 'MTN';
  openModal(net);
});

function calcPreview(){
  const c = parseFloat($('#txCapital').value)||0;
  const d = parseFloat($('#txDeposit').value)||0;
  const w = parseFloat($('#txWithdrawal').value)||0;
  $('#calcBalance').textContent = fmtGHSCompact(c+d-w);
}
['#txCapital','#txDeposit','#txWithdrawal'].forEach(s=> $(s).addEventListener('input', calcPreview));

$('#txForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const id = $('#txId').value.trim();
  const momo = $('#txMomo').value.trim();
  if(!momo){
    toast('MoMo Number is required','error');
    $('#txMomo').focus();
    return;
  }
  const digits = momo.replace(/\D/g,'');
  if(digits.length < 9 || digits.length > 13){
    toast('Enter valid Ghana MoMo number (9-13 digits)','error');
    return;
  }
  const payload = {
    network: $('#txNetwork').value,
    date: $('#txDate').value ? new Date($('#txDate').value).toISOString() : new Date().toISOString(),
    clientName: $('#txClient').value.trim(),
    momoNumber: momo,
    capital: parseFloat($('#txCapital').value)||0,
    deposit: parseFloat($('#txDeposit').value)||0,
    withdrawal: parseFloat($('#txWithdrawal').value)||0,
    branch: $('#txBranch').value.trim()||'Ho Dome'
  };

  // Offline handling
  if(!navigator.onLine){
    if(id){
      // For edit offline, queue as update if original was not offline queued
      addToOfflineQueue({ type:'update', id, payload });
    } else {
      addToOfflineQueue({ type:'create', payload });
      // Optimistic local add
      const offlineTx = {
        id: 'local_' + Date.now(),
        ...payload,
        balance: (Number(payload.capital)||0)+(Number(payload.deposit)||0)-(Number(payload.withdrawal)||0),
        _isOfflineQueued: true
      };
      transactionsCache[payload.network] = [...(transactionsCache[payload.network]||[]), offlineTx];
      renderNetwork(payload.network);
      updateTxCount();
    }
    closeModal();
    toast(`📴 Offline — ${payload.clientName} queued with MoMo ${payload.momoNumber}`, 'success');
    return;
  }

  try{
    $('#saveTxBtn').disabled=true;
    $('#saveTxBtn').textContent='Saving...';
    if(id){
      await api(`/api/transactions/${id}`, { method:'PUT', body: JSON.stringify(payload) });
      toast(`Updated: ${payload.clientName} ${payload.momoNumber}`);
    }else{
      await api(`/api/transactions`, { method:'POST', body: JSON.stringify(payload) });
      toast(`Added: ${payload.clientName} ${payload.momoNumber}`);
    }
    closeModal();
    await loadTransactions(payload.network);
    await loadStatements();
    await loadTrialBalance();
  }catch(err){
    if(err.message.includes('Offline')){
      // Queue it
      if(id) addToOfflineQueue({ type:'update', id, payload });
      else {
        addToOfflineQueue({ type:'create', payload });
        const offlineTx = {
          id: 'local_' + Date.now(),
          ...payload,
          balance: (Number(payload.capital)||0)+(Number(payload.deposit)||0)-(Number(payload.withdrawal)||0),
          _isOfflineQueued: true
        };
        transactionsCache[payload.network] = [...(transactionsCache[payload.network]||[]), offlineTx];
        renderNetwork(payload.network);
      }
      closeModal();
      toast('Offline — queued for sync', 'success');
    } else {
      toast(err.message,'error');
    }
  }finally{
    $('#saveTxBtn').disabled=false;
    $('#saveTxBtn').textContent='Save Transaction';
  }
});

window.openEdit = async (id)=>{
  // Check if offline queued id
  if(id.startsWith('local_')){
    toast('Cannot edit offline queued item — remove and re-add', 'error');
    return;
  }
  try{
    const tx = await api(`/api/transactions/${id}`, { method:'GET' });
    openModal(tx.network, tx);
  }catch(err){
    // Try from cache
    const cached = [...(transactionsCache.MTN||[]), ...(transactionsCache.Telecel||[])].find(t=>t.id===id);
    if(cached) openModal(cached.network, cached);
    else toast(err.message,'error');
  }
};
window.deleteTx = async (id)=>{
  if(id.startsWith('local_')){
    removeFromQueue(id);
    // Remove from cache
    transactionsCache.MTN = transactionsCache.MTN.filter(t=>t.id!==id);
    transactionsCache.Telecel = transactionsCache.Telecel.filter(t=>t.id!==id);
    renderNetwork('MTN'); renderNetwork('Telecel');
    toast('Removed queued offline transaction', 'success');
    updateOfflineUI();
    return;
  }
  if(!confirm('Delete this transaction? It will be soft-deleted but kept for audit (with MoMo #).')) return;
  if(!navigator.onLine){
    addToOfflineQueue({ type:'delete', id, payload: { id } });
    // Optimistic remove
    transactionsCache.MTN = transactionsCache.MTN.filter(t=>t.id!==id);
    transactionsCache.Telecel = transactionsCache.Telecel.filter(t=>t.id!==id);
    renderNetwork('MTN'); renderNetwork('Telecel');
    toast('📴 Offline — delete queued', 'success');
    return;
  }
  try{
    await api(`/api/transactions/${id}`, { method:'DELETE' });
    toast('Transaction deleted (soft)');
    loadAllData();
  }catch(err){
    if(err.message.includes('Offline')){
      addToOfflineQueue({ type:'delete', id, payload: { id } });
      toast('Offline — delete queued', 'success');
    } else toast(err.message,'error');
  }
};

// ---------- Logout ----------
$('#logoutBtn').addEventListener('click', ()=>{ if(confirm('Logout?')) logout(); });
function logout(){
  // Keep cached data for offline? Clear token but keep cache
  setAuthView();
  toast('Logged out — offline cache kept');
}

// ---------- Closed Days (Daily Closing Feature) ----------
let closedDaysCache = [];
async function loadClosedDays(silent=false){
  try {
    const days = await api('/api/closed-days', { method:'GET' });
    closedDaysCache = days;
    if(!silent) renderClosedDays();
    // Update UI badges
    updateClosedDayBadges();
    // Store in local cache for offline view
    try { localStorage.setItem(CACHE_PREFIX+'closedDays', JSON.stringify(days)); } catch {}
    return days;
  } catch(e){
    // Try offline cache
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_PREFIX+'closedDays')||'[]');
      closedDaysCache = cached;
      if(!silent) renderClosedDays();
      updateClosedDayBadges();
      return cached;
    } catch {
      console.error('Closed days load failed', e.message);
      if(!silent) toast(e.message,'error');
      return [];
    }
  }
}
function updateClosedDayBadges(){
  // Show closed badge if filter date is closed
  const checkTab = (network) => {
    const dateInput = $(`#filterStart${network}`)?.value || $(`#filterEnd${network}`)?.value || new Date().toISOString().slice(0,10);
    const isClosed = isDateClosed(dateInput, network);
    const badge = document.getElementById(`${network.toLowerCase()}ClosedBadge`);
    const info = document.getElementById(`closedDaysInfo${network}`);
    if(badge){
      if(isClosed){
        badge.style.display='inline-block';
        badge.textContent = `🔒 Closed ${dateInput}`;
      } else {
        badge.style.display='none';
      }
    }
    if(info){
      if(isClosed){
        info.classList.remove('hidden');
        info.innerHTML = `🔒 Day <b>${dateInput}</b> is <b>closed</b> ${isClosed.network? '('+isClosed.network+')':'(all networks)'}. Attendants cannot add/edit/delete transactions for this day. Only admin can reopen. Closed by ${isClosed.closedBy||'admin'} at ${new Date(isClosed.closedAt).toLocaleString()}`;
      } else {
        info.classList.add('hidden');
      }
    }
  };
  checkTab('MTN');
  checkTab('Telecel');
}
function isDateClosed(dateStr, network=null){
  if(!dateStr) return null;
  const iso = new Date(dateStr).toISOString().slice(0,10);
  for(const d of closedDaysCache){
    if(d.date===iso){
      if(!d.network) return d; // closed all
      if(!network) return d;
      if(d.network===network) return d;
    }
  }
  return null;
}
function renderClosedDays(){
  const tbody = $('#tbodyClosedDays');
  if(!tbody) return;
  if(closedDaysCache.length===0){
    tbody.innerHTML = '<tr><td colspan="6" class="center muted">No closed days yet. Close a day to lock transactions for attendants.</td></tr>';
    return;
  }
  tbody.innerHTML = closedDaysCache.map(d=>{
    const closedAt = new Date(d.closedAt).toLocaleString('en-GH');
    const badge = d.network ? `<span class="badge ${d.network==='MTN'?'mtn':'telecel'}">${d.network}</span>` : '<span class="badge" style="background:#6c757d;color:white">All</span>';
    return `<tr>
      <td><b>${d.date}</b></td>
      <td>${badge}</td>
      <td>${escapeHtml(d.closedBy||'admin')}</td>
      <td>${closedAt}</td>
      <td>${escapeHtml(d.branch||'Ho Dome')}</td>
      <td>${user?.role==='admin' ? `<button class="btn ghost sm" onclick="openClosedDay('${d.date}','${d.network||''}')">Reopen</button>` : '<small class="muted">Admin only</small>'}</td>
    </tr>`;
  }).join('');
}
async function closeDayPrompt(network=null){
  if(user?.role!=='admin'){
    toast('Only admin can close days', 'error');
    return;
  }
  const defaultDate = new Date().toISOString().slice(0,10);
  const dateStr = prompt(`Enter date to CLOSE (YYYY-MM-DD). Attendants will no longer edit transactions for this day.\n\nLeave empty for today (${defaultDate}):`, defaultDate);
  if(dateStr===null) return; // cancelled
  const finalDate = (dateStr.trim()||defaultDate);
  // Validate date
  if(!/^\d{4}-\d{2}-\d{2}$/.test(finalDate)){
    toast('Invalid date format. Use YYYY-MM-DD', 'error');
    return;
  }
  const netChoice = network || prompt('Close for which network? Leave empty for ALL networks, or type MTN / Telecel:', network||'') || null;
  const net = (netChoice && ['MTN','Telecel'].includes(netChoice.trim())) ? netChoice.trim() : (network||null);
  if(!confirm(`Close ${finalDate} ${net? '('+net+')' : '(ALL networks)'}? Attendants cannot add/edit/delete for this day.`)) return;
  try {
    await api('/api/closed-days', { method:'POST', body: JSON.stringify({ date: finalDate, network: net }) });
    toast(`🔒 Day ${finalDate} closed ${net? '('+net+')':''}`, 'success');
    await loadClosedDays();
    loadAllData();
  } catch(e){
    toast(e.message,'error');
  }
}
async function openClosedDay(date, network){
  if(user?.role!=='admin'){
    toast('Only admin can reopen', 'error');
    return;
  }
  if(!confirm(`Reopen ${date} ${network? '('+network+')':'(ALL)'}? Attendants will be able to edit again.`)) return;
  try {
    const params = network ? `?network=${network}` : '';
    await api(`/api/closed-days/${date}${params}`, { method:'DELETE' });
    toast(`🔓 Day ${date} reopened`, 'success');
    await loadClosedDays();
    loadAllData();
  } catch(e){
    toast(e.message,'error');
  }
}
window.openClosedDay = openClosedDay;

// Bind close day buttons
$('#closeDayMTN')?.addEventListener('click', ()=> closeDayPrompt('MTN'));
$('#closeDayTelecel')?.addEventListener('click', ()=> closeDayPrompt('Telecel'));
$('#manageClosedDaysBtn')?.addEventListener('click', ()=>{
  const sec = $('#closedDaysSection');
  sec.classList.toggle('hidden');
  if(!sec.classList.contains('hidden')) loadClosedDays();
});

// Update socket to listen for closed days changes
function initSocketClosedDaysIntegration(){
  if(socket){
    socket.on('closedDays:changed', (payload)=>{
      toast(`${payload.action.toUpperCase()}: Closed day ${payload.closedDay.date} ${payload.closedDay.network||'(ALL)'}`, 'success');
      loadClosedDays(true);
      // Refresh current views
      if(currentTab==='mtn' || currentTab==='telecel') loadTransactions(payload.closedDay.network||currentTab==='mtn'?'MTN':'Telecel', true);
    });
  }
}
// Override initSocket to also hook closed days
const originalInitSocket = initSocket;
initSocket = function(){
  originalInitSocket();
  // Add closed days listener after socket init
  setTimeout(()=>{
    if(socket){
      socket.off('closedDays:changed');
      socket.on('closedDays:changed', (payload)=>{
        toast(`${payload.action.toUpperCase()}: Day ${payload.closedDay.date} ${payload.closedDay.network||'(ALL)'}`, 'success');
        loadClosedDays(true);
      });
    }
  }, 500);
};

// ---------- Offline UI Handlers ----------
$('#viewOfflineQueueBtn')?.addEventListener('click', ()=>{
  const list = $('#offlineQueueList');
  list.classList.toggle('hidden');
  updateOfflineUI();
});
$('#syncNowBtn')?.addEventListener('click', ()=>{
  syncOfflineQueue();
});
$('#clearCacheBtn')?.addEventListener('click', ()=>{
  if(confirm('Clear offline cache? You will lose cached transactions for offline viewing (but not queued).')){
    Object.keys(localStorage).forEach(k=>{
      if(k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
    });
    toast('Offline cache cleared');
  }
});

// ---------- Init ----------
(function init(){
  updateOfflineUI();
  if(token && user){ setDashboardView(); }
  else {
    // Try offline login from cached user
    const cachedUser = JSON.parse(localStorage.getItem('mde_cached_user')||'null');
    if(!navigator.onLine && cachedUser && localStorage.getItem('mde_token')){
      token = localStorage.getItem('mde_token');
      user = cachedUser;
      toast('📴 Offline mode — using cached login', 'success');
      setDashboardView();
    } else {
      $('#authView').classList.remove('hidden');
    }
  }
  const today = new Date().toISOString().slice(0,10);
  const td = $('#trialDate');
  if(td) td.value = today;

  let lastTouchEnd = 0;
  document.addEventListener('touchend', function(e){
    const now = Date.now();
    if(now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, false);

  // Auto-sync when coming online
  window.addEventListener('online', ()=> {
    toast('📶 Back online — syncing...', 'success');
    setTimeout(syncOfflineQueue, 1000);
    // Re-init socket
    if(user) initSocket();
  });

  // Periodic sync check
  setInterval(()=>{ if(navigator.onLine) syncOfflineQueue(); }, 30000);

  // PWA install prompt handled in index.html
})();
