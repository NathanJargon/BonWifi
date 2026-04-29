#!/bin/bash

# BonWifi Raspberry Pi Zero 2 W Setup Script
# This script installs and configures BonWifi with hostapd and dnsmasq for auto WiFi hotspot

set -e

echo "🚀 BonWifi Pi Zero 2 W Setup"
echo "=============================="

# Update system
echo "📦 Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install required packages
echo "📥 Installing required packages..."
sudo apt install -y \
  hostapd \
  dnsmasq \
  iptables-persistent \
  sqlite3 \
  git \
  build-essential \
  python3-dev \
  wireless-tools \
  curl

# Install Node.js
echo "📥 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Disable systemd-networkd management of wlan0
echo "⚙️  Configuring network..."
sudo tee /etc/systemd/network/99-disable-wlan0.link > /dev/null << EOF
[Match]
Name=wlan0

[Link]
Unmanaged=yes
EOF

# Configure static IP for wlan0
sudo tee /etc/network/interfaces.d/wlan0 > /dev/null << EOF
auto wlan0
iface wlan0 inet static
  address 10.0.0.1
  netmask 255.255.255.0
  up iptables-restore < /etc/iptables/rules.v4
EOF

# Set up dnsmasq
echo "⚙️  Configuring dnsmasq..."
sudo cp /etc/dnsmasq.conf /etc/dnsmasq.conf.bak
sudo tee /etc/dnsmasq.conf > /dev/null << EOF
# DNS & DHCP for BonWifi captive portal
interface=wlan0
dhcp-range=10.0.0.2,10.0.0.50,12h
dhcp-option=option:router,10.0.0.1
dhcp-option=option:dns-server,10.0.0.1
no-resolv
server=8.8.8.8
server=8.8.4.4

# Captive portal: redirect all DNS to self
address=/#/10.0.0.1
EOF

# Set up hostapd
echo "⚙️  Configuring hostapd..."
sudo tee /etc/hostapd/hostapd.conf > /dev/null << EOF
# BonWifi Hotspot Configuration
interface=wlan0
driver=nl80211
ssid=BonWifi
hw_mode=g
channel=7
wmm_enabled=1
macaddr_acl=0
auth_algs=1
wpa=2
wpa_passphrase=BonWifi123!
wpa_key_mgmt=WPA-PSK
wpa_pairwise=CCMP
EOF

# Update hostapd defaults
sudo sed -i 's|#DAEMON_CONF=""|DAEMON_CONF="/etc/hostapd/hostapd.conf"|' /etc/default/hostapd

# Set up IP forwarding and NAT
echo "⚙️  Configuring NAT and IP forwarding..."
sudo sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf

# Detect upstream interface (eth0 or similar)
UPSTREAM=$(ip route | grep default | awk '{print $5}' | head -1)
if [ -z "$UPSTREAM" ]; then
  UPSTREAM="eth0"
fi

# Set up iptables rules
sudo iptables -t nat -A POSTROUTING -o $UPSTREAM -j MASQUERADE
sudo iptables -A FORWARD -i wlan0 -o $UPSTREAM -j ACCEPT
sudo iptables -A FORWARD -i $UPSTREAM -o wlan0 -m state --state RELATED,ESTABLISHED -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4

# Clone and install BonWifi
echo "📥 Installing BonWifi..."
cd /opt || cd ~
if [ ! -d "BonWifi" ]; then
  sudo git clone https://github.com/yourusername/BonWifi.git
fi
cd BonWifi
sudo npm install

# Create systemd service for BonWifi
echo "⚙️  Creating systemd service..."
sudo tee /etc/systemd/system/bonwifi.service > /dev/null << EOF
[Unit]
Description=BonWifi Captive Portal
After=network.target hostapd.service dnsmasq.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/BonWifi
ExecStart=/usr/bin/node /opt/BonWifi/server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable services
echo "✅ Enabling services..."
sudo systemctl daemon-reload
sudo systemctl enable hostapd
sudo systemctl enable dnsmasq
sudo systemctl enable bonwifi

# Start services
echo "🔄 Starting services..."
sudo systemctl restart networking
sudo systemctl start hostapd
sudo systemctl start dnsmasq
sudo systemctl start bonwifi

echo ""
echo "✅ BonWifi setup complete!"
echo ""
echo "🌐 Your WiFi hotspot is now active:"
echo "   SSID: BonWifi"
echo "   Password: BonWifi123!"
echo ""
echo "🌍 Access the portal at: http://10.0.0.1/"
echo "   or from your device at: http://bonwifi.local/"
echo ""
echo "📊 Check service status:"
echo "   sudo systemctl status bonwifi"
echo "   sudo systemctl status hostapd"
echo "   sudo systemctl status dnsmasq"
echo ""
