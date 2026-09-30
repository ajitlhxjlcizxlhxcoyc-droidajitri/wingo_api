// ============================================================
// DARKWIN — FULL API SERVER (Game + Admin + Hack + Demo + NEW FEATURES)
// ============================================================

const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ==================== IN-MEMORY DB ====================
let users = [];
let banners = [];
let messages = [];
let deposits = [];
let withdrawals = [];
let giftCodes = [];
let bets = [];
let upiAccounts = {};
let bankAccounts = {};
let demoAccounts = [];
let nextResultOverride = {};

// ===== NEW: Settings for images & icons =====
let resultImages = {
  win: 'https://i.ibb.co/PLACEHOLDER/win-banner.png',
  lose: 'https://i.ibb.co/PLACEHOLDER/lose-banner.png'
};

let accountIcons = {
  deposit: '',
  withdraw: '',
  gift: '',
  vip: '',
  notification: '',
  agent: '',
  support: '',
  liveSupport: '',
  depHistory: '',
  wdHistory: '',
  gameHistory: '',
  giftCode: ''
};

// ===== NEW: Live support chats =====
let supportChats = {}; // { uid: [{ sender, text, time, readByAdmin }] }

// ==================== GAMES CONFIG ====================
let games = [
  { id: 'g1', name: 'Win Go', logo: 'https://i.ibb.co/dsPsXy3t/vendorlogo-20240321183353rwkf.png', sub: '30s · 1m · 3m', category: 'popular', position: 1, gameKey: 'Win Go' },
  { id: 'g2', name: 'K3', logo: 'https://i.ibb.co/qtz8fDG/vendorlogo-20240321183450ph8e.png', sub: '1m · 3m · 5m', category: 'popular', position: 2, gameKey: 'K3' },
  { id: 'g3', name: '5D', logo: 'https://i.ibb.co/mChr8gbL/vendorlogo-20240321183506uo8v.png', sub: '1m · 3m · 5m', category: 'popular', position: 3, gameKey: '5D' },
  { id: 'g4', name: 'Win Go', logo: 'https://i.ibb.co/dsPsXy3t/vendorlogo-20240321183353rwkf.png', sub: '30s · 1m · 3m', category: 'regular', position: 1, gameKey: 'Win Go' },
  { id: 'g5', name: 'K3', logo: 'https://i.ibb.co/qtz8fDG/vendorlogo-20240321183450ph8e.png', sub: '1m · 3m · 5m', category: 'regular', position: 2, gameKey: 'K3' },
  { id: 'g6', name: '5D', logo: 'https://i.ibb.co/mChr8gbL/vendorlogo-20240321183506uo8v.png', sub: '1m · 3m · 5m', category: 'regular', position: 3, gameKey: '5D' },
  { id: 'g7', name: 'Racing', logo: 'https://i.ibb.co/twmZNttS/vendorlogo-20240322155135ilqv.png', sub: 'Live', category: 'regular', position: 4, gameKey: 'Racing' },
  { id: 'g8', name: 'Poker', logo: 'https://i.ibb.co/5W3w8QkF/51.png', sub: 'Live', category: 'regular', position: 5, gameKey: 'Poker' },
  { id: 'g9', name: 'Slots', logo: 'https://i.ibb.co/rGNHKBRL/800-20240324164730110.png', sub: 'New', category: 'regular', position: 6, gameKey: 'Slots' },
  { id: 'g10', name: 'Aviator', logo: 'https://i.ibb.co/CpFnBVVm/AB3.png', sub: 'Live', category: 'regular', position: 7, gameKey: 'Aviator' },
  { id: 'g11', name: 'Lottery', logo: 'https://i.ibb.co/rG2Hr5QZ/lotterycategory-20240321194510h9i1.png', sub: 'Live', category: 'regular', position: 8, gameKey: 'Lottery' },
  { id: 'g12', name: 'Lucky Draw', logo: 'https://i.ibb.co/4nXCvd2t/lotterycategory-20240321194451en5o.png', sub: 'New', category: 'regular', position: 9, gameKey: 'Lucky Draw' },
  { id: 'g13', name: 'Lotto', logo: 'https://i.ibb.co/QFrQXFHK/lotterycategory-20240321194519jacj.png', sub: 'Live', category: 'regular', position: 10, gameKey: 'Lotto' },
  { id: 'g14', name: 'Mini Game', logo: 'https://i.ibb.co/pTYDXDL/vendorlogo-20240411190844d133.png', sub: 'New', category: 'regular', position: 11, gameKey: 'Mini Game' }
];

// ==================== ADMIN AUTH ====================
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const HACK_KEY = process.env.HACK_KEY || 'darkwin2026';
let adminTokens = new Set();

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || !adminTokens.has(token)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
  const token = 'ADM' + Date.now() + Math.random().toString(36).slice(2);
  adminTokens.add(token);
  setTimeout(() => adminTokens.delete(token), 8 * 60 * 60 * 1000);
  res.json({ message: 'Login successful', token });
});

// ==================== WINGO CONFIG ====================
const WINGO_MODES = { wingo30: 30, wingo1: 60, wingo3: 180, wingo5: 300, wingo10: 600 };
const gameState = {};
Object.keys(WINGO_MODES).forEach(mode => { gameState[mode] = { current: null, history: [] }; });

let pendingResults = {};

// ==================== VIP CONFIG ====================
const VIP_CONFIG = [
  { level: 1, expNeeded: 3000, levelUpBonus: 60, depositBonus: 100, weeklyBonus: 30, monthlyBonus: 80 },
  { level: 2, expNeeded: 30000, levelUpBonus: 180, depositBonus: 300, weeklyBonus: 90, monthlyBonus: 280 },
  { level: 3, expNeeded: 400000, levelUpBonus: 690, depositBonus: 1200, weeklyBonus: 390, monthlyBonus: 980 },
  { level: 4, expNeeded: 1000000, levelUpBonus: 1890, depositBonus: 2500, weeklyBonus: 990, monthlyBonus: 2500 },
  { level: 5, expNeeded: 3000000, levelUpBonus: 4890, depositBonus: 5000, weeklyBonus: 2190, monthlyBonus: 5800 },
  { level: 6, expNeeded: 10000000, levelUpBonus: 16900, depositBonus: 10000, weeklyBonus: 6890, monthlyBonus: 18800 },
  { level: 7, expNeeded: 30000000, levelUpBonus: 58900, depositBonus: 25000, weeklyBonus: 18900, monthlyBonus: 58000 },
  { level: 8, expNeeded: 100000000, levelUpBonus: 169000, depositBonus: 50000, weeklyBonus: 58900, monthlyBonus: 168000 },
  { level: 9, expNeeded: 300000000, levelUpBonus: 689000, depositBonus: 100000, weeklyBonus: 189000, monthlyBonus: 580000 },
  { level: 10, expNeeded: 1000000000, levelUpBonus: 1890000, depositBonus: 250000, weeklyBonus: 589000, monthlyBonus: 1680000 }
];

// ==================== MILESTONES ====================
const MILESTONES = [
  { id: 'm1', deposit: 100, reward: '₹10 Bonus', icon: '🎁', bonus: 10 },
  { id: 'm2', deposit: 500, reward: '₹30 Bonus', icon: '🎁', bonus: 30 },
  { id: 'm3', deposit: 1000, reward: '₹75 Bonus', icon: '🎁', bonus: 75 },
  { id: 'm4', deposit: 5000, reward: '₹400 Bonus', icon: '🎁', bonus: 400 },
  { id: 'm5', deposit: 10000, reward: '₹1000 Bonus', icon: '🎁', bonus: 1000 },
  { id: 'm6', deposit: 50000, reward: '₹5000 Bonus', icon: '🎁', bonus: 5000 }
];

// ==================== PAGES CONFIG ====================
let pagesConfig = {
  home: {
    marqueeText: '🎉 Welcome to DARKWIN! Win big with WinGo 30s, 1m, 3m. Instant withdrawals! 🎉',
    logoUrl: 'https://i.ibb.co/pvMbkdBb/images-3.jpg',
    siteName: 'DARKWIN',
    registerBonus: 58
  },
  deposit: {
    upiNumber: '7478478039',
    qrCodeUrl: 'https://i.ibb.co/kVBLF7G6/Screenshot-20260918-145024.png'
  },
  promotion: {
    rules: 'Invite friends and earn up to 10%\nDaily bonus for active players\nWeekly and monthly VIP rewards\nWithdraw anytime after meeting bet requirement'
  },
  telegram: {
    link: 'https://t.me/+aSkhYV8PvOBmZWM9',
    label: 'Production Channel'
  },
  gift: {
    imageUrl: 'https://www.66lotterym.com/assets/gift.b89f79f7.png'
  }
};

// ==================== UID GEN ====================
function genUID() {
  let uid, attempts = 0;
  do {
    uid = String(Math.floor(100000 + Math.random() * 900000));
    attempts++;
    if (attempts > 200) break;
  } while (users.find(u => u.uid === uid));
  return uid;
}

// ==================== NEW: ACTIVITY TRACKER MIDDLEWARE ====================
app.use((req, res, next) => {
  try {
    const uid = (req.body && req.body.uid) || (req.params && req.params.uid) || (req.query && req.query.uid);
    if (uid) {
      const user = users.find(u => u.uid === uid);
      if (user) {
        const now = new Date().toISOString();
        user.lastActiveAt = now;
        if (!user.activityLog) user.activityLog = [];
        user.activityLog.push({ at: now, path: req.path, method: req.method });
        if (user.activityLog.length > 200) user.activityLog = user.activityLog.slice(-200);
        if (!user.ip) user.ip = req.ip;
      }
    }
  } catch(e) {}
  next();
});

// ==================== PERIOD ENGINE ====================
let periodSeq = Math.floor(Date.now() / 1000) % 100000000;

function makePeriodNumber() {
  periodSeq += 1;
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}${String(periodSeq).padStart(8, '0').slice(-8)}`;
}

function createNewPeriod(mode) {
  const dur = WINGO_MODES[mode] * 1000;
  const now = Date.now();
  const startTime = Math.floor(now / dur) * dur;
  return {
    id: 'P' + Date.now() + Math.random().toString(36).slice(2, 6),
    period: makePeriodNumber(),
    mode,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(startTime + dur).toISOString(),
    status: 'OPEN',
    number: null,
    result: null
  };
}

function closePeriod(mode, forcedNumber = null) {
  const state = gameState[mode];
  if (!state.current) return null;
  const p = state.current;
  let finalNumber;
  if (forcedNumber !== null && forcedNumber !== undefined) finalNumber = Number(forcedNumber);
  else if (pendingResults[mode] !== undefined) { finalNumber = Number(pendingResults[mode]); delete pendingResults[mode]; }
  else if (nextResultOverride[mode] !== undefined) { finalNumber = Number(nextResultOverride[mode]); delete nextResultOverride[mode]; }
  else if (p.number === null) finalNumber = Math.floor(Math.random() * 10);
  else finalNumber = p.number;
  p.number = finalNumber;
  p.result = finalNumber;
  p.status = 'CLOSED';
  p.closedAt = new Date().toISOString();
  state.history.unshift({ ...p });
  if (state.history.length > 200) state.history = state.history.slice(0, 200);
  settleBetsForPeriod(p.period, finalNumber);
  return p;
}

function tickMode(mode) {
  const state = gameState[mode];
  const now = Date.now();
  if (state.current && new Date(state.current.endTime).getTime() <= now) {
    closePeriod(mode);
    state.current = createNewPeriod(mode);
  } else if (!state.current) {
    state.current = createNewPeriod(mode);
  }
}

function settleBetsForPeriod(periodNum, winNumber) {
  const pending = bets.filter(b => b.period === periodNum && b.result === 'pending');
  const colors = winNumber === 0 ? ['violet', 'red']
    : winNumber === 5 ? ['violet', 'green']
    : [1, 3, 7, 9].includes(winNumber) ? ['green'] : ['red'];
  pending.forEach(bet => {
    const user = users.find(u => u.uid === bet.uid);
    if (!user) return;
    let win = false, payout = 0;
    const v = bet.betValue;
    if (v === 'green' || v === 'red' || v === 'violet') {
      if (colors.includes(v)) { win = true; payout = bet.amount * (v === 'violet' ? 4.5 : 2); }
    } else if (v === 'big') {
      if (winNumber >= 5) { win = true; payout = bet.amount * 2; }
    } else if (v === 'small') {
      if (winNumber <= 4) { win = true; payout = bet.amount * 2; }
    } else if (v !== null && v !== undefined && !isNaN(Number(v))) {
      if (Number(v) === winNumber) { win = true; payout = bet.amount * 9; }
    }
    bet.result = win ? 'win' : 'lose';
    bet.payout = Math.round(payout * 100) / 100;
    bet.winNumber = winNumber;
    bet.settledAt = new Date().toISOString();
    if (win) {
      user.balance += bet.payout;
      user.totalWin += bet.payout;
      user.lastWinAt = new Date().toISOString();
      user.lastWinAmount = bet.payout;
    }
  });
}

// Seed
Object.keys(WINGO_MODES).forEach(mode => {
  const state = gameState[mode];
  for (let i = 0; i < 20; i++) {
    state.history.push({
      id: 'SEED_' + mode + '_' + i,
      period: String(periodSeq - i - 1),
      mode,
      number: Math.floor(Math.random() * 10),
      result: Math.floor(Math.random() * 10),
      status: 'CLOSED',
      closedAt: new Date().toISOString()
    });
  }
  state.current = createNewPeriod(mode);
});

setInterval(() => { Object.keys(WINGO_MODES).forEach(mode => tickMode(mode)); }, 1000);

// ==================== AUTH APIs ====================
app.post('/api/auth/register', (req, res) => {
  const { phone, password, referralCode } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'Phone & password required' });
  if (users.find(u => u.phone === phone)) return res.status(400).json({ error: 'Phone already registered' });
  const uid = genUID();
  const inviteCode = uid;
  const registerBonus = pagesConfig.home.registerBonus || 58;
  const now = new Date().toISOString();
  const user = {
    uid, phone, password,
    balance: registerBonus,
    exp: 0, vipLevel: 0, isBanned: false,
    refereeCode: inviteCode, inviteCode: inviteCode,
    referredBy: referralCode || null,
    totalDeposit: 0, totalBet: 0, totalWin: 0,
    registerBonus: registerBonus,
    claimedMilestones: [],
    isDemo: false,
    createdAt: now,
    lastActiveAt: now,
    dp: `https://i.pravatar.cc/100?u=${uid}`,
    ip: req.ip,
    loginHistory: [{ at: now, ip: req.ip, type: 'register' }],
    activityLog: [{ at: now, action: 'register', path: '/api/auth/register' }],
    resetHistory: []
  };
  users.push(user);
  messages.push({
    id: Date.now(), uid,
    title: 'Sign Up Bonus 🎉',
    message: `Welcome to DARKWIN! ₹${registerBonus} bonus credited to your account. Enjoy!`,
    date: now
  });
  res.json({ message: 'Registration successful', user, registerBonus });
});

app.post('/api/auth/login', (req, res) => {
  const { phone, password } = req.body;
  const user = users.find(u => u.phone === phone && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.isBanned) return res.status(403).json({ error: 'Account banned' });
  const now = new Date().toISOString();
  if (!user.loginHistory) user.loginHistory = [];
  user.loginHistory.push({ at: now, ip: req.ip, type: 'login' });
  if (user.loginHistory.length > 100) user.loginHistory = user.loginHistory.slice(-100);
  user.lastActiveAt = now;
  res.json({ message: 'Login successful', user });
});

// ==================== USER APIs ====================
app.get('/api/user/balance/:uid', (req, res) => {
  const user = users.find(u => u.uid === req.params.uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    balance: user.balance,
    vipLevel: user.vipLevel,
    exp: user.exp,
    totalDeposit: user.totalDeposit,
    totalBet: user.totalBet,
    totalWin: user.totalWin,
    inviteCode: user.inviteCode,
    isDemo: user.isDemo || false,
    dp: user.dp
  });
});

app.get('/api/user/profile/:uid', (req, res) => {
  const user = users.find(u => u.uid === req.params.uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ===== NEW: Update user DP =====
app.post('/api/user/dp', (req, res) => {
  const { uid, dp } = req.body;
  const user = users.find(u => u.uid === uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.dp = dp;
  res.json({ message: 'DP updated', dp });
});

// ===== NEW: ID Reset (same phone+password, new UID, history preserved) =====
app.post('/api/user/reset-id', (req, res) => {
  const { uid } = req.body;
  const user = users.find(u => u.uid === uid);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const oldUid = user.uid;
  const newUid = genUID();
  const now = new Date().toISOString();

  // Archive the old record
  if (!user.resetHistory) user.resetHistory = [];
  user.resetHistory.push({
    oldUid,
    resetAt: now,
    balance: user.balance,
    totalDeposit: user.totalDeposit,
    totalBet: user.totalBet,
    totalWin: user.totalWin
  });

  // Change UID (phone, password, balance & all history preserved)
  user.uid = newUid;
  user.refereeCode = newUid;
  user.inviteCode = newUid;
  user.lastActiveAt = now;

  // Update all references
  bets.forEach(b => { if (b.uid === oldUid) b.uid = newUid; });
  deposits.forEach(d => { if (d.uid === oldUid) d.uid = newUid; });
  withdrawals.forEach(w => { if (w.uid === oldUid) w.uid = newUid; });
  messages.forEach(m => { if (m.uid === oldUid) m.uid = newUid; });
  if (upiAccounts[oldUid]) { upiAccounts[newUid] = upiAccounts[oldUid]; delete upiAccounts[oldUid]; }
  if (bankAccounts[oldUid]) { bankAccounts[newUid] = bankAccounts[oldUid]; delete bankAccounts[oldUid]; }
  if (supportChats[oldUid]) { supportChats[newUid] = supportChats[oldUid]; delete supportChats[oldUid]; }

  messages.push({
    id: Date.now(), uid: newUid,
    title: '🆔 New ID Generated',
    message: `Your new UID is ${newUid}. Same password, same number, all history preserved.`,
    date: now
  });

  res.json({ message: 'ID reset successful', oldUid, newUid, user });
});

// ==================== NEW: RESULT IMAGES & ACCOUNT ICONS ====================
app.get('/api/settings/result-images', (req, res) => res.json(resultImages));

app.post('/api/admin/settings/result-images', adminAuth, (req, res) => {
  const { win, lose } = req.body;
  if (win !== undefined) resultImages.win = win;
  if (lose !== undefined) resultImages.lose = lose;
  res.json({ message: 'Result images updated', resultImages });
});

app.get('/api/settings/account-icons', (req, res) => res.json(accountIcons));

app.post('/api/admin/settings/account-icons', adminAuth, (req, res) => {
  Object.keys(req.body).forEach(k => {
    if (k in accountIcons) accountIcons[k] = req.body[k];
  });
  res.json({ message: 'Account icons updated', accountIcons });
});

// ==================== NEW: LIVE SUPPORT CHAT ====================
app.get('/api/support/messages/:uid', (req, res) => {
  const chat = supportChats[req.params.uid] || [];
  res.json(chat);
});

app.post('/api/support/message', (req, res) => {
  const { uid, text } = req.body;
  if (!uid || !text) return res.status(400).json({ error: 'Missing fields' });
  if (!supportChats[uid]) supportChats[uid] = [];
  supportChats[uid].push({
    sender: 'user',
    text: String(text).slice(0, 1000),
    time: new Date().toISOString(),
    readByAdmin: false
  });
  res.json({ message: 'Sent' });
});

// Admin: list all support chats
app.get('/api/admin/support/chats', adminAuth, (req, res) => {
  const chats = Object.keys(supportChats).map(uid => {
    const msgs = supportChats[uid] || [];
    const user = users.find(u => u.uid === uid);
    const last = msgs[msgs.length - 1];
    return {
      uid,
      name: user ? ('USER' + user.phone.slice(-4)) : 'Unknown',
      phone: user ? user.phone : '',
      lastMessage: last ? last.text : '',
      lastTime: last ? last.time : '',
      unreadCount: msgs.filter(m => m.sender === 'user' && !m.readByAdmin).length,
      totalMessages: msgs.length
    };
  }).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
  res.json(chats);
});

// Admin: get specific chat
app.get('/api/admin/support/chat/:uid', adminAuth, (req, res) => {
  const chat = supportChats[req.params.uid] || [];
  chat.forEach(m => { if (m.sender === 'user') m.readByAdmin = true; });
  res.json(chat);
});

// Admin: reply
app.post('/api/admin/support/reply', adminAuth, (req, res) => {
  const { uid, text } = req.body;
  if (!uid || !text) return res.status(400).json({ error: 'Missing fields' });
  if (!supportChats[uid]) supportChats[uid] = [];
  supportChats[uid].push({
    sender: 'admin',
    text: String(text).slice(0, 1000),
    time: new Date().toISOString(),
    readByAdmin: true
  });
  res.json({ message: 'Sent' });
});

// ==================== NEW: HOME TOP + LIVE WINNERS ====================
app.get('/api/home/top-winners', (req, res) => {
  const top = users
    .filter(u => (u.totalWin || 0) > 0)
    .sort((a, b) => (b.totalWin || 0) - (a.totalWin || 0))
    .slice(0, 10)
    .map(u => ({
      uid: u.uid,
      name: 'USER' + u.phone.slice(-4),
      dp: u.dp || `https://i.pravatar.cc/60?u=${u.uid}`,
      amount: u.totalWin || 0
    }));
  res.json(top);
});

app.get('/api/home/live-winners', (req, res) => {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const recent = bets
    .filter(b => b.result === 'win' && b.settledAt && b.settledAt >= fiveMinAgo)
    .sort((a, b) => new Date(b.settledAt) - new Date(a.settledAt))
    .slice(0, 15)
    .map(b => {
      const u = users.find(x => x.uid === b.uid);
      return {
        uid: b.uid,
        name: u ? ('USER' + u.phone.slice(-4)) : 'USER',
        dp: u?.dp || `https://i.pravatar.cc/60?u=${b.uid}`,
        amount: b.payout || 0,
        game: b.betType || 'WinGo',
        time: 'just now'
      };
    });
  res.json(recent);
});

// ==================== PUBLIC APIs ====================
app.get('/api/banners', (req, res) => res.json(banners.filter(b => b.active !== false)));
app.get('/api/banners/popup', (req, res) => res.json(banners.filter(b => b.isPopup && b.active !== false)));
app.get('/api/pages', (req, res) => res.json(pagesConfig));
app.get('/api/games', (req, res) => res.json(games.filter(g => g.active !== false)));

app.get('/api/today-earnings', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const winners = users
    .filter(u => u.lastWinAt && u.lastWinAt.startsWith(today) && u.lastWinAmount > 0)
    .map(u => ({
      uid: u.uid, phone: u.phone,
      name: 'USER' + u.phone.slice(-4),
      dp: u.dp,
      amount: u.lastWinAmount, at: u.lastWinAt
    }))
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 3);
  res.json(winners);
});

// ==================== WINGO APIs ====================
app.get('/api/game/wingo/periods', (req, res) => {
  const mode = req.query.mode || 'wingo30';
  const state = gameState[mode];
  if (!state) return res.json([]);
  res.json(state.history.slice(0, 10).map(h => ({
    period: h.period, number: h.number, result: h.result, status: 'CLOSED'
  })));
});

app.get('/api/period/current', (req, res) => {
  const mode = req.query.mode || 'wingo30';
  const state = gameState[mode];
  if (!state || !state.current) return res.status(404).json({ error: 'No active period' });
  res.json(state.current);
});

app.get('/api/period/history', (req, res) => {
  const mode = req.query.mode || 'wingo30';
  const state = gameState[mode];
  if (!state) return res.json([]);
  res.json(state.history.slice(0, 50));
});

app.post('/api/game/wingo/bet', (req, res) => {
  const { uid, betAmount, betType, betValue, selection } = req.body;
  const user = users.find(u => u.uid === uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.isBanned) return res.status(403).json({ error: 'Account banned' });
  const amount = Number(betAmount);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });
  const mode = WINGO_MODES[betType] ? betType : 'wingo30';
  const state = gameState[mode];
  if (!state.current) return res.status(500).json({ error: 'Game not ready' });
  const remainSec = Math.floor((new Date(state.current.endTime).getTime() - Date.now()) / 1000);
  if (remainSec < 5) return res.status(400).json({ error: 'Betting is closed for this period' });
  user.balance -= amount;
  user.totalBet += amount;
  user.exp += amount;
  VIP_CONFIG.forEach(v => { if (user.exp >= v.expNeeded && user.vipLevel < v.level) user.vipLevel = v.level; });
  const bet = {
    id: 'WG' + Date.now() + Math.floor(Math.random() * 100000),
    uid, amount,
    betType: mode, betValue, selection,
    period: state.current.period, mode,
    result: 'pending', payout: 0, winNumber: null,
    createdAt: new Date().toISOString()
  };
  bets.push(bet);
  res.json({ message: 'Bet placed', betId: bet.id, bet, balance: user.balance });
});

app.get('/api/game/wingo/history/:uid', (req, res) => {
  const userBets = bets
    .filter(b => b.uid === req.params.uid)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100);
  res.json(userBets);
});

app.get('/api/game/wingo/bet/:betId', (req, res) => {
  const bet = bets.find(b => b.id === req.params.betId);
  if (!bet) return res.status(404).json({ error: 'Bet not found' });
  res.json(bet);
});

app.get('/api/user/bets/:uid', (req, res) => res.json(bets.filter(b => b.uid === req.params.uid)));
app.get('/api/user/bets/:uid/active', (req, res) => res.json(bets.filter(b => b.uid === req.params.uid && b.result === 'pending')));

// ==================== VIP ====================
app.get('/api/vip/status/:uid', (req, res) => {
  const user = users.find(u => u.uid === req.params.uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    uid: user.uid, exp: user.exp, vipLevel: user.vipLevel,
    vipConfig: VIP_CONFIG, history: []
  });
});

// ==================== MILESTONES ====================
app.get('/api/milestones/:uid', (req, res) => {
  const user = users.find(u => u.uid === req.params.uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const claimed = user.claimedMilestones || [];
  res.json({
    totalDeposit: user.totalDeposit,
    milestones: MILESTONES.map(m => ({
      ...m,
      unlocked: user.totalDeposit >= m.deposit,
      claimed: claimed.includes(m.id)
    }))
  });
});

app.post('/api/milestones/claim', (req, res) => {
  const { uid, milestoneId } = req.body;
  const user = users.find(u => u.uid === uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const m = MILESTONES.find(x => x.id === milestoneId);
  if (!m) return res.status(404).json({ error: 'Invalid milestone' });
  if (user.totalDeposit < m.deposit) return res.status(400).json({ error: 'Not unlocked' });
  if (!user.claimedMilestones) user.claimedMilestones = [];
  if (user.claimedMilestones.includes(milestoneId)) return res.status(400).json({ error: 'Already claimed' });
  user.claimedMilestones.push(milestoneId);
  user.balance += m.bonus;
  res.json({ message: 'Claimed', balance: user.balance, bonus: m.bonus });
});

// ==================== MESSAGES ====================
app.get('/api/user/messages/:uid', (req, res) => {
  res.json(messages
    .filter(m => m.uid === req.params.uid)
    .sort((a, b) => new Date(b.date) - new Date(a.date)));
});

// ==================== GIFT CODES (UPDATED: maxUsers + time limit) ====================
app.post('/api/user/claim-giftcode', (req, res) => {
  const { uid, code } = req.body;
  const user = users.find(u => u.uid === uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const gift = giftCodes.find(g => g.code === (code || '').toUpperCase());
  if (!gift) return res.status(400).json({ error: 'Invalid code' });

  // Time check
  if (gift.expiresAt && new Date(gift.expiresAt) < new Date()) {
    return res.status(400).json({ error: 'Code expired' });
  }

  // Already used by this user?
  if (!gift.usedBy) gift.usedBy = [];
  if (gift.usedBy.includes(uid)) {
    return res.status(400).json({ error: 'You already used this code' });
  }

  // Max users check
  const maxUsers = gift.maxUsers || 1;
  if (gift.usedBy.length >= maxUsers) {
    return res.status(400).json({ error: 'Code usage limit reached' });
  }

  user.balance += gift.amount;
  gift.usedBy.push(uid);
  if (gift.usedBy.length >= maxUsers) gift.isUsed = true;

  messages.push({
    id: Date.now(), uid,
    title: 'Gift Code Claimed',
    message: `You have received ₹${gift.amount}`,
    date: new Date().toISOString()
  });
  res.json({ message: 'Claimed', amount: gift.amount, balance: user.balance });
});

// ==================== DEPOSIT ====================
app.post('/api/user/deposit', (req, res) => {
  const { uid, amount, utr, method } = req.body;
  const user = users.find(u => u.uid === uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const amt = Number(amount);
  if (!amt || amt < 100) return res.status(400).json({ error: 'Min deposit ₹100' });

  if (user.isDemo) {
    user.balance += amt;
    user.totalDeposit += amt;
    const dep = {
      id: 'DEP' + Date.now(), uid, amount: amt,
      utr: utr || 'DEMO', method: 'DEMO',
      status: 'APPROVED', date: new Date().toISOString()
    };
    deposits.push(dep);
    messages.push({
      id: Date.now() + 1, uid,
      title: 'Demo Deposit Approved',
      message: `₹${amt} added instantly (demo account)`,
      date: new Date().toISOString()
    });
    return res.json({ message: 'Demo deposit approved instantly', deposit: dep, balance: user.balance, instant: true });
  }

  const dep = {
    id: 'DEP' + Date.now(), uid, amount: amt,
    utr: utr || '', method: method || 'UPI',
    status: 'PENDING', date: new Date().toISOString()
  };
  deposits.push(dep);
  messages.push({
    id: Date.now() + 1, uid,
    title: 'Deposit Submitted',
    message: `Your deposit of ₹${amt} is pending approval`,
    date: new Date().toISOString()
  });
  res.json({ message: 'Deposit submitted, awaiting approval', deposit: dep });
});

app.get('/api/user/deposit-history/:uid', (req, res) => {
  res.json(deposits
    .filter(d => d.uid === req.params.uid)
    .sort((a, b) => new Date(b.date) - new Date(a.date)));
});

// ==================== WITHDRAW ====================
app.post('/api/user/withdraw', (req, res) => {
  const { uid, amount, method } = req.body;
  const user = users.find(u => u.uid === uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const amt = Number(amount);
  if (amt < 100) return res.status(400).json({ error: 'Min ₹100' });
  if (amt > 50000) return res.status(400).json({ error: 'Max ₹50,000' });
  if (user.balance < amt) return res.status(400).json({ error: 'Insufficient balance' });

  const rem = Math.max(0, user.totalDeposit - user.totalBet);
  if (!user.isDemo && user.totalDeposit > 0 && rem > 0) {
    return res.status(400).json({ error: `Please bet ₹${rem.toFixed(2)} more` });
  }

  const bankInfo = bankAccounts[uid] || null;
  const upiInfo = upiAccounts[uid] || null;
  user.balance -= amt;
  const w = {
    id: 'WD' + Date.now(), uid, amount: amt,
    method: method || 'UPI', status: 'PROCESSING',
    bankInfo, upiInfo, date: new Date().toISOString()
  };
  withdrawals.push(w);
  res.json({ message: 'Withdrawal submitted', withdrawal: w, balance: user.balance });
});

app.get('/api/user/withdraw-history/:uid', (req, res) => {
  res.json(withdrawals
    .filter(w => w.uid === req.params.uid)
    .sort((a, b) => new Date(b.date) - new Date(a.date)));
});

// ==================== UPI / BANK ====================
app.post('/api/user/upi', (req, res) => {
  const { uid, upiId, accountName, phone } = req.body;
  upiAccounts[uid] = { upiId, accountName, phone: phone || '', savedAt: new Date().toISOString() };
  res.json({ message: 'UPI saved' });
});

app.post('/api/user/bank', (req, res) => {
  const { uid, accountName, accountNumber, ifsc, bankName, phone, email } = req.body;
  bankAccounts[uid] = {
    accountName, accountNumber, ifsc,
    bankName: bankName || '',
    phone: phone || '',
    email: email || '',
    savedAt: new Date().toISOString()
  };
  res.json({ message: 'Bank saved' });
});

app.get('/api/user/upi/:uid', (req, res) => res.json(upiAccounts[req.params.uid] || null));
app.get('/api/user/bank/:uid', (req, res) => res.json(bankAccounts[req.params.uid] || null));

// ==================== AGENT ====================
app.get('/api/agent/team/:uid', (req, res) => {
  const user = users.find(u => u.uid === req.params.uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const team = users.filter(u => u.referredBy === user.refereeCode || u.referredBy === user.inviteCode);
  const totalDeposit = team.reduce((s, t) => s + (t.totalDeposit || 0), 0);
  const totalBet = team.reduce((s, t) => s + (t.totalBet || 0), 0);
  const commission = Math.round(totalDeposit * 0.10 * 100) / 100;
  res.json({
    totalInvited: team.length,
    activeCount: team.filter(u => u.totalDeposit > 0).length,
    totalEarned: commission,
    totalTeamDeposit: totalDeposit,
    totalTeamBet: totalBet,
    inviteCode: user.inviteCode,
    team: team.map(t => ({
      name: 'USER' + t.phone.slice(-4),
      uid: t.uid,
      deposit: t.totalDeposit || 0,
      bet: t.totalBet || 0,
      win: t.totalWin || 0,
      earned: Math.round((t.totalDeposit || 0) * 0.10 * 100) / 100,
      joinedAt: t.createdAt
    }))
  });
});

// ==================== ADMIN: STATS ====================
app.get('/api/admin/stats', adminAuth, (req, res) => {
  res.json({
    totalUsers: users.length,
    totalBets: bets.length,
    pendingBets: bets.filter(b => b.result === 'pending').length,
    totalDeposit: users.reduce((s, u) => s + (u.totalDeposit || 0), 0),
    totalWithdraw: withdrawals.reduce((s, w) => s + w.amount, 0),
    totalGiftCodes: giftCodes.length,
    pendingDeposits: deposits.filter(d => d.status === 'PENDING').length,
    pendingWithdraws: withdrawals.filter(w => w.status === 'PROCESSING').length,
    totalBanners: banners.length,
    totalGames: games.length,
    totalDemoAccounts: demoAccounts.length,
    totalSupportChats: Object.keys(supportChats).length,
    unreadSupport: Object.values(supportChats).reduce((s, c) => s + c.filter(m => m.sender === 'user' && !m.readByAdmin).length, 0)
  });
});

app.get('/api/admin/today-earnings', adminAuth, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const winners = users
    .filter(u => u.lastWinAt && u.lastWinAt.startsWith(today) && u.lastWinAmount > 0)
    .map(u => ({
      uid: u.uid, name: 'USER' + u.phone.slice(-4),
      phone: u.phone, amount: u.lastWinAmount, at: u.lastWinAt
    }))
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 10);
  res.json(winners);
});

// ==================== NEW: ADMIN USER DETAILS FULL DUMP ====================
app.get('/api/admin/user-details/:uid', adminAuth, (req, res) => {
  const user = users.find(u => u.uid === req.params.uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const userBets = bets.filter(b => b.uid === user.uid).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const userDeposits = deposits.filter(d => d.uid === user.uid).sort((a, b) => new Date(b.date) - new Date(a.date));
  const userWithdraws = withdrawals.filter(w => w.uid === user.uid).sort((a, b) => new Date(b.date) - new Date(a.date));
  const userMessages = messages.filter(m => m.uid === user.uid).sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({
    user,
    bets: userBets,
    deposits: userDeposits,
    withdrawals: userWithdraws,
    messages: userMessages,
    upi: upiAccounts[user.uid] || null,
    bank: bankAccounts[user.uid] || null,
    supportChat: supportChats[user.uid] || [],
    resetHistory: user.resetHistory || [],
    loginHistory: user.loginHistory || [],
    activityLog: user.activityLog || []
  });
});

// ==================== ADMIN: DEMO ACCOUNTS ====================
app.get('/api/admin/demo-accounts', adminAuth, (req, res) => {
  res.json(demoAccounts.map(d => {
    const u = users.find(x => x.uid === d.uid);
    return {
      id: d.id, phone: d.phone, password: d.password, uid: d.uid,
      balance: u ? u.balance : 0,
      totalDeposit: u ? u.totalDeposit : 0,
      totalBet: u ? u.totalBet : 0,
      createdAt: d.createdAt
    };
  }));
});

app.post('/api/admin/demo-accounts/create', adminAuth, (req, res) => {
  const { phone, password, initialBalance } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'Phone & password required' });
  if (users.find(u => u.phone === phone)) return res.status(400).json({ error: 'Phone already exists' });
  const uid = genUID();
  const balance = Number(initialBalance) || 0;
  const now = new Date().toISOString();
  const user = {
    uid, phone, password, balance,
    exp: 0, vipLevel: 0, isBanned: false,
    refereeCode: uid, inviteCode: uid,
    referredBy: null,
    totalDeposit: balance, totalBet: 0, totalWin: 0,
    registerBonus: 0, claimedMilestones: [],
    isDemo: true,
    createdAt: now,
    lastActiveAt: now,
    dp: `https://i.pravatar.cc/100?u=${uid}`,
    loginHistory: [],
    activityLog: [],
    resetHistory: []
  };
  users.push(user);
  const demo = { id: 'DEMO' + Date.now(), phone, password, uid, createdAt: now };
  demoAccounts.push(demo);
  res.json({ message: 'Demo account created', demo, user });
});

app.post('/api/admin/demo-accounts/update-balance', adminAuth, (req, res) => {
  const { id, balance } = req.body;
  const demo = demoAccounts.find(d => d.id === id);
  if (!demo) return res.status(404).json({ error: 'Demo account not found' });
  const user = users.find(u => u.uid === demo.uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.balance = Number(balance) || 0;
  res.json({ message: 'Balance updated', balance: user.balance });
});

app.post('/api/admin/demo-accounts/add-balance', adminAuth, (req, res) => {
  const { id, amount } = req.body;
  const demo = demoAccounts.find(d => d.id === id);
  if (!demo) return res.status(404).json({ error: 'Demo account not found' });
  const user = users.find(u => u.uid === demo.uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const amt = Number(amount) || 0;
  user.balance += amt;
  user.totalDeposit += amt;
  res.json({ message: 'Balance added', balance: user.balance });
});

app.post('/api/admin/demo-accounts/delete', adminAuth, (req, res) => {
  const { id } = req.body;
  const idx = demoAccounts.findIndex(d => d.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Demo account not found' });
  const demo = demoAccounts[idx];
  const uidIdx = users.findIndex(u => u.uid === demo.uid);
  if (uidIdx !== -1) users.splice(uidIdx, 1);
  demoAccounts.splice(idx, 1);
  res.json({ message: 'Demo account deleted' });
});

// ==================== ADMIN: USERS ====================
app.get('/api/admin/users', adminAuth, (req, res) => {
  res.json(users.map(u => ({
    uid: u.uid, phone: u.phone, balance: u.balance, vipLevel: u.vipLevel,
    totalDeposit: u.totalDeposit, totalBet: u.totalBet, totalWin: u.totalWin,
    isBanned: u.isBanned, inviteCode: u.inviteCode,
    isDemo: u.isDemo || false, createdAt: u.createdAt,
    lastActiveAt: u.lastActiveAt || u.createdAt,
    resetCount: (u.resetHistory || []).length,
    dp: u.dp
  })));
});

app.post('/api/admin/ban-user', adminAuth, (req, res) => {
  const { uid, banStatus } = req.body;
  const user = users.find(u => u.uid === uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.isBanned = !!banStatus;
  res.json({ message: 'Updated', isBanned: user.isBanned });
});

app.post('/api/admin/give-bonus', adminAuth, (req, res) => {
  const { uid, bonusAmount, reasonMessage } = req.body;
  const user = users.find(u => u.uid === uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.balance += Number(bonusAmount);
  messages.push({
    id: Date.now(), uid: user.uid,
    title: 'Bonus Received!',
    message: reasonMessage || `You received ₹${bonusAmount} bonus!`,
    date: new Date().toISOString()
  });
  res.json({ message: 'Done', balance: user.balance });
});

// ==================== ADMIN: WINGO ====================
app.post('/api/admin/wingo/result', adminAuth, (req, res) => {
  const { mode, number } = req.body;
  if (!WINGO_MODES[mode]) return res.status(400).json({ error: 'Invalid mode' });
  const num = Number(number);
  if (isNaN(num) || num < 0 || num > 9) return res.status(400).json({ error: 'Number must be 0-9' });
  const state = gameState[mode];
  if (!state.current) return res.status(400).json({ error: 'No active period' });
  pendingResults[mode] = num;
  res.json({ message: 'Result queued', period: state.current.period, queuedNumber: num, willApplyAt: state.current.endTime });
});

app.post('/api/admin/wingo/hack-next', adminAuth, (req, res) => {
  const { mode, number } = req.body;
  if (!WINGO_MODES[mode]) return res.status(400).json({ error: 'Invalid mode' });
  const num = Number(number);
  if (isNaN(num) || num < 0 || num > 9) return res.status(400).json({ error: 'Number must be 0-9' });
  nextResultOverride[mode] = num;
  res.json({ message: 'Next result set (hack mode)', mode, number: num });
});

app.get('/api/admin/wingo/live-bets', adminAuth, (req, res) => {
  const { mode } = req.query;
  if (!WINGO_MODES[mode]) return res.status(400).json({ error: 'Invalid mode' });
  const state = gameState[mode];
  if (!state.current) return res.json({ period: null, big: 0, small: 0, green: 0, red: 0, violet: 0, numbers: {}, total: 0, count: 0 });
  const liveBets = bets.filter(b => b.period === state.current.period && b.result === 'pending');
  const summary = { period: state.current.period, big: 0, small: 0, green: 0, red: 0, violet: 0, numbers: {}, total: 0, count: liveBets.length };
  liveBets.forEach(b => {
    summary.total += b.amount;
    const v = b.betValue;
    if (v === 'big') summary.big += b.amount;
    else if (v === 'small') summary.small += b.amount;
    else if (v === 'green') summary.green += b.amount;
    else if (v === 'red') summary.red += b.amount;
    else if (v === 'violet') summary.violet += b.amount;
    else if (v !== null && !isNaN(Number(v))) {
      if (!summary.numbers[v]) summary.numbers[v] = 0;
      summary.numbers[v] += b.amount;
    }
  });
  res.json(summary);
});

app.post('/api/admin/wingo/auto-result', adminAuth, (req, res) => {
  const { mode, strategy } = req.body;
  if (!WINGO_MODES[mode]) return res.status(400).json({ error: 'Invalid mode' });
  const state = gameState[mode];
  if (!state.current) return res.status(400).json({ error: 'No active period' });
  const liveBets = bets.filter(b => b.period === state.current.period && b.result === 'pending');
  let bigAmt = 0, smallAmt = 0;
  liveBets.forEach(b => {
    if (b.betValue === 'big') bigAmt += b.amount;
    else if (b.betValue === 'small') smallAmt += b.amount;
  });
  let result;
  if (strategy === 'big-wins') result = [5,6,7,8,9][Math.floor(Math.random()*5)];
  else if (strategy === 'small-wins') result = [0,1,2,3,4][Math.floor(Math.random()*5)];
  else if (strategy === 'big-loses') result = [0,1,2,3,4][Math.floor(Math.random()*5)];
  else if (strategy === 'small-loses') result = [5,6,7,8,9][Math.floor(Math.random()*5)];
  else if (strategy === 'highest-bet-wins') result = bigAmt >= smallAmt ? [5,6,7,8,9][Math.floor(Math.random()*5)] : [0,1,2,3,4][Math.floor(Math.random()*5)];
  else if (strategy === 'highest-bet-loses') result = bigAmt >= smallAmt ? [0,1,2,3,4][Math.floor(Math.random()*5)] : [5,6,7,8,9][Math.floor(Math.random()*5)];
  else result = Math.floor(Math.random() * 10);
  pendingResults[mode] = result;
  res.json({ message: 'Auto result queued', period: state.current.period, queuedNumber: result, strategy });
});

app.post('/api/admin/wingo/force-close', adminAuth, (req, res) => {
  const { mode } = req.body;
  if (!WINGO_MODES[mode]) return res.status(400).json({ error: 'Invalid mode' });
  const state = gameState[mode];
  if (!state.current) return res.status(400).json({ error: 'No active period' });
  const closedPeriod = state.current.period;
  closePeriod(mode);
  state.current = createNewPeriod(mode);
  res.json({ message: 'Force closed', closedPeriod, newPeriod: state.current });
});

app.get('/api/admin/game-state', adminAuth, (req, res) => {
  const out = {};
  Object.keys(WINGO_MODES).forEach(mode => {
    out[mode] = {
      current: gameState[mode].current,
      pendingResult: pendingResults[mode] !== undefined ? pendingResults[mode] : null,
      nextResultOverride: nextResultOverride[mode] !== undefined ? nextResultOverride[mode] : null,
      recentHistory: gameState[mode].history.slice(0, 10)
    };
  });
  res.json(out);
});

app.get('/api/admin/bets', adminAuth, (req, res) => {
  const { uid, status, mode } = req.query;
  let list = bets.slice();
  if (uid) list = list.filter(b => b.uid === uid);
  if (status) list = list.filter(b => b.result === status);
  if (mode) list = list.filter(b => b.betType === mode);
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(list.slice(0, 200));
});

// ==================== ADMIN: DEPOSITS ====================
app.get('/api/admin/deposits', adminAuth, (req, res) => {
  res.json(deposits.slice().sort((a, b) => new Date(b.date) - new Date(a.date)));
});

app.post('/api/admin/deposit/approve', adminAuth, (req, res) => {
  const { id } = req.body;
  const d = deposits.find(x => x.id === id);
  if (!d) return res.status(404).json({ error: 'Not found' });
  if (d.status === 'APPROVED') return res.status(400).json({ error: 'Already approved' });
  d.status = 'APPROVED';
  const user = users.find(u => u.uid === d.uid);
  if (user) {
    user.balance += d.amount;
    user.totalDeposit += d.amount;
    messages.push({
      id: Date.now(), uid: user.uid,
      title: 'Deposit Approved',
      message: `₹${d.amount} added to your account`,
      date: new Date().toISOString()
    });
  }
  res.json({ message: 'Approved' });
});

app.post('/api/admin/deposit/reject', adminAuth, (req, res) => {
  const { id, reason } = req.body;
  const d = deposits.find(x => x.id === id);
  if (!d) return res.status(404).json({ error: 'Not found' });
  d.status = 'REJECTED';
  d.rejectReason = reason || '';
  const user = users.find(u => u.uid === d.uid);
  if (user) messages.push({
    id: Date.now(), uid: user.uid,
    title: 'Deposit Rejected',
    message: reason || `Your deposit of ₹${d.amount} was rejected`,
    date: new Date().toISOString()
  });
  res.json({ message: 'Rejected' });
});

// ==================== ADMIN: WITHDRAWALS ====================
app.get('/api/admin/withdrawals', adminAuth, (req, res) => {
  res.json(withdrawals.slice().sort((a, b) => new Date(b.date) - new Date(a.date)));
});

app.post('/api/admin/withdrawal/approve', adminAuth, (req, res) => {
  const { id } = req.body;
  const w = withdrawals.find(x => x.id === id);
  if (!w) return res.status(404).json({ error: 'Not found' });
  if (w.status === 'SUCCESS') return res.status(400).json({ error: 'Already approved' });
  w.status = 'SUCCESS';
  const user = users.find(u => u.uid === w.uid);
  if (user) messages.push({
    id: Date.now(), uid: user.uid,
    title: 'Withdrawal Approved',
    message: `₹${w.amount} has been sent`,
    date: new Date().toISOString()
  });
  res.json({ message: 'Approved' });
});

app.post('/api/admin/withdrawal/reject', adminAuth, (req, res) => {
  const { id } = req.body;
  const w = withdrawals.find(x => x.id === id);
  if (!w) return res.status(404).json({ error: 'Not found' });
  if (w.status === 'SUCCESS') return res.status(400).json({ error: 'Already approved' });
  w.status = 'REJECTED';
  const user = users.find(u => u.uid === w.uid);
  if (user) user.balance += w.amount;
  res.json({ message: 'Rejected and refunded' });
});

// ==================== ADMIN: GIFT CODES (UPDATED) ====================
app.get('/api/admin/giftcodes', adminAuth, (req, res) => {
  res.json(giftCodes.slice().reverse());
});

app.post('/api/admin/create-giftcode', adminAuth, (req, res) => {
  const { code, amount, maxUsers, activeDuration } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });
  if (giftCodes.find(g => g.code === code.toUpperCase())) return res.status(400).json({ error: 'Code exists' });

  const maxU = Number(maxUsers) || 1;
  const durMin = Number(activeDuration) || 0; // minutes, 0 = unlimited
  const expiresAt = durMin > 0 ? new Date(Date.now() + durMin * 60 * 1000).toISOString() : null;

  const gift = {
    code: code.toUpperCase(),
    amount: Number(amount) || 0,
    maxUsers: maxU,
    activeDuration: durMin,
    expiresAt: expiresAt,
    usedBy: [],
    isUsed: false,
    createdAt: new Date().toISOString()
  };
  giftCodes.push(gift);
  res.json({ message: 'Created', gift });
});

app.post('/api/admin/delete-giftcode', adminAuth, (req, res) => {
  const { code } = req.body;
  const idx = giftCodes.findIndex(g => g.code === (code || '').toUpperCase());
  if (idx === -1) return res.status(404).json({ error: 'Code not found' });
  giftCodes.splice(idx, 1);
  res.json({ message: 'Deleted' });
});

// ==================== ADMIN: BROADCAST ====================
app.post('/api/admin/broadcast', adminAuth, (req, res) => {
  const { title, message } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'Title & message required' });
  users.forEach(u => {
    messages.push({ id: Date.now() + Math.random(), uid: u.uid, title, message, date: new Date().toISOString() });
  });
  res.json({ message: `Sent to ${users.length} users` });
});

// ==================== ADMIN: BANNERS ====================
app.get('/api/admin/banners', adminAuth, (req, res) => res.json(banners));

app.post('/api/admin/banner/add', adminAuth, (req, res) => {
  const { imageUrl, link, isPopup, title } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'Image URL required' });
  const b = {
    id: 'BN' + Date.now(), imageUrl, link: link || '',
    isPopup: !!isPopup, title: title || '',
    active: true, createdAt: new Date().toISOString()
  };
  banners.push(b);
  res.json({ message: 'Banner added', banner: b });
});

app.post('/api/admin/banner/update', adminAuth, (req, res) => {
  const { id, imageUrl, link, isPopup, title, active } = req.body;
  const b = banners.find(x => x.id === id);
  if (!b) return res.status(404).json({ error: 'Banner not found' });
  if (imageUrl !== undefined) b.imageUrl = imageUrl;
  if (link !== undefined) b.link = link;
  if (isPopup !== undefined) b.isPopup = !!isPopup;
  if (title !== undefined) b.title = title;
  if (active !== undefined) b.active = !!active;
  res.json({ message: 'Banner updated', banner: b });
});

app.post('/api/admin/banner/delete', adminAuth, (req, res) => {
  const { id } = req.body;
  const idx = banners.findIndex(x => x.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Banner not found' });
  banners.splice(idx, 1);
  res.json({ message: 'Banner deleted' });
});

// ==================== ADMIN: GAMES ====================
app.get('/api/admin/games', adminAuth, (req, res) => res.json(games));

app.post('/api/admin/game/add', adminAuth, (req, res) => {
  const { name, logo, sub, category, position, gameKey } = req.body;
  if (!name || !logo) return res.status(400).json({ error: 'Name & logo required' });
  const g = {
    id: 'G' + Date.now(), name, logo,
    sub: sub || '',
    category: category === 'popular' ? 'popular' : 'regular',
    position: Number(position) || 1,
    gameKey: gameKey || name,
    active: true, createdAt: new Date().toISOString()
  };
  games.push(g);
  res.json({ message: 'Game added', game: g });
});

app.post('/api/admin/game/update', adminAuth, (req, res) => {
  const { id, name, logo, sub, category, position, gameKey, active } = req.body;
  const g = games.find(x => x.id === id);
  if (!g) return res.status(404).json({ error: 'Game not found' });
  if (name !== undefined) g.name = name;
  if (logo !== undefined) g.logo = logo;
  if (sub !== undefined) g.sub = sub;
  if (category !== undefined) g.category = category === 'popular' ? 'popular' : 'regular';
  if (position !== undefined) g.position = Number(position);
  if (gameKey !== undefined) g.gameKey = gameKey;
  if (active !== undefined) g.active = !!active;
  res.json({ message: 'Game updated', game: g });
});

app.post('/api/admin/game/delete', adminAuth, (req, res) => {
  const { id } = req.body;
  const idx = games.findIndex(x => x.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Game not found' });
  games.splice(idx, 1);
  res.json({ message: 'Game deleted' });
});

// ==================== ADMIN: PAGES ====================
app.get('/api/admin/pages', adminAuth, (req, res) => res.json(pagesConfig));

app.post('/api/admin/pages/update', adminAuth, (req, res) => {
  const { home, deposit, promotion, telegram, gift } = req.body;
  if (home) pagesConfig.home = { ...pagesConfig.home, ...home };
  if (deposit) pagesConfig.deposit = { ...pagesConfig.deposit, ...deposit };
  if (promotion) pagesConfig.promotion = { ...pagesConfig.promotion, ...promotion };
  if (telegram) pagesConfig.telegram = { ...pagesConfig.telegram, ...telegram };
  if (gift) pagesConfig.gift = { ...pagesConfig.gift, ...gift };
  res.json({ message: 'Pages updated', pages: pagesConfig });
});

// ==================== HACK API (external apps) ====================
app.get('/api/hack/next-result', (req, res) => {
  const mode = req.query.mode || 'wingo30';
  const key = req.query.key || '';
  if (key !== HACK_KEY) return res.status(401).json({ error: 'Invalid key' });
  if (!WINGO_MODES[mode]) return res.status(400).json({ error: 'Invalid mode' });
  const state = gameState[mode];
  const predicted = nextResultOverride[mode] !== undefined
    ? nextResultOverride[mode]
    : (pendingResults[mode] !== undefined ? pendingResults[mode] : null);
  res.json({
    mode,
    currentPeriod: state.current ? state.current.period : null,
    periodEndsAt: state.current ? state.current.endTime : null,
    secondsRemaining: state.current ? Math.max(0, Math.floor((new Date(state.current.endTime).getTime() - Date.now()) / 1000)) : 0,
    nextResult: predicted,
    hasOverride: nextResultOverride[mode] !== undefined,
    hasQueued: pendingResults[mode] !== undefined,
    allModes: {
      wingo30: nextResultOverride['wingo30'] !== undefined ? nextResultOverride['wingo30'] : (pendingResults['wingo30'] !== undefined ? pendingResults['wingo30'] : null),
      wingo1: nextResultOverride['wingo1'] !== undefined ? nextResultOverride['wingo1'] : (pendingResults['wingo1'] !== undefined ? pendingResults['wingo1'] : null),
      wingo3: nextResultOverride['wingo3'] !== undefined ? nextResultOverride['wingo3'] : (pendingResults['wingo3'] !== undefined ? pendingResults['wingo3'] : null),
      wingo5: nextResultOverride['wingo5'] !== undefined ? nextResultOverride['wingo5'] : (pendingResults['wingo5'] !== undefined ? pendingResults['wingo5'] : null),
      wingo10: nextResultOverride['wingo10'] !== undefined ? nextResultOverride['wingo10'] : (pendingResults['wingo10'] !== undefined ? pendingResults['wingo10'] : null)
    }
  });
});

app.post('/api/hack/set-next', (req, res) => {
  const { mode, number, key } = req.body;
  if (key !== HACK_KEY) return res.status(401).json({ error: 'Invalid key' });
  if (!WINGO_MODES[mode]) return res.status(400).json({ error: 'Invalid mode' });
  const num = Number(number);
  if (isNaN(num) || num < 0 || num > 9) return res.status(400).json({ error: 'Number must be 0-9' });
  nextResultOverride[mode] = num;
  res.json({ message: 'Next result set', mode, number: num });
});

app.get('/api/hack/all-modes', (req, res) => {
  const key = req.query.key || '';
  if (key !== HACK_KEY) return res.status(401).json({ error: 'Invalid key' });
  const out = {};
  Object.keys(WINGO_MODES).forEach(mode => {
    const state = gameState[mode];
    out[mode] = {
      currentPeriod: state.current ? state.current.period : null,
      periodEndsAt: state.current ? state.current.endTime : null,
      secondsRemaining: state.current ? Math.max(0, Math.floor((new Date(state.current.endTime).getTime() - Date.now()) / 1000)) : 0,
      nextResult: nextResultOverride[mode] !== undefined ? nextResultOverride[mode] : (pendingResults[mode] !== undefined ? pendingResults[mode] : null)
    };
  });
  res.json(out);
});

// ==================== HEALTH ====================
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'DARKWIN API running',
    modes: Object.keys(WINGO_MODES),
    adminEnabled: true,
    hackEnabled: true,
    demoAccountsEnabled: true,
    supportChatEnabled: true,
    resultImagesEnabled: true,
    accountIconsEnabled: true,
    idResetEnabled: true,
    totalUsers: users.length,
    totalBets: bets.length,
    totalBanners: banners.length,
    totalGames: games.length,
    totalSupportChats: Object.keys(supportChats).length
  });
});

// ==================== START ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ DARKWIN API running on port ${PORT}`);
  console.log(`🔑 Admin password: ${ADMIN_PASSWORD}`);
  console.log(`🎯 Hack key: ${HACK_KEY}`);
  console.log(`📊 Modes: ${Object.keys(WINGO_MODES).join(', ')}`);
});
