import React, { useState, useEffect, useRef } from 'react';
import { paymentAPI } from '../utils/api';
import { useToast } from './Toast';

const PRESETS = [100, 500, 1000, 2000, 5000];

export default function DepositModal({ balance, onSuccess, onClose }) {
  const toast  = useToast();
  const pollRef = useRef(null);

  const [phone,   setPhone]   = useState(localStorage.getItem('tf_phone') || '');
  const [amount,  setAmount]  = useState('');
  const [loading, setLoading] = useState(false);
  const [phase,   setPhase]   = useState('form'); // form | pending | success | error
  const [msg,     setMsg]     = useState('');
  const [txnId,   setTxnId]   = useState(null);
  const [isDemo,  setIsDemo]  = useState(false);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const submit = async () => {
    if (!phone.trim()) { toast('Enter your M-Pesa phone number', 'error'); return; }
    const amt = parseFloat(amount);
    if (!amt || amt < 1)  { toast('Enter a valid amount', 'error'); return; }

    localStorage.setItem('tf_phone', phone.trim());
    setLoading(true);

    try {
      const r   = await paymentAPI.deposit({ phone: phone.trim(), amount: amt });
      const data = r.data;

      setTxnId(data.transactionId);

      if (data.mode === 'demo') {
        // demo mode — server will auto-credit on first poll
        setIsDemo(true);
        setPhase('pending');
        setMsg('Demo mode — your deposit will be credited automatically in a moment.');
        startPolling(data.transactionId, amt, true);
        return;
      }

      // real STK push sent
      setIsDemo(false);
      setPhase('pending');
      setMsg(data.message || 'STK push sent. Check your phone and enter your M-Pesa PIN.');
      startPolling(data.transactionId, amt, false);

    } catch (err) {
      const detail = err.response?.data?.detail || err.response?.data?.error || err.message || 'Unknown error';
      const code   = err.response?.data?.code   || '';
      setPhase('error');
      setMsg(`${detail}${code ? ` (code: ${code})` : ''}`);
      toast('Deposit failed — see details below', 'error');
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (id, amt, demo) => {
    let attempts = 0;
    // demo: poll after 2s; real: start after 5s (Daraja needs time)
    const delay  = demo ? 2000  : 5000;
    const interval = demo ? 3000 : 4000;
    const maxAttempts = demo ? 5 : 25; // 25 × 4s ≈ 100s

    setTimeout(() => {
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const r = await paymentAPI.depositStatus(id);
          const { status, balance: newBal, mpesaRef, message } = r.data;

          if (status === 'success') {
            clearInterval(pollRef.current);
            setPhase('success');
            setMsg(`KES ${amt.toLocaleString()} credited to your wallet!${mpesaRef ? ` M-Pesa ref: ${mpesaRef}` : ''}`);
            onSuccess(amt);
            return;
          }
          if (status === 'cancelled') {
            clearInterval(pollRef.current);
            setPhase('error');
            setMsg('Payment was cancelled. You can try again.');
            return;
          }
          if (status === 'failed') {
            clearInterval(pollRef.current);
            setPhase('error');
            setMsg(message || 'Payment failed. Please try again.');
            return;
          }
          // still pending — update message so user knows we are checking
          if (attempts % 3 === 0) {
            setMsg(`Waiting for M-Pesa confirmation… (${attempts * (interval / 1000)}s)`);
          }
        } catch (e) {
          // network blip — keep polling
        }
        if (attempts >= maxAttempts) {
          clearInterval(pollRef.current);
          setPhase('error');
          setMsg('Payment timed out. If your money was deducted, contact support with your M-Pesa message.');
        }
      }, interval);
    }, delay);
  };

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPhase('form');
    setMsg('');
    setTxnId(null);
    setIsDemo(false);
    setLoading(false);
  };

  const s = {
    overlay: {
      position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',
      display:'flex',alignItems:'center',justifyContent:'center',
      zIndex:1000,padding:16,backdropFilter:'blur(4px)',
    },
    modal: {
      background:'#0d0d0d',border:'1px solid #222',borderRadius:14,
      width:'100%',maxWidth:400,overflow:'hidden',
      boxShadow:'0 24px 60px rgba(0,0,0,0.7)',
    },
    header: {
      padding:'16px 18px 12px',borderBottom:'1px solid #1a1a1a',
      display:'flex',alignItems:'center',justifyContent:'space-between',
    },
    body:   { padding:18 },
    footer: { padding:'0 18px 18px',display:'flex',gap:8 },
    label:  { display:'block',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'#555',marginBottom:5 },
    input:  { width:'100%',background:'#111',border:'1px solid #2a2a2a',borderRadius:6,padding:'9px 12px',color:'#eee',fontSize:13,outline:'none',marginBottom:0 },
    hint:   { fontSize:11,color:'#555',marginTop:4 },
    btn: (bg,c,extra={}) => ({
      flex:1,height:42,borderRadius:7,border:'none',background:bg,
      color:c,fontWeight:800,fontSize:13,cursor:'pointer',...extra,
    }),
    infoBox: (col) => ({
      background:`rgba(${col},0.08)`,border:`1px solid rgba(${col},0.2)`,
      borderRadius:8,padding:'12px 14px',marginBottom:14,
      display:'flex',gap:10,alignItems:'flex-start',
    }),
  };

  return (
    <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={s.modal}>

        {/* header */}
        <div style={s.header}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:20}}>📱</span>
            <div style={{fontSize:15,fontWeight:800,color:'#eee'}}>
              {isDemo ? 'Deposit (Demo Mode)' : 'Deposit via M-Pesa'}
            </div>
          </div>
          <button onClick={onClose}
            style={{width:28,height:28,borderRadius:'50%',background:'#1a1a1a',border:'1px solid #2a2a2a',
              color:'#666',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>
            ×
          </button>
        </div>

        {/* body */}
        <div style={s.body}>

          {/* FORM */}
          {phase === 'form' && (
            <>
              <div style={s.infoBox('77,158,247')}>
                <span style={{fontSize:16,flexShrink:0}}>ℹ️</span>
                <div style={{fontSize:12,color:'#4d9ef7',lineHeight:1.5}}>
                  <strong style={{display:'block',marginBottom:2}}>How it works</strong>
                  Enter your Safaricom M-Pesa number. You will receive a PIN prompt on your phone — enter your M-Pesa PIN to confirm the payment.
                </div>
              </div>

              <div style={{marginBottom:14}}>
                <label style={s.label}>M-Pesa Phone Number</label>
                <input style={s.input} type="tel" placeholder="e.g. 0712345678"
                  value={phone} onChange={e=>setPhone(e.target.value)}/>
                <div style={s.hint}>Format: 07XXXXXXXX or 01XXXXXXXX</div>
              </div>

              <div style={{marginBottom:6}}>
                <label style={s.label}>Amount (KES)</label>
                <input style={s.input} type="number" placeholder="Enter amount" min={1}
                  value={amount} onChange={e=>setAmount(e.target.value)}/>
              </div>

              {/* quick presets */}
              <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:12,marginTop:8}}>
                {PRESETS.map(v=>(
                  <button key={v} onClick={()=>setAmount(v)}
                    style={{fontSize:11,fontWeight:600,padding:'4px 11px',borderRadius:20,cursor:'pointer',border:'1px solid',
                      borderColor:Number(amount)===v?'#00e055':'#222',
                      color:Number(amount)===v?'#00e055':'#555',
                      background:Number(amount)===v?'rgba(0,224,85,0.1)':'transparent',transition:'all .12s'}}>
                    {v>=1000?`${v/1000}K`:v}
                  </button>
                ))}
              </div>

              {amount && parseFloat(amount) > 0 && (
                <div style={{fontSize:12,color:'#555',marginBottom:2}}>
                  You will receive <strong style={{color:'#00e055'}}>KES {parseFloat(amount).toLocaleString()}</strong> — no deposit fees
                </div>
              )}
            </>
          )}

          {/* PENDING */}
          {phase === 'pending' && (
            <div style={{textAlign:'center',padding:'20px 0'}}>
              <div style={{fontSize:44,marginBottom:14}}>📲</div>
              <div style={{fontWeight:800,fontSize:16,color:'#eee',marginBottom:8}}>
                {isDemo ? 'Processing Demo Deposit…' : 'Waiting for M-Pesa Confirmation'}
              </div>
              <div style={{fontSize:12,color:'#555',lineHeight:1.7,marginBottom:20}}>{msg}</div>
              {/* spinner */}
              <div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
                <div style={{width:28,height:28,border:'3px solid #1a1a1a',borderTopColor:'#00e055',
                  borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
              </div>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              {!isDemo && (
                <div style={{fontSize:11,color:'#333',lineHeight:1.6}}>
                  ✅ Check your phone for the M-Pesa prompt<br/>
                  🔢 Enter your <strong>M-Pesa PIN</strong> to confirm<br/>
                  ⏳ Do not close this window
                </div>
              )}
            </div>
          )}

          {/* SUCCESS */}
          {phase === 'success' && (
            <div style={{textAlign:'center',padding:'16px 0'}}>
              <div style={{fontSize:50,marginBottom:12}}>✅</div>
              <div style={{fontWeight:800,fontSize:16,color:'#00e055',marginBottom:8}}>Payment Successful!</div>
              <div style={{fontSize:13,color:'#888',lineHeight:1.6}}>{msg}</div>
            </div>
          )}

          {/* ERROR */}
          {phase === 'error' && (
            <div style={{padding:'10px 0'}}>
              <div style={{...s.infoBox('255,34,51'),flexDirection:'column',gap:6}}>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <span style={{fontSize:18}}>❌</span>
                  <strong style={{color:'#ff5566',fontSize:14}}>Payment Failed</strong>
                </div>
                <div style={{fontSize:12,color:'#cc4455',lineHeight:1.6,marginTop:4}}>{msg}</div>
              </div>
              <div style={{fontSize:11,color:'#444',lineHeight:1.7,marginTop:8}}>
                <strong style={{color:'#555'}}>Common fixes:</strong><br/>
                • Make sure your M-Pesa is registered and active<br/>
                • Check you have enough M-Pesa balance<br/>
                • Use format 07XXXXXXXX (Safaricom numbers only)<br/>
                • Try again in a few seconds
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div style={s.footer}>
          <button style={s.btn('#1a1a1a','#888',{border:'1px solid #2a2a2a'})} onClick={onClose}>
            {phase==='success'?'Close':'Cancel'}
          </button>
          {phase==='form' && (
            <button style={s.btn(loading?'#1a5a30':'linear-gradient(135deg,#008c3a,#00e055)','#001a00')}
              onClick={submit} disabled={loading}>
              {loading
                ? <span style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}>
                    <span style={{width:14,height:14,border:'2px solid #00804040',borderTopColor:'#008c3a',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
                    Sending…
                  </span>
                : 'Send STK Push'}
            </button>
          )}
          {phase==='error' && (
            <button style={s.btn('linear-gradient(135deg,#008c3a,#00e055)','#001a00')} onClick={reset}>
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
