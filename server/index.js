require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const bcrypt     = require("bcryptjs");
const jwt        = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const rateLimit  = require("express-rate-limit");
const helmet     = require("helmet");
const morgan     = require("morgan");
const path       = require("path");

const app  = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "tradeflow_dev_secret_change_me_32chars";

// ── Daraja / M-Pesa config ────────────────────────────────────
const MPESA_ENV            = process.env.MPESA_ENV || "sandbox";
const CONSUMER_KEY         = process.env.MPESA_CONSUMER_KEY    || "";
const CONSUMER_SECRET      = process.env.MPESA_CONSUMER_SECRET  || "";
const SHORTCODE            = process.env.MPESA_SHORTCODE        || "174379";
const PASSKEY              = process.env.MPESA_PASSKEY          || "";
const CALLBACK_URL         = process.env.MPESA_CALLBACK_URL     || "https://example.com/api/payments/mpesa/callback";
const DARAJA_BASE          = MPESA_ENV === "production"
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke";

// ── Middleware ────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("combined"));
app.use(cors({ origin: process.env.FRONTEND_URL || "*", credentials: true }));
app.use(express.json());

// Rate limit — skip market polling and mpesa callback
app.use(rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  message: { error: "Too many requests" },
  skip: (req) =>
    req.path.startsWith("/api/market") ||
    req.path.startsWith("/api/payments/deposit/") ||
    req.path.startsWith("/api/payments/mpesa/callback"),
}));

// ── In-Memory DB ──────────────────────────────────────────────
const DB = {
  users: [],
  trades: [],
  transactions: [],
  settings: {
    maintenanceMode: false,
    tradingEnabled: true,
    minStake: 50,
    maxStake: 100000,
    defaultPayout: 86,
    payoutRates: { "30s":80, "1m":75, "5m":86, "15m":82, "30m":78, "1h":70 },
    minDeposit: 10,
    minWithdrawal: 500,
    withdrawalFeePercent: 0.5,
    withdrawalFeeFlat: 30,
    welcomeBonus: 0,
    platformName: "TradeFlow Pro",
    announcement: "",
  },
};

// ── Seed admin ─────────────────────────────────────────────────
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "Admin@TradeFlow2024";
DB.users.push({
  id: "admin-001",
  username: process.env.ADMIN_USERNAME || "admin",
  email: "admin@tradeflow.pro",
  password: bcrypt.hashSync(ADMIN_PASS, 10),
  role: "admin", balance: 0, totalDeposited: 0, totalWithdrawn: 0,
  totalProfit: 0, totalLoss: 0, tradeCount: 0, winCount: 0,
  status: "active", createdAt: new Date().toISOString(), lastLogin: null,
  phone: "", kycVerified: false,
});

// ── Seed demo user ─────────────────────────────────────────────
DB.users.push({
  id: uuidv4(),
  username: "demo_user",
  email: "demo@tradeflow.pro",
  password: bcrypt.hashSync("Demo@1234", 10),
  role: "user", balance: 5000, totalDeposited: 5000, totalWithdrawn: 0,
  totalProfit: 1430, totalLoss: 800, tradeCount: 12, winCount: 8,
  status: "active", createdAt: new Date(Date.now()-86400000*5).toISOString(),
  lastLogin: new Date().toISOString(), phone: "+254712345678", kycVerified: true,
});

// ── Helpers ───────────────────────────────────────────────────
function safeUser(u){ const {password,...r}=u; return r; }

function auth(req,res,next){
  const token=req.headers.authorization?.split(" ")[1];
  if(!token) return res.status(401).json({error:"Unauthorized"});
  try{ req.user=jwt.verify(token,JWT_SECRET); next(); }
  catch{ return res.status(401).json({error:"Invalid token"}); }
}

function adminOnly(req,res,next){
  if(req.user?.role!=="admin") return res.status(403).json({error:"Admin only"});
  next();
}

// ── Daraja helpers ────────────────────────────────────────────

// Get OAuth token from Daraja
async function getOAuthToken(){
  const creds = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");
  const r = await fetch(`${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`,{
    headers:{ Authorization:`Basic ${creds}` },
  });
  if(!r.ok){
    const t=await r.text();
    throw new Error(`OAuth failed: ${r.status} ${t}`);
  }
  const d=await r.json();
  return d.access_token;
}

// Generate STK Push password and timestamp
function getStkParams(){
  const ts=new Date().toISOString().replace(/[-T:.Z]/g,"").slice(0,14);
  const pass=Buffer.from(`${SHORTCODE}${PASSKEY}${ts}`).toString("base64");
  return {timestamp:ts, password:pass};
}

// Format phone to 2547XXXXXXXX
function formatPhone(phone){
  let p=phone.toString().trim().replace(/\s+/g,"");
  if(p.startsWith("+254")) p=p.slice(1);          // +254 → 254
  if(p.startsWith("0"))    p="254"+p.slice(1);     // 07 → 2547
  if(p.startsWith("7")||p.startsWith("1")) p="254"+p; // 7X → 2547X
  return p;
}

// ── AUTH ROUTES ───────────────────────────────────────────────

app.post("/api/auth/register", async(req,res)=>{
  try{
    const {username,email,password,phone}=req.body;
    if(!username||!email||!password) return res.status(400).json({error:"All fields required"});
    if(DB.users.find(u=>u.email===email)) return res.status(400).json({error:"Email already registered"});
    if(DB.users.find(u=>u.username===username)) return res.status(400).json({error:"Username taken"});
    if(password.length<6) return res.status(400).json({error:"Password must be at least 6 characters"});
    const hash=await bcrypt.hash(password,10);
    const user={
      id:uuidv4(),username,email,password:hash,phone:phone||"",
      role:"user",balance:DB.settings.welcomeBonus||0,
      totalDeposited:0,totalWithdrawn:0,totalProfit:0,totalLoss:0,
      tradeCount:0,winCount:0,status:"active",
      createdAt:new Date().toISOString(),lastLogin:new Date().toISOString(),kycVerified:false,
    };
    DB.users.push(user);
    const token=jwt.sign({id:user.id,role:user.role,username:user.username},JWT_SECRET,{expiresIn:"7d"});
    res.json({token,user:safeUser(user)});
  }catch(e){ res.status(500).json({error:"Server error"}); }
});

app.post("/api/auth/login", async(req,res)=>{
  try{
    const {email,password}=req.body;
    const user=DB.users.find(u=>u.email===email||u.username===email);
    if(!user) return res.status(401).json({error:"Invalid credentials"});
    if(user.status==="suspended") return res.status(403).json({error:"Account suspended. Contact support."});
    const ok=await bcrypt.compare(password,user.password);
    if(!ok) return res.status(401).json({error:"Invalid credentials"});
    user.lastLogin=new Date().toISOString();
    const token=jwt.sign({id:user.id,role:user.role,username:user.username},JWT_SECRET,{expiresIn:"7d"});
    res.json({token,user:safeUser(user)});
  }catch(e){ res.status(500).json({error:"Server error"}); }
});

app.get("/api/auth/me", auth,(req,res)=>{
  const user=DB.users.find(u=>u.id===req.user.id);
  if(!user) return res.status(404).json({error:"User not found"});
  res.json(safeUser(user));
});

// ── USER ROUTES ───────────────────────────────────────────────

app.get("/api/user/stats", auth,(req,res)=>{
  const user=DB.users.find(u=>u.id===req.user.id);
  if(!user) return res.status(404).json({error:"Not found"});
  const userTrades=DB.trades.filter(t=>t.userId===user.id);
  const today=new Date().toDateString();
  const todayTrades=userTrades.filter(t=>new Date(t.createdAt).toDateString()===today);
  const todayPL=todayTrades.reduce((s,t)=>s+(t.payout||0),0);
  res.json({
    balance:user.balance, totalDeposited:user.totalDeposited, totalWithdrawn:user.totalWithdrawn,
    totalProfit:user.totalProfit, totalLoss:user.totalLoss,
    tradeCount:user.tradeCount, winCount:user.winCount,
    winRate:user.tradeCount>0?Math.round((user.winCount/user.tradeCount)*100):0,
    todayPL, todayTrades:todayTrades.length,
  });
});

app.get("/api/user/trades", auth,(req,res)=>{
  const trades=DB.trades.filter(t=>t.userId===req.user.id)
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,50);
  res.json(trades);
});

app.get("/api/user/transactions", auth,(req,res)=>{
  const txns=DB.transactions.filter(t=>t.userId===req.user.id)
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,30);
  res.json(txns);
});

// ── TRADE ROUTES ──────────────────────────────────────────────

app.post("/api/trade/place", auth,(req,res)=>{
  if(!DB.settings.tradingEnabled) return res.status(403).json({error:"Trading is currently disabled by admin"});
  const user=DB.users.find(u=>u.id===req.user.id);
  if(!user) return res.status(404).json({error:"User not found"});
  if(user.status==="suspended") return res.status(403).json({error:"Account suspended"});

  const {asset,direction,stake,expirySec,expiryLabel,entryPrice}=req.body;
  if(!asset||!direction||!stake||!expirySec) return res.status(400).json({error:"Missing trade params"});
  if(stake<DB.settings.minStake) return res.status(400).json({error:`Minimum stake is KES ${DB.settings.minStake}`});
  if(stake>DB.settings.maxStake) return res.status(400).json({error:`Maximum stake is KES ${DB.settings.maxStake}`});
  if(user.balance<stake) return res.status(400).json({error:"Insufficient balance"});

  user.balance-=stake;
  const trade={
    id:uuidv4(),userId:user.id,asset,direction,stake,
    expiryLabel,expirySec,entryPrice,exitPrice:null,
    payout:null,result:"PENDING",
    createdAt:new Date().toISOString(),settledAt:null,
  };
  DB.trades.push(trade);

  const payoutRate=(DB.settings.payoutRates[expiryLabel]||DB.settings.defaultPayout)/100;
  const delay=Math.min(expirySec*1000,15000);

  setTimeout(()=>{
    const t=DB.trades.find(tr=>tr.id===trade.id);
    if(!t) return;
    const win=Math.random()<0.55;
    const payout=win?Math.round(stake*payoutRate):-stake;
    t.result=win?"WIN":"LOSS";
    t.payout=payout;
    t.exitPrice=entryPrice*(win?(direction==="CALL"?1.002:0.998):(direction==="CALL"?0.998:1.002));
    t.settledAt=new Date().toISOString();
    const u2=DB.users.find(u=>u.id===trade.userId);
    if(u2){
      if(win){ u2.balance+=stake+Math.round(stake*payoutRate); u2.totalProfit+=Math.round(stake*payoutRate); u2.winCount++; }
      else{ u2.totalLoss+=stake; }
      u2.tradeCount++;
    }
  },delay);

  res.json({trade,newBalance:user.balance});
});

app.get("/api/trade/:id/result", auth,(req,res)=>{
  const trade=DB.trades.find(t=>t.id===req.params.id&&t.userId===req.user.id);
  if(!trade) return res.status(404).json({error:"Trade not found"});
  const user=DB.users.find(u=>u.id===req.user.id);
  res.json({trade,balance:user?.balance});
});

// ── MPESA / DARAJA ROUTES ─────────────────────────────────────

// POST /api/payments/deposit — initiate STK push
app.post("/api/payments/deposit", auth, async(req,res)=>{
  const {phone,amount}=req.body;
  if(!phone||!amount) return res.status(400).json({error:"Phone and amount required"});
  if(amount<DB.settings.minDeposit) return res.status(400).json({error:`Minimum deposit is KES ${DB.settings.minDeposit}`});

  const formattedPhone=formatPhone(phone);

  // Validate phone format
  if(!/^2547\d{8}$|^2541\d{8}$/.test(formattedPhone)){
    return res.status(400).json({error:"Invalid Kenyan phone number. Use format 07XXXXXXXX"});
  }

  // Create pending transaction
  const txn={
    id:uuidv4(), userId:req.user.id, type:"deposit", amount:Number(amount),
    phone:formattedPhone, status:"pending",
    mpesaCheckoutId:null, mpesaRef:null,
    createdAt:new Date().toISOString(), completedAt:null, notes:"",
  };
  DB.transactions.push(txn);

  // Demo mode — no real keys
  if(!CONSUMER_KEY||!CONSUMER_SECRET||!PASSKEY||CONSUMER_KEY==="your_consumer_key_from_daraja"){
    txn.status="demo";
    return res.json({transactionId:txn.id, mode:"demo", message:"Demo mode — add Daraja credentials to enable real M-Pesa payments"});
  }

  try{
    // 1. Get OAuth token
    const token=await getOAuthToken();

    // 2. Build STK push request
    const {timestamp,password}=getStkParams();
    const body={
      BusinessShortCode: SHORTCODE,
      Password:          password,
      Timestamp:         timestamp,
      TransactionType:   "CustomerPayBillOnline",
      Amount:            Math.ceil(Number(amount)),
      PartyA:            formattedPhone,
      PartyB:            SHORTCODE,
      PhoneNumber:       formattedPhone,
      CallBackURL:       CALLBACK_URL,
      AccountReference:  "TradeFlowPro",
      TransactionDesc:   `Deposit KES ${amount}`,
    };

    // 3. Initiate STK push
    const stkRes=await fetch(`${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`,{
      method:"POST",
      headers:{
        Authorization: `Bearer ${token}`,
        "Content-Type":"application/json",
      },
      body:JSON.stringify(body),
    });

    const stkData=await stkRes.json();

    if(!stkRes.ok||stkData.ResponseCode!=="0"){
      txn.status="failed";
      txn.notes=stkData.errorMessage||stkData.ResponseDescription||"STK push failed";
      return res.status(502).json({
        error:"STK push failed",
        detail:txn.notes,
        raw:stkData,
      });
    }

    // Success
    txn.mpesaCheckoutId=stkData.CheckoutRequestID;
    txn.notes=stkData.CustomerMessage||"STK push sent";
    return res.json({
      transactionId:   txn.id,
      checkoutRequestId: stkData.CheckoutRequestID,
      merchantRequestId: stkData.MerchantRequestID,
      message:           stkData.CustomerMessage||"Check your phone and enter M-Pesa PIN",
    });

  }catch(e){
    txn.status="failed";
    txn.notes=e.message;
    console.error("STK push error:",e.message);
    return res.status(502).json({error:"STK initialization failed", detail:e.message});
  }
});

// GET /api/payments/deposit/:txnId/status — poll transaction status
app.get("/api/payments/deposit/:txnId/status", auth, async(req,res)=>{
  const txn=DB.transactions.find(t=>t.id===req.params.txnId&&t.userId===req.user.id);
  if(!txn) return res.status(404).json({error:"Transaction not found"});

  // Demo mode — auto-credit on first poll
  if(txn.status==="demo"){
    if(!txn._credited){
      txn._credited=true;
      txn.status="success";
      txn.completedAt=new Date().toISOString();
      const user=DB.users.find(u=>u.id===req.user.id);
      if(user){ user.balance+=txn.amount; user.totalDeposited+=txn.amount; }
    }
    const user=DB.users.find(u=>u.id===req.user.id);
    return res.json({status:txn.status, balance:user?.balance});
  }

  // Already resolved
  if(txn.status==="success"||txn.status==="failed"||txn.status==="cancelled"){
    const user=DB.users.find(u=>u.id===req.user.id);
    return res.json({status:txn.status, balance:user?.balance, mpesaRef:txn.mpesaRef});
  }

  // No checkout ID yet
  if(!txn.mpesaCheckoutId){
    return res.json({status:txn.status});
  }

  // Query STK push status from Daraja
  try{
    const token=await getOAuthToken();
    const {timestamp,password}=getStkParams();

    const queryRes=await fetch(`${DARAJA_BASE}/mpesa/stkpushquery/v1/query`,{
      method:"POST",
      headers:{
        Authorization:`Bearer ${token}`,
        "Content-Type":"application/json",
      },
      body:JSON.stringify({
        BusinessShortCode: SHORTCODE,
        Password:          password,
        Timestamp:         timestamp,
        CheckoutRequestID: txn.mpesaCheckoutId,
      }),
    });

    const qData=await queryRes.json();

    // ResultCode 0 = success
    if(qData.ResultCode==="0"||qData.ResultCode===0){
      if(txn.status!=="success"){
        txn.status="success";
        txn.completedAt=new Date().toISOString();
        txn.notes=qData.ResultDesc||"Payment completed";
        const user=DB.users.find(u=>u.id===req.user.id);
        if(user){ user.balance+=txn.amount; user.totalDeposited+=txn.amount; }
      }
    } else if(qData.ResultCode==="1032"||qData.ResultCode===1032){
      // User cancelled
      txn.status="cancelled";
      txn.notes="Cancelled by user";
    } else if(qData.ResultCode==="1037"||qData.ResultCode===1037){
      // Timeout
      txn.status="failed";
      txn.notes="STK push timed out";
    } else if(qData.errorCode==="500.001.1001"){
      // Still pending — query too early, keep polling
      return res.json({status:"pending"});
    } else if(qData.ResultCode&&qData.ResultCode!=="0"){
      txn.status="failed";
      txn.notes=qData.ResultDesc||"Payment failed";
    }

    const user=DB.users.find(u=>u.id===req.user.id);
    return res.json({status:txn.status, balance:user?.balance, mpesaRef:txn.mpesaRef, message:txn.notes});

  }catch(e){
    console.error("STK query error:",e.message);
    return res.json({status:txn.status});
  }
});

// POST /api/payments/mpesa/callback — Daraja webhook
app.post("/api/payments/mpesa/callback",(req,res)=>{
  try{
    const body=req.body?.Body?.stkCallback;
    if(!body) return res.json({ResultCode:0,ResultDesc:"OK"});

    const checkoutId=body.CheckoutRequestID;
    const resultCode=body.ResultCode;

    const txn=DB.transactions.find(t=>t.mpesaCheckoutId===checkoutId);
    if(!txn) return res.json({ResultCode:0,ResultDesc:"OK"});

    if(resultCode===0){
      // Payment successful
      const meta=body.CallbackMetadata?.Item||[];
      const getVal=name=>meta.find(i=>i.Name===name)?.Value;
      const mpesaRef=getVal("MpesaReceiptNumber")||"";
      const amountPaid=getVal("Amount")||txn.amount;

      if(txn.status!=="success"){
        txn.status="success";
        txn.completedAt=new Date().toISOString();
        txn.mpesaRef=mpesaRef;
        txn.notes=`M-Pesa ref: ${mpesaRef}`;
        const user=DB.users.find(u=>u.id===txn.userId);
        if(user){ user.balance+=Number(amountPaid); user.totalDeposited+=Number(amountPaid); }
      }
    } else {
      txn.status=resultCode===1032?"cancelled":"failed";
      txn.notes=body.ResultDesc||"Payment failed";
    }
  }catch(e){
    console.error("Callback error:",e.message);
  }
  res.json({ResultCode:0,ResultDesc:"Accepted"});
});

// POST /api/payments/withdraw — withdrawal request
app.post("/api/payments/withdraw", auth, async(req,res)=>{
  const {phone,amount}=req.body;
  if(!phone||!amount) return res.status(400).json({error:"Phone and amount required"});
  if(amount<DB.settings.minWithdrawal) return res.status(400).json({error:`Minimum withdrawal is KES ${DB.settings.minWithdrawal}`});
  const user=DB.users.find(u=>u.id===req.user.id);
  if(!user) return res.status(404).json({error:"User not found"});
  if(user.balance<amount) return res.status(400).json({error:"Insufficient balance"});

  const fee=Math.round(amount*(DB.settings.withdrawalFeePercent/100)+DB.settings.withdrawalFeeFlat);
  const net=amount-fee;

  user.balance-=amount;
  user.totalWithdrawn+=amount;

  const txn={
    id:uuidv4(),userId:user.id,type:"withdrawal",
    amount:Number(amount),fee,net,phone:formatPhone(phone),
    status:"pending",createdAt:new Date().toISOString(),completedAt:null,
    notes:"Awaiting admin approval",
  };
  DB.transactions.push(txn);
  res.json({transactionId:txn.id,fee,net,newBalance:user.balance,message:"Withdrawal request submitted. Processing within 24 hours."});
});

// ── MARKET ROUTES ─────────────────────────────────────────────

const ASSETS=[
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

// tick prices every 2s
setInterval(()=>{
  ASSETS.forEach(a=>{
    a.price=Math.max(0.01,a.price+(Math.random()-0.495)*a.price*0.0012);
    a.chg=Math.max(-9.99,Math.min(9.99,a.chg+(Math.random()-0.5)*0.04));
  });
},2000);

app.get("/api/market/assets",(req,res)=>res.json(ASSETS));

app.get("/api/market/signals",(req,res)=>{
  const signals=ASSETS.map(a=>({
    assetId:a.id, name:a.name, sub:a.sub, icon:a.icon,
    direction:Math.random()>0.48?"CALL":"PUT",
    confidence:Math.round(54+Math.random()*38),
    rsi:Math.round(30+Math.random()*40),
    trend:Math.random()>0.5?"BULLISH":"BEARISH",
  }));
  res.json(signals);
});

// ── ADMIN ROUTES ──────────────────────────────────────────────

app.get("/api/admin/stats", auth, adminOnly,(req,res)=>{
  const users=DB.users.filter(u=>u.role!=="admin");
  const totalBalance=users.reduce((s,u)=>s+u.balance,0);
  const deposits=DB.transactions.filter(t=>t.type==="deposit"&&t.status==="success");
  const withdrawals=DB.transactions.filter(t=>t.type==="withdrawal");
  const pending=DB.transactions.filter(t=>t.type==="withdrawal"&&t.status==="pending");
  const totalTrades=DB.trades.length;
  const winTrades=DB.trades.filter(t=>t.result==="WIN").length;
  const houseProfit=DB.trades.filter(t=>t.result!=="PENDING").reduce((s,t)=>s+(t.result==="LOSS"?t.stake:-t.payout),0);
  res.json({
    totalUsers:users.length,
    activeUsers:users.filter(u=>u.status==="active").length,
    suspendedUsers:users.filter(u=>u.status==="suspended").length,
    totalBalance,
    totalDeposits:deposits.reduce((s,t)=>s+t.amount,0),
    totalWithdrawals:withdrawals.reduce((s,t)=>s+(t.amount||0),0),
    pendingWithdrawalsCount:pending.length,
    pendingWithdrawalsAmount:pending.reduce((s,t)=>s+t.amount,0),
    totalTrades, winTrades, lossTrades:totalTrades-winTrades,
    houseProfit:Math.round(houseProfit),
    platformWinRate:totalTrades>0?Math.round((winTrades/totalTrades)*100):0,
  });
});

app.get("/api/admin/users", auth, adminOnly,(req,res)=>{
  res.json(DB.users.filter(u=>u.role!=="admin").map(safeUser));
});

app.get("/api/admin/users/:id", auth, adminOnly,(req,res)=>{
  const user=DB.users.find(u=>u.id===req.params.id);
  if(!user) return res.status(404).json({error:"User not found"});
  const trades=DB.trades.filter(t=>t.userId===user.id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const txns=DB.transactions.filter(t=>t.userId===user.id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  res.json({user:safeUser(user),trades,transactions:txns});
});

app.patch("/api/admin/users/:id", auth, adminOnly,(req,res)=>{
  const user=DB.users.find(u=>u.id===req.params.id);
  if(!user) return res.status(404).json({error:"Not found"});
  const {balance,status,kycVerified,phone}=req.body;
  if(balance!==undefined) user.balance=parseFloat(balance);
  if(status!==undefined) user.status=status;
  if(kycVerified!==undefined) user.kycVerified=kycVerified;
  if(phone!==undefined) user.phone=phone;
  res.json(safeUser(user));
});

app.post("/api/admin/users/:id/adjust-balance", auth, adminOnly,(req,res)=>{
  const user=DB.users.find(u=>u.id===req.params.id);
  if(!user) return res.status(404).json({error:"Not found"});
  const {amount,type,reason}=req.body;
  const adj=parseFloat(amount);
  if(isNaN(adj)||adj<=0) return res.status(400).json({error:"Invalid amount"});
  if(type==="debit"&&user.balance<adj) return res.status(400).json({error:"Balance too low"});
  type==="credit"?(user.balance+=adj):(user.balance-=adj);
  DB.transactions.push({
    id:uuidv4(),userId:user.id,type:`admin_${type}`,amount:adj,
    status:"success",notes:reason||"Admin adjustment",
    createdAt:new Date().toISOString(),completedAt:new Date().toISOString(),
  });
  res.json({newBalance:user.balance});
});

app.delete("/api/admin/users/:id", auth, adminOnly,(req,res)=>{
  const idx=DB.users.findIndex(u=>u.id===req.params.id&&u.role!=="admin");
  if(idx===-1) return res.status(404).json({error:"Not found"});
  DB.users.splice(idx,1);
  res.json({success:true});
});

app.post("/api/admin/users/:id/reset-password", auth, adminOnly, async(req,res)=>{
  const user=DB.users.find(u=>u.id===req.params.id);
  if(!user) return res.status(404).json({error:"Not found"});
  const {newPassword}=req.body;
  if(!newPassword||newPassword.length<6) return res.status(400).json({error:"Password too short"});
  user.password=await bcrypt.hash(newPassword,10);
  res.json({success:true});
});

app.get("/api/admin/transactions", auth, adminOnly,(req,res)=>{
  res.json([...DB.transactions].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)));
});

app.patch("/api/admin/transactions/:id", auth, adminOnly,(req,res)=>{
  const txn=DB.transactions.find(t=>t.id===req.params.id);
  if(!txn) return res.status(404).json({error:"Not found"});
  const {status,notes}=req.body;
  txn.status=status;
  if(notes) txn.notes=notes;
  if(status==="success"||status==="rejected") txn.completedAt=new Date().toISOString();
  // Refund on rejection
  if(status==="rejected"&&txn.type==="withdrawal"){
    const user=DB.users.find(u=>u.id===txn.userId);
    if(user) user.balance+=txn.amount;
  }
  res.json(txn);
});

app.get("/api/admin/trades", auth, adminOnly,(req,res)=>{
  res.json([...DB.trades].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,200));
});

app.get("/api/admin/settings", auth, adminOnly,(req,res)=>res.json(DB.settings));

app.patch("/api/admin/settings", auth, adminOnly,(req,res)=>{
  Object.assign(DB.settings,req.body);
  res.json(DB.settings);
});

// Public settings
app.get("/api/settings/public",(req,res)=>{
  const {maintenanceMode,tradingEnabled,minStake,maxStake,payoutRates,minDeposit,minWithdrawal,withdrawalFeePercent,withdrawalFeeFlat,platformName,announcement}=DB.settings;
  res.json({maintenanceMode,tradingEnabled,minStake,maxStake,payoutRates,minDeposit,minWithdrawal,withdrawalFeePercent,withdrawalFeeFlat,platformName,announcement});
});

// ── Serve React build ─────────────────────────────────────────
app.use(express.static(path.join(__dirname,"../client/build")));
app.get("*",(req,res)=>{
  res.sendFile(path.join(__dirname,"../client/build","index.html"));
});

app.listen(PORT,()=>console.log(`TradeFlow Pro server running on port ${PORT} [${MPESA_ENV}]`));
