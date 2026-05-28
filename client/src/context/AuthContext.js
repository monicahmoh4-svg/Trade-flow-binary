import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../utils/api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tf_user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('tf_token');
    if (token) {
      authAPI.me().then(r => { setUser(r.data); localStorage.setItem('tf_user', JSON.stringify(r.data)); })
        .catch(() => { localStorage.removeItem('tf_token'); localStorage.removeItem('tf_user'); setUser(null); })
        .finally(() => setLoading(false));
    } else setLoading(false);
  }, []);

  const login = async (email, password) => {
    const r = await authAPI.login({ email, password });
    localStorage.setItem('tf_token', r.data.token);
    localStorage.setItem('tf_user', JSON.stringify(r.data.user));
    setUser(r.data.user);
    return r.data.user;
  };

  const register = async (data) => {
    const r = await authAPI.register(data);
    localStorage.setItem('tf_token', r.data.token);
    localStorage.setItem('tf_user', JSON.stringify(r.data.user));
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = () => {
    localStorage.removeItem('tf_token');
    localStorage.removeItem('tf_user');
    setUser(null);
  };

  const refreshUser = async () => {
    const r = await authAPI.me();
    setUser(r.data);
    localStorage.setItem('tf_user', JSON.stringify(r.data));
    return r.data;
  };

  return <AuthCtx.Provider value={{ user, loading, login, register, logout, refreshUser }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
