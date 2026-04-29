# BonWifi - Getting Started Guide

**BonWifi** is a captive portal WiFi payment system with automatic device redemption and GCash support.

## What's New (Raspberry Pi Zero 2 W Ready)

✅ **Automated Pi Zero 2 W setup script** - One-command installation  
✅ **QR code payment** - Clients scan to pay via GCash  
✅ **GCash integration** - Payment API endpoints ready (mock + production support)  
✅ **Git-ready** - `.gitignore` configured for clean commits  
✅ **Production-grade** - Systemd service, comprehensive logging, deployment guide  

---

## Quick Start (Local Testing)

### 1. Install Dependencies
```bash
cd BonWifi
npm install
```

### 2. Start Server
```bash
npm start
```

### 3. Test in Browser
- **Landing page:** http://localhost:3000/
- **Payment page:** http://localhost:3000/pay?minutes=30
- **Status check:** http://localhost:3000/status

### 4. Test Payment Flow
1. Click "Get 30 minutes"
2. See QR code for GCash payment
3. Click "Complete Payment"
4. See success confirmation
5. Check status page with your MAC address

---

## Deploy on Raspberry Pi Zero 2 W

### Hardware Needed
- Raspberry Pi Zero 2 W (~$25)
- microSD card 16GB+ Class 10
- 5V power supply 2.5A+
- USB OTG adapter (optional)

### One-Command Setup
```bash
# On your Pi (after SSH):
git clone https://github.com/yourusername/BonWifi.git
cd BonWifi
chmod +x setup-pi-zero.sh
sudo ./setup-pi-zero.sh
```

**That's it!** Setup completes in 5-10 minutes. Services start automatically on boot.

### Verify Setup
```bash
# WiFi appears as "BonWifi" (password: BonWifi123!)
# Access portal at http://10.0.0.1/

# Check services:
sudo systemctl status bonwifi
sudo systemctl status hostapd
sudo systemctl status dnsmasq
```

---

## Features

| Feature | Status | Details |
|---------|--------|---------|
| **Captive Portal** | ✅ | Auto-redirects guests to payment page |
| **Payment Simulator** | ✅ | Generates unique voucher codes |
| **QR Code** | ✅ | Clients scan to pay (frontend + backend ready) |
| **GCash Integration** | ✅ | API endpoints ready; connect to production account |
| **Auto Redemption** | ✅ | Instant WiFi access after payment |
| **Session Management** | ✅ | Tracks active sessions with expiration |
| **Status Checker** | ✅ | Real-time connection status per device |
| **SQLite Database** | ✅ | Stores vouchers and sessions |

---

## File Structure

```
BonWifi/
├── server.js                 # Express backend (vouchers + sessions + GCash API)
├── package.json              # Dependencies (now includes qrcode)
├── public/
│   ├── index.html           # Landing page with 3 plans
│   ├── payment.html         # Payment with GCash + QR code
│   └── status.html          # Connection status checker
├── bonwifi.service          # Systemd service file
├── setup-pi-zero.sh         # Automated Pi Zero 2 W installer
├── .gitignore              # Ignores node_modules, .db, .env
├── .env.example            # Template for environment variables
├── README.md               # Full documentation
├── DEPLOYMENT.md           # Step-by-step Pi deployment
└── GETTING_STARTED.md      # This file

```

---

## API Endpoints

### Core
- `POST /api/create-voucher` - Generate voucher (minutes)
- `POST /api/redeem` - Redeem voucher (mac + code)
- `GET /api/session/:mac` - Check active session

### GCash Payment
- `POST /api/gcash/initiate` - Start GCash payment flow
- `POST /api/gcash/webhook` - Payment confirmation callback
- `GET /api/voucher/status/:code` - Check voucher payment status

---

## Pricing Plans

| Plan | Duration | Price | Target |
|------|----------|-------|--------|
| Free Trial | 30 minutes | Free | Test users |
| Fast Browsing | 2 hours | ₱120 | Students/workers |
| All-day Access | 24 hours | ₱300 | Road trippers |

*Prices in Philippine Pesos (PHP). Update in [`public/index.html`](public/index.html) as needed.*

---

## GCash Integration (Production)

### Step 1: Get Merchant Credentials
Sign up at [GCash Developer Portal](https://developer.gcash.app)
- Merchant ID
- API Key
- Webhook Secret

### Step 2: Update Configuration
On your Pi, edit `.env`:
```bash
sudo nano /opt/BonWifi/.env
```

Add:
```
GCASH_MERCHANT_ID=your_merchant_id
GCASH_API_KEY=your_api_key
GCASH_WEBHOOK_SECRET=your_webhook_secret
```

### Step 3: Restart Service
```bash
sudo systemctl restart bonwifi
```

### Step 4: Test Payment
1. Visit http://10.0.0.1/
2. Select plan → Complete payment
3. GCash webhook confirms → Access granted

---

## Troubleshooting

### Server won't start
```bash
# Check for port conflicts
lsof -i :3000

# Check node/npm
node --version
npm --version
```

### WiFi network doesn't appear (on Pi)
```bash
sudo systemctl restart hostapd
sudo systemctl status hostapd  # Look for errors
```

### Guests can't connect to internet
```bash
# Check IP forwarding
sysctl net.ipv4.ip_forward  # Should be 1

# Restart NAT
sudo systemctl restart networking
```

### Database errors
```bash
# Check database permissions
ls -la /opt/BonWifi/bonwifi.db

# Reset database
rm /opt/BonWifi/bonwifi.db
sudo systemctl restart bonwifi
```

---

## Next Steps

1. **Test locally** - Run `npm start` and verify payment flow works
2. **Order Pi Zero 2 W** - Budget ~$25–50 with shipping
3. **Flash & Deploy** - Run `setup-pi-zero.sh` on Pi
4. **Connect GCash** - Add real merchant credentials
5. **Monitor** - Check logs: `sudo journalctl -u bonwifi -f`

---

## Support & Documentation

- **Full README:** [README.md](README.md)
- **Deployment Guide:** [DEPLOYMENT.md](DEPLOYMENT.md)
- **GCash Docs:** [developer.gcash.app](https://developer.gcash.app)
- **Raspberry Pi Docs:** [raspberrypi.com](https://raspberrypi.com)

---

**Happy WiFi selling! 🌐💳**
