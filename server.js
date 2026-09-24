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

// ✅ Games config (admin se control hoga)
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
let adminTokens = new Set();

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
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

// ==================== VIP ====================
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

const MILESTONES = [
  { id: 'm1', deposit: 100, reward: '₹10 Bonus', icon: '🎁', bonus: 10 },
  { id: 'm2', deposit: 500, reward: '₹30 Bonus', icon: '🎁', bonus: 30 },
  { id: 'm3', deposit: 1000, reward: '₹75 Bonus', icon: '🎁', bonus: 75 },
  { id: 'm4', deposit: 5000, reward: '₹400 Bonus', icon: '🎁', bonus: 400 },
  { id: 'm5', deposit: 10000, reward: '₹1000 Bonus', icon: '🎁', bonus: 1000 },
  { id: 'm6', deposit: 50000, reward: '₹5000 Bonus', icon: '🎁', bonus: 5000 }
];

let pagesConfig = {
  home: {
    marqueeText: '🎉 Welcome to DARKWIN! Win big with WinGo 30s, 1m, 3m. Instant withdrawals! 🎉',
    logoUrl: 'https://i.ibb.co/pvMbkdBb/images-3.jpg',
    siteName: 'DARKWIN'
  },
  deposit: {
    upiNumber: '7478478039',
    qrCodeUrl: 'https://i.ibb.co/kVBLF7G6/Screenshot-20260918-145024.png'
  },
  promotion: {
    rules: 'Invite friends and earn up to 10%\nDaily bonus for active players\nWeekly and monthly VIP rewards\nWithdraw anytime after meeting bet requirement'
  },
  telegram: { link: 'https://t.me/+aSkhYV8PvOBmZWM9', label: 'Production Channel' }
};

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
    period: makePeriodNumber(), mode,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(startTime + dur).toISOString(),
    status: 'OPEN', number: null, result: null
  };
}

function closePeriod(mode, forcedNumber = null) {
  const state = gameState[mode];
  if (!state.current) return null;
  const p = state.current;
  if (forcedNumber !== null && forcedNumber !== undefined) p.number = Number(forcedNumber);
  else if (p.number === null) p.number = Math.floor(Math.random() * 10);
  p.result = p.number;
  p.status = 'CLOSED';
  p.closedAt = new Date().toISOString();
  state.history.unshift({ ...p });
  if (state.history.length > 200) state.history = state.history.slice(0, 200);
  settleBetsForPeriod(p.period, p.number);
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
  const colors = winNumber === 0 ? ['violet', 'red'] : winNumber === 5 ? ['violet', 'green'] : [1, 3, 7, 9].includes(winNumber) ? ['green'] : ['red'];
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
    if (win) { user.balance += bet.payout; user.totalWin += bet.payout; }
  });
}

Object.keys(WINGO_MODES).forEach(mode => {
  const state = gameState[mode];
  for (let i = 0; i < 20; i++) {
    state.history.push({
      id: 'SEED_' + mode + '_' + i,
      period: String(periodSeq - i - 1), mode,
      number: Math.floor(Math.random() * 10),
      result: Math.floor(Math.random() * 10),
      status: 'CLOSED',
      closedAt: new Date().toISOString()
    });
  }
  state.current = createNewPeriod(mode);
});

setInterval(() => { Object.keys(WINGO_MODES).forEach(mode => tickMode(mode)); }, 1000);

// ==================== AUTH ====================
app.post('/api/auth/register', (req, res) => {
  const { phone, password, referralCode } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'Phone & password required' });
  if (users.find(u => u.phone === phone)) return res.status(400).json({ error: 'Phone already registered' });
  const uid = 'UID' + Math.floor(100000 + Math.random() * 900000);
  const user = {
    uid, phone, password, balance: 0, exp: 0, vipLevel: 0, isBanned: false,
    refereeCode: uid, referredBy: referralCode || null, inviteCode: uid.slice(-6),
    totalDeposit: 0, totalBet: 0, totalWin: 0, claimedMilestones: [],
    createdAt: new Date().toISOString()
  };
  users.push(user);
  res.json({ message: 'Registration successful', user });
});

app.post('/api/auth/login', (req, res) => {
  const { phone, password } = req.body;
  const user = users.find(u => u.phone === phone && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.isBanned) return res.status(403).json({ error: 'Account banned' });
  res.json({ message: 'Login successful', user });
});

// ==================== USER ====================
app.get('/api/user/balance/:uid', (req, res) => {
  const user = users.find(u => u.uid === req.params.uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    balance: user.balance, vipLevel: user.vipLevel, exp: user.exp,
    totalDeposit: user.totalDeposit, totalBet: user.totalBet, totalWin: user.totalWin
  });
});

app.get('/api/user/profile/:uid', (req, res) => {
  const user = users.find(u => u.uid === req.params.uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ==================== BANNERS (public) ====================
app.get('/api/banners', (req, res) => res.json(banners.filter(b => b.active !== false)));
app.get('/api/banners/popup', (req, res) => {
  const popup = banners.filter(b => b.isPopup && b.active !== false);
  res.json(popup);
});

// ==================== PAGES / GAMES (public) ====================
app.get('/api/pages', (req, res) => res.json(pagesConfig));
app.get('/api/games', (req, res) => res.json(games.filter(g => g.active !== false)));

// ==================== WINGO ====================
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
  user.balance -= amount; user.totalBet += amount; user.exp += amount;
  VIP_CONFIG.forEach(v => { if (user.exp >= v.expNeeded && user.vipLevel < v.level) user.vipLevel = v.level; });
  const bet = {
    id: 'BET' + Date.now() + Math.floor(Math.random() * 10000),
    uid, amount, betType: mode, betValue, selection,
    period: state.current.period, mode,
    result: 'pending', payout: 0, winNumber: null,
    createdAt: new Date().toISOString()
  };
  bets.push(bet);
  res.json({ message: 'Bet placed', betId: bet.id, bet, balance: user.balance });
});

app.get('/api/game/wingo/history/:uid', (req, res) => {
  const userBets = bets.filter(b => b.uid === req.params.uid).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100);
  res.json(userBets);
});

app.get('/api/user/bets/:uid', (req, res) => res.json(bets.filter(b => b.uid === req.params.uid)));
app.get('/api/user/bets/:uid/active', (req, res) => {
  res.json(bets.filter(b => b.uid === req.params.uid && b.result === 'pending'));
});

// ==================== VIP ====================
app.get('/api/vip/status/:uid', (req, res) => {
  const user = users.find(u => u.uid === req.params.uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ uid: user.uid, exp: user.exp, vipLevel: user.vipLevel, vipConfig: VIP_CONFIG, history: [] });
});

// ==================== MILESTONES ====================
app.get('/api/milestones/:uid', (req, res) => {
  const user = users.find(u => u.uid === req.params.uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const claimed = user.claimedMilestones || [];
  res.json({
    totalDeposit: user.totalDeposit,
    milestones: MILESTONES.map(m => ({ ...m, unlocked: user.totalDeposit >= m.deposit, claimed: claimed.includes(m.id) }))
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
  res.json(messages.filter(m => m.uid === req.params.uid).sort((a, b) => new Date(b.date) - new Date(a.date)));
});

// ==================== GIFT CODES ====================
app.post('/api/user/claim-giftcode', (req, res) => {
  const { uid, code } = req.body;
  const user = users.find(u => u.uid === uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const gift = giftCodes.find(g => g.code === (code || '').toUpperCase());
  if (!gift) return res.status(400).json({ error: 'Invalid code' });
  if (gift.isUsed) return res.status(400).json({ error: 'Code already used' });
  user.balance += gift.amount; gift.isUsed = true; gift.usedBy = uid;
  messages.push({ id: Date.now(), uid, title: 'Gift Code Claimed', message: `You have received ₹${gift.amount}`, date: new Date().toISOString() });
  res.json({ message: 'Claimed', amount: gift.amount, balance: user.balance });
});

// ==================== DEPOSITS ====================
app.post('/api/user/deposit', (req, res) => {
  const { uid, amount, utr, method } = req.body;
  const user = users.find(u => u.uid === uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const amt = Number(amount);
  if (!amt || amt < 100) return res.status(400).json({ error: 'Min deposit ₹100' });
  const dep = { id: 'DEP' + Date.now(), uid, amount: amt, utr: utr || '', method: method || 'UPI', status: 'APPROVED', date: new Date().toISOString() };
  deposits.push(dep); user.balance += amt; user.totalDeposit += amt;
  messages.push({ id: Date.now() + 1, uid, title: 'Deposit Successful', message: `₹${amt} has been added`, date: new Date().toISOString() });
  res.json({ message: 'Deposit successful', deposit: dep, balance: user.balance });
});

app.get('/api/user/deposit-history/:uid', (req, res) => {
  res.json(deposits.filter(d => d.uid === req.params.uid).sort((a, b) => new Date(b.date) - new Date(a.date)));
});

// ==================== WITHDRAWALS ====================
app.post('/api/user/withdraw', (req, res) => {
  const { uid, amount, method } = req.body;
  const user = users.find(u => u.uid === uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const amt = Number(amount);
  if (amt < 100) return res.status(400).json({ error: 'Min ₹100' });
  if (amt > 50000) return res.status(400).json({ error: 'Max ₹50,000' });
  if (user.balance < amt) return res.status(400).json({ error: 'Insufficient balance' });
  const rem = Math.max(0, user.totalDeposit - user.totalBet);
  if (user.totalDeposit > 0 && rem > 0) return res.status(400).json({ error: `Please bet ₹${rem.toFixed(2)} more` });
  user.balance -= amt;
  const w = { id: 'WD' + Date.now(), uid, amount: amt, method: method || 'UPI', status: 'PROCESSING', date: new Date().toISOString() };
  withdrawals.push(w);
  res.json({ message: 'Withdrawal submitted', withdrawal: w, balance: user.balance });
});

app.get('/api/user/withdraw-history/:uid', (req, res) => {
  res.json(withdrawals.filter(w => w.uid === req.params.uid).sort((a, b) => new Date(b.date) - new Date(a.date)));
});

// ==================== UPI / BANK ====================
app.post('/api/user/upi', (req, res) => {
  const { uid, upiId, accountName } = req.body;
  upiAccounts[uid] = { upiId, accountName, savedAt: new Date().toISOString() };
  res.json({ message: 'UPI saved' });
});
app.post('/api/user/bank', (req, res) => {
  const { uid, accountName, accountNumber, ifsc } = req.body;
  bankAccounts[uid] = { accountName, accountNumber, ifsc, savedAt: new Date().toISOString() };
  res.json({ message: 'Bank saved' });
});

// ==================== AGENT ====================
app.get('/api/agent/team/:uid', (req, res) => {
  const user = users.find(u => u.uid === req.params.uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const team = users.filter(u => u.referredBy === user.refereeCode);
  res.json({
    totalInvited: team.length,
    activeCount: team.filter(u => u.totalDeposit > 0).length,
    totalEarned: 0,
    team: team.map(t => ({ name: 'USER' + t.phone.slice(-4), earned: 0, joinedAt: t.createdAt }))
  });
});

// ==================== ADMIN APIs ====================
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
    totalGames: games.length
  });
});

app.get('/api/admin/users', adminAuth, (req, res) => {
  res.json(users.map(u => ({
    uid: u.uid, phone: u.phone, balance: u.balance, vipLevel: u.vipLevel,
    totalDeposit: u.totalDeposit, totalBet: u.totalBet, totalWin: u.totalWin,
    isBanned: u.isBanned, createdAt: u.createdAt
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

// Wingo Result
app.post('/api/admin/wingo/result', adminAuth, (req, res) => {
  const { mode, number } = req.body;
  if (!WINGO_MODES[mode]) return res.status(400).json({ error: 'Invalid mode' });
  const num = Number(number);
  if (isNaN(num) || num < 0 || num > 9) return res.status(400).json({ error: 'Number must be 0-9' });
  const state = gameState[mode];
  if (!state.current) return res.status(400).json({ error: 'No active period' });
  const closedPeriod = state.current.period;
  closePeriod(mode, num);
  state.current = createNewPeriod(mode);
  res.json({ message: 'Result set successfully', closedPeriod, winningNumber: num, newPeriod: state.current });
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
    out[mode] = { current: gameState[mode].current, recentHistory: gameState[mode].history.slice(0, 10) };
  });
  res.json(out);
});

// Bets
app.get('/api/admin/bets', adminAuth, (req, res) => {
  const { uid, status, mode } = req.query;
  let list = bets.slice();
  if (uid) list = list.filter(b => b.uid === uid);
  if (status) list = list.filter(b => b.result === status);
  if (mode) list = list.filter(b => b.betType === mode);
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(list.slice(0, 200));
});

// Deposits
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
    user.balance += d.amount; user.totalDeposit += d.amount;
    messages.push({ id: Date.now(), uid: user.uid, title: 'Deposit Approved', message: `₹${d.amount} added to your account`, date: new Date().toISOString() });
  }
  res.json({ message: 'Approved' });
});
app.post('/api/admin/deposit/reject', adminAuth, (req, res) => {
  const { id } = req.body;
  const d = deposits.find(x => x.id === id);
  if (!d) return res.status(404).json({ error: 'Not found' });
  d.status = 'REJECTED';
  res.json({ message: 'Rejected' });
});

// Withdrawals
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
  if (user) messages.push({ id: Date.now(), uid: user.uid, title: 'Withdrawal Approved', message: `₹${w.amount} has been sent`, date: new Date().toISOString() });
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

// Gift Codes
app.get('/api/admin/giftcodes', adminAuth, (req, res) => { res.json(giftCodes.slice().reverse()); });
app.post('/api/admin/create-giftcode', adminAuth, (req, res) => {
  const { code, amount } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });
  if (giftCodes.find(g => g.code === code.toUpperCase())) return res.status(400).json({ error: 'Code exists' });
  giftCodes.push({ code: code.toUpperCase(), amount: Number(amount), isUsed: false, usedBy: null, createdAt: new Date().toISOString() });
  res.json({ message: 'Created' });
});

// Broadcast
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
    id: 'BN' + Date.now(),
    imageUrl, link: link || '',
    isPopup: !!isPopup,
    title: title || '',
    active: true,
    createdAt: new Date().toISOString()
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
    id: 'G' + Date.now(),
    name, logo,
    sub: sub || '',
    category: category === 'popular' ? 'popular' : 'regular',
    position: Number(position) || (games.filter(x => x.category === category).length + 1),
    gameKey: gameKey || name,
    active: true,
    createdAt: new Date().toISOString()
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
  const { home, deposit, promotion, telegram } = req.body;
  if (home) pagesConfig.home = { ...pagesConfig.home, ...home };
  if (deposit) pagesConfig.deposit = { ...pagesConfig.deposit, ...deposit };
  if (promotion) pagesConfig.promotion = { ...pagesConfig.promotion, ...promotion };
  if (telegram) pagesConfig.telegram = { ...pagesConfig.telegram, ...telegram };
  res.json({ message: 'Pages updated', pages: pagesConfig });
});

// ==================== HEALTH ====================
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'DARKWIN API running', modes: Object.keys(WINGO_MODES) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ DARKWIN API running on port ${PORT}`);
  console.log(`🔑 Admin password: ${ADMIN_PASSWORD}`);
});
