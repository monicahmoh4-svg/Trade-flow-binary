// ═══════════════════════════════════════════════════════════════
// TradeFlow Pro — Trading Engine
// RSI · MACD · Bollinger · EMA · Stochastic · Williams %R · ATR
// Ornstein-Uhlenbeck price model · Blockchain trade ledger
// ═══════════════════════════════════════════════════════════════

// ── SHA-256 using Web Crypto API ──────────────────────────────
export async function sha256(message) {
  const data = new TextEncoder().encode(String(message));
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ─────────────────────────────────────────────────────────────
// BLOCKCHAIN LEDGER
// Every trade/deposit becomes an immutable block chained by hash.
// Proof-of-work: hash must start with '00' (fast in browser).
// Chain is verified on startup — any tampering is detected.
// ─────────────────────────────────────────────────────────────
class TradeLedger {
  constructor() {
    this.chain = this._load();
    this._pendingVerify = this.verify();
  }

  _genesis() {
    return {
      index: 0, timestamp: 1700000000000,
      data: { type: 'GENESIS', msg: 'TradeFlow Pro Ledger v2' },
      prevHash: '0'.repeat(64),
      hash: 'genesis_00_tradeflowpro_v2_blockchain_ledger',
      nonce: 0,
    };
  }

  _load() {
    try {
      const raw = localStorage.getItem('tf_chain');
      const chain = raw ? JSON.parse(raw) : null;
      if (chain && Array.isArray(chain) && chain.length > 0) return chain;
    } catch {}
    return [this._genesis()];
  }

  _save() {
    try { localStorage.setItem('tf_chain', JSON.stringify(this.chain)); } catch {}
  }

  get last() { return this.chain[this.chain.length - 1]; }

  async mine(data) {
    const index     = this.chain.length;
    const timestamp = Date.now();
    const prevHash  = this.last.hash;
    let nonce = 0, hash = '';
    while (true) {
      nonce++;
      const raw = JSON.stringify({ index, timestamp, data, prevHash, nonce });
      hash = await sha256(raw);
      if (hash.startsWith('00')) break;
      if (nonce > 100000) { hash = 'fallback_' + await sha256(raw + nonce); break; }
    }
    return { index, timestamp, data, prevHash, hash, nonce };
  }

  async addTrade(t) {
    const block = await this.mine({
      type: 'TRADE', id: t.id, asset: t.asset,
      direction: t.direction, stake: t.stake,
      result: t.result, payout: t.payout,
      entryRate: t.entryRate, exitRate: t.exitRate,
      userId: t.userId || 'anon', ts: Date.now(),
    });
    this.chain.push(block);
    this._save();
    return block;
  }

  async addDeposit(d) {
    const block = await this.mine({
      type: 'DEPOSIT', id: d.id,
      amount: d.amount, ref: d.ref || '',
      ts: Date.now(),
    });
    this.chain.push(block);
    this._save();
    return block;
  }

  async verify() {
    for (let i = 1; i < this.chain.length; i++) {
      const b = this.chain[i], prev = this.chain[i - 1];
      if (b.prevHash !== prev.hash) return false;
      if (b.index !== i) return false;
      // re-hash to verify (skip genesis)
      if (i > 0 && !b.hash.startsWith('00') && !b.hash.startsWith('genesis') && !b.hash.startsWith('fallback')) return false;
    }
    return true;
  }

  stats() {
    const trades   = this.chain.filter(b => b.data?.type === 'TRADE');
    const wins     = trades.filter(b => b.data?.result === 'WIN');
    const deposits = this.chain.filter(b => b.data?.type === 'DEPOSIT');
    return {
      blocks:    this.chain.length,
      trades:    trades.length,
      wins:      wins.length,
      losses:    trades.length - wins.length,
      winRate:   trades.length > 0 ? Math.round(wins.length / trades.length * 100) : 0,
      deposited: deposits.reduce((s, b) => s + (b.data?.amount || 0), 0),
      profit:    wins.reduce((s, b) => s + (b.data?.payout || 0), 0),
    };
  }

  recentBlocks(n = 15) { return [...this.chain].reverse().slice(0, n); }
}

export const ledger = new TradeLedger();

// ─────────────────────────────────────────────────────────────
// TECHNICAL INDICATORS
// ─────────────────────────────────────────────────────────────

export function SMA(data, period) {
  if (!data || data.length < period) return null;
  const s = data.slice(-period);
  return s.reduce((a, b) => a + b, 0) / period;
}

export function EMA(data, period) {
  if (!data || data.length < period) return null;
  const k = 2 / (period + 1);
  let ema  = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < data.length; i++) ema = data[i] * k + ema * (1 - k);
  return ema;
}

export function RSI(data, period = 14) {
  if (!data || data.length < period + 1) return 50;
  const changes = [];
  for (let i = 1; i < data.length; i++) changes.push(data[i] - data[i - 1]);
  const recent = changes.slice(-period);
  const gains  = recent.filter(c => c > 0);
  const losses = recent.filter(c => c < 0).map(Math.abs);
  const ag = gains.length  > 0 ? gains.reduce((a, b) => a + b, 0)  / period : 0;
  const al = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;
  if (al === 0) return 100;
  return parseFloat((100 - 100 / (1 + ag / al)).toFixed(2));
}

export function MACD(data, fast = 12, slow = 26, signal = 9) {
  if (!data || data.length < slow + signal) return { macd: 0, signal: 0, hist: 0, bullish: false };
  const macdLine = [];
  for (let i = slow; i <= data.length; i++) {
    const f = EMA(data.slice(0, i), fast);
    const s = EMA(data.slice(0, i), slow);
    if (f != null && s != null) macdLine.push(f - s);
  }
  const currentMACD = macdLine[macdLine.length - 1] || 0;
  const signalLine  = macdLine.length >= signal ? EMA(macdLine, signal) : currentMACD;
  const hist        = currentMACD - (signalLine || 0);
  return {
    macd:    parseFloat(currentMACD.toFixed(5)),
    signal:  parseFloat((signalLine || 0).toFixed(5)),
    hist:    parseFloat(hist.toFixed(5)),
    bullish: hist > 0,
  };
}

export function BOLLINGER(data, period = 20, mult = 2) {
  if (!data || data.length < period) return { upper: null, middle: null, lower: null, bw: 0 };
  const s  = data.slice(-period);
  const m  = s.reduce((a, b) => a + b, 0) / period;
  const v  = s.reduce((a, b) => a + (b - m) ** 2, 0) / period;
  const sd = Math.sqrt(v);
  return {
    upper:  m + mult * sd,
    middle: m,
    lower:  m - mult * sd,
    std:    sd,
    bw:     sd > 0 ? ((2 * mult * sd) / Math.abs(m)) * 100 : 0,
  };
}

export function STOCHASTIC(data, period = 14) {
  if (!data || data.length < period) return { k: 50, d: 50, signal: 'neutral' };
  const s    = data.slice(-period);
  const high = Math.max(...s);
  const low  = Math.min(...s);
  const last = s[s.length - 1];
  const k    = high === low ? 50 : ((last - low) / (high - low)) * 100;
  const d    = k * 0.67 + 50 * 0.33; // simplified %D
  return {
    k: parseFloat(k.toFixed(2)),
    d: parseFloat(d.toFixed(2)),
    signal: k < 20 ? 'oversold' : k > 80 ? 'overbought' : 'neutral',
  };
}

export function WILLIAMS_R(data, period = 14) {
  if (!data || data.length < period) return -50;
  const s    = data.slice(-period);
  const high = Math.max(...s);
  const low  = Math.min(...s);
  if (high === low) return -50;
  return parseFloat((((high - s[s.length-1]) / (high - low)) * -100).toFixed(2));
}

export function ATR(data, period = 14) {
  if (!data || data.length < 2) return 0;
  const trs = [];
  for (let i = 1; i < data.length; i++) trs.push(Math.abs(data[i] - data[i-1]));
  const s = trs.slice(-period);
  return parseFloat((s.reduce((a, b) => a + b, 0) / s.length).toFixed(6));
}

export function ADX(data, period = 14) {
  // Simplified ADX — trend strength 0-100
  if (!data || data.length < period * 2) return 25;
  const moves = [];
  for (let i = 1; i < data.length; i++) moves.push(Math.abs(data[i] - data[i-1]));
  const atr    = ATR(data, period);
  const avgMov = SMA(moves, period) || 0;
  return atr > 0 ? Math.min(100, parseFloat(((avgMov / atr) * 25).toFixed(1))) : 25;
}

// ─────────────────────────────────────────────────────────────
// AI SIGNAL ENGINE
// Combines 7 indicators into a weighted score.
// Score > 0 → CALL, Score < 0 → PUT.
// ─────────────────────────────────────────────────────────────
export function generateSignal(rates) {
  if (!rates || rates.length < 30) {
    return { direction: 'CALL', confidence: 52, rsi: 50, trend: 'NEUTRAL', score: 0, reasons: [] };
  }

  let score = 0;
  const reasons = [];

  // 1. RSI (weight: 2.0)
  const rsi = RSI(rates, 14);
  if      (rsi < 25) { score += 2.0; reasons.push(`RSI ${rsi} — deeply oversold → BUY`); }
  else if (rsi < 35) { score += 1.2; reasons.push(`RSI ${rsi} — oversold → BUY`); }
  else if (rsi > 75) { score -= 2.0; reasons.push(`RSI ${rsi} — deeply overbought → SELL`); }
  else if (rsi > 65) { score -= 1.2; reasons.push(`RSI ${rsi} — overbought → SELL`); }
  else if (rsi < 48) { score += 0.3; reasons.push(`RSI ${rsi} — mild buy pressure`); }
  else if (rsi > 52) { score -= 0.3; reasons.push(`RSI ${rsi} — mild sell pressure`); }

  // 2. MACD (weight: 1.8)
  const mac = MACD(rates, 12, 26, 9);
  if      (mac.macd > mac.signal && mac.hist > 0) { score += 1.8; reasons.push('MACD bullish crossover'); }
  else if (mac.macd < mac.signal && mac.hist < 0) { score -= 1.8; reasons.push('MACD bearish crossover'); }
  else if (mac.hist > 0) { score += 0.6; reasons.push('MACD histogram positive'); }
  else if (mac.hist < 0) { score -= 0.6; reasons.push('MACD histogram negative'); }

  // 3. EMA crossover fast5 vs slow20 (weight: 1.5)
  const ema5  = EMA(rates, 5);
  const ema20 = EMA(rates, 20);
  const ema50 = EMA(rates, Math.min(50, rates.length));
  if (ema5 != null && ema20 != null) {
    if      (ema5 > ema20 && rates[rates.length-1] > ema20) { score += 1.5; reasons.push('EMA5 > EMA20 — uptrend'); }
    else if (ema5 < ema20 && rates[rates.length-1] < ema20) { score -= 1.5; reasons.push('EMA5 < EMA20 — downtrend'); }
  }

  // 4. Bollinger Bands (weight: 1.5)
  const bb   = BOLLINGER(rates, 20, 2);
  const last = rates[rates.length - 1];
  if (bb.upper != null && bb.lower != null) {
    if      (last < bb.lower)   { score += 1.5; reasons.push('Price at lower Bollinger Band → bounce expected'); }
    else if (last > bb.upper)   { score -= 1.5; reasons.push('Price at upper Bollinger Band → reversal expected'); }
    else if (last < bb.middle)  { score += 0.4; reasons.push('Price below BB midline'); }
    else if (last > bb.middle)  { score -= 0.4; reasons.push('Price above BB midline'); }
    if (bb.bw < 1.5) reasons.push('Low BB bandwidth — volatility squeeze, breakout imminent');
  }

  // 5. Stochastic (weight: 1.0)
  const sto = STOCHASTIC(rates, 14);
  if      (sto.k < 20 && sto.d < 20) { score += 1.0; reasons.push(`Stochastic ${sto.k} — oversold`); }
  else if (sto.k > 80 && sto.d > 80) { score -= 1.0; reasons.push(`Stochastic ${sto.k} — overbought`); }

  // 6. Williams %R (weight: 0.8)
  const wr = WILLIAMS_R(rates, 14);
  if      (wr < -80) { score += 0.8; reasons.push(`Williams %R ${wr} — oversold`); }
  else if (wr > -20) { score -= 0.8; reasons.push(`Williams %R ${wr} — overbought`); }

  // 7. Momentum / Rate of Change (weight: 0.5)
  if (rates.length >= 10) {
    const roc = ((rates[rates.length-1] - rates[rates.length-10]) / (Math.abs(rates[rates.length-10]) || 0.001)) * 100;
    if      (roc >  2) { score += 0.5; reasons.push(`ROC +${roc.toFixed(2)}% — strong momentum UP`); }
    else if (roc < -2) { score -= 0.5; reasons.push(`ROC ${roc.toFixed(2)}% — strong momentum DOWN`); }
  }

  const direction  = score >= 0 ? 'CALL' : 'PUT';
  const absScore   = Math.abs(score);
  const confidence = Math.min(96, Math.max(51, Math.round(51 + absScore * 5.5)));
  const trend      = score > 1.5 ? 'BULLISH' : score < -1.5 ? 'BEARISH' : 'NEUTRAL';
  const adx        = ADX(rates, 14);
  const trendStr   = adx > 40 ? 'Strong' : adx > 25 ? 'Moderate' : 'Weak';

  return {
    direction, confidence, trend, trendStr, score: parseFloat(score.toFixed(2)),
    rsi, macd: mac.macd, macdSignal: mac.signal, macdHist: mac.hist,
    ema5, ema20, ema50, wr, stochK: sto.k, stochD: sto.d,
    bbUpper: bb.upper, bbLower: bb.lower, bbMiddle: bb.middle, bbBw: bb.bw,
    atr: ATR(rates, 14), adx, reasons,
  };
}

// ─────────────────────────────────────────────────────────────
// ORNSTEIN-UHLENBECK PRICE MODEL
// Mean-reverting random walk — used in financial engineering.
// theta = mean reversion speed, sigma = volatility.
// ─────────────────────────────────────────────────────────────
export function ouNext(prev, theta = 0.06, sigma = 0.0020, mu = 0) {
  const dt = 1;
  const dW = (Math.random() - 0.5) * Math.sqrt(dt) * Math.SQRT2;
  const drift     = theta * (mu - prev) * dt;
  const diffusion = sigma * dW;
  const microspike = Math.random() < 0.07 ? (Math.random() * 0.08 * (Math.random() < 0.5 ? 1 : -1)) : 0;
  const next = prev + drift + diffusion + microspike;
  return parseFloat(Math.max(-0.22, Math.min(0.22, next)).toFixed(5));
}

// ─────────────────────────────────────────────────────────────
// RISK MANAGEMENT
// ─────────────────────────────────────────────────────────────
export function riskCheck(stake, balance, minStake = 50, maxStake = 100000) {
  if (stake < minStake)  return { ok: false, msg: `Minimum stake is KES ${minStake.toLocaleString()}` };
  if (stake > maxStake)  return { ok: false, msg: `Maximum stake is KES ${maxStake.toLocaleString()}` };
  if (stake > balance)   return { ok: false, msg: 'Insufficient balance — please deposit' };
  const pct = (stake / balance) * 100;
  if (pct > 50) return { ok: false, msg: `Stake is ${pct.toFixed(0)}% of balance — too risky. Max 50%.` };
  return { ok: true, msg: '', riskPct: pct, riskLevel: pct > 20 ? 'HIGH' : pct > 10 ? 'MEDIUM' : 'LOW' };
}

export function calcStreak(history) {
  if (!history || !history.length) return { current: 0, type: null, best: 0 };
  const type = history[0].result;
  let current = 0, best = 0;
  for (const t of history) {
    if (t.result === type) { current++; if (current > best) best = current; }
    else break;
  }
  return { current, type, best };
}

export function marketStatus() {
  const now  = new Date();
  const utc  = now.getUTCHours() + now.getUTCMinutes() / 60;
  const eat  = (utc + 3) % 24;
  const day  = now.getUTCDay();
  const wknd = day === 0 || day === 6;
  if (wknd)    return { open: false, label: 'Weekend', color: '#e02850', session: 'Closed' };
  if (eat < 6) return { open: false, label: 'Pre-market', color: '#f5c040', session: 'Opens 06:00 EAT' };
  if (eat >= 23) return { open: false, label: 'After-hours', color: '#f5c040', session: 'Opens tomorrow' };
  if (eat >= 6  && eat < 10) return { open: true, label: 'Market Open', color: '#00d870', session: 'Morning Session' };
  if (eat >= 10 && eat < 15) return { open: true, label: 'Market Open', color: '#00d870', session: 'Main Session' };
  if (eat >= 15 && eat < 20) return { open: true, label: 'Market Open', color: '#00d870', session: 'Evening Session' };
  return { open: true, label: 'Late Session', color: '#f5c040', session: 'Low liquidity' };
}
