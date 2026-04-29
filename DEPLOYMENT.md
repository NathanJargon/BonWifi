# BonWifi Pi Zero 2 W Deployment Checklist

Complete this checklist to get BonWifi running on your Raspberry Pi Zero 2 W.

## Pre-Deployment

- [ ] **Raspberry Pi Zero 2 W** purchased
- [ ] **microSD card** (16GB+ Class 10) available
- [ ] **5V power supply** (2.5A+) ready
- [ ] **Raspberry Pi Imager** downloaded on your computer
- [ ] **Internet connection** available (for Pi setup)
- [ ] **SSH access** to Pi configured (keyboard + monitor, or headless setup)

## Flash & Boot

- [ ] Download [Raspberry Pi OS Lite](https://www.raspberrypi.com/software/)
- [ ] Flash to microSD using Raspberry Pi Imager
- [ ] Insert microSD into Pi Zero 2 W
- [ ] Connect 5V power supply
- [ ] Wait 2-3 minutes for first boot
- [ ] Enable SSH: `sudo raspi-config` → Interfacing → SSH → Enable
- [ ] Note Pi's IP address (check router or use `ping raspberrypi.local`)

## Install & Setup

- [ ] SSH into Pi: `ssh pi@<pi-ip-or-raspberrypi.local>`
- [ ] Clone BonWifi repo:
  ```bash
  git clone https://github.com/yourusername/BonWifi.git
  cd BonWifi
  ```
- [ ] Run automated setup:
  ```bash
  chmod +x setup-pi-zero.sh
  sudo ./setup-pi-zero.sh
  ```
- [ ] Wait for setup to complete (5-10 minutes)
- [ ] Pi will reboot automatically

## Verify Setup

- [ ] WiFi network **BonWifi** appears on your device
- [ ] Connect with password: **BonWifi123!**
- [ ] Browser opens automatically to captive portal, or visit `http://10.0.0.1/`
- [ ] See landing page with WiFi plans
- [ ] Test payment flow:
  - [ ] Click "Get 30 minutes"
  - [ ] See QR code for GCash
  - [ ] Complete payment → See success message
- [ ] Check status page: `http://10.0.0.1/status`

## Services Running

Verify all services are healthy:

```bash
sudo systemctl status bonwifi        # BonWifi app
sudo systemctl status hostapd        # WiFi broadcaster
sudo systemctl status dnsmasq        # DHCP + Captive portal
```

All should show `Active: active (running)` in green.

## GCash Integration (Next Step)

When ready to accept real payments:

1. Register at [GCash Developer Portal](https://developer.gcash.app)
2. Get your API credentials:
   - Merchant ID
   - API Key
   - Webhook Secret
3. On Pi, edit `.env`:
   ```bash
   sudo nano /opt/BonWifi/.env
   ```
4. Add your GCash credentials:
   ```
   GCASH_MERCHANT_ID=your_merchant_id
   GCASH_API_KEY=your_api_key
   GCASH_WEBHOOK_SECRET=your_webhook_secret
   ```
5. Restart BonWifi:
   ```bash
   sudo systemctl restart bonwifi
   ```

## Troubleshooting

### WiFi network doesn't appear
```bash
sudo systemctl restart hostapd
sudo systemctl status hostapd  # Check for errors
```

### Guests connect but no internet
```bash
# Verify IP forwarding
sysctl net.ipv4.ip_forward  # Should return 1

# Check NAT rules
sudo iptables -t nat -L -n
```

### Captive portal doesn't redirect
```bash
# Restart dnsmasq
sudo systemctl restart dnsmasq
sudo systemctl status dnsmasq
```

### BonWifi app not working
```bash
# Check logs
sudo journalctl -u bonwifi -f

# Restart
sudo systemctl restart bonwifi
```

## Monitoring

### Check active sessions
```bash
curl http://10.0.0.1/api/session/XX:XX:XX:XX:XX:XX
```

### View connected devices
```bash
cat /var/lib/dnsmasq/dnsmasq.leases
```

### Monitor system resources
```bash
top  # See CPU/memory usage
df -h  # Disk space
vcgencmd measure_temp  # CPU temperature
```

## Production Hardening

Before deploying publicly:

- [ ] Change WiFi password in `/etc/hostapd/hostapd.conf`
- [ ] Change default credentials in any admin interfaces
- [ ] Enable firewall rules to restrict admin access
- [ ] Set up log rotation (journald can fill up microSD)
- [ ] Monitor disk space weekly
- [ ] Back up database regularly: `cp /opt/BonWifi/bonwifi.db /backup/`
- [ ] Set up monitoring/alerts for service crashes
- [ ] Use HTTPS for payment (add reverse proxy like nginx)

## Performance Expectations

**Raspberry Pi Zero 2 W with BonWifi:**
- Concurrent users: 1–10 (light browsing)
- Bandwidth: Suitable for social media/email, not video streaming
- Uptime: Limited only by power (use UPS for 24/7 operation)
- Operating cost: ~5W idle, minimal electricity (~$1-2/month)

**If you need to scale:**
- 10–50 users → Upgrade to **Raspberry Pi 4 (8GB)**
- 50+ users → Use **MikroTik RB750Gr3** or **UniFi Dream Machine**

## Support

For issues or questions:
1. Check logs: `sudo journalctl -u bonwifi`
2. Verify services: `sudo systemctl status bonwifi hostapd dnsmasq`
3. Test payment flow on http://10.0.0.1/
4. Review README.md deployment section
