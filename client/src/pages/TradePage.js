import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { marketAPI, tradeAPI, userAPI, settingsAPI } from '../utils/api';
import DepositModal from '../components/DepositModal';
import WithdrawModal from '../components/WithdrawModal';

// ─── Utilities ────────────────────────────────────────────────
function fmtP(p) {
  if (p == null) return '—';
  if (p >= 10000) return p.toFixed(2);
  if (p >= 100) return p.toFixed(3);
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(5);
}
function fmtKES(n) {
  if (n == null) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}
function fmtClock(s) {
  if (s <= 0) return '00:00';
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const EXPIRY = [
  { label: '30s',  key: '30s',  sec: 30   },
  { label: '1m',   key: '1m',   sec: 60   },
  { label: '5m',   key: '5m',   sec: 300  },
  { label: '15m',  key: '15m',  sec: 900  },
  { label: '30m',  key: '30m',  sec: 1800 },
];

const CAT_COLORS = {
  forex: '#1e3a5f', crypto: '#2d1b4e', nse: '#0d3320', comm: '#3d2600',
};

const DEMO_ASSETS = [
  { id: 'usdkes', name: 'USD/KES', sub: 'Forex', icon: '💵', cat: 'forex', price: 132.45, chg: 0.23, vol: '2.4M', bid: 132.40, ask: 132.50 },
  { id: 'eurkes', name: 'EUR/KES', sub: 'Forex', icon: '💶', cat: 'forex', price: 143.80, chg: -0.41, vol: '1.8M', bid: 143.75, ask: 143.85 },
  { id: 'gbpkes', name: 'GBP/KES', sub: 'Forex', icon: '🏴', cat: 'forex', price: 167.20, chg: 0.18, vol: '890K', bid: 167.15, ask: 167.25 },
  { id: 'usdjpy', name: 'USD/JPY', sub: 'Forex', icon: '¥',  cat: 'forex', price: 149.85, chg: -0.32, vol: '5.1B', bid: 149.80, ask: 149.90 },
  { id: 'btcusd', name: 'BTC/USD', sub: 'Crypto', icon: '₿', cat: 'crypto', price: 68420, chg: 2.15, vol: '12.1B', bid: 68400, ask: 68440 },
  { id: 'ethusd', name: 'ETH/USD', sub: 'Crypto', icon: '◆', cat: 'crypto', price: 3245.6, chg: 1.08, vol: '4.2B', bid: 3244, ask: 3247 },
  { id: 'solusd', name: 'SOL/USD', sub: 'Crypto', icon: '◉', cat: 'crypto', price: 178.40, chg: -0.73, vol: '1.1B', bid: 178.30, ask: 178.50 },
  { id: 'safcom', name: 'SCOM',    sub: 'NSE', icon: '📡', cat: 'nse', price: 17.40, chg: -0.57, vol: '14.2M', bid: 17.35, ask: 17.45 },
  { id: 'eqbnk',  name: 'EQTY',   sub: 'NSE', icon: '🏦', cat: 'nse', price: 52.75, chg: 1.32, vol: '5.8M', bid: 52.70, ask: 52.80 },
  { id: 'kenol',  name: 'KENO',   sub: 'NSE', icon: '⛽', cat: 'nse', price: 14.20, chg: -0.28, vol: '2.1M', bid: 14.15, ask: 14.25 },
  { id: 'eabl',   name: 'EABL',   sub: 'NSE', icon: '🍺', cat: 'nse', price: 145.50, chg: 0.69, vol: '3.4M', bid: 145.40, ask: 145.60 },
  { id: 'gold',   name: 'XAU/USD', sub: 'Commodity', icon: '🥇', cat: 'comm', price: 2348.5, chg: 0.65, vol: '52B', bid: 2347, ask: 2350 },
  { id: 'oil',    name: 'WTI Oil', sub: 'Commodity', icon: '🛢', cat: 'comm', price: 78.32, chg: -0.44, vol: '18B', bid: 78.28, ask: 78.36 },
];

const NAMES = ['Wanjiku','Kamau','Otieno','Njoroge','Achieng','Mwangi','Chebet','Odhiambo','Waweru','Kipchoge','Adhiambo','Mutua','Wairimu','Omondi','Kariuki','Nekesa','Gathoni','Simiyu','Wacera','Rotich','Njoki','Makau','Auma','Kirui','Mumbi','Juma','Wambui','Korir','Awino','Muigai'];
const ANAMES = ['USD/KES','EUR/KES','BTC/USD','ETH/USD','SCOM','XAU/USD','WTI Oil','EQTY','GBP/KES','SOL/USD'];
const rN = () => NAMES[Math.floor(Math.random() * NAMES.length)];
const rA = () => ANAMES[Math.floor(Math.random() * ANAMES.length)];
const rV = (mn = 100, mx = 8000) => Math.floor(Math.random() * (mx - mn) + mn);
function rMsg() {
  const pool = [
    () => `🎉 ${rN()} just won KES ${rV().toLocaleString()} on ${rA()}!`,
    () => `System: CONGRATULATIONS @${rN()} on your withdrawal of KES ${rV(200, 8000).toLocaleString()} 🥳🥳`,
    () => `💸 ${rN()} withdrew KES ${rV(500, 15000).toLocaleString()} to M-Pesa`,
    () => `🔥 ${rN()} placed KES ${rV().toLocaleString()} CALL on ${rA()}`,
    () => `📈 ${rN()} on a win streak! +KES ${rV(200, 5000).toLocaleString()}`,
    () => `System: CONGRATULATIONS @${rN()} KES ${rV(100, 5000).toLocaleString()} confirmed 🎊`,
    () => `⚡ ${rN()} deposited KES ${rV(500, 10000).toLocaleString()} and is trading!`,
    () => `💰 ${rN()} cashed out KES ${rV(1000, 20000).toLocaleString()}! 🥳`,
    () => `${rN()}: claimed BONUS of KES ${rV(10, 200).toLocaleString()}.`,
    () => `🎯 ${rN()} nailed PUT on ${rA()} +KES ${rV(200, 4000).toLocaleString()}`,
    () => `System: CONGRATULATIONS @${rN()} withdrawal of KES ${rV(300, 12000).toLocaleString()} processed 🎉`,
  ];
  return pool[Math.floor(Math.random() * pool.length)]();
}
function tickAssets(prev) {
  return prev.map(a => {
    const np = Math.max(0.01, a.price + (Math.random() - 0.495) * a.price * 0.0015);
    return { ...a, price: np, bid: np * 0.9996, ask: np * 1.0004, chg: Math.max(-9.99, Math.min(9.99, a.chg + (Math.random() - 0.5) * 0.05)) };
  });
}

// ─── Chart ────────────────────────────────────────────────────
function drawChart(canvas, data, rate, entryRate, direction, tradeOn) {
  if (!canvas || data.length < 2) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  if (!W || !H) return;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#0e1117'; ctx.fillRect(0, 0, W, H);

  const MAX = 0.18, MIN = -0.14;
  const rng = MAX - MIN;
  const pL = 62, pR = 18, pT = 44, pB = 34;
  const cW = W - pL - pR, cH = H - pT - pB;
  const px = i => pL + (i / (data.length - 1)) * cW;
  const py = v => pT + cH - ((v - MIN) / rng) * cH;
  const zY = py(0);
  const isUp = rate >= 0;

  // grid
  [-0.12, -0.06, 0, 0.06, 0.12].forEach(v => {
    const y = py(v); if (y < pT || y > pT + cH) return;
    ctx.strokeStyle = v === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)';
    ctx.lineWidth = v === 0 ? 1.5 : 1;
    ctx.setLineDash(v === 0 ? [] : [4, 4]);
    ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(W - pR, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(150,160,180,0.7)';
    ctx.font = `${v === 0 ? 'bold ' : ''}10px monospace`;
    ctx.textAlign = 'right';
    ctx.fillText((v >= 0 ? '+' : '') + v.toFixed(2), pL - 5, y + 3);
  });
  for (let i = 0; i <= 4; i++) {
    const x = pL + (cW / 4) * i;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, pT); ctx.lineTo(x, pT + cH); ctx.stroke();
  }

  // green fill above zero
  const gG = ctx.createLinearGradient(0, pT, 0, zY);
  gG.addColorStop(0, 'rgba(0,210,100,0.5)');
  gG.addColorStop(1, 'rgba(0,210,100,0.05)');
  ctx.beginPath();
  ctx.moveTo(px(0), Math.min(py(data[0]), zY));
  for (let i = 0; i < data.length; i++) ctx.lineTo(px(i), Math.min(py(data[i]), zY));
  ctx.lineTo(px(data.length - 1), zY); ctx.lineTo(px(0), zY);
  ctx.closePath(); ctx.fillStyle = gG; ctx.fill();

  // red fill below zero
  const rG = ctx.createLinearGradient(0, zY, 0, pT + cH);
  rG.addColorStop(0, 'rgba(220,40,60,0.05)');
  rG.addColorStop(1, 'rgba(220,40,60,0.5)');
  ctx.beginPath();
  ctx.moveTo(px(0), Math.max(py(data[0]), zY));
  for (let i = 0; i < data.length; i++) ctx.lineTo(px(i), Math.max(py(data[i]), zY));
  ctx.lineTo(px(data.length - 1), zY); ctx.lineTo(px(0), zY);
  ctx.closePath(); ctx.fillStyle = rG; ctx.fill();

  // line
  for (let i = 1; i < data.length; i++) {
    ctx.beginPath(); ctx.moveTo(px(i - 1), py(data[i - 1])); ctx.lineTo(px(i), py(data[i]));
    ctx.strokeStyle = data[i] >= 0 ? '#00d270' : '#e02840';
    ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
  }

  // entry line
  if (tradeOn && entryRate != null) {
    const ey = py(entryRate);
    if (ey >= pT - 2 && ey <= pT + cH + 2) {
      const col = direction === 'CALL' ? '#3b9eff' : '#ff9f3b';
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(pL, ey); ctx.lineTo(W - pR, ey); ctx.stroke();
      ctx.setLineDash([]);
      const txt = `${direction === 'CALL' ? '▲' : '▼'} Entry ${entryRate >= 0 ? '+' : ''}${entryRate.toFixed(4)}`;
      const tw = ctx.measureText(txt).width + 14;
      ctx.fillStyle = col + 'cc';
      ctx.beginPath(); ctx.roundRect(pL + 4, ey - 11, tw, 20, 3); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
      ctx.fillText(txt, pL + 10, ey + 3);
    }
  }

  // live dot
  const lx = px(data.length - 1), ly = py(data[data.length - 1]);
  const dc = isUp ? '#00d270' : '#e02840';
  [22, 13, 6].forEach((r, i) => {
    ctx.beginPath(); ctx.arc(lx, ly, r, 0, Math.PI * 2);
    ctx.fillStyle = isUp ? `rgba(0,210,112,${[0.08, 0.2, 1][i]})` : `rgba(220,40,64,${[0.08, 0.2, 1][i]})`;
    ctx.fill();
  });

  // rate badge
  const rs = (rate >= 0 ? '+' : '') + rate.toFixed(4);
  const bW = 180, bH = 40, bX = W / 2 - bW / 2, bY = 2;
  ctx.shadowColor = dc; ctx.shadowBlur = 14;
  ctx.fillStyle = '#131820'; ctx.strokeStyle = dc; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(bX, bY, bW, bH, 8); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = dc; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'center';
  ctx.fillText('Rate: ' + rs, bX + bW / 2, bY + 26);

  // time axis
  ctx.fillStyle = 'rgba(120,130,150,0.6)'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
  const now = new Date();
  for (let i = 0; i <= 4; i++) {
    const x = pL + (cW / 4) * i;
    const dt = new Date(now - (4 - i) * 20000);
    ctx.fillText(dt.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), x, pT + cH + 26);
  }

  // border
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
  ctx.strokeRect(pL, pT, cW, cH);
}

// ═══════════════════════════════════════════════════════════════
export default function TradePage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const canvasRef  = useRef(null);
  const chatEndRef = useRef(null);
  const chartData  = useRef([]);

  // screen
  const [W, setW] = useState(window.innerWidth);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  const isMobile = W < 768;
  const isTablet = W >= 768 && W < 1100;

  // mode
  const [demo,        setDemo]        = useState(false);
  const [demoBal,     setDemoBal]     = useState(10000);
  const [demoAssets,  setDemoAssets]  = useState(DEMO_ASSETS);
  const [demoHist,    setDemoHist]    = useState([]);
  const [demoPos,     setDemoPos]     = useState([]);

  // data
  const [assets,     setAssets]     = useState([]);
  const [signals,    setSignals]    = useState([]);
  const [sel,        setSel]        = useState(null);
  const [history,    setHistory]    = useState([]);
  const [txns,       setTxns]       = useState([]);
  const [stats,      setStats]      = useState(null);
  const [cfg,        setCfg]        = useState(null);
  const [bal,        setBal]        = useState(user?.balance || 0);
  const [rate,       setRate]       = useState(0);
  const [tick,       setTick]       = useState(0);

  // ui
  const [tab,     setTab]     = useState('trade');
  const [mobTab,  setMobTab]  = useState('chart');
  const [cat,     setCat]     = useState('all');
  const [q,       setQ]       = useState('');
  const [expiry,  setExpiry]  = useState(EXPIRY[1]);
  const [stake,   setStake]   = useState(500);
  const [busy,    setBusy]    = useState(false);
  const [showDep, setShowDep] = useState(false);
  const [showWd,  setShowWd]  = useState(false);

  // active trade
  const [trade, setTrade] = useState(null);

  // chat
  const [chat, setChat] = useState(() => {
    const s = [];
    for (let i = 0; i < 14; i++) s.push({ id: i, text: rMsg(), ts: Date.now() - (14 - i) * 5500 });
    return s;
  });

  // derived
  const AA  = demo ? demoAssets : assets;
  const AB  = demo ? demoBal    : bal;
  const AH  = demo ? demoHist   : history;
  const sel2 = sel ? AA.find(a => a.id === sel.id) || sel : null;
  const pout = cfg?.payoutRates?.[expiry.key] || 86;
  const potW = Math.round(stake * pout / 100);

  // ── chart seed
  useEffect(() => {
    const s = []; let v = 0;
    for (let i = 0; i < 140; i++) {
      v += (Math.random() - 0.49) * 0.005 + (Math.random() < 0.08 ? Math.random() * 0.08 : 0) + (Math.random() < 0.05 ? -Math.random() * 0.07 : 0);
      v = Math.max(-0.13, Math.min(0.17, parseFloat(v.toFixed(4))));
      s.push(v);
    }
    chartData.current = s;
    setRate(s[s.length - 1]);
    setTick(t => t + 1);
  }, [sel]);

  // ── chart animate
  useEffect(() => {
    const iv = setInterval(() => {
      const prev = chartData.current;
      const last = prev[prev.length - 1] || 0;
      const sp = Math.random() < 0.09 ? Math.random() * 0.09 : 0;
      const cr = Math.random() < 0.06 ? -Math.random() * 0.08 : 0;
      let nx = last + (Math.random() - 0.49) * 0.005 + sp + cr;
      nx = Math.max(-0.14, Math.min(0.18, parseFloat(nx.toFixed(4))));
      const nd = [...prev.slice(-159), nx];
      chartData.current = nd;
      setRate(nx);
      setTick(t => t + 1);
    }, 270);
    return () => clearInterval(iv);
  }, []);

  // ── draw chart
  useEffect(() => {
    const on = trade?.status === 'active';
    drawChart(canvasRef.current, chartData.current, rate, on ? trade.entryRate : null, on ? trade.dir : null, on);
  }, [tick, trade, rate]);

  // ── live trade countdown + P/L
  useEffect(() => {
    if (!trade || trade.status !== 'active') return;
    const iv = setInterval(() => {
      setTrade(prev => {
        if (!prev || prev.status !== 'active') return prev;
        const rem = prev.rem - 1;
        const win = (prev.dir === 'CALL' && rate > prev.entryRate) || (prev.dir === 'PUT' && rate < prev.entryRate);
        const livePnl = win ? prev.potW : -prev.stake;
        if (rem <= 0) return { ...prev, rem: 0, livePnl, win, status: 'settling' };
        return { ...prev, rem, livePnl, win };
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [trade, rate]);

  // ── settle
  useEffect(() => {
    if (!trade || trade.status !== 'settling') return;
    const won = (trade.dir === 'CALL' && rate > trade.entryRate) || (trade.dir === 'PUT' && rate < trade.entryRate);
    const pnl = won ? trade.potW : -trade.stake;
    const rec = {
      id: 't' + Date.now(), asset: sel2?.name, direction: trade.dir,
      stake: trade.stake, result: won ? 'WIN' : 'LOSS', payout: pnl,
      expiryLabel: trade.expLabel, entryRate: trade.entryRate, exitRate: rate,
      settledAt: new Date().toISOString(),
    };
    if (demo) {
      setDemoBal(b => won ? b + trade.stake + trade.potW : b);
      setDemoHist(h => [rec, ...h.slice(0, 49)]);
    } else {
      setBal(b => won ? b + trade.stake + trade.potW : b);
      setHistory(h => [rec, ...h.slice(0, 49)]);
      tradeAPI.place({ asset: sel2?.name, direction: trade.dir, stake: trade.stake, expirySec: trade.expSec, expiryLabel: trade.expLabel, entryPrice: sel2?.price }).catch(() => {});
    }
    setTrade({ ...trade, status: won ? 'won' : 'lost', pnl, exitRate: rate });
    toast(won ? `🎉 WIN! +KES ${trade.potW.toLocaleString()}` : `❌ Loss KES ${trade.stake.toLocaleString()}`, won ? 'success' : 'error');
    setTimeout(() => setTrade(null), 5000);
  }, [trade?.status]);

  // ── chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat]);
  useEffect(() => {
    let t;
    const s = () => { t = setTimeout(() => { setChat(p => [...p, { id: Date.now(), text: rMsg() }].slice(-80)); s(); }, 1000 + Math.random() * 2500); };
    s(); return () => clearTimeout(t);
  }, []);

  // ── data load
  useEffect(() => {
    if (demo) return;
    settingsAPI.public().then(r => setCfg(r.data)).catch(() => {});
    userAPI.stats().then(r => { setStats(r.data); setBal(r.data.balance); }).catch(() => {});
    userAPI.trades().then(r => setHistory(r.data)).catch(() => {});
    userAPI.transactions().then(r => setTxns(r.data)).catch(() => {});
    marketAPI.signals().then(r => setSignals(r.data)).catch(() => {});
  }, [demo]);

  useEffect(() => {
    if (demo) return;
    const load = () => marketAPI.assets().then(r => { setAssets(r.data); if (!sel && r.data.length) setSel(r.data[0]); }).catch(() => {});
    load(); const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, [sel, demo]);

  useEffect(() => {
    if (!demo) return;
    if (!sel) setSel(DEMO_ASSETS[0]);
    const iv = setInterval(() => setDemoAssets(tickAssets), 1500);
    return () => clearInterval(iv);
  }, [demo, sel]);

  // ── place trade
  const place = dir => {
    if (trade?.status === 'active') { toast('Trade running — wait for settlement', 'error'); return; }
    if (stake < (cfg?.minStake || 50)) { toast(`Min stake KES ${cfg?.minStake || 50}`, 'error'); return; }
    if (stake > AB) { toast('Insufficient balance', 'error'); return; }
    if (demo) setDemoBal(b => b - stake);
    else setBal(b => b - stake);
    setTrade({ dir, entryRate: rate, stake, potW, rem: expiry.sec, expSec: expiry.sec, expLabel: expiry.key, status: 'active', livePnl: 0, win: false });
    toast(`${dir} placed · KES ${stake.toLocaleString()} · ${expiry.label} · ${pout}% payout`, 'info');
  };

  const filtered = AA.filter(a => {
    if (cat !== 'all' && a.cat !== cat) return false;
    if (q && !a.name.toLowerCase().includes(q.toLowerCase()) && !a.sub.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  // ── theme tokens
  const T = {
    bg: '#0b0e17', surface: '#131925', s2: '#1a2235', s3: '#1e2840',
    border: 'rgba(255,255,255,0.07)', border2: 'rgba(255,255,255,0.13)',
    text: '#e4eaf8', muted: '#6b7a99', muted2: '#3a4a66',
    green: '#00d270', gdim: 'rgba(0,210,112,0.12)',
    red: '#e02840',   rdim: 'rgba(224,40,64,0.12)',
    gold: '#f5c242',  ydim: 'rgba(245,194,66,0.12)',
    blue: '#3b9eff',  bdim: 'rgba(59,158,255,0.12)',
    orange: '#ff9f3b', odim: 'rgba(255,159,59,0.12)',
  };

  // ── reusable styles
  const pill = (active, col, bg) => ({
    padding: '4px 12px', borderRadius: 20, border: `1px solid ${active ? col : T.border}`,
    color: active ? col : T.muted, background: active ? bg : 'transparent',
    fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'all .12s', whiteSpace: 'nowrap',
  });
  const stk = (label, val, col) => (
    <div key={label} style={{ background: T.s2, borderRadius: 8, padding: '9px 11px', border: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: 1, color: T.muted2, marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: col || T.text }}>{val}</div>
    </div>
  );

  const isUp = rate >= 0;

  // ════════════════════════════════════════════════════════════
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: T.bg, color: T.text, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <style>{`
        @keyframes mkq{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${T.s3};border-radius:4px;}
        button:active{transform:scale(.96)!important;}
        .fade-up{animation:fadeUp .35s ease;}
        a{color:${T.blue};}
      `}</style>

      {/* ── HEADER ───────────────────────────────────── */}
      <header style={{ background: T.surface, borderBottom: `1px solid ${T.border2}`, padding: `0 ${isMobile ? 12 : 20}px`, height: isMobile ? 52 : 58, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 16px rgba(0,0,0,0.4)' }}>
        <div style={{ fontWeight: 900, fontSize: isMobile ? 15 : 20, letterSpacing: '-0.5px', color: T.text, flexShrink: 0 }}>
          Trade<span style={{ color: T.green }}>Flow</span><span style={{ color: T.blue, fontSize: isMobile ? 11 : 14 }}> Pro</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: demo ? T.gold : T.green, boxShadow: `0 0 7px ${demo ? T.gold : T.green}` }} />
          <span style={{ fontSize: 9, color: demo ? T.gold : T.green, fontWeight: 800, letterSpacing: 1.5 }}>{demo ? 'DEMO' : 'LIVE'}</span>
        </div>
        {!isMobile && cfg?.announcement && (
          <div style={{ flex: 1, background: T.ydim, border: `1px solid ${T.gold}33`, borderRadius: 6, padding: '3px 12px', fontSize: 11, color: T.gold, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📢 {cfg.announcement}
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: isMobile ? 5 : 10 }}>
          {/* balance */}
          <div style={{ background: T.s2, border: `1px solid ${T.border2}`, borderRadius: 8, padding: isMobile ? '3px 8px' : '5px 14px', flexShrink: 0 }}>
            <div style={{ fontSize: 8, color: T.muted2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{demo ? 'Demo' : 'Balance'}</div>
            <div style={{ fontFamily: 'monospace', fontSize: isMobile ? 12 : 15, fontWeight: 700, color: demo ? T.green : T.gold }}>
              KES {AB.toLocaleString()}
            </div>
          </div>
          {!demo ? (
            <>
              <button onClick={() => { setDemo(true); setSel(DEMO_ASSETS[0]); toast('Demo mode — KES 10,000 virtual', 'info'); }}
                style={{ height: isMobile ? 30 : 34, padding: `0 ${isMobile ? 8 : 12}px`, borderRadius: 7, border: `1px solid ${T.border2}`, background: T.s2, color: T.muted, fontWeight: 700, fontSize: isMobile ? 9 : 11, cursor: 'pointer', flexShrink: 0 }}>
                🎮 {isMobile ? 'Demo' : 'Demo Mode'}
              </button>
              <button onClick={() => setShowDep(true)}
                style={{ height: isMobile ? 30 : 34, padding: `0 ${isMobile ? 8 : 14}px`, borderRadius: 7, border: 'none', background: `linear-gradient(135deg,#009944,${T.green})`, color: '#001a00', fontWeight: 800, fontSize: isMobile ? 9 : 12, cursor: 'pointer', flexShrink: 0 }}>
                📱 {isMobile ? 'Dep' : 'Deposit'}
              </button>
              <button onClick={() => setShowWd(true)}
                style={{ height: isMobile ? 30 : 34, padding: `0 ${isMobile ? 7 : 12}px`, borderRadius: 7, border: `1px solid ${T.gold}55`, background: T.ydim, color: T.gold, fontWeight: 700, fontSize: isMobile ? 9 : 11, cursor: 'pointer', flexShrink: 0, display: isMobile ? 'none' : 'block' }}>
                💸 Withdraw
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setDemoBal(10000); setDemoHist([]); setDemoPos([]); setTrade(null); toast('Demo reset', 'info'); }}
                style={{ height: isMobile ? 30 : 34, padding: `0 ${isMobile ? 7 : 10}px`, borderRadius: 7, border: `1px solid ${T.green}44`, background: T.gdim, color: T.green, fontWeight: 700, fontSize: isMobile ? 9 : 11, cursor: 'pointer', flexShrink: 0 }}>
                ↺ {isMobile ? '' : 'Reset'}
              </button>
              <button onClick={() => { setDemo(false); setSel(assets[0] || null); setTrade(null); }}
                style={{ height: isMobile ? 30 : 34, padding: `0 ${isMobile ? 8 : 12}px`, borderRadius: 7, border: 'none', background: T.green, color: '#001a00', fontWeight: 800, fontSize: isMobile ? 9 : 11, cursor: 'pointer', flexShrink: 0 }}>
                → {isMobile ? 'Live' : 'Go Live'}
              </button>
            </>
          )}
          <div onClick={logout} title="Sign Out" style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#1e3a8a,#3b9eff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, cursor: 'pointer', color: '#fff', flexShrink: 0 }}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
        </div>
      </header>

      {/* demo banner */}
      {demo && (
        <div style={{ background: '#1a1400', borderBottom: `1px solid ${T.gold}44`, padding: '6px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: isMobile ? 10 : 12, color: T.gold }}>🎮 <strong>Demo Mode</strong> <span style={{ color: T.muted, fontSize: 11 }}>— Practice with KES 10,000 virtual. No real money.</span></span>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {isMobile && <>
              <button onClick={() => setShowDep(true)} style={{ height: 26, padding: '0 8px', borderRadius: 5, border: 'none', background: T.green, color: '#001a00', fontWeight: 800, fontSize: 10, cursor: 'pointer' }}>Deposit</button>
              <button onClick={() => setShowWd(true)} style={{ height: 26, padding: '0 8px', borderRadius: 5, border: `1px solid ${T.gold}55`, background: T.ydim, color: T.gold, fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>Withdraw</button>
            </>}
            <button onClick={() => { setDemo(false); setSel(assets[0] || null); setTrade(null); }}
              style={{ height: 26, padding: '0 10px', borderRadius: 5, border: `1px solid ${T.gold}55`, background: T.ydim, color: T.gold, fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>
              → Live
            </button>
          </div>
        </div>
      )}

      {/* ── TABS ─────────────────────────────────────── */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, display: 'flex', padding: `0 ${isMobile ? 4 : 16}px`, overflowX: 'auto', flexShrink: 0 }}>
        {[['trade', '📈 Trade'], ['signals', '⚡ Signals'], ['history', '📋 History'], ...(!demo ? [['wallet', '💳 Wallet']] : []), ['stats', '📊 Stats']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: isMobile ? '10px 10px' : '12px 18px', background: 'transparent', border: 'none', borderBottom: `3px solid ${tab === k ? T.blue : 'transparent'}`, color: tab === k ? T.blue : T.muted, fontWeight: 700, fontSize: isMobile ? 10 : 12, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s' }}>
            {isMobile ? l.split(' ')[0] : l}
          </button>
        ))}
        {isMobile && !demo && (
          <button onClick={() => setShowWd(true)} style={{ marginLeft: 'auto', padding: '10px 10px', background: 'transparent', border: 'none', borderBottom: '3px solid transparent', color: T.gold, fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>
            💸 Out
          </button>
        )}
      </div>

      {/* ── TICKER ───────────────────────────────────── */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, height: 28, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', whiteSpace: 'nowrap', animation: 'mkq 50s linear infinite', willChange: 'transform' }}>
          {[...AA, ...AA].map((a, i) => (
            <span key={i} onClick={() => setSel(a)} style={{ fontFamily: 'monospace', fontSize: 10, padding: '0 16px', display: 'inline-flex', alignItems: 'center', gap: 5, borderRight: `1px solid ${T.border}`, cursor: 'pointer', flexShrink: 0 }}>
              <span style={{ color: T.muted2 }}>{a.name}</span>
              <span style={{ color: T.muted, fontWeight: 600 }}>{fmtP(a.price)}</span>
              <span style={{ color: a.chg >= 0 ? T.green : T.red, fontWeight: 700 }}>{a.chg >= 0 ? '▲' : '▼'}{Math.abs(a.chg).toFixed(2)}%</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── CONTENT ──────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* TRADE TAB */}
        {tab === 'trade' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

            {/* Left sidebar — desktop */}
            {!isMobile && (
              <div style={{ width: isTablet ? 185 : 220, flexShrink: 0, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.surface }}>
                {/* search + filter */}
                <div style={{ padding: '8px', borderBottom: `1px solid ${T.border}` }}>
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search market…"
                    style={{ width: '100%', background: T.s2, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '7px 10px', color: T.text, fontSize: 12, outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', gap: 4, padding: '6px 8px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
                  {['all', 'forex', 'crypto', 'nse', 'comm'].map(c => (
                    <button key={c} onClick={() => setCat(c)} style={pill(cat === c, T.blue, T.bdim)}>{c === 'all' ? 'All' : c === 'comm' ? 'Comm' : c.charAt(0).toUpperCase() + c.slice(1)}</button>
                  ))}
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {filtered.map(a => {
                    const s = sel?.id === a.id;
                    return (
                      <div key={a.id} onClick={() => setSel(a)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', background: s ? T.bdim : 'transparent', borderLeft: `3px solid ${s ? T.blue : 'transparent'}`, transition: 'background .1s' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: CAT_COLORS[a.cat] || T.s2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{a.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{a.name}</div>
                          <div style={{ fontSize: 9, color: T.muted2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.sub}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontFamily: 'monospace', fontSize: 11, color: T.text, fontWeight: 600 }}>{fmtP(a.price)}</div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: a.chg >= 0 ? T.green : T.red }}>{a.chg >= 0 ? '+' : ''}{a.chg.toFixed(2)}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Center */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

              {/* mobile sub-tabs */}
              {isMobile && (
                <div style={{ display: 'flex', background: T.s2, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                  {[['chart', '📈'], ['assets', '🌐'], ['chat', '💬']].map(([k, l]) => (
                    <button key={k} onClick={() => setMobTab(k)}
                      style={{ flex: 1, padding: '9px 4px', background: 'transparent', border: 'none', borderBottom: `2px solid ${mobTab === k ? T.blue : 'transparent'}`, color: mobTab === k ? T.blue : T.muted, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                      {l} {k === 'chart' ? 'Chart' : k === 'assets' ? 'Markets' : 'Chat'}
                    </button>
                  ))}
                </div>
              )}

              {/* mobile assets */}
              {isMobile && mobTab === 'assets' && (
                <div style={{ flex: 1, overflow: 'hidden', background: T.surface, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '8px', borderBottom: `1px solid ${T.border}` }}>
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
                      style={{ width: '100%', background: T.s2, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '7px 10px', color: T.text, fontSize: 12, outline: 'none' }} />
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {filtered.map(a => (
                      <div key={a.id} onClick={() => { setSel(a); setMobTab('chart'); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', background: sel?.id === a.id ? T.bdim : 'transparent' }}>
                        <div style={{ width: 30, height: 30, borderRadius: 7, background: CAT_COLORS[a.cat] || T.s2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{a.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{a.name}</div>
                          <div style={{ fontSize: 10, color: T.muted2 }}>{a.sub}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'monospace', fontSize: 12, color: T.text, fontWeight: 600 }}>{fmtP(a.price)}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: a.chg >= 0 ? T.green : T.red }}>{a.chg >= 0 ? '+' : ''}{a.chg.toFixed(2)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* mobile chat */}
              {isMobile && mobTab === 'chat' && (
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '10px 14px', background: '#00a832', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 15 }}>💬</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Live Chat</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#7eff7e' }} />
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{Math.floor(130 + Math.random() * 60)} online</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', background: T.s2 }}>
                    {chat.map(m => {
                      const sys = m.text.startsWith('System:');
                      const ci = m.text.indexOf(':');
                      const hc = ci > 0 && ci < 25;
                      return (
                        <div key={m.id} style={{ padding: '6px 12px', borderBottom: `1px solid ${T.border}`, fontSize: 12, lineHeight: 1.5 }}>
                          {hc ? <><span style={{ fontWeight: 800, color: sys ? '#ff8833' : T.blue }}>{m.text.slice(0, ci)}:</span><span style={{ color: T.muted }}>{m.text.slice(ci + 1)}</span></> : <span style={{ color: T.muted }}>{m.text}</span>}
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                </div>
              )}

              {/* Chart + controls */}
              {(!isMobile || mobTab === 'chart') && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

                  {/* asset header */}
                  {sel2 && (
                    <div style={{ padding: isMobile ? '8px 10px' : '10px 18px', borderBottom: `1px solid ${T.border}`, flexShrink: 0, background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: CAT_COLORS[sel2.cat] || T.s2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{sel2.icon}</div>
                        <div>
                          <div style={{ fontSize: isMobile ? 14 : 18, fontWeight: 900, color: T.text }}>{sel2.name}</div>
                          <div style={{ fontSize: 10, color: T.muted2 }}>{sel2.sub} {demo ? '· DEMO' : '· Live'}</div>
                        </div>
                        <div style={{ marginLeft: isMobile ? 6 : 14 }}>
                          <div style={{ fontFamily: 'monospace', fontSize: isMobile ? 17 : 23, fontWeight: 700, color: sel2.chg >= 0 ? T.green : T.red, lineHeight: 1 }}>{fmtP(sel2.price)}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: sel2.chg >= 0 ? T.green : T.red, marginTop: 2 }}>{sel2.chg >= 0 ? '▲ +' : '▼ '}{Math.abs(sel2.chg).toFixed(2)}%</div>
                        </div>
                      </div>
                      {!isMobile && (
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                          {[['Bid', fmtP(sel2.bid), T.red], ['Ask', fmtP(sel2.ask), T.green], ['Vol', sel2.vol, T.blue], ['H', fmtP(sel2.price * 1.005), T.green], ['L', fmtP(sel2.price * 0.995), T.red]].map(([l, v, c]) => (
                            <div key={l} style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 9, color: T.muted2, fontWeight: 700 }}>{l}</div>
                              <div style={{ fontFamily: 'monospace', fontSize: 12, color: c, fontWeight: 700 }}>{v}</div>
                            </div>
                          ))}
                          <div style={{ padding: '5px 12px', background: isUp ? T.gdim : T.rdim, border: `1px solid ${isUp ? T.green : T.red}33`, borderRadius: 8, textAlign: 'center' }}>
                            <div style={{ fontSize: 9, color: T.muted2 }}>RATE</div>
                            <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 900, color: isUp ? T.green : T.red }}>{rate >= 0 ? '+' : ''}{rate.toFixed(4)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Active trade banner */}
                  {trade && trade.status === 'active' && (
                    <div className="fade-up" style={{ padding: '10px 14px', background: trade.win ? T.gdim : T.rdim, borderTop: `2px solid ${trade.win ? T.green : T.red}`, borderBottom: `1px solid ${T.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: trade.dir === 'CALL' ? T.gdim : T.rdim, border: `1.5px solid ${trade.dir === 'CALL' ? T.green : T.red}`, borderRadius: 8, padding: '6px 12px' }}>
                        <span style={{ fontSize: 18 }}>{trade.dir === 'CALL' ? '▲' : '▼'}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 900, color: trade.dir === 'CALL' ? T.green : T.red }}>{trade.dir}</div>
                          <div style={{ fontSize: 10, color: T.muted }}>KES {trade.stake.toLocaleString()}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 900, color: trade.rem <= 10 ? T.red : T.text, lineHeight: 1 }}>{fmtClock(trade.rem)}</div>
                        <div style={{ fontSize: 9, color: T.muted }}>remaining</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 900, color: (trade.livePnl || 0) >= 0 ? T.green : T.red, lineHeight: 1 }}>
                          {(trade.livePnl || 0) >= 0 ? '+' : ''}{(trade.livePnl || 0).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 9, color: T.muted }}>live P/L (KES)</div>
                      </div>
                      <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: trade.win ? T.green : T.red }}>{trade.win ? '✅ Winning' : '❌ Losing'}</div>
                        <div style={{ fontSize: 10, color: T.muted }}>Rate: <span style={{ fontFamily: 'monospace', color: isUp ? T.green : T.red }}>{rate >= 0 ? '+' : ''}{rate.toFixed(4)}</span></div>
                      </div>
                      <div style={{ width: '100%', height: 5, background: T.s3, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.round(((trade.expSec - trade.rem) / trade.expSec) * 100)}%`, height: '100%', background: `linear-gradient(90deg,${trade.win ? T.green : T.red},${trade.win ? '#00ff88' : '#ff4060'})`, transition: 'width 1s linear', borderRadius: 3 }} />
                      </div>
                      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.muted2 }}>
                        <span>Entry: {trade.entryRate >= 0 ? '+' : ''}{trade.entryRate.toFixed(4)}</span>
                        <span>Potential win: +KES {trade.potW.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  {/* Result banner */}
                  {trade && (trade.status === 'won' || trade.status === 'lost') && (
                    <div className="fade-up" style={{ padding: '14px 18px', background: trade.status === 'won' ? T.gdim : T.rdim, border: `2px solid ${trade.status === 'won' ? T.green : T.red}`, margin: '8px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <span style={{ fontSize: 30 }}>{trade.status === 'won' ? '🎉' : '😔'}</span>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: trade.status === 'won' ? T.green : T.red }}>
                          {trade.status === 'won' ? `YOU WIN! +KES ${trade.potW.toLocaleString()}` : `LOSS — KES ${trade.stake.toLocaleString()}`}
                        </div>
                        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                          {trade.dir} · Entry {trade.entryRate >= 0 ? '+' : ''}{trade.entryRate.toFixed(4)} → Exit {trade.exitRate >= 0 ? '+' : ''}{trade.exitRate?.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CHART */}
                  <div style={{ flex: 1, background: '#0e1117', minHeight: isMobile ? 220 : 260, overflow: 'hidden' }}>
                    <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
                  </div>

                  {/* TRADE PANEL */}
                  <div style={{ background: T.surface, borderTop: `1px solid ${T.border2}`, padding: isMobile ? '10px 12px' : '14px 20px', flexShrink: 0 }}>
                    {/* row 1: expiry */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, color: T.muted2, flexShrink: 0 }}>EXPIRY</span>
                      {EXPIRY.map(o => <button key={o.key} onClick={() => setExpiry(o)} style={pill(expiry.key === o.key, T.blue, T.bdim)}>{o.label}</button>)}
                      <div style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 11, background: T.ydim, border: `1px solid ${T.gold}44`, borderRadius: 6, padding: '4px 10px', color: T.gold, fontWeight: 700, flexShrink: 0 }}>
                        {pout}% payout
                      </div>
                    </div>
                    {/* row 2: stake */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, color: T.muted2, flexShrink: 0 }}>STAKE</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: T.s2, border: `1.5px solid ${T.border2}`, borderRadius: 8, padding: '7px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: T.muted2 }}>KES</span>
                        <input type="number" value={stake} onChange={e => setStake(Number(e.target.value))} min={50}
                          style={{ border: 'none', background: 'transparent', fontFamily: 'monospace', fontSize: 16, fontWeight: 700, width: 85, padding: 0, color: T.text, outline: 'none' }} />
                      </div>
                      {[500, 1000, 2000, 5000].map(v => (
                        <button key={v} onClick={() => setStake(v)}
                          style={{ fontSize: 10, fontWeight: 700, padding: '5px 10px', borderRadius: 7, cursor: 'pointer', background: stake === v ? T.bdim : T.s2, border: `1px solid ${stake === v ? T.blue : T.border}`, color: stake === v ? T.blue : T.muted, transition: 'all .12s' }}>
                          {v >= 1000 ? `${v / 1000}K` : v}
                        </button>
                      ))}
                      <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 9, color: T.muted2 }}>Est. return</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: T.green }}>+KES {potW.toLocaleString()}</div>
                      </div>
                    </div>
                    {/* trade buttons */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {[['CALL', '▲ CALL (UP)', T.green, 'rgba(0,150,80,0.4)', 'Price will rise'], ['PUT', '▼ PUT (DOWN)', T.red, 'rgba(200,0,40,0.4)', 'Price will fall']].map(([dir, lbl, col, sh, sub]) => (
                        <button key={dir} onClick={() => place(dir)}
                          disabled={trade?.status === 'active'}
                          style={{ padding: isMobile ? '13px 8px' : '17px 8px', border: 'none', borderRadius: 10, background: trade?.status === 'active' ? T.s3 : dir === 'CALL' ? `linear-gradient(135deg,#007a30,${T.green})` : `linear-gradient(135deg,#a00020,${T.red})`, color: trade?.status === 'active' ? T.muted : '#fff', fontWeight: 900, fontSize: isMobile ? 13 : 15, cursor: trade?.status === 'active' ? 'not-allowed' : 'pointer', boxShadow: trade?.status === 'active' ? 'none' : `0 4px 20px ${sh}`, lineHeight: 1.3, transition: 'all .15s' }}>
                          {lbl}<br /><span style={{ fontSize: 10, fontWeight: 400, opacity: .75 }}>{sub}</span>
                        </button>
                      ))}
                    </div>
                    {trade?.status === 'active' && (
                      <div style={{ marginTop: 8, textAlign: 'center', fontSize: 11, color: T.muted, fontStyle: 'italic' }}>Trade running — wait for settlement before placing next</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right panel — desktop */}
            {!isMobile && (
              <div style={{ width: isTablet ? 200 : 245, flexShrink: 0, borderLeft: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.surface }}>
                {/* active position */}
                <div style={{ borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                  <div style={{ padding: '9px 12px', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, color: T.muted2, borderBottom: `1px solid ${T.border}` }}>
                    Open Position {demo && <span style={{ color: T.gold }}>· DEMO</span>}
                  </div>
                  <div style={{ padding: trade?.status === 'active' ? 0 : '16px 12px', textAlign: trade?.status === 'active' ? 'left' : 'center' }}>
                    {trade?.status === 'active' ? (
                      <div style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{sel2?.name}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: trade.dir === 'CALL' ? T.gdim : T.rdim, color: trade.dir === 'CALL' ? T.green : T.red }}>{trade.dir}</span>
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: 10, color: T.muted, marginBottom: 4 }}>KES {trade.stake.toLocaleString()} · +{trade.potW.toLocaleString()} if wins</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 900, color: trade.rem <= 10 ? T.red : T.blue, lineHeight: 1, marginBottom: 3 }}>{fmtClock(trade.rem)}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: (trade.livePnl || 0) >= 0 ? T.green : T.red, marginBottom: 6 }}>
                          {(trade.livePnl || 0) >= 0 ? '+' : ''}KES {Math.abs(trade.livePnl || 0).toLocaleString()}
                        </div>
                        <div style={{ height: 3, background: T.s3, borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.round(((trade.expSec - trade.rem) / trade.expSec) * 100)}%`, height: '100%', background: trade.win ? T.green : T.red, transition: 'width 1s linear', borderRadius: 2 }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: T.muted2 }}>
                          <span>Entry: {trade.entryRate.toFixed(4)}</span>
                          <span style={{ color: trade.win ? T.green : T.red }}>{trade.win ? '✅ Winning' : '❌ Losing'}</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: T.muted2 }}>No active trade</div>
                    )}
                  </div>
                </div>

                {/* mini stats */}
                <div style={{ padding: '8px 10px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                    {(demo ? [
                      ['Demo Bal', `${demoBal.toLocaleString()}`, T.gold],
                      ['Trades', demoHist.length, T.text],
                      ['Wins', demoHist.filter(t => t.result === 'WIN').length, T.green],
                      ['Win%', demoHist.length > 0 ? `${Math.round(demoHist.filter(t => t.result === 'WIN').length / demoHist.length * 100)}%` : '—', T.blue],
                    ] : [
                      ['Win Rate', stats ? `${stats.winRate}%` : '—', stats?.winRate > 50 ? T.green : T.text],
                      ['Today P/L', stats ? `${stats.todayPL >= 0 ? '+' : ''}${(stats.todayPL || 0).toLocaleString()}` : '—', (stats?.todayPL || 0) >= 0 ? T.green : T.red],
                      ['Trades', stats?.tradeCount ?? '—', T.text],
                      ['Profit', stats ? fmtKES(stats.totalProfit) : '—', T.green],
                    ]).map(([l, v, c]) => stk(l, v, c))}
                  </div>
                </div>

                {/* chat */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div style={{ padding: '9px 12px', background: '#00882a', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#7eff7e' }} />
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: .5 }}>LIVE CHAT</span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,.7)', marginLeft: 2 }}>{Math.floor(130 + Math.random() * 60)} online</span>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', background: T.s2 }}>
                    {chat.map(m => {
                      const sys = m.text.startsWith('System:');
                      const ci = m.text.indexOf(':'); const hc = ci > 0 && ci < 25;
                      return (
                        <div key={m.id} style={{ padding: '5px 10px', borderBottom: `1px solid ${T.border}`, fontSize: 11, lineHeight: 1.5 }}>
                          {hc ? <><span style={{ fontWeight: 800, color: sys ? '#ff8833' : T.blue }}>{m.text.slice(0, ci)}:</span><span style={{ color: T.muted }}>{m.text.slice(ci + 1)}</span></> : <span style={{ color: T.muted }}>{m.text}</span>}
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SIGNALS */}
        {tab === 'signals' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 12 : 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: isMobile ? 14 : 18, fontWeight: 800 }}>⚡ AI Prediction Signals</div>
              <button onClick={() => marketAPI.signals().then(r => setSignals(r.data)).catch(() => {})}
                style={{ padding: '6px 14px', borderRadius: 7, border: `1px solid ${T.border2}`, background: T.s2, color: T.blue, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>↻ Refresh</button>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.3)' }}>
              {signals.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>Loading signals…</div>}
              {signals.map(s => (
                <div key={s.assetId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: CAT_COLORS[s.cat] || T.s2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{s.icon}</div>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>{s.conf}% confidence · RSI {s.rsi} · {s.trend}</div>
                    <div style={{ height: 4, background: T.s3, borderRadius: 2 }}>
                      <div style={{ width: `${s.conf}%`, height: '100%', borderRadius: 2, background: s.direction === 'CALL' ? T.green : T.red }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, padding: '5px 16px', borderRadius: 20, background: s.direction === 'CALL' ? T.gdim : T.rdim, color: s.direction === 'CALL' ? T.green : T.red, border: `1.5px solid ${s.direction === 'CALL' ? T.green : T.red}44`, flexShrink: 0 }}>{s.direction}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: '12px 16px', background: T.s2, borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
              ⚠️ Signals use RSI, MA & momentum analysis. Not guaranteed. Always trade responsibly.
            </div>
          </div>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 10 : 24 }}>
            <div style={{ fontSize: isMobile ? 14 : 18, fontWeight: 800, marginBottom: 16 }}>
              Trade History {demo && <span style={{ color: T.green, fontSize: 12 }}>[DEMO]</span>}
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.3)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? 11 : 13 }}>
                  <thead>
                    <tr style={{ background: T.s2, borderBottom: `2px solid ${T.border2}` }}>
                      {['Asset', 'Direction', 'Stake', 'Result', 'P/L', 'Entry', 'Exit', 'Time'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: T.muted2, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {AH.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: T.muted, padding: 40 }}>No trades yet — make a prediction to get started!</td></tr>}
                    {AH.map(t => (
                      <tr key={t.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td style={{ padding: '10px 12px' }}><div style={{ fontWeight: 700 }}>{t.asset}</div><div style={{ fontSize: 9, color: T.muted2 }}>{t.expiryLabel}</div></td>
                        <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: t.direction === 'CALL' ? T.gdim : T.rdim, color: t.direction === 'CALL' ? T.green : T.red }}>{t.direction === 'CALL' ? '▲ CALL' : '▼ PUT'}</span></td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>KES {t.stake?.toLocaleString()}</td>
                        <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: t.result === 'WIN' ? T.gdim : T.result === 'PENDING' ? T.ydim : T.rdim, color: t.result === 'WIN' ? T.green : t.result === 'PENDING' ? T.gold : T.red }}>{t.result}</span></td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 800, color: t.payout >= 0 ? T.green : T.red, whiteSpace: 'nowrap' }}>
                          {t.payout != null ? `${t.payout >= 0 ? '+' : ''}KES ${Math.abs(t.payout).toLocaleString()}` : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 10, color: T.muted, whiteSpace: 'nowrap' }}>{t.entryRate != null ? (t.entryRate >= 0 ? '+' : '') + t.entryRate.toFixed(4) : '—'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 10, color: T.muted, whiteSpace: 'nowrap' }}>{t.exitRate != null ? (t.exitRate >= 0 ? '+' : '') + t.exitRate.toFixed(4) : '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 10, color: T.muted2, whiteSpace: 'nowrap' }}>{t.settledAt ? new Date(t.settledAt).toLocaleString('en-KE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* WALLET */}
        {tab === 'wallet' && !demo && (
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 10 : 24 }}>
            <div style={{ fontSize: isMobile ? 14 : 18, fontWeight: 800, marginBottom: 16 }}>💳 Wallet & Transactions</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
              {[['Balance', `KES ${bal.toLocaleString()}`, T.gold], ['Total Deposited', `KES ${(stats?.totalDeposited || 0).toLocaleString()}`, T.green], ['Total Withdrawn', `KES ${(stats?.totalWithdrawn || 0).toLocaleString()}`, T.muted]].map(([l, v, c]) => (
                <div key={l} style={{ background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 12, padding: 16, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
                  <div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{l}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: isMobile ? 17 : 22, fontWeight: 700, color: c }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <button onClick={() => setShowDep(true)} style={{ padding: 16, borderRadius: 12, border: 'none', background: `linear-gradient(135deg,#009944,${T.green})`, color: '#fff', fontWeight: 900, fontSize: isMobile ? 13 : 15, cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,160,80,0.3)' }}>
                📱 Deposit via M-Pesa
              </button>
              <button onClick={() => setShowWd(true)} style={{ padding: 16, borderRadius: 12, border: `2px solid ${T.gold}55`, background: T.ydim, color: T.gold, fontWeight: 900, fontSize: isMobile ? 13 : 15, cursor: 'pointer' }}>
                💸 Withdraw to M-Pesa
              </button>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Transaction History</div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: T.s2, borderBottom: `2px solid ${T.border2}` }}>
                      {['Type', 'Amount', 'Status', 'Date', 'Reference'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: T.muted2 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {txns.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: T.muted, padding: 40 }}>No transactions yet</td></tr>}
                    {txns.map(t => (
                      <tr key={t.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: t.type === 'deposit' ? T.gdim : t.type === 'withdrawal' ? T.ydim : T.bdim, color: t.type === 'deposit' ? T.green : t.type === 'withdrawal' ? T.gold : T.blue }}>{t.type.replace('_', ' ')}</span></td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: T.text, whiteSpace: 'nowrap' }}>KES {t.amount?.toLocaleString()}</td>
                        <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: t.status === 'success' ? T.gdim : t.status === 'pending' ? T.ydim : T.rdim, color: t.status === 'success' ? T.green : t.status === 'pending' ? T.gold : T.red }}>{t.status}</span></td>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: T.muted2, whiteSpace: 'nowrap' }}>{new Date(t.createdAt).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: T.muted2, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.mpesaRef || t.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* STATS */}
        {tab === 'stats' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 10 : 24 }}>
            <div style={{ fontSize: isMobile ? 14 : 18, fontWeight: 800, marginBottom: 16 }}>
              📊 {demo ? 'Demo Performance' : 'My Performance'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
              {(demo ? [
                ['Demo Balance', `KES ${demoBal.toLocaleString()}`, T.gold],
                ['Total Trades', demoHist.length, T.text],
                ['Wins', demoHist.filter(t => t.result === 'WIN').length, T.green],
                ['Win Rate', demoHist.length > 0 ? `${Math.round(demoHist.filter(t => t.result === 'WIN').length / demoHist.length * 100)}%` : '—', T.blue],
              ] : [
                ['Total Profit', `KES ${(stats?.totalProfit || 0).toLocaleString()}`, T.green],
                ['Total Loss', `KES ${(stats?.totalLoss || 0).toLocaleString()}`, T.red],
                ['Win Rate', `${stats?.winRate || 0}%`, stats?.winRate > 50 ? T.green : T.text],
                ['Total Trades', stats?.tradeCount || 0, T.text],
              ]).map(([l, v, c]) => (
                <div key={l} style={{ background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 12, padding: 16, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
                  <div style={{ fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{l}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: isMobile ? 18 : 24, fontWeight: 700, color: c }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, fontSize: 13, fontWeight: 800 }}>Recent Results</div>
              {AH.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>No trades yet</div>}
              {AH.slice(0, 15).map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{t.asset}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: t.direction === 'CALL' ? T.gdim : T.rdim, color: t.direction === 'CALL' ? T.green : T.red }}>{t.direction === 'CALL' ? '▲ CALL' : '▼ PUT'}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 20, background: t.result === 'WIN' ? T.gdim : T.rdim, color: t.result === 'WIN' ? T.green : T.red }}>{t.result}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: t.payout >= 0 ? T.green : T.red }}>
                    {t.payout != null ? `${t.payout >= 0 ? '+' : ''}KES ${Math.abs(t.payout).toLocaleString()}` : '—'}
                  </span>
                  <span style={{ fontSize: 10, color: T.muted2 }}>{t.settledAt ? new Date(t.settledAt).toLocaleString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showDep && <DepositModal balance={AB} onSuccess={amt => { setBal(b => b + amt); setShowDep(false); toast(`KES ${amt.toLocaleString()} credited`, 'success'); userAPI.transactions().then(r => setTxns(r.data)).catch(() => {}); }} onClose={() => setShowDep(false)} />}
      {showWd  && <WithdrawModal balance={bal} onSuccess={amt => { setBal(b => b - amt); setShowWd(false); toast('Withdrawal submitted', 'info'); userAPI.transactions().then(r => setTxns(r.data)).catch(() => {}); }} onClose={() => setShowWd(false)} />}
    </div>
  );
}
