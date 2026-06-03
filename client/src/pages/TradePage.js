import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { marketAPI, tradeAPI, userAPI, settingsAPI } from '../utils/api';
import DepositModal from '../components/DepositModal';
import WithdrawModal from '../components/WithdrawModal';
import {
  ledger, generateSignal, ouNext,
  riskCheck, calcStreak, marketStatus,
} from '../utils/trading';

// ── helpers ────────────────────────────────────────────────────
const fp  = p => { if(p==null)return'—';if(p>=10000)return p.toFixed(2);if(p>=100)return p.toFixed(3);if(p>=1)return p.toFixed(4);return p.toFixed(5); };
const fk  = n => { if(n==null)return'—';const a=Math.abs(n);if(a>=1e6)return(n/1e6).toFixed(2)+'M';if(a>=1e3)return(n/1e3).toFixed(1)+'K';return n.toLocaleString(); };
const clk = s => { if(s<=0)return'00:00';return`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; };
const sgn = (n,d=4)=>n!=null?(n>=0?'+':'')+n.toFixed(d):'—';

// ── Assets ─────────────────────────────────────────────────────
const BASE=[
  {id:'usdkes',name:'USD/KES',sub:'Forex',    icon:'💵',cat:'forex', price:132.45,chg: 0.23,vol:'2.4M'},
  {id:'eurkes',name:'EUR/KES',sub:'Forex',    icon:'💶',cat:'forex', price:143.80,chg:-0.41,vol:'1.8M'},
  {id:'gbpkes',name:'GBP/KES',sub:'Forex',    icon:'🏴',cat:'forex', price:167.20,chg: 0.18,vol:'890K'},
  {id:'usdjpy',name:'USD/JPY',sub:'Forex',    icon:'¥', cat:'forex', price:149.85,chg:-0.32,vol:'5.1B'},
  {id:'btcusd',name:'BTC/USD',sub:'Crypto',   icon:'₿', cat:'crypto',price:68420, chg: 2.15,vol:'12B'},
  {id:'ethusd',name:'ETH/USD',sub:'Crypto',   icon:'◆', cat:'crypto',price:3245.6,chg: 1.08,vol:'4.2B'},
  {id:'solusd',name:'SOL/USD',sub:'Crypto',   icon:'◉', cat:'crypto',price:178.40,chg:-0.73,vol:'1.1B'},
  {id:'safcom',name:'SCOM',   sub:'NSE',      icon:'📡',cat:'nse',   price:17.40, chg:-0.57,vol:'14M'},
  {id:'eqbnk', name:'EQTY',   sub:'NSE',      icon:'🏦',cat:'nse',   price:52.75, chg: 1.32,vol:'5.8M'},
  {id:'kenol', name:'KENO',   sub:'NSE',      icon:'⛽',cat:'nse',   price:14.20, chg:-0.28,vol:'2.1M'},
  {id:'eabl',  name:'EABL',   sub:'NSE',      icon:'🍺',cat:'nse',   price:145.50,chg: 0.69,vol:'3.4M'},
  {id:'gold',  name:'XAU/USD',sub:'Commodity',icon:'🥇',cat:'comm',  price:2348.5,chg: 0.65,vol:'52B'},
  {id:'oil',   name:'WTI',    sub:'Commodity',icon:'🛢', cat:'comm',  price:78.32, chg:-0.44,vol:'18B'},
];

// ── Chat messages ──────────────────────────────────────────────
const NMS=['Wanjiku','Kamau','Otieno','Njoroge','Achieng','Mwangi','Chebet','Odhiambo','Waweru','Kipchoge','Adhiambo','Mutua','Wairimu','Omondi','Kariuki','Nekesa','Gathoni','Simiyu','Wacera','Rotich','Njoki','Makau','Auma','Kirui','Mumbi','Juma','Wambui','Korir','Awino','Muigai','Zawadi','Barasa','Kamene','Nyambura'];
const ANS=['USD/KES','EUR/KES','BTC/USD','ETH/USD','SCOM','XAU/USD','WTI','EQTY','GBP/KES','SOL/USD','KENO','EABL'];
const rN=()=>NMS[Math.floor(Math.random()*NMS.length)];
const rA=()=>ANS[Math.floor(Math.random()*ANS.length)];
const rV=(a=100,b=9000)=>Math.floor(Math.random()*(b-a)+a);
function gMsg(){
  const p=[
    ()=>`🎉 ${rN()} just won KES ${rV().toLocaleString()} on ${rA()}!`,
    ()=>`System: CONGRATULATIONS @${rN()} on your withdrawal of ${rV(200,8000).toLocaleString()} 🥳🥳`,
    ()=>`System: CONGRATULATIONS @${rN()} on your withdrawal of ${rV(100,5000).toLocaleString()} 🥳🥳`,
    ()=>`💸 ${rN()} withdrew KES ${rV(500,20000).toLocaleString()} to M-Pesa`,
    ()=>`🔥 ${rN()} placed KES ${rV().toLocaleString()} CALL on ${rA()}`,
    ()=>`📈 ${rN()} on a win streak! +KES ${rV(300,6000).toLocaleString()}`,
    ()=>`${rN()}: BONUS of ${rV(10,100).toLocaleString()} has been issued.`,
    ()=>`💰 ${rN()} cashed out KES ${rV(1000,25000).toLocaleString()}! 🥳`,
    ()=>`⚡ ${rN()} deposited KES ${rV(500,10000).toLocaleString()} and started trading!`,
    ()=>`System: CONGRATULATIONS @${rN()} withdrawal of KES ${rV(300,12000).toLocaleString()} confirmed 🎉`,
    ()=>`🎯 ${rN()} won KES ${rV(200,5000).toLocaleString()} on PUT ${rA()}`,
    ()=>`System: CONGRATULATIONS @${rN()} on your WIN of KES ${rV(500,8000).toLocaleString()} 🎊🎊`,
  ];
  return p[Math.floor(Math.random()*p.length)]();
}

// ── CHART ─────────────────────────────────────────────────────
function drawChart(canvas, data, liveRate, entryRate, dir, tradeOn, sig, tradeProgress) {
  if (!canvas || data.length < 2) return;
  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.offsetWidth;
  const H   = canvas.offsetHeight;
  if (!W || !H) return;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // background
  ctx.fillStyle = '#0b1120';
  ctx.fillRect(0, 0, W, H);

  // dynamic range based on actual data
  const visible = data.slice(-120);
  const dMax = Math.max(...visible, 0.05);
  const dMin = Math.min(...visible, -0.05);
  const pad  = (dMax - dMin) * 0.25 || 0.06;
  const MX   = dMax + pad;
  const MN   = dMin - pad;
  const rng  = MX - MN;

  const pL=60, pR=14, pT=48, pB=36;
  const cW = W - pL - pR;
  const cH = H - pT - pB;
  const px  = i => pL + (i / (visible.length - 1)) * cW;
  const py  = v => pT + cH - ((v - MN) / rng) * cH;
  const zY  = py(0);
  const up  = liveRate >= 0;

  // grid
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const v = MN + (rng / steps) * i;
    const y = py(v);
    if (y < pT - 2 || y > pT + cH + 2) continue;
    const isZero = Math.abs(v) < rng / (steps * 2);
    ctx.strokeStyle = isZero ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.05)';
    ctx.lineWidth   = isZero ? 1.5 : 1;
    ctx.setLineDash(isZero ? [] : [3, 5]);
    ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(W - pR, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle   = isZero ? 'rgba(220,235,255,0.9)' : 'rgba(120,140,175,0.55)';
    ctx.font        = `${isZero ? 'bold ' : ''}10px "DM Mono",monospace`;
    ctx.textAlign   = 'right';
    ctx.fillText((v >= 0 ? '+' : '') + v.toFixed(3), pL - 5, y + 3.5);
  }
  // vertical grid
  for (let i = 0; i <= 5; i++) {
    const x = pL + (cW / 5) * i;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, pT); ctx.lineTo(x, pT + cH); ctx.stroke();
  }

  // green fill above zero
  const gG = ctx.createLinearGradient(0, pT, 0, Math.min(zY, pT + cH));
  gG.addColorStop(0, 'rgba(0,220,112,0.60)');
  gG.addColorStop(0.5, 'rgba(0,200,90,0.25)');
  gG.addColorStop(1, 'rgba(0,180,80,0.03)');
  ctx.beginPath();
  ctx.moveTo(px(0), Math.min(py(visible[0]), zY));
  for (let i = 0; i < visible.length; i++) ctx.lineTo(px(i), Math.min(py(visible[i]), zY));
  ctx.lineTo(px(visible.length - 1), Math.min(zY, pT + cH));
  ctx.lineTo(px(0), Math.min(zY, pT + cH));
  ctx.closePath(); ctx.fillStyle = gG; ctx.fill();

  // red fill below zero
  const rG = ctx.createLinearGradient(0, Math.max(zY, pT), 0, pT + cH);
  rG.addColorStop(0, 'rgba(220,30,60,0.03)');
  rG.addColorStop(0.5, 'rgba(210,20,50,0.28)');
  rG.addColorStop(1, 'rgba(200,10,40,0.62)');
  ctx.beginPath();
  ctx.moveTo(px(0), Math.max(py(visible[0]), zY));
  for (let i = 0; i < visible.length; i++) ctx.lineTo(px(i), Math.max(py(visible[i]), zY));
  ctx.lineTo(px(visible.length - 1), Math.max(zY, pT));
  ctx.lineTo(px(0), Math.max(zY, pT));
  ctx.closePath(); ctx.fillStyle = rG; ctx.fill();

  // EMA20
  if (sig?.ema20 != null) {
    const ey = py(sig.ema20);
    if (ey >= pT && ey <= pT + cH) {
      ctx.strokeStyle = 'rgba(245,192,64,0.50)';
      ctx.lineWidth = 1.2; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(pL, ey); ctx.lineTo(W - pR, ey); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(245,192,64,0.65)';
      ctx.font = '9px "DM Mono",monospace'; ctx.textAlign = 'left';
      ctx.fillText('EMA', pL + 4, ey - 3);
    }
  }

  // Bollinger bands
  if (sig?.bbUpper != null && sig?.bbLower != null) {
    [sig.bbUpper, sig.bbLower].forEach(v => {
      const y = py(v);
      if (y < pT - 2 || y > pT + cH + 2) return;
      ctx.strokeStyle = 'rgba(59,158,255,0.25)';
      ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(W - pR, y); ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  // main line — thick, bright, coloured per segment
  for (let i = 1; i < visible.length; i++) {
    const c = visible[i] >= 0 ? '#00e882' : '#ff2d55';
    ctx.beginPath();
    ctx.moveTo(px(i - 1), py(visible[i - 1]));
    ctx.lineTo(px(i), py(visible[i]));
    ctx.strokeStyle = c;
    ctx.lineWidth   = 2.8;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.stroke();
  }

  // entry line
  if (tradeOn && entryRate != null) {
    const ey = py(entryRate);
    if (ey >= pT - 4 && ey <= pT + cH + 4) {
      const col = dir === 'CALL' ? '#4dabff' : '#ffaa44';
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([8, 4]);
      ctx.beginPath(); ctx.moveTo(pL, ey); ctx.lineTo(W - pR, ey); ctx.stroke();
      ctx.setLineDash([]);

      // trade progress fill between entry and current
      const curY = py(liveRate);
      const winning = (dir === 'CALL' && liveRate > entryRate) || (dir === 'PUT' && liveRate < entryRate);
      const fillTop    = Math.min(ey, curY);
      const fillBottom = Math.max(ey, curY);
      const fillH      = fillBottom - fillTop;
      if (fillH > 1) {
        ctx.fillStyle = winning ? 'rgba(0,232,130,0.14)' : 'rgba(255,45,85,0.12)';
        ctx.fillRect(pL, fillTop, cW, fillH);
      }

      const lbl = `${dir === 'CALL' ? '▲' : '▼'} ${dir} @ ${entryRate >= 0 ? '+' : ''}${entryRate.toFixed(4)}`;
      const tw  = ctx.measureText(lbl).width + 16;
      ctx.fillStyle = col + 'dd';
      ctx.beginPath(); ctx.roundRect(pL + 6, ey - 13, tw, 24, 4); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px "DM Mono",monospace'; ctx.textAlign = 'left';
      ctx.fillText(lbl, pL + 14, ey + 4);

      // payout accumulation arc
      if (tradeProgress != null && tradeProgress > 0) {
        const arcX = W - pR - 38, arcY = pT + 38, arcR = 30;
        const winPct = Math.min(tradeProgress, 1);
        ctx.strokeStyle = winning ? '#00e882' : '#ff2d55';
        ctx.lineWidth   = 4;
        ctx.beginPath();
        ctx.arc(arcX, arcY, arcR, -Math.PI / 2, -Math.PI / 2 + winPct * Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#e2e8f8';
        ctx.font = 'bold 10px "DM Mono",monospace'; ctx.textAlign = 'center';
        ctx.fillText(Math.round(winPct * 50) + '%', arcX, arcY + 4);
      }
    }
  }

  // live dot with pulsing halo
  const lx  = px(visible.length - 1);
  const ly  = py(visible[visible.length - 1]);
  const dc  = up ? '#00e882' : '#ff2d55';
  [28, 16, 7].forEach((r, i) => {
    ctx.beginPath(); ctx.arc(lx, ly, r, 0, Math.PI * 2);
    ctx.fillStyle = up
      ? `rgba(0,232,130,${[0.07, 0.18, 1][i]})`
      : `rgba(255,45,85,${[0.07, 0.18, 1][i]})`;
    ctx.fill();
  });

  // rate badge — white box with coloured border
  const rs  = (liveRate >= 0 ? '+' : '') + liveRate.toFixed(4);
  const bW  = 210, bH = 46, bX = W / 2 - bW / 2, bY = 2;
  ctx.shadowColor = dc; ctx.shadowBlur = 22;
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = dc; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(bX, bY, bW, bH, 9); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle  = up ? '#005c28' : '#aa001a';
  ctx.font       = 'bold 19px "DM Mono",monospace'; ctx.textAlign = 'center';
  ctx.fillText('Rate: ' + rs, bX + bW / 2, bY + 31);

  // signal badge top-right
  if (sig) {
    const sc  = sig.direction === 'CALL' ? '#00e882' : '#ff2d55';
    const sw2 = 62, sh = 38, sx = W - pR - sw2, sy2 = pT + 4;
    ctx.fillStyle = sc + '20'; ctx.strokeStyle = sc + '88'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(sx, sy2, sw2, sh, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = sc; ctx.font = 'bold 12px "DM Mono",monospace'; ctx.textAlign = 'center';
    ctx.fillText(sig.direction === 'CALL' ? '▲ CALL' : '▼ PUT', sx + sw2 / 2, sy2 + 16);
    ctx.font = '9px "DM Mono",monospace';
    ctx.fillText(sig.confidence + '% conf', sx + sw2 / 2, sy2 + 30);
  }

  // time axis
  ctx.fillStyle = 'rgba(100,115,150,0.65)';
  ctx.font = '9px "DM Mono",monospace'; ctx.textAlign = 'center';
  const now = new Date();
  for (let i = 0; i <= 4; i++) {
    const x  = pL + (cW / 4) * i;
    const dt = new Date(now - (4 - i) * 12000); // faster time labels
    ctx.fillText(dt.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), x, pT + cH + 27);
  }

  // border
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
  ctx.strokeRect(pL, pT, cW, cH);
}

// ══════════════════════════════════════════════════════════════
export default function TradePage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const canvasRef  = useRef(null);
  const chatBoxRef = useRef(null);
  const ratesBuf   = useRef([]);
  const animFrame  = useRef(null);
  const lastDrawRef= useRef(0);

  // responsive
  const [sw, setSw] = useState(window.innerWidth);
  const [sh, setSh] = useState(window.innerHeight);
  useEffect(() => {
    const f = () => { setSw(window.innerWidth); setSh(window.innerHeight); };
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  const mob  = sw < 680;
  const itab = sw >= 680 && sw < 1060;

  // PWA install
  const [installEvt, setInstallEvt] = useState(null);
  const [installed,  setInstalled]  = useState(false);
  useEffect(() => {
    const h = e => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener('beforeinstallprompt', h);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  const doInstall = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    const { outcome } = await installEvt.userChoice;
    if (outcome === 'accepted') { setInstalled(true); setInstallEvt(null); }
  };

  // blockchain
  const [chainOk,  setChainOk]  = useState(true);
  const [ledStat,  setLedStat]  = useState(() => ledger.stats());
  const [lastHash, setLastHash] = useState('');
  useEffect(() => { ledger.verify().then(setChainOk).catch(() => setChainOk(false)); }, []);

  // demo
  const [demo,  setDemo]  = useState(false);
  const [dBal,  setDBal]  = useState(10000);
  const [dAsset,setDA]    = useState(BASE);
  const [dHist, setDH]    = useState([]);

  // real
  const [assets,  setAssets]  = useState([]);
  const [sel,     setSel]     = useState(null);
  const [hist,    setHist]    = useState([]);
  const [txns,    setTxns]    = useState([]);
  const [stats,   setStats]   = useState(null);
  const [cfg,     setCfg]     = useState(null);
  const [bal,     setBal]     = useState(user?.balance || 0);

  // chart
  const [rate,   setRate]   = useState(0);
  const [sig,    setSig]    = useState(null);
  const [mkt,    setMkt]    = useState(() => marketStatus());

  // trade
  const [trade,  setTrade]  = useState(null);
  // trade.status: 'waiting' | 'active' | 'settling' | 'won' | 'lost'
  // waiting = placed, waiting for next candle flip

  // UI
  const [tab,     setTab]     = useState('trade');
  const [mobTab,  setMobTab]  = useState('chart');
  const [catF,    setCatF]    = useState('all');
  const [sq,      setSq]      = useState('');
  const [exp,     setExp]     = useState({ label:'1m', key:'1m', sec:60 });
  const [stake,   setStake]   = useState(500);
  const [showDep, setShowDep] = useState(false);
  const [showWd,  setShowWd]  = useState(false);

  // Accumulation state — grows 0→50% of stake while winning
  const [accumPct, setAccumPct] = useState(0); // 0–50
  const [tradeProgress, setTradeProgress] = useState(0); // 0–1 for arc

  // Chat
  const [chat, setChat] = useState(() => {
    const s = [];
    for (let i = 0; i < 18; i++) s.push({ id: i, txt: gMsg() });
    return s;
  });
  const [onlineN] = useState(Math.floor(140 + Math.random() * 120));

  // derived
  const AA   = demo ? dAsset : assets;
  const AB   = demo ? dBal   : bal;
  const AH   = demo ? dHist  : hist;
  const sel2 = sel ? AA.find(a => a.id === sel.id) || sel : null;
  const payR = cfg?.payoutRates?.[exp.key] || 86;
  // max payout is 50% of stake (as per requirement)
  const MAX_PAYOUT = Math.round(stake * 0.50);
  const potW = MAX_PAYOUT;
  const up   = rate >= 0;
  const streak = calcStreak(AH);
  const risk   = riskCheck(stake, AB, cfg?.minStake || 50, cfg?.maxStake || 100000);

  // ── Seed chart ──────────────────────────────────────────────
  useEffect(() => {
    const s = []; let v = 0;
    for (let i = 0; i < 180; i++) {
      v = ouNext(v, 0.07, 0.0025, 0);
      s.push(v);
    }
    ratesBuf.current = s;
    setRate(s[s.length - 1]);
    setSig(generateSignal(s));
  }, [sel]);

  // ── Fast chart animation via rAF ────────────────────────────
  // Speed: ~8 ticks/second (125ms interval), fast visible movement
  useEffect(() => {
    let last = 0;
    const INTERVAL = 130; // ms between ticks — fast but smooth

    const tick = (ts) => {
      animFrame.current = requestAnimationFrame(tick);
      if (ts - last < INTERVAL) return;
      last = ts;

      const prev = ratesBuf.current;
      const lastV = prev[prev.length - 1] || 0;
      // faster volatility during active trade
      const vol = trade?.status === 'active' ? 0.0045 : 0.0025;
      const nx  = ouNext(lastV, 0.05, vol, 0);
      const nd  = [...prev.slice(-249), nx];
      ratesBuf.current = nd;
      setRate(nx);

      // draw inline — no state tick needed
      const on = trade?.status === 'active';
      drawChart(
        canvasRef.current, nd, nx,
        on ? trade.entryRate : null,
        on ? trade.dir : null,
        on, sig,
        tradeProgress
      );

      // Accumulation logic: while trade active, grow payout 0→50%
      if (trade?.status === 'active') {
        const elapsed  = trade.expSec - trade.rem;
        const pct      = Math.min(elapsed / trade.expSec, 1);
        const winning  = (trade.dir === 'CALL' && nx > trade.entryRate) || (trade.dir === 'PUT' && nx < trade.entryRate);
        // payout grows linearly toward 50% only while winning
        const newAccum = winning ? Math.round(pct * 50) : 0;
        setAccumPct(newAccum);
        setTradeProgress(pct);
      }
    };

    animFrame.current = requestAnimationFrame(tick);
    return () => { if (animFrame.current) cancelAnimationFrame(animFrame.current); };
  }, [trade, sig, tradeProgress]);

  // ── Update signal every 8s ──────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      setSig(generateSignal(ratesBuf.current));
      setMkt(marketStatus());
    }, 8000);
    return () => clearInterval(iv);
  }, []);

  // ── Waiting trade: activate on next candle (3s) ─────────────
  useEffect(() => {
    if (!trade || trade.status !== 'waiting') return;
    const t = setTimeout(() => {
      // snap entry to current live rate
      setTrade(prev => prev ? ({
        ...prev,
        status:    'active',
        entryRate: ratesBuf.current[ratesBuf.current.length - 1],
      }) : null);
    }, 3000);
    return () => clearTimeout(t);
  }, [trade?.status]);

  // ── Trade countdown ─────────────────────────────────────────
  useEffect(() => {
    if (!trade || trade.status !== 'active') return;
    const iv = setInterval(() => {
      setTrade(prev => {
        if (!prev || prev.status !== 'active') return prev;
        const curRate = ratesBuf.current[ratesBuf.current.length - 1];
        const rem     = prev.rem - 1;
        const winning = (prev.dir==='CALL' && curRate > prev.entryRate) || (prev.dir==='PUT' && curRate < prev.entryRate);
        const elapsed = prev.expSec - rem;
        const pct     = Math.min(elapsed / prev.expSec, 1);
        const livePnl = winning ? Math.round(pct * 50 * prev.stake / 100) : 0;
        if (rem <= 0) return { ...prev, rem:0, winning, livePnl, status:'settling' };
        return { ...prev, rem, winning, livePnl };
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [trade?.status]);

  // ── Settle ──────────────────────────────────────────────────
  useEffect(() => {
    if (!trade || trade.status !== 'settling') return;
    const curRate = ratesBuf.current[ratesBuf.current.length - 1];
    const won     = (trade.dir==='CALL' && curRate > trade.entryRate) || (trade.dir==='PUT' && curRate < trade.entryRate);
    // payout = 50% of stake if won, 0 if lost (stake already deducted)
    const pnl  = won ? trade.potW : -trade.stake;
    const rec  = {
      id: 't'+Date.now(), asset: sel2?.name, direction: trade.dir,
      stake: trade.stake, result: won?'WIN':'LOSS', payout: pnl,
      expiryLabel: trade.expLabel, entryRate: trade.entryRate,
      exitRate: curRate, settledAt: new Date().toISOString(),
    };

    // blockchain
    ledger.addTrade({ ...rec, userId: user?.id||'local' }).then(block => {
      setLastHash(block.hash.slice(0,22)+'…');
      setLedStat(ledger.stats());
    });

    if (demo) { setDBal(b => won ? b + trade.potW : b); setDH(h => [rec,...h.slice(0,49)]); }
    else {
      setBal(b => won ? b + trade.potW : b);
      setHist(h => [rec,...h.slice(0,49)]);
      tradeAPI.place({ asset:sel2?.name, direction:trade.dir, stake:trade.stake, expirySec:trade.expSec, expiryLabel:trade.expLabel, entryPrice:sel2?.price }).catch(()=>{});
    }

    const msg = won
      ? `System: CONGRATULATIONS @${user?.username||'Trader'} on your WIN of KES ${trade.potW.toLocaleString()} on ${sel2?.name} 🎉🎉`
      : `💪 ${user?.username||'Trader'} closed a trade on ${sel2?.name}.`;
    setChat(p => [...p, { id:Date.now(), txt:msg }].slice(-80));

    setTrade({ ...trade, status:won?'won':'lost', pnl, exitRate:curRate });
    setAccumPct(0); setTradeProgress(0);
    toast(won ? `🎉 WIN! +KES ${trade.potW.toLocaleString()}` : `Loss — KES ${trade.stake.toLocaleString()}`, won?'success':'error');
    setTimeout(() => setTrade(null), 5000);
  }, [trade?.status]);

  // ── Chat scroll ─────────────────────────────────────────────
  useEffect(() => {
    const el = chatBoxRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight;
  }, [chat]);

  useEffect(() => {
    let t;
    const s = () => { t = setTimeout(() => { setChat(p => [...p,{id:Date.now(),txt:gMsg()}].slice(-80)); s(); }, 900+Math.random()*2600); };
    s(); return () => clearTimeout(t);
  }, []);

  // ── Data load ───────────────────────────────────────────────
  useEffect(() => {
    if (demo) return;
    settingsAPI.public().then(r=>setCfg(r.data)).catch(()=>{});
    userAPI.stats().then(r=>{setStats(r.data);setBal(r.data.balance);}).catch(()=>{});
    userAPI.trades().then(r=>setHist(r.data)).catch(()=>{});
    userAPI.transactions().then(r=>setTxns(r.data)).catch(()=>{});
  }, [demo]);

  useEffect(() => {
    if (demo) return;
    const load = () => marketAPI.assets().then(r=>{setAssets(r.data);if(!sel&&r.data.length)setSel(r.data[0]);}).catch(()=>{});
    load(); const iv = setInterval(load, 3000); return () => clearInterval(iv);
  }, [sel, demo]);

  useEffect(() => {
    if (!demo) return;
    if (!sel) setSel(BASE[0]);
    const iv = setInterval(() => {
      setDA(p => p.map(a => {
        const d = (Math.random()-0.495)*a.price*0.0015;
        return { ...a, price:Math.max(0.01,a.price+d), chg:Math.max(-9.99,Math.min(9.99,a.chg+(Math.random()-0.5)*0.05)) };
      }));
    }, 1500);
    return () => clearInterval(iv);
  }, [demo, sel]);

  // ── Place trade ─────────────────────────────────────────────
  const place = useCallback(dir => {
    if (trade && (trade.status==='active'||trade.status==='waiting')) {
      toast('A trade is already running — wait for settlement','error'); return;
    }
    const rc = riskCheck(stake, AB, cfg?.minStake||50, cfg?.maxStake||100000);
    if (!rc.ok) { toast(rc.msg,'error'); return; }
    // deduct immediately
    if (demo) setDBal(b => b - stake); else setBal(b => b - stake);
    // status = 'waiting' — activates on next candle (3s)
    setTrade({
      dir, entryRate: ratesBuf.current[ratesBuf.current.length-1],
      stake, potW: MAX_PAYOUT,
      rem: exp.sec, expSec: exp.sec, expLabel: exp.key,
      status: 'waiting', livePnl: 0, winning: false,
    });
    toast(`${dir} order placed — activating on next candle…`, 'info');
  }, [trade, stake, AB, MAX_PAYOUT, exp, demo, cfg]);

  const filtered = AA.filter(a => {
    if (catF!=='all' && a.cat!==catF) return false;
    if (sq && !a.name.toLowerCase().includes(sq.toLowerCase())) return false;
    return true;
  });

  const EXPS = [
    {label:'30s',key:'30s',sec:30},
    {label:'1m', key:'1m', sec:60},
    {label:'5m', key:'5m', sec:300},
    {label:'15m',key:'15m',sec:900},
    {label:'30m',key:'30m',sec:1800},
  ];

  // theme
  const C = {
    bg:'#080d18', surf:'#0f1826', s2:'#162030', s3:'#1c2840',
    bd:'rgba(255,255,255,0.07)', bd2:'rgba(255,255,255,0.12)',
    txt:'#dde6f8', mu:'#5a6a88', mu2:'#303e58',
    gr:'#00e882', gd:'rgba(0,232,130,0.13)',
    rd:'#ff2d55', rd2:'rgba(255,45,85,0.13)',
    go:'#f5c040', yd:'rgba(245,192,64,0.13)',
    bl:'#3b9eff', bd3:'rgba(59,158,255,0.13)',
  };

  const Pill = ({ active, col, bg, onClick, children, style={} }) => (
    <button onClick={onClick} style={{
      padding:'4px 11px', borderRadius:20,
      border:`1px solid ${active?col:C.bd}`,
      color:active?col:C.mu, background:active?bg:'transparent',
      fontSize:10, fontWeight:700, cursor:'pointer',
      transition:'all .12s', whiteSpace:'nowrap', ...style,
    }}>{children}</button>
  );

  // ── Chat panel ───────────────────────────────────────────────
  const ChatPanel = () => (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <div style={{ background:'#007a25', padding:'9px 14px', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        <div style={{ width:7,height:7,borderRadius:'50%',background:'#7eff7e' }}/>
        <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Live Chat</span>
        <span style={{ fontSize:9, color:'rgba(255,255,255,.7)', marginLeft:4 }}>{onlineN} online</span>
      </div>
      <div ref={chatBoxRef} style={{ flex:1, overflowY:'auto', overflowX:'hidden', background:C.s2 }}>
        {chat.map(m => {
          const sys = m.txt.startsWith('System:');
          const ci  = m.txt.indexOf(':'); const hc = ci>0 && ci<22;
          return (
            <div key={m.id} style={{ padding:'5px 12px', borderBottom:`1px solid ${C.bd}`, lineHeight:1.55, fontSize:12 }}>
              {hc
                ? <><span style={{ fontWeight:800, color:sys?'#ff8833':C.bl }}>{m.txt.slice(0,ci)}:</span>
                    <span style={{ color:sys&&m.txt.includes('CONGRATULATIONS')?'#ffaa44':C.mu }}>{m.txt.slice(ci+1)}</span></>
                : <span style={{ color:C.mu }}>{m.txt}</span>
              }
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Asset list ───────────────────────────────────────────────
  const AssetList = ({ onPick }) => (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <div style={{ padding:'7px', borderBottom:`1px solid ${C.bd}`, flexShrink:0 }}>
        <input value={sq} onChange={e=>setSq(e.target.value)} placeholder="Search…"
          style={{ width:'100%', background:C.s2, border:`1px solid ${C.bd2}`, borderRadius:6, padding:'6px 10px', color:C.txt, fontSize:12, outline:'none' }}/>
      </div>
      <div style={{ display:'flex', gap:3, padding:'5px 7px', borderBottom:`1px solid ${C.bd}`, flexWrap:'wrap', flexShrink:0 }}>
        {['all','forex','crypto','nse','comm'].map(c => (
          <Pill key={c} active={catF===c} col={C.bl} bg={C.bd3} onClick={()=>setCatF(c)}>
            {c==='all'?'All':c==='comm'?'Comm':c.charAt(0).toUpperCase()+c.slice(1)}
          </Pill>
        ))}
      </div>
      <div style={{ flex:1, overflowY:'auto', overflowX:'hidden' }}>
        {filtered.map(a => {
          const s = sel?.id===a.id;
          const catBg = {forex:'#1e3a5f',crypto:'#2d1b4e',nse:'#0d3320',comm:'#3d2600'}[a.cat]||C.s2;
          return (
            <div key={a.id} onClick={()=>{ setSel(a); if(onPick)onPick(); }}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 10px', borderBottom:`1px solid ${C.bd}`, cursor:'pointer', background:s?C.bd3:'transparent', borderLeft:`3px solid ${s?C.bl:'transparent'}`, transition:'background .1s' }}>
              <div style={{ width:28, height:28, borderRadius:7, background:catBg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0 }}>{a.icon}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.txt }}>{a.name}</div>
                <div style={{ fontSize:9, color:C.mu2 }}>{a.sub}</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontFamily:'monospace', fontSize:11, color:C.txt, fontWeight:600 }}>{fp(a.price)}</div>
                <div style={{ fontSize:9, fontWeight:700, color:a.chg>=0?C.gr:C.rd }}>{a.chg>=0?'+':''}{a.chg.toFixed(2)}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Indicator strip ──────────────────────────────────────────
  const IndicatorStrip = () => {
    if (!sig) return null;
    const items = [
      {l:'RSI',    v:sig.rsi,                    c:sig.rsi<35?C.gr:sig.rsi>65?C.rd:C.mu},
      {l:'MACD',   v:sgn(sig.macd,4),            c:sig.macd>0?C.gr:C.rd},
      {l:'Signal', v:sig.direction==='CALL'?'▲ CALL':'▼ PUT', c:sig.direction==='CALL'?C.gr:C.rd},
      {l:'Conf',   v:sig.confidence+'%',          c:sig.confidence>70?C.gr:sig.confidence>55?C.go:C.rd},
      {l:'Trend',  v:sig.trend,                   c:sig.trend==='BULLISH'?C.gr:sig.trend==='BEARISH'?C.rd:C.mu},
      {l:'Market', v:mkt.label,                   c:mkt.color},
    ];
    if (lastHash) items.push({l:'Block',v:lastHash.slice(0,12)+'…',c:chainOk?C.gr:C.rd});
    return (
      <div style={{ display:'flex', background:C.s2, borderBottom:`1px solid ${C.bd}`, overflowX:'auto', flexShrink:0 }}>
        {items.map(({l,v,c}) => (
          <div key={l} style={{ padding:'4px 12px', borderRight:`1px solid ${C.bd}`, flexShrink:0 }}>
            <div style={{ fontSize:8, color:C.mu2, textTransform:'uppercase', letterSpacing:.8 }}>{l}</div>
            <div style={{ fontFamily:'monospace', fontSize:11, fontWeight:700, color:c }}>{v}</div>
          </div>
        ))}
      </div>
    );
  };

  // ── Trade status bar ─────────────────────────────────────────
  const TradeBanner = () => {
    if (!trade) return null;

    if (trade.status === 'waiting') {
      return (
        <div style={{ background:'rgba(59,158,255,0.10)', borderTop:`2px solid ${C.bl}`, borderBottom:`1px solid ${C.bd}`, padding:'8px 14px', flexShrink:0, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:C.bl, animation:'pulse 1s infinite' }}/>
            <span style={{ fontSize:13, fontWeight:800, color:C.bl }}>{trade.dir} ORDER PLACED</span>
          </div>
          <span style={{ fontSize:11, color:C.mu }}>Waiting for next candle to activate…</span>
          <div style={{ marginLeft:'auto', fontSize:11, color:C.mu }}>KES {trade.stake.toLocaleString()} · {trade.expLabel} expiry</div>
        </div>
      );
    }

    if (trade.status === 'active') {
      const pct     = Math.round(((trade.expSec - trade.rem) / trade.expSec) * 100);
      const earning = Math.round(pct / 100 * 50 * trade.stake / 100);
      return (
        <div style={{ background:trade.winning?'rgba(0,232,130,0.07)':'rgba(255,45,85,0.07)', borderTop:`2px solid ${trade.winning?C.gr:C.rd}`, borderBottom:`1px solid ${C.bd}`, padding:'8px 14px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6 }}>
            {/* direction */}
            <div style={{ display:'flex', alignItems:'center', gap:6, background:trade.dir==='CALL'?C.gd:C.rd2, border:`1.5px solid ${trade.dir==='CALL'?C.gr:C.rd}`, borderRadius:8, padding:'5px 11px' }}>
              <span style={{ fontSize:16 }}>{trade.dir==='CALL'?'▲':'▼'}</span>
              <div>
                <div style={{ fontSize:12, fontWeight:900, color:trade.dir==='CALL'?C.gr:C.rd }}>{trade.dir}</div>
                <div style={{ fontSize:9, color:C.mu }}>KES {trade.stake.toLocaleString()}</div>
              </div>
            </div>
            {/* countdown */}
            <div style={{ textAlign:'center', minWidth:60 }}>
              <div style={{ fontFamily:'monospace', fontSize:mob?22:28, fontWeight:900, color:trade.rem<=10?C.rd:C.txt, lineHeight:1 }}>{clk(trade.rem)}</div>
              <div style={{ fontSize:9, color:C.mu }}>remaining</div>
            </div>
            {/* live accumulation */}
            <div style={{ textAlign:'center', minWidth:90 }}>
              <div style={{ fontSize:9, color:C.mu, marginBottom:2 }}>Accumulating</div>
              <div style={{ fontFamily:'monospace', fontSize:mob?16:20, fontWeight:900, color:trade.winning?C.gr:C.mu, lineHeight:1 }}>
                {trade.winning ? `+KES ${earning.toLocaleString()}` : 'KES 0'}
              </div>
              <div style={{ fontSize:9, color:C.mu }}>{trade.winning?accumPct+'% of max':'losing'}  </div>
            </div>
            {/* max payout */}
            <div style={{ textAlign:'center', minWidth:80 }}>
              <div style={{ fontSize:9, color:C.mu }}>Max payout</div>
              <div style={{ fontFamily:'monospace', fontSize:14, fontWeight:700, color:C.go }}>+KES {trade.potW.toLocaleString()}</div>
              <div style={{ fontSize:9, color:C.mu2 }}>at 50% stake</div>
            </div>
            {/* status */}
            <div style={{ marginLeft:'auto', textAlign:'right' }}>
              <div style={{ fontSize:13, fontWeight:800, color:trade.winning?C.gr:C.rd }}>{trade.winning?'✅ Winning':'❌ Losing'}</div>
              <div style={{ fontSize:10, color:C.mu }}>Rate: <span style={{ fontFamily:'monospace', color:up?C.gr:C.rd }}>{rate>=0?'+':''}{rate.toFixed(4)}</span></div>
            </div>
          </div>
          {/* progress bar */}
          <div style={{ height:6, background:C.s3, borderRadius:3, overflow:'hidden' }}>
            <div style={{ width:`${pct}%`, height:'100%', borderRadius:3, background:`linear-gradient(90deg,${trade.winning?C.gr:C.rd},${trade.winning?'#00ff80':'#ff4060'})`, transition:'width 1s linear' }}/>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:3, fontSize:9, color:C.mu2 }}>
            <span>Entry: {sgn(trade.entryRate)}</span>
            <span>{pct}% elapsed</span>
            <span>Win: +KES {trade.potW.toLocaleString()} (50% of stake)</span>
          </div>
        </div>
      );
    }

    if (trade.status === 'won' || trade.status === 'lost') {
      return (
        <div style={{ margin:'8px 12px', padding:'13px 18px', background:trade.status==='won'?C.gd:C.rd2, border:`2px solid ${trade.status==='won'?C.gr:C.rd}`, borderRadius:12, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <span style={{ fontSize:32 }}>{trade.status==='won'?'🎉':'😔'}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:mob?15:18, fontWeight:900, color:trade.status==='won'?C.gr:C.rd }}>
              {trade.status==='won' ? `YOU WIN! +KES ${trade.potW.toLocaleString()} (50% of stake)` : `LOSS — KES ${trade.stake.toLocaleString()}`}
            </div>
            <div style={{ fontSize:11, color:C.mu, marginTop:3 }}>
              {trade.dir} · Entry {sgn(trade.entryRate)} → Exit {sgn(trade.exitRate)}
            </div>
            {lastHash && <div style={{ fontSize:9, color:C.mu2, marginTop:2, fontFamily:'monospace' }}>🔗 Block: {lastHash}</div>}
          </div>
        </div>
      );
    }
    return null;
  };

  // ── Main render ─────────────────────────────────────────────
  return (
    <div style={{
      display:'flex', flexDirection:'column',
      height:'100vh', width:'100vw', overflow:'hidden',
      background:C.bg, color:C.txt,
      fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",
    }}>
      <style>{`
        @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}
        @keyframes pop{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;}
        html,body,#root{height:100%;overflow:hidden;}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:#1c2840;border-radius:4px;}
        button:active{transform:scale(.95)!important;}
      `}</style>

      {/* ══ HEADER ══ */}
      <header style={{
        height:mob?50:56,
        background:C.surf, borderBottom:`1px solid ${C.bd2}`,
        display:'flex', alignItems:'center',
        padding:`0 ${mob?10:18}px`, gap:mob?5:10,
        flexShrink:0, zIndex:100,
        boxShadow:'0 2px 24px rgba(0,0,0,0.6)',
      }}>
        <div style={{ fontWeight:900, fontSize:mob?15:20, letterSpacing:'-0.5px', flexShrink:0 }}>
          Trade<span style={{ color:C.gr }}>Flow</span><span style={{ color:C.bl, fontSize:mob?11:14 }}> Pro</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background:demo?C.go:C.gr, boxShadow:`0 0 8px ${demo?C.go:C.gr}` }}/>
          <span style={{ fontSize:9, color:demo?C.go:C.gr, fontWeight:800, letterSpacing:1.5 }}>{demo?'DEMO':'LIVE'}</span>
        </div>
        {!mob && (
          <div style={{ display:'flex', alignItems:'center', gap:5, padding:'2px 9px', background:chainOk?C.gd:C.rd2, border:`1px solid ${chainOk?C.gr:C.rd}33`, borderRadius:6, flexShrink:0 }}>
            <span style={{ fontSize:9 }}>🔗</span>
            <span style={{ fontSize:9, fontWeight:700, color:chainOk?C.gr:C.rd }}>{chainOk?'Ledger OK':'Chain ⚠'}</span>
          </div>
        )}
        {installEvt && !installed && (
          <button onClick={doInstall}
            style={{ height:mob?28:32, padding:`0 ${mob?8:12}px`, borderRadius:7, border:`1px solid ${C.bl}55`, background:C.bd3, color:C.bl, fontWeight:700, fontSize:mob?9:11, cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', gap:4 }}>
            📲 {mob?'Install':'Install App'}
          </button>
        )}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:mob?5:9 }}>
          {/* balance */}
          <div style={{ background:C.s2, border:`1px solid ${C.bd2}`, borderRadius:8, padding:mob?'3px 7px':'4px 12px', flexShrink:0 }}>
            <div style={{ fontSize:8, color:C.mu2, fontWeight:700, textTransform:'uppercase', letterSpacing:1 }}>{demo?'Demo':'Balance'}</div>
            <div style={{ fontFamily:'monospace', fontSize:mob?12:14, fontWeight:700, color:demo?C.gr:C.go }}>KES {AB.toLocaleString()}</div>
          </div>
          {!demo ? (
            <>
              <button onClick={()=>{setDemo(true);setSel(BASE[0]);toast('🎮 Demo — KES 10,000 virtual','info');}}
                style={{ height:mob?28:32, padding:`0 ${mob?7:11}px`, borderRadius:7, border:`1px solid ${C.bd2}`, background:C.s2, color:C.mu, fontWeight:700, fontSize:mob?9:11, cursor:'pointer', flexShrink:0 }}>
                🎮 Demo
              </button>
              <button onClick={()=>setShowDep(true)}
                style={{ height:mob?28:32, padding:`0 ${mob?7:12}px`, borderRadius:7, border:'none', background:`linear-gradient(135deg,#009944,${C.gr})`, color:'#001a00', fontWeight:800, fontSize:mob?9:11, cursor:'pointer', flexShrink:0, boxShadow:'0 2px 12px rgba(0,160,80,0.38)' }}>
                📱 {mob?'Dep':'Deposit'}
              </button>
              {!mob && (
                <button onClick={()=>setShowWd(true)}
                  style={{ height:32, padding:'0 11px', borderRadius:7, border:`1px solid ${C.go}55`, background:C.yd, color:C.go, fontWeight:700, fontSize:11, cursor:'pointer', flexShrink:0 }}>
                  💸 Withdraw
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={()=>{setDBal(10000);setDH([]);setTrade(null);setAccumPct(0);toast('Demo reset','info');}}
                style={{ height:mob?28:32, padding:`0 7px`, borderRadius:7, border:`1px solid ${C.gr}44`, background:C.gd, color:C.gr, fontWeight:700, fontSize:mob?9:11, cursor:'pointer', flexShrink:0 }}>
                ↺{mob?'':' Reset'}
              </button>
              <button onClick={()=>{setDemo(false);setSel(assets[0]||null);setTrade(null);setAccumPct(0);}}
                style={{ height:mob?28:32, padding:`0 ${mob?7:11}px`, borderRadius:7, border:'none', background:C.gr, color:'#001a00', fontWeight:800, fontSize:mob?9:11, cursor:'pointer', flexShrink:0 }}>
                → {mob?'Live':'Go Live'}
              </button>
            </>
          )}
          <div onClick={logout} title="Logout"
            style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,#1e3a8a,#3b9eff)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, cursor:'pointer', color:'#fff', flexShrink:0 }}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
        </div>
      </header>

      {/* demo notice */}
      {demo && (
        <div style={{ background:'#100d00', borderBottom:`1px solid ${C.go}44`, padding:'4px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexShrink:0 }}>
          <span style={{ fontSize:mob?10:12, color:C.go }}>🎮 <strong>Demo Mode</strong> <span style={{ color:C.mu, fontSize:11 }}>— KES 10,000 virtual. No real money.</span></span>
          <div style={{ display:'flex', gap:5, flexShrink:0 }}>
            {mob && <>
              <button onClick={()=>setShowDep(true)} style={{ height:24,padding:'0 8px',borderRadius:5,border:'none',background:C.gr,color:'#001a00',fontWeight:800,fontSize:10,cursor:'pointer' }}>Dep</button>
              <button onClick={()=>setShowWd(true)} style={{ height:24,padding:'0 8px',borderRadius:5,border:`1px solid ${C.go}55`,background:C.yd,color:C.go,fontWeight:700,fontSize:10,cursor:'pointer' }}>Wd</button>
            </>}
            <button onClick={()=>{setDemo(false);setSel(assets[0]||null);setTrade(null);}}
              style={{ height:24,padding:'0 9px',borderRadius:5,border:`1px solid ${C.go}55`,background:C.yd,color:C.go,fontWeight:700,fontSize:10,cursor:'pointer' }}>→ Live</button>
          </div>
        </div>
      )}

      {/* tabs */}
      <div style={{ background:C.surf, borderBottom:`1px solid ${C.bd}`, display:'flex', padding:`0 ${mob?4:14}px`, overflowX:'auto', flexShrink:0 }}>
        {[['trade','📈 Trade'],['signals','⚡ Signals'],['history','📋 History'],...(!demo?[['wallet','💳 Wallet']]:[]),['stats','📊 Stats'],['ledger','🔗 Ledger']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{ padding:mob?'9px 9px':'11px 16px', background:'transparent', border:'none', borderBottom:`3px solid ${tab===k?C.bl:'transparent'}`, color:tab===k?C.bl:C.mu, fontWeight:700, fontSize:mob?10:12, cursor:'pointer', whiteSpace:'nowrap', transition:'all .15s' }}>
            {mob ? l.split(' ')[0] : l}
          </button>
        ))}
        {mob && !demo && (
          <button onClick={()=>setShowWd(true)} style={{ marginLeft:'auto', padding:'9px 9px', background:'transparent', border:'none', borderBottom:'3px solid transparent', color:C.go, fontWeight:700, fontSize:10, cursor:'pointer' }}>💸</button>
        )}
      </div>

      {/* ticker */}
      <div style={{ background:'#0b1120', borderBottom:`1px solid ${C.bd}`, height:26, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center' }}>
        <div style={{ display:'flex', whiteSpace:'nowrap', animation:'ticker 44s linear infinite', willChange:'transform' }}>
          {[...AA,...AA].map((a,i)=>(
            <span key={i} onClick={()=>setSel(a)}
              style={{ fontFamily:'monospace', fontSize:10, padding:'0 14px', display:'inline-flex', alignItems:'center', gap:5, borderRight:`1px solid ${C.bd}`, cursor:'pointer', flexShrink:0 }}>
              <span style={{ color:C.mu2, fontWeight:600 }}>{a.name}</span>
              <span style={{ color:C.mu }}>{fp(a.price)}</span>
              <span style={{ color:a.chg>=0?C.gr:C.rd, fontWeight:700 }}>{a.chg>=0?'▲':'▼'}{Math.abs(a.chg).toFixed(2)}%</span>
            </span>
          ))}
        </div>
      </div>

      {/* ══ CONTENT ══ */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', minHeight:0 }}>

        {/* ─ TRADE TAB ─ */}
        {tab==='trade' && (
          <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>

            {/* left sidebar */}
            {!mob && (
              <div style={{ width:itab?175:215, flexShrink:0, borderRight:`1px solid ${C.bd}`, display:'flex', flexDirection:'column', overflow:'hidden', background:C.surf }}>
                <AssetList/>
              </div>
            )}

            {/* center */}
            <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

              {mob && (
                <div style={{ display:'flex', background:C.s2, borderBottom:`1px solid ${C.bd}`, flexShrink:0 }}>
                  {[['chart','📈'],['assets','🌐'],['chat','💬']].map(([k,l])=>(
                    <button key={k} onClick={()=>setMobTab(k)}
                      style={{ flex:1, padding:'8px 2px', background:'transparent', border:'none', borderBottom:`2px solid ${mobTab===k?C.bl:'transparent'}`, color:mobTab===k?C.bl:C.mu, fontWeight:700, fontSize:11, cursor:'pointer' }}>
                      {l} {k==='chart'?'Chart':k==='assets'?'Markets':'Chat'}
                    </button>
                  ))}
                </div>
              )}

              {mob && mobTab==='assets' && (
                <div style={{ flex:1, overflow:'hidden', background:C.surf, display:'flex', flexDirection:'column' }}>
                  <AssetList onPick={()=>setMobTab('chart')}/>
                </div>
              )}
              {mob && mobTab==='chat' && (
                <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
                  <ChatPanel/>
                </div>
              )}

              {(!mob || mobTab==='chart') && (
                <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>

                  {/* asset bar */}
                  {sel2 && (
                    <div style={{ padding:mob?'6px 10px':'8px 16px', borderBottom:`1px solid ${C.bd}`, flexShrink:0, background:C.surf, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:32,height:32,borderRadius:8,background:{forex:'#1e3a5f',crypto:'#2d1b4e',nse:'#0d3320',comm:'#3d2600'}[sel2.cat]||C.s2,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0 }}>{sel2.icon}</div>
                        <div>
                          <div style={{ fontSize:mob?13:18,fontWeight:900 }}>{sel2.name}</div>
                          <div style={{ fontSize:9,color:C.mu2 }}>{sel2.sub} {demo?'· DEMO':'· Live'}</div>
                        </div>
                        <div style={{ marginLeft:mob?6:14 }}>
                          <div style={{ fontFamily:'monospace',fontSize:mob?16:22,fontWeight:700,color:sel2.chg>=0?C.gr:C.rd,lineHeight:1 }}>{fp(sel2.price)}</div>
                          <div style={{ fontSize:10,fontWeight:700,color:sel2.chg>=0?C.gr:C.rd,marginTop:2 }}>{sel2.chg>=0?'▲ +':'▼ '}{Math.abs(sel2.chg).toFixed(2)}%</div>
                        </div>
                      </div>
                      {!mob && (
                        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                          {[['Vol',sel2.vol,C.bl],['H',fp(sel2.price*1.005),C.gr],['L',fp(sel2.price*0.995),C.rd]].map(([l,v,c])=>(
                            <div key={l} style={{ textAlign:'center' }}>
                              <div style={{ fontSize:9,color:C.mu2,fontWeight:700 }}>{l}</div>
                              <div style={{ fontFamily:'monospace',fontSize:12,color:c,fontWeight:700 }}>{v}</div>
                            </div>
                          ))}
                          <div style={{ padding:'5px 12px',background:up?C.gd:C.rd2,border:`1px solid ${up?C.gr:C.rd}33`,borderRadius:8,textAlign:'center' }}>
                            <div style={{ fontSize:9,color:C.mu2 }}>RATE</div>
                            <div style={{ fontFamily:'monospace',fontSize:15,fontWeight:900,color:up?C.gr:C.rd }}>{rate>=0?'+':''}{rate.toFixed(4)}</div>
                          </div>
                          {sig && (
                            <div style={{ padding:'5px 12px',background:sig.direction==='CALL'?C.gd:C.rd2,border:`1px solid ${sig.direction==='CALL'?C.gr:C.rd}33`,borderRadius:8,textAlign:'center' }}>
                              <div style={{ fontSize:9,color:C.mu2 }}>AI Signal</div>
                              <div style={{ fontSize:12,fontWeight:900,color:sig.direction==='CALL'?C.gr:C.rd }}>{sig.direction==='CALL'?'▲ CALL':'▼ PUT'} {sig.confidence}%</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* indicator strip */}
                  <IndicatorStrip/>

                  {/* trade banner */}
                  <TradeBanner/>

                  {/* ═ CHART — large, fills remaining space ═ */}
                  <div style={{
                    flex:1,
                    background:'#0b1120',
                    overflow:'hidden',
                    minHeight:mob ? Math.max(sh*0.32, 180) : Math.max(sh*0.38, 260),
                    position:'relative',
                  }}>
                    <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }}/>
                    {/* live rate overlay — mobile */}
                    {mob && (
                      <div style={{ position:'absolute', bottom:38, right:10, fontFamily:'monospace', fontSize:11, fontWeight:700, color:up?C.gr:C.rd, background:C.surf+'cc', padding:'2px 7px', borderRadius:5 }}>
                        {rate>=0?'+':''}{rate.toFixed(4)}
                      </div>
                    )}
                  </div>

                  {/* ═ TRADE PANEL ═ */}
                  <div style={{ background:C.surf, borderTop:`1px solid ${C.bd2}`, padding:mob?'9px 11px':'11px 18px', flexShrink:0 }}>
                    {/* expiry row */}
                    <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:8, flexWrap:'wrap' }}>
                      <span style={{ fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:1.5,color:C.mu2,flexShrink:0 }}>EXPIRY</span>
                      {EXPS.map(o=><Pill key={o.key} active={exp.key===o.key} col={C.bl} bg={C.bd3} onClick={()=>setExp(o)}>{o.label}</Pill>)}
                      <div style={{ marginLeft:'auto',fontFamily:'monospace',fontSize:11,background:C.yd,border:`1px solid ${C.go}44`,borderRadius:6,padding:'3px 9px',color:C.go,fontWeight:700,flexShrink:0 }}>
                        50% payout
                      </div>
                    </div>
                    {/* stake row */}
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:9, flexWrap:'wrap' }}>
                      <span style={{ fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:1.5,color:C.mu2,flexShrink:0 }}>STAKE</span>
                      <div style={{ display:'flex', alignItems:'center', gap:4, background:C.s2, border:`1.5px solid ${C.bd2}`, borderRadius:8, padding:'6px 11px' }}>
                        <span style={{ fontSize:10,fontWeight:700,color:C.mu2 }}>KES</span>
                        <input type="number" value={stake} onChange={e=>setStake(Number(e.target.value))} min={50}
                          style={{ border:'none',background:'transparent',fontFamily:'monospace',fontSize:15,fontWeight:700,width:82,padding:0,color:C.txt,outline:'none' }}/>
                      </div>
                      {[500,1000,2000,5000].map(v=>(
                        <Pill key={v} active={stake===v} col={C.bl} bg={C.bd3} onClick={()=>setStake(v)} style={{fontSize:10,padding:'4px 9px'}}>{v>=1000?`${v/1000}K`:v}</Pill>
                      ))}
                      <div style={{ marginLeft:'auto', textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:9,color:C.mu2 }}>Max return</div>
                        <div style={{ fontFamily:'monospace',fontSize:13,fontWeight:700,color:C.gr }}>+KES {MAX_PAYOUT.toLocaleString()}</div>
                      </div>
                    </div>
                    {/* risk warning */}
                    {!risk.ok && (
                      <div style={{ marginBottom:8,padding:'4px 10px',background:C.rd2,border:`1px solid ${C.rd}44`,borderRadius:6,fontSize:10,color:C.rd }}>⚠️ {risk.msg}</div>
                    )}
                    {risk.ok && risk.riskLevel==='HIGH' && (
                      <div style={{ marginBottom:8,padding:'4px 10px',background:C.yd,border:`1px solid ${C.go}44`,borderRadius:6,fontSize:10,color:C.go }}>
                        ⚠️ High risk: {risk.riskPct?.toFixed(0)}% of balance
                      </div>
                    )}
                    {/* CALL / PUT */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      {[['CALL','▲ CALL','Price rises',C.gr,'linear-gradient(135deg,#007a30,#00e882)','rgba(0,160,80,0.38)'],
                        ['PUT', '▼ PUT', 'Price falls',C.rd,'linear-gradient(135deg,#a00020,#ff2d55)','rgba(200,0,50,0.38)']].map(([dir,lbl,sub,col,bg,sh2])=>(
                        <button key={dir} onClick={()=>place(dir)}
                          disabled={!risk.ok||(trade?.status==='active'||trade?.status==='waiting')}
                          style={{ padding:mob?'12px 5px':'15px 5px', border:'none', borderRadius:10,
                            background:(!risk.ok||(trade?.status==='active'||trade?.status==='waiting'))?C.s3:bg,
                            color:(!risk.ok||(trade?.status==='active'||trade?.status==='waiting'))?C.mu:'#fff',
                            fontWeight:900, fontSize:mob?13:15,
                            cursor:(!risk.ok||(trade?.status==='active'||trade?.status==='waiting'))?'not-allowed':'pointer',
                            boxShadow:(!risk.ok||(trade?.status==='active'||trade?.status==='waiting'))?'none':`0 4px 18px ${sh2}`,
                            lineHeight:1.3, transition:'all .15s' }}>
                          {lbl}<br/><span style={{ fontSize:9,fontWeight:400,opacity:.75 }}>{sub} · 50% max profit</span>
                        </button>
                      ))}
                    </div>
                    {(trade?.status==='active'||trade?.status==='waiting') && (
                      <div style={{ marginTop:6,textAlign:'center',fontSize:11,color:C.mu,fontStyle:'italic' }}>
                        {trade?.status==='waiting'?'Order placed — waiting for next candle…':'Trade running — wait for settlement'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* right panel — position + stats + chat */}
            {!mob && (
              <div style={{ width:itab?195:245, flexShrink:0, borderLeft:`1px solid ${C.bd}`, display:'flex', flexDirection:'column', overflow:'hidden', background:C.surf }}>
                {/* position */}
                <div style={{ borderBottom:`1px solid ${C.bd}`, flexShrink:0 }}>
                  <div style={{ padding:'8px 12px', fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:1.5, color:C.mu2, borderBottom:`1px solid ${C.bd}` }}>
                    Position {demo && <span style={{ color:C.go }}>· DEMO</span>}
                  </div>
                  {trade?.status==='active' ? (
                    <div style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:12,fontWeight:700 }}>{sel2?.name}</span>
                        <span style={{ fontSize:9,fontWeight:700,padding:'2px 8px',borderRadius:20,background:trade.dir==='CALL'?C.gd:C.rd2,color:trade.dir==='CALL'?C.gr:C.rd }}>{trade.dir}</span>
                      </div>
                      <div style={{ fontSize:10,color:C.mu,marginBottom:5 }}>KES {trade.stake.toLocaleString()} · Max: +{trade.potW.toLocaleString()}</div>
                      <div style={{ fontFamily:'monospace',fontSize:30,fontWeight:900,color:trade.rem<=10?C.rd:C.bl,lineHeight:1,marginBottom:4 }}>{clk(trade.rem)}</div>
                      {/* accumulation display */}
                      <div style={{ marginBottom:6 }}>
                        <div style={{ display:'flex',justifyContent:'space-between',fontSize:9,color:C.mu2,marginBottom:3 }}>
                          <span>Accumulating</span>
                          <span style={{ color:trade.winning?C.gr:C.mu }}>{accumPct}% of max</span>
                        </div>
                        <div style={{ height:8,background:C.s3,borderRadius:4,overflow:'hidden' }}>
                          <div style={{ width:`${accumPct*2}%`,height:'100%',background:`linear-gradient(90deg,${C.go},${C.gr})`,transition:'width .5s',borderRadius:4 }}/>
                        </div>
                        <div style={{ fontFamily:'monospace',fontSize:13,fontWeight:700,color:trade.winning?C.gr:C.mu,marginTop:3 }}>
                          {trade.winning?`+KES ${Math.round(accumPct/100*trade.potW).toLocaleString()}`:'KES 0'}
                        </div>
                      </div>
                      <div style={{ height:4,background:C.s3,borderRadius:2,overflow:'hidden',marginBottom:5 }}>
                        <div style={{ width:`${Math.round(((trade.expSec-trade.rem)/trade.expSec)*100)}%`,height:'100%',background:trade.winning?C.gr:C.rd,transition:'width 1s linear',borderRadius:2 }}/>
                      </div>
                      <div style={{ display:'flex',justifyContent:'space-between',fontSize:9,color:C.mu2 }}>
                        <span>Entry: {trade.entryRate.toFixed(4)}</span>
                        <span style={{ color:trade.winning?C.gr:C.rd }}>{trade.winning?'✅ Win':'❌ Lose'}</span>
                      </div>
                    </div>
                  ) : trade?.status==='waiting' ? (
                    <div style={{ padding:'12px',textAlign:'center' }}>
                      <div style={{ fontSize:11,color:C.bl,fontWeight:700 }}>⏳ Order pending…</div>
                      <div style={{ fontSize:10,color:C.mu,marginTop:4 }}>Activates on next candle</div>
                      <div style={{ fontSize:11,color:C.mu,marginTop:4 }}>{trade.dir} · KES {trade.stake.toLocaleString()}</div>
                    </div>
                  ) : (
                    <div style={{ padding:'14px 12px', textAlign:'center' }}>
                      <div style={{ fontSize:11,color:C.mu2,marginBottom:streak.current>1?6:0 }}>No active trade</div>
                      {streak.current>1 && (
                        <div style={{ fontSize:11,color:streak.type==='WIN'?C.gr:C.rd,fontWeight:700 }}>
                          {streak.type==='WIN'?'🔥':'💔'} {streak.current}-{streak.type} streak!
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {/* mini stats */}
                <div style={{ padding:'8px 10px', borderBottom:`1px solid ${C.bd}`, flexShrink:0 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
                    {(demo?[
                      ['Demo Bal',`${dBal.toLocaleString()}`,C.go],
                      ['Trades',dHist.length,C.txt],
                      ['Wins',dHist.filter(t=>t.result==='WIN').length,C.gr],
                      ['Win%',dHist.length>0?`${Math.round(dHist.filter(t=>t.result==='WIN').length/dHist.length*100)}%`:'—',C.bl],
                    ]:[
                      ['Win Rate',stats?`${stats.winRate}%`:'—',stats?.winRate>50?C.gr:C.txt],
                      ['Today',stats?`${stats.todayPL>=0?'+':''}${(stats.todayPL||0).toLocaleString()}`:'—',(stats?.todayPL||0)>=0?C.gr:C.rd],
                      ['Trades',stats?.tradeCount??'—',C.txt],
                      ['Profit',stats?fk(stats.totalProfit):'—',C.gr],
                    ]).map(([l,v,c])=>(
                      <div key={l} style={{ background:C.s2,borderRadius:6,padding:'7px 9px',border:`1px solid ${C.bd}` }}>
                        <div style={{ fontSize:8,textTransform:'uppercase',letterSpacing:.8,color:C.mu2,marginBottom:2 }}>{l}</div>
                        <div style={{ fontFamily:'monospace',fontSize:13,fontWeight:700,color:c||C.txt }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* chat */}
                <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>
                  <ChatPanel/>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─ SIGNALS TAB ─ */}
        {tab==='signals' && (
          <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', padding:mob?12:24 }}>
            <h2 style={{ fontSize:mob?14:18,fontWeight:800,marginBottom:16,marginTop:0 }}>⚡ AI Technical Analysis</h2>
            {sig ? (
              <>
                <div style={{ background:C.surf,border:`1px solid ${C.bd2}`,borderRadius:12,padding:16,marginBottom:16 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:16,marginBottom:14,flexWrap:'wrap' }}>
                    <div>
                      <div style={{ fontSize:11,color:C.mu,marginBottom:4 }}>Signal for <strong style={{ color:C.txt }}>{sel2?.name||'selected asset'}</strong></div>
                      <div style={{ fontSize:30,fontWeight:900,color:sig.direction==='CALL'?C.gr:C.rd }}>{sig.direction==='CALL'?'▲ CALL':'▼ PUT'}</div>
                      <div style={{ fontSize:13,color:C.mu,marginTop:3 }}>Confidence: <strong style={{ color:sig.confidence>70?C.gr:sig.confidence>55?C.go:C.rd }}>{sig.confidence}%</strong> · <strong style={{ color:sig.trend==='BULLISH'?C.gr:sig.trend==='BEARISH'?C.rd:C.mu }}>{sig.trend}</strong></div>
                    </div>
                    <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,flex:1,minWidth:240 }}>
                      {[
                        ['RSI (14)',sig.rsi,sig.rsi<35?C.gr:sig.rsi>65?C.rd:C.mu],
                        ['MACD',sgn(sig.macd,5),sig.macd>0?C.gr:C.rd],
                        ['EMA 5',sgn(sig.ema5,4),C.go],
                        ['EMA 20',sgn(sig.ema20,4),C.go],
                        ['Stoch %K',sig.stochK+'%',sig.stochK<20?C.gr:sig.stochK>80?C.rd:C.mu],
                        ['Williams',sgn(sig.wr,2),sig.wr<-80?C.gr:sig.wr>-20?C.rd:C.mu],
                        ['ATR',(sig.atr||0).toFixed(5),C.bl],
                        ['Score',sgn(sig.score,2),sig.score>0?C.gr:C.rd],
                        ['Trend Str',sig.trendStr||'—',C.mu],
                      ].map(([l,v,c])=>(
                        <div key={l} style={{ background:C.s2,borderRadius:7,padding:'8px 10px' }}>
                          <div style={{ fontSize:8,color:C.mu2,textTransform:'uppercase',letterSpacing:.8,marginBottom:3 }}>{l}</div>
                          <div style={{ fontFamily:'monospace',fontSize:13,fontWeight:700,color:c }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize:11,fontWeight:700,color:C.mu,marginBottom:8 }}>Reasons:</div>
                  <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
                    {sig.reasons.map((r,i)=>(
                      <div key={i} style={{ padding:'3px 10px',borderRadius:20,background:C.s2,border:`1px solid ${C.bd}`,fontSize:10,color:C.mu }}>• {r}</div>
                    ))}
                  </div>
                </div>
                <div style={{ padding:'12px 16px',background:C.s2,borderRadius:8,border:`1px solid ${C.bd}`,fontSize:11,color:C.mu,lineHeight:1.8 }}>
                  <strong style={{ color:C.txt }}>Algorithms:</strong> RSI(14) · MACD(12,26,9) · Bollinger Bands(20,2σ) · EMA(5,20) · Stochastic(14) · Williams %R(14) · ATR(14)<br/>
                  <strong style={{ color:C.rd }}>Risk:</strong> Binary options carry significant risk. Max payout is 50% of stake.
                </div>
              </>
            ) : <div style={{ padding:60,textAlign:'center',color:C.mu }}>Loading…</div>}
          </div>
        )}

        {/* ─ HISTORY TAB ─ */}
        {tab==='history' && (
          <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', padding:mob?10:24 }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <h2 style={{ fontSize:mob?14:18,fontWeight:800,margin:0 }}>Trade History {demo&&<span style={{ color:C.gr,fontSize:12 }}>[DEMO]</span>}</h2>
              <span style={{ fontSize:11,color:C.mu }}>{AH.length} trades · {AH.length>0?Math.round(AH.filter(t=>t.result==='WIN').length/AH.length*100):0}% win</span>
            </div>
            <div style={{ background:C.surf,border:`1px solid ${C.bd}`,borderRadius:12,overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%',borderCollapse:'collapse',fontSize:mob?11:13 }}>
                  <thead>
                    <tr style={{ background:C.s2,borderBottom:`2px solid ${C.bd2}` }}>
                      {['Asset','Direction','Stake','Result','P/L','Entry','Exit','Time'].map(h=>(
                        <th key={h} style={{ padding:'10px 12px',textAlign:'left',fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:1,color:C.mu2,whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {AH.length===0 && <tr><td colSpan={8} style={{ textAlign:'center',color:C.mu,padding:50 }}>No trades yet — place your first prediction!</td></tr>}
                    {AH.map(t=>(
                      <tr key={t.id} style={{ borderBottom:`1px solid ${C.bd}` }}>
                        <td style={{ padding:'10px 12px' }}><div style={{ fontWeight:700 }}>{t.asset}</div><div style={{ fontSize:9,color:C.mu2 }}>{t.expiryLabel}</div></td>
                        <td style={{ padding:'10px 12px' }}><span style={{ fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:20,background:t.direction==='CALL'?C.gd:C.rd2,color:t.direction==='CALL'?C.gr:C.rd }}>{t.direction==='CALL'?'▲ CALL':'▼ PUT'}</span></td>
                        <td style={{ padding:'10px 12px',fontFamily:'monospace',fontWeight:600,whiteSpace:'nowrap' }}>KES {t.stake?.toLocaleString()}</td>
                        <td style={{ padding:'10px 12px' }}><span style={{ fontSize:10,fontWeight:800,padding:'3px 10px',borderRadius:20,background:t.result==='WIN'?C.gd:C.rd2,color:t.result==='WIN'?C.gr:C.rd }}>{t.result}</span></td>
                        <td style={{ padding:'10px 12px',fontFamily:'monospace',fontWeight:800,color:t.payout>=0?C.gr:C.rd,whiteSpace:'nowrap' }}>{t.payout!=null?`${t.payout>=0?'+':''}KES ${Math.abs(t.payout).toLocaleString()}`:'—'}</td>
                        <td style={{ padding:'10px 12px',fontFamily:'monospace',fontSize:10,color:C.mu,whiteSpace:'nowrap' }}>{t.entryRate!=null?sgn(t.entryRate):'—'}</td>
                        <td style={{ padding:'10px 12px',fontFamily:'monospace',fontSize:10,color:C.mu,whiteSpace:'nowrap' }}>{t.exitRate!=null?sgn(t.exitRate):'—'}</td>
                        <td style={{ padding:'10px 12px',fontSize:10,color:C.mu2,whiteSpace:'nowrap' }}>{t.settledAt?new Date(t.settledAt).toLocaleString('en-KE',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─ WALLET TAB ─ */}
        {tab==='wallet' && !demo && (
          <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', padding:mob?10:24 }}>
            <h2 style={{ fontSize:mob?14:18,fontWeight:800,marginBottom:16,marginTop:0 }}>💳 Wallet</h2>
            <div style={{ display:'grid',gridTemplateColumns:mob?'1fr 1fr':'repeat(3,1fr)',gap:12,marginBottom:20 }}>
              {[['Balance',`KES ${bal.toLocaleString()}`,C.go,'💰'],['Deposited',`KES ${(stats?.totalDeposited||0).toLocaleString()}`,C.gr,'📥'],['Withdrawn',`KES ${(stats?.totalWithdrawn||0).toLocaleString()}`,C.mu,'📤']].map(([l,v,c,ic])=>(
                <div key={l} style={{ background:C.surf,border:`1px solid ${C.bd2}`,borderRadius:12,padding:16,display:'flex',alignItems:'center',gap:12 }}>
                  <span style={{ fontSize:22 }}>{ic}</span>
                  <div>
                    <div style={{ fontSize:10,color:C.mu,textTransform:'uppercase',letterSpacing:1,marginBottom:4 }}>{l}</div>
                    <div style={{ fontFamily:'monospace',fontSize:mob?15:20,fontWeight:700,color:c }}>{v}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:24 }}>
              <button onClick={()=>setShowDep(true)} style={{ padding:16,borderRadius:12,border:'none',background:`linear-gradient(135deg,#009944,${C.gr})`,color:'#fff',fontWeight:900,fontSize:mob?13:15,cursor:'pointer',boxShadow:'0 4px 20px rgba(0,150,80,0.3)',display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
                <span style={{ fontSize:18 }}>📱</span> Deposit via M-Pesa
              </button>
              <button onClick={()=>setShowWd(true)} style={{ padding:16,borderRadius:12,border:`2px solid ${C.go}55`,background:C.yd,color:C.go,fontWeight:900,fontSize:mob?13:15,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
                <span style={{ fontSize:18 }}>💸</span> Withdraw
              </button>
            </div>
            <h3 style={{ fontSize:14,fontWeight:800,marginBottom:12,marginTop:0 }}>Transaction History</h3>
            <div style={{ background:C.surf,border:`1px solid ${C.bd}`,borderRadius:12,overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
                  <thead><tr style={{ background:C.s2,borderBottom:`2px solid ${C.bd2}` }}>{['Type','Amount','Status','Date','Ref'].map(h=><th key={h} style={{ padding:'10px 12px',textAlign:'left',fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:1,color:C.mu2 }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {txns.length===0 && <tr><td colSpan={5} style={{ textAlign:'center',color:C.mu,padding:50 }}>No transactions yet</td></tr>}
                    {txns.map(t=>(
                      <tr key={t.id} style={{ borderBottom:`1px solid ${C.bd}` }}>
                        <td style={{ padding:'10px 12px' }}><span style={{ fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:20,background:t.type==='deposit'?C.gd:t.type==='withdrawal'?C.yd:C.bd3,color:t.type==='deposit'?C.gr:t.type==='withdrawal'?C.go:C.bl }}>{t.type.replace('_',' ')}</span></td>
                        <td style={{ padding:'10px 12px',fontFamily:'monospace',fontWeight:700,color:C.txt,whiteSpace:'nowrap' }}>KES {t.amount?.toLocaleString()}</td>
                        <td style={{ padding:'10px 12px' }}><span style={{ fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:20,background:t.status==='success'?C.gd:t.status==='pending'?C.yd:C.rd2,color:t.status==='success'?C.gr:t.status==='pending'?C.go:C.rd }}>{t.status}</span></td>
                        <td style={{ padding:'10px 12px',fontSize:11,color:C.mu2,whiteSpace:'nowrap' }}>{new Date(t.createdAt).toLocaleString('en-KE',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                        <td style={{ padding:'10px 12px',fontSize:11,color:C.mu2,maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{t.mpesaRef||t.notes||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─ STATS TAB ─ */}
        {tab==='stats' && (
          <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', padding:mob?10:24 }}>
            <h2 style={{ fontSize:mob?14:18,fontWeight:800,marginBottom:16,marginTop:0 }}>{demo?'🎮 Demo Performance':'📊 My Performance'}</h2>
            <div style={{ display:'grid',gridTemplateColumns:mob?'1fr 1fr':'repeat(4,1fr)',gap:12,marginBottom:20 }}>
              {(demo?[
                ['Demo Balance',`KES ${dBal.toLocaleString()}`,C.go,'💰'],
                ['Trades',dHist.length,C.txt,'📊'],
                ['Wins',dHist.filter(t=>t.result==='WIN').length,C.gr,'🏆'],
                ['Win Rate',dHist.length>0?`${Math.round(dHist.filter(t=>t.result==='WIN').length/dHist.length*100)}%`:'—',C.bl,'%'],
              ]:[
                ['Total Profit',`KES ${(stats?.totalProfit||0).toLocaleString()}`,C.gr,'📈'],
                ['Total Loss',`KES ${(stats?.totalLoss||0).toLocaleString()}`,C.rd,'📉'],
                ['Win Rate',`${stats?.winRate||0}%`,stats?.winRate>50?C.gr:C.txt,'🎯'],
                ['Trades',stats?.tradeCount||0,C.txt,'📋'],
              ]).map(([l,v,c,ic])=>(
                <div key={l} style={{ background:C.surf,border:`1px solid ${C.bd2}`,borderRadius:12,padding:mob?14:18,textAlign:'center' }}>
                  <div style={{ fontSize:24,marginBottom:6 }}>{ic}</div>
                  <div style={{ fontFamily:'monospace',fontSize:mob?19:26,fontWeight:700,color:c,marginBottom:4 }}>{v}</div>
                  <div style={{ fontSize:10,color:C.mu,textTransform:'uppercase',letterSpacing:1 }}>{l}</div>
                </div>
              ))}
            </div>
            {streak.current>1 && (
              <div style={{ padding:'12px 16px',background:streak.type==='WIN'?C.gd:C.rd2,border:`1px solid ${streak.type==='WIN'?C.gr:C.rd}44`,borderRadius:10,marginBottom:16,display:'flex',alignItems:'center',gap:10 }}>
                <span style={{ fontSize:24 }}>{streak.type==='WIN'?'🔥':'💔'}</span>
                <div>
                  <div style={{ fontSize:14,fontWeight:800,color:streak.type==='WIN'?C.gr:C.rd }}>{streak.current}-{streak.type} STREAK!</div>
                  <div style={{ fontSize:11,color:C.mu }}>{streak.type==='WIN'?'Keep going!':'Hang in there!'}</div>
                </div>
              </div>
            )}
            <div style={{ background:C.surf,border:`1px solid ${C.bd}`,borderRadius:12,overflow:'hidden' }}>
              <div style={{ padding:'12px 16px',borderBottom:`1px solid ${C.bd}`,fontSize:13,fontWeight:800 }}>Recent Trades</div>
              {AH.length===0 && <div style={{ padding:50,textAlign:'center',color:C.mu }}>No trades yet</div>}
              {AH.slice(0,20).map(t=>(
                <div key={t.id} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px',borderBottom:`1px solid ${C.bd}`,flexWrap:'wrap',gap:8 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                    <span style={{ fontSize:18 }}>{t.result==='WIN'?'🎉':'😔'}</span>
                    <div><div style={{ fontSize:13,fontWeight:700 }}>{t.asset}</div><div style={{ fontSize:10,color:C.mu }}>{t.expiryLabel}</div></div>
                  </div>
                  <span style={{ fontSize:10,fontWeight:700,padding:'2px 10px',borderRadius:20,background:t.direction==='CALL'?C.gd:C.rd2,color:t.direction==='CALL'?C.gr:C.rd }}>{t.direction==='CALL'?'▲ CALL':'▼ PUT'}</span>
                  <span style={{ fontSize:11,fontWeight:800,padding:'3px 12px',borderRadius:20,background:t.result==='WIN'?C.gd:C.rd2,color:t.result==='WIN'?C.gr:C.rd }}>{t.result}</span>
                  <span style={{ fontFamily:'monospace',fontSize:14,fontWeight:800,color:t.payout>=0?C.gr:C.rd }}>{t.payout!=null?`${t.payout>=0?'+':''}KES ${Math.abs(t.payout).toLocaleString()}`:'—'}</span>
                  <span style={{ fontSize:10,color:C.mu2 }}>{t.settledAt?new Date(t.settledAt).toLocaleString('en-KE',{hour:'2-digit',minute:'2-digit'}):'—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─ LEDGER TAB ─ */}
        {tab==='ledger' && (
          <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', padding:mob?10:24 }}>
            <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:16,flexWrap:'wrap' }}>
              <h2 style={{ fontSize:mob?14:18,fontWeight:800,margin:0 }}>🔗 Blockchain Ledger</h2>
              <div style={{ padding:'4px 12px',borderRadius:20,background:chainOk?C.gd:C.rd2,border:`1px solid ${chainOk?C.gr:C.rd}44`,fontSize:10,fontWeight:700,color:chainOk?C.gr:C.rd }}>
                {chainOk?'✅ Chain Verified':'⚠️ Chain Error'}
              </div>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:mob?'1fr 1fr':'repeat(4,1fr)',gap:12,marginBottom:20 }}>
              {[['Blocks',ledStat.blocks,C.bl],['Trades',ledStat.trades,C.txt],['Wins',ledStat.wins,C.gr],['Win Rate',ledStat.trades>0?`${ledStat.winRate}%`:'—',C.gr]].map(([l,v,c])=>(
                <div key={l} style={{ background:C.surf,border:`1px solid ${C.bd2}`,borderRadius:12,padding:14,textAlign:'center' }}>
                  <div style={{ fontFamily:'monospace',fontSize:mob?18:22,fontWeight:700,color:c,marginBottom:4 }}>{v}</div>
                  <div style={{ fontSize:10,color:C.mu,textTransform:'uppercase',letterSpacing:1 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ background:C.surf,border:`1px solid ${C.bd}`,borderRadius:12,overflow:'hidden',marginBottom:16 }}>
              <div style={{ padding:'12px 16px',borderBottom:`1px solid ${C.bd}`,fontSize:13,fontWeight:800 }}>Recent Blocks</div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%',borderCollapse:'collapse',fontSize:11 }}>
                  <thead><tr style={{ background:C.s2,borderBottom:`2px solid ${C.bd2}` }}>
                    {['#','Type','Hash','Prev Hash','Nonce','Time'].map(h=><th key={h} style={{ padding:'8px 12px',textAlign:'left',fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:1,color:C.mu2,whiteSpace:'nowrap' }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {ledger.recentBlocks(15).map(b=>(
                      <tr key={b.index} style={{ borderBottom:`1px solid ${C.bd}` }}>
                        <td style={{ padding:'8px 12px',fontFamily:'monospace',color:C.bl,fontWeight:700 }}>#{b.index}</td>
                        <td style={{ padding:'8px 12px' }}>
                          <span style={{ fontSize:9,fontWeight:700,padding:'2px 8px',borderRadius:20,background:b.data?.type==='TRADE'?C.gd:b.data?.type==='DEPOSIT'?C.yd:C.bd3,color:b.data?.type==='TRADE'?C.gr:b.data?.type==='DEPOSIT'?C.go:C.mu }}>
                            {b.data?.type||'GENESIS'}
                          </span>
                          {b.data?.type==='TRADE'&&<div style={{ fontSize:8,color:C.mu2,marginTop:2 }}>{b.data?.result} {b.data?.direction}</div>}
                        </td>
                        <td style={{ padding:'8px 12px',fontFamily:'monospace',fontSize:9,color:C.gr }}>{b.hash.slice(0,22)}…</td>
                        <td style={{ padding:'8px 12px',fontFamily:'monospace',fontSize:9,color:C.mu }}>{b.prevHash.slice(0,16)}…</td>
                        <td style={{ padding:'8px 12px',fontFamily:'monospace',fontSize:9,color:C.mu2 }}>{b.nonce}</td>
                        <td style={{ padding:'8px 12px',fontSize:9,color:C.mu2,whiteSpace:'nowrap' }}>{new Date(b.timestamp).toLocaleString('en-KE',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{ padding:'14px 16px',background:C.s2,borderRadius:10,border:`1px solid ${C.bd}`,fontSize:11,color:C.mu,lineHeight:1.85 }}>
              <strong style={{ color:C.txt,display:'block',marginBottom:6 }}>How the TradeFlow Blockchain Ledger works:</strong>
              Every trade and deposit is a SHA-256 mined block chained by hash. Proof-of-work (hash starts with "00") ensures integrity. The chain is verified on every session — tampering is immediately detected.
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showDep && (
        <DepositModal balance={AB}
          onSuccess={amt=>{
            setBal(b=>b+amt); setShowDep(false);
            toast(`KES ${amt.toLocaleString()} credited`,'success');
            ledger.addDeposit({id:'dep'+Date.now(),amount:amt,ref:''}).then(()=>setLedStat(ledger.stats()));
            userAPI.transactions().then(r=>setTxns(r.data)).catch(()=>{});
          }}
          onClose={()=>setShowDep(false)}/>
      )}
      {showWd && (
        <WithdrawModal balance={bal}
          onSuccess={amt=>{
            setBal(b=>b-amt); setShowWd(false);
            toast('Withdrawal submitted','info');
            userAPI.transactions().then(r=>setTxns(r.data)).catch(()=>{});
          }}
          onClose={()=>setShowWd(false)}/>
      )}
    </div>
  );
}
