import React, { useState } from 'react';
import { paymentAPI } from '../utils/api';
import { useToast } from './Toast';

const PRESETS = [500, 1000, 2000, 5000];

export default function WithdrawModal({ balance, onSuccess, onClose }) {
  const toast = useToast();
  const [phone, setPhone] = useState(localStorage.getItem('tf_phone') || '');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [ref, setRef] = useState('');

  const fee = amount ? Math.round(parseFloat(amount) * 0.005 + 30) : 0;
  const net = amount ? Math.max(0, parseFloat(amount) - fee) : 0;

  const submit = async () => {
    if (!phone) { toast('Enter your M-Pesa phone number', 'error'); return; }
    const amt = parseFloat(amount);
    if (!amt || amt < 500) { toast('Minimum withdrawal is KES 500', 'error'); return; }
    if (amt > balance) { toast('Insufficient balance', 'error'); return; }
    localStorage.setItem('tf_phone', phone);
    setLoading(true);
    try {
      const r = await paymentAPI.withdraw({ phone, amount: amt });
      setRef(r.data.transactionId);
      setDone(true);
      onSuccess(amt);
    } catch (err) {
      toast(err.response?.data?.error || 'Withdrawal failed', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>💸</span>
            <div className="modal-title">Withdraw to M-Pesa</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {!done ? (
            <>
              <div className="status-box warning">
                <span className="sb-icon">⚠️</span>
                <div className="sb-text">
                  <strong>Withdrawal Policy</strong>
                  Processed within 24 hours. Min KES 500. Fee: 0.5% + KES 30.
                  <br />Available balance: <strong>KES {balance.toLocaleString()}</strong>
                </div>
              </div>
              <div className="form-group">
                <label>M-Pesa Phone Number</label>
                <input type="tel" placeholder="0712345678" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Amount (KES)</label>
                <input type="number" placeholder="Min KES 500" value={amount} onChange={e => setAmount(e.target.value)} min={500} max={balance} />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {PRESETS.filter(v => v <= balance).map(v => (
                    <button key={v} onClick={() => setAmount(v)}
                      style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20, cursor: 'pointer', border: '1px solid', borderColor: Number(amount) === v ? 'var(--gold)' : 'var(--border)', background: Number(amount) === v ? 'var(--gold-dim)' : 'transparent', color: Number(amount) === v ? 'var(--gold)' : 'var(--muted)' }}>
                      {v >= 1000 ? `${v / 1000}K` : v}
                    </button>
                  ))}
                  <button onClick={() => setAmount(Math.max(0, balance - fee))}
                    style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20, cursor: 'pointer', border: '1px solid var(--border)', color: 'var(--muted)', background: 'transparent' }}>
                    Max
                  </button>
                </div>
                {amount && parseFloat(amount) >= 500 && (
                  <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ color: 'var(--muted)' }}>Amount</span><span>KES {parseFloat(amount).toLocaleString()}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ color: 'var(--muted)' }}>Fee</span><span style={{ color: 'var(--red)' }}>-KES {fee}</span></div>
                    <hr className="divider" style={{ margin: '8px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>You receive</span><span style={{ color: 'var(--green)' }}>KES {net.toLocaleString()}</span></div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Withdrawal Submitted!</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                KES {parseFloat(amount).toLocaleString()} will be sent to <strong>{phone}</strong> within 24 hours.
                <br />Ref: <span style={{ fontFamily: 'var(--mono)', color: 'var(--blue)' }}>{ref?.slice(0, 12).toUpperCase()}</span>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost btn-full" onClick={onClose}>{done ? 'Close' : 'Cancel'}</button>
          {!done && (
            <button className="btn btn-gold btn-full" onClick={submit} disabled={loading}>
              {loading ? <><span className="spinner" />&nbsp;Processing...</> : 'Request Withdrawal'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
