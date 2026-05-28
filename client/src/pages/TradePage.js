import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { marketAPI, tradeAPI, userAPI, settingsAPI } from '../utils/api';
import DepositModal from '../components/DepositModal';
import WithdrawModal from '../components/WithdrawModal';

// ── Helpers ────────────────────────────────────────────────────
const ASSET_COLORS = { forex:'#0f2a45', crypto:'#1a0f2a', nse:'#0a2a0f', comm:'#2a1a00' };
function fmtPrice(p) {
  if (!p) return '0.0000';
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
  { label:'30s', key:'30s', sec:30   },
  { label:'1m',  key:'1m',  sec:60   },
  { label:'5m',  key:'5m',  sec:300  },
  { label:'15m', key:'15m', sec:900  },
  { label:'30m', key:'30m', sec:1800 },
];

const DEMO_ASSETS = [
  {id:'usdkes',name:'USD/KES',sub:'Nairobi FX',   icon:'💵',cat:'forex', price:132.45, chg: 0.23,vol:'2.4M'},
  {id:'eurkes',name:'EUR/KES',sub:'Nairobi FX',   icon:'💶',cat:'forex', price:143.80, chg:-0.41,vol:'1.8M'},
  {id:'gbpkes',name:'GBP/KES',sub:'Nairobi FX',   icon:'🏴',cat:'forex', price:167.20, chg: 0.18,vol:'890K'},
  {id:'btcusd',name:'BTC/USD',sub:'Crypto',        icon:'₿', cat:'crypto',price:68420,  chg: 2.15,vol:'12.1B'},
  {id:'ethusd',name:'ETH/USD',sub:'Crypto',        icon:'◆', cat:'crypto',price:3245.6, chg: 1.08,vol:'4.2B'},
  {id:'solusd',name:'SOL/USD',sub:'Crypto',        icon:'◉', cat:'crypto',price:178.40, chg:-0.73,vol:'1.1B'},
  {id:'safcom',name:'SCOM',   sub:'NSE·Safaricom', icon:'📡',cat:'nse',  price:17.40,  chg:-0.57,vol:'14.2M'},
  {id:'eqbnk', name:'EQTY',   sub:'NSE·Equity',   icon:'🏦',cat:'nse',  price:52.75,  chg: 1.32,vol:'5.8M'},
  {id:'kenol', name:'KENO',   sub:'NSE·Kobil',     icon:'⛽',cat:'nse',  price:14.20,  chg:-0.28,vol:'2.1M'},
  {id:'eabl',  name:'EABL',   sub:'NSE·EA Brew',   icon:'🍺',cat:'nse',  price:145.50, chg: 0.69,vol:'3.4M'},
  {id:'gold',  name:'XAU/USD',sub:'Commodities',   icon:'🥇',cat:'comm', price:2348.5, chg: 0.65,vol:'52.4B'},
  {id:'oil',   name:'WTI Oil',sub:'Commodities',   icon:'🛢', cat:'comm', price:78.32,  chg:-0.44,vol:'18.6B'},
];

const FAKE_NAMES = ['Wanjiku','Kamau','Otieno','Njoroge','Achieng','Mwangi','Chebet','Odhiambo','Waweru','Kipchoge','Adhiambo','Mutua','Wairimu','Omondi','Kariuki','Nekesa','Gathoni','Simiyu','Wacera','Rotich','Njoki','Makau','Auma','Kirui','Mumbi','Juma','Wambui','Korir','Awino','Muigai'];
const ASSET_NAMES = ['USD/KES','EUR/KES','BTC/USD','ETH/USD','SCOM','XAU/USD','WTI Oil','EQTY','GBP/KES','SOL/USD'];
function rName(){ return FAKE_NAMES[Math.floor(Math.random()*FAKE_NAMES.length)]; }
function rAsset(){ return ASSET_NAMES[Math.floor(Math.random()*ASSET_NAMES.length)]; }
function rAmt(min=100,max=9000){ return Math.floor(Math.random()*(max-min)+min); }
function rMsg(){
  const msgs = [
    ()=>`🎉 ${rName()} just won KES ${rAmt().toLocaleString()} on ${rAsset()}!`,
    ()=>`💸 ${rName()} withdrew KES ${rAmt(500,20000).toLocaleString()} to M-Pesa`,
    ()=>`🔥 ${rName()} placed KES ${rAmt().toLocaleString()} CALL on ${rAsset()}`,
    ()=>`✅ CONGRATULATIONS ${rName()}! Withdrawal of KES ${rAmt(500,15000).toLocaleString()} confirmed 🎊`,
    ()=>`📈 ${rName()} on a win streak! +KES ${rAmt(200,5000).toLocaleString()} profit`,
    ()=>`⚡ ${rName()} just deposited KES ${rAmt(500,10000).toLocaleString()} and placed a trade!`,
    ()=>`🚀 ${rName()} doubled up on ${rAsset()} — KES ${rAmt().toLocaleString()} profit`,
    ()=>`💰 ${rName()} just cashed out KES ${rAmt(1000,25000).toLocaleString()}! 🥳`,
    ()=>`🎯 ${rName()} nailed a PUT on ${rAsset()} +KES ${rAmt().toLocaleString()}`,
    ()=>`🌟 ${rName()} joined TradeFlow Pro — Welcome!`,
  ];
  return msgs[Math.floor(Math.random()*msgs.length)]();
}

function tickAssets(prev){
  return prev.map(a=>({
    ...a,
    price: Math.max(0.01, a.price+(Math.random()-0.495)*a.price*0.0015),
    chg: Math.max(-9.99,Math.min(9.99, a.chg+(Math.random()-0.5)*0.05)),
  }));
}

// ══════════════════════════════════════════════════════════════
export default function TradePage(){
  const { user, logout } = useAuth();
  const toast = useToast();
  const canvasRef  = useRef(null);
  const chatEndRef = useRef(null);

  // responsive
  const [isMobile,  setIsMobile]  = useState(window.innerWidth < 768);
  const [isTablet,  setIsTablet]  = useState(window.innerWidth < 1100 && window.innerWidth >= 768);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showChat,    setShowChat]    = useState(false);
  const [mobileTab,   setMobileTab]   = useState('chart'); // chart|assets|chat

  useEffect(()=>{
    const onResize = ()=>{
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth < 1100 && window.innerWidth >= 768);
    };
    window.addEventListener('resize', onResize);
    return ()=>window.removeEventListener('resize', onResize);
  },[]);

  // demo
  const [demoMode,      setDemoMode]      = useState(false);
  const [demoBalance,   setDemoBalance]   = useState(10000);
  const [demoAssets,    setDemoAssets]    = useState(DEMO_ASSETS);
  const [demoHistory,   setDemoHistory]   = useState([]);
  const [demoPositions, setDemoPositions] = useState([]);

  // real
  const [assets,        setAssets]        = useState([]);
  const [signals,       setSignals]       = useState([]);
  const [sel,           setSel]           = useState(null);
  const [positions,     setPositions]     = useState([]);
  const [tradeHistory,  setTradeHistory]  = useState([]);
  const [transactions,  setTransactions]  = useState([]);
  const [stats,         setStats]         = useState(null);
  const [settings,      setSettings]      = useState(null);
  const [balance,       setBalance]       = useState(user?.balance||0);

  // ui
  const [catFilter,   setCatFilter]   = useState('all');
  const [searchQ,     setSearchQ]     = useState('');
  const [activeTab,   setActiveTab]   = useState('trade');
  const [expiry,      setExpiry]      = useState(EXPIRY_OPTIONS[1]);
  const [stake,       setStake]       = useState(500);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw,setShowWithdraw]= useState(false);
  const [tradingBusy, setTradingBusy] = useState(false);

  // chart
  const [chartData,    setChartData]    = useState([]);
  const [liveRate,     setLiveRate]     = useState(0);
  const chartDataRef = useRef([]);

  // chat
  const [chatMessages, setChatMessages] = useState(()=>{
    const s=[];
    for(let i=0;i<14;i++) s.push({id:i,text:rMsg(),ts:Date.now()-(14-i)*6000});
    return s;
  });

  // derived
  const activeAssets    = demoMode ? demoAssets    : assets;
  const activeBalance   = demoMode ? demoBalance   : balance;
  const activePositions = demoMode ? demoPositions : positions;
  const activeHistory   = demoMode ? demoHistory   : tradeHistory;
  const selectedAsset   = sel ? activeAssets.find(a=>a.id===sel.id)||sel : null;
  const payoutRate      = settings?.payoutRates?.[expiry.key]||86;
  const estReturn       = Math.round(stake*payoutRate/100);

  // ── seed chart ──────────────────────────────────────────────
  useEffect(()=>{
    const seed=[];
    let v=0;
    for(let i=0;i<100;i++){
      v+=(Math.random()-0.49)*0.004+(Math.random()<0.07?Math.random()*0.05:0);
      v=Math.max(-0.10,Math.min(0.16,v));
      seed.push(parseFloat(v.toFixed(4)));
    }
    chartDataRef.current=seed;
    setChartData([...seed]);
    setLiveRate(seed[seed.length-1]);
  },[sel]);

  // ── chart animation ─────────────────────────────────────────
  useEffect(()=>{
    const iv=setInterval(()=>{
      const prev=chartDataRef.current;
      const last=prev[prev.length-1]||0;
      const spike=Math.random()<0.08?Math.random()*0.06:0;
      const crash=Math.random()<0.04?-Math.random()*0.05:0;
      let next=last+(Math.random()-0.49)*0.005+spike+crash;
      next=Math.max(-0.12,Math.min(0.18,next));
      next=parseFloat(next.toFixed(4));
      const nd=[...prev.slice(-149),next];
      chartDataRef.current=nd;
      setChartData([...nd]);
      setLiveRate(next);
    },250);
    return ()=>clearInterval(iv);
  },[]);

  // ── draw spike chart ─────────────────────────────────────────
  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas||chartData.length<2) return;
    const dpr=window.devicePixelRatio||1;
    const W=canvas.offsetWidth, H=canvas.offsetHeight;
    if(!W||!H) return;
    canvas.width=W*dpr; canvas.height=H*dpr;
    const ctx=canvas.getContext('2d');
    ctx.scale(dpr,dpr);

    const data=chartData;
    const mn=Math.min(...data)-0.02;
    const mx=Math.max(...data)+0.02;
    const rng=mx-mn||0.3;
    const pL=6,pR=64,pT=28,pB=36;
    const cW=W-pL-pR, cH=H-pT-pB;

    const px=i=>pL+(i/(data.length-1))*cW;
    const py=v=>pT+cH-((v-mn)/rng)*cH;
    const zeroY=py(0);

    ctx.clearRect(0,0,W,H);

    // ── grid ──
    ctx.strokeStyle='rgba(0,255,120,0.04)';
    ctx.lineWidth=1;
    for(let i=0;i<=5;i++){
      const y=pT+(cH/5)*i;
      ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(W-pR+8,y); ctx.stroke();
    }
    for(let i=0;i<=6;i++){
      const x=pL+(cW/6)*i;
      ctx.beginPath(); ctx.moveTo(x,pT); ctx.lineTo(x,pT+cH); ctx.stroke();
    }

    // ── zero line ──
    ctx.strokeStyle='rgba(255,255,255,0.18)';
    ctx.lineWidth=1;
    ctx.setLineDash([6,4]);
    ctx.beginPath(); ctx.moveTo(pL,zeroY); ctx.lineTo(W-pR+8,zeroY); ctx.stroke();
    ctx.setLineDash([]);

    // ── y-axis labels ──
    ctx.fillStyle='rgba(100,200,120,0.6)';
    ctx.font=`10px 'DM Mono',monospace`;
    ctx.textAlign='left';
    const step=(mx-mn)/5;
    for(let i=0;i<=5;i++){
      const v=mn+step*i;
      const y=py(v);
      if(y>pT&&y<pT+cH)
        ctx.fillText((v>=0?'+':'')+v.toFixed(3), W-pR+12, y+3);
    }

    // ── green fill above zero ──
    const gGrad=ctx.createLinearGradient(0,pT,0,zeroY);
    gGrad.addColorStop(0,'rgba(0,255,120,0.55)');
    gGrad.addColorStop(0.5,'rgba(0,220,100,0.25)');
    gGrad.addColorStop(1,'rgba(0,180,80,0.05)');
    ctx.beginPath();
    ctx.moveTo(px(0),Math.min(py(data[0]),zeroY));
    for(let i=0;i<data.length;i++) ctx.lineTo(px(i),Math.min(py(data[i]),zeroY));
    ctx.lineTo(px(data.length-1),zeroY);
    ctx.lineTo(px(0),zeroY);
    ctx.closePath();
    ctx.fillStyle=gGrad; ctx.fill();

    // ── red fill below zero ──
    const rGrad=ctx.createLinearGradient(0,zeroY,0,pT+cH);
    rGrad.addColorStop(0,'rgba(255,50,60,0.05)');
    rGrad.addColorStop(0.5,'rgba(255,50,60,0.25)');
    rGrad.addColorStop(1,'rgba(255,50,60,0.55)');
    ctx.beginPath();
    ctx.moveTo(px(0),Math.max(py(data[0]),zeroY));
    for(let i=0;i<data.length;i++) ctx.lineTo(px(i),Math.max(py(data[i]),zeroY));
    ctx.lineTo(px(data.length-1),zeroY);
    ctx.lineTo(px(0),zeroY);
    ctx.closePath();
    ctx.fillStyle=rGrad; ctx.fill();

    // ── glow line ──
    const isUp=liveRate>=0;
    const lineCol=isUp?'#00ff78':'#ff3246';
    ctx.shadowColor=isUp?'rgba(0,255,120,0.8)':'rgba(255,50,70,0.8)';
    ctx.shadowBlur=12;
    ctx.beginPath();
    ctx.moveTo(px(0),py(data[0]));
    for(let i=1;i<data.length;i++) ctx.lineTo(px(i),py(data[i]));
    ctx.strokeStyle=lineCol;
    ctx.lineWidth=2.5;
    ctx.lineJoin='round';
    ctx.stroke();
    ctx.shadowBlur=0;

    // ── live dot with glow ──
    const lx=px(data.length-1), ly=py(data[data.length-1]);
    [18,10,5].forEach((r,idx)=>{
      ctx.beginPath(); ctx.arc(lx,ly,r,0,Math.PI*2);
      ctx.fillStyle=isUp
        ?`rgba(0,255,120,${[0.12,0.25,1][idx]})`
        :`rgba(255,50,70,${[0.12,0.25,1][idx]})`;
      ctx.fill();
    });

    // ── rate badge ──
    const rateStr=(liveRate>=0?'+':'')+liveRate.toFixed(4);
    const bW=160,bH=34,bX=(W-pR)/2-bW/2,bY=6;
    ctx.fillStyle='rgba(4,12,8,0.92)';
    ctx.strokeStyle=isUp?'rgba(0,255,120,0.7)':'rgba(255,50,70,0.7)';
    ctx.lineWidth=1.5;
    ctx.shadowColor=isUp?'rgba(0,255,120,0.5)':'rgba(255,50,70,0.5)';
    ctx.shadowBlur=15;
    ctx.beginPath();
    ctx.roundRect(bX,bY,bW,bH,8);
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur=0;

    ctx.fillStyle=isUp?'#00ff78':'#ff3246';
    ctx.font=`bold 16px 'DM Mono',monospace`;
    ctx.textAlign='center';
    ctx.fillText('Rate: '+rateStr, bX+bW/2, bY+22);

    // ── current price tag on right edge ──
    const priceStr=selectedAsset?fmtPrice(selectedAsset.price):'—';
    const tagW=62,tagH=22,tagX=W-pR+10,tagY=ly-11;
    ctx.fillStyle=isUp?'rgba(0,255,120,0.15)':'rgba(255,50,70,0.15)';
    ctx.strokeStyle=isUp?'#00ff78':'#ff3246';
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.roundRect(tagX,Math.max(pT,Math.min(tagY,pT+cH-tagH)),tagW,tagH,4);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle=isUp?'#00ff78':'#ff3246';
    ctx.font=`bold 10px 'DM Mono',monospace`;
    ctx.textAlign='center';
    ctx.fillText(priceStr, tagX+tagW/2, Math.max(pT+14,Math.min(tagY+14,pT+cH-6)));

    // ── bottom time labels ──
    ctx.fillStyle='rgba(80,120,90,0.5)';
    ctx.font=`9px 'DM Mono',monospace`;
    ctx.textAlign='center';
    const now=new Date();
    for(let i=0;i<=4;i++){
      const x=pL+(cW/4)*i;
      const d=new Date(now-((4-i)*15000));
      ctx.fillText(d.toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit',second:'2-digit'}), x, pT+cH+22);
    }
  },[chartData, liveRate, selectedAsset]);

  // ── chat scroll ──────────────────────────────────────────────
  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:'smooth'}); },[chatMessages]);

  // ── fake chat ────────────────────────────────────────────────
  useEffect(()=>{
    let timeout;
    const schedule=()=>{
      timeout=setTimeout(()=>{
        setChatMessages(p=>[...p,{id:Date.now(),text:rMsg(),ts:Date.now()}].slice(-70));
        schedule();
      }, 1200+Math.random()*2800);
    };
    schedule();
    return ()=>clearTimeout(timeout);
  },[]);

  // ── load real data ───────────────────────────────────────────
  useEffect(()=>{
    if(demoMode) return;
    settingsAPI.public().then(r=>setSettings(r.data)).catch(()=>{});
    userAPI.stats().then(r=>{setStats(r.data);setBalance(r.data.balance);}).catch(()=>{});
    userAPI.trades().then(r=>setTradeHistory(r.data)).catch(()=>{});
    userAPI.transactions().then(r=>setTransactions(r.data)).catch(()=>{});
    marketAPI.signals().then(r=>setSignals(r.data)).catch(()=>{});
  },[demoMode]);

  useEffect(()=>{
    if(demoMode) return;
    const load=()=>marketAPI.assets().then(r=>{
      setAssets(r.data);
      if(!sel&&r.data.length) setSel(r.data[0]);
    }).catch(()=>{});
    load();
    const iv=setInterval(load,2500);
    return ()=>clearInterval(iv);
  },[sel,demoMode]);

  useEffect(()=>{
    if(!demoMode) return;
    if(!sel) setSel(DEMO_ASSETS[0]);
    const iv=setInterval(()=>setDemoAssets(p=>tickAssets(p)),1500);
    return ()=>clearInterval(iv);
  },[demoMode,sel]);

  // ── position timer ───────────────────────────────────────────
  useEffect(()=>{
    const iv=setInterval(()=>{
      const tick=p=>p.map(x=>({...x,elapsedSec:Math.min((x.elapsedSec||0)+1,x.totalSec||x.expirySec||300)}));
      if(demoMode) setDemoPositions(tick); else setPositions(tick);
    },1000);
    return ()=>clearInterval(iv);
  },[demoMode]);

  // ── trades ───────────────────────────────────────────────────
  const placeDemoTrade=dir=>{
    if(stake<50){toast('Min stake KES 50','error');return;}
    if(stake>demoBalance){toast('Insufficient demo balance','error');return;}
    setDemoBalance(b=>b-stake);
    const id='d'+Date.now();
    setDemoPositions(p=>[{id,asset:selectedAsset?.name,direction:dir,stake,totalSec:expiry.sec,elapsedSec:0,entryPrice:selectedAsset?.price},...p]);
    toast(`[DEMO] ${dir} — KES ${stake.toLocaleString()} on ${selectedAsset?.name}`,'info');
    const rate=(settings?.payoutRates?.[expiry.key]||86)/100;
    setTimeout(()=>{
      const win=Math.random()<0.55;
      const payout=win?Math.round(stake*rate):-stake;
      setDemoPositions(p=>p.filter(x=>x.id!==id));
      if(win) setDemoBalance(b=>b+stake+Math.round(stake*rate));
      setDemoHistory(h=>[{id,asset:selectedAsset?.name,direction:dir,stake,result:win?'WIN':'LOSS',payout,expiryLabel:expiry.key,settledAt:new Date().toISOString()},...h.slice(0,49)]);
      toast(win?`[DEMO] 🎉 WIN +KES ${Math.abs(payout).toLocaleString()}`:`[DEMO] Loss KES ${stake.toLocaleString()}`,win?'success':'error');
    },Math.min(expiry.sec*1000,10000));
  };

  const placeRealTrade=async dir=>{
    if(!selectedAsset) return;
    if(stake<(settings?.minStake||50)){toast(`Min KES ${settings?.minStake||50}`,'error');return;}
    if(stake>balance){toast('Insufficient balance','error');return;}
    setTradingBusy(true);
    try{
      const r=await tradeAPI.place({asset:selectedAsset.name,direction:dir,stake,expirySec:expiry.sec,expiryLabel:expiry.key,entryPrice:selectedAsset.price});
      const {trade,newBalance}=r.data;
      setBalance(newBalance);
      toast(`${dir} — KES ${stake.toLocaleString()} on ${selectedAsset.name}`,'info');
      setPositions(p=>[{...trade,totalSec:expiry.sec,elapsedSec:0},...p]);
      setTimeout(async()=>{
        try{
          const res=await tradeAPI.result(trade.id);
          const {trade:t,balance:nb}=res.data;
          if(t.result!=='PENDING'){
            setBalance(nb);
            setPositions(p=>p.filter(x=>x.id!==trade.id));
            setTradeHistory(p=>[t,...p.slice(0,49)]);
            const win=t.result==='WIN';
            toast(win?`🎉 WIN +KES ${Math.abs(t.payout).toLocaleString()}`:`Loss KES ${stake.toLocaleString()}`,win?'success':'error');
            userAPI.stats().then(r=>setStats(r.data)).catch(()=>{});
          }
        }catch{}
      },Math.min(expiry.sec*1000,16000));
    }catch(err){toast(err.response?.data?.error||'Trade failed','error');}
    finally{setTradingBusy(false);}
  };

  const placeTrade=dir=>demoMode?placeDemoTrade(dir):placeRealTrade(dir);

  const onDepositSuccess=amt=>{setBalance(b=>b+amt);setShowDeposit(false);toast(`KES ${amt.toLocaleString()} credited`,'success');userAPI.transactions().then(r=>setTransactions(r.data)).catch(()=>{});};
  const onWithdrawSuccess=amt=>{setBalance(b=>b-amt);setShowWithdraw(false);toast('Withdrawal submitted','info');userAPI.transactions().then(r=>setTransactions(r.data)).catch(()=>{});};

  const filteredAssets=activeAssets.filter(a=>{
    if(catFilter!=='all'&&a.cat!==catFilter) return false;
    if(searchQ&&!a.name.toLowerCase().includes(searchQ.toLowerCase())&&!a.sub.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  const cats=['all','forex','crypto','nse','comm'];
  const catLabels={all:'All',forex:'Forex',crypto:'Crypto',nse:'NSE',comm:'Comm'};
  const tickerItems=[...activeAssets,...activeAssets];

  // ── components ───────────────────────────────────────────────
  const AssetList=()=>(
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      <div style={{padding:'8px',borderBottom:'1px solid rgba(0,255,120,0.07)'}}>
        <input placeholder="Search market…" value={searchQ} onChange={e=>setSearchQ(e.target.value)}
          style={{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,padding:'7px 10px',color:'#c8d8e8',fontSize:12,outline:'none'}}/>
      </div>
      <div style={{display:'flex',gap:4,padding:'6px 8px',borderBottom:'1px solid rgba(0,255,120,0.05)',flexWrap:'wrap'}}>
        {cats.map(c=>(
          <button key={c} onClick={()=>setCatFilter(c)}
            style={{fontSize:9,fontWeight:700,padding:'3px 8px',borderRadius:20,cursor:'pointer',border:'1px solid',borderColor:catFilter===c?'#00d97e':'rgba(255,255,255,0.08)',color:catFilter===c?'#00d97e':'#4a5a6a',background:catFilter===c?'rgba(0,217,126,0.1)':'transparent',transition:'all .12s'}}>
            {catLabels[c]}
          </button>
        ))}
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {filteredAssets.map(a=>{
          const isSel=sel?.id===a.id;
          return(
            <div key={a.id} onClick={()=>{setSel(a);if(isMobile)setMobileTab('chart');}}
              style={{display:'flex',alignItems:'center',gap:8,padding:'9px 10px',borderBottom:'1px solid rgba(255,255,255,0.03)',cursor:'pointer',background:isSel?'rgba(0,217,126,0.07)':'transparent',borderLeft:isSel?'3px solid #00d97e':'3px solid transparent',transition:'background .12s'}}>
              <div style={{width:30,height:30,borderRadius:7,background:ASSET_COLORS[a.cat]||'#0a1a0a',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0}}>{a.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:'#c8d8e8'}}>{a.name}</div>
                <div style={{fontSize:10,color:'#3a5a4a',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.sub}</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:'#8ab8a8'}}>{fmtPrice(a.price)}</div>
                <div style={{fontSize:10,fontWeight:700,color:a.chg>=0?'#00d97e':'#f0424d'}}>{a.chg>=0?'+':''}{a.chg.toFixed(2)}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const ChatPanel=()=>(
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{padding:'8px 12px',borderBottom:'1px solid rgba(0,255,120,0.07)',display:'flex',alignItems:'center',gap:7,background:'rgba(0,20,8,0.6)',flexShrink:0}}>
        <div style={{width:8,height:8,borderRadius:'50%',background:'#00d97e',boxShadow:'0 0 8px #00d97e'}}/>
        <span style={{fontSize:11,fontWeight:800,color:'#00d97e',letterSpacing:1}}>LIVE CHAT</span>
        <span style={{fontSize:10,color:'#2a5a3a',marginLeft:2}}>{Math.floor(120+Math.random()*80)} online</span>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'4px 0'}}>
        {chatMessages.map((m)=>{
          const isSys=m.text.includes('CONGRATULATIONS')||m.text.startsWith('💸')||m.text.startsWith('🎉')||m.text.startsWith('💰');
          return(
            <div key={m.id} style={{padding:'5px 10px',borderBottom:'1px solid rgba(255,255,255,0.02)',animation:'fadeMsg .4s ease'}}>
              {isSys
                ?<span style={{fontSize:11,lineHeight:1.5,color:'#00d97e',fontWeight:600}}>{m.text}</span>
                :<span style={{fontSize:11,lineHeight:1.5,color:'#5a8a7a'}}>{m.text}</span>
              }
            </div>
          );
        })}
        <div ref={chatEndRef}/>
      </div>
    </div>
  );

  const PositionsPanel=()=>(
    <div>
      {activePositions.length===0
        ?<div style={{padding:'14px 12px',textAlign:'center',fontSize:11,color:'#2a5a3a'}}>No open positions</div>
        :activePositions.map(p=>{
          const pct=Math.min(((p.elapsedSec||0)/(p.totalSec||300))*100,100);
          const rem=Math.max(0,(p.totalSec||300)-(p.elapsedSec||0));
          const col=p.direction==='CALL'?'#00d97e':'#f0424d';
          return(
            <div key={p.id} style={{padding:'9px 12px',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                <div style={{fontSize:12,fontWeight:700,color:'#c8d8e8'}}>{p.asset}</div>
                <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:20,background:p.direction==='CALL'?'rgba(0,217,126,0.15)':'rgba(240,66,77,0.15)',color:col}}>{p.direction}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#3a6a4a',marginBottom:4}}>
                <span>KES {p.stake?.toLocaleString()}</span>
                <span style={{fontFamily:"'DM Mono',monospace",color:col}}>{rem>=60?`${Math.ceil(rem/60)}m`:`${rem}s`}</span>
              </div>
              <div style={{height:3,background:'rgba(255,255,255,0.05)',borderRadius:2}}>
                <div style={{width:`${pct}%`,height:'100%',background:`linear-gradient(90deg,${col}88,${col})`,borderRadius:2,transition:'width 1s linear'}}/>
              </div>
            </div>
          );
        })
      }
    </div>
  );

  const TradeControls=({compact=false})=>(
    <div style={{background:'#050e08',borderTop:'1px solid rgba(0,255,120,0.12)',padding:compact?'10px 12px':'14px 16px',flexShrink:0}}>
      {/* Expiry */}
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8,flexWrap:'wrap'}}>
        <span style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:1.2,color:'#2a6a3a',flexShrink:0}}>EXPIRY</span>
        <div style={{display:'flex',gap:4,flex:1,flexWrap:'wrap'}}>
          {EXPIRY_OPTIONS.map(o=>(
            <button key={o.key} onClick={()=>setExpiry(o)}
              style={{fontSize:10,fontWeight:700,padding:'4px 10px',borderRadius:20,cursor:'pointer',border:'1px solid',borderColor:expiry.key===o.key?'#00d97e':'rgba(255,255,255,0.08)',color:expiry.key===o.key?'#00d97e':'#4a6a5a',background:expiry.key===o.key?'rgba(0,217,126,0.1)':'transparent',transition:'all .12s'}}>
              {o.label}
            </button>
          ))}
        </div>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,background:'rgba(245,166,35,0.1)',border:'1px solid rgba(245,166,35,0.25)',borderRadius:5,padding:'3px 9px',color:'#f5a623',whiteSpace:'nowrap'}}>
          {payoutRate}% payout
        </div>
      </div>
      {/* Stake */}
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10,flexWrap:'wrap'}}>
        <span style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:1.2,color:'#2a6a3a',flexShrink:0}}>STAKE</span>
        <div style={{display:'flex',alignItems:'center',gap:5,background:'rgba(255,255,255,0.05)',border:'1.5px solid rgba(0,255,120,0.15)',borderRadius:7,padding:'6px 10px'}}>
          <span style={{fontSize:10,fontWeight:700,color:'#2a6a3a'}}>KES</span>
          <input type="number" value={stake} onChange={e=>setStake(Number(e.target.value))} min={50}
            style={{border:'none',background:'transparent',fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:500,width:80,padding:0,color:'#e8f8e8',outline:'none'}}/>
        </div>
        <div style={{display:'flex',gap:4,flex:1,flexWrap:'wrap'}}>
          {[500,1000,2000,5000].map(v=>(
            <button key={v} onClick={()=>setStake(v)}
              style={{fontSize:10,fontWeight:700,padding:'5px 9px',borderRadius:6,cursor:'pointer',background:'rgba(0,255,120,0.05)',border:'1px solid rgba(0,255,120,0.1)',color:'#3a7a5a',transition:'all .12s'}}>
              {v>=1000?`${v/1000}K`:v}
            </button>
          ))}
        </div>
        <div style={{marginLeft:'auto',textAlign:'right',flexShrink:0}}>
          <div style={{fontSize:9,color:'#2a5a3a'}}>Return</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:'#00d97e'}}>+KES {estReturn.toLocaleString()}</div>
        </div>
      </div>
      {/* Buttons */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <button onClick={()=>placeTrade('CALL')} disabled={tradingBusy||(!demoMode&&!settings?.tradingEnabled)}
          style={{padding:compact?'12px 8px':'16px 8px',border:'none',borderRadius:10,background:'linear-gradient(135deg,#00c864,#00ff78)',color:'#001a0a',fontWeight:900,fontSize:compact?13:15,cursor:'pointer',opacity:tradingBusy?.7:1,boxShadow:'0 4px 20px rgba(0,255,120,0.35)',lineHeight:1.3,transition:'all .15s'}}>
          ▲ CALL<br/><span style={{fontSize:10,fontWeight:500,opacity:.8}}>Price rises</span>
        </button>
        <button onClick={()=>placeTrade('PUT')} disabled={tradingBusy||(!demoMode&&!settings?.tradingEnabled)}
          style={{padding:compact?'12px 8px':'16px 8px',border:'none',borderRadius:10,background:'linear-gradient(135deg,#cc1a2a,#ff3246)',color:'#fff',fontWeight:900,fontSize:compact?13:15,cursor:'pointer',opacity:tradingBusy?.7:1,boxShadow:'0 4px 20px rgba(255,50,70,0.35)',lineHeight:1.3,transition:'all .15s'}}>
          ▼ PUT<br/><span style={{fontSize:10,fontWeight:500,opacity:.8}}>Price falls</span>
        </button>
      </div>
      {!demoMode&&!settings?.tradingEnabled&&<div style={{marginTop:8,textAlign:'center',fontSize:11,color:'#f5a623'}}>⚠️ Trading disabled by admin</div>}
    </div>
  );

  // ── RENDER ────────────────────────────────────────────────────
  return(
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#040c06',color:'#c8d8e8',overflow:'hidden'}}>
      <style>{`
        @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes fadeMsg{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-thumb{background:#0a3018;border-radius:3px;}
        .tf-btn{cursor:pointer;border:none;font-family:inherit;transition:all .15s;}
        .tf-btn:active{transform:scale(.97);}
      `}</style>

      {/* ── HEADER ─────────────────────────────────────── */}
      <header style={{height:isMobile?52:54,background:'#050e08',borderBottom:'1px solid rgba(0,255,120,0.12)',display:'flex',alignItems:'center',padding:`0 ${isMobile?'12px':'20px'}`,gap:isMobile?8:12,flexShrink:0,zIndex:20}}>
        <div style={{fontWeight:900,fontSize:isMobile?15:18,letterSpacing:'-0.5px',color:'#e8f8e8',flexShrink:0}}>
          Trade<span style={{color:'#00d97e'}}>Flow</span><span style={{color:'#4d9ef7',fontSize:isMobile?11:13}}> Pro</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:5}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:demoMode?'#f5a623':'#00d97e',boxShadow:`0 0 7px ${demoMode?'#f5a623':'#00d97e'}`}}/>
          <span style={{fontSize:9,color:demoMode?'#f5a623':'#00d97e',fontWeight:800,letterSpacing:1.5}}>{demoMode?'DEMO':'LIVE'}</span>
        </div>
        {settings?.announcement&&!demoMode&&!isMobile&&(
          <div style={{flex:1,background:'rgba(245,166,35,0.08)',border:'1px solid rgba(245,166,35,.2)',borderRadius:5,padding:'3px 10px',fontSize:11,color:'#f5a623',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            📢 {settings.announcement}
          </div>
        )}
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:isMobile?6:10}}>
          {/* balance chip */}
          <div style={{background:'rgba(0,255,120,0.06)',border:'1px solid rgba(0,255,120,0.15)',borderRadius:7,padding:isMobile?'3px 8px':'4px 12px'}}>
            <div style={{fontSize:8,color:'#2a6a3a',fontWeight:700,textTransform:'uppercase',letterSpacing:1}}>{demoMode?'Demo':'Balance'}</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:isMobile?12:14,fontWeight:500,color:demoMode?'#00d97e':'#f5a623'}}>
              KES {(demoMode?demoBalance:balance).toLocaleString()}
            </div>
          </div>
          {!isMobile&&(demoMode?(
            <>
              <button className="tf-btn" onClick={()=>{setDemoBalance(10000);setDemoHistory([]);setDemoPositions([]);toast('Demo reset','info');}}
                style={{height:32,padding:'0 12px',borderRadius:6,border:'1px solid rgba(0,255,120,0.25)',background:'rgba(0,255,120,0.07)',color:'#00d97e',fontWeight:700,fontSize:11}}>↺ Reset</button>
              <button className="tf-btn" onClick={()=>{setDemoMode(false);setSel(assets[0]||null);}}
                style={{height:32,padding:'0 14px',borderRadius:6,border:'none',background:'#00d97e',color:'#001a00',fontWeight:800,fontSize:12}}>→ Go Live</button>
            </>
          ):(
            <>
              <button className="tf-btn" onClick={()=>{setDemoMode(true);setSel(DEMO_ASSETS[0]);toast('Demo mode activated','info');}}
                style={{height:32,padding:'0 12px',borderRadius:6,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.04)',color:'#6a8a7a',fontWeight:700,fontSize:11}}>🎮 Demo</button>
              <button className="tf-btn" onClick={()=>setShowDeposit(true)}
                style={{height:32,padding:'0 14px',borderRadius:6,border:'none',background:'linear-gradient(135deg,#00c864,#00ff78)',color:'#001a00',fontWeight:800,fontSize:12}}>📱 Deposit</button>
              <button className="tf-btn" onClick={()=>setShowWithdraw(true)}
                style={{height:32,padding:'0 12px',borderRadius:6,border:'1px solid rgba(245,166,35,0.35)',background:'rgba(245,166,35,0.08)',color:'#f5a623',fontWeight:700,fontSize:11}}>💸 Withdraw</button>
            </>
          ))}
          {/* mobile action button */}
          {isMobile&&(
            <button className="tf-btn" onClick={()=>demoMode?setShowDeposit(false)||setDemoMode(false):setShowDeposit(true)}
              style={{height:30,padding:'0 12px',borderRadius:6,border:'none',background:demoMode?'#00d97e':'#00d97e',color:'#001a00',fontWeight:800,fontSize:11}}>
              {demoMode?'Live':'Deposit'}
            </button>
          )}
          <div style={{width:30,height:30,borderRadius:'50%',background:'linear-gradient(135deg,#0a5c1a,#00d97e)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,cursor:'pointer',color:'#001a00',flexShrink:0}}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          {!isMobile&&<button className="tf-btn" onClick={logout} style={{height:30,padding:'0 10px',borderRadius:6,border:'1px solid rgba(255,255,255,0.07)',background:'transparent',color:'#4a6a5a',fontSize:11,fontWeight:600}}>Sign Out</button>}
        </div>
      </header>

      {/* ── DEMO BANNER ─────────────────────────────────── */}
      {demoMode&&(
        <div style={{background:'linear-gradient(90deg,#050e08,#040c06)',borderBottom:'1px solid rgba(0,217,126,0.2)',padding:'5px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,fontSize:11}}>
          <span>🎮 <strong style={{color:'#00d97e'}}>Demo Mode</strong> <span style={{color:'#2a6a3a',marginLeft:6}}>Practice with KES 10,000 virtual money — no real risk</span></span>
          <button className="tf-btn" onClick={()=>{setDemoMode(false);setSel(assets[0]||null);}}
            style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:4,border:'1px solid rgba(0,217,126,0.3)',background:'rgba(0,217,126,0.1)',color:'#00d97e'}}>
            → Switch to Live
          </button>
        </div>
      )}

      {/* ── NAV TABS ────────────────────────────────────── */}
      <div style={{display:'flex',background:'#050e08',borderBottom:'1px solid rgba(0,255,120,0.07)',padding:`0 ${isMobile?'8px':'16px'}`,gap:0,flexShrink:0,overflowX:'auto'}}>
        {[['trade','📈 Trade'],['signals','⚡ Signals'],['history','📋 History'],...(!demoMode?[['wallet','💳 Wallet']]:[]),['stats','📊 Stats']].map(([k,l])=>(
          <button key={k} onClick={()=>setActiveTab(k)} className="tf-btn"
            style={{padding:isMobile?'9px 10px':'10px 16px',background:'transparent',border:'none',borderBottom:`2px solid ${activeTab===k?'#00d97e':'transparent'}`,color:activeTab===k?'#00d97e':'#3a5a4a',fontWeight:700,fontSize:isMobile?10:11,cursor:'pointer',whiteSpace:'nowrap',letterSpacing:.3}}>
            {isMobile?l.split(' ')[0]:l}
          </button>
        ))}
      </div>

      {/* ── TICKER ──────────────────────────────────────── */}
      <div style={{overflow:'hidden',background:'#030a05',borderBottom:'1px solid rgba(0,255,120,0.07)',flexShrink:0,height:28,display:'flex',alignItems:'center'}}>
        <div style={{display:'flex',whiteSpace:'nowrap',animation:'marquee 50s linear infinite',willChange:'transform'}}>
          {tickerItems.map((a,i)=>(
            <span key={i} onClick={()=>setSel(a)}
              style={{fontFamily:"'DM Mono',monospace",fontSize:10,padding:'0 18px',display:'inline-flex',alignItems:'center',gap:5,borderRight:'1px solid rgba(255,255,255,0.04)',cursor:'pointer',flexShrink:0}}>
              <span style={{color:'#2a4a3a'}}>{a.name}</span>
              <span style={{color:'#5a8a7a'}}>{fmtPrice(a.price)}</span>
              <span style={{color:a.chg>=0?'#00d97e':'#f0424d'}}>{a.chg>=0?'▲':'▼'}{Math.abs(a.chg).toFixed(2)}%</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── CONTENT AREA ────────────────────────────────── */}
      <div style={{flex:1,overflow:'hidden',minHeight:0}}>

        {/* ══ TRADE TAB ════════════════════════════════════ */}
        {activeTab==='trade'&&(
          <div style={{display:'flex',height:'100%',overflow:'hidden'}}>

            {/* DESKTOP: asset sidebar */}
            {!isMobile&&(
              <div style={{width:isTablet?180:220,flexShrink:0,borderRight:'1px solid rgba(0,255,120,0.07)',display:'flex',flexDirection:'column',overflow:'hidden',background:'#050e08'}}>
                <AssetList/>
              </div>
            )}

            {/* CENTER: chart + controls */}
            <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0}}>

              {/* mobile tab row */}
              {isMobile&&(
                <div style={{display:'flex',borderBottom:'1px solid rgba(0,255,120,0.07)',flexShrink:0,background:'#050e08'}}>
                  {[['chart','📈 Chart'],['assets','🌐 Markets'],['chat','💬 Chat']].map(([k,l])=>(
                    <button key={k} onClick={()=>setMobileTab(k)} className="tf-btn"
                      style={{flex:1,padding:'8px 4px',background:'transparent',border:'none',borderBottom:`2px solid ${mobileTab===k?'#00d97e':'transparent'}`,color:mobileTab===k?'#00d97e':'#3a5a4a',fontWeight:700,fontSize:10,cursor:'pointer'}}>
                      {l}
                    </button>
                  ))}
                </div>
              )}

              {/* mobile assets panel */}
              {isMobile&&mobileTab==='assets'&&(
                <div style={{flex:1,overflow:'hidden',background:'#050e08'}}>
                  <AssetList/>
                </div>
              )}

              {/* mobile chat panel */}
              {isMobile&&mobileTab==='chat'&&(
                <div style={{flex:1,overflow:'hidden',background:'#040c06'}}>
                  <ChatPanel/>
                </div>
              )}

              {/* CHART (shown on desktop always, mobile only on chart tab) */}
              {(!isMobile||(isMobile&&mobileTab==='chart'))&&(
                <>
                  {/* asset header */}
                  {selectedAsset&&(
                    <div style={{padding:isMobile?'8px 12px':'10px 18px',borderBottom:'1px solid rgba(0,255,120,0.07)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between',background:'#050e08',flexWrap:'wrap',gap:8}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:34,height:34,borderRadius:9,background:ASSET_COLORS[selectedAsset.cat]||'#0a1a0a',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>{selectedAsset.icon}</div>
                        <div>
                          <div style={{fontSize:isMobile?14:17,fontWeight:900,color:'#e8f8e8',letterSpacing:'-0.3px'}}>{selectedAsset.name}</div>
                          <div style={{fontSize:10,color:'#2a5a3a'}}>{selectedAsset.sub} {demoMode?'· DEMO':'· Live'}</div>
                        </div>
                        <div style={{marginLeft:isMobile?8:16}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:isMobile?18:22,fontWeight:500,color:selectedAsset.chg>=0?'#00d97e':'#f0424d',lineHeight:1}}>{fmtPrice(selectedAsset.price)}</div>
                          <div style={{fontSize:11,color:selectedAsset.chg>=0?'#00d97e':'#f0424d',marginTop:2}}>{selectedAsset.chg>=0?'▲ +':'▼ '}{Math.abs(selectedAsset.chg).toFixed(2)}%</div>
                        </div>
                      </div>
                      {!isMobile&&(
                        <div style={{display:'flex',gap:20,fontSize:11}}>
                          {[['H',(selectedAsset.price*1.005).toFixed(3),'#00d97e'],['L',(selectedAsset.price*0.995).toFixed(3),'#f0424d'],['Vol',selectedAsset.vol,'#4d9ef7']].map(([l,v,c])=>(
                            <div key={l} style={{textAlign:'right'}}>
                              <div style={{color:'#2a5a3a',fontSize:9,fontWeight:700}}>{l}</div>
                              <div style={{fontFamily:"'DM Mono',monospace",color:c,fontWeight:600}}>{v}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SPIKE CHART */}
                  <div style={{flex:1,overflow:'hidden',position:'relative',background:'linear-gradient(180deg,#030a05 0%,#020805 50%,#040c06 100%)',minHeight:isMobile?180:220}}>
                    <canvas ref={canvasRef} style={{width:'100%',height:'100%',display:'block'}}/>
                  </div>

                  {/* TRADE CONTROLS */}
                  <TradeControls compact={isMobile||isTablet}/>
                </>
              )}
            </div>

            {/* RIGHT: positions + chat (desktop/tablet only) */}
            {!isMobile&&(
              <div style={{width:isTablet?200:240,flexShrink:0,borderLeft:'1px solid rgba(0,255,120,0.07)',display:'flex',flexDirection:'column',overflow:'hidden',background:'#050e08'}}>
                {/* positions */}
                <div style={{borderBottom:'1px solid rgba(0,255,120,0.07)',flexShrink:0}}>
                  <div style={{padding:'8px 12px',fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:1.5,color:'#2a6a3a',borderBottom:'1px solid rgba(0,255,120,0.05)',display:'flex',alignItems:'center',gap:6}}>
                    Open Positions {demoMode&&<span style={{color:'#f5a623',fontSize:8}}>DEMO</span>}
                  </div>
                  <div style={{maxHeight:180,overflowY:'auto'}}><PositionsPanel/></div>
                </div>
                {/* mini stats */}
                <div style={{padding:'8px 10px',borderBottom:'1px solid rgba(0,255,120,0.07)',flexShrink:0}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                    {(demoMode?[
                      ['Demo Bal',`${demoBalance.toLocaleString()}`,'#00d97e'],
                      ['Trades',demoHistory.length,'#c8d8e8'],
                      ['Wins',demoHistory.filter(t=>t.result==='WIN').length,'#00d97e'],
                      ['Win%',demoHistory.length>0?`${Math.round(demoHistory.filter(t=>t.result==='WIN').length/demoHistory.length*100)}%`:'—','#4d9ef7'],
                    ]:[
                      ['Win%',stats?`${stats.winRate}%`:'—',stats?.winRate>50?'#00d97e':'#c8d8e8'],
                      ['Today',stats?`${stats.todayPL>=0?'+':''}${(stats.todayPL||0).toLocaleString()}`:'—',stats?.todayPL>=0?'#00d97e':'#f0424d'],
                      ['Trades',stats?.tradeCount??'—','#c8d8e8'],
                      ['Profit',stats?fmtKES(stats.totalProfit):'—','#00d97e'],
                    ]).map(([l,v,c])=>(
                      <div key={l} style={{background:'rgba(0,255,120,0.04)',borderRadius:5,padding:'6px 8px',border:'1px solid rgba(0,255,120,0.08)'}}>
                        <div style={{fontSize:8,textTransform:'uppercase',letterSpacing:.8,color:'#1a4a2a',marginBottom:2}}>{l}</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:500,color:c}}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* live chat */}
                <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',minHeight:0}}>
                  <ChatPanel/>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ SIGNALS TAB ══════════════════════════════════ */}
        {activeTab==='signals'&&(
          <div style={{padding:isMobile?12:20,overflowY:'auto',height:'100%'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div style={{fontSize:isMobile?13:16,fontWeight:800,color:'#e8f8e8'}}>⚡ AI Prediction Signals</div>
              <button className="tf-btn" onClick={()=>marketAPI.signals().then(r=>setSignals(r.data)).catch(()=>{})}
                style={{padding:'5px 12px',borderRadius:6,border:'1px solid rgba(0,255,120,0.2)',background:'rgba(0,255,120,0.06)',color:'#00d97e',fontWeight:700,fontSize:11}}>↻ Refresh</button>
            </div>
            <div style={{background:'#050e08',border:'1px solid rgba(0,255,120,0.1)',borderRadius:10,overflow:'hidden'}}>
              {signals.length===0&&<div style={{padding:30,textAlign:'center',color:'#2a5a3a',fontSize:12}}>Loading signals…</div>}
              {signals.map(s=>(
                <div key={s.assetId} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderBottom:'1px solid rgba(0,255,120,0.05)',flexWrap:isMobile?'wrap':'nowrap'}}>
                  <div style={{width:34,height:34,borderRadius:8,background:'#0a1a0a',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>{s.icon}</div>
                  <div style={{flex:1,minWidth:isMobile?'calc(100% - 90px)':0}}>
                    <div style={{fontSize:13,fontWeight:700,color:'#c8d8e8'}}>{s.name}</div>
                    <div style={{fontSize:11,color:'#2a5a3a',marginBottom:5}}>{s.conf}% confidence · RSI: {s.rsi} · {s.trend}</div>
                    <div style={{height:4,background:'rgba(255,255,255,0.05)',borderRadius:2}}>
                      <div style={{width:`${s.conf}%`,height:'100%',borderRadius:2,background:`linear-gradient(90deg,${s.direction==='CALL'?'#00c864,#00ff78':'#cc1a2a,#ff3246'})`}}/>
                    </div>
                  </div>
                  <span style={{fontSize:12,fontWeight:800,padding:'5px 14px',borderRadius:20,background:s.direction==='CALL'?'rgba(0,217,126,0.12)':'rgba(240,66,77,0.12)',color:s.direction==='CALL'?'#00d97e':'#f0424d',border:`1px solid ${s.direction==='CALL'?'rgba(0,217,126,0.25)':'rgba(240,66,77,0.25)'}`,flexShrink:0}}>
                    {s.direction}
                  </span>
                </div>
              ))}
            </div>
            <div style={{marginTop:12,padding:'10px 14px',background:'rgba(245,166,35,0.06)',borderRadius:8,border:'1px solid rgba(245,166,35,0.15)',fontSize:11,color:'#7a6a3a',lineHeight:1.6}}>
              ⚠️ Signals use RSI, moving averages & momentum. Not guaranteed. Trade responsibly.
            </div>
          </div>
        )}

        {/* ══ HISTORY TAB ══════════════════════════════════ */}
        {activeTab==='history'&&(
          <div style={{padding:isMobile?12:20,overflowY:'auto',height:'100%'}}>
            <div style={{fontSize:isMobile?13:16,fontWeight:800,color:'#e8f8e8',marginBottom:14}}>
              Trade History {demoMode&&<span style={{color:'#00d97e',fontSize:11}}>[DEMO]</span>}
            </div>
            <div style={{background:'#050e08',border:'1px solid rgba(0,255,120,0.1)',borderRadius:10,overflow:'hidden'}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:isMobile?11:13}}>
                  <thead>
                    <tr style={{borderBottom:'1px solid rgba(0,255,120,0.1)'}}>
                      {['Asset','Dir','Stake','Result','P/L','Time'].map(h=>(
                        <th key={h} style={{padding:'10px 12px',textAlign:'left',fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:1,color:'#2a5a3a',whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeHistory.length===0&&<tr><td colSpan={6} style={{textAlign:'center',color:'#2a5a3a',padding:30,fontSize:12}}>No trades yet</td></tr>}
                    {activeHistory.map(t=>(
                      <tr key={t.id} style={{borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                        <td style={{padding:'9px 12px'}}>
                          <div style={{fontWeight:700,color:'#c8d8e8'}}>{t.asset}</div>
                          <div style={{fontSize:9,color:'#2a5a3a'}}>{t.expiryLabel}</div>
                        </td>
                        <td style={{padding:'9px 12px'}}>
                          <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:t.direction==='CALL'?'rgba(0,217,126,0.12)':'rgba(240,66,77,0.12)',color:t.direction==='CALL'?'#00d97e':'#f0424d'}}>{t.direction}</span>
                        </td>
                        <td style={{padding:'9px 12px',fontFamily:"'DM Mono',monospace",color:'#8ab8a8',whiteSpace:'nowrap'}}>KES {t.stake?.toLocaleString()}</td>
                        <td style={{padding:'9px 12px'}}>
                          <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:t.result==='WIN'?'rgba(0,217,126,0.12)':t.result==='PENDING'?'rgba(245,166,35,0.12)':'rgba(240,66,77,0.12)',color:t.result==='WIN'?'#00d97e':t.result==='PENDING'?'#f5a623':'#f0424d'}}>{t.result}</span>
                        </td>
                        <td style={{padding:'9px 12px',fontFamily:"'DM Mono',monospace",color:t.payout>=0?'#00d97e':'#f0424d',fontWeight:600,whiteSpace:'nowrap'}}>
                          {t.payout!=null?`${t.payout>=0?'+':''}${t.payout.toLocaleString()}`:'—'}
                        </td>
                        <td style={{padding:'9px 12px',fontSize:10,color:'#2a5a3a',whiteSpace:'nowrap'}}>
                          {t.settledAt?new Date(t.settledAt).toLocaleString('en-KE',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'}):'—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ WALLET TAB ════════════════════════════════════ */}
        {activeTab==='wallet'&&!demoMode&&(
          <div style={{padding:isMobile?12:20,overflowY:'auto',height:'100%'}}>
            <div style={{fontSize:isMobile?13:16,fontWeight:800,color:'#e8f8e8',marginBottom:14}}>💳 Wallet & Transactions</div>
            <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(3,1fr)',gap:10,marginBottom:16}}>
              {[['Balance',`KES ${balance.toLocaleString()}`,'#f5a623'],['Deposited',`KES ${(stats?.totalDeposited||0).toLocaleString()}`,'#00d97e'],['Withdrawn',`KES ${(stats?.totalWithdrawn||0).toLocaleString()}`,'#8ab8a8']].map(([l,v,c])=>(
                <div key={l} style={{background:'#050e08',border:'1px solid rgba(0,255,120,0.1)',borderRadius:10,padding:'14px 16px',textAlign:'center'}}>
                  <div style={{fontSize:10,color:'#2a5a3a',textTransform:'uppercase',letterSpacing:1,marginBottom:5}}>{l}</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:isMobile?16:20,fontWeight:500,color:c}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
              <button className="tf-btn" onClick={()=>setShowDeposit(true)}
                style={{padding:'14px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#00c864,#00ff78)',color:'#001a00',fontWeight:900,fontSize:isMobile?13:14,boxShadow:'0 4px 20px rgba(0,255,120,0.3)'}}>📱 Deposit via M-Pesa</button>
              <button className="tf-btn" onClick={()=>setShowWithdraw(true)}
                style={{padding:'14px',borderRadius:10,border:'1px solid rgba(245,166,35,0.4)',background:'rgba(245,166,35,0.08)',color:'#f5a623',fontWeight:900,fontSize:isMobile?13:14}}>💸 Withdraw to M-Pesa</button>
            </div>
            <div style={{fontSize:13,fontWeight:700,color:'#c8d8e8',marginBottom:10}}>Transaction History</div>
            <div style={{background:'#050e08',border:'1px solid rgba(0,255,120,0.1)',borderRadius:10,overflow:'hidden'}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{borderBottom:'1px solid rgba(0,255,120,0.08)'}}>
                    {['Type','Amount','Status','Date','Notes'].map(h=>(
                      <th key={h} style={{padding:'9px 12px',textAlign:'left',fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:1,color:'#2a5a3a'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {transactions.length===0&&<tr><td colSpan={5} style={{textAlign:'center',color:'#2a5a3a',padding:30}}>No transactions yet</td></tr>}
                    {transactions.map(t=>(
                      <tr key={t.id} style={{borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                        <td style={{padding:'9px 12px'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:t.type==='deposit'?'rgba(0,217,126,0.12)':t.type==='withdrawal'?'rgba(245,166,35,0.12)':'rgba(77,158,247,0.12)',color:t.type==='deposit'?'#00d97e':t.type==='withdrawal'?'#f5a623':'#4d9ef7'}}>{t.type.replace('_',' ')}</span></td>
                        <td style={{padding:'9px 12px',fontFamily:"'DM Mono',monospace",fontWeight:600,color:'#8ab8a8',whiteSpace:'nowrap'}}>KES {t.amount?.toLocaleString()}</td>
                        <td style={{padding:'9px 12px'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:t.status==='success'?'rgba(0,217,126,0.12)':t.status==='pending'?'rgba(245,166,35,0.12)':'rgba(240,66,77,0.12)',color:t.status==='success'?'#00d97e':t.status==='pending'?'#f5a623':'#f0424d'}}>{t.status}</span></td>
                        <td style={{padding:'9px 12px',fontSize:10,color:'#2a5a3a',whiteSpace:'nowrap'}}>{new Date(t.createdAt).toLocaleString('en-KE',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                        <td style={{padding:'9px 12px',fontSize:10,color:'#2a5a3a',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.notes||t.mpesaRef||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ STATS TAB ════════════════════════════════════ */}
        {activeTab==='stats'&&(
          <div style={{padding:isMobile?12:20,overflowY:'auto',height:'100%'}}>
            <div style={{fontSize:isMobile?13:16,fontWeight:800,color:'#e8f8e8',marginBottom:14}}>
              📊 {demoMode?'Demo Performance':'My Performance'}
            </div>
            <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:10,marginBottom:16}}>
              {(demoMode?[
                ['Demo Balance',`KES ${demoBalance.toLocaleString()}`,'#f5a623'],
                ['Total Trades',demoHistory.length,'#c8d8e8'],
                ['Wins',demoHistory.filter(t=>t.result==='WIN').length,'#00d97e'],
                ['Win Rate',demoHistory.length>0?`${Math.round(demoHistory.filter(t=>t.result==='WIN').length/demoHistory.length*100)}%`:'—','#4d9ef7'],
              ]:[
                ['Total Profit',`KES ${(stats?.totalProfit||0).toLocaleString()}`,'#00d97e'],
                ['Total Loss',`KES ${(stats?.totalLoss||0).toLocaleString()}`,'#f0424d'],
                ['Win Rate',`${stats?.winRate||0}%`,stats?.winRate>50?'#00d97e':'#c8d8e8'],
                ['Total Trades',stats?.tradeCount||0,'#c8d8e8'],
              ]).map(([l,v,c])=>(
                <div key={l} style={{background:'#050e08',border:'1px solid rgba(0,255,120,0.1)',borderRadius:10,padding:'14px 16px',textAlign:'center'}}>
                  <div style={{fontSize:9,color:'#2a5a3a',textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>{l}</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:isMobile?17:22,fontWeight:500,color:c}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{background:'#050e08',border:'1px solid rgba(0,255,120,0.1)',borderRadius:10,overflow:'hidden'}}>
              <div style={{padding:'12px 16px',borderBottom:'1px solid rgba(0,255,120,0.07)',fontSize:12,fontWeight:700,color:'#c8d8e8'}}>Recent Results</div>
              {activeHistory.length===0&&<div style={{padding:30,textAlign:'center',fontSize:12,color:'#2a5a3a'}}>No trades yet</div>}
              {activeHistory.slice(0,15).map(t=>(
                <div key={t.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 16px',borderBottom:'1px solid rgba(255,255,255,0.03)',flexWrap:'wrap',gap:6}}>
                  <span style={{fontSize:12,fontWeight:700,color:'#c8d8e8'}}>{t.asset} <span style={{color:'#2a5a3a',fontWeight:400}}>·</span> {t.direction}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:'2px 10px',borderRadius:20,background:t.result==='WIN'?'rgba(0,217,126,0.12)':'rgba(240,66,77,0.12)',color:t.result==='WIN'?'#00d97e':'#f0424d'}}>{t.result}</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:t.payout>=0?'#00d97e':'#f0424d',fontWeight:600}}>{t.payout!=null?`${t.payout>=0?'+':''}${t.payout.toLocaleString()}`:'—'}</span>
                  <span style={{fontSize:10,color:'#2a5a3a'}}>{t.settledAt?new Date(t.settledAt).toLocaleString('en-KE',{hour:'2-digit',minute:'2-digit'}):'—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showDeposit&&<DepositModal balance={balance} onSuccess={onDepositSuccess} onClose={()=>setShowDeposit(false)}/>}
      {showWithdraw&&<WithdrawModal balance={balance} onSuccess={onWithdrawSuccess} onClose={()=>setShowWithdraw(false)}/>}
    </div>
  );
}
