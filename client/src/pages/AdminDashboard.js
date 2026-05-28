import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useNavigate } from 'react-router-dom';

function StatCard({ label, value, sub, color }) {
  return (
    <div className="card-sm" style={{ textAlign: 'center' }}>
      <div className="label">{label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 500, color: color || 'var(--text)', margin: '4px 0' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</div>}
    </div>
  );
}

function UserDetailModal({ userId, onClose, onUpdated }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adjAmt, setAdjAmt] = useState('');
  const [adjType, setAdjType] = useState('credit');
  const [adjReason, setAdjReason] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminAPI.user(userId).then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, [userId]);

  const adjustBalance = async () => {
    if (!adjAmt || parseFloat(adjAmt) <= 0) { toast('Enter valid amount', 'error'); return; }
    setBusy(true);
    try {
      const r = await adminAPI.adjustBalance(userId, { amount: parseFloat(adjAmt), type: adjType, reason: adjReason });
      setData(d => ({ ...d, user: { ...d.user, balance: r.data.newBalance } }));
      setAdjAmt(''); setAdjReason('');
      toast(`Balance ${adjType}ed by KES ${adjAmt}`, 'success');
      onUpdated();
    } catch (err) { toast(err.response?.data?.error || 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  const toggleStatus = async () => {
    const newStatus = data.user.status === 'active' ? 'suspended' : 'active';
    setBusy(true);
    try {
      await adminAPI.updateUser(userId, { status: newStatus });
      setData(d => ({ ...d, user: { ...d.user, status: newStatus } }));
      toast(`User ${newStatus}`, 'success');
      onUpdated();
    } catch { toast('Failed', 'error'); }
    finally { setBusy(false); }
  };

  const resetPassword = async () => {
    if (!newPwd || newPwd.length < 6) { toast('Password must be 6+ chars', 'error'); return; }
    setBusy(true);
    try {
      await adminAPI.resetPassword(userId, { newPassword: newPwd });
      setNewPwd('');
      toast('Password reset successfully', 'success');
    } catch { toast('Failed', 'error'); }
    finally { setBusy(false); }
  };

  const toggleKYC = async () => {
    setBusy(true);
    try {
      await adminAPI.updateUser(userId, { kycVerified: !data.user.kycVerified });
      setData(d => ({ ...d, user: { ...d.user, kycVerified: !d.user.kycVerified } }));
      toast('KYC status updated', 'success');
      onUpdated();
    } catch { toast('Failed', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div className="modal-title">{loading ? 'Loading...' : `User: ${data?.user?.username}`}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading && <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: 'auto' }} /></div>}
          {data && (
            <>
              {/* User info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  ['Email', data.user.email],
                  ['Phone', data.user.phone || '—'],
                  ['Balance', `KES ${data.user.balance?.toLocaleString()}`],
                  ['Status', data.user.status],
                  ['Joined', new Date(data.user.createdAt).toLocaleDateString()],
                  ['Last Login', data.user.lastLogin ? new Date(data.user.lastLogin).toLocaleString() : '—'],
                  ['Total Deposited', `KES ${data.user.totalDeposited?.toLocaleString()}`],
                  ['Total Withdrawn', `KES ${data.user.totalWithdrawn?.toLocaleString()}`],
                  ['Trades', `${data.user.tradeCount} (${data.user.winCount} wins)`],
                  ['KYC', data.user.kycVerified ? '✅ Verified' : '❌ Not verified'],
                ].map(([l, v]) => (
                  <div key={l} style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
                    <div className="label">{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Balance adjustment */}
              <div style={{ marginBottom: 16, padding: 14, background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Adjust Balance</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  {['credit', 'debit'].map(t => (
                    <button key={t} onClick={() => setAdjType(t)}
                      style={{ flex: 1, padding: '7px', borderRadius: 'var(--radius-sm)', border: '1px solid', borderColor: adjType === t ? (t === 'credit' ? 'var(--green)' : 'var(--red)') : 'var(--border)', background: adjType === t ? (t === 'credit' ? 'var(--green-dim)' : 'var(--red-dim)') : 'transparent', color: adjType === t ? (t === 'credit' ? 'var(--green)' : 'var(--red)') : 'var(--muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      {t === 'credit' ? '+ Credit' : '- Debit'}
                    </button>
                  ))}
                </div>
                <input type="number" placeholder="Amount (KES)" value={adjAmt} onChange={e => setAdjAmt(e.target.value)} style={{ marginBottom: 8 }} />
                <input type="text" placeholder="Reason (optional)" value={adjReason} onChange={e => setAdjReason(e.target.value)} style={{ marginBottom: 8 }} />
                <button className={`btn btn-full ${adjType === 'credit' ? 'btn-green' : 'btn-red'}`} onClick={adjustBalance} disabled={busy}>
                  {busy ? 'Processing...' : `${adjType === 'credit' ? 'Credit' : 'Debit'} KES ${adjAmt || '0'}`}
                </button>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <button className={`btn ${data.user.status === 'active' ? 'btn-red' : 'btn-green'}`} onClick={toggleStatus} disabled={busy} style={{ flex: 1 }}>
                  {data.user.status === 'active' ? '🔒 Suspend User' : '✅ Activate User'}
                </button>
                <button className="btn btn-ghost" onClick={toggleKYC} disabled={busy} style={{ flex: 1 }}>
                  {data.user.kycVerified ? '❌ Revoke KYC' : '✅ Verify KYC'}
                </button>
              </div>

              {/* Reset password */}
              <div style={{ marginBottom: 16, padding: 14, background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Reset Password</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" placeholder="New password (min 6 chars)" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
                  <button className="btn btn-primary" onClick={resetPassword} disabled={busy} style={{ flexShrink: 0 }}>Reset</button>
                </div>
              </div>

              {/* Recent trades */}
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Recent Trades ({data.trades?.length})</div>
              <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16 }}>
                <table>
                  <thead><tr><th>Asset</th><th>Dir</th><th>Stake</th><th>Result</th><th>P/L</th></tr></thead>
                  <tbody>
                    {data.trades?.slice(0, 10).map(t => (
                      <tr key={t.id}>
                        <td>{t.asset}</td>
                        <td><span className={`badge ${t.direction === 'CALL' ? 'badge-green' : 'badge-red'}`}>{t.direction}</span></td>
                        <td style={{ fontFamily: 'var(--mono)' }}>KES {t.stake?.toLocaleString()}</td>
                        <td><span className={`badge ${t.result === 'WIN' ? 'badge-green' : t.result === 'PENDING' ? 'badge-gold' : 'badge-red'}`}>{t.result}</span></td>
                        <td style={{ fontFamily: 'var(--mono)', color: t.payout >= 0 ? 'var(--green)' : 'var(--red)' }}>{t.payout != null ? `${t.payout >= 0 ? '+' : ''}${t.payout}` : '—'}</td>
                      </tr>
                    ))}
                    {!data.trades?.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 16 }}>No trades</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer"><button className="btn btn-ghost btn-full" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userSearch, setUserSearch] = useState('');

  const load = useCallback(async (which) => {
    setLoading(true);
    try {
      if (which === 'overview' || which === 'all') {
        const r = await adminAPI.stats();
        setStats(r.data);
      }
      if (which === 'users' || which === 'all') {
        const r = await adminAPI.users();
        setUsers(r.data);
      }
      if (which === 'transactions' || which === 'all') {
        const r = await adminAPI.transactions();
        setTransactions(r.data);
      }
      if (which === 'trades' || which === 'all') {
        const r = await adminAPI.trades();
        setTrades(r.data);
      }
      if (which === 'settings' || which === 'all') {
        const r = await adminAPI.settings();
        setSettings(r.data);
      }
    } catch (err) {
      toast(err.response?.data?.error || 'Load failed', 'error');
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(tab === 'overview' ? 'overview' : tab); }, [tab]);

  const deleteUser = async (id, username) => {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await adminAPI.deleteUser(id);
      setUsers(u => u.filter(x => x.id !== id));
      toast('User deleted', 'success');
    } catch { toast('Failed to delete', 'error'); }
  };

  const updateTxn = async (id, status) => {
    try {
      await adminAPI.updateTransaction(id, { status });
      setTransactions(t => t.map(x => x.id === id ? { ...x, status } : x));
      toast(`Transaction ${status}`, 'success');
    } catch { toast('Failed', 'error'); }
  };

  const saveSetting = async (key, value) => {
    try {
      const r = await adminAPI.updateSettings({ [key]: value });
      setSettings(r.data);
      toast('Setting saved', 'success');
    } catch { toast('Failed', 'error'); }
  };

  const saveAllSettings = async () => {
    try {
      const r = await adminAPI.updateSettings(settings);
      setSettings(r.data);
      toast('All settings saved', 'success');
    } catch { toast('Failed', 'error'); }
  };

  const filteredUsers = users.filter(u =>
    !userSearch || u.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const TABS = [
    ['overview', '📊 Overview'],
    ['users', '👥 Users'],
    ['transactions', '💳 Transactions'],
    ['trades', '📈 Trades'],
    ['settings', '⚙️ Settings'],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      {/* Admin Header */}
      <header style={{ height: 54, background: '#0d1520', borderBottom: '1px solid rgba(77,158,247,0.2)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>
          Trade<span style={{ color: 'var(--green)' }}>Flow</span> <span style={{ color: 'var(--blue)' }}>Pro</span>
          <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, padding: '2px 8px', borderRadius: 4, background: 'rgba(77,158,247,0.15)', color: 'var(--blue)', textTransform: 'uppercase' }}>ADMIN</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Signed in as <strong style={{ color: 'var(--text)' }}>{user?.username}</strong></span>
          <button className="btn btn-sm" onClick={() => navigate('/trade')}>← Trade View</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login'); }}>Sign Out</button>
        </div>
      </header>

      {/* Admin Tabs */}
      <div style={{ display: 'flex', background: '#0d1520', borderBottom: '1px solid rgba(77,158,247,0.15)', padding: '0 20px', gap: 2, flexShrink: 0 }}>
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: '10px 16px', background: 'transparent', border: 'none', borderBottom: `2px solid ${tab === k ? 'var(--blue)' : 'transparent'}`, color: tab === k ? 'var(--text)' : 'var(--muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all .15s' }}>
            {l}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => load(tab)} disabled={loading}>{loading ? '...' : '↻ Refresh'}</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

        {/* OVERVIEW */}
        {tab === 'overview' && stats && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Platform Overview</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
              <StatCard label="Total Users" value={stats.totalUsers} sub={`${stats.activeUsers} active, ${stats.suspendedUsers} suspended`} color="var(--blue)" />
              <StatCard label="Total Balance" value={`KES ${(stats.totalBalance || 0).toLocaleString()}`} sub="All user wallets" color="var(--gold)" />
              <StatCard label="Total Deposits" value={`KES ${(stats.totalDeposits || 0).toLocaleString()}`} color="var(--green)" />
              <StatCard label="House Profit" value={`KES ${(stats.houseProfit || 0).toLocaleString()}`} sub={`Platform win rate: ${stats.platformWinRate}%`} color={stats.houseProfit >= 0 ? 'var(--green)' : 'var(--red)'} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
              <StatCard label="Total Trades" value={stats.totalTrades} />
              <StatCard label="Win Trades" value={stats.winTrades} color="var(--green)" />
              <StatCard label="Loss Trades" value={stats.lossTrades} color="var(--red)" />
              <StatCard label="Pending Withdrawals" value={`KES ${(stats.pendingWithdrawalsAmount || 0).toLocaleString()}`} sub={`${stats.pendingWithdrawalsCount} requests`} color="var(--gold)" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>Quick Actions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button className="btn btn-full" style={{ justifyContent: 'flex-start', background: 'var(--surface2)' }} onClick={() => setTab('transactions')}>💳 Review Pending Withdrawals ({stats.pendingWithdrawalsCount})</button>
                  <button className="btn btn-full" style={{ justifyContent: 'flex-start', background: 'var(--surface2)' }} onClick={() => setTab('users')}>👥 Manage Users ({stats.totalUsers})</button>
                  <button className="btn btn-full" style={{ justifyContent: 'flex-start', background: 'var(--surface2)' }} onClick={() => setTab('settings')}>⚙️ Platform Settings</button>
                </div>
              </div>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>Financial Summary</div>
                {[
                  ['Total Deposited', `KES ${(stats.totalDeposits || 0).toLocaleString()}`, 'var(--green)'],
                  ['Total Withdrawn', `KES ${(stats.totalWithdrawals || 0).toLocaleString()}`, 'var(--red)'],
                  ['Net Revenue', `KES ${((stats.totalDeposits || 0) - (stats.totalWithdrawals || 0)).toLocaleString()}`, 'var(--gold)'],
                  ['Platform P/L', `KES ${(stats.houseProfit || 0).toLocaleString()}`, stats.houseProfit >= 0 ? 'var(--green)' : 'var(--red)'],
                ].map(([l, v, c]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span style={{ color: 'var(--muted)' }}>{l}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: c }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* USERS */}
        {tab === 'users' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>User Management ({filteredUsers.length})</div>
              <input placeholder="Search by name or email..." value={userSearch} onChange={e => setUserSearch(e.target.value)} style={{ width: 240 }} />
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table>
                <thead><tr><th>User</th><th>Balance</th><th>Trades</th><th>Deposited</th><th>Status</th><th>KYC</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>
                  {filteredUsers.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 30 }}>No users</td></tr>}
                  {filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{u.username}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.email}</div>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--gold)' }}>KES {u.balance?.toLocaleString()}</td>
                      <td style={{ fontFamily: 'var(--mono)' }}>{u.tradeCount} ({u.winCount}W)</td>
                      <td style={{ fontFamily: 'var(--mono)' }}>KES {u.totalDeposited?.toLocaleString()}</td>
                      <td><span className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}`}>{u.status}</span></td>
                      <td><span className={`badge ${u.kycVerified ? 'badge-green' : 'badge-gray'}`}>{u.kycVerified ? 'Verified' : 'Pending'}</span></td>
                      <td style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-sm btn-primary" onClick={() => setSelectedUser(u.id)}>Manage</button>
                          <button className="btn btn-sm btn-ghost" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => deleteUser(u.id, u.username)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* TRANSACTIONS */}
        {tab === 'transactions' && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Transactions ({transactions.length})</div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table>
                <thead><tr><th>User</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th><th>Notes</th><th>Actions</th></tr></thead>
                <tbody>
                  {transactions.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 30 }}>No transactions</td></tr>}
                  {transactions.map(t => {
                    const u = users.find(x => x.id === t.userId);
                    return (
                      <tr key={t.id}>
                        <td style={{ fontSize: 12 }}>{u?.username || t.userId?.slice(0, 8)}</td>
                        <td><span className={`badge ${t.type === 'deposit' ? 'badge-green' : t.type === 'withdrawal' ? 'badge-gold' : 'badge-blue'}`}>{t.type.replace('_', ' ')}</span></td>
                        <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>KES {t.amount?.toLocaleString()}</td>
                        <td><span className={`badge ${t.status === 'success' ? 'badge-green' : t.status === 'pending' ? 'badge-gold' : t.status === 'demo' ? 'badge-blue' : 'badge-red'}`}>{t.status}</span></td>
                        <td style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(t.createdAt).toLocaleString('en-KE')}</td>
                        <td style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.notes || t.phone || '—'}</td>
                        <td>
                          {t.type === 'withdrawal' && t.status === 'pending' && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-sm btn-green" onClick={() => updateTxn(t.id, 'success')}>✓ Approve</button>
                              <button className="btn btn-sm" style={{ borderColor: 'var(--red)', color: 'var(--red)', background: 'transparent' }} onClick={() => updateTxn(t.id, 'rejected')}>✗ Reject</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* TRADES */}
        {tab === 'trades' && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>All Trades ({trades.length})</div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table>
                <thead><tr><th>User</th><th>Asset</th><th>Dir</th><th>Stake</th><th>Expiry</th><th>Result</th><th>P/L</th><th>Time</th></tr></thead>
                <tbody>
                  {trades.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 30 }}>No trades</td></tr>}
                  {trades.map(t => {
                    const u = users.find(x => x.id === t.userId);
                    return (
                      <tr key={t.id}>
                        <td style={{ fontSize: 12 }}>{u?.username || t.userId?.slice(0, 8)}</td>
                        <td style={{ fontWeight: 600 }}>{t.asset}</td>
                        <td><span className={`badge ${t.direction === 'CALL' ? 'badge-green' : 'badge-red'}`}>{t.direction}</span></td>
                        <td style={{ fontFamily: 'var(--mono)' }}>KES {t.stake?.toLocaleString()}</td>
                        <td style={{ fontSize: 11 }}>{t.expiryLabel}</td>
                        <td><span className={`badge ${t.result === 'WIN' ? 'badge-green' : t.result === 'PENDING' ? 'badge-gold' : 'badge-red'}`}>{t.result}</span></td>
                        <td style={{ fontFamily: 'var(--mono)', color: t.payout >= 0 ? 'var(--green)' : 'var(--red)' }}>{t.payout != null ? `${t.payout >= 0 ? '+' : ''}${t.payout?.toLocaleString()}` : '—'}</td>
                        <td style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(t.createdAt).toLocaleString('en-KE')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* SETTINGS */}
        {tab === 'settings' && settings && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Platform Settings</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Trading controls */}
              <div className="card">
                <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>Trading Controls</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    ['tradingEnabled', 'Trading Enabled', 'bool'],
                    ['maintenanceMode', 'Maintenance Mode', 'bool'],
                  ].map(([k, l, type]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{l}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Current: {settings[k] ? 'ON' : 'OFF'}</div>
                      </div>
                      <button
                        className={`btn btn-sm ${settings[k] ? 'btn-green' : 'btn-ghost'}`}
                        onClick={() => saveSetting(k, !settings[k])}>
                        {settings[k] ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  ))}

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Min Stake (KES)</label>
                    <input type="number" value={settings.minStake} onChange={e => setSettings(s => ({ ...s, minStake: Number(e.target.value) }))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Max Stake (KES)</label>
                    <input type="number" value={settings.maxStake} onChange={e => setSettings(s => ({ ...s, maxStake: Number(e.target.value) }))} />
                  </div>
                </div>
              </div>

              {/* Payout rates */}
              <div className="card">
                <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>Payout Rates (%)</div>
                {Object.entries(settings.payoutRates || {}).map(([k, v]) => (
                  <div key={k} className="form-group" style={{ marginBottom: 10 }}>
                    <label>{k} expiry</label>
                    <input type="number" min={1} max={200} value={v}
                      onChange={e => setSettings(s => ({ ...s, payoutRates: { ...s.payoutRates, [k]: Number(e.target.value) } }))} />
                  </div>
                ))}
              </div>

              {/* Payment settings */}
              <div className="card">
                <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>Payment Settings</div>
                {[
                  ['minDeposit', 'Min Deposit (KES)', 'number'],
                  ['minWithdrawal', 'Min Withdrawal (KES)', 'number'],
                  ['withdrawalFeePercent', 'Withdrawal Fee (%)', 'number'],
                  ['withdrawalFeeFlat', 'Withdrawal Flat Fee (KES)', 'number'],
                  ['welcomeBonus', 'Welcome Bonus (KES)', 'number'],
                ].map(([k, l]) => (
                  <div key={k} className="form-group" style={{ marginBottom: 10 }}>
                    <label>{l}</label>
                    <input type="number" value={settings[k]} onChange={e => setSettings(s => ({ ...s, [k]: Number(e.target.value) }))} />
                  </div>
                ))}
              </div>

              {/* Platform info */}
              <div className="card">
                <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>Platform Info</div>
                <div className="form-group">
                  <label>Platform Name</label>
                  <input type="text" value={settings.platformName} onChange={e => setSettings(s => ({ ...s, platformName: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Announcement Banner</label>
                  <input type="text" placeholder="Leave blank to hide" value={settings.announcement} onChange={e => setSettings(s => ({ ...s, announcement: e.target.value }))} />
                  <div className="form-hint">Shows on the trading header for all users</div>
                </div>
                <div className="form-group">
                  <label>Lipana API Key</label>
                  <input type="password" placeholder="lip_sk_live_..." value={settings.lipanaKey || ''} onChange={e => setSettings(s => ({ ...s, lipanaKey: e.target.value }))} />
                  <div className="form-hint">Set in server .env as LIPANA_SECRET_KEY for security</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary btn-lg" onClick={saveAllSettings}>💾 Save All Settings</button>
            </div>
          </>
        )}
      </div>

      {selectedUser && (
        <UserDetailModal
          userId={selectedUser}
          onClose={() => setSelectedUser(null)}
          onUpdated={() => load('users')}
        />
      )}
    </div>
  );
}
