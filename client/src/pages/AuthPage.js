import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      let user;
      if (mode === 'login') user = await login(form.email, form.password);
      else user = await register(form);
      toast(mode === 'login' ? 'Welcome back!' : 'Account created!', 'success');
      navigate(user.role === 'admin' ? '/admin' : '/trade');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally { setLoading(false); }
  };

  return (
    <div className="page-center" style={{ padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '8px' }}>
            Trade<span style={{ color: 'var(--green)' }}>Flow</span> <span style={{ color: 'var(--blue)', fontSize: '22px' }}>Pro</span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Smart binary options trading platform</div>
        </div>

        <div className="card">
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                style={{ flex: 1, padding: '10px', background: 'transparent', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', color: mode === m ? 'var(--text)' : 'var(--muted)', borderBottom: mode === m ? '2px solid var(--blue)' : '2px solid transparent', transition: 'all 0.15s' }}>
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={submit}>
            {mode === 'register' && (
              <div className="form-group">
                <label>Username</label>
                <input type="text" placeholder="johndoe" value={form.username} onChange={set('username')} required />
              </div>
            )}
            <div className="form-group">
              <label>{mode === 'login' ? 'Email or Username' : 'Email'}</label>
              <input type={mode === 'login' ? 'text' : 'email'} placeholder={mode === 'login' ? 'email or username' : 'you@example.com'} value={form.email} onChange={set('email')} required />
            </div>
            {mode === 'register' && (
              <div className="form-group">
                <label>Phone (optional)</label>
                <input type="tel" placeholder="0712345678" value={form.phone} onChange={set('phone')} />
              </div>
            )}
            <div className="form-group">
              <label>Password</label>
              <input type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required minLength={6} />
            </div>

            {error && <div className="status-box error"><span className="sb-icon">❌</span><div className="sb-text">{error}</div></div>}

            <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
              {loading ? <><span className="spinner" />&nbsp;{mode === 'login' ? 'Signing in...' : 'Creating account...'}</> : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {mode === 'login' && (
            <div style={{ marginTop: '16px', padding: '12px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)' }}>Demo account:</strong> demo@tradeflow.pro / Demo@1234
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--muted2)' }}>
          By continuing you agree to our Terms of Service and Risk Disclosure.
          <br />Trading involves significant risk. Only trade with money you can afford to lose.
        </div>
      </div>
    </div>
  );
}
