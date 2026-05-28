require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "tradeflow_dev_secret_change_me_32chars";
const LIPANA_KEY = process.env.LIPANA_SECRET_KEY || "";

// ─── Middleware ────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("combined"));
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true
}));
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: "Too many requests" } }));
// ─── In-Memory Database ─────────────────────────────────────────
// In production you'd swap this for MongoDB/PostgreSQL
const DB = {
  users: [],
  trades: [],
  transactions: [],
  signals: [],
  settings: {
    maintenanceMode: false,
    tradingEnabled: true,
    minStake: 50,
    maxStake: 100000,
    defaultPayout: 86,
    payoutRates: { "1m": 75, "5m": 86, "15m": 82, "30m": 78, "1h": 70 },
    minDeposit: 10,
    minWithdrawal: 500,
    withdrawalFeePercent: 0.5,
    withdrawalFeeFlat: 30,
    welcomeBonus: 0,
    platformName: "TradeFlow Pro",
    announcement: ""
  }
};

// ─── Seed Admin ─────────────────────────────────────────────────
const adminPassword = process.env.ADMIN_PASSWORD || "Admin@TradeFlow2024";
const adminHash = bcrypt.hashSync(adminPassword, 10);
DB.users.push({
  id: "admin-001",
  username: process.env.ADMIN_USERNAME || "admin",
  email: "admin@tradeflow.pro",
  password: adminHash,
  role: "admin",
  balance: 0,
  totalDeposited: 0,
  totalWithdrawn: 0,
  totalProfit: 0,
  totalLoss: 0,
  tradeCount: 0,
  winCount: 0,
  status: "active",
  createdAt: new Date().toISOString(),
  lastLogin: null,
  phone: "",
  kycVerified: false
});

// Seed demo user
const demoHash = bcrypt.hashSync("Demo@1234", 10);
DB.users.push({
  id: uuidv4(),
  username: "demo_user",
  email: "demo@tradeflow.pro",
  password: demoHash,
  role: "user",
  balance: 5000,
  totalDeposited: 5000,
  totalWithdrawn: 0,
  totalProfit: 1430,
  totalLoss: 800,
  tradeCount: 12,
  winCount: 8,
  status: "active",
  createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  lastLogin: new Date().toISOString(),
  phone: "+254712345678",
  kycVerified: true
});

// Seed demo trades
for (let i = 0; i < 8; i++) {
  const u = DB.users[1];
  const win = Math.random() > 0.35;
  DB.trades.push({
    id: uuidv4(), userId: u.id, asset: ["USD/KES", "BTC/USD", "SCOM", "ETH/USD"][Math.floor(Math.random() * 4)],
    direction: Math.random() > 0.5 ? "CALL" : "PUT",
    stake: [200, 500, 800, 1000][Math.floor(Math.random() * 4)],
    payout: win ? Math.round(500 * 0.86) : -500,
    result: win ? "WIN" : "LOSS",
    expiryLabel: "5m", expirySec: 300,
    entryPrice: 132.45, exitPrice: 132.67,
    createdAt: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
    settledAt: new Date(Date.now() - Math.random() * 86400000 * 2).toISOString()
  });
}

// ─── Auth Middleware ─────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

// ─── Helper: Get user (without password) ────────────────────────
function safeUser(u) {
  const { password, ...rest } = u;
  return rest;
}

// ─── AUTH ROUTES ─────────────────────────────────────────────────

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password, phone } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: "All fields required" });
    if (DB.users.find(u => u.email === email)) return res.status(400).json({ error: "Email already registered" });
    if (DB.users.find(u => u.username === username)) return res.status(400).json({ error: "Username taken" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const hash = await bcrypt.hash(password, 10);
    const user = {
      id: uuidv4(), username, email, password: hash, phone: phone || "",
      role: "user", balance: DB.settings.welcomeBonus || 0,
      totalDeposited: 0, totalWithdrawn: 0, totalProfit: 0, totalLoss: 0,
      tradeCount: 0, winCount: 0, status: "active",
      createdAt: new Date().toISOString(), lastLogin: new Date().toISOString(),
      kycVerified: false
    };
    DB.users.push(user);
    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: safeUser(user) });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = DB.users.find(u => u.email === email || u.username === email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    if (user.status === "suspended") return res.status(403).json({ error: "Account suspended. Contact support." });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    user.lastLogin = new Date().toISOString();
    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: safeUser(user) });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// Me
app.get("/api/auth/me", auth, (req, res) => {
  const user = DB.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(safeUser(user));
});

// ─── USER ROUTES ─────────────────────────────────────────────────

// Get balance & stats
app.get("/api/user/stats", auth, (req, res) => {
  const user = DB.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "Not found" });
  const userTrades = DB.trades.filter(t => t.userId === user.id);
  const todayTrades = userTrades.filter(t => new Date(t.createdAt).toDateString() === new Date().toDateString());
  const todayPL = todayTrades.reduce((s, t) => s + (t.payout || 0), 0);
  res.json({
    balance: user.balance,
    totalDeposited: user.totalDeposited,
    totalWithdrawn: user.totalWithdrawn,
    totalProfit: user.totalProfit,
    totalLoss: user.totalLoss,
    tradeCount: user.tradeCount,
    winCount: user.winCount,
    winRate: user.tradeCount > 0 ? Math.round((user.winCount / user.tradeCount) * 100) : 0,
    todayPL,
    todayTrades: todayTrades.length
  });
});

// Get trade history
app.get("/api/user/trades", auth, (req, res) => {
  const trades = DB.trades.filter(t => t.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50);
  res.json(trades);
});

// Get transactions
app.get("/api/user/transactions", auth, (req, res) => {
  const txns = DB.transactions.filter(t => t.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 30);
  res.json(txns);
});

// ─── TRADE ROUTES ─────────────────────────────────────────────────

app.post("/api/trade/place", auth, (req, res) => {
  if (!DB.settings.tradingEnabled) return res.status(403).json({ error: "Trading is currently disabled by admin" });
  const user = DB.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.status === "suspended") return res.status(403).json({ error: "Account suspended" });

  const { asset, direction, stake, expirySec, expiryLabel, entryPrice } = req.body;
  if (!asset || !direction || !stake || !expirySec) return res.status(400).json({ error: "Missing trade params" });
  if (stake < DB.settings.minStake) return res.status(400).json({ error: `Minimum stake is KES ${DB.settings.minStake}` });
  if (stake > DB.settings.maxStake) return res.status(400).json({ error: `Maximum stake is KES ${DB.settings.maxStake}` });
  if (user.balance < stake) return res.status(400).json({ error: "Insufficient balance" });

  user.balance -= stake;
  const trade = {
    id: uuidv4(), userId: user.id, asset, direction, stake,
    expiryLabel, expirySec, entryPrice, exitPrice: null,
    payout: null, result: "PENDING",
    createdAt: new Date().toISOString(), settledAt: null
  };
  DB.trades.push(trade);

  // Settle trade after expiry (simulated, real would use market data)
  const payoutRate = (DB.settings.payoutRates[expiryLabel] || DB.settings.defaultPayout) / 100;
  const delay = Math.min(expirySec * 1000, 15000); // cap at 15s for demo

  setTimeout(() => {
    const t = DB.trades.find(tr => tr.id === trade.id);
    if (!t) return;
    // 55% win rate (house edge)
    const win = Math.random() < 0.55;
    const payout = win ? Math.round(stake * payoutRate) : -stake;
    t.result = win ? "WIN" : "LOSS";
    t.payout = payout;
    t.exitPrice = entryPrice * (win ? (direction === "CALL" ? 1.002 : 0.998) : (direction === "CALL" ? 0.998 : 1.002));
    t.settledAt = new Date().toISOString();

    const u2 = DB.users.find(u => u.id === req.user.id);
    if (u2) {
      if (win) { u2.balance += stake + Math.round(stake * payoutRate); u2.totalProfit += Math.round(stake * payoutRate); u2.winCount++; }
      else { u2.totalLoss += stake; }
      u2.tradeCount++;
    }
  }, delay);

  res.json({ trade, newBalance: user.balance });
});

// Trade result poll
app.get("/api/trade/:id/result", auth, (req, res) => {
  const trade = DB.trades.find(t => t.id === req.params.id && t.userId === req.user.id);
  if (!trade) return res.status(404).json({ error: "Trade not found" });
  const user = DB.users.find(u => u.id === req.user.id);
  res.json({ trade, balance: user?.balance });
});

// ─── MPESA / PAYMENT ROUTES ─────────────────────────────────────

app.post("/api/payments/deposit", auth, async (req, res) => {
  const { phone, amount } = req.body;
  if (!phone || !amount) return res.status(400).json({ error: "Phone and amount required" });
  if (amount < DB.settings.minDeposit) return res.status(400).json({ error: `Minimum deposit is KES ${DB.settings.minDeposit}` });

  const formattedPhone = phone.startsWith("0") ? "+254" + phone.slice(1) : phone.startsWith("254") ? "+" + phone : phone;

  // Create pending transaction record
  const txn = {
    id: uuidv4(), userId: req.user.id, type: "deposit", amount,
    phone: formattedPhone, status: "pending",
    lipanaTxnId: null, mpesaRef: null,
    createdAt: new Date().toISOString(), completedAt: null, notes: ""
  };
  DB.transactions.push(txn);

  if (!LIPANA_KEY || LIPANA_KEY.includes("your_key")) {
    // Demo mode
    txn.status = "demo";
    return res.json({ transactionId: txn.id, mode: "demo", message: "Demo mode — add LIPANA_SECRET_KEY to .env for real payments" });
  }

  try {
    const lipanaRes = await fetch("https://api.lipana.dev/transactions/stk-push", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LIPANA_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ phone: formattedPhone, amount })
    });
    const data = await lipanaRes.json();
    if (!lipanaRes.ok) throw { response: { data } };
    txn.lipanaTxnId = data.transactionId || data.transaction_id;
    res.json({ transactionId: txn.id, lipanaTxnId: txn.lipanaTxnId, message: "STK push sent" });
  } catch (e) {
    txn.status = "failed";
    txn.notes = e.response?.data?.message || e.message;
    res.status(502).json({ error: "Failed to initiate STK push", detail: txn.notes });
  }
});

// Poll deposit status
app.get("/api/payments/deposit/:txnId/status", auth, async (req, res) => {
  const txn = DB.transactions.find(t => t.id === req.params.txnId && t.userId === req.user.id);
  if (!txn) return res.status(404).json({ error: "Transaction not found" });

  if (txn.status === "demo") {
    // Auto-complete demo after first poll
    if (!txn._demoCredited) {
      txn._demoCredited = true;
      txn.status = "success";
      txn.completedAt = new Date().toISOString();
      const user = DB.users.find(u => u.id === req.user.id);
      if (user) { user.balance += txn.amount; user.totalDeposited += txn.amount; }
    }
    const user = DB.users.find(u => u.id === req.user.id);
    return res.json({ status: txn.status, balance: user?.balance });
  }

  if (!txn.lipanaTxnId) return res.json({ status: txn.status });

try {
    const lipanaRes = await fetch(`https://api.lipana.dev/transactions/${txn.lipanaTxnId}`, {
      headers: { "Authorization": `Bearer ${LIPANA_KEY}` }
    });
    const remote = await lipanaRes.json();
    const s = (remote.status || "").toLowerCase();
    if ((s === "success" || s === "completed") && txn.status !== "success") {
      txn.status = "success"; txn.completedAt = new Date().toISOString();
      txn.mpesaRef = remote.mpesaReceiptNumber || remote.reference || "";
      const user = DB.users.find(u => u.id === req.user.id);
      if (user) { user.balance += txn.amount; user.totalDeposited += txn.amount; }
    } else if (s === "failed" || s === "cancelled") {
      txn.status = "failed";
    }
    const user = DB.users.find(u => u.id === req.user.id);
    res.json({ status: txn.status, balance: user?.balance, mpesaRef: txn.mpesaRef });
  } catch (e) {
    res.json({ status: txn.status });
  }
});

// Withdrawal request
app.post("/api/payments/withdraw", auth, async (req, res) => {
  const { phone, amount } = req.body;
  if (!phone || !amount) return res.status(400).json({ error: "Phone and amount required" });
  if (amount < DB.settings.minWithdrawal) return res.status(400).json({ error: `Minimum withdrawal is KES ${DB.settings.minWithdrawal}` });
  const user = DB.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.balance < amount) return res.status(400).json({ error: "Insufficient balance" });

  const fee = Math.round(amount * (DB.settings.withdrawalFeePercent / 100) + DB.settings.withdrawalFeeFlat);
  const net = amount - fee;

  user.balance -= amount;
  user.totalWithdrawn += amount;

  const txn = {
    id: uuidv4(), userId: user.id, type: "withdrawal",
    amount, fee, net, phone,
    status: "pending", createdAt: new Date().toISOString(), completedAt: null, notes: "Awaiting admin approval"
  };
  DB.transactions.push(txn);
  res.json({ transactionId: txn.id, fee, net, newBalance: user.balance, message: "Withdrawal request submitted. Processing within 24 hours." });
});

// ─── MARKET DATA ──────────────────────────────────────────────────

const ASSETS = [
  { id: "usdkes", name: "USD/KES", sub: "Nairobi FX", icon: "💵", cat: "forex", price: 132.45, chg: 0.23, vol: "2.4M" },
  { id: "eurkes", name: "EUR/KES", sub: "Nairobi FX", icon: "💶", cat: "forex", price: 143.80, chg: -0.41, vol: "1.8M" },
  { id: "gbpkes", name: "GBP/KES", sub: "Nairobi FX", icon: "🏴", cat: "forex", price: 167.20, chg: 0.18, vol: "890K" },
  { id: "usdjpy", name: "USD/JPY", sub: "Global FX", icon: "¥", cat: "forex", price: 149.85, chg: -0.32, vol: "5.1B" },
  { id: "btcusd", name: "BTC/USD", sub: "Crypto", icon: "₿", cat: "crypto", price: 68420, chg: 2.15, vol: "12.1B" },
  { id: "ethusd", name: "ETH/USD", sub: "Crypto", icon: "◆", cat: "crypto", price: 3245.6, chg: 1.08, vol: "4.2B" },
  { id: "solusd", name: "SOL/USD", sub: "Crypto", icon: "◉", cat: "crypto", price: 178.40, chg: -0.73, vol: "1.1B" },
  { id: "safcom", name: "SCOM", sub: "NSE · Safaricom", icon: "📡", cat: "nse", price: 17.40, chg: -0.57, vol: "14.2M" },
  { id: "eqbnk", name: "EQTY", sub: "NSE · Equity Bank", icon: "🏦", cat: "nse", price: 52.75, chg: 1.32, vol: "5.8M" },
  { id: "kenol", name: "KENO", sub: "NSE · KenolKobil", icon: "⛽", cat: "nse", price: 14.20, chg: -0.28, vol: "2.1M" },
  { id: "eabl", name: "EABL", sub: "NSE · EA Breweries", icon: "🍺", cat: "nse", price: 145.50, chg: 0.69, vol: "3.4M" },
  { id: "gold", name: "XAU/USD", sub: "Commodities", icon: "🥇", cat: "comm", price: 2348.5, chg: 0.65, vol: "52.4B" },
  { id: "oil", name: "WTI Oil", sub: "Commodities", icon: "🛢", cat: "comm", price: 78.32, chg: -0.44, vol: "18.6B" },
];

// Tick prices every 2s
setInterval(() => {
  ASSETS.forEach(a => {
    a.price = Math.max(0.01, a.price + (Math.random() - 0.495) * a.price * 0.0012);
    a.chg = Math.max(-9.99, Math.min(9.99, a.chg + (Math.random() - 0.5) * 0.04));
  });
}, 2000);

app.get("/api/market/assets", (req, res) => res.json(ASSETS));

app.get("/api/market/signals", (req, res) => {
  const signals = ASSETS.map(a => ({
    assetId: a.id, name: a.name, sub: a.sub, icon: a.icon,
    direction: Math.random() > 0.48 ? "CALL" : "PUT",
    confidence: Math.round(54 + Math.random() * 38),
    rsi: Math.round(30 + Math.random() * 40),
    trend: Math.random() > 0.5 ? "BULLISH" : "BEARISH"
  }));
  res.json(signals);
});

// ─── ADMIN ROUTES ─────────────────────────────────────────────────

// Admin stats overview
app.get("/api/admin/stats", auth, adminOnly, (req, res) => {
  const users = DB.users.filter(u => u.role !== "admin");
  const totalBalance = users.reduce((s, u) => s + u.balance, 0);
  const totalDeposits = DB.transactions.filter(t => t.type === "deposit" && t.status === "success").reduce((s, t) => s + t.amount, 0);
  const totalWithdrawals = DB.transactions.filter(t => t.type === "withdrawal").reduce((s, t) => s + (t.amount || 0), 0);
  const pendingWithdrawals = DB.transactions.filter(t => t.type === "withdrawal" && t.status === "pending");
  const totalTrades = DB.trades.length;
  const winTrades = DB.trades.filter(t => t.result === "WIN").length;
  const houseProfit = DB.trades.filter(t => t.result !== "PENDING").reduce((s, t) => s + (t.result === "LOSS" ? t.stake : -t.payout), 0);
  res.json({
    totalUsers: users.length, activeUsers: users.filter(u => u.status === "active").length,
    suspendedUsers: users.filter(u => u.status === "suspended").length,
    totalBalance, totalDeposits, totalWithdrawals,
    pendingWithdrawalsCount: pendingWithdrawals.length,
    pendingWithdrawalsAmount: pendingWithdrawals.reduce((s, t) => s + t.amount, 0),
    totalTrades, winTrades, lossTrades: totalTrades - winTrades,
    houseProfit: Math.round(houseProfit),
    platformWinRate: totalTrades > 0 ? Math.round((winTrades / totalTrades) * 100) : 0
  });
});

// Admin: list users
app.get("/api/admin/users", auth, adminOnly, (req, res) => {
  const users = DB.users.filter(u => u.role !== "admin").map(safeUser);
  res.json(users);
});

// Admin: get user detail
app.get("/api/admin/users/:id", auth, adminOnly, (req, res) => {
  const user = DB.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const trades = DB.trades.filter(t => t.userId === user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const txns = DB.transactions.filter(t => t.userId === user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ user: safeUser(user), trades, transactions: txns });
});

// Admin: update user
app.patch("/api/admin/users/:id", auth, adminOnly, (req, res) => {
  const user = DB.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { balance, status, kycVerified, phone } = req.body;
  if (balance !== undefined) user.balance = parseFloat(balance);
  if (status !== undefined) user.status = status;
  if (kycVerified !== undefined) user.kycVerified = kycVerified;
  if (phone !== undefined) user.phone = phone;
  res.json(safeUser(user));
});

// Admin: credit/debit balance
app.post("/api/admin/users/:id/adjust-balance", auth, adminOnly, (req, res) => {
  const user = DB.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { amount, type, reason } = req.body; // type: "credit" | "debit"
  const adj = parseFloat(amount);
  if (isNaN(adj) || adj <= 0) return res.status(400).json({ error: "Invalid amount" });
  if (type === "debit" && user.balance < adj) return res.status(400).json({ error: "Balance too low" });
  type === "credit" ? (user.balance += adj) : (user.balance -= adj);
  DB.transactions.push({
    id: uuidv4(), userId: user.id, type: `admin_${type}`, amount: adj,
    status: "success", notes: reason || "Admin adjustment",
    createdAt: new Date().toISOString(), completedAt: new Date().toISOString()
  });
  res.json({ newBalance: user.balance });
});

// Admin: delete user
app.delete("/api/admin/users/:id", auth, adminOnly, (req, res) => {
  const idx = DB.users.findIndex(u => u.id === req.params.id && u.role !== "admin");
  if (idx === -1) return res.status(404).json({ error: "User not found" });
  DB.users.splice(idx, 1);
  res.json({ success: true });
});

// Admin: all transactions
app.get("/api/admin/transactions", auth, adminOnly, (req, res) => {
  const txns = [...DB.transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(txns);
});

// Admin: approve/reject withdrawal
app.patch("/api/admin/transactions/:id", auth, adminOnly, (req, res) => {
  const txn = DB.transactions.find(t => t.id === req.params.id);
  if (!txn) return res.status(404).json({ error: "Transaction not found" });
  const { status, notes } = req.body;
  txn.status = status;
  if (notes) txn.notes = notes;
  if (status === "success" || status === "rejected") txn.completedAt = new Date().toISOString();
  if (status === "rejected" && txn.type === "withdrawal") {
    // Refund
    const user = DB.users.find(u => u.id === txn.userId);
    if (user) user.balance += txn.amount;
  }
  res.json(txn);
});

// Admin: all trades
app.get("/api/admin/trades", auth, adminOnly, (req, res) => {
  const trades = [...DB.trades].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 200);
  res.json(trades);
});

// Admin: platform settings
app.get("/api/admin/settings", auth, adminOnly, (req, res) => res.json(DB.settings));

app.patch("/api/admin/settings", auth, adminOnly, (req, res) => {
  Object.assign(DB.settings, req.body);
  res.json(DB.settings);
});

// Admin: reset user password
app.post("/api/admin/users/:id/reset-password", auth, adminOnly, async (req, res) => {
  const user = DB.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: "Password too short" });
  user.password = await bcrypt.hash(newPassword, 10);
  res.json({ success: true });
});

// Public settings (for frontend)
app.get("/api/settings/public", (req, res) => {
  const { maintenanceMode, tradingEnabled, minStake, maxStake, payoutRates, minDeposit, minWithdrawal, withdrawalFeePercent, withdrawalFeeFlat, platformName, announcement } = DB.settings;
  res.json({ maintenanceMode, tradingEnabled, minStake, maxStake, payoutRates, minDeposit, minWithdrawal, withdrawalFeePercent, withdrawalFeeFlat, platformName, announcement });
});

// ─── Serve React Frontend ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../client/build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build", "index.html"));
});

app.listen(PORT, () => console.log(`TradeFlow Pro server running on port ${PORT}`));
