import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { marketAPI, tradeAPI, userAPI, settingsAPI } from '../utils/api';
import DepositModal from '../components/DepositModal';
import WithdrawModal from '../components/WithdrawModal';

// ── helpers ───────────────────────────────────────────────────
function fmtPrice(p) {
  if (!p && p !== 0) return '—';
  if (p >= 10000) return p.toFixed(2);
  if (p >= 100)   return p.toFixed(3);
  if (p >= 1)     return p.toFixed(4);
  return p.toFixed(5);
}
function fmtKES(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return 'KES ' + (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return 'KES ' + (n / 1e3).toFixed(1) + 'K';
  return 'KES ' + n.toLocaleString();
}
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtCountdown(sec) {
  if (sec <= 0) return '00:00';
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

const EXPIRY_OPTIONS = [
  { label: '30 sec', key: '30s', sec: 30  },
  { label: '1 min',  key: '1m',  sec: 60  },
  { label: '5 min',  key: '5m',  sec: 300 },
  { label: '15 min', key: '15m', sec: 900 },
  { label: '30 min', key: '30m', sec: 1800},
];

const ASSET_COLORS = {
  forex: '#1a3a5c', crypto: '#2a1a4c', nse: '#0d3320', comm: '#3a2800'
};

const DEMO_ASSETS = [
  {id:'usdkes',name:'USD/KES',sub:'Nairobi FX',   icon:'💵',cat:'forex', price:132.45,chg: 0.23,vol:'2.4M'},
  {id:'eurkes',name:'EUR/KES',sub:'Nairobi FX',   icon:'💶',cat:'forex', price:143.80,chg:-0.41,vol:'1.8M'},
  {id:'gbpkes',name:'GBP/KES',sub:'Nairobi FX',   icon:'🏴',cat:'forex', price:167.20,chg: 0.18,vol:'890K'},
  {id:'btcusd',name:'BTC/USD',sub:'Crypto',        icon:'₿', cat:'crypto',price:68420, chg: 2.15,vol:'12.1B'},
  {id:'ethusd',name:'ETH/USD',sub:'Crypto',        icon:'◆', cat:'crypto',price:3245.6,chg: 1.08,vol:'4.2B'},
  {id:'solusd',name:'SOL/USD',sub:'Crypto',        icon:'◉', cat:'crypto',price:178.40,chg:-0.73,vol:'1.1B'},
  {id:'safcom',name:'SCOM',   sub:'NSE·Safaricom', icon:'📡',cat:'nse',  price:17.40, chg:-0.57,vol:'14.2M'},
  {id:'eqbnk', name:'EQTY',   sub:'NSE·Equity',   icon:'🏦',cat:'nse',  price:52.75, chg: 1.32,vol:'5.8M'},
  {id:'kenol', name:'KENO',   sub:'NSE·Kobil',     icon:'⛽',cat:'nse',  price:14.20, chg:-0.28,vol:'2.1M'},
  {id:'eabl',  name:'EABL',   sub:'NSE·EA Brew',   icon:'🍺',cat:'nse',  price:145.50,chg: 0.69,vol:'3.4M'},
  {id:'gold',  name:'XAU/USD',sub:'Commodities',   icon:'🥇',cat:'comm', price:2348.5,chg: 0.65,vol:'52.4B'},
  {id:'oil',   name:'WTI Oil',sub:'Commodities',   icon:'🛢', cat:'comm', price:78.32, chg:-0.44,vol:'18.6B'},
];

const FAKE_NAMES = ['Wanjiku','Kamau','Otieno','Njoroge','Achieng','Mwangi','Chebet',
  'Odhiambo','Waweru','Kipchoge','Adhiambo','Mutua','Wairimu','Omondi','Kariuki',
  'Nekesa','Gathoni','Simiyu','Wacera','Rotich','Njoki','Makau','Auma','Kirui',
  'Mumbi','Juma','Wambui','Korir','Awino','Muigai','Zawadi','Barasa'];
const ASSET_NAMES = ['USD/KES','EUR/KES','BTC/USD','ETH/USD','SCOM','XAU/USD','WTI Oil','EQTY','GBP/KES'];
function rN() { return FAKE_NAMES[Math.floor(Math.random()*FAKE_NAMES.length)]; }
function rA() { return ASSET_NAMES[Math.floor(Math.random()*ASSET_NAMES.length)]; }
function rV(mn=100,mx=8000) { return Math.floor(Math.random()*(mx-mn)+mn); }
function rMsg() {
  const pool = [
    ()=>`🎉 ${rN()} just won KES ${rV().toLocaleString()} on ${rA()}!`,
    ()=>`System: CONGRATULATIONS @${rN()} on your withdrawal of KES ${rV(200,8000).toLocaleString()} 🥳🥳`,
    ()=>`💸 ${rN()} withdrew KES ${rV(500,15000).toLocaleString()} to M-Pesa`,
    ()=>`🔥 ${rN()} placed KES ${rV().toLocaleString()} CALL on ${rA()}`,
    ()=>`📈 ${rN()} won streak! +KES ${rV(200,5000).toLocaleString()} profit`,
    ()=>`System: CONGRATULATIONS @${rN()} withdrawal of KES ${rV(100,5000).toLocaleString()} confirmed 🎊`,
    ()=>`⚡ ${rN()} deposited KES ${rV(500,10000).toLocaleString()} and jumped in!`,
    ()=>`💰 ${rN()} cashed out KES ${rV(1000,20000).toLocaleString()}! 🥳`,
    ()=>`${rN()}: Successfully claimed BONUS of KES ${rV(10,200).toLocaleString()}.`,
    ()=>`🎯 ${rN()} nailed PUT on ${rA()} +KES ${rV(200,4000).toLocaleString()}`,
  ];
  return pool[Math.floor(Math.random()*pool.length)]();
}
function tickAssets(prev) {
  return prev.map(a => ({
    ...a,
    price: Math.max(0.01, a.price + (Math.random()-0.495)*a.price*0.0015),
    chg: Math.max(-9.99, Math.min(9.99, a.chg + (Math.random()-0.5)*0.05)),
  }));
}

// ── Chart drawing ─────────────────────────────────────────────
function drawSpikeChart(canvas, data, liveRate, entryPrice, direction, tradeActive) {
  if (!canvas || data.length < 2) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  if (!W || !H) return;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const FIXED_MAX =  0.16;
  const FIXED_MIN = -0.12;
  const rng = FIXED_MAX - FIXED_MIN;
  const pL = 58, pR = 16, pT = 48, pB = 38;
  const cW = W - pL - pR, cH = H - pT - pB;

  const px = i => pL + (i / (data.length - 1)) * cW;
  const py = v => pT + cH - ((v - FIXED_MIN) / rng) * cH;
  const zeroY = py(0);

  // ── Grid ──
  const gridVals = [0.14, 0.10, 0.06, 0.02, 0.00, -0.02, -0.06, -0.10];
  gridVals.forEach(v => {
    const y = py(v);
    if (y < pT || y > pT + cH) return;
    ctx.strokeStyle = v === 0 ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.07)';
    ctx.lineWidth   = v === 0 ? 1.5 : 1;
    ctx.setLineDash(v === 0 ? [] : [4, 4]);
    ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(W - pR, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = v === 0 ? '#222' : '#888';
    ctx.font = `${v === 0 ? 'bold ' : ''}10px "DM Mono",monospace`;
    ctx.textAlign = 'right';
    ctx.fillText((v >= 0 ? '+' : '') + v.toFixed(2), pL - 6, y + 3);
  });

  // vertical grid
  for (let i = 0; i <= 5; i++) {
    const x = pL + (cW / 5) * i;
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, pT); ctx.lineTo(x, pT + cH); ctx.stroke();
  }

  // ── Green fill above zero ──
  const gGrad = ctx.createLinearGradient(0, pT, 0, zeroY);
  gGrad.addColorStop(0, 'rgba(0,180,80,0.85)');
  gGrad.addColorStop(0.5, 'rgba(0,200,80,0.55)');
  gGrad.addColorStop(1, 'rgba(0,200,80,0.15)');

  ctx.beginPath();
  ctx.moveTo(px(0), Math.min(py(data[0]), zeroY));
  for (let i = 0; i < data.length; i++) ctx.lineTo(px(i), Math.min(py(data[i]), zeroY));
  ctx.lineTo(px(data.length-1), zeroY);
  ctx.lineTo(px(0), zeroY);
  ctx.closePath();
  ctx.fillStyle = gGrad;
  ctx.fill();

  // ── Red fill below zero ──
  const rGrad = ctx.createLinearGradient(0, zeroY, 0, pT + cH);
  rGrad.addColorStop(0, 'rgba(220,20,40,0.15)');
  rGrad.addColorStop(0.5, 'rgba(210,0,30,0.55)');
  rGrad.addColorStop(1, 'rgba(200,0,20,0.88)');

  ctx.beginPath();
  ctx.moveTo(px(0), Math.max(py(data[0]), zeroY));
  for (let i = 0; i < data.length; i++) ctx.lineTo(px(i), Math.max(py(data[i]), zeroY));
  ctx.lineTo(px(data.length-1), zeroY);
  ctx.lineTo(px(0), zeroY);
  ctx.closePath();
  ctx.fillStyle = rGrad;
  ctx.fill();

  // ── Line segments coloured per value ──
  for (let i = 1; i < data.length; i++) {
    const col = data[i] >= 0 ? '#00a832' : '#cc0020';
    ctx.beginPath();
    ctx.moveTo(px(i-1), py(data[i-1]));
    ctx.lineTo(px(i),   py(data[i]));
    ctx.strokeStyle = col;
    ctx.lineWidth   = 2.5;
    ctx.lineJoin    = 'round';
    ctx.stroke();
  }

  // ── Entry price line (when trade active) ──
  if (tradeActive && entryPrice !== null) {
    const entryRate = entryPrice; // entryPrice is stored as the rate at entry
    const ey = py(entryRate);
    if (ey >= pT && ey <= pT + cH) {
      ctx.strokeStyle = direction === 'CALL' ? '#0066ff' : '#ff6600';
      ctx.lineWidth   = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(pL, ey); ctx.lineTo(W - pR, ey); ctx.stroke();
      ctx.setLineDash([]);
      // entry label
      const label = `Entry ${direction === 'CALL' ? '▲' : '▼'} ${entryRate.toFixed(4)}`;
      const lw = ctx.measureText(label).width + 12;
      ctx.fillStyle = direction === 'CALL' ? '#0066ff' : '#ff6600';
      ctx.beginPath();
      ctx.roundRect(pL + 4, ey - 11, lw, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px "DM Mono",monospace';
      ctx.textAlign = 'left';
      ctx.fillText(label, pL + 10, ey + 3);
    }
  }

  // ── Live dot ──
  const lx = px(data.length-1), ly = py(data[data.length-1]);
  const isUp = liveRate >= 0;
  const dotCol = isUp ? '#00c040' : '#e00020';
  [20, 12, 6].forEach((r, idx) => {
    ctx.beginPath(); ctx.arc(lx, ly, r, 0, Math.PI*2);
    ctx.fillStyle = isUp
      ? `rgba(0,192,64,${[0.10, 0.22, 1][idx]})`
      : `rgba(220,0,32,${[0.10, 0.22, 1][idx]})`;
    ctx.fill();
  });

  // ── Rate badge (white box, coloured text) ──
  const rateStr = 'Rate: ' + (liveRate >= 0 ? '+' : '') + liveRate.toFixed(4);
  const bW = 190, bH = 42, bX = W/2 - bW/2, bY = 4;
  ctx.fillStyle   = '#ffffff';
  ctx.strokeStyle = isUp ? '#00c040' : '#e00020';
  ctx.lineWidth   = 2.5;
  ctx.shadowColor = isUp ? 'rgba(0,192,64,0.25)' : 'rgba(220,0,32,0.25)';
  ctx.shadowBlur  = 10;
  ctx.beginPath(); ctx.roundRect(bX, bY, bW, bH, 8); ctx.fill(); ctx.stroke();
  ctx.shadowBlur  = 0;
  ctx.fillStyle   = isUp ? '#007a28' : '#b80018';
  ctx.font        = 'bold 18px "DM Mono",monospace';
  ctx.textAlign   = 'center';
  ctx.fillText(rateStr, bX + bW/2, bY + 27);

  // ── Time labels ──
  ctx.fillStyle   = '#aaa';
  ctx.font        = '9px "DM Mono",monospace';
  ctx.textAlign   = 'center';
  const now = new Date();
  for (let i = 0; i <= 4; i++) {
    const x  = pL + (cW/4)*i;
    const dt = new Date(now - (4-i)*20000);
    ctx.fillText(dt.toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit',second:'2-digit'}), x, pT+cH+26);
  }

  // ── Border ──
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth   = 1;
  ctx.strokeRect(pL, pT, cW, cH);
}

// ══════════════════════════════════════════════════════════════
export default function TradePage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const canvasRef  = useRef(null);
  const chatEndRef = useRef(null);
  const chartRef   = useRef([]);  // raw data array — no state lag

  // responsive
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileTab, setMobileTab] = useState('chart');
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  // demo
  const [demoMode,      setDemoMode]      = useState(false);
  const [demoBalance,   setDemoBalance]   = useState(10000);
  const [demoAssets,    setDemoAssets]    = useState(DEMO_ASSETS);
  const [demoHistory,   setDemoHistory]   = useState([]);
  const [demoPositions, setDemoPositions] = useState([]);

  // real
  const [assets,       setAssets]       = useState([]);
  const [signals,      setSignals]       = useState([]);
  const [sel,          setSel]           = useState(null);
  const [positions,    setPositions]     = useState([]);
  const [tradeHistory, setTradeHistory]  = useState([]);
  const [transactions, setTransactions]  = useState([]);
  const [stats,        setStats]         = useState(null);
  const [settings,     setSettings]      = useState(null);
  const [balance,      setBalance]       = useState(user?.balance || 0);

  // ui
  const [catFilter,    setCatFilter]    = useState('all');
  const [searchQ,      setSearchQ]      = useState('');
  const [activeTab,    setActiveTab]    = useState('trade');
  const [expiry,       setExpiry]       = useState(EXPIRY_OPTIONS[1]);
  const [stake,        setStake]        = useState(500);
  const [showDeposit,  setShowDeposit]  = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [tradingBusy,  setTradingBusy]  = useState(false);

  // chart
  const [liveRate,   setLiveRate]   = useState(0);
  const [chartTick,  setChartTick]  = useState(0); // triggers redraw

  // active trade overlay
  const [activeTrade, setActiveTrade] = useState(null);
  // { direction, entryRate, entryPrice, stake, expirySec, remainSec, potentialWin, result }

  // chat
  const [chatMsgs, setChatMsgs] = useState(() => {
    const s = [];
    for (let i = 0; i < 16; i++) s.push({ id: i, text: rMsg(), ts: Date.now()-(16-i)*5500 });
    return s;
  });

  const activeAssets    = demoMode ? demoAssets    : assets;
  const activeBalance   = demoMode ? demoBalance   : balance;
  const activePositions = demoMode ? demoPositions : positions;
  const activeHistory   = demoMode ? demoHistory   : tradeHistory;
  const selectedAsset   = sel ? activeAssets.find(a => a.id === sel.id) || sel : null;
  const payoutRate      = settings?.payoutRates?.[expiry.key] || 86;
  const potentialWin    = Math.round(stake * payoutRate / 100);

  // ── Seed chart ───────────────────────────────────────────────
  useEffect(() => {
    const seed = [];
    let v = 0;
    for (let i = 0; i < 120; i++) {
      v += (Math.random()-0.49)*0.005 + (Math.random()<0.08 ? Math.random()*0.07 : 0) + (Math.random()<0.05 ? -Math.random()*0.06 : 0);
      v  = Math.max(-0.11, Math.min(0.15, v));
      seed.push(parseFloat(v.toFixed(4)));
    }
    chartRef.current = seed;
    setLiveRate(seed[seed.length-1]);
    setChartTick(t => t+1);
  }, [sel]);

  // ── Animate chart ────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const prev = chartRef.current;
      const last = prev[prev.length-1] || 0;
      const spike = Math.random() < 0.09 ? Math.random() * 0.09 : 0;
      const crash = Math.random() < 0.06 ? -Math.random() * 0.08 : 0;
      let next = last + (Math.random()-0.49)*0.005 + spike + crash;
      next = Math.max(-0.12, Math.min(0.16, parseFloat(next.toFixed(4))));
      const nd = [...prev.slice(-159), next];
      chartRef.current = nd;
      setLiveRate(next);
      setChartTick(t => t+1);
    }, 280);
    return () => clearInterval(iv);
  }, []);

  // ── Draw chart ───────────────────────────────────────────────
  useEffect(() => {
    const tradeOverlay = activeTrade && activeTrade.result === 'ACTIVE';
    drawSpikeChart(
      canvasRef.current,
      chartRef.current,
      liveRate,
      tradeOverlay ? activeTrade.entryRate : null,
      tradeOverlay ? activeTrade.direction : null,
      tradeOverlay
    );
  }, [chartTick, activeTrade, liveRate]);

  // ── Live profit update while trade is active ─────────────────
  useEffect(() => {
    if (!activeTrade || activeTrade.result !== 'ACTIVE') return;
    const iv = setInterval(() => {
      setActiveTrade(prev => {
        if (!prev || prev.result !== 'ACTIVE') return prev;
        const rem = prev.remainSec - 1;
        // live P/L: if currently winning direction matches rate
        const currentlyWinning =
          (prev.direction === 'CALL' && liveRate > prev.entryRate) ||
          (prev.direction === 'PUT'  && liveRate < prev.entryRate);
        const livePnl = currentlyWinning ? prev.potentialWin : -prev.stake;
        if (rem <= 0) return { ...prev, remainSec: 0, livePnl, result: 'SETTLING' };
        return { ...prev, remainSec: rem, livePnl, currentlyWinning };
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [activeTrade, liveRate]);

  // ── Settle trade when timer hits 0 ───────────────────────────
  useEffect(() => {
    if (!activeTrade || activeTrade.result !== 'SETTLING') return;
    const finalRate = liveRate;
    const won =
      (activeTrade.direction === 'CALL' && finalRate > activeTrade.entryRate) ||
      (activeTrade.direction === 'PUT'  && finalRate < activeTrade.entryRate);
    const payout = won ? activeTrade.potentialWin : -activeTrade.stake;

    if (demoMode) {
      setDemoBalance(b => won ? b + activeTrade.stake + activeTrade.potentialWin : b);
      setDemoHistory(h => [{
        id: 'dm'+Date.now(), asset: selectedAsset?.name,
        direction: activeTrade.direction, stake: activeTrade.stake,
        result: won ? 'WIN' : 'LOSS', payout,
        expiryLabel: activeTrade.expiryLabel,
        entryRate: activeTrade.entryRate, exitRate: finalRate,
        settledAt: new Date().toISOString(),
      }, ...h.slice(0,49)]);
    } else {
      setBalance(b => won ? b + activeTrade.stake + activeTrade.potentialWin : b);
      setTradeHistory(h => [{
        id: 'rt'+Date.now(), asset: selectedAsset?.name,
        direction: activeTrade.direction, stake: activeTrade.stake,
        result: won ? 'WIN' : 'LOSS', payout,
        expiryLabel: activeTrade.expiryLabel,
        settledAt: new Date().toISOString(),
      }, ...h.slice(0,49)]);
    }

    setActiveTrade({ ...activeTrade, result: won ? 'WIN' : 'LOSS', payout, finalRate });
    toast(won
      ? `🎉 WIN! +KES ${activeTrade.potentialWin.toLocaleString()} — prediction correct!`
      : `❌ Loss KES ${activeTrade.stake.toLocaleString()} — better luck next time`,
      won ? 'success' : 'error');

    // Clear after 4s
    setTimeout(() => setActiveTrade(null), 4000);
  }, [activeTrade?.result]);

  // ── Chat ─────────────────────────────────────────────────────
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMsgs]);
  useEffect(() => {
    let t;
    const s = () => { t = setTimeout(() => { setChatMsgs(p => [...p, { id: Date.now(), text: rMsg(), ts: Date.now() }].slice(-80)); s(); }, 900 + Math.random()*2400); };
    s();
    return () => clearTimeout(t);
  }, []);

  // ── Load real data ────────────────────────────────────────────
  useEffect(() => {
    if (demoMode) return;
    settingsAPI.public().then(r => setSettings(r.data)).catch(() => {});
    userAPI.stats().then(r => { setStats(r.data); setBalance(r.data.balance); }).catch(() => {});
    userAPI.trades().then(r => setTradeHistory(r.data)).catch(() => {});
    userAPI.transactions().then(r => setTransactions(r.data)).catch(() => {});
    marketAPI.signals().then(r => setSignals(r.data)).catch(() => {});
  }, [demoMode]);

  useEffect(() => {
    if (demoMode) return;
    const load = () => marketAPI.assets().then(r => {
      setAssets(r.data);
      if (!sel && r.data.length) setSel(r.data[0]);
    }).catch(() => {});
    load();
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, [sel, demoMode]);

  useEffect(() => {
    if (!demoMode) return;
    if (!sel) setSel(DEMO_ASSETS[0]);
    const iv = setInterval(() => setDemoAssets(p => tickAssets(p)), 1500);
    return () => clearInterval(iv);
  }, [demoMode, sel]);

  // ── Position timer (real API positions) ─────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const tick = p => p.map(x => ({ ...x, elapsedSec: Math.min((x.elapsedSec||0)+1, x.totalSec||x.expirySec||300) }));
      if (demoMode) setDemoPositions(tick); else setPositions(tick);
    }, 1000);
    return () => clearInterval(iv);
  }, [demoMode]);

  // ── Place trade (client-side settlement for demo + real) ─────
  const placeTrade = (direction) => {
    if (activeTrade && activeTrade.result === 'ACTIVE') {
      toast('A trade is already running. Wait for it to settle.', 'error');
      return;
    }
    if (stake < (settings?.minStake || 50)) {
      toast(`Min stake is KES ${settings?.minStake || 50}`, 'error'); return;
    }
    if (stake > activeBalance) {
      toast('Insufficient balance. Please deposit.', 'error'); return;
    }

    const entryRate  = liveRate;
    const assetPrice = selectedAsset?.price || 0;
    const stakeAmt   = stake;
    const expiryOpt  = expiry;
    const pWin       = Math.round(stakeAmt * payoutRate / 100);

    // Deduct balance immediately
    if (demoMode) setDemoBalance(b => b - stakeAmt);
    else          setBalance(b => b - stakeAmt);

    // Set active trade overlay
    setActiveTrade({
      direction,
      entryRate,
      entryPrice: assetPrice,
      stake: stakeAmt,
      expirySec: expiryOpt.sec,
      expiryLabel: expiryOpt.key,
      remainSec: expiryOpt.sec,
      potentialWin: pWin,
      livePnl: 0,
      currentlyWinning: false,
      result: 'ACTIVE',
    });

    toast(`${direction} placed — KES ${stakeAmt.toLocaleString()} · ${expiryOpt.label} · ${payoutRate}% payout`, 'info');

    // Also call real API for server-side record
    if (!demoMode) {
      tradeAPI.place({
        asset: selectedAsset?.name, direction,
        stake: stakeAmt, expirySec: expiryOpt.sec,
        expiryLabel: expiryOpt.key, entryPrice: assetPrice,
      }).catch(() => {});
    }
  };

  // ── Deposit / withdraw ────────────────────────────────────────
  const onDepositSuccess  = amt => { setBalance(b => b+amt); setShowDeposit(false); toast(`KES ${amt.toLocaleString()} credited`, 'success'); userAPI.transactions().then(r=>setTransactions(r.data)).catch(()=>{}); };
  const onWithdrawSuccess = amt => { setBalance(b => b-amt); setShowWithdraw(false); toast('Withdrawal submitted','info'); userAPI.transactions().then(r=>setTransactions(r.data)).catch(()=>{}); };

  const filteredAssets = activeAssets.filter(a => {
    if (catFilter !== 'all' && a.cat !== catFilter) return false;
    if (searchQ && !a.name.toLowerCase().includes(searchQ.toLowerCase()) && !a.sub.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  const cats      = ['all','forex','crypto','nse','comm'];
  const catLabels = { all:'All', forex:'FX', crypto:'Crypto', nse:'NSE', comm:'Comm' };
  const isUp      = liveRate >= 0;

  // ── CSS vars for light theme ──────────────────────────────────
  const C = {
    bg:      '#f4f6fa',
    surface: '#ffffff',
    surface2:'#f0f2f7',
    border:  '#e0e4ee',
    border2: '#c8d0e0',
    text:    '#1a2035',
    muted:   '#6b7a99',
    muted2:  '#a0aac0',
    green:   '#00a832',
    greenBg: 'rgba(0,168,50,0.10)',
    red:     '#cc0020',
    redBg:   'rgba(204,0,32,0.10)',
    gold:    '#c07800',
    goldBg:  'rgba(192,120,0,0.10)',
    blue:    '#0055cc',
    blueBg:  'rgba(0,85,204,0.10)',
    callBtn: 'linear-gradient(135deg,#008c3a,#00cc4e)',
    putBtn:  'linear-gradient(135deg,#cc0020,#ff2240)',
    header:  '#1a2035',
    headerTxt: '#ffffff',
  };

  // ── Sub-components ────────────────────────────────────────────
  const AssetList = () => (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <div style={{ padding:'8px', borderBottom:`1px solid ${C.border}` }}>
        <input placeholder="Search market…" value={searchQ} onChange={e=>setSearchQ(e.target.value)}
          style={{ width:'100%', background:C.surface2, border:`1px solid ${C.border}`, borderRadius:6, padding:'7px 10px', color:C.text, fontSize:12, outline:'none' }}/>
      </div>
      <div style={{ display:'flex', gap:4, padding:'6px 8px', borderBottom:`1px solid ${C.border}`, flexWrap:'wrap' }}>
        {cats.map(c => (
          <button key={c} onClick={()=>setCatFilter(c)}
            style={{ fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:20, cursor:'pointer', border:'1px solid',
              borderColor: catFilter===c ? C.blue : C.border,
              color: catFilter===c ? C.blue : C.muted,
              background: catFilter===c ? C.blueBg : 'transparent' }}>
            {catLabels[c]}
          </button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:'auto' }}>
        {filteredAssets.map(a => {
          const isSel = sel?.id === a.id;
          return (
            <div key={a.id} onClick={() => { setSel(a); if(isMobile) setMobileTab('chart'); }}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 10px',
                borderBottom:`1px solid ${C.border}`, cursor:'pointer',
                background: isSel ? C.blueBg : 'transparent',
                borderLeft: isSel ? `3px solid ${C.blue}` : '3px solid transparent' }}>
              <div style={{ width:30, height:30, borderRadius:7, background:ASSET_COLORS[a.cat]||'#1a2035', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>{a.icon}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{a.name}</div>
                <div style={{ fontSize:10, color:C.muted2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.sub}</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontFamily:'monospace', fontSize:11, color:C.text, fontWeight:600 }}>{fmtPrice(a.price)}</div>
                <div style={{ fontSize:10, fontWeight:700, color:a.chg>=0 ? C.green : C.red }}>{a.chg>=0?'+':''}{a.chg.toFixed(2)}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const ChatPanel = () => (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#fff' }}>
      <div style={{ padding:'10px 14px', background:'#00a832', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        <span style={{ fontSize:16 }}>💬</span>
        <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Live Chat</span>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5 }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background:'#7eff7e' }}/>
          <span style={{ fontSize:10, color:'rgba(255,255,255,0.8)', fontWeight:600 }}>{Math.floor(130+Math.random()*60)} online</span>
        </div>
      </div>
      <div style={{ flex:1, overflowY:'auto', background:'#fafafa' }}>
        {chatMsgs.map(m => {
          const isSys  = m.text.startsWith('System:');
          const isWin  = m.text.includes('won') || m.text.includes('WIN') || m.text.includes('CONGRATULATIONS');
          const isCash = m.text.includes('withdrew') || m.text.includes('cashed') || m.text.includes('withdrawal') || m.text.includes('BONUS');
          const colonIdx = m.text.indexOf(':');
          const hasColon = colonIdx > 0 && colonIdx < 25;
          let nc = isSys ? '#cc4400' : isWin ? '#007a20' : isCash ? '#0044aa' : '#444';
          let mc = isSys ? '#993300' : isWin ? '#005010' : isCash ? '#003080' : '#555';
          return (
            <div key={m.id} style={{ padding:'6px 12px', borderBottom:`1px solid ${C.border}`, lineHeight:1.5, fontSize:12 }}>
              {hasColon ? (
                <><span style={{ fontWeight:800, color:nc }}>{m.text.slice(0,colonIdx)}:</span>
                  <span style={{ color:mc }}>{m.text.slice(colonIdx+1)}</span></>
              ) : <span style={{ color:mc }}>{m.text}</span>}
            </div>
          );
        })}
        <div ref={chatEndRef}/>
      </div>
    </div>
  );

  // ── Active trade banner ───────────────────────────────────────
  const ActiveTradeBanner = () => {
    if (!activeTrade) return null;
    const { direction, remainSec, stake: s, potentialWin, livePnl, currentlyWinning, result, payout } = activeTrade;

    if (result === 'WIN' || result === 'LOSS') {
      return (
        <div style={{ padding:'14px 18px', background: result==='WIN' ? '#e8fff0' : '#fff0f2',
          border:`2px solid ${result==='WIN' ? C.green : C.red}`,
          borderRadius:12, margin:'10px 16px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <span style={{ fontSize:28 }}>{result==='WIN' ? '🎉' : '😔'}</span>
          <div>
            <div style={{ fontSize:16, fontWeight:900, color: result==='WIN' ? C.green : C.red }}>
              {result==='WIN' ? `YOU WIN! +KES ${potentialWin.toLocaleString()}` : `LOSS — KES ${s.toLocaleString()}`}
            </div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
              Prediction: {direction} · Entry Rate: {activeTrade.entryRate.toFixed(4)} · Final: {activeTrade.finalRate?.toFixed(4)}
            </div>
          </div>
        </div>
      );
    }

    const progress = ((activeTrade.expirySec - remainSec) / activeTrade.expirySec) * 100;
    return (
      <div style={{ padding:'12px 16px', background: currentlyWinning ? '#e8fff0' : '#fff4f4',
        borderTop:`3px solid ${currentlyWinning ? C.green : C.red}`,
        borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:8 }}>
          {/* Direction badge */}
          <div style={{ display:'flex', alignItems:'center', gap:6, background: direction==='CALL' ? C.greenBg : C.redBg,
            border:`1.5px solid ${direction==='CALL' ? C.green : C.red}`,
            borderRadius:8, padding:'6px 14px' }}>
            <span style={{ fontSize:20 }}>{direction==='CALL' ? '▲' : '▼'}</span>
            <div>
              <div style={{ fontSize:13, fontWeight:900, color: direction==='CALL' ? C.green : C.red }}>{direction}</div>
              <div style={{ fontSize:10, color:C.muted }}>KES {s.toLocaleString()}</div>
            </div>
          </div>
          {/* Countdown */}
          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:'monospace', fontSize:28, fontWeight:900,
              color: remainSec <= 10 ? C.red : C.text, lineHeight:1 }}>
              {fmtCountdown(remainSec)}
            </div>
            <div style={{ fontSize:10, color:C.muted }}>remaining</div>
          </div>
          {/* Live P/L */}
          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:'monospace', fontSize:22, fontWeight:900,
              color: livePnl >= 0 ? C.green : C.red, lineHeight:1 }}>
              {livePnl >= 0 ? '+' : ''}{livePnl?.toLocaleString?.() ?? 0}
            </div>
            <div style={{ fontSize:10, color:C.muted }}>live P/L (KES)</div>
          </div>
          {/* Status */}
          <div style={{ marginLeft:'auto', textAlign:'right' }}>
            <div style={{ fontSize:13, fontWeight:800, color: currentlyWinning ? C.green : C.red }}>
              {currentlyWinning ? '✅ Winning' : '❌ Losing'}
            </div>
            <div style={{ fontSize:11, color:C.muted }}>
              Current rate: <span style={{ fontFamily:'monospace', fontWeight:700, color: isUp ? C.green : C.red }}>
                {liveRate >= 0 ? '+' : ''}{liveRate.toFixed(4)}
              </span>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height:6, background:C.border, borderRadius:3, overflow:'hidden' }}>
          <div style={{ width:`${progress}%`, height:'100%', borderRadius:3,
            background: currentlyWinning
              ? `linear-gradient(90deg,${C.green},#00e055)`
              : `linear-gradient(90deg,${C.red},#ff4060)`,
            transition:'width 1s linear' }}/>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, fontSize:10, color:C.muted2 }}>
          <span>Entry: {activeTrade.entryRate.toFixed(4)}</span>
          <span>Potential win: KES {potentialWin.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  // ── Trade controls ────────────────────────────────────────────
  const TradeControls = ({ compact = false }) => (
    <div style={{ background:C.surface, borderTop:`2px solid ${C.border}`, padding: compact ? '10px 12px' : '14px 18px', flexShrink:0 }}>
      {/* Expiry */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10, flexWrap:'wrap' }}>
        <span style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:1.5, color:C.muted, flexShrink:0 }}>EXPIRY</span>
        {EXPIRY_OPTIONS.map(o => (
          <button key={o.key} onClick={() => setExpiry(o)}
            style={{ fontSize:10, fontWeight:700, padding:'5px 12px', borderRadius:20, cursor:'pointer', border:'1.5px solid',
              borderColor: expiry.key===o.key ? C.blue : C.border,
              color: expiry.key===o.key ? C.blue : C.muted,
              background: expiry.key===o.key ? C.blueBg : C.surface2,
              transition:'all .12s' }}>
            {o.label}
          </button>
        ))}
        <div style={{ marginLeft:'auto', fontFamily:'monospace', fontSize:11,
          background:C.goldBg, border:`1px solid ${C.gold}44`, borderRadius:6,
          padding:'4px 10px', color:C.gold, fontWeight:700, flexShrink:0 }}>
          {payoutRate}% payout
        </div>
      </div>
      {/* Stake */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        <span style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:1.5, color:C.muted, flexShrink:0 }}>STAKE</span>
        <div style={{ display:'flex', alignItems:'center', gap:5, background:C.surface2, border:`2px solid ${C.border2}`, borderRadius:8, padding:'6px 12px' }}>
          <span style={{ fontSize:11, fontWeight:700, color:C.muted }}>KES</span>
          <input type="number" value={stake} onChange={e=>setStake(Number(e.target.value))} min={50}
            style={{ border:'none', background:'transparent', fontFamily:'monospace', fontSize:16, fontWeight:700, width:85, padding:0, color:C.text, outline:'none' }}/>
        </div>
        {[500,1000,2000,5000].map(v => (
          <button key={v} onClick={() => setStake(v)}
            style={{ fontSize:10, fontWeight:700, padding:'5px 10px', borderRadius:7, cursor:'pointer',
              background: stake===v ? C.blueBg : C.surface2,
              border:`1px solid ${stake===v ? C.blue : C.border}`,
              color: stake===v ? C.blue : C.muted, transition:'all .12s' }}>
            {v>=1000 ? `${v/1000}K` : v}
          </button>
        ))}
        <div style={{ marginLeft:'auto', textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:9, color:C.muted2 }}>Est. return</div>
          <div style={{ fontFamily:'monospace', fontSize:14, fontWeight:700, color:C.green }}>+KES {potentialWin.toLocaleString()}</div>
        </div>
      </div>
      {/* Buttons */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <button onClick={() => placeTrade('CALL')}
          disabled={tradingBusy || (!demoMode && settings?.tradingEnabled===false) || (activeTrade?.result==='ACTIVE')}
          style={{ padding: compact ? '14px 8px' : '18px 8px', border:'none', borderRadius:10,
            background: activeTrade?.result==='ACTIVE' ? '#ccc' : C.callBtn,
            color:'#fff', fontWeight:900, fontSize: compact ? 14 : 16, cursor:'pointer',
            boxShadow: activeTrade?.result==='ACTIVE' ? 'none' : '0 4px 20px rgba(0,168,50,0.35)',
            lineHeight:1.3, transition:'all .15s' }}>
          ▲ CALL (UP)<br/><span style={{ fontSize:10, fontWeight:500, opacity:.8 }}>Price will rise</span>
        </button>
        <button onClick={() => placeTrade('PUT')}
          disabled={tradingBusy || (!demoMode && settings?.tradingEnabled===false) || (activeTrade?.result==='ACTIVE')}
          style={{ padding: compact ? '14px 8px' : '18px 8px', border:'none', borderRadius:10,
            background: activeTrade?.result==='ACTIVE' ? '#ccc' : C.putBtn,
            color:'#fff', fontWeight:900, fontSize: compact ? 14 : 16, cursor:'pointer',
            boxShadow: activeTrade?.result==='ACTIVE' ? 'none' : '0 4px 20px rgba(204,0,32,0.35)',
            lineHeight:1.3, transition:'all .15s' }}>
          ▼ PUT (DOWN)<br/><span style={{ fontSize:10, fontWeight:500, opacity:.8 }}>Price will fall</span>
        </button>
      </div>
      {activeTrade?.result==='ACTIVE' && (
        <div style={{ marginTop:8, textAlign:'center', fontSize:11, color:C.muted, fontStyle:'italic' }}>
          Trade running — wait for settlement to place next trade
        </div>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:C.bg, color:C.text, overflow:'hidden', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <style>{`
        @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        *{box-sizing:border-box;}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:${C.surface2};}
        ::-webkit-scrollbar-thumb{background:${C.border2};border-radius:4px;}
        button:active{transform:scale(.97);}
        button:disabled{cursor:not-allowed!important;}
      `}</style>

      {/* ── HEADER ─────────────────────────────────────── */}
      <header style={{ height: isMobile ? 52 : 58, background:C.header, display:'flex', alignItems:'center',
        padding:`0 ${isMobile?'12px':'20px'}`, gap:12, flexShrink:0, zIndex:20,
        boxShadow:'0 2px 12px rgba(0,0,0,0.18)' }}>
        <div style={{ fontWeight:900, fontSize: isMobile?15:20, letterSpacing:'-0.5px', color:'#fff', flexShrink:0 }}>
          Trade<span style={{ color:'#00e055' }}>Flow</span><span style={{ color:'#4d9ef7', fontSize: isMobile?11:14 }}> Pro</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background: demoMode?'#f5a623':'#00e055', boxShadow:`0 0 8px ${demoMode?'#f5a623':'#00e055'}` }}/>
          <span style={{ fontSize:9, color: demoMode?'#f5a623':'#00e055', fontWeight:800, letterSpacing:1.5 }}>{demoMode?'DEMO':'LIVE'}</span>
        </div>
        {settings?.announcement && !demoMode && !isMobile && (
          <div style={{ flex:1, background:'rgba(245,166,35,0.15)', border:'1px solid rgba(245,166,35,.3)', borderRadius:5, padding:'3px 10px', fontSize:11, color:'#f5a623', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            📢 {settings.announcement}
          </div>
        )}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap: isMobile?6:10 }}>
          {/* Balance chip */}
          <div style={{ background:'rgba(255,255,255,0.10)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, padding: isMobile?'3px 8px':'5px 14px', flexShrink:0 }}>
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.6)', fontWeight:700, textTransform:'uppercase', letterSpacing:1 }}>{demoMode?'Demo Bal':'Balance'}</div>
            <div style={{ fontFamily:'monospace', fontSize: isMobile?12:15, fontWeight:700, color: demoMode?'#7eff7e':'#f5c842' }}>
              KES {(demoMode?demoBalance:balance).toLocaleString()}
            </div>
          </div>
          {/* Demo toggle */}
          {!demoMode && (
            <button onClick={() => { setDemoMode(true); setSel(DEMO_ASSETS[0]); toast('Demo mode — KES 10,000 virtual','info'); }}
              style={{ height: isMobile?30:34, padding:`0 ${isMobile?'8px':'12px'}`, borderRadius:7,
                border:'1px solid rgba(255,255,255,0.25)', background:'rgba(255,255,255,0.10)',
                color:'rgba(255,255,255,0.8)', fontWeight:700, fontSize: isMobile?9:11, cursor:'pointer', flexShrink:0 }}>
              🎮 {isMobile?'Demo':'Demo Mode'}
            </button>
          )}
          {demoMode && (
            <>
              <button onClick={() => { setDemoBalance(10000); setDemoHistory([]); setDemoPositions([]); setActiveTrade(null); toast('Demo reset','info'); }}
                style={{ height: isMobile?30:34, padding:`0 ${isMobile?'7px':'10px'}`, borderRadius:7,
                  border:'1px solid rgba(0,255,85,0.4)', background:'rgba(0,255,85,0.12)',
                  color:'#7eff7e', fontWeight:700, fontSize: isMobile?9:11, cursor:'pointer', flexShrink:0 }}>
                ↺ {isMobile?'':'Reset'}
              </button>
              <button onClick={() => { setDemoMode(false); setSel(assets[0]||null); setActiveTrade(null); }}
                style={{ height: isMobile?30:34, padding:`0 ${isMobile?'8px':'12px'}`, borderRadius:7,
                  border:'none', background:'#00e055', color:'#001a00',
                  fontWeight:800, fontSize: isMobile?9:11, cursor:'pointer', flexShrink:0 }}>
                → {isMobile?'Live':'Go Live'}
              </button>
            </>
          )}
          {!isMobile && !demoMode && (
            <>
              <button onClick={() => setShowDeposit(true)}
                style={{ height:34, padding:'0 14px', borderRadius:7, border:'none', background:'#00e055', color:'#001a00', fontWeight:800, fontSize:12, cursor:'pointer' }}>
                📱 Deposit
              </button>
              <button onClick={() => setShowWithdraw(true)}
                style={{ height:34, padding:'0 12px', borderRadius:7, border:'1px solid rgba(245,166,35,0.5)', background:'rgba(245,166,35,0.12)', color:'#f5c842', fontWeight:700, fontSize:11, cursor:'pointer' }}>
                💸 Withdraw
              </button>
            </>
          )}
          {isMobile && !demoMode && (
            <button onClick={() => setShowDeposit(true)}
              style={{ height:30, padding:'0 10px', borderRadius:7, border:'none', background:'#00e055', color:'#001a00', fontWeight:800, fontSize:10, cursor:'pointer', flexShrink:0 }}>
              📱 Dep
            </button>
          )}
          <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#3a6cf4,#00e055)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, cursor:'pointer', color:'#fff', flexShrink:0 }}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          {!isMobile && (
            <button onClick={logout}
              style={{ height:32, padding:'0 10px', borderRadius:6, border:'1px solid rgba(255,255,255,0.2)', background:'transparent', color:'rgba(255,255,255,0.6)', fontSize:11, fontWeight:600, cursor:'pointer' }}>
              Sign Out
            </button>
          )}
        </div>
      </header>

      {/* Demo banner */}
      {demoMode && (
        <div style={{ background:'#fffbe6', borderBottom:`2px solid #f5a623`, padding:'6px 16px',
          display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, gap:8 }}>
          <span style={{ fontSize: isMobile?10:12 }}>🎮 <strong style={{ color:'#c07800' }}>Demo Mode</strong> <span style={{ color:'#888' }}>— Practice with KES 10,000 virtual. No real money at risk.</span></span>
          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
            {isMobile && <>
              <button onClick={() => setShowDeposit(true)} style={{ height:26, padding:'0 8px', borderRadius:5, border:'none', background:'#00a832', color:'#fff', fontWeight:800, fontSize:10, cursor:'pointer' }}>Deposit</button>
              <button onClick={() => setShowWithdraw(true)} style={{ height:26, padding:'0 8px', borderRadius:5, border:`1px solid #c07800`, background:'transparent', color:'#c07800', fontWeight:700, fontSize:10, cursor:'pointer' }}>Withdraw</button>
            </>}
            <button onClick={() => { setDemoMode(false); setSel(assets[0]||null); }}
              style={{ height:26, padding:'0 10px', borderRadius:5, border:`1px solid #c07800`, background:'#fffbe6', color:'#c07800', fontWeight:700, fontSize:10, cursor:'pointer' }}>
              → Live
            </button>
          </div>
        </div>
      )}

      {/* Nav tabs */}
      <div style={{ display:'flex', background:C.surface, borderBottom:`1px solid ${C.border}`, padding:`0 ${isMobile?'4px':'16px'}`, flexShrink:0, overflowX:'auto', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
        {[['trade','📈 Trade'],['signals','⚡ Signals'],['history','📋 History'],...(!demoMode?[['wallet','💳 Wallet']]:[]),['stats','📊 Stats']].map(([k,l]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            style={{ padding: isMobile?'10px 10px':'11px 18px', background:'transparent', border:'none',
              borderBottom:`3px solid ${activeTab===k ? C.blue : 'transparent'}`,
              color: activeTab===k ? C.blue : C.muted, fontWeight:700, fontSize: isMobile?10:12,
              cursor:'pointer', whiteSpace:'nowrap', letterSpacing:.3 }}>
            {isMobile ? l.split(' ')[0] : l}
          </button>
        ))}
        {isMobile && !demoMode && (
          <button onClick={() => setShowWithdraw(true)}
            style={{ marginLeft:'auto', padding:'10px 10px', background:'transparent', border:'none', borderBottom:'3px solid transparent', color:C.gold, fontWeight:700, fontSize:10, cursor:'pointer', whiteSpace:'nowrap' }}>
            💸 Out
          </button>
        )}
      </div>

      {/* Ticker */}
      <div style={{ overflow:'hidden', background:C.header, borderBottom:`1px solid rgba(255,255,255,0.08)`, flexShrink:0, height:28, display:'flex', alignItems:'center' }}>
        <div style={{ display:'flex', whiteSpace:'nowrap', animation:'marquee 45s linear infinite', willChange:'transform' }}>
          {[...activeAssets,...activeAssets].map((a,i) => (
            <span key={i} onClick={() => setSel(a)}
              style={{ fontFamily:'monospace', fontSize:10, padding:'0 16px', display:'inline-flex', alignItems:'center', gap:5, borderRight:'1px solid rgba(255,255,255,0.08)', cursor:'pointer', flexShrink:0 }}>
              <span style={{ color:'rgba(255,255,255,0.45)' }}>{a.name}</span>
              <span style={{ color:'rgba(255,255,255,0.75)', fontWeight:600 }}>{fmtPrice(a.price)}</span>
              <span style={{ color: a.chg>=0 ? '#00e055' : '#ff4455', fontWeight:700 }}>{a.chg>=0?'▲':'▼'}{Math.abs(a.chg).toFixed(2)}%</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── CONTENT ──────────────────────────────────────── */}
      <div style={{ flex:1, overflow:'hidden', minHeight:0 }}>

        {/* TRADE TAB */}
        {activeTab === 'trade' && (
          <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>

            {/* Asset list — desktop */}
            {!isMobile && (
              <div style={{ width:220, flexShrink:0, borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column', overflow:'hidden', background:C.surface }}>
                <AssetList/>
              </div>
            )}

            {/* Center */}
            <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

              {/* Mobile sub-tabs */}
              {isMobile && (
                <div style={{ display:'flex', background:C.surface2, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
                  {[['chart','📈 Chart'],['assets','🌐 Markets'],['chat','💬 Chat']].map(([k,l]) => (
                    <button key={k} onClick={() => setMobileTab(k)}
                      style={{ flex:1, padding:'8px 4px', background:'transparent', border:'none',
                        borderBottom:`2px solid ${mobileTab===k ? C.blue : 'transparent'}`,
                        color: mobileTab===k ? C.blue : C.muted, fontWeight:700, fontSize:10, cursor:'pointer' }}>
                      {l}
                    </button>
                  ))}
                </div>
              )}

              {isMobile && mobileTab==='assets' && <div style={{ flex:1, overflow:'hidden', background:C.surface }}><AssetList/></div>}
              {isMobile && mobileTab==='chat'   && <div style={{ flex:1, overflow:'hidden' }}><ChatPanel/></div>}

              {(!isMobile || mobileTab==='chart') && (
                <>
                  {/* Asset header */}
                  {selectedAsset && (
                    <div style={{ padding: isMobile?'8px 12px':'10px 18px', borderBottom:`1px solid ${C.border}`,
                      flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between',
                      background:C.surface, flexWrap:'wrap', gap:8,
                      boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:34, height:34, borderRadius:9, background:ASSET_COLORS[selectedAsset.cat]||'#1a2035',
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                          {selectedAsset.icon}
                        </div>
                        <div>
                          <div style={{ fontSize: isMobile?14:18, fontWeight:900, color:C.text }}>{selectedAsset.name}</div>
                          <div style={{ fontSize:10, color:C.muted2 }}>{selectedAsset.sub} {demoMode?'· DEMO':'· Live'}</div>
                        </div>
                        <div style={{ marginLeft: isMobile?8:16 }}>
                          <div style={{ fontFamily:'monospace', fontSize: isMobile?18:24, fontWeight:700,
                            color: selectedAsset.chg>=0 ? C.green : C.red, lineHeight:1 }}>
                            {fmtPrice(selectedAsset.price)}
                          </div>
                          <div style={{ fontSize:11, fontWeight:700, color: selectedAsset.chg>=0 ? C.green : C.red, marginTop:2 }}>
                            {selectedAsset.chg>=0?'▲ +':'▼ '}{Math.abs(selectedAsset.chg).toFixed(2)}% today
                          </div>
                        </div>
                      </div>
                      {!isMobile && (
                        <div style={{ display:'flex', gap:20 }}>
                          {[['H',(selectedAsset.price*1.005).toFixed(3),C.green],['L',(selectedAsset.price*0.995).toFixed(3),C.red],['Vol',selectedAsset.vol,C.blue]].map(([l,v,c]) => (
                            <div key={l} style={{ textAlign:'right' }}>
                              <div style={{ fontSize:9, color:C.muted2, fontWeight:700 }}>{l}</div>
                              <div style={{ fontFamily:'monospace', fontSize:12, color:c, fontWeight:700 }}>{v}</div>
                            </div>
                          ))}
                          {/* Current rate display */}
                          <div style={{ textAlign:'right', padding:'4px 12px', background: isUp ? C.greenBg : C.redBg, border:`1px solid ${isUp ? C.green : C.red}22`, borderRadius:8 }}>
                            <div style={{ fontSize:9, color:C.muted2, fontWeight:700 }}>RATE</div>
                            <div style={{ fontFamily:'monospace', fontSize:14, fontWeight:900, color: isUp ? C.green : C.red }}>
                              {liveRate >= 0 ? '+' : ''}{liveRate.toFixed(4)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Active trade banner */}
                  <ActiveTradeBanner/>

                  {/* CHART — large and bright */}
                  <div style={{ flex:1, overflow:'hidden', position:'relative', background:'#ffffff',
                    minHeight: isMobile ? 220 : 280, border:`1px solid ${C.border}`,
                    boxShadow:'inset 0 0 0 1px rgba(0,0,0,0.04)' }}>
                    <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }}/>
                  </div>

                  {/* Trade controls */}
                  <TradeControls compact={isMobile}/>
                </>
              )}
            </div>

            {/* Right panel — desktop */}
            {!isMobile && (
              <div style={{ width:240, flexShrink:0, borderLeft:`1px solid ${C.border}`, display:'flex', flexDirection:'column', overflow:'hidden', background:C.surface }}>
                {/* Positions */}
                <div style={{ borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
                  <div style={{ padding:'9px 12px', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:1.5, color:C.muted, borderBottom:`1px solid ${C.border}` }}>
                    Open Positions {demoMode && <span style={{ color:C.gold }}>· DEMO</span>}
                  </div>
                  <div style={{ maxHeight:160, overflowY:'auto' }}>
                    {activeTrade?.result==='ACTIVE' ? (
                      <div style={{ padding:'10px 12px', borderBottom:`1px solid ${C.border}` }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                          <span style={{ fontSize:12, fontWeight:700, color:C.text }}>{selectedAsset?.name}</span>
                          <span style={{ fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:20,
                            background: activeTrade.direction==='CALL' ? C.greenBg : C.redBg,
                            color: activeTrade.direction==='CALL' ? C.green : C.red }}>
                            {activeTrade.direction}
                          </span>
                        </div>
                        <div style={{ fontFamily:'monospace', fontSize:11, color:C.muted }}>KES {activeTrade.stake?.toLocaleString()}</div>
                        <div style={{ fontFamily:'monospace', fontSize:20, fontWeight:900, color: activeTrade.currentlyWinning ? C.green : C.red, marginTop:2 }}>
                          {fmtCountdown(activeTrade.remainSec)}
                        </div>
                        <div style={{ fontFamily:'monospace', fontSize:13, fontWeight:700, color: (activeTrade.livePnl||0)>=0 ? C.green : C.red }}>
                          {(activeTrade.livePnl||0)>=0?'+':''}{(activeTrade.livePnl||0).toLocaleString()} KES
                        </div>
                        <div style={{ height:3, background:C.border, borderRadius:2, marginTop:6 }}>
                          <div style={{ width:`${Math.round(((activeTrade.expirySec-activeTrade.remainSec)/activeTrade.expirySec)*100)}%`,
                            height:'100%', background: activeTrade.currentlyWinning ? C.green : C.red,
                            borderRadius:2, transition:'width 1s linear' }}/>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding:'16px 12px', textAlign:'center', fontSize:11, color:C.muted2 }}>No open positions</div>
                    )}
                  </div>
                </div>
                {/* Mini stats */}
                <div style={{ padding:'8px 10px', borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    {(demoMode ? [
                      ['Demo Bal', `${demoBalance.toLocaleString()}`, C.gold],
                      ['Trades',   demoHistory.length, C.text],
                      ['Wins',     demoHistory.filter(t=>t.result==='WIN').length, C.green],
                      ['Win%',     demoHistory.length>0 ? `${Math.round(demoHistory.filter(t=>t.result==='WIN').length/demoHistory.length*100)}%` : '—', C.blue],
                    ] : [
                      ['Win Rate', stats ? `${stats.winRate}%` : '—', stats?.winRate>50 ? C.green : C.text],
                      ['Today',    stats ? `${stats.todayPL>=0?'+':''}${(stats.todayPL||0).toLocaleString()}` : '—', (stats?.todayPL||0)>=0 ? C.green : C.red],
                      ['Trades',   stats?.tradeCount ?? '—', C.text],
                      ['Profit',   stats ? fmtKES(stats.totalProfit) : '—', C.green],
                    ]).map(([l,v,c]) => (
                      <div key={l} style={{ background:C.surface2, borderRadius:6, padding:'7px 9px', border:`1px solid ${C.border}` }}>
                        <div style={{ fontSize:8, textTransform:'uppercase', letterSpacing:.8, color:C.muted2, marginBottom:2 }}>{l}</div>
                        <div style={{ fontFamily:'monospace', fontSize:13, fontWeight:700, color:c }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Chat */}
                <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', minHeight:0 }}>
                  <ChatPanel/>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SIGNALS */}
        {activeTab==='signals' && (
          <div style={{ padding: isMobile?12:24, overflowY:'auto', height:'100%' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ fontSize: isMobile?14:18, fontWeight:800, color:C.text }}>⚡ AI Prediction Signals</div>
              <button onClick={() => marketAPI.signals().then(r=>setSignals(r.data)).catch(()=>{})}
                style={{ padding:'6px 14px', borderRadius:7, border:`1px solid ${C.border2}`, background:C.surface, color:C.blue, fontWeight:700, fontSize:11, cursor:'pointer' }}>
                ↻ Refresh
              </button>
            </div>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
              {signals.length===0 && <div style={{ padding:30, textAlign:'center', color:C.muted, fontSize:13 }}>Loading signals…</div>}
              {signals.map(s => (
                <div key={s.assetId} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 16px', borderBottom:`1px solid ${C.border}`, flexWrap:'wrap' }}>
                  <div style={{ width:36, height:36, borderRadius:9, background:ASSET_COLORS[s.cat]||'#1a2035', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>{s.icon}</div>
                  <div style={{ flex:1, minWidth:120 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{s.name}</div>
                    <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>{s.conf}% confidence · RSI: {s.rsi} · {s.trend}</div>
                    <div style={{ height:5, background:C.border, borderRadius:3 }}>
                      <div style={{ width:`${s.conf}%`, height:'100%', borderRadius:3, background: s.direction==='CALL' ? C.green : C.red }}/>
                    </div>
                  </div>
                  <span style={{ fontSize:12, fontWeight:800, padding:'5px 16px', borderRadius:20,
                    background: s.direction==='CALL' ? C.greenBg : C.redBg,
                    color: s.direction==='CALL' ? C.green : C.red,
                    border:`1.5px solid ${s.direction==='CALL' ? C.green : C.red}44`, flexShrink:0 }}>
                    {s.direction}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop:12, padding:'12px 16px', background:'#fffbe6', borderRadius:8, border:`1px solid #f5a62344`, fontSize:11, color:'#888', lineHeight:1.6 }}>
              ⚠️ Signals use RSI, MA & momentum. Not guaranteed. Trade responsibly.
            </div>
          </div>
        )}

        {/* HISTORY */}
        {activeTab==='history' && (
          <div style={{ padding: isMobile?10:24, overflowY:'auto', height:'100%' }}>
            <div style={{ fontSize: isMobile?14:18, fontWeight:800, color:C.text, marginBottom:16 }}>
              Trade History {demoMode && <span style={{ color:C.green, fontSize:12 }}>[DEMO]</span>}
            </div>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize: isMobile?11:13 }}>
                  <thead>
                    <tr style={{ borderBottom:`2px solid ${C.border}`, background:C.surface2 }}>
                      {['Asset','Direction','Stake','Result','P/L','Entry','Exit','Time'].map(h => (
                        <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:1, color:C.muted, whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeHistory.length===0 && <tr><td colSpan={8} style={{ textAlign:'center', color:C.muted, padding:40, fontSize:13 }}>No trades yet — place your first prediction!</td></tr>}
                    {activeHistory.map(t => (
                      <tr key={t.id} style={{ borderBottom:`1px solid ${C.border}` }}>
                        <td style={{ padding:'10px 12px' }}><div style={{ fontWeight:700, color:C.text }}>{t.asset}</div><div style={{ fontSize:9, color:C.muted2 }}>{t.expiryLabel}</div></td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background: t.direction==='CALL' ? C.greenBg : C.redBg, color: t.direction==='CALL' ? C.green : C.red }}>
                            {t.direction==='CALL' ? '▲ CALL' : '▼ PUT'}
                          </span>
                        </td>
                        <td style={{ padding:'10px 12px', fontFamily:'monospace', color:C.text, fontWeight:600, whiteSpace:'nowrap' }}>KES {t.stake?.toLocaleString()}</td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:20,
                            background: t.result==='WIN' ? C.greenBg : t.result==='PENDING' ? C.goldBg : C.redBg,
                            color: t.result==='WIN' ? C.green : t.result==='PENDING' ? C.gold : C.red }}>
                            {t.result}
                          </span>
                        </td>
                        <td style={{ padding:'10px 12px', fontFamily:'monospace', fontWeight:800, color: t.payout>=0 ? C.green : C.red, whiteSpace:'nowrap' }}>
                          {t.payout!=null ? `${t.payout>=0?'+':''}KES ${Math.abs(t.payout).toLocaleString()}` : '—'}
                        </td>
                        <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:10, color:C.muted }}>{t.entryRate != null ? (t.entryRate>=0?'+':'')+t.entryRate.toFixed(4) : '—'}</td>
                        <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:10, color:C.muted }}>{t.exitRate  != null ? (t.exitRate>=0?'+':'')+t.exitRate.toFixed(4)  : '—'}</td>
                        <td style={{ padding:'10px 12px', fontSize:10, color:C.muted2, whiteSpace:'nowrap' }}>
                          {t.settledAt ? new Date(t.settledAt).toLocaleString('en-KE',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'}) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* WALLET */}
        {activeTab==='wallet' && !demoMode && (
          <div style={{ padding: isMobile?10:24, overflowY:'auto', height:'100%' }}>
            <div style={{ fontSize: isMobile?14:18, fontWeight:800, color:C.text, marginBottom:16 }}>💳 Wallet & Transactions</div>
            <div style={{ display:'grid', gridTemplateColumns: isMobile?'1fr 1fr':'repeat(3,1fr)', gap:12, marginBottom:20 }}>
              {[['Balance',`KES ${balance.toLocaleString()}`,C.gold],['Total Deposited',`KES ${(stats?.totalDeposited||0).toLocaleString()}`,C.green],['Total Withdrawn',`KES ${(stats?.totalWithdrawn||0).toLocaleString()}`,C.muted]].map(([l,v,c]) => (
                <div key={l} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'16px', textAlign:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize:10, color:C.muted, textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>{l}</div>
                  <div style={{ fontFamily:'monospace', fontSize: isMobile?17:22, fontWeight:700, color:c }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24 }}>
              <button onClick={() => setShowDeposit(true)}
                style={{ padding:16, borderRadius:12, border:'none', background:'linear-gradient(135deg,#008c3a,#00cc4e)', color:'#fff', fontWeight:900, fontSize: isMobile?13:15, cursor:'pointer', boxShadow:'0 4px 16px rgba(0,168,50,0.3)' }}>
                📱 Deposit via M-Pesa
              </button>
              <button onClick={() => setShowWithdraw(true)}
                style={{ padding:16, borderRadius:12, border:`2px solid ${C.gold}55`, background:C.goldBg, color:C.gold, fontWeight:900, fontSize: isMobile?13:15, cursor:'pointer' }}>
                💸 Withdraw to M-Pesa
              </button>
            </div>
            <div style={{ fontSize:14, fontWeight:800, color:C.text, marginBottom:10 }}>Transaction History</div>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ background:C.surface2, borderBottom:`2px solid ${C.border}` }}>
                      {['Type','Amount','Status','Date','Reference'].map(h => (
                        <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:1, color:C.muted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length===0 && <tr><td colSpan={5} style={{ textAlign:'center', color:C.muted, padding:40, fontSize:13 }}>No transactions yet</td></tr>}
                    {transactions.map(t => (
                      <tr key={t.id} style={{ borderBottom:`1px solid ${C.border}` }}>
                        <td style={{ padding:'10px 12px' }}><span style={{ fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20, background: t.type==='deposit' ? C.greenBg : t.type==='withdrawal' ? C.goldBg : C.blueBg, color: t.type==='deposit' ? C.green : t.type==='withdrawal' ? C.gold : C.blue }}>{t.type.replace('_',' ')}</span></td>
                        <td style={{ padding:'10px 12px', fontFamily:'monospace', fontWeight:700, color:C.text, whiteSpace:'nowrap' }}>KES {t.amount?.toLocaleString()}</td>
                        <td style={{ padding:'10px 12px' }}><span style={{ fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20, background: t.status==='success' ? C.greenBg : t.status==='pending' ? C.goldBg : C.redBg, color: t.status==='success' ? C.green : t.status==='pending' ? C.gold : C.red }}>{t.status}</span></td>
                        <td style={{ padding:'10px 12px', fontSize:11, color:C.muted2, whiteSpace:'nowrap' }}>{new Date(t.createdAt).toLocaleString('en-KE',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                        <td style={{ padding:'10px 12px', fontSize:11, color:C.muted2, maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.mpesaRef||t.notes||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* STATS */}
        {activeTab==='stats' && (
          <div style={{ padding: isMobile?10:24, overflowY:'auto', height:'100%' }}>
            <div style={{ fontSize: isMobile?14:18, fontWeight:800, color:C.text, marginBottom:16 }}>
              📊 {demoMode ? 'Demo Performance' : 'My Performance'}
            </div>
            <div style={{ display:'grid', gridTemplateColumns: isMobile?'1fr 1fr':'repeat(4,1fr)', gap:12, marginBottom:20 }}>
              {(demoMode ? [
                ['Demo Balance', `KES ${demoBalance.toLocaleString()}`, C.gold],
                ['Total Trades', demoHistory.length, C.text],
                ['Wins',         demoHistory.filter(t=>t.result==='WIN').length, C.green],
                ['Win Rate',     demoHistory.length>0 ? `${Math.round(demoHistory.filter(t=>t.result==='WIN').length/demoHistory.length*100)}%` : '—', C.blue],
              ] : [
                ['Total Profit', `KES ${(stats?.totalProfit||0).toLocaleString()}`, C.green],
                ['Total Loss',   `KES ${(stats?.totalLoss||0).toLocaleString()}`,   C.red],
                ['Win Rate',     `${stats?.winRate||0}%`, stats?.winRate>50 ? C.green : C.text],
                ['Total Trades', stats?.tradeCount||0, C.text],
              ]).map(([l,v,c]) => (
                <div key={l} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'16px', textAlign:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize:9, color:C.muted, textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>{l}</div>
                  <div style={{ fontFamily:'monospace', fontSize: isMobile?18:24, fontWeight:700, color:c }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}`, fontSize:13, fontWeight:800, color:C.text }}>Recent Results</div>
              {activeHistory.length===0 && <div style={{ padding:30, textAlign:'center', fontSize:13, color:C.muted }}>No trades yet</div>}
              {activeHistory.slice(0,15).map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderBottom:`1px solid ${C.border}`, flexWrap:'wrap', gap:6 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{t.asset}</span>
                  <span style={{ fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20, background: t.direction==='CALL' ? C.greenBg : C.redBg, color: t.direction==='CALL' ? C.green : C.red }}>
                    {t.direction==='CALL'?'▲ CALL':'▼ PUT'}
                  </span>
                  <span style={{ fontSize:11, fontWeight:800, padding:'2px 10px', borderRadius:20, background: t.result==='WIN' ? C.greenBg : C.redBg, color: t.result==='WIN' ? C.green : C.red }}>
                    {t.result}
                  </span>
                  <span style={{ fontFamily:'monospace', fontSize:13, fontWeight:700, color: t.payout>=0 ? C.green : C.red }}>
                    {t.payout!=null ? `${t.payout>=0?'+':''}KES ${Math.abs(t.payout).toLocaleString()}` : '—'}
                  </span>
                  <span style={{ fontSize:10, color:C.muted2 }}>
                    {t.settledAt ? new Date(t.settledAt).toLocaleString('en-KE',{hour:'2-digit',minute:'2-digit'}) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showDeposit  && <DepositModal  balance={activeBalance} onSuccess={onDepositSuccess}  onClose={() => setShowDeposit(false)}/>}
      {showWithdraw && <WithdrawModal balance={balance}        onSuccess={onWithdrawSuccess} onClose={() => setShowWithdraw(false)}/>}
    </div>
  );
}
