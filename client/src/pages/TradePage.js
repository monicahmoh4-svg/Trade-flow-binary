import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { marketAPI, tradeAPI, userAPI, settingsAPI } from '../utils/api';
import DepositModal from '../components/DepositModal';
import WithdrawModal from '../components/WithdrawModal';

function fmtPrice(p){
  if(!p) return '0.0000';
  if(p>=10000) return p.toFixed(2);
  if(p>=100)   return p.toFixed(3);
  if(p>=1)     return p.toFixed(4);
  return p.toFixed(5);
}
function fmtKES(n){
  const a=Math.abs(n);
  if(a>=1000000) return 'KES '+(n/1e6).toFixed(2)+'M';
  if(a>=1000)    return 'KES '+(n/1e3).toFixed(1)+'K';
  return 'KES '+n.toLocaleString();
}

const EXPIRY_OPTIONS=[
  {label:'30s',key:'30s',sec:30},
  {label:'1m', key:'1m', sec:60},
  {label:'5m', key:'5m', sec:300},
  {label:'15m',key:'15m',sec:900},
  {label:'30m',key:'30m',sec:1800},
];

const ASSET_COLORS={forex:'#0f2a45',crypto:'#1a0f2a',nse:'#0a2a0f',comm:'#2a1a00'};

const DEMO_ASSETS=[
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

const FAKE_NAMES=['Wanjiku','Kamau','Otieno','Njoroge','Achieng','Mwangi','Chebet','Odhiambo','Waweru','Kipchoge','Adhiambo','Mutua','Wairimu','Omondi','Kariuki','Nekesa','Gathoni','Simiyu','Wacera','Rotich','Njoki','Makau','Auma','Kirui','Mumbi','Juma','Wambui','Korir','Awino','Muigai','Zawadi','Barasa','Kamene','Nyambura'];
const ASSET_NAMES=['USD/KES','EUR/KES','BTC/USD','ETH/USD','SCOM','XAU/USD','WTI Oil','EQTY','GBP/KES','SOL/USD','KENO'];
function rName(){return FAKE_NAMES[Math.floor(Math.random()*FAKE_NAMES.length)];}
function rAsset(){return ASSET_NAMES[Math.floor(Math.random()*ASSET_NAMES.length)];}
function rAmt(mn=100,mx=9000){return Math.floor(Math.random()*(mx-mn)+mn);}
function rMsg(){
  const n=rName(),a=rAsset(),v=rAmt();
  const pool=[
    `🎉 ${n} just won KES ${v.toLocaleString()} on ${a}!`,
    `System: CONGRATULATIONS @${n} on your withdrawal of ${rAmt(100,5000).toLocaleString()} 🥳🥳`,
    `System: CONGRATULATIONS @${n} on your withdrawal of ${rAmt(200,10000).toLocaleString()} 🎊🎊`,
    `💸 ${n} withdrew KES ${rAmt(500,20000).toLocaleString()} to M-Pesa successfully`,
    `🔥 ${n} placed KES ${v.toLocaleString()} CALL on ${a} — let's go!`,
    `📈 ${n} is on a WIN streak! +KES ${rAmt(200,4000).toLocaleString()} profit today`,
    `⚡ ${n} deposited KES ${rAmt(500,10000).toLocaleString()} and jumped in!`,
    `🚀 ${n} doubled up on ${a} — +KES ${rAmt(300,6000).toLocaleString()} 🎯`,
    `💰 ${n} cashed out KES ${rAmt(1000,25000).toLocaleString()}! 🥳`,
    `${n}: Successfully claimed BONUS of ${rAmt(10,50).toLocaleString()}.`,
    `System: CONGRATULATIONS @${n} on your withdrawal of ${rAmt(100,800).toLocaleString()} 🥳🥳`,
    `🎯 ${n} nailed a PUT on ${a} +KES ${rAmt(200,3000).toLocaleString()}`,
    `🌟 ${n} just joined TradeFlow Pro — Welcome!`,
    `System: BONUS of ${rAmt(10,100).toLocaleString()} has been issued to ${n}.`,
    `💎 ${n} VIP upgrade! Trading with KES ${rAmt(5000,50000).toLocaleString()}`,
  ];
  return pool[Math.floor(Math.random()*pool.length)];
}
function tickAssets(prev){
  return prev.map(a=>({
    ...a,
    price:Math.max(0.01,a.price+(Math.random()-0.495)*a.price*0.0015),
    chg:Math.max(-9.99,Math.min(9.99,a.chg+(Math.random()-0.5)*0.05)),
  }));
}

export default function TradePage(){
  const {user,logout}=useAuth();
  const toast=useToast();
  const canvasRef=useRef(null);
  const chatEndRef=useRef(null);
  const chartDataRef=useRef([]);

  // responsive
  const [isMobile,setIsMobile]=useState(window.innerWidth<768);
  const [isTablet,setIsTablet]=useState(window.innerWidth>=768&&window.innerWidth<1100);
  const [mobileTab,setMobileTab]=useState('chart');

  useEffect(()=>{
    const fn=()=>{
      setIsMobile(window.innerWidth<768);
      setIsTablet(window.innerWidth>=768&&window.innerWidth<1100);
    };
    window.addEventListener('resize',fn);
    return ()=>window.removeEventListener('resize',fn);
  },[]);

  // demo
  const [demoMode,setDemoMode]=useState(false);
  const [demoBalance,setDemoBalance]=useState(10000);
  const [demoAssets,setDemoAssets]=useState(DEMO_ASSETS);
  const [demoHistory,setDemoHistory]=useState([]);
  const [demoPositions,setDemoPositions]=useState([]);

  // real
  const [assets,setAssets]=useState([]);
  const [signals,setSignals]=useState([]);
  const [sel,setSel]=useState(null);
  const [positions,setPositions]=useState([]);
  const [tradeHistory,setTradeHistory]=useState([]);
  const [transactions,setTransactions]=useState([]);
  const [stats,setStats]=useState(null);
  const [settings,setSettings]=useState(null);
  const [balance,setBalance]=useState(user?.balance||0);

  // ui
  const [catFilter,setCatFilter]=useState('all');
  const [searchQ,setSearchQ]=useState('');
  const [activeTab,setActiveTab]=useState('trade');
  const [expiry,setExpiry]=useState(EXPIRY_OPTIONS[1]);
  const [stake,setStake]=useState(500);
  const [showDeposit,setShowDeposit]=useState(false);
  const [showWithdraw,setShowWithdraw]=useState(false);
  const [tradingBusy,setTradingBusy]=useState(false);

  // chart
  const [chartData,setChartData]=useState([]);
  const [liveRate,setLiveRate]=useState(0);

  // chat
  const [chatMsgs,setChatMsgs]=useState(()=>{
    const s=[];
    for(let i=0;i<18;i++) s.push({id:i,text:rMsg(),ts:Date.now()-(18-i)*5000});
    return s;
  });

  const activeAssets   =demoMode?demoAssets:assets;
  const activeBalance  =demoMode?demoBalance:balance;
  const activePositions=demoMode?demoPositions:positions;
  const activeHistory  =demoMode?demoHistory:tradeHistory;
  const selectedAsset  =sel?activeAssets.find(a=>a.id===sel.id)||sel:null;
  const payoutRate     =settings?.payoutRates?.[expiry.key]||86;
  const estReturn      =Math.round(stake*payoutRate/100);

  // seed chart
  useEffect(()=>{
    const seed=[];
    let v=0;
    for(let i=0;i<120;i++){
      v+=(Math.random()-0.49)*0.005+(Math.random()<0.08?Math.random()*0.07:0)+(Math.random()<0.05?-Math.random()*0.06:0);
      v=Math.max(-0.12,Math.min(0.18,v));
      seed.push(parseFloat(v.toFixed(4)));
    }
    chartDataRef.current=seed;
    setChartData([...seed]);
    setLiveRate(seed[seed.length-1]);
  },[sel]);

  // animate chart
  useEffect(()=>{
    const iv=setInterval(()=>{
      const prev=chartDataRef.current;
      const last=prev[prev.length-1]||0;
      const spike =Math.random()<0.09?Math.random()*0.08:0;
      const crash =Math.random()<0.06?-Math.random()*0.07:0;
      let next=last+(Math.random()-0.49)*0.005+spike+crash;
      next=Math.max(-0.13,Math.min(0.20,parseFloat(next.toFixed(4))));
      const nd=[...prev.slice(-159),next];
      chartDataRef.current=nd;
      setChartData([...nd]);
      setLiveRate(next);
    },280);
    return ()=>clearInterval(iv);
  },[]);

  // draw chart — matches reference image style
  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas||chartData.length<2) return;
    const dpr=window.devicePixelRatio||1;
    const W=canvas.offsetWidth,H=canvas.offsetHeight;
    if(!W||!H) return;
    canvas.width=W*dpr; canvas.height=H*dpr;
    const ctx=canvas.getContext('2d');
    ctx.scale(dpr,dpr);

    const data=chartData;
    const fixed_max=0.14, fixed_min=-0.10;
    const rng=fixed_max-fixed_min;
    const pL=52,pR=14,pT=32,pB=32;
    const cW=W-pL-pR, cH=H-pT-pB;

    const px=i=>pL+(i/(data.length-1))*cW;
    const py=v=>pT+cH-((v-fixed_min)/rng)*cH;
    const zeroY=py(0);

    // black background
    ctx.fillStyle='#0a0a0a';
    ctx.fillRect(0,0,W,H);

    // horizontal grid lines with labels — exactly like reference
    const gridVals=[0.12,0.06,0.00,-0.06];
    gridVals.forEach(v=>{
      const y=py(v);
      // dotted line
      ctx.strokeStyle='rgba(255,255,255,0.15)';
      ctx.lineWidth=1;
      ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(W-pR,y); ctx.stroke();
      ctx.setLineDash([]);
      // label on left
      ctx.fillStyle='rgba(200,220,200,0.7)';
      ctx.font=`11px 'DM Mono',monospace`;
      ctx.textAlign='right';
      ctx.fillText(v.toFixed(2),pL-6,y+4);
    });

    // zero line solid
    ctx.strokeStyle='rgba(255,255,255,0.3)';
    ctx.lineWidth=1.5;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(pL,zeroY); ctx.lineTo(W-pR,zeroY); ctx.stroke();

    // GREEN fill above zero
    ctx.beginPath();
    ctx.moveTo(px(0),Math.min(py(data[0]),zeroY));
    for(let i=0;i<data.length;i++){
      const y=py(data[i]);
      ctx.lineTo(px(i),Math.min(y,zeroY));
    }
    ctx.lineTo(px(data.length-1),zeroY);
    ctx.lineTo(px(0),zeroY);
    ctx.closePath();
    const gGrad=ctx.createLinearGradient(0,pT,0,zeroY);
    gGrad.addColorStop(0,'rgba(0,200,60,0.9)');
    gGrad.addColorStop(0.4,'rgba(0,180,50,0.7)');
    gGrad.addColorStop(1,'rgba(0,140,40,0.3)');
    ctx.fillStyle=gGrad;
    ctx.fill();

    // RED fill below zero
    ctx.beginPath();
    ctx.moveTo(px(0),Math.max(py(data[0]),zeroY));
    for(let i=0;i<data.length;i++){
      const y=py(data[i]);
      ctx.lineTo(px(i),Math.max(y,zeroY));
    }
    ctx.lineTo(px(data.length-1),zeroY);
    ctx.lineTo(px(0),zeroY);
    ctx.closePath();
    const rGrad=ctx.createLinearGradient(0,zeroY,0,pT+cH);
    rGrad.addColorStop(0,'rgba(160,0,20,0.4)');
    rGrad.addColorStop(0.5,'rgba(180,0,20,0.7)');
    rGrad.addColorStop(1,'rgba(200,0,30,0.95)');
    ctx.fillStyle=rGrad;
    ctx.fill();

    // LINE — green above zero, red below
    const isUp=liveRate>=0;
    const lineCol=isUp?'#00e055':'#ff2233';

    // draw line segment by segment coloured
    for(let i=1;i<data.length;i++){
      const segUp=(data[i]>=0&&data[i-1]>=0)||data[i]>data[i-1];
      ctx.beginPath();
      ctx.moveTo(px(i-1),py(data[i-1]));
      ctx.lineTo(px(i),py(data[i]));
      ctx.strokeStyle=data[i]>=0?'#00e055':'#ff2233';
      ctx.lineWidth=2;
      ctx.lineJoin='round';
      ctx.stroke();
    }

    // glow on line
    ctx.shadowColor=isUp?'rgba(0,255,80,0.6)':'rgba(255,30,50,0.6)';
    ctx.shadowBlur=8;
    ctx.beginPath();
    ctx.moveTo(px(0),py(data[0]));
    for(let i=1;i<data.length;i++) ctx.lineTo(px(i),py(data[i]));
    ctx.strokeStyle=isUp?'rgba(0,255,80,0.3)':'rgba(255,30,50,0.3)';
    ctx.lineWidth=4;
    ctx.stroke();
    ctx.shadowBlur=0;

    // live dot
    const lx=px(data.length-1),ly=py(data[data.length-1]);
    [16,9,5].forEach((r,idx)=>{
      ctx.beginPath(); ctx.arc(lx,ly,r,0,Math.PI*2);
      ctx.fillStyle=isUp
        ?`rgba(0,255,80,${[0.15,0.3,1][idx]})`
        :`rgba(255,30,50,${[0.15,0.3,1][idx]})`;
      ctx.fill();
    });

    // Rate badge — exactly like reference: white box with black border
    const rateStr='Rate: '+(liveRate>=0?'+':'')+liveRate.toFixed(4);
    const bW=170,bH=38,bX=(W/2)-bW/2,bY=6;
    // white rounded rect
    ctx.fillStyle='rgba(255,255,255,0.95)';
    ctx.strokeStyle='#222';
    ctx.lineWidth=1.5;
    ctx.shadowColor='rgba(0,0,0,0.5)';
    ctx.shadowBlur=8;
    ctx.beginPath();
    ctx.roundRect(bX,bY,bW,bH,6);
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur=0;
    // text
    ctx.fillStyle=isUp?'#007730':'#cc0020';
    ctx.font=`bold 17px 'DM Mono',monospace`;
    ctx.textAlign='center';
    ctx.fillText(rateStr,bX+bW/2,bY+25);

    // small arrow dots at bottom like reference image
    const dotPositions=[0.15,0.3,0.5,0.65,0.8,0.92];
    dotPositions.forEach(frac=>{
      const x=pL+frac*cW;
      const dotY=pT+cH+14;
      ctx.beginPath(); ctx.arc(x,dotY,3,0,Math.PI*2);
      ctx.fillStyle='#00e055';
      ctx.fill();
    });
  },[chartData,liveRate,selectedAsset]);

  // chat scroll
  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:'smooth'}); },[chatMsgs]);

  // fake chat
  useEffect(()=>{
    let t;
    const s=()=>{
      t=setTimeout(()=>{
        setChatMsgs(p=>[...p,{id:Date.now(),text:rMsg(),ts:Date.now()}].slice(-80));
        s();
      },900+Math.random()*2400);
    };
    s();
    return ()=>clearTimeout(t);
  },[]);

  // load real data
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
    const iv=setInterval(load,3000);
    return ()=>clearInterval(iv);
  },[sel,demoMode]);

  useEffect(()=>{
    if(!demoMode) return;
    if(!sel) setSel(DEMO_ASSETS[0]);
    const iv=setInterval(()=>setDemoAssets(p=>tickAssets(p)),1500);
    return ()=>clearInterval(iv);
  },[demoMode,sel]);

  // position timer
  useEffect(()=>{
    const iv=setInterval(()=>{
      const tick=p=>p.map(x=>({...x,elapsedSec:Math.min((x.elapsedSec||0)+1,x.totalSec||x.expirySec||300)}));
      if(demoMode) setDemoPositions(tick); else setPositions(tick);
    },1000);
    return ()=>clearInterval(iv);
  },[demoMode]);

  // demo trade
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

  // real trade
  const placeRealTrade=async dir=>{
    if(!selectedAsset) return;
    if(stake<(settings?.minStake||50)){toast(`Min KES ${settings?.minStake||50}`,'error');return;}
    if(stake>balance){toast('Insufficient balance. Deposit first.','error');return;}
    setTradingBusy(true);
    try{
      const r=await tradeAPI.place({asset:selectedAsset.name,direction:dir,stake,expirySec:expiry.sec,expiryLabel:expiry.key,entryPrice:selectedAsset.price});
      const {trade,newBalance}=r.data;
      setBalance(newBalance);
      toast(`${dir} placed — KES ${stake.toLocaleString()} on ${selectedAsset.name}`,'info');
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
            userAPI.stats().then(r2=>setStats(r2.data)).catch(()=>{});
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
  const catLabels={all:'All',forex:'FX',crypto:'Crypto',nse:'NSE',comm:'Comm'};

  // ── sub-components ────────────────────────────────────
  const AssetList=()=>(
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{padding:'8px',borderBottom:'1px solid #111'}}>
        <input placeholder="Search…" value={searchQ} onChange={e=>setSearchQ(e.target.value)}
          style={{width:'100%',background:'#111',border:'1px solid #222',borderRadius:5,padding:'6px 9px',color:'#ccc',fontSize:11,outline:'none'}}/>
      </div>
      <div style={{display:'flex',gap:3,padding:'5px 7px',borderBottom:'1px solid #111',flexWrap:'wrap'}}>
        {cats.map(c=>(
          <button key={c} onClick={()=>setCatFilter(c)}
            style={{fontSize:9,fontWeight:700,padding:'3px 7px',borderRadius:20,cursor:'pointer',border:'1px solid',
              borderColor:catFilter===c?'#00e055':'#222',
              color:catFilter===c?'#00e055':'#555',
              background:catFilter===c?'rgba(0,224,85,0.1)':'transparent'}}>
            {catLabels[c]}
          </button>
        ))}
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {filteredAssets.map(a=>{
          const s=sel?.id===a.id;
          return(
            <div key={a.id} onClick={()=>{setSel(a);if(isMobile)setMobileTab('chart');}}
              style={{display:'flex',alignItems:'center',gap:7,padding:'8px 9px',borderBottom:'1px solid #0d0d0d',cursor:'pointer',
                background:s?'rgba(0,224,85,0.06)':'transparent',
                borderLeft:s?'3px solid #00e055':'3px solid transparent'}}>
              <div style={{width:28,height:28,borderRadius:6,background:ASSET_COLORS[a.cat]||'#111',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}>{a.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:700,color:'#ddd'}}>{a.name}</div>
                <div style={{fontSize:9,color:'#444',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.sub}</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontFamily:'monospace',fontSize:10,color:'#888'}}>{fmtPrice(a.price)}</div>
                <div style={{fontSize:9,fontWeight:700,color:a.chg>=0?'#00e055':'#ff2233'}}>{a.chg>=0?'+':''}{a.chg.toFixed(2)}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const ChatPanel=()=>(
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#080808'}}>
      <div style={{padding:'9px 12px',background:'#00a83a',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
        <span style={{fontSize:16}}>💬</span>
        <span style={{fontSize:13,fontWeight:800,color:'#fff',letterSpacing:.5}}>Chat</span>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:5}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:'#7eff7e'}}/>
          <span style={{fontSize:9,color:'rgba(255,255,255,0.8)',fontWeight:600}}>{Math.floor(130+Math.random()*70)} online</span>
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'4px 0'}}>
        {chatMsgs.map(m=>{
          const isSys=m.text.startsWith('System:');
          const isWin=m.text.includes('CONGRATULATIONS')||m.text.includes('won')||m.text.includes('WIN');
          const isCash=m.text.includes('withdrew')||m.text.includes('cashed')||m.text.includes('withdrawal');
          let nameColor='#e8c44a';
          let msgColor='#ccc';
          if(isSys){nameColor='#ff6600';msgColor='#ff9933';}
          else if(isWin){nameColor='#00cc44';}
          else if(isCash){nameColor='#44aaff';}

          const colonIdx=m.text.indexOf(':');
          const hasColon=colonIdx>0&&colonIdx<30;

          return(
            <div key={m.id} style={{padding:'5px 12px',borderBottom:'1px solid #0f0f0f',lineHeight:1.5,fontSize:12}}>
              {hasColon?(
                <>
                  <span style={{fontWeight:800,color:nameColor}}>{m.text.slice(0,colonIdx)}:</span>
                  <span style={{color:msgColor}}>{m.text.slice(colonIdx+1)}</span>
                </>
              ):(
                <span style={{color:msgColor}}>{m.text}</span>
              )}
            </div>
          );
        })}
        <div ref={chatEndRef}/>
      </div>
    </div>
  );

  const PositionsPanel=()=>(
    <div>
      {activePositions.length===0?(
        <div style={{padding:'14px 12px',textAlign:'center',fontSize:11,color:'#333'}}>No open positions</div>
      ):activePositions.map(p=>{
        const pct=Math.min(((p.elapsedSec||0)/(p.totalSec||300))*100,100);
        const rem=Math.max(0,(p.totalSec||300)-(p.elapsedSec||0));
        const col=p.direction==='CALL'?'#00e055':'#ff2233';
        return(
          <div key={p.id} style={{padding:'8px 12px',borderBottom:'1px solid #111'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
              <div style={{fontSize:11,fontWeight:700,color:'#ddd'}}>{p.asset}</div>
              <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:20,
                background:p.direction==='CALL'?'rgba(0,224,85,0.15)':'rgba(255,34,51,0.15)',color:col}}>{p.direction}</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#444',marginBottom:4}}>
              <span>KES {p.stake?.toLocaleString()}</span>
              <span style={{fontFamily:'monospace',color:col}}>{rem>=60?`${Math.ceil(rem/60)}m`:`${rem}s`}</span>
            </div>
            <div style={{height:3,background:'#1a1a1a',borderRadius:2}}>
              <div style={{width:`${pct}%`,height:'100%',background:col,borderRadius:2,transition:'width 1s linear'}}/>
            </div>
          </div>
        );
      })}
    </div>
  );

  const TradeControls=({compact=false})=>(
    <div style={{background:'#070707',borderTop:'2px solid #181818',padding:compact?'10px 12px':'12px 16px',flexShrink:0}}>
      {/* expiry */}
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8,flexWrap:'wrap'}}>
        <span style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:1.5,color:'#444',flexShrink:0}}>EXPIRY</span>
        {EXPIRY_OPTIONS.map(o=>(
          <button key={o.key} onClick={()=>setExpiry(o)}
            style={{fontSize:10,fontWeight:700,padding:'4px 10px',borderRadius:20,cursor:'pointer',border:'1px solid',
              borderColor:expiry.key===o.key?'#00e055':'#222',
              color:expiry.key===o.key?'#00e055':'#555',
              background:expiry.key===o.key?'rgba(0,224,85,0.1)':'transparent',transition:'all .12s'}}>
            {o.label}
          </button>
        ))}
        <div style={{marginLeft:'auto',fontFamily:'monospace',fontSize:11,background:'rgba(245,166,35,0.1)',
          border:'1px solid rgba(245,166,35,0.3)',borderRadius:5,padding:'3px 9px',color:'#f5a623',whiteSpace:'nowrap',flexShrink:0}}>
          {payoutRate}% payout
        </div>
      </div>
      {/* stake */}
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10,flexWrap:'wrap'}}>
        <span style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:1.5,color:'#444',flexShrink:0}}>STAKE</span>
        <div style={{display:'flex',alignItems:'center',gap:5,background:'#111',border:'1.5px solid #00e05544',borderRadius:7,padding:'6px 10px'}}>
          <span style={{fontSize:10,fontWeight:700,color:'#444'}}>KES</span>
          <input type="number" value={stake} onChange={e=>setStake(Number(e.target.value))} min={50}
            style={{border:'none',background:'transparent',fontFamily:'monospace',fontSize:14,fontWeight:500,width:80,padding:0,color:'#eee',outline:'none'}}/>
        </div>
        {[500,1000,2000,5000].map(v=>(
          <button key={v} onClick={()=>setStake(v)}
            style={{fontSize:10,fontWeight:700,padding:'5px 9px',borderRadius:6,cursor:'pointer',background:'#111',border:'1px solid #222',color:'#555',transition:'all .12s'}}>
            {v>=1000?`${v/1000}K`:v}
          </button>
        ))}
        <div style={{marginLeft:'auto',textAlign:'right',flexShrink:0}}>
          <div style={{fontSize:9,color:'#333'}}>Est. Return</div>
          <div style={{fontFamily:'monospace',fontSize:12,color:'#00e055',fontWeight:700}}>+KES {estReturn.toLocaleString()}</div>
        </div>
      </div>
      {/* trade buttons */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <button onClick={()=>placeTrade('CALL')} disabled={tradingBusy||(!demoMode&&settings?.tradingEnabled===false)}
          style={{padding:compact?'14px 8px':'18px 8px',border:'none',borderRadius:10,
            background:'linear-gradient(135deg,#008c3a,#00e055)',color:'#001a0a',fontWeight:900,
            fontSize:compact?14:16,cursor:'pointer',opacity:tradingBusy?.6:1,
            boxShadow:'0 4px 24px rgba(0,224,85,0.4)',lineHeight:1.3,transition:'all .15s'}}>
          ▲ CALL<br/><span style={{fontSize:10,fontWeight:500,opacity:.8}}>Price rises</span>
        </button>
        <button onClick={()=>placeTrade('PUT')} disabled={tradingBusy||(!demoMode&&settings?.tradingEnabled===false)}
          style={{padding:compact?'14px 8px':'18px 8px',border:'none',borderRadius:10,
            background:'linear-gradient(135deg,#990020,#ff2233)',color:'#fff',fontWeight:900,
            fontSize:compact?14:16,cursor:'pointer',opacity:tradingBusy?.6:1,
            boxShadow:'0 4px 24px rgba(255,34,51,0.4)',lineHeight:1.3,transition:'all .15s'}}>
          ▼ PUT<br/><span style={{fontSize:10,fontWeight:500,opacity:.8}}>Price falls</span>
        </button>
      </div>
      {!demoMode&&settings?.tradingEnabled===false&&(
        <div style={{marginTop:8,textAlign:'center',fontSize:11,color:'#f5a623'}}>⚠️ Trading disabled by admin</div>
      )}
    </div>
  );

  const StatsGrid=()=>(
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,padding:'8px 10px'}}>
      {(demoMode?[
        ['Demo Bal',`${demoBalance.toLocaleString()}`,'#00e055'],
        ['Trades',demoHistory.length,'#ccc'],
        ['Wins',demoHistory.filter(t=>t.result==='WIN').length,'#00e055'],
        ['Win%',demoHistory.length>0?`${Math.round(demoHistory.filter(t=>t.result==='WIN').length/demoHistory.length*100)}%`:'—','#4d9ef7'],
      ]:[
        ['Win%',stats?`${stats.winRate}%`:'—',stats?.winRate>50?'#00e055':'#ccc'],
        ['Today',stats?`${stats.todayPL>=0?'+':''}${(stats.todayPL||0).toLocaleString()}`:'—',(stats?.todayPL||0)>=0?'#00e055':'#ff2233'],
        ['Trades',stats?.tradeCount??'—','#ccc'],
        ['Profit',stats?fmtKES(stats.totalProfit):'—','#00e055'],
      ]).map(([l,v,c])=>(
        <div key={l} style={{background:'#0d0d0d',borderRadius:5,padding:'7px 9px',border:'1px solid #181818'}}>
          <div style={{fontSize:8,textTransform:'uppercase',letterSpacing:.8,color:'#333',marginBottom:2}}>{l}</div>
          <div style={{fontFamily:'monospace',fontSize:12,fontWeight:700,color:c}}>{v}</div>
        </div>
      ))}
    </div>
  );

  // ── MAIN RENDER ────────────────────────────────────────
  return(
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#0a0a0a',color:'#ccc',overflow:'hidden',fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <style>{`
        @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        *{box-sizing:border-box;}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-thumb{background:#1a1a1a;border-radius:3px;}
        button:active{transform:scale(.96);}
      `}</style>

      {/* ── HEADER ─────────────────────────────────────── */}
      <header style={{
        height:isMobile?52:56,
        background:'#050505',
        borderBottom:'1px solid #1a1a1a',
        display:'flex',alignItems:'center',
        padding:`0 ${isMobile?'10px':'20px'}`,
        gap:isMobile?6:12,flexShrink:0,zIndex:20
      }}>
        {/* logo */}
        <div style={{fontWeight:900,fontSize:isMobile?15:19,letterSpacing:'-0.5px',color:'#fff',flexShrink:0}}>
          Trade<span style={{color:'#00e055'}}>Flow</span><span style={{color:'#4d9ef7',fontSize:isMobile?11:14}}> Pro</span>
        </div>
        {/* live dot */}
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:demoMode?'#f5a623':'#00e055',boxShadow:`0 0 8px ${demoMode?'#f5a623':'#00e055'}`}}/>
          <span style={{fontSize:9,color:demoMode?'#f5a623':'#00e055',fontWeight:800,letterSpacing:1.5}}>{demoMode?'DEMO':'LIVE'}</span>
        </div>
        {settings?.announcement&&!demoMode&&!isMobile&&(
          <div style={{flex:1,background:'rgba(245,166,35,0.08)',border:'1px solid rgba(245,166,35,.2)',borderRadius:5,padding:'3px 10px',fontSize:11,color:'#f5a623',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            📢 {settings.announcement}
          </div>
        )}
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:isMobile?5:10}}>
          {/* balance */}
          <div style={{background:'#111',border:'1px solid #222',borderRadius:7,padding:isMobile?'3px 8px':'5px 12px',flexShrink:0}}>
            <div style={{fontSize:8,color:'#444',fontWeight:700,textTransform:'uppercase',letterSpacing:1}}>{demoMode?'Demo':'Balance'}</div>
            <div style={{fontFamily:'monospace',fontSize:isMobile?12:14,fontWeight:700,color:demoMode?'#00e055':'#f5a623'}}>
              KES {(demoMode?demoBalance:balance).toLocaleString()}
            </div>
          </div>

          {/* DEMO BUTTON — always visible */}
          {!demoMode&&(
            <button onClick={()=>{setDemoMode(true);setSel(DEMO_ASSETS[0]);toast('Demo mode — KES 10,000 virtual','info');}}
              style={{height:isMobile?30:32,padding:`0 ${isMobile?'8px':'12px'}`,borderRadius:7,
                border:'1px solid #333',background:'#151515',color:'#888',fontWeight:700,fontSize:isMobile?10:11,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}}>
              🎮 {isMobile?'Demo':'Demo Mode'}
            </button>
          )}
          {demoMode&&(
            <>
              <button onClick={()=>{setDemoBalance(10000);setDemoHistory([]);setDemoPositions([]);toast('Demo reset','info');}}
                style={{height:isMobile?30:32,padding:`0 ${isMobile?'7px':'10px'}`,borderRadius:7,
                  border:'1px solid #00e05544',background:'rgba(0,224,85,0.08)',color:'#00e055',fontWeight:700,fontSize:isMobile?9:11,cursor:'pointer',flexShrink:0}}>
                ↺ {isMobile?'':'Reset'}
              </button>
              <button onClick={()=>{setDemoMode(false);setSel(assets[0]||null);}}
                style={{height:isMobile?30:32,padding:`0 ${isMobile?'8px':'12px'}`,borderRadius:7,
                  border:'none',background:'#00e055',color:'#001a00',fontWeight:800,fontSize:isMobile?10:11,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}}>
                → {isMobile?'Live':'Go Live'}
              </button>
            </>
          )}

          {/* deposit / withdraw — desktop */}
          {!isMobile&&!demoMode&&(
            <>
              <button onClick={()=>setShowDeposit(true)}
                style={{height:32,padding:'0 14px',borderRadius:7,border:'none',background:'linear-gradient(135deg,#008c3a,#00e055)',color:'#001a00',fontWeight:800,fontSize:12,cursor:'pointer',whiteSpace:'nowrap'}}>
                📱 Deposit
              </button>
              <button onClick={()=>setShowWithdraw(true)}
                style={{height:32,padding:'0 12px',borderRadius:7,border:'1px solid #f5a62344',background:'rgba(245,166,35,0.08)',color:'#f5a623',fontWeight:700,fontSize:11,cursor:'pointer',whiteSpace:'nowrap'}}>
                💸 Withdraw
              </button>
            </>
          )}
          {/* deposit on mobile (not in demo) */}
          {isMobile&&!demoMode&&(
            <button onClick={()=>setShowDeposit(true)}
              style={{height:30,padding:'0 10px',borderRadius:7,border:'none',background:'#00e055',color:'#001a00',fontWeight:800,fontSize:10,cursor:'pointer',flexShrink:0}}>
              📱 Deposit
            </button>
          )}

          {/* avatar */}
          <div style={{width:30,height:30,borderRadius:'50%',background:'linear-gradient(135deg,#004d1a,#00e055)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,cursor:'pointer',color:'#001a00',flexShrink:0}}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          {!isMobile&&(
            <button onClick={logout} style={{height:30,padding:'0 10px',borderRadius:6,border:'1px solid #1a1a1a',background:'transparent',color:'#444',fontSize:11,fontWeight:600,cursor:'pointer'}}>Out</button>
          )}
        </div>
      </header>

      {/* demo banner */}
      {demoMode&&(
        <div style={{background:'#0a1a0a',borderBottom:'1px solid #00e05530',padding:'5px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,gap:8}}>
          <span style={{fontSize:isMobile?10:12}}>🎮 <strong style={{color:'#00e055'}}>Demo Mode</strong> <span style={{color:'#2a5a3a'}}>— KES 10,000 virtual. No real money.</span></span>
          <div style={{display:'flex',gap:6,flexShrink:0}}>
            {isMobile&&(
              <>
                <button onClick={()=>setShowDeposit(true)} style={{height:26,padding:'0 8px',borderRadius:5,border:'none',background:'#00e055',color:'#001a00',fontWeight:800,fontSize:10,cursor:'pointer'}}>Deposit</button>
                <button onClick={()=>setShowWithdraw(true)} style={{height:26,padding:'0 8px',borderRadius:5,border:'1px solid #f5a62344',background:'transparent',color:'#f5a623',fontWeight:700,fontSize:10,cursor:'pointer'}}>Withdraw</button>
              </>
            )}
            <button onClick={()=>{setDemoMode(false);setSel(assets[0]||null);}}
              style={{height:26,padding:'0 10px',borderRadius:5,border:'1px solid #00e05544',background:'rgba(0,224,85,0.1)',color:'#00e055',fontWeight:700,fontSize:10,cursor:'pointer'}}>
              → Live
            </button>
          </div>
        </div>
      )}

      {/* nav tabs */}
      <div style={{display:'flex',background:'#060606',borderBottom:'1px solid #151515',padding:`0 ${isMobile?'6px':'16px'}`,flexShrink:0,overflowX:'auto'}}>
        {[['trade','📈 Trade'],['signals','⚡ Signals'],['history','📋 History'],...(!demoMode?[['wallet','💳 Wallet']]:[]),['stats','📊 Stats']].map(([k,l])=>(
          <button key={k} onClick={()=>setActiveTab(k)}
            style={{padding:isMobile?'9px 10px':'10px 16px',background:'transparent',border:'none',
              borderBottom:`2px solid ${activeTab===k?'#00e055':'transparent'}`,
              color:activeTab===k?'#00e055':'#444',fontWeight:700,fontSize:isMobile?10:11,cursor:'pointer',whiteSpace:'nowrap',letterSpacing:.3}}>
            {isMobile?l.split(' ')[0]:l}
          </button>
        ))}
        {isMobile&&!demoMode&&(
          <button onClick={()=>setShowWithdraw(true)} style={{marginLeft:'auto',padding:'9px 10px',background:'transparent',border:'none',borderBottom:'2px solid transparent',color:'#f5a623',fontWeight:700,fontSize:10,cursor:'pointer',whiteSpace:'nowrap'}}>
            💸 Out
          </button>
        )}
      </div>

      {/* ticker */}
      <div style={{overflow:'hidden',background:'#050505',borderBottom:'1px solid #111',flexShrink:0,height:26,display:'flex',alignItems:'center'}}>
        <div style={{display:'flex',whiteSpace:'nowrap',animation:'marquee 45s linear infinite',willChange:'transform'}}>
          {[...activeAssets,...activeAssets].map((a,i)=>(
            <span key={i} onClick={()=>setSel(a)}
              style={{fontFamily:'monospace',fontSize:10,padding:'0 16px',display:'inline-flex',alignItems:'center',gap:5,borderRight:'1px solid #111',cursor:'pointer',flexShrink:0}}>
              <span style={{color:'#333'}}>{a.name}</span>
              <span style={{color:'#666'}}>{fmtPrice(a.price)}</span>
              <span style={{color:a.chg>=0?'#00e055':'#ff2233'}}>{a.chg>=0?'▲':'▼'}{Math.abs(a.chg).toFixed(2)}%</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── CONTENT ─────────────────────────────────────── */}
      <div style={{flex:1,overflow:'hidden',minHeight:0}}>

        {/* TRADE TAB */}
        {activeTab==='trade'&&(
          <div style={{display:'flex',height:'100%',overflow:'hidden'}}>

            {/* asset sidebar — desktop only */}
            {!isMobile&&(
              <div style={{width:isTablet?175:215,flexShrink:0,borderRight:'1px solid #111',display:'flex',flexDirection:'column',overflow:'hidden',background:'#070707'}}>
                <AssetList/>
              </div>
            )}

            {/* CENTER */}
            <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0}}>

              {/* mobile sub-tabs */}
              {isMobile&&(
                <div style={{display:'flex',background:'#060606',borderBottom:'1px solid #111',flexShrink:0}}>
                  {[['chart','📈 Chart'],['assets','🌐 Markets'],['chat','💬 Chat']].map(([k,l])=>(
                    <button key={k} onClick={()=>setMobileTab(k)}
                      style={{flex:1,padding:'8px 4px',background:'transparent',border:'none',
                        borderBottom:`2px solid ${mobileTab===k?'#00e055':'transparent'}`,
                        color:mobileTab===k?'#00e055':'#444',fontWeight:700,fontSize:10,cursor:'pointer'}}>
                      {l}
                    </button>
                  ))}
                </div>
              )}

              {isMobile&&mobileTab==='assets'&&<div style={{flex:1,overflow:'hidden',background:'#070707'}}><AssetList/></div>}
              {isMobile&&mobileTab==='chat'&&<div style={{flex:1,overflow:'hidden'}}><ChatPanel/></div>}

              {(!isMobile||(isMobile&&mobileTab==='chart'))&&(
                <>
                  {/* asset header bar */}
                  {selectedAsset&&(
                    <div style={{padding:isMobile?'7px 10px':'9px 16px',borderBottom:'1px solid #111',flexShrink:0,
                      display:'flex',alignItems:'center',justifyContent:'space-between',background:'#080808',flexWrap:'wrap',gap:6}}>
                      <div style={{display:'flex',alignItems:'center',gap:9}}>
                        <div style={{width:30,height:30,borderRadius:7,background:ASSET_COLORS[selectedAsset.cat]||'#111',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>{selectedAsset.icon}</div>
                        <div>
                          <div style={{fontSize:isMobile?13:17,fontWeight:900,color:'#eee'}}>{selectedAsset.name}</div>
                          <div style={{fontSize:9,color:'#333'}}>{selectedAsset.sub}{demoMode?' · DEMO':' · Live'}</div>
                        </div>
                        <div style={{marginLeft:isMobile?6:14}}>
                          <div style={{fontFamily:'monospace',fontSize:isMobile?16:22,fontWeight:700,color:selectedAsset.chg>=0?'#00e055':'#ff2233',lineHeight:1}}>{fmtPrice(selectedAsset.price)}</div>
                          <div style={{fontSize:10,color:selectedAsset.chg>=0?'#00e055':'#ff2233',marginTop:1}}>{selectedAsset.chg>=0?'▲ +':'▼ '}{Math.abs(selectedAsset.chg).toFixed(2)}%</div>
                        </div>
                      </div>
                      {!isMobile&&(
                        <div style={{display:'flex',gap:16}}>
                          {[['H',(selectedAsset.price*1.005).toFixed(3),'#00e055'],['L',(selectedAsset.price*0.995).toFixed(3),'#ff2233'],['Vol',selectedAsset.vol,'#4d9ef7']].map(([l,v,c])=>(
                            <div key={l} style={{textAlign:'right'}}>
                              <div style={{fontSize:9,color:'#333',fontWeight:700}}>{l}</div>
                              <div style={{fontFamily:'monospace',fontSize:11,color:c,fontWeight:600}}>{v}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ══ SPIKE CHART ══ */}
                  <div style={{flex:1,overflow:'hidden',background:'#0a0a0a',position:'relative',minHeight:isMobile?200:260}}>
                    <canvas ref={canvasRef} style={{width:'100%',height:'100%',display:'block'}}/>
                  </div>

                  <TradeControls compact={isMobile||isTablet}/>
                </>
              )}
            </div>

            {/* RIGHT PANEL — desktop */}
            {!isMobile&&(
              <div style={{width:isTablet?195:245,flexShrink:0,borderLeft:'1px solid #111',display:'flex',flexDirection:'column',overflow:'hidden',background:'#070707'}}>
                {/* positions */}
                <div style={{borderBottom:'1px solid #111',flexShrink:0}}>
                  <div style={{padding:'8px 12px',fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:1.5,color:'#333',borderBottom:'1px solid #0d0d0d',display:'flex',alignItems:'center',gap:6}}>
                    Positions{demoMode&&<span style={{color:'#f5a623',fontSize:8}}> DEMO</span>}
                  </div>
                  <div style={{maxHeight:185,overflowY:'auto'}}><PositionsPanel/></div>
                </div>
                <StatsGrid/>
                {/* chat fills rest */}
                <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',minHeight:0,borderTop:'1px solid #111'}}>
                  <ChatPanel/>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SIGNALS */}
        {activeTab==='signals'&&(
          <div style={{padding:isMobile?12:20,overflowY:'auto',height:'100%'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div style={{fontSize:isMobile?13:16,fontWeight:800,color:'#eee'}}>⚡ AI Prediction Signals</div>
              <button onClick={()=>marketAPI.signals().then(r=>setSignals(r.data)).catch(()=>{})}
                style={{padding:'5px 12px',borderRadius:6,border:'1px solid #222',background:'#111',color:'#00e055',fontWeight:700,fontSize:11,cursor:'pointer'}}>↻ Refresh</button>
            </div>
            <div style={{background:'#080808',border:'1px solid #181818',borderRadius:10,overflow:'hidden'}}>
              {signals.length===0&&<div style={{padding:30,textAlign:'center',color:'#333',fontSize:12}}>Loading signals…</div>}
              {signals.map(s=>(
                <div key={s.assetId} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderBottom:'1px solid #0d0d0d',flexWrap:'wrap'}}>
                  <div style={{width:32,height:32,borderRadius:8,background:'#111',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>{s.icon}</div>
                  <div style={{flex:1,minWidth:140}}>
                    <div style={{fontSize:13,fontWeight:700,color:'#ddd'}}>{s.name}</div>
                    <div style={{fontSize:11,color:'#444',marginBottom:5}}>{s.conf}% confidence · RSI: {s.rsi} · {s.trend}</div>
                    <div style={{height:4,background:'#111',borderRadius:2}}>
                      <div style={{width:`${s.conf}%`,height:'100%',borderRadius:2,background:s.direction==='CALL'?'linear-gradient(90deg,#008c3a,#00e055)':'linear-gradient(90deg,#990020,#ff2233)'}}/>
                    </div>
                  </div>
                  <span style={{fontSize:12,fontWeight:800,padding:'5px 14px',borderRadius:20,
                    background:s.direction==='CALL'?'rgba(0,224,85,0.12)':'rgba(255,34,51,0.12)',
                    color:s.direction==='CALL'?'#00e055':'#ff2233',
                    border:`1px solid ${s.direction==='CALL'?'rgba(0,224,85,0.3)':'rgba(255,34,51,0.3)'}`,flexShrink:0}}>
                    {s.direction}
                  </span>
                </div>
              ))}
            </div>
            <div style={{marginTop:12,padding:'10px 14px',background:'rgba(245,166,35,0.05)',borderRadius:8,border:'1px solid rgba(245,166,35,0.15)',fontSize:11,color:'#666',lineHeight:1.6}}>
              ⚠️ Signals use RSI, MA & momentum analysis. Not guaranteed. Trade responsibly.
            </div>
          </div>
        )}

        {/* HISTORY */}
        {activeTab==='history'&&(
          <div style={{padding:isMobile?10:20,overflowY:'auto',height:'100%'}}>
            <div style={{fontSize:isMobile?13:16,fontWeight:800,color:'#eee',marginBottom:14}}>
              Trade History {demoMode&&<span style={{color:'#00e055',fontSize:11}}>[DEMO]</span>}
            </div>
            <div style={{background:'#080808',border:'1px solid #181818',borderRadius:10,overflow:'hidden'}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:isMobile?11:13}}>
                  <thead><tr style={{borderBottom:'1px solid #181818'}}>
                    {['Asset','Dir','Stake','Result','P/L','Time'].map(h=>(
                      <th key={h} style={{padding:'9px 12px',textAlign:'left',fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:1,color:'#333',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {activeHistory.length===0&&<tr><td colSpan={6} style={{textAlign:'center',color:'#333',padding:30,fontSize:12}}>No trades yet</td></tr>}
                    {activeHistory.map(t=>(
                      <tr key={t.id} style={{borderBottom:'1px solid #0d0d0d'}}>
                        <td style={{padding:'9px 12px'}}><div style={{fontWeight:700,color:'#ddd'}}>{t.asset}</div><div style={{fontSize:9,color:'#333'}}>{t.expiryLabel}</div></td>
                        <td style={{padding:'9px 12px'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:t.direction==='CALL'?'rgba(0,224,85,0.12)':'rgba(255,34,51,0.12)',color:t.direction==='CALL'?'#00e055':'#ff2233'}}>{t.direction}</span></td>
                        <td style={{padding:'9px 12px',fontFamily:'monospace',color:'#888',whiteSpace:'nowrap'}}>KES {t.stake?.toLocaleString()}</td>
                        <td style={{padding:'9px 12px'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:t.result==='WIN'?'rgba(0,224,85,0.12)':t.result==='PENDING'?'rgba(245,166,35,0.12)':'rgba(255,34,51,0.12)',color:t.result==='WIN'?'#00e055':t.result==='PENDING'?'#f5a623':'#ff2233'}}>{t.result}</span></td>
                        <td style={{padding:'9px 12px',fontFamily:'monospace',color:t.payout>=0?'#00e055':'#ff2233',fontWeight:700,whiteSpace:'nowrap'}}>{t.payout!=null?`${t.payout>=0?'+':''}${t.payout.toLocaleString()}`:'—'}</td>
                        <td style={{padding:'9px 12px',fontSize:10,color:'#333',whiteSpace:'nowrap'}}>{t.settledAt?new Date(t.settledAt).toLocaleString('en-KE',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'}):'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* WALLET */}
        {activeTab==='wallet'&&!demoMode&&(
          <div style={{padding:isMobile?10:20,overflowY:'auto',height:'100%'}}>
            <div style={{fontSize:isMobile?13:16,fontWeight:800,color:'#eee',marginBottom:14}}>💳 Wallet & Transactions</div>
            <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(3,1fr)',gap:10,marginBottom:16}}>
              {[['Balance',`KES ${balance.toLocaleString()}`,'#f5a623'],['Deposited',`KES ${(stats?.totalDeposited||0).toLocaleString()}`,'#00e055'],['Withdrawn',`KES ${(stats?.totalWithdrawn||0).toLocaleString()}`,'#888']].map(([l,v,c])=>(
                <div key={l} style={{background:'#080808',border:'1px solid #181818',borderRadius:10,padding:'14px 16px',textAlign:'center'}}>
                  <div style={{fontSize:10,color:'#333',textTransform:'uppercase',letterSpacing:1,marginBottom:5}}>{l}</div>
                  <div style={{fontFamily:'monospace',fontSize:isMobile?16:20,fontWeight:700,color:c}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
              <button onClick={()=>setShowDeposit(true)}
                style={{padding:'15px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#008c3a,#00e055)',color:'#001a00',fontWeight:900,fontSize:isMobile?13:14,cursor:'pointer',boxShadow:'0 4px 20px rgba(0,224,85,0.3)'}}>
                📱 Deposit via M-Pesa
              </button>
              <button onClick={()=>setShowWithdraw(true)}
                style={{padding:'15px',borderRadius:10,border:'1px solid #f5a62344',background:'rgba(245,166,35,0.08)',color:'#f5a623',fontWeight:900,fontSize:isMobile?13:14,cursor:'pointer'}}>
                💸 Withdraw to M-Pesa
              </button>
            </div>
            <div style={{fontSize:13,fontWeight:700,color:'#ccc',marginBottom:10}}>Transaction History</div>
            <div style={{background:'#080808',border:'1px solid #181818',borderRadius:10,overflow:'hidden'}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{borderBottom:'1px solid #181818'}}>
                    {['Type','Amount','Status','Date','Notes'].map(h=>(
                      <th key={h} style={{padding:'9px 12px',textAlign:'left',fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:1,color:'#333'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {transactions.length===0&&<tr><td colSpan={5} style={{textAlign:'center',color:'#333',padding:30}}>No transactions yet</td></tr>}
                    {transactions.map(t=>(
                      <tr key={t.id} style={{borderBottom:'1px solid #0d0d0d'}}>
                        <td style={{padding:'9px 12px'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:t.type==='deposit'?'rgba(0,224,85,0.12)':t.type==='withdrawal'?'rgba(245,166,35,0.12)':'rgba(77,158,247,0.12)',color:t.type==='deposit'?'#00e055':t.type==='withdrawal'?'#f5a623':'#4d9ef7'}}>{t.type.replace('_',' ')}</span></td>
                        <td style={{padding:'9px 12px',fontFamily:'monospace',fontWeight:700,color:'#888',whiteSpace:'nowrap'}}>KES {t.amount?.toLocaleString()}</td>
                        <td style={{padding:'9px 12px'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:t.status==='success'?'rgba(0,224,85,0.12)':t.status==='pending'?'rgba(245,166,35,0.12)':'rgba(255,34,51,0.12)',color:t.status==='success'?'#00e055':t.status==='pending'?'#f5a623':'#ff2233'}}>{t.status}</span></td>
                        <td style={{padding:'9px 12px',fontSize:10,color:'#333',whiteSpace:'nowrap'}}>{new Date(t.createdAt).toLocaleString('en-KE',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                        <td style={{padding:'9px 12px',fontSize:10,color:'#333',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.notes||t.mpesaRef||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* STATS */}
        {activeTab==='stats'&&(
          <div style={{padding:isMobile?10:20,overflowY:'auto',height:'100%'}}>
            <div style={{fontSize:isMobile?13:16,fontWeight:800,color:'#eee',marginBottom:14}}>
              📊 {demoMode?'Demo Performance':'My Performance'}
            </div>
            <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:10,marginBottom:16}}>
              {(demoMode?[
                ['Demo Balance',`KES ${demoBalance.toLocaleString()}`,'#f5a623'],
                ['Total Trades',demoHistory.length,'#ccc'],
                ['Wins',demoHistory.filter(t=>t.result==='WIN').length,'#00e055'],
                ['Win Rate',demoHistory.length>0?`${Math.round(demoHistory.filter(t=>t.result==='WIN').length/demoHistory.length*100)}%`:'—','#4d9ef7'],
              ]:[
                ['Total Profit',`KES ${(stats?.totalProfit||0).toLocaleString()}`,'#00e055'],
                ['Total Loss',`KES ${(stats?.totalLoss||0).toLocaleString()}`,'#ff2233'],
                ['Win Rate',`${stats?.winRate||0}%`,stats?.winRate>50?'#00e055':'#ccc'],
                ['Total Trades',stats?.tradeCount||0,'#ccc'],
              ]).map(([l,v,c])=>(
                <div key={l} style={{background:'#080808',border:'1px solid #181818',borderRadius:10,padding:'14px 16px',textAlign:'center'}}>
                  <div style={{fontSize:9,color:'#333',textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>{l}</div>
                  <div style={{fontFamily:'monospace',fontSize:isMobile?17:22,fontWeight:700,color:c}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{background:'#080808',border:'1px solid #181818',borderRadius:10,overflow:'hidden'}}>
              <div style={{padding:'12px 16px',borderBottom:'1px solid #111',fontSize:12,fontWeight:700,color:'#ccc'}}>Recent Results</div>
              {activeHistory.length===0&&<div style={{padding:30,textAlign:'center',fontSize:12,color:'#333'}}>No trades yet</div>}
              {activeHistory.slice(0,15).map(t=>(
                <div key={t.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 16px',borderBottom:'1px solid #0d0d0d',flexWrap:'wrap',gap:6}}>
                  <span style={{fontSize:12,fontWeight:700,color:'#ddd'}}>{t.asset} · {t.direction}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:'2px 10px',borderRadius:20,background:t.result==='WIN'?'rgba(0,224,85,0.12)':'rgba(255,34,51,0.12)',color:t.result==='WIN'?'#00e055':'#ff2233'}}>{t.result}</span>
                  <span style={{fontFamily:'monospace',fontSize:12,color:t.payout>=0?'#00e055':'#ff2233',fontWeight:700}}>{t.payout!=null?`${t.payout>=0?'+':''}${t.payout.toLocaleString()}`:'—'}</span>
                  <span style={{fontSize:10,color:'#333'}}>{t.settledAt?new Date(t.settledAt).toLocaleString('en-KE',{hour:'2-digit',minute:'2-digit'}):'—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showDeposit&&<DepositModal balance={activeBalance} onSuccess={onDepositSuccess} onClose={()=>setShowDeposit(false)}/>}
      {showWithdraw&&<WithdrawModal balance={balance} onSuccess={onWithdrawSuccess} onClose={()=>setShowWithdraw(false)}/>}
    </div>
  );
}
