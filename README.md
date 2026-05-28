# TradeFlow Pro — Binary Options Trading Platform

A full-stack binary options trading platform built for the Kenyan market, featuring M-Pesa deposits/withdrawals via Lipana, real-time charts, AI signals, and a complete admin dashboard.

---

## 🚀 Deploy to Render (Recommended)

### One-Click Deploy

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Blueprint
3. Connect your GitHub repo
4. Render reads `render.yaml` automatically
5. Set the following environment variables in Render dashboard:
   - `ADMIN_PASSWORD` — your admin password (e.g. `MyAdmin@2024`)
   - `LIPANA_SECRET_KEY` — from [lipana.dev](https://lipana.dev)
   - `FRONTEND_URL` — your Render app URL (e.g. `https://tradeflow-pro.onrender.com`)
6. Click **Deploy**

### Manual Render Deploy

1. New → Web Service → Connect repo
2. **Build Command:**
   ```
   npm install && cd client && npm install && npm run build && cd ../server && npm install
   ```
3. **Start Command:**
   ```
   cd server && node index.js
   ```
4. Add environment variables (see above)
5. Deploy

---

## 💻 Local Development

### Prerequisites
- Node.js 18+
- npm 9+

### Setup

```bash
# Clone / extract the project
cd tradeflow

# Install all dependencies
npm run install-all

# Start both server and client (concurrently)
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

### Environment Variables

Copy `server/.env.example` to `server/.env` and fill in:

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your_long_random_secret_here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@TradeFlow2024
LIPANA_SECRET_KEY=lip_sk_live_your_key_here
FRONTEND_URL=http://localhost:3000
```

---

## 🔑 Default Credentials

| Role  | Email / Username | Password |
|-------|-----------------|----------|
| Admin | admin | Admin@TradeFlow2024 |
| Demo  | demo@tradeflow.pro | Demo@1234 |

> **Change admin password immediately in production!** Set `ADMIN_PASSWORD` in Render environment variables.

---

## 🗺️ URL Routes

| URL | Description |
|-----|-------------|
| `/` | Redirects to `/trade` or `/login` |
| `/login` | Login / Register |
| `/trade` | Main trading platform |
| `/admin` | Admin dashboard (admin only) |

---

## 📱 M-Pesa Integration (Lipana)

1. Sign up at [lipana.dev](https://lipana.dev)
2. Get your secret key (`lip_sk_live_...`)
3. Set `LIPANA_SECRET_KEY` in your environment
4. Without a key, the platform runs in **demo mode** (deposits auto-credit for testing)

---

## ✨ Features

### Trading Platform
- Real-time price simulation for 13 assets (Forex, Crypto, NSE, Commodities)
- Live candlestick-style chart with price labels
- Binary options trading: CALL / PUT
- 5 expiry options: 1m, 5m, 15m, 30m, 1h
- Payout rates configurable per expiry
- AI signal indicators (RSI, trend, confidence)
- Open positions tracker with countdown
- Full trade history
- Win/loss statistics

### Wallet
- M-Pesa STK Push deposits via Lipana API
- M-Pesa withdrawals (pending admin approval)
- Transaction history
- Real-time balance updates

### Admin Dashboard (`/admin`)
- Platform overview: users, deposits, house profit, win rate
- User management: view, edit balance, suspend, KYC, reset password, delete
- Transaction management: approve/reject withdrawals
- Full trades log
- Live platform settings:
  - Enable/disable trading
  - Maintenance mode
  - Min/max stake
  - Payout rates per expiry
  - Deposit/withdrawal limits and fees
  - Announcement banner
  - Welcome bonus

---

## 🔒 Security Notes

- JWT authentication with 7-day tokens
- Bcrypt password hashing
- Helmet.js security headers
- Rate limiting (200 req/15min)
- Admin routes protected server-side
- Never commit `.env` to git

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router 6 |
| Backend | Node.js, Express 4 |
| Auth | JWT + bcryptjs |
| Payments | Lipana M-Pesa API |
| Styling | Pure CSS variables |
| Deploy | Render.com |

---

## ⚠️ Legal Disclaimer

Binary options trading involves significant financial risk. This platform is for entertainment and educational purposes. Ensure compliance with CMA Kenya regulations before operating commercially. Only users 18+ should be permitted to trade.

---

## 📁 Project Structure

```
tradeflow/
├── render.yaml              # Render deploy config
├── package.json             # Root scripts
├── server/
│   ├── index.js             # Express API server
│   ├── package.json
│   ├── .env                 # Local env (don't commit)
│   └── .env.example         # Template
└── client/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── App.js            # Routing
    │   ├── index.js          # Entry point
    │   ├── index.css         # Global styles
    │   ├── context/
    │   │   └── AuthContext.js
    │   ├── utils/
    │   │   └── api.js        # Axios API client
    │   ├── components/
    │   │   ├── Toast.js
    │   │   ├── DepositModal.js
    │   │   └── WithdrawModal.js
    │   └── pages/
    │       ├── AuthPage.js
    │       ├── TradePage.js
    │       └── AdminDashboard.js
    └── package.json
```
