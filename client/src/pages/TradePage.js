import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { marketAPI, tradeAPI, paymentAPI, userAPI, settingsAPI } from '../utils/api';
import DepositModal from '../components/DepositModal';
import WithdrawModal from '../components/WithdrawModal';

const ASSET_COLORS = {
  forex: '#0f2a45', crypto: '#1a0f2a', nse: '#0a2a0f', comm: '#2a1a00'
};

function fmtPrice(price) {
  if (price >= 10000) return price.toFixed(2);
  if (price >= 100) return price.toFixed(3);
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(5);
}

function fmtKES(n) {
  const abs = Math.abs(n);
  if (abs >= 1000000) return 'KES ' + (n / 1000000).toFixed(2) + 'M';
  if (abs >= 1000) return 'KES ' + (n / 1000).toFixed(1) + 'K';
  return 'KES ' + n.toLocaleString();
}

const EXPIRY_OPTIONS = [
  { label: '1 Min', key: '1m', sec: 60 },
  { label: '5 Min', key: '5m', sec: 300 },
  { label: '15 Min', key: '15m', sec: 900 },
  { label: '30 Min', key: '30m', sec: 1800 },
  { label: '1 Hour', key: '1h', sec: 3600 },
];

export default function TradePage() {
  const { user, logout, refreshUser } = useAuth();
  const toast = useToast();
  const canvasRef = useRef(null);

  const [assets, setAssets] = useState([]);
  const [signals, setSignals] = useState([]);
  const [sel, setSel] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [positions, setPositions] = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [catFilter, setCatFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [activeTab, setActiveTab] = useState('trade');
  const [expiry, setExpiry] = useState(EXPIRY_OPTIONS[1]);
  const [stake, setStake] = useState(500);
  const [balance, setBalance] = useState(user?.balance || 0);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [tradingBusy, setTradingBusy] = useState(false);

  // Load initial data
  useEffect(() => {
    settingsAPI.public().then(r => setSettings(r.data)).catch(() => {});
    userAPI.stats().then(r => { setStats(r.data); setBalance(r.data.balance); }).catch(() => {});
    userAPI.trades().then(r => setTradeHistory(r.data)).catch(() => {});
    userAPI.transactions().then(r => setTransactions(r.data)).catch(() => {});
    loadSignals();
  }, []);

  // Load assets + poll
  useEffect(() => {
    const load = () => marketAPI.assets().then(r => {
      setAssets(r.data);
      if (!sel && r.data.length) setSel(r.data[0]);
    }).catch(() => {});
    load();
    const iv = setInterval(load, 2500);
    return () => clearInterval(iv);
  }, [sel]);

  // Price history for chart
  useEffect(() => {
    if (!sel) return;
    setPriceHistory(prev => {
      const cur = assets.find(a => a.id === sel.id);
      if (!cur) return prev;
      const next = [...prev, cur.price];
      return next.length > 120 ? next.slice(-120) : next;
    });
  }, [assets, sel]);

  // Draw chart
  useEffect(() => {
    if (!canvasRef.current || priceHistory.length < 2) return;
    const canvas = canvasRef.current;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    if (!W || !H) return;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const data = priceHistory;
    const mn = Math.min(...data), mx = Math.max(...data);
    const rng = mx - mn || mn * 0.001;
    const pad = { t: 10, b: 24, l: 10, r: 60 };
    const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
    const px = i => pad.l + (i / (data.length - 1)) * cW;
    const py = v => pad.t + cH - ((v - mn) / rng) * cH;
    const isUp = data[data.length - 1] >= data[0];
    const col = isUp ? '#00d97e' : '#f0424d';
    ctx.clearRect(0, 0, W, H);
    // Grid
    for (let i = 1; i < 5; i++) {
      const y = pad.t + (cH / 5) * i;
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // Fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, isUp ? 'rgba(0,217,126,.15)' : 'rgba(240,66,77,.15)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.moveTo(px(0), py(data[0]));
    for (let i = 1; i < data.length; i++) ctx.lineTo(px(i), py(data[i]));
    ctx.lineTo(px(data.length - 1), H); ctx.lineTo(px(0), H); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    // Line
    ctx.beginPath();
    ctx.moveTo(px(0), py(data[0]));
    for (let i = 1; i < data.length; i++) ctx.lineTo(px(i), py(data[i]));
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    // Dot
    const lx = px(data.length - 1), ly = py(data[data.length - 1]);
    ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
    // Price labels
    ctx.fillStyle = 'rgba(107,122,153,.7)';
    ctx.font = '10px DM Mono,monospace';
    ctx.textAlign = 'left';
    for (let i = 0; i <= 4; i++) {
      const v = mn + (rng / 4) * i;
      const y = py(v);
      if (y > pad.t + 5 && y < H - pad.b - 5)
        ctx.fillText(fmtPrice(v), W - pad.r + 4, y + 3);
    }
    // Current price label
    ctx.fillStyle = col;
    ctx.font = 'bold 11px DM Mono,monospace';
    ctx.fillText(fmtPrice(data[data.length - 1]), W - pad.r + 4, ly + 3);
  }, [priceHistory]);

  const loadSignals = () => {
    marketAPI.signals().then(r => setSignals(r.data)).catch(() => {});
  };

  const selectedAsset = sel ? assets.find(a => a.id === sel.id) || sel : null;

  const filteredAssets = assets.filter(a => {
    if (catFilter !== 'all' && a.cat !== catFilter) return false;
    if (searchQ && !a.name.toLowerCase().includes(searchQ.toLowerCase()) && !a.sub.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  const payoutRate = settings?.payoutRates?.[expiry.key] || 86;
  const estReturn = Math.round(stake * payoutRate / 100);

  const placeTrade = async (direction) => {
    if (!selectedAsset) return;
    if (stake < (settings?.minStake || 50)) { toast(`Minimum stake is KES ${settings?.minStake || 50}`, 'error'); return; }
    if (stake > balance) { toast('Insufficient balance. Please deposit.', 'error'); return; }
    setTradingBusy(true);
    try {
      const r = await tradeAPI.place({
        asset: selectedAsset.name, direction, stake,
        expirySec: expiry.sec, expiryLabel: expiry.key,
        entryPrice: selectedAsset.price
      });
      const { trade, newBalance } = r.data;
      setBalance(newBalance);
      toast(`${direction} placed — KES ${stake.toLocaleString()} on ${selectedAsset.name}`, 'info');
      // Track position
      const pos = { ...trade, totalSec: expiry.sec, elapsedSec: 0 };
      setPositions(p => [pos, ...p]);
      // Poll for result
      pollTradeResult(trade.id, expiry.sec);
    } catch (err) {
      toast(err.response?.data?.error || 'Trade failed', 'error');
    } finally { setTradingBusy(false); }
  };

  const pollTradeResult = (tradeId, maxSec) => {
    const cap = Math.min(maxSec * 1000, 16000);
    setTimeout(async () => {
      try {
        const r = await tradeAPI.result(tradeId);
        const { trade, balance: newBal } = r.data;
        if (trade.result !== 'PENDING') {
          setBalance(newBal);
          setPositions(p => p.filter(x => x.id !== tradeId));
          setTradeHistory(p => [trade, ...p.slice(0, 49)]);
          const win = trade.result === 'WIN';
          toast(win ? `🎉 WIN +KES ${Math.abs(trade.payout).toLocaleString()}` : `Trade closed — Loss KES ${stake.toLocaleString()}`, win ? 'success' : 'error');
          userAPI.stats().then(r => setStats(r.data)).catch(() => {});
        } else {
          pollTradeResult(tradeId, 5);
        }
      } catch { }
    }, cap);
  };

  const onDepositSuccess = (amount) => {
    setBalance(b => b + amount);
    setShowDeposit(false);
    toast(`KES ${amount.toLocaleString()} credited to your wallet`, 'success');
    userAPI.transactions().then(r => setTransactions(r.data)).catch(() => {});
  };

  const onWithdrawSuccess = (amount) => {
    setBalance(b => b - amount);
    setShowWithdraw(false);
    toast('Withdrawal request submitted', 'info');
    userAPI.transactions().then(r => setTransactions(r.data)).catch(() => {});
  };

  // Position timer
  useEffect(() => {
    const iv = setInterval(() => {
      setPositions(p => p.map(pos => ({ ...pos, elapsedSec: Math.min((pos.elapsedSec || 0) + 1, pos.totalSec || pos.expirySec) })));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const cats = ['all', 'forex', 'crypto', 'nse', 'comm'];
  const catLabels = { all: 'All', forex: 'Forex', crypto: 'Crypto', nse: 'NSE', comm: 'Comm' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{ height: 54, background: 'var(--surface)', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0, zIndex: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px' }}>
          Trade<span style={{ color: 'var(--green)' }}>Flow</span> <span style={{ color: 'var(--blue)', fontSize: 13 }}>Pro</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 4 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }} />
          <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>LIVE</span>
        </div>
        {settings?.announcement && (
          <div style={{ flex: 1, background: 'var(--gold-dim)', border: '1px solid rgba(245,166,35,.2)', borderRadius: 'var(--radius-sm)', padding: '4px 12px', fontSize: 11, color: 'var(--gold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📢 {settings.announcement}
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '5px 12px' }}>
            <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Balance</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 500, color: 'var(--gold)' }}>KES {balance.toLocaleString()}</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowDeposit(true)}>📱 Deposit</button>
          <button className="btn btn-sm" style={{ borderColor: 'var(--gold)', color: 'var(--gold)', background: 'transparent' }} onClick={() => setShowWithdraw(true)}>💸 Withdraw</button>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#3a6cf4,#00d97e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, cursor: 'pointer' }} title={user?.username}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); }}>Out</button>
        </div>
      </header>

      {/* Nav tabs */}
      <div style={{ display: 'flex', background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 16px', gap: 2, flexShrink: 0 }}>
        {[['trade', 'Trade'], ['signals', 'AI Signals'], ['history', 'History'], ['wallet', 'Wallet'], ['stats', 'My Stats']].map(([k, l]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            style={{ padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `2px solid ${activeTab === k ? 'var(--blue)' : 'transparent'}`, color: activeTab === k ? 'var(--text)' : 'var(--muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all .15s', letterSpacing: '.2px' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Ticker */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '6px 0', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 0, whiteSpace: 'nowrap', animation: 'ticker 40s linear infinite' }}>
          {[...assets, ...assets].map((a, i) => (
            <span key={i} style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '0 20px', display: 'inline-flex', alignItems: 'center', gap: 6, borderRight: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--muted)' }}>{a.name}</span>
              <span>{fmtPrice(a.price)}</span>
              <span style={{ color: a.chg >= 0 ? 'var(--green)' : 'var(--red)' }}>{a.chg >= 0 ? '▲' : '▼'}{Math.abs(a.chg).toFixed(2)}%</span>
            </span>
          ))}
        </div>
      </div>
      <style>{`@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'hidden', display: activeTab === 'trade' ? 'flex' : 'block' }}>

        {/* TRADE TAB */}
        {activeTab === 'trade' && (
          <>
            {/* Sidebar */}
            <div style={{ width: 236, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
                <input placeholder="Search market..." value={searchQ} onChange={e => setSearchQ(e.target.value)} style={{ fontSize: 12 }} />
              </div>
              <div style={{ display: 'flex', gap: 4, padding: '6px 8px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                {cats.map(c => (
                  <button key={c} onClick={() => setCatFilter(c)}
                    style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, cursor: 'pointer', border: '1px solid', borderColor: catFilter === c ? 'var(--blue)' : 'var(--border)', color: catFilter === c ? 'var(--blue)' : 'var(--muted)', background: catFilter === c ? 'var(--blue-dim)' : 'transparent', transition: 'all .12s' }}>
                    {catLabels[c]}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filteredAssets.map(a => {
                  const isSel = sel?.id === a.id;
                  return (
                    <div key={a.id} onClick={() => { setSel(a); setPriceHistory([]); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isSel ? 'var(--blue-dim)' : 'transparent', borderLeft: isSel ? '2px solid var(--blue)' : '2px solid transparent', transition: 'background .12s' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: ASSET_COLORS[a.cat] || '#1a2236', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{a.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{a.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{a.sub}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{fmtPrice(a.price)}</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: a.chg >= 0 ? 'var(--green)' : 'var(--red)' }}>{a.chg >= 0 ? '+' : ''}{a.chg.toFixed(2)}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Center */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
              {/* Chart header */}
              {selectedAsset && (
                <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: ASSET_COLORS[selectedAsset.cat] || '#1a2236', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{selectedAsset.icon}</div>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>{selectedAsset.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{selectedAsset.sub}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {['1m', '5m', '15m', '1h'].map(t => (
                        <button key={t} style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 20, cursor: 'pointer', border: '1px solid var(--border)', color: 'var(--muted)', background: 'transparent' }}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 500, color: selectedAsset.chg >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPrice(selectedAsset.price)}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: selectedAsset.chg >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
                        {selectedAsset.chg >= 0 ? '▲ +' : '▼ '}{Math.abs(selectedAsset.chg).toFixed(2)}% today
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 20, fontSize: 11 }}>
                      {[['High', (selectedAsset.price * 1.005).toFixed(3)], ['Low', (selectedAsset.price * 0.995).toFixed(3)], ['Vol', selectedAsset.vol]].map(([l, v]) => (
                        <div key={l}><div style={{ color: 'var(--muted)' }}>{l}</div><div style={{ fontFamily: 'var(--mono)' }}>{v}</div></div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {/* Chart canvas */}
              <div style={{ flex: 1, padding: '6px 0', overflow: 'hidden' }}>
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
              </div>
              {/* Trade controls */}
              <div style={{ borderTop: '1px solid var(--border2)', background: 'var(--surface)', padding: '12px 16px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', flexShrink: 0 }}>Expiry</span>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {EXPIRY_OPTIONS.map(o => (
                      <button key={o.key} onClick={() => setExpiry(o)}
                        style={{ fontSize: 11, fontWeight: 600, padding: '4px 11px', borderRadius: 20, cursor: 'pointer', border: '1px solid', borderColor: expiry.key === o.key ? 'var(--blue)' : 'var(--border)', color: expiry.key === o.key ? 'var(--blue)' : 'var(--muted)', background: expiry.key === o.key ? 'var(--blue-dim)' : 'transparent', transition: 'all .12s' }}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 12, background: 'var(--gold-dim)', border: '1px solid rgba(245,166,35,.2)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', color: 'var(--gold)' }}>
                    Payout: {payoutRate}%
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', flexShrink: 0 }}>Stake</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface2)', border: '1.5px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>KES</span>
                    <input type="number" value={stake} onChange={e => setStake(Number(e.target.value))} min={50} style={{ border: 'none', background: 'transparent', fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 500, width: 90, padding: 0 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[500, 1000, 2000, 5000].map(v => (
                      <button key={v} onClick={() => setStake(v)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--muted)', transition: 'all .12s' }}>
                        {v >= 1000 ? `${v / 1000}K` : v}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>Est. return</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500, color: 'var(--green)' }}>KES {estReturn.toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <button onClick={() => placeTrade('CALL')} disabled={tradingBusy || !settings?.tradingEnabled}
                    style={{ padding: '13px', border: 'none', borderRadius: 'var(--radius)', background: 'var(--green)', color: '#001f0f', fontWeight: 800, fontSize: 13, cursor: 'pointer', opacity: tradingBusy ? 0.7 : 1, transition: 'filter .15s' }}>
                    ▲ CALL (UP)<br /><span style={{ fontSize: 10, fontWeight: 500, opacity: 0.7 }}>Price will rise</span>
                  </button>
                  <button onClick={() => placeTrade('PUT')} disabled={tradingBusy || !settings?.tradingEnabled}
                    style={{ padding: '13px', border: 'none', borderRadius: 'var(--radius)', background: 'var(--red)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', opacity: tradingBusy ? 0.7 : 1, transition: 'filter .15s' }}>
                    ▼ PUT (DOWN)<br /><span style={{ fontSize: 10, fontWeight: 500, opacity: 0.7 }}>Price will fall</span>
                  </button>
                </div>
                {!settings?.tradingEnabled && <div style={{ marginTop: 8, textAlign: 'center', fontSize: 12, color: 'var(--gold)' }}>⚠️ Trading is currently disabled by admin</div>}
              </div>
            </div>

            {/* Right panel */}
            <div style={{ width: 214, flexShrink: 0, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--muted)', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>Open Positions</div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {positions.length === 0 && <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 11, color: 'var(--muted2)' }}>No open positions</div>}
                {positions.map(p => {
                  const pct = Math.min(((p.elapsedSec || 0) / (p.totalSec || p.expirySec || 300)) * 100, 100);
                  const rem = Math.max(0, (p.totalSec || p.expirySec || 300) - (p.elapsedSec || 0));
                  const col = p.direction === 'CALL' ? 'var(--green)' : 'var(--red)';
                  return (
                    <div key={p.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{p.asset}</div>
                        <span className={`badge ${p.direction === 'CALL' ? 'badge-green' : 'badge-red'}`}>{p.direction}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>KES {p.stake?.toLocaleString()}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: col, marginTop: 3 }}>
                        {rem >= 60 ? `${Math.ceil(rem / 60)}m` : `${rem}s`} remaining
                      </div>
                      <div style={{ height: 2, background: 'var(--surface3)', borderRadius: 2, marginTop: 6 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 2, transition: 'width 1s linear' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Mini stats */}
              <div style={{ borderTop: '1px solid var(--border)', padding: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[
                    ['Win Rate', stats ? `${stats.winRate}%` : '—', stats?.winRate > 50 ? 'var(--green)' : 'var(--text)'],
                    ['Today P/L', stats ? `${stats.todayPL >= 0 ? '+' : ''}${stats.todayPL?.toLocaleString()}` : '—', stats?.todayPL >= 0 ? 'var(--green)' : 'var(--red)'],
                    ['Trades', stats?.tradeCount ?? '—', 'var(--text)'],
                    ['Profit', stats ? fmtKES(stats.totalProfit) : '—', 'var(--green)'],
                  ].map(([l, v, c]) => (
                    <div key={l} style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted)', marginBottom: 3 }}>{l}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500, color: c }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* SIGNALS TAB */}
        {activeTab === 'signals' && (
          <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>AI Prediction Signals</div>
              <button className="btn btn-sm" onClick={loadSignals}>↻ Refresh</button>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {signals.map(s => (
                <div key={s.assetId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1a2236', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{s.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{s.conf}% confidence · RSI: {s.rsi}</div>
                    <div style={{ height: 3, background: 'var(--surface3)', borderRadius: 2 }}>
                      <div style={{ width: `${s.conf}%`, height: '100%', borderRadius: 2, background: s.direction === 'CALL' ? 'var(--green)' : 'var(--red)' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${s.direction === 'CALL' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 11, padding: '4px 12px' }}>{s.direction}</span>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{s.trend}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
              ⚠️ Signals are generated using moving averages, RSI, and momentum analysis. Accuracy is not guaranteed. Always trade responsibly.
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>Trade History</div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table>
                <thead><tr><th>Asset</th><th>Dir</th><th>Stake</th><th>Result</th><th>P/L</th><th>Time</th></tr></thead>
                <tbody>
                  {tradeHistory.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 30 }}>No trades yet</td></tr>}
                  {tradeHistory.map(t => (
                    <tr key={t.id}>
                      <td><div style={{ fontWeight: 700 }}>{t.asset}</div><div style={{ fontSize: 10, color: 'var(--muted)' }}>{t.expiryLabel} expiry</div></td>
                      <td><span className={`badge ${t.direction === 'CALL' ? 'badge-green' : 'badge-red'}`}>{t.direction}</span></td>
                      <td style={{ fontFamily: 'var(--mono)' }}>KES {t.stake?.toLocaleString()}</td>
                      <td><span className={`badge ${t.result === 'WIN' ? 'badge-green' : t.result === 'PENDING' ? 'badge-gold' : 'badge-red'}`}>{t.result}</span></td>
                      <td style={{ fontFamily: 'var(--mono)', color: t.payout >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                        {t.payout != null ? `${t.payout >= 0 ? '+' : ''}${t.payout.toLocaleString()}` : '—'}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--muted)' }}>{t.settledAt ? new Date(t.settledAt).toLocaleString('en-KE') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* WALLET TAB */}
        {activeTab === 'wallet' && (
          <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>Wallet & Transactions</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
              {[
                ['Balance', `KES ${balance.toLocaleString()}`, 'var(--gold)'],
                ['Total Deposited', `KES ${stats?.totalDeposited?.toLocaleString() || 0}`, 'var(--green)'],
                ['Total Withdrawn', `KES ${stats?.totalWithdrawn?.toLocaleString() || 0}`, 'var(--muted)'],
              ].map(([l, v, c]) => (
                <div key={l} className="card-sm" style={{ textAlign: 'center' }}>
                  <div className="label">{l}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 500, color: c }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button className="btn btn-primary" style={{ flex: 1, height: 42 }} onClick={() => setShowDeposit(true)}>📱 Deposit via M-Pesa</button>
              <button className="btn btn-gold" style={{ flex: 1, height: 42 }} onClick={() => setShowWithdraw(true)}>💸 Withdraw to M-Pesa</button>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Transaction History</div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table>
                <thead><tr><th>Type</th><th>Amount</th><th>Status</th><th>Date</th><th>Notes</th></tr></thead>
                <tbody>
                  {transactions.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 30 }}>No transactions yet</td></tr>}
                  {transactions.map(t => (
                    <tr key={t.id}>
                      <td><span className={`badge ${t.type === 'deposit' ? 'badge-green' : t.type === 'withdrawal' ? 'badge-gold' : 'badge-blue'}`}>{t.type.replace('_', ' ')}</span></td>
                      <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>KES {t.amount?.toLocaleString()}</td>
                      <td><span className={`badge ${t.status === 'success' ? 'badge-green' : t.status === 'pending' ? 'badge-gold' : t.status === 'demo' ? 'badge-blue' : 'badge-red'}`}>{t.status}</span></td>
                      <td style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(t.createdAt).toLocaleString('en-KE')}</td>
                      <td style={{ fontSize: 11, color: 'var(--muted)' }}>{t.notes || t.mpesaRef || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === 'stats' && (
          <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>My Performance</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
              {[
                ['Total Profit', `KES ${stats?.totalProfit?.toLocaleString() || 0}`, 'var(--green)'],
                ['Total Loss', `KES ${stats?.totalLoss?.toLocaleString() || 0}`, 'var(--red)'],
                ['Win Rate', `${stats?.winRate || 0}%`, stats?.winRate > 50 ? 'var(--green)' : 'var(--text)'],
                ['Total Trades', stats?.tradeCount || 0, 'var(--text)'],
              ].map(([l, v, c]) => (
                <div key={l} className="card-sm" style={{ textAlign: 'center' }}>
                  <div className="label">{l}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 500, color: c }}>{v}</div>
                </div>
              ))}
            </div>
            <div className="card-sm">
              <div className="label" style={{ marginBottom: 12 }}>Recent Results</div>
              {tradeHistory.slice(0, 10).map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t.asset} · {t.direction}</span>
                  <span className={`badge ${t.result === 'WIN' ? 'badge-green' : 'badge-red'}`}>{t.result}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: t.payout >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {t.payout != null ? `${t.payout >= 0 ? '+' : ''}${t.payout.toLocaleString()}` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showDeposit && <DepositModal balance={balance} onSuccess={onDepositSuccess} onClose={() => setShowDeposit(false)} />}
      {showWithdraw && <WithdrawModal balance={balance} onSuccess={onWithdrawSuccess} onClose={() => setShowWithdraw(false)} />}
    </div>
  );
}
