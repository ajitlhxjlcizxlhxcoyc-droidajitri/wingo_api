const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ==================== IN-MEMORY DATABASE ====================
let users = [];
let banners = [];
let messages = [];
let deposits = [];
let withdrawals = [];
let giftCodes = [];
let bets = [];
let upiAccounts = {};
let bankAccounts = {};

// ==================== WINGO CONFIG ====================
const WINGO_MODES = {
  wingo30: 30,    // 30 seconds
  wingo1: 60,     // 1 minute
  wingo3: 180,    // 3 minutes
  wingo5: 300,    // 5 minutes
  wingo10: 600    // 10 minutes
};

// Each mode has { current, history[] }
const gameState = {};
Object.keys(WINGO_MODES).forEach(mode => {
  gameState[mode] = { current: null, history: [] };
});

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

const MILESTONES = [
  { id: 'm1', deposit: 100, reward: '₹10 Bonus', icon: '🎁', bonus: 10 },
  { id: 'm2', deposit: 500, reward: '₹30 Bonus', icon: '🎁', bonus: 30 },
  { id: 'm3', deposit: 1000, reward: '₹75 Bonus', icon: '🎁', bonus: 75 },
  { id: 'm4', deposit: 5000, reward: '₹400 Bonus', icon: '🎁', bonus: 400 },
  { id: 'm5', deposit: 10000, reward: '₹1000 Bonus', icon: '🎁', bonus: 1000 },
  { id: 'm6', deposit: 50000, reward: '₹5000 Bonus', icon: '🎁', bonus: 5000 }
];

let pagesConfig = {
  home: { marqueeText: '🎉 Welcome to DARKWIN! Win big with WinGo 30s, 1m, 3m. Instant withdrawals! 🎉' },
  deposit: { upiNumber: '7478478039', qrCodeUrl: 'https://i.ibb.co/kVBLF7G6/Screenshot-20260918-145024.png' },
  promotion: { rules: 'Invite friends and earn up to 10%\nDaily bonus for active players\nWeekly and monthly VIP rewards\nWithdraw anytime after meeting bet requirement' }
};

// ==================== WINGO PERIOD ENGINE ====================

// ✅ Unique period number: YYMMDD + windowIndex
function genPeriodNumber(mode, windowIndex) {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}${windowIndex}`;
}

// ✅ Seed initial history so frontend has data immediately
function seedHistory(mode, count = 20) {
  const state = gameState[mode];
  const dur = WINGO_MODES[mode] * 1000;
  const currentWindow = Math.floor(Date.now() / dur);
  // Push most-recent-first order (i=1 → window-1, i=2 → window-2 ...)
  for (let i = 1; i <= count; i++) {
    const windowIdx = currentWindow - i;
    const periodNum = genPeriodNumber(mode, windowIdx);
    const number = Math.floor(Math.random() * 10);
    state.history.push({
      id: 'SEED_' + mode + '_' + i,
      period: periodNum,
      mode,
      number,
      result: number,
      status: 'CLOSED',
      closedAt: new Date(windowIdx * dur + dur).toISOString()
    });
  }
}

// ✅ Core tick: called every 1 second
function tickMode(mode) {
  const dur = WINGO_MODES[mode] * 1000;
  const now = Date.now();
  const windowIdx = Math.floor(now / dur);
  const periodNum = genPeriodNumber(mode, windowIdx);
  const state = gameState[mode];

  if (state.current && state.current.period !== periodNum) {
    // 🔒 CLOSE old period
    if (state.current.number === null) {
      state.current.number = Math.floor(Math.random() * 10);
    }
    state.current.result = state.current.number;
    state.current.status = 'CLOSED';
    state.current.closedAt = new Date().toISOString();
    state.history.unshift({ ...state.current });
    if (state.history.length > 200) state.history = state.history.slice(0, 200);

    // ✅ Settle bets for this period
    settleBetsForPeriod(state.current.period, state.current.number);

    // 🆕 OPEN new period
    const startTime = windowIdx * dur;
    state.current = {
      id: 'P' + Date.now() + Math.random(),
      period: periodNum,
      mode,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(startTime + dur).toISOString(),
      status: 'OPEN',
      number: null,
      result: null
    };
  } else if (!state.current) {
    // First time
    const startTime = windowIdx * dur;
    state.current = {
      id: 'P' + Date.now() + Math.random(),
      period: periodNum,
      mode,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(startTime + dur).toISOString(),
      status: 'OPEN',
      number: null,
      result: null
    };
  }
}

// ✅ Settle all pending bets for a period
function settleBetsForPeriod(periodNum, winNumber) {
  const pending = bets.filter(b => b.period === periodNum && b.result === 'pending');
  console.log(`[SETTLE] ${periodNum} → ${winNumber} | ${pending.length} bets`);

  // Colors for the winning number
  const colors = winNumber === 0 ? ['violet', 'red']
    : winNumber === 5 ? ['violet', 'green']
    : [1, 3, 7, 9].includes(winNumber) ? ['green']
    : ['red'];

  pending.forEach(bet => {
    const user = users.find(u => u.uid === bet.uid);
    if (!user) return;

    let win = false;
    let payout = 0;
    const v = bet.betValue;

    // 🎨 COLOR bet
    if (v === 'green' || v === 'red' || v === 'violet') {
      if (colors.includes(v)) {
        win = true;
        payout = bet.amount * (v === 'violet' ? 4.5 : 2);
      }
    }
    // 🔢 NUMBER bet
    else if (typeof v === 'number' || (!isNaN(Number(v)) && v !== null && v !== 'big' && v !== 'small')) {
      if (Number(v) === winNumber) {
        win = true;
        payout = bet.amount * 9;
      }
    }
    // 🔵 BIG bet
    else if (v === 'big') {
      if (winNumber >= 5) { win = true; payout = bet.amount * 2; }
    }
    // 🔴 SMALL bet
    else if (v === 'small') {
      if (winNumber <= 4) { win = true; payout = bet.amount * 2; }
    }

    bet.result = win ? 'win' : 'lose';
    bet.payout = Math.round(payout * 100) / 100;
    bet.winNumber = winNumber;
    bet.settledAt = new Date().toISOString();

    if (win) {
      user.balance += bet.payout;
      user.totalWin += bet.payout;
    }
  });
}

// ✅ Seed all modes at startup
Object.keys(WINGO_MODES).forEach(mode => {
  seedHistory(mode, 20);
  tickMode(mode);
});

// ✅ Background tick every 1 second
setInterval(() => {
  Object.keys(WINGO_MODES).forEach(mode => tickMode(mode));
}, 1000);

// ==================== AUTH ====================
app.post('/api/auth/register', (req, res) => {
  const { phone, password, referralCode } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'Phone & password required' });
  if (users.find(u => u.phone === phone)) return res.status(400).json({ error: 'Phone already registered' });

  const uid = 'UID' + Math.floor(100000 + Math.random() * 900000);
  const user = {
    uid, phone, password,
    balance: 0, exp: 0, vipLevel: 0,
    isBanned: false,
    refereeCode: uid,
    referredBy: referralCode || null,
    inviteCode: uid.slice(-6),
    totalDeposit: 0,
    totalBet: 0,
    totalWin: 0,
    claimedMilestones: [],
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
    balance: user.balance,
    vipLevel: user.vipLevel,
    exp: user.exp,
    totalDeposit: user.totalDeposit,
    totalBet: user.totalBet,
    totalWin: user.totalWin
  });
});

app.get('/api/user/profile/:uid', (req, res) => {
  const user = users.find(u => u.uid === req.params.uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ==================== BANNERS / PAGES ====================
app.get('/api/banners', (req, res) => res.json(banners));
app.get('/api/banners/popup', (req, res) => {
  const popup = banners.filter(b => b.isPopup);
  res.json(popup.length ? popup : banners.slice(0, 1));
});
app.post('/api/banner/add', (req, res) => {
  const b = { id: Date.now(), ...req.body };
  banners.push(b);
  res.json({ message: 'Banner added', banner: b });
});
app.get('/api/pages', (req, res) => res.json(pagesConfig));

// ==================== WINGO: PERIODS ====================
// ✅ Returns last 10 UNIQUE closed periods + current period info
app.get('/api/game/wingo/periods', (req, res) => {
  const mode = req.query.mode || 'wingo30';
  const state = gameState[mode];
  if (!state) return res.json([]);

  // Ensure we have fresh data
  tickMode(mode);

  const history = state.history.slice(0, 10).map(h => ({
    period: h.period,
    number: h.number,
    result: h.result,
    status: 'CLOSED'
  }));

  res.json(history);
});

// ✅ Current period info
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

// ==================== WINGO: BET ====================
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

  // Check if period is closing soon
  const endMs = new Date(state.current.endTime).getTime();
  const remainSec = Math.floor((endMs - Date.now()) / 1000);
  if (remainSec < 5) {
    return res.status(400).json({ error: 'Betting is closed for this period' });
  }

  // Deduct balance
  user.balance -= amount;
  user.totalBet += amount;
  user.exp += amount;

  // VIP level up
  VIP_CONFIG.forEach(v => {
    if (user.exp >= v.expNeeded && user.vipLevel < v.level) user.vipLevel = v.level;
  });

  // ✅ Use SERVER's current period (prevents mismatch)
  const bet = {
    id: 'BET' + Date.now() + Math.floor(Math.random() * 10000),
    uid,
    amount,
    betType: mode,             // wingo30 / wingo1 / etc.
    betValue,                  // green/red/violet/0-9/big/small
    selection,                 // color/number/big/small
    period: state.current.period,
    mode,
    result: 'pending',
    payout: 0,
    winNumber: null,
    createdAt: new Date().toISOString()
  };
  bets.push(bet);

  console.log(`[BET] ${bet.id} | ${uid} | ${mode} | ${selection}=${betValue} | ₹${amount} | period=${bet.period}`);

  res.json({
    message: 'Bet placed',
    betId: bet.id,
    bet,
    balance: user.balance
  });
});

// ✅ Bet history for a user
app.get('/api/game/wingo/history/:uid', (req, res) => {
  const userBets = bets
    .filter(b => b.uid === req.params.uid)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100);
  res.json(userBets);
});

app.get('/api/user/bets/:uid', (req, res) => {
  res.json(bets.filter(b => b.uid === req.params.uid));
});

app.get('/api/user/bets/:uid/active', (req, res) => {
  res.json(bets.filter(b => b.uid === req.params.uid && b.result === 'pending'));
});

// ==================== VIP ====================
app.get('/api/vip/status/:uid', (req, res) => {
  const user = users.find(u => u.uid === req.params.uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    uid: user.uid,
    exp: user.exp,
    vipLevel: user.vipLevel,
    vipConfig: VIP_CONFIG,
    history: []
  });
});

// ==================== MILESTONES ====================
app.get('/api/milestones/:uid', (req, res) => {
  const user = users.find(u => u.uid === req.params.uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const claimed = user.claimedMilestones || [];
  const list = MILESTONES.map(m => ({
    ...m,
    unlocked: user.totalDeposit >= m.deposit,
    claimed: claimed.includes(m.id)
  }));
  res.json({ totalDeposit: user.totalDeposit, milestones: list });
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

// ==================== GIFT CODES ====================
app.post('/api/admin/create-giftcode', (req, res) => {
  const { code, amount } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });
  giftCodes.push({ code: code.toUpperCase(), amount: Number(amount), isUsed: false, usedBy: null });
  res.json({ message: 'Created', code, amount });
});

app.post('/api/user/claim-giftcode', (req, res) => {
  const { uid, code } = req.body;
  const user = users.find(u => u.uid === uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const gift = giftCodes.find(g => g.code === (code || '').toUpperCase());
  if (!gift) return res.status(400).json({ error: 'Invalid code' });
  if (gift.isUsed) return res.status(400).json({ error: 'Code already used' });

  user.balance += gift.amount;
  gift.isUsed = true;
  gift.usedBy = uid;

  messages.push({
    id: Date.now(),
    uid,
    title: 'Gift Code Claimed',
    message: `You have received ₹${gift.amount} from gift code ${gift.code}`,
    date: new Date().toISOString()
  });

  res.json({ message: 'Claimed', amount: gift.amount, balance: user.balance });
});

// ==================== DEPOSITS ====================
app.post('/api/user/deposit', (req, res) => {
  const { uid, amount, utr, method } = req.body;
  const user = users.find(u => u.uid === uid);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const amt = Number(amount);
  if (!amt || amt < 100) return res.status(400).json({ error: 'Min deposit ₹100' });

  const dep = {
    id: 'DEP' + Date.now(),
    uid,
    amount: amt,
    utr: utr || '',
    method: method || 'UPI',
    status: 'APPROVED',
    date: new Date().toISOString()
  };
  deposits.push(dep);
  user.balance += amt;
  user.totalDeposit += amt;

  messages.push({
    id: Date.now() + 1,
    uid,
    title: 'Deposit Successful',
    message: `₹${amt} has been added to your account`,
    date: new Date().toISOString()
  });

  res.json({ message: 'Deposit successful', deposit: dep, balance: user.balance });
});

app.get('/api/user/deposit-history/:uid', (req, res) => {
  res.json(deposits
    .filter(d => d.uid === req.params.uid)
    .sort((a, b) => new Date(b.date) - new Date(a.date)));
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
  if (user.totalDeposit > 0 && rem > 0) {
    return res.status(400).json({ error: `Please bet ₹${rem.toFixed(2)} more before withdrawing` });
  }

  user.balance -= amt;
  const w = {
    id: 'WD' + Date.now(),
    uid,
    amount: amt,
    method: method || 'UPI',
    status: 'PROCESSING',
    date: new Date().toISOString()
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
    team: team.map(t => ({
      name: 'USER' + t.phone.slice(-4),
      earned: 0,
      joinedAt: t.createdAt
    }))
  });
});

// ==================== ADMIN ====================
app.post('/api/admin/give-bonus', (req, res) => {
  const { uid, bonusAmount, reasonMessage } = req.body;
  const user = users.find(u => u.uid === uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.balance += Number(bonusAmount);
  messages.push({
    id: Date.now(),
    uid: user.uid,
    title: 'Bonus Received!',
    message: reasonMessage || `You received ₹${bonusAmount} bonus!`,
    date: new Date().toISOString()
  });
  res.json({ message: 'Done', balance: user.balance });
});

app.post('/api/admin/ban-user', (req, res) => {
  const { uid, banStatus } = req.body;
  const user = users.find(u => u.uid === uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.isBanned = !!banStatus;
  res.json({ message: 'Updated', isBanned: user.isBanned });
});

app.get('/api/admin/game-state', (req, res) => {
  const out = {};
  Object.keys(WINGO_MODES).forEach(mode => {
    out[mode] = {
      current: gameState[mode].current,
      historyCount: gameState[mode].history.length,
      recentHistory: gameState[mode].history.slice(0, 5)
    };
  });
  res.json(out);
});

app.get('/api/admin/all-bets', (req, res) => {
  res.json(bets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100));
});

app.get('/api/admin/all-users', (req, res) => {
  res.json(users.map(u => ({
    uid: u.uid, phone: u.phone, balance: u.balance,
    totalDeposit: u.totalDeposit, totalBet: u.totalBet, totalWin: u.totalWin
  })));
});

// ==================== HEALTH ====================
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'DARKWIN API running', modes: Object.keys(WINGO_MODES) });
});

// ==================== START ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ DARKWIN API running on port ${PORT}`);
  console.log(`📊 Wingo modes: ${Object.keys(WINGO_MODES).join(', ')}`);
});
