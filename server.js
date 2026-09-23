const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// ==================== IN-MEMORY DATABASE ====================
let users = []; // { uid, phone, password, balance, exp, vipLevel, isBanned, refereeCode, referredBy }
let banners = []; // { id, imageUrl, link }
let messages = []; // { id, uid, title, message, date }
let deposits = []; // { id, uid, amount, status, date }
let withdrawals = []; // { id, uid, amount, status, date }
let giftCodes = []; // { code, amount, isUsed, usedBy }
let vipHistory = []; // { uid, type, expGained, date }

// ✅ NAYA: Bets aur Periods ka storage
let bets = []; // { id, uid, periodId, gameType, selection, amount, status, winAmount, date }
let periods = []; // { id, periodNumber, startTime, endTime, result, status, gameType }

// VIP Config
const vipLevelsConfig = [
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

// Helper: Get User by UID
const findUser = (uid) => users.find(u => u.uid === uid);

// ==================== AUTH & PROFILE APIs ====================
// 1. Register
app.post('/api/auth/register', (req, res) => {
  const { phone, password, referralCode } = req.body;
  const existingUser = users.find(u => u.phone === phone);
  if (existingUser) return res.status(400).json({ error: "Phone number already registered" });

  const newUid = "UID" + Math.floor(100000 + Math.random() * 900000);
  const newUser = {
    uid: newUid,
    phone,
    password,
    balance: 0,
    exp: 0,
    vipLevel: 0,
    isBanned: false,
    refereeCode: newUid,
    referredBy: referralCode || null
  };
  users.push(newUser);
  res.json({ message: "Registration successful", user: newUser });
});

// 2. Login
app.post('/api/auth/login', (req, res) => {
  const { phone, password } = req.body;
  const user = users.find(u => u.phone === phone && u.password === password);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  if (user.isBanned) return res.status(403).json({ error: "Your account has been banned" });
  res.json({ message: "Login successful", user });
});

// 3. User Profile Details
app.get('/api/user/profile/:uid', (req, res) => {
  const user = findUser(req.params.uid);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

// ==================== HOME & BANNER APIs ====================
// Add Banner (Admin)
app.post('/api/banner/add', (req, res) => {
  const { imageUrl, link } = req.body;
  const banner = { id: Date.now(), imageUrl, link };
  banners.push(banner);
  res.json({ message: "Banner added", banner });
});

// Get Banners (Home Page)
app.get('/api/banners', (req, res) => {
  res.json(banners);
});

// ==================== WINGO GAME & BET APIs ====================

// ✅ Enhanced Wingo Bet API
app.post('/api/game/wingo/bet', (req, res) => {
  const { uid, periodId, gameType, selection, betAmount } = req.body;

  const user = findUser(uid);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.isBanned) return res.status(403).json({ error: "User banned" });
  if (user.balance < betAmount) return res.status(400).json({ error: "Insufficient balance" });

  const period = periods.find(p => p.id === periodId);
  if (!period) return res.status(404).json({ error: "Period not found" });
  if (period.status !== 'OPEN') return res.status(400).json({ error: "Betting is closed for this period" });

  // Deduct balance and add EXP (1 Rupee = 1 EXP)
  user.balance -= betAmount;
  user.exp += betAmount;

  // Track VIP Level Up
  vipLevelsConfig.forEach(cfg => {
    if (user.exp >= cfg.expNeeded && user.vipLevel < cfg.level) {
      user.vipLevel = cfg.level;
    }
  });

  // VIP History record
  vipHistory.push({ uid: user.uid, type: "Experience Bonus", expGained: betAmount, date: new Date().toISOString() });

  // ✅ Save bet
  const newBet = {
    id: Date.now() + Math.random(),
    uid,
    periodId,
    gameType,   // e.g., 'color', 'number', 'bigsmall'
    selection,  // e.g., 'red', 'green', '5', 'big'
    amount: betAmount,
    status: 'PENDING',
    winAmount: 0,
    date: new Date().toISOString()
  };
  bets.push(newBet);

  res.json({
    message: "Bet placed successfully",
    bet: newBet,
    remainingBalance: user.balance,
    currentExp: user.exp,
    vipLevel: user.vipLevel
  });
});

// ✅ User Bet History API
app.get('/api/user/bets/:uid', (req, res) => {
  const userBets = bets.filter(b => b.uid === req.params.uid);
  res.json(userBets);
});

// ✅ User Active Bets API (sirf PENDING bets)
app.get('/api/user/bets/:uid/active', (req, res) => {
  const activeBets = bets.filter(b => b.uid === req.params.uid && b.status === 'PENDING');
  res.json(activeBets);
});

// VIP Rules & Current Status API
app.get('/api/vip/status/:uid', (req, res) => {
  const user = findUser(req.params.uid);
  if (!user) return res.status(404).json({ error: "User not found" });
  const history = vipHistory.filter(h => h.uid === user.uid);
  res.json({
    uid: user.uid,
    exp: user.exp,
    vipLevel: user.vipLevel,
    vipConfig: vipLevelsConfig,
    history
  });
});

// ==================== PERIOD NUMBER MANAGEMENT APIs ====================

// ✅ Naya Period Create karo (Admin)
app.post('/api/admin/period/create', (req, res) => {
  const { gameType, durationMinutes } = req.body; // e.g., '1min', '3min', '5min'
  const now = new Date();
  const duration = (durationMinutes || 1) * 60 * 1000;

  const newPeriod = {
    id: Date.now(),
    periodNumber: generatePeriodNumber(gameType || '1min'),
    startTime: now.toISOString(),
    endTime: new Date(now.getTime() + duration).toISOString(),
    result: null,
    status: 'OPEN',
    gameType: gameType || '1min'
  };

  periods.push(newPeriod);
  res.json({ message: "Period created", period: newPeriod });
});

// ✅ Current Period lao
app.get('/api/period/current', (req, res) => {
  const current = periods.find(p => p.status === 'OPEN');
  if (!current) return res.status(404).json({ error: "No active period" });
  res.json(current);
});

// ✅ Period History (last 50)
app.get('/api/period/history', (req, res) => {
  const history = periods
    .filter(p => p.status === 'CLOSED')
    .sort((a, b) => b.id - a.id)
    .slice(0, 50);
  res.json(history);
});

// ✅ Period Result Set karo (Admin) — isse bets settle honge
app.post('/api/admin/period/result', (req, res) => {
  const { periodId, result } = req.body; // result: 'red', 'green', '5', 'big', etc.

  const period = periods.find(p => p.id === periodId);
  if (!period) return res.status(404).json({ error: "Period not found" });
  if (period.status === 'CLOSED') return res.status(400).json({ error: "Period already closed" });

  period.result = result;
  period.status = 'CLOSED';

  // ✅ Settle bets for this period
  const periodBets = bets.filter(b => b.periodId === periodId && b.status === 'PENDING');

  periodBets.forEach(bet => {
    let win = false;
    if (bet.gameType === 'color' && bet.selection === result) win = true;
    if (bet.gameType === 'number' && parseInt(bet.selection) === parseInt(result)) win = true;
    if (bet.gameType === 'bigsmall') {
      const num = parseInt(result);
      if (bet.selection === 'big' && num >= 5) win = true;
      if (bet.selection === 'small' && num <= 4) win = true;
    }

    if (win) {
      bet.status = 'WON';
      bet.winAmount = bet.amount * 2; // simple 2x payout
      const user = findUser(bet.uid);
      if (user) user.balance += bet.winAmount;
    } else {
      bet.status = 'LOST';
    }
  });

  res.json({ message: "Period result set and bets settled", period });
});

// Helper: Period number generate karo
function generatePeriodNumber(gameType) {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${gameType.replace('min', '')}${y}${m}${d}${random}`;
}

// ✅ Auto Period Generator (har 1 minute me naya period)
setInterval(() => {
  const hasOpen = periods.some(p => p.status === 'OPEN');
  if (!hasOpen) {
    const now = new Date();
    const newPeriod = {
      id: Date.now(),
      periodNumber: generatePeriodNumber('1min'),
      startTime: now.toISOString(),
      endTime: new Date(now.getTime() + 60000).toISOString(),
      result: null,
      status: 'OPEN',
      gameType: '1min'
    };
    periods.push(newPeriod);
    console.log('Auto period created:', newPeriod.periodNumber);
  }
}, 60000); // 1 minute

// ==================== ADMIN PANEL CONTROL APIs ====================
// 1. Give Bonus to User via UID & Send Notification Message
app.post('/api/admin/give-bonus', (req, res) => {
  const { uid, bonusAmount, reasonMessage } = req.body;
  const user = findUser(uid);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.balance += parseFloat(bonusAmount);

  // Send Instant Message to User's Inbox
  const msgObj = {
    id: Date.now(),
    uid: user.uid,
    title: "Bonus Received!",
    message: reasonMessage || `You have received a bonus of ₹${bonusAmount}!`,
    date: new Date().toISOString()
  };
  messages.push(msgObj);

  res.json({ message: "Bonus added successfully", newBalance: user.balance });
});

// 2. Ban / Unban User
app.post('/api/admin/ban-user', (req, res) => {
  const { uid, banStatus } = req.body;
  const user = findUser(uid);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.isBanned = banStatus;
  res.json({ message: `User status updated. Banned: ${user.isBanned}` });
});

// 3. Agent Referral Data
app.get('/api/admin/agent-promotion-stats', (req, res) => {
  const agentStats = users.map(user => {
    const totalReferred = users.filter(u => u.referredBy === user.refereeCode).length;
    return {
      uid: user.uid,
      phone: user.phone,
      totalInvited: totalReferred,
      currentBalance: user.balance
    };
  });
  res.json(agentStats);
});

// ==================== GIFT CODE APIs ====================
// Create Gift Code (Admin)
app.post('/api/admin/create-giftcode', (req, res) => {
  const { code, amount } = req.body;
  giftCodes.push({ code, amount: parseFloat(amount), isUsed: false, usedBy: null });
  res.json({ message: "Gift code created successfully", code, amount });
});

// Claim Gift Code (User)
app.post('/api/user/claim-giftcode', (req, res) => {
  const { uid, code } = req.body;
  const user = findUser(uid);
  const gift = giftCodes.find(g => g.code === code);

  if (!user) return res.status(404).json({ error: "User not found" });
  if (!gift) return res.status(400).json({ error: "Invalid Gift Code" });
  if (gift.isUsed) return res.status(400).json({ error: "Gift Code already used" });

  user.balance += gift.amount;
  gift.isUsed = true;
  gift.usedBy = uid;

  res.json({ message: `Success! ₹${gift.amount} added to your account`, newBalance: user.balance });
});

// ==================== INBOX MESSAGES, DEPOSIT & WITHDRAWAL ====================
// User Messages (Inbox)
app.get('/api/user/messages/:uid', (req, res) => {
  const userMsgs = messages.filter(m => m.uid === req.params.uid);
  res.json(userMsgs);
});

// Deposit Money Request
app.post('/api/user/deposit', (req, res) => {
  const { uid, amount } = req.body;
  const dep = {
    id: Date.now(),
    uid,
    amount,
    status: "APPROVED",
    date: new Date().toISOString()
  };
  deposits.push(dep);

  const user = findUser(uid);
  if (user) user.balance += parseFloat(amount);

  res.json({ message: "Deposit successful", deposit: dep });
});

// Deposit History
app.get('/api/user/deposit-history/:uid', (req, res) => {
  res.json(deposits.filter(d => d.uid === req.params.uid));
});

// Withdraw Money Request
app.post('/api/user/withdraw', (req, res) => {
  const { uid, amount } = req.body;
  const user = findUser(uid);
  if (!user || user.balance < amount) return res.status(400).json({ error: "Insufficient balance" });

  user.balance -= parseFloat(amount);
  const wtd = {
    id: Date.now(),
    uid,
    amount,
    status: "SUCCESS",
    date: new Date().toISOString()
  };
  withdrawals.push(wtd);

  res.json({ message: "Withdrawal successful", withdrawal: wtd });
});

// Withdraw History
app.get('/api/user/withdraw-history/:uid', (req, res) => {
  res.json(withdrawals.filter(w => w.uid === req.params.uid));
});

// ==================== SERVER START ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
