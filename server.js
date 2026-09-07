const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// ==================== IN-MEMORY DATABASE ====================
let users = [];       // { uid, phone, password, balance, exp, vipLevel, isBanned, refereeCode, referredBy }
let banners = [];     // { id, imageUrl, link }
let messages = [];    // { id, uid, title, message, date }
let deposits = [];    // { id, uid, amount, status, date }
let withdrawals = []; // { id, uid, amount, status, date }
let giftCodes = [];   // { code, amount, isUsed, usedBy }
let vipHistory = [];  // { uid, type, expGained, date }

// VIP Config based on screenshots
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

// ==================== WINGO GAME & VIP EXP API ====================

app.post('/api/game/wingo/bet', (req, res) => {
  const { uid, betAmount, selection } = req.body;
  const user = findUser(uid);

  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.isBanned) return res.status(403).json({ error: "User banned" });
  if (user.balance < betAmount) return res.status(400).json({ error: "Insufficient balance" });

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
  vipHistory.push({
    uid: user.uid,
    type: "Experience Bonus",
    expGained: betAmount,
    date: new Date().toISOString()
  });

  res.json({
    message: "Bet placed successfully",
    remainingBalance: user.balance,
    currentExp: user.exp,
    vipLevel: user.vipLevel
  });
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
  const { uid, banStatus } = req.body; // banStatus: true/false
  const user = findUser(uid);

  if (!user) return res.status(404).json({ error: "User not found" });

  user.isBanned = banStatus;
  res.json({ message: `User status updated. Banned: ${user.isBanned}` });
});

// 3. Agent Referral Data (Who invited how many users)
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

  // Sort by top deposits/invited agents
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
  const dep = { id: Date.now(), uid, amount, status: "APPROVED", date: new Date().toISOString() };
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
  const wtd = { id: Date.now(), uid, amount, status: "SUCCESS", date: new Date().toISOString() };
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
    
