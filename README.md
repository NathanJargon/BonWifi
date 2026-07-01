# 🌐 BonWifi

**Captive Portal WiFi Payment System** — Connect → Pay → Get Instant Access

Guests can buy WiFi access via QR codes (GCash, PayMaya, GoTyme). Auto-redeems and tracks sessions by MAC address.

---

## ⚡ Features

- 💳 **Multiple Payment Methods** — GCash, PayMaya, GoTyme (QR codes)
- 🎟️ **Instant Vouchers** — Auto-generated & auto-redeemed  
- 🔐 **Session Tracking** — MAC-based access with expiry times
- ✅ **Status Checker** — Guests verify access anytime
- 🚀 **Lightweight** — Runs on your Windows PC / Laptop

---

## 🎨 Screenshots

### Landing Page
Select your plan: ₱50 (30m) | ₱100 (1h) | ₱200 (2h) | ₱300 (3h)
![Landing Page](./docs/landing.png)

### Payment Page  
Choose payment method (GCash/PayMaya/GoTyme) → Scan QR → Instant access
![Payment Page](./docs/payment.png)

### Status Page
Check your WiFi access by MAC address — see remaining time or buy now
![Status Page](./docs/status.png)

### Success Screen
After payment confirmation
![Success](./docs/complete.png)

---

## 🚀 Quick Start

```bash
# Install
npm install

# Run (As Administrator)
npm start

# Visit
http://localhost:3000           # Landing page
http://localhost:3000/pay       # Payment (auto with ?minutes=30)
http://localhost:3000/status    # Check access status
```

---

## 💻 Tech Stack

| Component | Tech |
|-----------|------|
| Frontend | HTML5, CSS3, JavaScript |
| Backend | Node.js + Express |
| Database | SQLite |
| Network | Windows Mobile Hotspot + Windows Firewall |

---

## 📡 How It Works

```
Guest connects to WiFi
        ↓
Captive portal redirects to landing page
        ↓
Guest selects plan + payment method
        ↓
Scans QR code → Auto-confirm payment
        ↓
Voucher redeemed with device MAC
        ↓
WiFi access granted ✓
```

### API Reference

```bash
# Create voucher
POST /api/create-voucher
  body: { minutes, paymentMethod }
  returns: { code, minutes, paymentMethod }

# Redeem voucher for device
POST /api/redeem
  body: { mac, code }
  returns: { mac, expires_at }

# Check session status
GET /api/session/:mac
  returns: { active: bool, expires_at: ISO8601 }
```

---

## 🌐 Deployment on Windows PC

### Requirements

- A Windows 10/11 PC or Laptop
- Node.js (v16 or higher) installed
- An active internet connection (to share via mobile hotspot)

### Setup & Run

1. **Enable Mobile Hotspot**:
   - Go to Windows **Settings ➔ Network & Internet ➔ Mobile Hotspot**.
   - Turn it **ON**. Note down your Hotspot Network name (SSID) and Password.

2. **Open Command Line as Administrator**:
   - Search for `cmd` or `PowerShell` in the Windows Start menu, right-click, and select **Run as Administrator** (this is required for Node.js to manage Windows Firewall rules for clients).

3. **Install & Start**:
   ```bash
   # Navigate to the project directory
   cd c:\Nash\Projects\BonWifi

   # Install dependencies
   npm install

   # Start the server
   npm start
   ```

4. **Verify**:
   - The server will run at `http://192.168.137.1:3000/`.
   - Connect a device (like a phone) to your Windows Mobile Hotspot.
   - The device will be blocked from internet access by default, but can navigate to `http://192.168.137.1:3000` to pay and claim WiFi access!

---

## 🔧 Configuration

### Pricing

Edit `public/index.html` → change plan prices in the HTML or update `getPrice()` in `public/payment.html`

### WiFi SSID & Password

You configure your WiFi network name and password directly in the **Windows Mobile Hotspot settings** (Settings ➔ Network & Internet ➔ Mobile Hotspot ➔ Edit).

### 📋 Recommended Customer Poster Setup

We have built a **WiFi Poster Generator** tool directly into your server! To generate and print your customer poster:

1. Start the BonWifi server on your PC (`npm start`).
2. In your PC browser, go to: `http://localhost:3000/generator`
3. Input your Windows Mobile Hotspot Name (SSID) and Password.
4. Click **Print Poster** to print a beautifully formatted A4 customer sign containing:
   - **QR Code 1: Scan to Connect**: Automatically connects the guest's phone to your Windows Mobile Hotspot when scanned.
   - **QR Code 2: Scan to Open Portal**: Opens their browser directly to the payment page (`http://192.168.137.1:3000`).

### Payment Methods

- 💳 **GCash**: Fully integrated and automated! Set your `GCASH_PHONE_NUMBER` and `SMS_WEBHOOK_SECRET` in your `.env` file, and place your GCash QR code image as `public/gcash-qr.jpg`. Follow the [SMS Forwarder Setup Guide](file:///c:/Nash/Projects/BonWifi/docs/SMS_FORWARDER_SETUP.md) to set up automatic payment verification.
- 🧪 **PayMaya / GoTyme**: Currently running in simulated (demo) mode.

### Session Timeout

Edit `server.js` → `completePayment()` function → change `minutes * 60000`

---

## ⚠️ Production Checklist

- [ ] Replace payment simulator with real processor
- [ ] Add HTTPS (Let's Encrypt)
- [ ] Secure database with backups
- [ ] Add admin panel for refunds/vouchers
- [ ] Implement logging & monitoring
- [ ] Add rate limiting on payment endpoints
- [ ] Whitelist payment IPs (webhooks)
- [ ] Test with real devices
- [ ] Use PostgreSQL instead of SQLite for scale

---

## 📝 Notes

- **Payment**: Currently simulated — real processing requires payment provider integration
- **MAC Address**: Generated randomly in this demo — production gets it from router/device
- **Database**: SQLite is fine for testing; use PostgreSQL/MongoDB for production
- **No Auth**: Add authentication before going live

---

## 📞 Support

For issues:
1. Check logs: `sudo journalctl -u bonwifi -f`
2. Restart services: `sudo systemctl restart bonwifi hostapd dnsmasq`
3. Verify wlan0: `ifconfig wlan0`
4. Check DHCP: `cat /var/lib/dnsmasq/dnsmasq.leases`

---

## 📄 License

MIT — Free to use & modify
