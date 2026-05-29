require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const rateLimit = require("express-rate-limit");
const helmet    = require("helmet");
const morgan    = require("morgan");
const path      = require("path");
const axios     = require("axios");

const app  = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "tradeflow_dev_secret_change_me";

// ── Daraja config ─────────────────────────────────────────────
const MPESA_ENV       = (process.env.MPESA_ENV || "sandbox").toLowerCase();
const CONSUMER_KEY    = (process.env.MPESA_CONSUMER_KEY    || "").trim();
const CONSUMER_SECRET = (process.env.MPESA_CONSUMER_SECRET || "").trim();
const SHORTCODE       = (process.env.MPESA_SHORTCODE       || "174379").trim();
const PASSKEY         = (process.env.MPESA_PASSKEY         || "").trim();
const CALLBACK_URL    = (process.env.MPESA_CALLBACK_URL    || "https://example.com/api/payments/mpesa/callback").trim();

const DARAJA_BASE = MPESA_ENV === "production"
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke";

const IS_DEMO = !CONSUMER_KEY || !CONSUMER_SECRET || !PASSKEY || CONSUMER_KEY.length < 10;

console.log("=================================================");
console.log(`[CFG] MPESA_ENV       = ${MPESA_ENV}`);
console.log(`[CFG] DARAJA_BASE     = ${DARAJA_BASE}`);
console.log(`[CFG] SHORTCODE       = ${SHORTCODE}`);
console.log(`[CFG] CONSUMER_KEY    = ${CONSUMER_KEY ? CONSUMER_KEY.slice(0,8)+"..." : "NOT SET"}`);
console.log(`[CFG] CONSUMER_SECRET = ${CONSUMER_SECRET ? "SET("+CONSUMER_SECRET.length+"chars)" : "NOT SET"}`);
console.log(`[CFG] PASSKEY         = ${PASSKEY ? "SET("+PASSKEY.length+"chars)" : "NOT SET"}`);
console.log(`[CFG] CALLBACK_URL    = ${CALLBACK_URL}`);
console.log(`[CFG] IS_DEMO         = ${IS_DEMO}`);
console.log("=================================================");

// ── Middleware ────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("dev"));
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(rateLimit({
  windowMs: 60 * 1000, max: 500,
  skip: req =>
    req.path.startsWith("/api/market") ||
    req.path.startsWith("/api/payments/deposit/") ||
    req.path.startsWith("/api/payments/mpesa") ||
    req.path.startsWith("/api/payments/test"),
}));

// ── In-Memory DB ──────────────────────────────────────────────
const DB = {
  users: [], trades: [], transactions: [],
  settings: {
    maintenanceMode: false, tradingEnabled: true,
    minStake: 50, maxStake: 100000, defaultPayout: 86,
    payoutRates: { "30s":80,"1m":75,"5m":86,"15m":82,"30m":78,"1h":70 },
    minDeposit: 1, minWithdrawal: 500,
    withdrawalFeePercent: 0.5, withdrawalFeeFlat: 30,
    welcomeBonus: 0, platformName: "TradeFlow Pro", announcement: "",
  },
};

DB.users.push({
  id: "admin-001",
  username: process.env.ADMIN_USERNAME || "admin",
  email: "admin@tradeflow.pro",
  password: bcrypt.hashSync(process.env.ADMIN_PASSWORD || "Admin@TradeFlow2024", 10),
  role: "admin", balance: 0, totalDeposited: 0, totalWithdrawn: 0,
  totalProfit: 0, totalLoss: 0, tradeCount: 0, winCount: 0,
  status: "active", createdAt: new Date().toISOString(), lastLogin: null,
  phone: "", kycVerified: false,
});
DB.users.push({
  id: uuidv4(), username: "demo_user", email: "demo@tradeflow.pro",
  password: bcrypt.hashSync("Demo@1234", 10),
  role: "user", balance: 5000, totalDeposited: 5000, totalWithdrawn: 0,
  totalProfit: 1430, totalLoss: 800, tradeCount: 12, winCount: 8,
  status: "active", createdAt: new Date(Date.now()-86400000*5).toISOString(),
  lastLogin: new Date().toISOString(), phone: "+254712345678", kycVerified: true,
});

// ── Helpers ───────────────────────────────────────────────────
const safeUser = u => { const { password, ...r } = u; return r; };

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: "Invalid token" }); }
}
function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}
function formatPhone(raw) {
  let p = String(raw).trim().replace(/[\s\-()+]/g, "");
  if (p.startsWith("254")) return p;
  if (p.startsWith("0"))   return "254" + p.slice(1);
  if (p.startsWith("7") || p.startsWith("1")) return "254" + p;
  return p;
}
function getTimestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
function getPassword(ts) {
  return Buffer.from(`${SHORTCODE}${PASSKEY}${ts}`).toString("base64");
}

// ── Daraja OAuth ──────────────────────────────────────────────
async function getAccessToken() {
  // Build Basic auth manually — most reliable across all envs
  const credential = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");
  const url = `${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`;

  console.log(`[OAUTH] → GET ${url}`);
  console.log(`[OAUTH] credential prefix: ${credential.slice(0,12)}...`);

  const response = await axios({
    method: "get",
    url,
    headers: {
      "Authorization": `Basic ${credential}`,
      "Accept":        "application/json",
      "Cache-Control": "no-cache",
    },
    timeout: 20000,
    // do NOT use axios `auth:` option — build header manually above
  });

  console.log(`[OAUTH] ← ${response.status} ${JSON.stringify(response.data)}`);

  if (!response.data?.access_token) {
    throw new Error(`No access_token. Response: ${JSON.stringify(response.data)}`);
  }
  return response.data.access_token;
}

// ── STK Push ──────────────────────────────────────────────────
async function stkPush(token, phone, amount) {
  const ts  = getTimestamp();
  const pw  = getPassword(ts);
  const url = `${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`;

  const body = {
    BusinessShortCode: SHORTCODE,
    Password:          pw,
    Timestamp:         ts,
    TransactionType:   "CustomerPayBillOnline",
    Amount:            Math.ceil(Number(amount)),
    PartyA:            phone,
    PartyB:            SHORTCODE,
    PhoneNumber:       phone,
    CallBackURL:       CALLBACK_URL,
    AccountReference:  "TradeFlowPro",
    TransactionDesc:   `Deposit KES ${Math.ceil(amount)}`,
  };

  console.log(`[STK] → POST ${url}`);
  console.log(`[STK] body: ${JSON.stringify({ ...body, Password: "[HIDDEN]" })}`);

  const response = await axios({
    method:  "post",
    url,
    data:    body,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
      "Accept":        "application/json",
    },
    timeout: 30000,
  });

  console.log(`[STK] ← ${response.status} ${JSON.stringify(response.data)}`);
  return response.data;
}

// ── STK Query ─────────────────────────────────────────────────
async function stkQuery(token, checkoutRequestId) {
  const ts  = getTimestamp();
  const pw  = getPassword(ts);
  const url = `${DARAJA_BASE}/mpesa/stkpushquery/v1/query`;

  const body = {
    BusinessShortCode: SHORTCODE,
    Password:          pw,
    Timestamp:         ts,
    CheckoutRequestID: checkoutRequestId,
  };

  console.log(`[QUERY] → POST ${url} checkoutId=${checkoutRequestId}`);

  try {
    const response = await axios({
      method: "post", url, data: body,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type":  "application/json",
        "Accept":        "application/json",
      },
      timeout: 15000,
    });
    console.log(`[QUERY] ← ${response.status} ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (err) {
    // 400 from Daraja often means "still processing" — return body
    if (err.response?.data) {
      console.log(`[QUERY] ← ${err.response.status} ${JSON.stringify(err.response.data)}`);
      return err.response.data;
    }
    throw err;
  }
}

// ── DIAGNOSTIC endpoint — visit /api/payments/test-daraja ────
// This lets you test Daraja connectivity without using the app UI
app.get("/api/payments/test-daraja", async (req, res) => {
  const result = {
    config: {
      MPESA_ENV,
      DARAJA_BASE,
      SHORTCODE,
      CONSUMER_KEY_SET: !!CONSUMER_KEY,
      CONSUMER_KEY_LEN: CONSUMER_KEY.length,
      CONSUMER_SECRET_SET: !!CONSUMER_SECRET,
      CONSUMER_SECRET_LEN: CONSUMER_SECRET.length,
      PASSKEY_SET: !!PASSKEY,
      PASSKEY_LEN: PASSKEY.length,
      CALLBACK_URL,
      IS_DEMO,
    },
    oauth: null,
    oauthError: null,
    stk: null,
    stkError: null,
  };

  if (IS_DEMO) {
    return res.json({ ...result, message: "Running in DEMO mode — set env vars to test real Daraja" });
  }

  // Test OAuth
  try {
    const token = await getAccessToken();
    result.oauth = { success: true, tokenPrefix: token.slice(0, 10) + "..." };
  } catch (e) {
    result.oauthError = e.message;
    return res.json({ ...result, message: "OAuth failed — check CONSUMER_KEY and CONSUMER_SECRET" });
  }

  res.json({ ...result, message: "OAuth OK! Use POST /api/payments/deposit to test STK push." });
});

// ── AUTH ──────────────────────────────────────────────────────
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password, phone } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: "All fields required" });
    if (DB.users.find(u => u.email === email))
      return res.status(400).json({ error: "Email already registered" });
    if (DB.users.find(u => u.username === username))
      return res.status(400).json({ error: "Username taken" });
    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    const user = {
      id: uuidv4(), username, email,
      password: await bcrypt.hash(password, 10),
      phone: phone || "", role: "user",
      balance: DB.settings.welcomeBonus || 0,
      totalDeposited: 0, totalWithdrawn: 0, totalProfit: 0, totalLoss: 0,
      tradeCount: 0, winCount: 0, status: "active",
      createdAt: new Date().toISOString(), lastLogin: new Date().toISOString(),
      kycVerified: false,
    };
    DB.users.push(user);
    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: safeUser(user) });
  } catch (e) { console.error(e); res.status(500).json({ error: "Server error" }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = DB.users.find(u => u.email === email || u.username === email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    if (user.status === "suspended")
      return res.status(403).json({ error: "Account suspended. Contact support." });
    if (!await bcrypt.compare(password, user.password))
      return res.status(401).json({ error: "Invalid credentials" });
    user.lastLogin = new Date().toISOString();
    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: safeUser(user) });
  } catch (e) { res.status(500).json({ error: "Server error" }); }
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  const user = DB.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(safeUser(user));
});

// ── USER ──────────────────────────────────────────────────────
app.get("/api/user/stats", authMiddleware, (req, res) => {
  const user = DB.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "Not found" });
  const ut = DB.trades.filter(t => t.userId === user.id);
  const td = ut.filter(t => new Date(t.createdAt).toDateString() === new Date().toDateString());
  res.json({
    balance: user.balance, totalDeposited: user.totalDeposited,
    totalWithdrawn: user.totalWithdrawn, totalProfit: user.totalProfit,
    totalLoss: user.totalLoss, tradeCount: user.tradeCount, winCount: user.winCount,
    winRate: user.tradeCount > 0 ? Math.round(user.winCount / user.tradeCount * 100) : 0,
    todayPL: td.reduce((s, t) => s + (t.payout || 0), 0),
    todayTrades: td.length,
  });
});
app.get("/api/user/trades", authMiddleware, (req, res) => {
  res.json(DB.trades.filter(t => t.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50));
});
app.get("/api/user/transactions", authMiddleware, (req, res) => {
  res.json(DB.transactions.filter(t => t.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 30));
});

// ── TRADE ─────────────────────────────────────────────────────
app.post("/api/trade/place", authMiddleware, (req, res) => {
  if (!DB.settings.tradingEnabled)
    return res.status(403).json({ error: "Trading disabled by admin" });
  const user = DB.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "Not found" });
  if (user.status === "suspended") return res.status(403).json({ error: "Account suspended" });
  const { asset, direction, stake, expirySec, expiryLabel, entryPrice } = req.body;
  if (!asset || !direction || !stake || !expirySec)
    return res.status(400).json({ error: "Missing trade params" });
  if (stake < DB.settings.minStake)
    return res.status(400).json({ error: `Min stake KES ${DB.settings.minStake}` });
  if (stake > DB.settings.maxStake)
    return res.status(400).json({ error: `Max stake KES ${DB.settings.maxStake}` });
  if (user.balance < stake)
    return res.status(400).json({ error: "Insufficient balance" });

  user.balance -= stake;
  const trade = {
    id: uuidv4(), userId: user.id, asset, direction, stake,
    expiryLabel, expirySec, entryPrice, exitPrice: null,
    payout: null, result: "PENDING",
    createdAt: new Date().toISOString(), settledAt: null,
  };
  DB.trades.push(trade);
  const rate = (DB.settings.payoutRates[expiryLabel] || DB.settings.defaultPayout) / 100;
  setTimeout(() => {
    const t = DB.trades.find(x => x.id === trade.id);
    if (!t) return;
    const win   = Math.random() < 0.55;
    t.result    = win ? "WIN" : "LOSS";
    t.payout    = win ? Math.round(stake * rate) : -stake;
    t.exitPrice = entryPrice * (win ? (direction === "CALL" ? 1.002 : 0.998) : (direction === "CALL" ? 0.998 : 1.002));
    t.settledAt = new Date().toISOString();
    const u = DB.users.find(x => x.id === trade.userId);
    if (u) {
      if (win) { u.balance += stake + Math.round(stake * rate); u.totalProfit += Math.round(stake * rate); u.winCount++; }
      else { u.totalLoss += stake; }
      u.tradeCount++;
    }
  }, Math.min(expirySec * 1000, 15000));
  res.json({ trade, newBalance: user.balance });
});

app.get("/api/trade/:id/result", authMiddleware, (req, res) => {
  const t = DB.trades.find(x => x.id === req.params.id && x.userId === req.user.id);
  if (!t) return res.status(404).json({ error: "Not found" });
  const u = DB.users.find(x => x.id === req.user.id);
  res.json({ trade: t, balance: u?.balance });
});

// ── DEPOSIT ───────────────────────────────────────────────────
app.post("/api/payments/deposit", authMiddleware, async (req, res) => {
  const { phone, amount } = req.body;
  if (!phone || !amount)
    return res.status(400).json({ error: "Phone and amount required" });

  const amt = Number(amount);
  if (isNaN(amt) || amt < DB.settings.minDeposit)
    return res.status(400).json({ error: `Minimum deposit is KES ${DB.settings.minDeposit}` });

  const fmtPhone = formatPhone(phone);
  console.log(`[DEPOSIT] phone=${phone} → ${fmtPhone} amount=${amt}`);

  if (!/^2547\d{8}$|^2541\d{8}$/.test(fmtPhone)) {
    return res.status(400).json({
      error: `Invalid phone number. Got "${fmtPhone}". Use Safaricom format 07XXXXXXXX`,
    });
  }

  const txn = {
    id: uuidv4(), userId: req.user.id, type: "deposit",
    amount: amt, phone: fmtPhone, status: "pending",
    mpesaCheckoutId: null, mpesaRef: null, _credited: false,
    createdAt: new Date().toISOString(), completedAt: null, notes: "",
  };
  DB.transactions.push(txn);

  // DEMO MODE
  if (IS_DEMO) {
    txn.status = "demo";
    return res.json({
      transactionId: txn.id, mode: "demo",
      message: "Demo mode — deposit will be credited automatically.",
    });
  }

  // REAL DARAJA
  try {
    const token = await getAccessToken();
    const data  = await stkPush(token, fmtPhone, amt);

    if (data.ResponseCode === "0") {
      txn.mpesaCheckoutId = data.CheckoutRequestID;
      txn.notes = data.CustomerMessage || "STK push sent";
      return res.json({
        transactionId:     txn.id,
        checkoutRequestId: data.CheckoutRequestID,
        message:           data.CustomerMessage || "Check your phone and enter your M-Pesa PIN",
      });
    }

    txn.status = "failed";
    const detail = data.errorMessage || data.ResponseDescription || data.ResultDesc || JSON.stringify(data);
    txn.notes = detail;
    return res.status(502).json({
      error: "M-Pesa payment failed", detail,
      code: data.errorCode || data.ResponseCode || "",
    });

  } catch (e) {
    txn.status = "failed";
    txn.notes  = e.message;
    console.error(`[DEPOSIT] Exception: ${e.message}`);

    // Parse axios error for a clean message
    const axiosDetail = e.response
      ? `Daraja HTTP ${e.response.status}: ${JSON.stringify(e.response.data)}`
      : e.message;

    return res.status(502).json({
      error:  "Payment initiation failed",
      detail: axiosDetail,
    });
  }
});

// ── POLL STATUS ───────────────────────────────────────────────
app.get("/api/payments/deposit/:txnId/status", authMiddleware, async (req, res) => {
  const txn = DB.transactions.find(t => t.id === req.params.txnId && t.userId === req.user.id);
  if (!txn) return res.status(404).json({ error: "Not found" });

  if (txn.status === "demo") {
    if (!txn._credited) {
      txn._credited = true; txn.status = "success";
      txn.completedAt = new Date().toISOString();
      const u = DB.users.find(x => x.id === req.user.id);
      if (u) { u.balance += txn.amount; u.totalDeposited += txn.amount; }
    }
    const u = DB.users.find(x => x.id === req.user.id);
    return res.json({ status: txn.status, balance: u?.balance });
  }

  if (["success","failed","cancelled"].includes(txn.status)) {
    const u = DB.users.find(x => x.id === req.user.id);
    return res.json({ status: txn.status, balance: u?.balance, mpesaRef: txn.mpesaRef });
  }
  if (!txn.mpesaCheckoutId) return res.json({ status: "pending" });

  try {
    const token = await getAccessToken();
    const data  = await stkQuery(token, txn.mpesaCheckoutId);
    const rc    = String(data?.ResultCode ?? "");

    if (rc === "0") {
      if (!txn._credited) {
        txn._credited = true; txn.status = "success";
        txn.completedAt = new Date().toISOString();
        const meta = data?.CallbackMetadata?.Item || [];
        txn.mpesaRef = meta.find(i => i.Name === "MpesaReceiptNumber")?.Value || "";
        txn.notes    = `M-Pesa ref: ${txn.mpesaRef}`;
        const u = DB.users.find(x => x.id === req.user.id);
        if (u) { u.balance += txn.amount; u.totalDeposited += txn.amount; }
      }
    } else if (rc === "1032") {
      txn.status = "cancelled"; txn.notes = "Cancelled by user";
    } else if (rc === "1037") {
      txn.status = "failed"; txn.notes = "Timed out";
    } else if (
      data?.errorCode === "500.001.1001" ||
      (data?.errorMessage || "").toLowerCase().includes("in process") ||
      (data?.ResultDesc || "").toLowerCase().includes("not found")
    ) {
      return res.json({ status: "pending" });
    } else if (rc && rc !== "0") {
      txn.status = "failed";
      txn.notes  = data?.ResultDesc || data?.errorMessage || "Payment failed";
    } else {
      return res.json({ status: "pending" });
    }

    const u = DB.users.find(x => x.id === req.user.id);
    return res.json({ status: txn.status, balance: u?.balance, mpesaRef: txn.mpesaRef, message: txn.notes });
  } catch (e) {
    console.error(`[POLL] ${e.message}`);
    return res.json({ status: "pending" });
  }
});

// ── CALLBACK ──────────────────────────────────────────────────
app.post("/api/payments/mpesa/callback", (req, res) => {
  try {
    console.log("[CALLBACK]", JSON.stringify(req.body));
    const cb = req.body?.Body?.stkCallback;
    if (!cb) return res.json({ ResultCode: 0, ResultDesc: "OK" });
    const txn = DB.transactions.find(t => t.mpesaCheckoutId === cb.CheckoutRequestID);
    if (!txn) return res.json({ ResultCode: 0, ResultDesc: "OK" });
    if (cb.ResultCode === 0 && !txn._credited) {
      const meta  = cb.CallbackMetadata?.Item || [];
      const mpRef = meta.find(i => i.Name === "MpesaReceiptNumber")?.Value || "";
      const paid  = meta.find(i => i.Name === "Amount")?.Value || txn.amount;
      txn._credited = true; txn.status = "success";
      txn.completedAt = new Date().toISOString();
      txn.mpesaRef = mpRef; txn.notes = `M-Pesa ref: ${mpRef}`;
      const u = DB.users.find(x => x.id === txn.userId);
      if (u) { u.balance += Number(paid); u.totalDeposited += Number(paid); }
      console.log(`[CALLBACK] Credited KES ${paid} user=${txn.userId} ref=${mpRef}`);
    } else if (cb.ResultCode !== 0) {
      txn.status = cb.ResultCode === 1032 ? "cancelled" : "failed";
      txn.notes  = cb.ResultDesc || "Failed";
    }
  } catch (e) { console.error("[CALLBACK]", e.message); }
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// ── WITHDRAWAL ────────────────────────────────────────────────
app.post("/api/payments/withdraw", authMiddleware, async (req, res) => {
  const { phone, amount } = req.body;
  if (!phone || !amount) return res.status(400).json({ error: "Phone and amount required" });
  const amt = Number(amount);
  if (amt < DB.settings.minWithdrawal)
    return res.status(400).json({ error: `Min withdrawal KES ${DB.settings.minWithdrawal}` });
  const user = DB.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "Not found" });
  if (user.balance < amt) return res.status(400).json({ error: "Insufficient balance" });
  const fee = Math.round(amt * (DB.settings.withdrawalFeePercent / 100) + DB.settings.withdrawalFeeFlat);
  const net = amt - fee;
  user.balance -= amt; user.totalWithdrawn += amt;
  const txn = {
    id: uuidv4(), userId: user.id, type: "withdrawal",
    amount: amt, fee, net, phone: formatPhone(phone),
    status: "pending", createdAt: new Date().toISOString(),
    completedAt: null, notes: "Awaiting admin approval",
  };
  DB.transactions.push(txn);
  res.json({ transactionId: txn.id, fee, net, newBalance: user.balance,
    message: "Withdrawal submitted. Processing within 24 hours." });
});

// ── MARKET ────────────────────────────────────────────────────
const ASSETS = [
  {id:"usdkes",name:"USD/KES",sub:"Nairobi FX",   icon:"💵",cat:"forex", price:132.45,chg: 0.23,vol:"2.4M"},
  {id:"eurkes",name:"EUR/KES",sub:"Nairobi FX",   icon:"💶",cat:"forex", price:143.80,chg:-0.41,vol:"1.8M"},
  {id:"gbpkes",name:"GBP/KES",sub:"Nairobi FX",   icon:"🏴",cat:"forex", price:167.20,chg: 0.18,vol:"890K"},
  {id:"usdjpy",name:"USD/JPY",sub:"Global FX",    icon:"¥", cat:"forex", price:149.85,chg:-0.32,vol:"5.1B"},
  {id:"btcusd",name:"BTC/USD",sub:"Crypto",        icon:"₿", cat:"crypto",price:68420, chg: 2.15,vol:"12.1B"},
  {id:"ethusd",name:"ETH/USD",sub:"Crypto",        icon:"◆", cat:"crypto",price:3245.6,chg: 1.08,vol:"4.2B"},
  {id:"solusd",name:"SOL/USD",sub:"Crypto",        icon:"◉", cat:"crypto",price:178.40,chg:-0.73,vol:"1.1B"},
  {id:"safcom",name:"SCOM",   sub:"NSE·Safaricom", icon:"📡",cat:"nse",  price:17.40, chg:-0.57,vol:"14.2M"},
  {id:"eqbnk", name:"EQTY",   sub:"NSE·Equity",   icon:"🏦",cat:"nse",  price:52.75, chg: 1.32,vol:"5.8M"},
  {id:"kenol", name:"KENO",   sub:"NSE·Kobil",     icon:"⛽",cat:"nse",  price:14.20, chg:-0.28,vol:"2.1M"},
  {id:"eabl",  name:"EABL",   sub:"NSE·EA Brew",   icon:"🍺",cat:"nse",  price:145.50,chg: 0.69,vol:"3.4M"},
  {id:"gold",  name:"XAU/USD",sub:"Commodities",   icon:"🥇",cat:"comm", price:2348.5,chg: 0.65,vol:"52.4B"},
  {id:"oil",   name:"WTI Oil",sub:"Commodities",   icon:"🛢", cat:"comm", price:78.32, chg:-0.44,vol:"18.6B"},
];
setInterval(() => {
  ASSETS.forEach(a => {
    a.price = Math.max(0.01, a.price + (Math.random()-0.495)*a.price*0.0012);
    a.chg   = Math.max(-9.99, Math.min(9.99, a.chg + (Math.random()-0.5)*0.04));
  });
}, 2000);
app.get("/api/market/assets", (_, res) => res.json(ASSETS));
app.get("/api/market/signals", (_, res) => res.json(ASSETS.map(a => ({
  assetId: a.id, name: a.name, sub: a.sub, icon: a.icon,
  direction: Math.random() > 0.48 ? "CALL" : "PUT",
  confidence: Math.round(54 + Math.random() * 38),
  rsi: Math.round(30 + Math.random() * 40),
  trend: Math.random() > 0.5 ? "BULLISH" : "BEARISH",
}))));

// ── ADMIN ─────────────────────────────────────────────────────
app.get("/api/admin/stats", authMiddleware, adminOnly, (req, res) => {
  const users = DB.users.filter(u => u.role !== "admin");
  const deps  = DB.transactions.filter(t => t.type==="deposit" && t.status==="success");
  const wds   = DB.transactions.filter(t => t.type==="withdrawal");
  const pw    = wds.filter(t => t.status==="pending");
  const tt    = DB.trades.length;
  const wt    = DB.trades.filter(t => t.result==="WIN").length;
  const hp    = DB.trades.filter(t => t.result!=="PENDING")
    .reduce((s,t) => s + (t.result==="LOSS" ? t.stake : -t.payout), 0);
  res.json({
    totalUsers: users.length,
    activeUsers: users.filter(u => u.status==="active").length,
    suspendedUsers: users.filter(u => u.status==="suspended").length,
    totalBalance: users.reduce((s,u) => s+u.balance, 0),
    totalDeposits: deps.reduce((s,t) => s+t.amount, 0),
    totalWithdrawals: wds.reduce((s,t) => s+(t.amount||0), 0),
    pendingWithdrawalsCount: pw.length,
    pendingWithdrawalsAmount: pw.reduce((s,t) => s+t.amount, 0),
    totalTrades: tt, winTrades: wt, lossTrades: tt-wt,
    houseProfit: Math.round(hp),
    platformWinRate: tt>0 ? Math.round(wt/tt*100) : 0,
  });
});
app.get("/api/admin/users", authMiddleware, adminOnly, (req, res) =>
  res.json(DB.users.filter(u => u.role!=="admin").map(safeUser)));
app.get("/api/admin/users/:id", authMiddleware, adminOnly, (req, res) => {
  const user = DB.users.find(u => u.id===req.params.id);
  if (!user) return res.status(404).json({error:"Not found"});
  res.json({
    user: safeUser(user),
    trades: DB.trades.filter(t=>t.userId===user.id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)),
    transactions: DB.transactions.filter(t=>t.userId===user.id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)),
  });
});
app.patch("/api/admin/users/:id", authMiddleware, adminOnly, (req, res) => {
  const user = DB.users.find(u => u.id===req.params.id);
  if (!user) return res.status(404).json({error:"Not found"});
  ["balance","status","kycVerified","phone"].forEach(k => {
    if (req.body[k] !== undefined) user[k] = k==="balance" ? parseFloat(req.body[k]) : req.body[k];
  });
  res.json(safeUser(user));
});
app.post("/api/admin/users/:id/adjust-balance", authMiddleware, adminOnly, (req, res) => {
  const user = DB.users.find(u => u.id===req.params.id);
  if (!user) return res.status(404).json({error:"Not found"});
  const {amount, type, reason} = req.body;
  const adj = parseFloat(amount);
  if (isNaN(adj)||adj<=0) return res.status(400).json({error:"Invalid amount"});
  if (type==="debit"&&user.balance<adj) return res.status(400).json({error:"Balance too low"});
  type==="credit" ? (user.balance+=adj) : (user.balance-=adj);
  DB.transactions.push({
    id:uuidv4(), userId:user.id, type:`admin_${type}`, amount:adj,
    status:"success", notes:reason||"Admin adjustment",
    createdAt:new Date().toISOString(), completedAt:new Date().toISOString(),
  });
  res.json({newBalance: user.balance});
});
app.delete("/api/admin/users/:id", authMiddleware, adminOnly, (req, res) => {
  const i = DB.users.findIndex(u => u.id===req.params.id && u.role!=="admin");
  if (i===-1) return res.status(404).json({error:"Not found"});
  DB.users.splice(i, 1);
  res.json({success:true});
});
app.post("/api/admin/users/:id/reset-password", authMiddleware, adminOnly, async (req, res) => {
  const user = DB.users.find(u => u.id===req.params.id);
  if (!user) return res.status(404).json({error:"Not found"});
  const {newPassword} = req.body;
  if (!newPassword||newPassword.length<6) return res.status(400).json({error:"Too short"});
  user.password = await bcrypt.hash(newPassword, 10);
  res.json({success:true});
});
app.get("/api/admin/transactions", authMiddleware, adminOnly, (req, res) =>
  res.json([...DB.transactions].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))));
app.patch("/api/admin/transactions/:id", authMiddleware, adminOnly, (req, res) => {
  const txn = DB.transactions.find(t => t.id===req.params.id);
  if (!txn) return res.status(404).json({error:"Not found"});
  const {status, notes} = req.body;
  txn.status = status;
  if (notes) txn.notes = notes;
  if (["success","rejected"].includes(status)) txn.completedAt = new Date().toISOString();
  if (status==="rejected" && txn.type==="withdrawal") {
    const u = DB.users.find(x => x.id===txn.userId);
    if (u) u.balance += txn.amount;
  }
  res.json(txn);
});
app.get("/api/admin/trades", authMiddleware, adminOnly, (req, res) =>
  res.json([...DB.trades].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,200)));
app.get("/api/admin/settings", authMiddleware, adminOnly, (req, res) => res.json(DB.settings));
app.patch("/api/admin/settings", authMiddleware, adminOnly, (req, res) => {
  Object.assign(DB.settings, req.body);
  res.json(DB.settings);
});
app.get("/api/settings/public", (req, res) => {
  const {maintenanceMode,tradingEnabled,minStake,maxStake,payoutRates,
    minDeposit,minWithdrawal,withdrawalFeePercent,withdrawalFeeFlat,
    platformName,announcement} = DB.settings;
  res.json({maintenanceMode,tradingEnabled,minStake,maxStake,payoutRates,
    minDeposit,minWithdrawal,withdrawalFeePercent,withdrawalFeeFlat,
    platformName,announcement});
});

// ── Serve React ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../client/build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build", "index.html"));
});

app.listen(PORT, () => {
  console.log(`[SERVER] TradeFlow Pro on port ${PORT} | env=${MPESA_ENV} | demo=${IS_DEMO}`);
});
