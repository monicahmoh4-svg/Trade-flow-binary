import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 15000,
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('tf_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('tf_token');
      localStorage.removeItem('tf_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

export const authAPI = {
  login: (d) => api.post('/auth/login', d),
  register: (d) => api.post('/auth/register', d),
  me: () => api.get('/auth/me'),
};

export const userAPI = {
  stats: () => api.get('/user/stats'),
  trades: () => api.get('/user/trades'),
  transactions: () => api.get('/user/transactions'),
};

export const tradeAPI = {
  place: (d) => api.post('/trade/place', d),
  result: (id) => api.get(`/trade/${id}/result`),
};

export const marketAPI = {
  assets: () => api.get('/market/assets'),
  signals: () => api.get('/market/signals'),
};

export const paymentAPI = {
  deposit: (d) => api.post('/payments/deposit', d),
  depositStatus: (id) => api.get(`/payments/deposit/${id}/status`),
  withdraw: (d) => api.post('/payments/withdraw', d),
};

export const settingsAPI = {
  public: () => api.get('/settings/public'),
};

export const adminAPI = {
  stats: () => api.get('/admin/stats'),
  users: () => api.get('/admin/users'),
  user: (id) => api.get(`/admin/users/${id}`),
  updateUser: (id, d) => api.patch(`/admin/users/${id}`, d),
  adjustBalance: (id, d) => api.post(`/admin/users/${id}/adjust-balance`, d),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  resetPassword: (id, d) => api.post(`/admin/users/${id}/reset-password`, d),
  transactions: () => api.get('/admin/transactions'),
  updateTransaction: (id, d) => api.patch(`/admin/transactions/${id}`, d),
  trades: () => api.get('/admin/trades'),
  settings: () => api.get('/admin/settings'),
  updateSettings: (d) => api.patch('/admin/settings', d),
};
