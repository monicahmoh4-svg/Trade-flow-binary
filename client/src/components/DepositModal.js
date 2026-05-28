import React, { useState, useEffect } from 'react';
import { paymentAPI } from '../utils/api';
import { useToast } from './Toast';

const PRESETS = [500, 1000, 2000, 5000, 10000];

export default function DepositModal({ balance, onSuccess, onClose }) {
  const toast = useToast();
  const [phone, setPhone] = useState(localStorage.getItem('tf_phone') || '');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('form'); // form | pending | success | error
  const [statusMsg, setStatusMsg] = useState('');
  const [txnId, setTxnId] = useState(null);
  const [pollRef, setPollRef] = useState(null);

  useEffect(() => () => { if (pollRef) clearInterval(pollRef); }, [pollRef]);

  const submit = async () => {
    if (!phone) { toast('Enter your phone number', 'error'); return; }
    const amt = parseFloat(amount);
    if (!amt || amt < 10) { toast('Minimum deposit is KES 10', 'error'); return; }
    localStorage.setItem('tf_phone', phone);
    setLoading(true);
    try {
      const r = await paymentAPI.deposit({ phone, amount: amt });
      const { transactionId, mode } = r.data;
      setTxnId(transactionId);
      if (mode === 'demo') {
        setPhase('pending');
        setStatusMsg('Demo mode — confirming automatically...');
        // Poll immediately
        startPolling(transactionId, amt);
      } else {
        setPhase('pending');
        setStatusMsg(`STK push sent to ${phone}. Enter your M-Pesa PIN to confirm.`);
        startPolling(transactionId, amt);
      }
    } catch (err) {
      setPhase('error');
      setStatusMsg(err.response?.data?.error || err.response?.data?.detail || 'Failed to initiate payment');
    } finally { setLoading(false); }
  };

  const startPolling = (id, amt) => {
    let attempts = 0;
    const iv = setInterval(async () => {
      attempts++;
      try {
        const r = await paymentAPI.depositStatus(id);
        const { status, balance: newBal } = r.data;
        if (status === 'success') {
          clearInterval(iv);
          setPhase('success');
          setStatusMsg(`KES ${amt.toLocaleString()} credited successfully!`);
          onSuccess(amt);
        } else if (status === 'failed' || status === 'rejected') {
          clearInterval(iv);
          setPhase('error');
          setStatusMsg('Payment was cancelled or failed. Please try again.');
        }
      } catch { }
      if (attempts >= 30) clearInterval(iv); // stop after 2 min
    }, 4000);
    setPollRef(iv);
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📱</span>
            <div className="modal-title">Deposit via M-Pesa</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {phase === 'form' && (
            <>
              <div className="status-box info">
                <span className="sb-icon">ℹ️</span>
                <div className="sb-text"><strong>How it works</strong>Enter your M-Pesa number. You'll receive an STK push — enter your PIN to confirm.</div>
              </div>
              <div className="form-group">
                <label>M-Pesa Phone Number</label>
                <input type="tel" placeholder="0712345678" value={phone} onChange={e => setPhone(e.target.value)} />
                <div className="form-hint">Format: 07XXXXXXXX or +2547XXXXXXXX</div>
              </div>
              <div className="form-group">
                <label>Amount (KES)</label>
                <input type="number" placeholder="Enter amount" value={amount} onChange={e => setAmount(e.target.value)} min={10} />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {PRESETS.map(v => (
                    <button key={v} onClick={() => setAmount(v)}
                      style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20, cursor: 'pointer', border: '1px solid', borderColor: Number(amount) === v ? 'var(--blue)' : 'var(--border)', background: Number(amount) === v ? 'var(--blue-dim)' : 'transparent', color: Number(amount) === v ? 'var(--blue)' : 'var(--muted)', transition: 'all .12s' }}>
                      {v >= 1000 ? `${v / 1000}K` : v}
                    </button>
                  ))}
                </div>
                {amount && <div className="form-hint" style={{ marginTop: 8 }}>You will receive <strong>KES {parseFloat(amount || 0).toLocaleString()}</strong> — no deposit fees</div>}
              </div>
            </>
          )}

          {phase === 'pending' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📲</div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Awaiting M-Pesa Confirmation</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 16 }}>{statusMsg}</div>
              <div style={{ display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
            </div>
          )}

          {phase === 'success' && (
            <div className="status-box success">
              <span className="sb-icon">✅</span>
              <div className="sb-text"><strong>Payment Successful!</strong>{statusMsg}</div>
            </div>
          )}

          {phase === 'error' && (
            <div className="status-box error">
              <span className="sb-icon">❌</span>
              <div className="sb-text"><strong>Payment Failed</strong>{statusMsg}</div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost btn-full" onClick={onClose}>{phase === 'success' ? 'Close' : 'Cancel'}</button>
          {phase === 'form' && (
            <button className="btn btn-primary btn-full" onClick={submit} disabled={loading}>
              {loading ? <><span className="spinner" />&nbsp;Sending...</> : 'Send STK Push'}
            </button>
          )}
          {phase === 'error' && (
            <button className="btn btn-primary btn-full" onClick={() => { setPhase('form'); setStatusMsg(''); }}>Try Again</button>
          )}
        </div>
      </div>
    </div>
  );
}
