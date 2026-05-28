import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import AuthPage from './pages/AuthPage';
import TradePage from './pages/TradePage';
import AdminDashboard from './pages/AdminDashboard';

function PrivateRoute({ children, adminOnly }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="page-center">
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 12px', width: 28, height: 28 }} />
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading TradeFlow Pro...</div>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/trade" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/trade'} replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<PublicRoute><AuthPage /></PublicRoute>} />
            <Route path="/trade" element={<PrivateRoute><TradePage /></PrivateRoute>} />
            <Route path="/admin" element={<PrivateRoute adminOnly><AdminDashboard /></PrivateRoute>} />
            <Route path="/" element={<Navigate to="/trade" replace />} />
            <Route path="*" element={<Navigate to="/trade" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
