import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { marketAPI, tradeAPI, paymentAPI, userAPI, settingsAPI } from '../utils/api';
import DepositModal from '../components/DepositModal';
import WithdrawModal from '../components/WithdrawModal';

// ── Helpers ────────────────────────────────────────────────────
const ASSET_COLORS = { forex:'#0f2a45', crypto:'#1a0f2a', nse:'#0a2a0f', comm:'#2a1a00' };

function fmtPrice(p) {
  if (p >= 10000) return p.toFixed(2);
  if (p >= 100)   return p.toFixed(3);
  if (p >= 1)     return p.toFixed(4);
  return p.toFixed(5);
}
function fmtKES(n) {
  const a = Math.abs(n);
  if (a >= 1000000) return 'KES '+(n/1e6).toFixed(2)+'M';
  if (a >= 1000)    return 'KES '+(n/1e3).toFixed(1)+'K';
  return 'KES '+n.toLocaleString();
}

const EXPIRY_OPTIONS = [
  { label:'30 Sec', key:'30s', sec:30  },
  { label:'1 Min',  key:'1m',  sec:60  },
  { label:'5 Min',  key:'5m',  sec:300 },
  { label:'15 Min', key:'15m', sec:900 },
  { label:'30 Min', key:'30m', sec:1800},
];

const DEMO_ASSETS = [
  {id:'usdkes',name:'USD/KES',sub:'Nairobi FX',   icon:'💵',cat:'forex', price:132.45,chg: 0.23,vol:'2.4M'},
  {id:'eurkes',name:'EUR/KES',sub:'Nairobi FX',   icon:'💶',cat:'forex', price:143.80,chg:-0.41,vol:'1.8M'},
  {id:'gbpkes',name:'GBP/KES',sub:'Nairobi FX',   icon:'🏴',cat:'forex', price:167.20,chg: 0.18,vol:'890K'},
  {id:'btcusd',name:'BTC/USD',sub:'Crypto',        icon:'₿', cat:'crypto',price:68420, chg: 2.15,vol:'12.1B'},
  {id:'ethusd',name:'ETH/USD',sub:'Crypto',        icon:'◆', cat:'crypto',price:3245.6,chg: 1.08,vol:'4.2B'},
  {id:'solusd',name:'SOL/USD',sub:'Crypto',        icon:'◉', cat:'crypto',price:178.40,chg:-0.73,vol:'1.1B'},
  {id:'safcom',name:'SCOM',   sub:'NSE·Safaricom', icon:'📡',cat:'nse',  price:17.40, chg:-0.57,vol:'14.2M'},
  {id:'eqbnk', name:'EQTY',   sub:'NSE·Equity',   icon:'🏦',cat:'nse',  price:52.75, chg: 1.32,vol:'5.8M'},
  {id:'kenol', name:'KENO',   sub:'NSE·KenolKobil',icon:'⛽',cat:'nse',  price:14.20, chg:-0.28,vol:'2.1M'},
  {id:'eabl',  name:'EABL',   sub:'NSE·EA Breweries',icon:'🍺',cat:'nse',price:145.50,chg:0.69, vol:'3.4M'},
  {id:'gold',  name:'XAU/USD',sub:'Commodities',   icon:'🥇',cat:'comm', price:2348.5,chg: 0.65,vol:'52.4B'},
  {id:'oil',   name:'WTI Oil',sub:'Commodities',   icon:'🛢', cat:'comm', price:78.32, chg:-0.44,vol:'18.6B'},
];

// ── Fake chat names & messages ─────────────────────────────────
const FAKE_NAMES = [
  'Wanjiku','Kamau','Otieno','Njoroge','Achieng','Mwangi','Chebet','Odhiambo',
  'Waweru','Kipchoge','Adhiambo','Mutua','Wairimu','Omondi','Kariuki','Nekesa',
  'Gathoni','Simiyu','Wacera','Rotich','Njoki','Makau','Auma','Kirui',
  'Mumbi','Juma','Wambui','Korir','Awino','Muigai','Zawadi','Baraza',
];
const CHAT_EVENTS = [
  (n,a)=>`🎉 ${n} just won KES ${a.toLocaleString()} on ${randomAsset()}!`,
  (n,a)=>`💰 ${n} withdrew KES ${a.toLocaleString()} successfully!`,
  (n,a)=>`🔥 ${n} placed KES ${a.toLocaleString()} on CALL — let's go!`,
  (n,a)=>`✅ CONGRATULATIONS ${n} on your withdrawal of KES ${a.toLocaleString()} 🎊🎊`,
  (n,a)=>`📈 ${n} just doubled up! +KES ${a.toLocaleString()}`,
  (n,a)=>`💸 ${n} cashed out KES ${a.toLocaleString()} to M-Pesa!`,
  (n,a)=>`🚀 ${n} is on a 3-win streak! Current gain: KES ${a.toLocaleString()}`,
  (n,a)=>`⚡ ${n} just deposited KES ${a.toLocaleString()} and jumped in!`,
];
const ASSET_NAMES = ['USD/KES','EUR/KES','BTC/USD','ETH/USD','SCOM','XAU/USD','WTI Oil','EQTY'];
function randomAsset(){ return ASSET_NAMES[Math.floor(Math.random()*ASSET_NAMES.length)]; }
function randomName(){ return FAKE_NAMES[Math.floor(Math.random()*FAKE_NAMES.length)]; }
function randomAmt(){ return [100,200,500,800,1000,1500,2000,5000][Math.floor(Math.random()*8)]; }
function randomMsg(){ return CHAT_EVENTS[Math.floor(Math.random()*CHAT_EVENTS.length)](randomName(), randomAmt()); }

// ── Spike chart data generator ─────────────────────────────────
function generateSpikeData(points = 120) {
  const data = [];
  let val = 0;
  for (let i = 0; i < points; i++) {
    const progress = i / points;
    // Multiple spikes
    const spike1 = Math.max(0, Math.sin((progress - 0.1) * Math.PI * 3) * 0.12) * (progress < 0.5 ? 1 : 0.3);
    const spike2 = Math.max(0, Math.sin((progress - 0.35) * Math.PI * 4) * 0.09) * (progress > 0.3 && progress < 0.65 ? 1 : 0);
    const spike3 = Math.max(0, Math.sin((progress - 0.55) * Math.PI * 5) * 0.11) * (progress > 0.5 && progress < 0.75 ? 1 : 0);
    const spike4 = Math.max(0, Math.sin((progress - 0.7)  * Math.PI * 4) * 0.10) * (progress > 0.65 && progress < 0.85 ? 1 : 0);
    // Crash near end
    const crash = progress > 0.85 ? -(progress - 0.85) * 0.5 : 0;
    val = spike1 + spike2 + spike3 + spike4 + crash + (Math.random() - 0.5) * 0.005;
    data.push(parseFloat(val.toFixed(4)));
  }
  return data;
}

function tickDemoAssets(prev) {
  return prev.map(a => ({
    ...a,
    price: Math.max(0.01, a.price + (Math.random()-0.495)*a.price*0.0012),
    chg: Math.max(-9.99, Math.min(9.99, a.chg + (Math.random()-0.5)*0.04)),
  }));
}

// ══════════════════════════════════════════════════════════════
export default function TradePage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const canvasRef   = useRef(null);
  const chatEndRef  = useRef(null);
  const chartAnimRef = useRef(null);

  // ── Demo mode ──────────────────────────────────────────
  const [demoMode, setDemoMode]         = useState(false);
  const [demoBalance, setDemoBalance]   = useState(10000);
  const [demoAssets, setDemoAssets]     = useState(DEMO_ASSETS);
  const [demoHistory, setDemoHistory]   = useState([]);
  const [demoPositions, setDemoPositions] = useState([]);

  // ── Real mode ──────────────────────────────────────────
  const [assets, setAssets]           = useState([]);
  const [signals, setSignals]         = useState([]);
  const [sel, setSel]                 = useState(null);
  const [positions, setPositions]     = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats]             = useState(null);
  const [settings, setSettings]       = useState(null);
  const [balance, setBalance]         = useState(user?.balance || 0);

  // ── UI ─────────────────────────────────────────────────
  const [catFilter, setCatFilter]     = useState('all');
  const [searchQ, setSearchQ]         = useState('');
  const [activeTab, setActiveTab]     = useState('trade');
  const [expiry, setExpiry]           = useState(EXPIRY_OPTIONS[1]);
  const [stake, setStake]             = useState(500);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [tradingBusy, setTradingBusy] = useState(false);

  // ── Chart (spike style) ────────────────────────────────
  const [chartData, setChartData]     = useState(() => generateSpikeData(80));
  const [liveRate, setLiveRate]       = useState(0);
  const [chartAnimating, setChartAnimating] = useState(true);

  // ── Chat ───────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState(() => {
    const seed = [];
    for (let i = 0; i < 12; i++) seed.push({ id: i, text: randomMsg(), ts: Date.now() - (12-i)*8000 });
    return seed;
  });

  // ── Effective values ───────────────────────────────────
  const activeAssets    = demoMode ? demoAssets : assets;
  const activeBalance   = demoMode ? demoBalance : balance;
  const activePositions = demoMode ? demoPositions : positions;
  const activeHistory   = demoMode ? demoHistory  : tradeHistory;
  const selectedAsset   = sel ? activeAssets.find(a => a.id === sel.id) || sel : null;

  // ── Load real data ─────────────────────────────────────
  useEffect(() => {
    if (demoMode) return;
    settingsAPI.public().then(r => setSettings(r.data)).catch(()=>{});
    userAPI.stats().then(r => { setStats(r.data); setBalance(r.data.balance); }).catch(()=>{});
    userAPI.trades().then(r => setTradeHistory(r.data)).catch(()=>{});
    userAPI.transactions().then(r => setTransactions(r.data)).catch(()=>{});
    marketAPI.signals().then(r => setSignals(r.data)).catch(()=>{});
  }, [demoMode]);

  useEffect(() => {
    if (demoMode) return;
    const load = () => marketAPI.assets().then(r => {
      setAssets(r.data);
      if (!sel && r.data.length) setSel(r.data[0]);
    }).catch(()=>{});
    load();
    const iv = setInterval(load, 2500);
    return () => clearInterval(iv);
  }, [sel, demoMode]);

  // ── Tick demo assets ───────────────────────────────────
  useEffect(() => {
    if (!demoMode) return;
    if (!sel) setSel(DEMO_ASSETS[0]);
    const iv = setInterval(() => setDemoAssets(p => tickDemoAssets(p)), 1500);
    return () => clearInterval(iv);
  }, [demoMode, sel]);

  // ── Spike chart animation ──────────────────────────────
  useEffect(() => {
    if (!chartAnimating) return;
    const iv = setInterval(() => {
      setChartData(prev => {
        const last = prev[prev.length - 1];
        // Random walk with occasional spikes
        const spike = Math.random() < 0.08 ? (Math.random() * 0.06) : 0;
        const drift = (Math.random() - 0.51) * 0.004;
        let next = last + drift + spike;
        if (next < -0.09) next = -0.09;
        if (next > 0.14)  next = 0.14;
        next = parseFloat(next.toFixed(4));
        setLiveRate(next);
        const newData = [...prev.slice(-119), next];
        return newData;
      });
    }, 300);
    return () => clearInterval(iv);
  }, [chartAnimating]);

  // ── Draw spike chart ───────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || chartData.length < 2) return;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    if (!W || !H) return;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const mn = Math.min(...chartData, -0.08);
    const mx = Math.max(...chartData,  0.14);
    const rng = mx - mn || 0.2;
    const padL = 8, padR = 8, padT = 20, padB = 30;
    const cW = W - padL - padR;
    const cH = H - padT - padB;
    const zero = padT + cH - ((0 - mn) / rng) * cH;

    const px = i => padL + (i / (chartData.length - 1)) * cW;
    const py = v => padT + cH - ((v - mn) / rng) * cH;

    // Background grid
    ctx.strokeStyle = 'rgba(0,255,100,0.06)';
    ctx.lineWidth = 1;
    [-0.07, 0, 0.07, 0.13].forEach(v => {
      const y = py(v);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.fillStyle = 'rgba(0,255,100,0.4)';
      ctx.font = '10px DM Mono,monospace';
      ctx.textAlign = 'right';
      ctx.fillText(v.toFixed(2), W - 2, y - 2);
    });

    // Zero line
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, zero); ctx.lineTo(W, zero); ctx.stroke();
    ctx.setLineDash([]);

    // Positive fill (green)
    ctx.beginPath();
    ctx.moveTo(px(0), Math.min(py(chartData[0]), zero));
    for (let i = 0; i < chartData.length; i++) {
      ctx.lineTo(px(i), Math.min(py(chartData[i]), zero));
    }
    ctx.lineTo(px(chartData.length - 1), zero);
    ctx.lineTo(px(0), zero);
    ctx.closePath();
    const gGrad = ctx.createLinearGradient(0, padT, 0, zero);
    gGrad.addColorStop(0, 'rgba(0,217,126,0.7)');
    gGrad.addColorStop(1, 'rgba(0,217,126,0.15)');
    ctx.fillStyle = gGrad;
    ctx.fill();

    // Negative fill (red)
    ctx.beginPath();
    ctx.moveTo(px(0), Math.max(py(chartData[0]), zero));
    for (let i = 0; i < chartData.length; i++) {
      ctx.lineTo(px(i), Math.max(py(chartData[i]), zero));
    }
    ctx.lineTo(px(chartData.length - 1), zero);
    ctx.lineTo(px(0), zero);
    ctx.closePath();
    const rGrad = ctx.createLinearGradient(0, zero, 0, H - padB);
    rGrad.addColorStop(0, 'rgba(240,66,77,0.15)');
    rGrad.addColorStop(1, 'rgba(240,66,77,0.6)');
    ctx.fillStyle = rGrad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(px(0), py(chartData[0]));
    for (let i = 1; i < chartData.length; i++) ctx.lineTo(px(i), py(chartData[i]));
    ctx.strokeStyle = liveRate >= 0 ? '#00d97e' : '#f0424d';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Live dot
    const lx = px(chartData.length - 1);
    const ly = py(chartData[chartData.length - 1]);
    ctx.beginPath(); ctx.arc(lx, ly, 5, 0, Math.PI*2);
    ctx.fillStyle = liveRate >= 0 ? '#00d97e' : '#f0424d';
    ctx.fill();

    // Rate label box
    const rateText = `Rate: ${liveRate >= 0 ? '+' : ''}${liveRate.toFixed(4)}`;
    const bx = W/2 - 70, by = 8, bw = 140, bh = 28;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeStyle = liveRate >= 0 ? '#00d97e' : '#f0424d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 4);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = liveRate >= 0 ? '#00d97e' : '#f0424d';
    ctx.font = 'bold 13px DM Mono,monospace';
    ctx.textAlign = 'center';
    ctx.fillText(rateText, W/2, by + 19);
  }, [chartData, liveRate]);

  // ── Chat auto-scroll ───────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ── Add fake chat messages ─────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      setChatMessages(p => {
        const next = [...p, { id: Date.now(), text: randomMsg(), ts: Date.now() }];
        return next.slice(-60);
      });
    }, Math.random() * 2500 + 1500);
    return () => clearInterval(iv);
  }, []);

  // ── Position timer ─────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      if (!demoMode) setPositions(p => p.map(pos => ({...pos, elapsedSec: Math.min((pos.elapsedSec||0)+1, pos.totalSec||pos.expirySec)})));
      else setDemoPositions(p => p.map(pos => ({...pos, elapsedSec: Math.min((pos.elapsedSec||0)+1, pos.totalSec)})));
    }, 1000);
    return () => clearInterval(iv);
  }, [demoMode]);

  // ── Demo trade ─────────────────────────────────────────
  const placeDemoTrade = (direction) => {
    if (stake < 50)           { toast('Minimum stake is KES 50','error'); return; }
    if (stake > demoBalance)  { toast('Insufficient demo balance','error'); return; }
    setDemoBalance(b => b - stake);
    const id = 'demo-'+Date.now();
    setDemoPositions(p => [{id, asset: selectedAsset?.name, direction, stake, totalSec: expiry.sec, elapsedSec:0, entryPrice: selectedAsset?.price}, ...p]);
    toast(`[DEMO] ${direction} — KES ${stake.toLocaleString()} on ${selectedAsset?.name}`, 'info');
    const rate = (settings?.payoutRates?.[expiry.key] || 86) / 100;
    setTimeout(() => {
      const win = Math.random() < 0.55;
      const payout = win ? Math.round(stake * rate) : -stake;
      setDemoPositions(p => p.filter(x => x.id !== id));
      if (win) setDemoBalance(b => b + stake + Math.round(stake*rate));
      setDemoHistory(h => [{id, asset: selectedAsset?.name, direction, stake, result: win?'WIN':'LOSS', payout, expiryLabel: expiry.key, settledAt: new Date().toISOString()}, ...h.slice(0,49)]);
      toast(win ? `[DEMO] 🎉 WIN +KES ${Math.abs(payout).toLocaleString()}` : `[DEMO] Loss KES ${stake.toLocaleString()}`, win?'success':'error');
    }, Math.min(expiry.sec*1000, 10000));
  };

  // ── Real trade ─────────────────────────────────────────
  const placeRealTrade = async (direction) => {
    if (!selectedAsset) return;
    if (stake < (settings?.minStake||50)) { toast(`Min stake KES ${settings?.minStake||50}`,'error'); return; }
    if (stake > balance) { toast('Insufficient balance. Please deposit.','error'); return; }
    setTradingBusy(true);
    try {
      const r = await tradeAPI.place({ asset: selectedAsset.name, direction, stake, expirySec: expiry.sec, expiryLabel: expiry.key, entryPrice: selectedAsset.price });
      const { trade, newBalance } = r.data;
      setBalance(newBalance);
      toast(`${direction} placed — KES ${stake.toLocaleString()} on ${selectedAsset.name}`,'info');
      setPositions(p => [{...trade, totalSec: expiry.sec, elapsedSec:0}, ...p]);
      const delay = Math.min(expiry.sec*1000, 16000);
      setTimeout(async () => {
        try {
          const res = await tradeAPI.result(trade.id);
          const { trade: t, balance: nb } = res.data;
          if (t.result !== 'PENDING') {
            setBalance(nb);
            setPositions(p => p.filter(x => x.id !== trade.id));
            setTradeHistory(p => [t, ...p.slice(0,49)]);
            const win = t.result === 'WIN';
            toast(win ? `🎉 WIN +KES ${Math.abs(t.payout).toLocaleString()}` : `Loss KES ${stake.toLocaleString()}`, win?'success':'error');
            userAPI.stats().then(r => setStats(r.data)).catch(()=>{});
          }
        } catch {}
      }, delay);
    } catch(err) { toast(err.response?.data?.error||'Trade failed','error'); }
    finally { setTradingBusy(false); }
  };

  const placeTrade = (dir) => demoMode ? placeDemoTrade(dir) : placeRealTrade(dir);

  const onDepositSuccess = (amount) => {
    setBalance(b => b + amount);
    setShowDeposit(false);
    toast(`KES ${amount.toLocaleString()} credited to your wallet`,'success');
    userAPI.transactions().then(r => setTransactions(r.data)).catch(()=>{});
  };
  const onWithdrawSuccess = (amount) => {
    setBalance(b => b - amount);
    setShowWithdraw(false);
    toast('Withdrawal request submitted','info');
    userAPI.transactions().then(r => setTransactions(r.data)).catch(()=>{});
  };

  const selectAsset = (a) => { setSel(a); };

  const filteredAssets = activeAssets.filter(a => {
    if (catFilter !== 'all' && a.cat !== catFilter) return false;
    if (searchQ && !a.name.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  const payoutRate = settings?.payoutRates?.[expiry.key] || 86;
  const estReturn  = Math.round(stake * payoutRate / 100);
  const cats = ['all','forex','crypto','nse','comm'];
  const catLabels = {all:'All',forex:'Forex',crypto:'Crypto',nse:'NSE',comm:'Comm'};
  const tickerItems = [...activeAssets, ...activeAssets];

  // ════════════════════════════════════════════════════════
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#050a10'}}>

      {/* ── Global styles ──────────────────────────────── */}
      <style>{`
        @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        .ticker-wrap{overflow:hidden;background:#060d18;border-bottom:1px solid rgba(0,255,100,0.1);flex-shrink:0;height:30px;display:flex;align-items:center;}
        .ticker-track{display:flex;white-space:nowrap;animation:marquee 50s linear infinite;will-change:transform;}
        .ticker-track:hover{animation-play-state:paused;}
        .ticker-item{display:inline-flex;align-items:center;gap:5px;padding:0 20px;border-right:1px solid rgba(255,255,255,0.05);font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;flex-shrink:0;}
        .t-name{color:#4a5a6a;} .t-price{color:#c8d8e8;} .t-up{color:#00d97e;} .t-dn{color:#f0424d;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .chat-msg{animation:fadeIn 0.4s ease;}
        .demo-bar{background:linear-gradient(90deg,#0a1a05,#051a0a);border-bottom:1px solid rgba(0,217,126,0.25);padding:5px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;font-size:12px;}
        .spike-canvas{width:100%;height:100%;display:block;background:#050d08;}
        ::-webkit-scrollbar{width:3px;} ::-webkit-scrollbar-thumb{background:#1a2a1a;border-radius:3px;}
      `}</style>

      {/* ── Header ─────────────────────────────────────── */}
      <header style={{height:52,background:'#060d18',borderBottom:'1px solid rgba(0,255,100,0.12)',display:'flex',alignItems:'center',padding:'0 16px',gap:12,flexShrink:0,zIndex:10}}>
        <div style={{fontWeight:800,fontSize:17,letterSpacing:'-0.5px',color:'#e8f8e8'}}>
          Trade<span style={{color:'#00d97e'}}>Flow</span><span style={{color:'#4d9ef7',fontSize:13,marginLeft:2}}>Pro</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:5,marginLeft:4}}>
          <div style={{width:7,height:7,borderRadius:'50%',background: demoMode?'#f5a623':'#00d97e',boxShadow:`0 0 6px ${demoMode?'#f5a623':'#00d97e'}`}}/>
          <span style={{fontSize:10,color: demoMode?'#f5a623':'#00d97e',fontWeight:700,letterSpacing:1}}>{demoMode?'DEMO MODE':'LIVE'}</span>
        </div>
        {settings?.announcement && !demoMode && (
          <div style={{flex:1,background:'rgba(245,166,35,0.08)',border:'1px solid rgba(245,166,35,.2)',borderRadius:6,padding:'3px 10px',fontSize:11,color:'#f5a623',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            📢 {settings.announcement}
          </div>
        )}
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
          {demoMode ? (
            <>
              <div style={{background:'rgba(0,217,126,0.08)',border:'1px solid rgba(0,217,126,0.2)',borderRadius:6,padding:'4px 12px'}}>
                <div style={{fontSize:9,color:'#4a6a4a',fontWeight:700,textTransform:'uppercase',letterSpacing:1}}>Demo Balance</div>
                <div style={{fontFamily:'var(--mono)',fontSize:14,fontWeight:500,color:'#00d97e'}}>KES {demoBalance.toLocaleString()}</div>
              </div>
              <button style={{height:30,padding:'0 12px',borderRadius:6,border:'1px solid rgba(0,217,126,0.3)',background:'rgba(0,217,126,0.1)',color:'#00d97e',fontWeight:700,fontSize:12,cursor:'pointer'}}
                onClick={()=>{setDemoBalance(10000);setDemoHistory([]);setDemoPositions([]);toast('Demo reset — KES 10,000','info');}}>↺ Reset</button>
              <button style={{height:30,padding:'0 14px',borderRadius:6,border:'none',background:'#00d97e',color:'#001a00',fontWeight:800,fontSize:12,cursor:'pointer'}}
                onClick={()=>{setDemoMode(false);setSel(assets[0]||null);setActiveTab('trade');}}>→ Go Live</button>
            </>
          ) : (
            <>
              <div style={{background:'rgba(20,30,20,0.8)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,padding:'4px 12px'}}>
                <div style={{fontSize:9,color:'#4a5a6a',fontWeight:700,textTransform:'uppercase',letterSpacing:1}}>Balance</div>
                <div style={{fontFamily:'var(--mono)',fontSize:14,fontWeight:500,color:'#f5a623'}}>KES {balance.toLocaleString()}</div>
              </div>
              <button style={{height:30,padding:'0 12px',borderRadius:6,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#8a9aaa',fontWeight:700,fontSize:12,cursor:'pointer'}}
                onClick={()=>{setDemoMode(true);setSel(DEMO_ASSETS[0]);setActiveTab('trade');toast('Demo mode — KES 10,000 virtual balance','info');}}>🎮 Demo</button>
              <button style={{height:30,padding:'0 14px',borderRadius:6,border:'none',background:'#00d97e',color:'#001a00',fontWeight:800,fontSize:12,cursor:'pointer'}} onClick={()=>setShowDeposit(true)}>📱 Deposit</button>
              <button style={{height:30,padding:'0 12px',borderRadius:6,border:'1px solid rgba(245,166,35,0.4)',background:'rgba(245,166,35,0.08)',color:'#f5a623',fontWeight:700,fontSize:12,cursor:'pointer'}} onClick={()=>setShowWithdraw(true)}>💸 Withdraw</button>
            </>
          )}
          <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,#1a5c2a,#00d97e)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,cursor:'pointer',color:'#001a00'}}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <button style={{height:30,padding:'0 10px',borderRadius:6,border:'1px solid rgba(255,255,255,0.08)',background:'transparent',color:'#6a7a8a',fontWeight:600,fontSize:12,cursor:'pointer'}} onClick={logout}>Out</button>
        </div>
      </header>

      {/* ── Demo banner ─────────────────────────────────── */}
      {demoMode && (
        <div className="demo-bar">
          <span>🎮 <strong style={{color:'#00d97e'}}>Demo Mode</strong> <span style={{color:'#4a6a4a',marginLeft:6}}>Practice trading — no real money at risk</span></span>
          <button style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:4,border:'1px solid rgba(0,217,126,0.3)',background:'rgba(0,217,126,0.1)',color:'#00d97e',cursor:'pointer'}}
            onClick={()=>{setDemoMode(false);setSel(assets[0]||null);}}>→ Switch to Live</button>
        </div>
      )}

      {/* ── Nav tabs ────────────────────────────────────── */}
      <div style={{display:'flex',background:'#060d18',borderBottom:'1px solid rgba(0,255,100,0.08)',padding:'0 16px',gap:2,flexShrink:0}}>
        {[['trade','📈 Trade'],['signals','⚡ Signals'],['history','📋 History'],...(!demoMode?[['wallet','💳 Wallet']]:[]),['stats','📊 Stats']].map(([k,l])=>(
          <button key={k} onClick={()=>setActiveTab(k)}
            style={{padding:'9px 14px',background:'transparent',border:'none',borderBottom:`2px solid ${activeTab===k?'#00d97e':'transparent'}`,color:activeTab===k?'#00d97e':'#4a5a6a',fontWeight:700,fontSize:11,cursor:'pointer',transition:'all .15s',letterSpacing:.3,whiteSpace:'nowrap'}}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Ticker ──────────────────────────────────────── */}
      <div className="ticker-wrap">
        <div className="ticker-track">
          {tickerItems.map((a,i)=>(
            <span key={i} className="ticker-item" onClick={()=>selectAsset(a)}>
              <span className="t-name">{a.name}</span>
              <span className="t-price">{fmtPrice(a.price)}</span>
              <span className={a.chg>=0?'t-up':'t-dn'}>{a.chg>=0?'▲':'▼'}{Math.abs(a.chg).toFixed(2)}%</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Main content ────────────────────────────────── */}
      <div style={{flex:1,overflow:'hidden',display:activeTab==='trade'?'flex':'block',minHeight:0}}>

        {/* TRADE TAB */}
        {activeTab==='trade' && (<>

          {/* Left — asset list */}
          <div style={{width:200,flexShrink:0,borderRight:'1px solid rgba(0,255,100,0.07)',display:'flex',flexDirection:'column',overflow:'hidden',background:'#060d18'}}>
            <div style={{padding:'6px 8px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
              <input placeholder="Search..." value={searchQ} onChange={e=>setSearchQ(e.target.value)}
                style={{fontSize:11,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:4,padding:'5px 8px',color:'#c8d8e8',width:'100%',outline:'none'}}/>
            </div>
            <div style={{display:'flex',gap:3,padding:'5px 6px',borderBottom:'1px solid rgba(255,255,255,0.05)',flexWrap:'wrap'}}>
              {cats.map(c=>(
                <button key={c} onClick={()=>setCatFilter(c)}
                  style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:20,cursor:'pointer',border:'1px solid',borderColor:catFilter===c?'#00d97e':'rgba(255,255,255,0.07)',color:catFilter===c?'#00d97e':'#4a5a6a',background:catFilter===c?'rgba(0,217,126,0.08)':'transparent'}}>
                  {catLabels[c]}
                </button>
              ))}
            </div>
            <div style={{flex:1,overflowY:'auto'}}>
              {filteredAssets.map(a=>{
                const isSel = sel?.id===a.id;
                return (
                  <div key={a.id} onClick={()=>selectAsset(a)}
                    style={{display:'flex',alignItems:'center',gap:7,padding:'7px 8px',borderBottom:'1px solid rgba(255,255,255,0.03)',cursor:'pointer',background:isSel?'rgba(0,217,126,0.06)':'transparent',borderLeft:isSel?'2px solid #00d97e':'2px solid transparent'}}>
                    <div style={{width:26,height:26,borderRadius:6,background:ASSET_COLORS[a.cat]||'#0a1a0a',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,flexShrink:0}}>{a.icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#c8d8e8'}}>{a.name}</div>
                      <div style={{fontSize:9,color:'#3a4a5a',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.sub}</div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontFamily:'var(--mono)',fontSize:10,color:'#8a9aaa'}}>{fmtPrice(a.price)}</div>
                      <div style={{fontSize:9,fontWeight:700,color:a.chg>=0?'#00d97e':'#f0424d'}}>{a.chg>=0?'+':''}{a.chg.toFixed(2)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Center — spike chart + trade controls */}
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0,background:'#050a0f'}}>

            {/* Asset header bar */}
            {selectedAsset && (
              <div style={{padding:'8px 14px',borderBottom:'1px solid rgba(0,255,100,0.07)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between',background:'#060d18'}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:32,height:32,borderRadius:8,background:ASSET_COLORS[selectedAsset.cat]||'#0a1a0a',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15}}>{selectedAsset.icon}</div>
                  <div>
                    <div style={{fontSize:16,fontWeight:800,color:'#e8f8e8'}}>{selectedAsset.name}</div>
                    <div style={{fontSize:10,color:'#3a5a3a'}}>{selectedAsset.sub}{demoMode?' · DEMO':' · Live'}</div>
                  </div>
                  <div style={{marginLeft:16}}>
                    <div style={{fontFamily:'var(--mono)',fontSize:22,fontWeight:500,color:selectedAsset.chg>=0?'#00d97e':'#f0424d'}}>{fmtPrice(selectedAsset.price)}</div>
                    <div style={{fontSize:11,color:selectedAsset.chg>=0?'#00d97e':'#f0424d'}}>
                      {selectedAsset.chg>=0?'▲ +':'▼ '}{Math.abs(selectedAsset.chg).toFixed(2)}%
                    </div>
                  </div>
                </div>
                <div style={{display:'flex',gap:16,fontSize:11}}>
                  {[['H',(selectedAsset.price*1.005).toFixed(3),'#00d97e'],['L',(selectedAsset.price*0.995).toFixed(3),'#f0424d'],['Vol',selectedAsset.vol,'#4d9ef7']].map(([l,v,c])=>(
                    <div key={l} style={{textAlign:'right'}}>
                      <div style={{color:'#3a5a3a',fontSize:9}}>{l}</div>
                      <div style={{fontFamily:'var(--mono)',color:c,fontWeight:600}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Spike chart */}
            <div style={{flex:1,overflow:'hidden',position:'relative',background:'#040c06',minHeight:0}}>
              <canvas ref={canvasRef} className="spike-canvas"/>
            </div>

            {/* Trade controls */}
            <div style={{borderTop:'1px solid rgba(0,255,100,0.1)',background:'#060d18',padding:'10px 14px',flexShrink:0}}>
              {/* Expiry row */}
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,flexWrap:'wrap'}}>
                <span style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'#3a5a3a',flexShrink:0}}>EXPIRY</span>
                {EXPIRY_OPTIONS.map(o=>(
                  <button key={o.key} onClick={()=>setExpiry(o)}
                    style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:20,cursor:'pointer',border:'1px solid',borderColor:expiry.key===o.key?'#00d97e':'rgba(255,255,255,0.07)',color:expiry.key===o.key?'#00d97e':'#4a5a6a',background:expiry.key===o.key?'rgba(0,217,126,0.08)':'transparent',transition:'all .12s'}}>
                    {o.label}
                  </button>
                ))}
                <div style={{marginLeft:'auto',fontFamily:'var(--mono)',fontSize:11,background:'rgba(245,166,35,0.08)',border:'1px solid rgba(245,166,35,0.2)',borderRadius:4,padding:'3px 8px',color:'#f5a623'}}>
                  Payout: {payoutRate}%
                </div>
              </div>
              {/* Stake row */}
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,flexWrap:'wrap'}}>
                <span style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'#3a5a3a',flexShrink:0}}>STAKE</span>
                <div style={{display:'flex',alignItems:'center',gap:5,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'5px 10px'}}>
                  <span style={{fontSize:10,fontWeight:700,color:'#4a6a4a'}}>KES</span>
                  <input type="number" value={stake} onChange={e=>setStake(Number(e.target.value))} min={50}
                    style={{border:'none',background:'transparent',fontFamily:'var(--mono)',fontSize:14,fontWeight:500,width:85,padding:0,color:'#e8f8e8',outline:'none'}}/>
                </div>
                {[500,1000,2000,5000].map(v=>(
                  <button key={v} onClick={()=>setStake(v)}
                    style={{fontSize:10,fontWeight:600,padding:'4px 9px',borderRadius:5,cursor:'pointer',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',color:'#4a6a4a',transition:'all .12s'}}>
                    {v>=1000?`${v/1000}K`:v}
                  </button>
                ))}
                <div style={{marginLeft:'auto',textAlign:'right'}}>
                  <div style={{fontSize:9,color:'#3a5a3a'}}>Est. return</div>
                  <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:500,color:'#00d97e'}}>KES {estReturn.toLocaleString()}</div>
                </div>
              </div>
              {/* Trade buttons */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <button onClick={()=>placeTrade('CALL')} disabled={tradingBusy||(!demoMode&&!settings?.tradingEnabled)}
                  style={{padding:'13px 8px',border:'none',borderRadius:8,background:'#00d97e',color:'#001a00',fontWeight:800,fontSize:14,cursor:'pointer',opacity:tradingBusy?0.7:1,lineHeight:1.3}}>
                  ▲ CALL (UP)<br/><span style={{fontSize:10,fontWeight:500,opacity:0.7}}>Price will rise</span>
                </button>
                <button onClick={()=>placeTrade('PUT')} disabled={tradingBusy||(!demoMode&&!settings?.tradingEnabled)}
                  style={{padding:'13px 8px',border:'none',borderRadius:8,background:'#f0424d',color:'#fff',fontWeight:800,fontSize:14,cursor:'pointer',opacity:tradingBusy?0.7:1,lineHeight:1.3}}>
                  ▼ PUT (DOWN)<br/><span style={{fontSize:10,fontWeight:500,opacity:0.7}}>Price will fall</span>
                </button>
              </div>
              {!demoMode&&!settings?.tradingEnabled&&<div style={{marginTop:8,textAlign:'center',fontSize:11,color:'#f5a623'}}>⚠️ Trading disabled by admin</div>}
            </div>
          </div>

          {/* Right — open positions + LIVE CHAT */}
          <div style={{width:240,flexShrink:0,borderLeft:'1px solid rgba(0,255,100,0.07)',display:'flex',flexDirection:'column',overflow:'hidden',background:'#060d18'}}>

            {/* Open positions */}
            <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:1.2,color:'#3a5a3a',padding:'8px 12px 6px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
              Positions {demoMode&&<span style={{color:'#f5a623'}}>·DEMO</span>}
            </div>
            <div style={{maxHeight:160,overflowY:'auto',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
              {activePositions.length===0&&<div style={{padding:'12px',textAlign:'center',fontSize:10,color:'#2a3a2a'}}>No open positions</div>}
              {activePositions.map(p=>{
                const pct=Math.min(((p.elapsedSec||0)/(p.totalSec||p.expirySec||300))*100,100);
                const rem=Math.max(0,(p.totalSec||p.expirySec||300)-(p.elapsedSec||0));
                const col=p.direction==='CALL'?'#00d97e':'#f0424d';
                return (
                  <div key={p.id} style={{padding:'8px 12px',borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#c8d8e8'}}>{p.asset}</div>
                      <span style={{fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:20,background:p.direction==='CALL'?'rgba(0,217,126,0.15)':'rgba(240,66,77,0.15)',color:col}}>{p.direction}</span>
                    </div>
                    <div style={{fontSize:10,color:'#3a5a3a'}}>KES {p.stake?.toLocaleString()}</div>
                    <div style={{fontFamily:'var(--mono)',fontSize:10,color:col,marginTop:2}}>{rem>=60?`${Math.ceil(rem/60)}m`:`${rem}s`} remaining</div>
                    <div style={{height:2,background:'rgba(255,255,255,0.05)',borderRadius:2,marginTop:5}}>
                      <div style={{width:`${pct}%`,height:'100%',background:col,borderRadius:2,transition:'width 1s linear'}}/>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* LIVE CHAT */}
            <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:1.2,color:'#3a5a3a',padding:'8px 12px 6px',borderBottom:'1px solid rgba(255,255,255,0.05)',display:'flex',alignItems:'center',gap:6}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:'#00d97e',boxShadow:'0 0 5px #00d97e'}}/>
              LIVE CHAT
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'6px 0'}}>
              {chatMessages.map((m,i)=>{
                const isSystem = m.text.startsWith('✅ CONGRATULATIONS') || m.text.startsWith('💰') || m.text.startsWith('🎉');
                return (
                  <div key={m.id} className="chat-msg"
                    style={{padding:'4px 10px',fontSize:11,lineHeight:1.5,borderBottom:'1px solid rgba(255,255,255,0.02)'}}>
                    {isSystem
                      ? <span style={{color:'#00d97e',fontWeight:600}}><span style={{color:'#2a6a3a',fontWeight:700,marginRight:4}}>System:</span>{m.text}</span>
                      : <span style={{color:'#8aa8a8'}}>{m.text}</span>
                    }
                  </div>
                );
              })}
              <div ref={chatEndRef}/>
            </div>

            {/* Stats mini */}
            <div style={{borderTop:'1px solid rgba(255,255,255,0.05)',padding:8}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                {(demoMode?[
                  ['Demo Bal',`KES ${demoBalance.toLocaleString()}`,'#00d97e'],
                  ['Trades',demoHistory.length,'#c8d8e8'],
                  ['Wins',demoHistory.filter(t=>t.result==='WIN').length,'#00d97e'],
                  ['Win%',demoHistory.length>0?`${Math.round(demoHistory.filter(t=>t.result==='WIN').length/demoHistory.length*100)}%`:'—','#4d9ef7'],
                ]:[
                  ['Win Rate',stats?`${stats.winRate}%`:'—',stats?.winRate>50?'#00d97e':'#c8d8e8'],
                  ['Today',stats?`${stats.todayPL>=0?'+':''}${stats.todayPL?.toLocaleString()}`:'—',stats?.todayPL>=0?'#00d97e':'#f0424d'],
                  ['Trades',stats?.tradeCount??'—','#c8d8e8'],
                  ['Profit',stats?fmtKES(stats.totalProfit):'—','#00d97e'],
                ]).map(([l,v,c])=>(
                  <div key={l} style={{background:'rgba(255,255,255,0.03)',borderRadius:4,padding:'6px 8px',border:'1px solid rgba(255,255,255,0.04)'}}>
                    <div style={{fontSize:8,textTransform:'uppercase',letterSpacing:'.8px',color:'#2a4a2a',marginBottom:2}}>{l}</div>
                    <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:500,color:c}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>)}

        {/* SIGNALS TAB */}
        {activeTab==='signals'&&(
          <div style={{padding:20,overflowY:'auto',height:'100%'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:15,fontWeight:800}}>AI Prediction Signals</div>
              <button className="btn btn-sm" onClick={()=>marketAPI.signals().then(r=>setSignals(r.data)).catch(()=>{})}>↻ Refresh</button>
            </div>
            <div className="card" style={{padding:0,overflow:'hidden'}}>
              {signals.map(s=>(
                <div key={s.assetId} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderBottom:'1px solid var(--border)'}}>
                  <div style={{width:32,height:32,borderRadius:8,background:'#0a1a0a',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>{s.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700}}>{s.name}</div>
                    <div style={{fontSize:11,color:'var(--muted)',marginBottom:4}}>{s.conf}% confidence · RSI: {s.rsi}</div>
                    <div style={{height:3,background:'var(--surface3)',borderRadius:2}}>
                      <div style={{width:`${s.conf}%`,height:'100%',borderRadius:2,background:s.direction==='CALL'?'#00d97e':'#f0424d'}}/>
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:s.direction==='CALL'?'rgba(0,217,126,0.12)':'rgba(240,66,77,0.12)',color:s.direction==='CALL'?'#00d97e':'#f0424d'}}>{s.direction}</span>
                    <div style={{fontSize:10,color:'var(--muted)',marginTop:4}}>{s.trend}</div>
                  </div>
                </div>
              ))}
              {signals.length===0&&<div style={{padding:30,textAlign:'center',color:'var(--muted)'}}>Loading signals...</div>}
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab==='history'&&(
          <div style={{padding:20,overflowY:'auto',height:'100%'}}>
            <div style={{fontSize:15,fontWeight:800,marginBottom:16}}>Trade History {demoMode&&<span style={{color:'#00d97e',fontSize:12}}>[DEMO]</span>}</div>
            <div className="card" style={{padding:0,overflow:'hidden'}}>
              <table>
                <thead><tr><th>Asset</th><th>Dir</th><th>Stake</th><th>Result</th><th>P/L</th><th>Time</th></tr></thead>
                <tbody>
                  {activeHistory.length===0&&<tr><td colSpan={6} style={{textAlign:'center',color:'var(--muted)',padding:30}}>No trades yet</td></tr>}
                  {activeHistory.map(t=>(
                    <tr key={t.id}>
                      <td><div style={{fontWeight:700}}>{t.asset}</div><div style={{fontSize:10,color:'var(--muted)'}}>{t.expiryLabel}</div></td>
                      <td><span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:t.direction==='CALL'?'rgba(0,217,126,0.12)':'rgba(240,66,77,0.12)',color:t.direction==='CALL'?'#00d97e':'#f0424d'}}>{t.direction}</span></td>
                      <td style={{fontFamily:'var(--mono)'}}>KES {t.stake?.toLocaleString()}</td>
                      <td><span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:t.result==='WIN'?'rgba(0,217,126,0.12)':t.result==='PENDING'?'rgba(245,166,35,0.12)':'rgba(240,66,77,0.12)',color:t.result==='WIN'?'#00d97e':t.result==='PENDING'?'#f5a623':'#f0424d'}}>{t.result}</span></td>
                      <td style={{fontFamily:'var(--mono)',color:t.payout>=0?'#00d97e':'#f0424d',fontWeight:600}}>{t.payout!=null?`${t.payout>=0?'+':''}${t.payout.toLocaleString()}`:'—'}</td>
                      <td style={{fontSize:11,color:'var(--muted)'}}>{t.settledAt?new Date(t.settledAt).toLocaleString('en-KE'):'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* WALLET TAB */}
        {activeTab==='wallet'&&!demoMode&&(
          <div style={{padding:20,overflowY:'auto',height:'100%'}}>
            <div style={{fontSize:15,fontWeight:800,marginBottom:16}}>Wallet & Transactions</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
              {[['Balance',`KES ${balance.toLocaleString()}`,'#f5a623'],['Total Deposited',`KES ${stats?.totalDeposited?.toLocaleString()||0}`,'#00d97e'],['Total Withdrawn',`KES ${stats?.totalWithdrawn?.toLocaleString()||0}`,'var(--muted)']].map(([l,v,c])=>(
                <div key={l} className="card-sm" style={{textAlign:'center'}}>
                  <div className="label">{l}</div>
                  <div style={{fontFamily:'var(--mono)',fontSize:18,fontWeight:500,color:c}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:10,marginBottom:20}}>
              <button style={{flex:1,height:42,borderRadius:8,border:'none',background:'#00d97e',color:'#001a00',fontWeight:800,fontSize:13,cursor:'pointer'}} onClick={()=>setShowDeposit(true)}>📱 Deposit via M-Pesa</button>
              <button style={{flex:1,height:42,borderRadius:8,border:'1px solid rgba(245,166,35,0.4)',background:'rgba(245,166,35,0.08)',color:'#f5a623',fontWeight:800,fontSize:13,cursor:'pointer'}} onClick={()=>setShowWithdraw(true)}>💸 Withdraw to M-Pesa</button>
            </div>
            <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>Transaction History</div>
            <div className="card" style={{padding:0,overflow:'hidden'}}>
              <table>
                <thead><tr><th>Type</th><th>Amount</th><th>Status</th><th>Date</th><th>Notes</th></tr></thead>
                <tbody>
                  {transactions.length===0&&<tr><td colSpan={5} style={{textAlign:'center',color:'var(--muted)',padding:30}}>No transactions yet</td></tr>}
                  {transactions.map(t=>(
                    <tr key={t.id}>
                      <td><span className={`badge ${t.type==='deposit'?'badge-green':t.type==='withdrawal'?'badge-gold':'badge-blue'}`}>{t.type.replace('_',' ')}</span></td>
                      <td style={{fontFamily:'var(--mono)',fontWeight:600}}>KES {t.amount?.toLocaleString()}</td>
                      <td><span className={`badge ${t.status==='success'?'badge-green':t.status==='pending'?'badge-gold':t.status==='demo'?'badge-blue':'badge-red'}`}>{t.status}</span></td>
                      <td style={{fontSize:11,color:'var(--muted)'}}>{new Date(t.createdAt).toLocaleString('en-KE')}</td>
                      <td style={{fontSize:11,color:'var(--muted)'}}>{t.notes||t.mpesaRef||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STATS TAB */}
        {activeTab==='stats'&&(
          <div style={{padding:20,overflowY:'auto',height:'100%'}}>
            <div style={{fontSize:15,fontWeight:800,marginBottom:16}}>{demoMode?'Demo Performance':'My Performance'}</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
              {(demoMode?[
                ['Demo Balance',`KES ${demoBalance.toLocaleString()}`,'#f5a623'],
                ['Total Trades',demoHistory.length,'#c8d8e8'],
                ['Wins',demoHistory.filter(t=>t.result==='WIN').length,'#00d97e'],
                ['Win Rate',demoHistory.length>0?`${Math.round(demoHistory.filter(t=>t.result==='WIN').length/demoHistory.length*100)}%`:'—','#4d9ef7'],
              ]:[
                ['Total Profit',`KES ${stats?.totalProfit?.toLocaleString()||0}`,'#00d97e'],
                ['Total Loss',`KES ${stats?.totalLoss?.toLocaleString()||0}`,'#f0424d'],
                ['Win Rate',`${stats?.winRate||0}%`,stats?.winRate>50?'#00d97e':'#c8d8e8'],
                ['Total Trades',stats?.tradeCount||0,'#c8d8e8'],
              ]).map(([l,v,c])=>(
                <div key={l} className="card-sm" style={{textAlign:'center'}}>
                  <div className="label">{l}</div>
                  <div style={{fontFamily:'var(--mono)',fontSize:20,fontWeight:500,color:c}}>{v}</div>
                </div>
              ))}
            </div>
            <div className="card-sm">
              <div className="label" style={{marginBottom:10}}>Recent Results</div>
              {activeHistory.slice(0,10).map(t=>(
                <div key={t.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                  <span style={{fontSize:12,fontWeight:600,color:'#c8d8e8'}}>{t.asset} · {t.direction}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:t.result==='WIN'?'rgba(0,217,126,0.12)':'rgba(240,66,77,0.12)',color:t.result==='WIN'?'#00d97e':'#f0424d'}}>{t.result}</span>
                  <span style={{fontFamily:'var(--mono)',fontSize:12,color:t.payout>=0?'#00d97e':'#f0424d'}}>{t.payout!=null?`${t.payout>=0?'+':''}${t.payout.toLocaleString()}`:'—'}</span>
                </div>
              ))}
              {activeHistory.length===0&&<div style={{textAlign:'center',color:'var(--muted)',padding:20,fontSize:12}}>No trades yet</div>}
            </div>
          </div>
        )}
      </div>

      {showDeposit&&<DepositModal balance={balance} onSuccess={onDepositSuccess} onClose={()=>setShowDeposit(false)}/>}
      {showWithdraw&&<WithdrawModal balance={balance} onSuccess={onWithdrawSuccess} onClose={()=>setShowWithdraw(false)}/>}
    </div>
  );
}
