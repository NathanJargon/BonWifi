require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { nanoid } = require('nanoid');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use('/public', express.static(path.join(__dirname, 'public')));

// Simple SQLite DB
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'bonwifi.db');
const db = new sqlite3.Database(dbPath);
db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      minutes INTEGER,
      payment_method TEXT,
      gcash_transaction_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mac TEXT,
      voucher_code TEXT,
      expires_at DATETIME
    )`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS gcash_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref_no TEXT UNIQUE,
      amount REAL,
      sms_content TEXT,
      status TEXT DEFAULT 'unclaimed',
      claimed_by TEXT,
      claimed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );
});

// === Windows Hotspot and Firewall Client Monitoring ===
const isWindows = process.platform === 'win32';
const hotspotIp = process.env.HOTSPOT_IP || '192.168.137.1';
const ipPrefix = hotspotIp.substring(0, hotspotIp.lastIndexOf('.') + 1);

const blockedClients = new Set();
const allowedClients = new Set();

function blockClientIp(ip, hsIp) {
  if (!isWindows) return;
  const ruleName = `BonWifi-Block-${ip}`;
  const cmd = `powershell -Command "Remove-NetFirewallRule -DisplayName '${ruleName}' -ErrorAction SilentlyContinue; New-NetFirewallRule -DisplayName '${ruleName}' -Direction Outbound -LocalAddress '${ip}' -RemoteAddress '!${hsIp}' -Action Block"`;
  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error(`Error blocking IP ${ip}:`, err.message);
    } else {
      console.log(`[Firewall] Blocked internet access for client IP: ${ip}`);
    }
  });
}

function unblockClientIp(ip) {
  if (!isWindows) return;
  const ruleName = `BonWifi-Block-${ip}`;
  const cmd = `powershell -Command "Remove-NetFirewallRule -DisplayName '${ruleName}' -ErrorAction SilentlyContinue"`;
  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error(`Error unblocking IP ${ip}:`, err.message);
    } else {
      console.log(`[Firewall] Unblocked internet access for client IP: ${ip}`);
    }
  });
}

function cleanAllFirewallRules() {
  if (!isWindows) return;
  const cmd = `powershell -Command "Remove-NetFirewallRule -DisplayName 'BonWifi-Block-*' -ErrorAction SilentlyContinue"`;
  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error('Error cleaning firewall rules:', err.message);
    } else {
      console.log('[Firewall] Cleaned all temporary BonWifi firewall block rules.');
    }
  });
}

function scanHotspotClients(prefix) {
  return new Promise((resolve) => {
    if (!isWindows) return resolve([]);
    exec('arp -a', (err, stdout, stderr) => {
      if (err) return resolve([]);
      const lines = stdout.split('\n');
      const clients = [];
      for (const line of lines) {
        if (line.includes(prefix)) {
          const tokens = line.trim().split(/\s+/);
          if (tokens.length >= 2) {
            const ip = tokens[0];
            const mac = tokens[1].replace(/-/g, ':').toUpperCase();
            if (ip !== hotspotIp && !ip.endsWith('.255') && !ip.endsWith('.1')) {
              if (mac && mac !== 'FF:FF:FF:FF:FF:FF' && mac !== '00:00:00:00:00:00') {
                clients.push({ ip, mac });
              }
            }
          }
        }
      }
      resolve(clients);
    });
  });
}

// Clean up firewall rules on start
cleanAllFirewallRules();

async function monitorHotspotClients() {
  try {
    const clients = await scanHotspotClients(ipPrefix);
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    db.all(
      `SELECT DISTINCT mac, expires_at FROM sessions WHERE expires_at > ?`,
      [fortyEightHoursAgo],
      (err, rows) => {
        if (err) {
          console.error('[DB Error in monitoring]:', err);
          return;
        }
        
        const activeMacs = new Set();
        if (rows) {
          const now = new Date();
          for (const row of rows) {
            if (new Date(row.expires_at) > now) {
              activeMacs.add(row.mac.toUpperCase());
            }
          }
        }
        
        const currentIps = new Set(clients.map(c => c.ip));
        
        for (const client of clients) {
          const { ip, mac } = client;
          const hasAccess = activeMacs.has(mac);
          
          if (hasAccess) {
            if (blockedClients.has(ip) || !allowedClients.has(ip)) {
              unblockClientIp(ip);
              blockedClients.delete(ip);
              allowedClients.add(ip);
            }
          } else {
            if (!blockedClients.has(ip) || allowedClients.has(ip)) {
              blockClientIp(ip, hotspotIp);
              blockedClients.add(ip);
              allowedClients.delete(ip);
            }
          }
        }
        
        for (const ip of blockedClients) {
          if (!currentIps.has(ip)) {
            blockedClients.delete(ip);
          }
        }
        for (const ip of allowedClients) {
          if (!currentIps.has(ip)) {
            allowedClients.delete(ip);
          }
        }
      }
    );
  } catch (error) {
    console.error('Error in monitorHotspotClients loop:', error);
  }
}

let monitorInterval;
if (isWindows) {
  monitorInterval = setInterval(monitorHotspotClients, 5000);
  console.log(`[Firewall] Monitoring active clients on subnet ${ipPrefix}* every 5 seconds.`);
}

// Graceful shutdown helper
function gracefulShutdown() {
  console.log('\nGracefully shutting down...');
  if (monitorInterval) clearInterval(monitorInterval);
  cleanAllFirewallRules();
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
// === End of Windows Hotspot Client Monitoring ===

// Captive portal landing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Payment page
app.get('/pay', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'payment.html'));
});

// Status check page
app.get('/status', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'status.html'));
});

// Poster generator page
app.get('/generator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'generator.html'));
});

// Create a voucher (simulate payment)
app.post('/api/create-voucher', (req, res) => {
  const minutes = parseInt(req.body.minutes || '30', 10);
  const paymentMethod = req.body.paymentMethod || 'demo';
  const code = nanoid(8).toUpperCase();
  
  db.run(
    'INSERT INTO vouchers (code, minutes, payment_method) VALUES (?, ?, ?)',
    [code, minutes, paymentMethod],
    function (err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      return res.json({ code, minutes, paymentMethod });
    }
  );
});

// Redeem voucher for a device (router would call this)
app.post('/api/redeem', (req, res) => {
  const { mac, code } = req.body;
  if (!mac || !code) return res.status(400).json({ error: 'mac and code required' });
  db.get('SELECT minutes FROM vouchers WHERE code = ?', [code], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'Voucher not found' });
    const minutes = row.minutes;
    const expiresAt = new Date(Date.now() + minutes * 60000).toISOString();
    db.run(
      'INSERT INTO sessions (mac, voucher_code, expires_at) VALUES (?, ?, ?)',
      [mac, code, expiresAt],
      function (err2) {
        if (err2) return res.status(500).json({ error: 'DB error' });
        return res.json({ mac, code, expires_at: expiresAt });
      }
    );
  });
});

// Check session status
app.get('/api/session/:mac', (req, res) => {
  const mac = req.params.mac;
  db.get(
    'SELECT * FROM sessions WHERE mac = ? ORDER BY id DESC LIMIT 1',
    [mac],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (!row) return res.json({ active: false });
      const now = new Date();
      const expires = new Date(row.expires_at);
      return res.json({ active: expires > now, expires_at: row.expires_at });
    }
  );
});

// Get configuration options
app.get('/api/config', (req, res) => {
  return res.json({
    gcashPhoneNumber: process.env.GCASH_PHONE_NUMBER || 'Not Configured'
  });
});

// GCash Payment Endpoints (Production: integrate with real GCash API)

// Initiate GCash payment
app.post('/api/gcash/initiate', (req, res) => {
  const { minutes, mac, amount } = req.body;
  if (!minutes || !mac) return res.status(400).json({ error: 'minutes and mac required' });

  const code = nanoid(8).toUpperCase();
  const gcashTxnId = 'GCASH_' + nanoid(12).toUpperCase();

  db.run(
    'INSERT INTO vouchers (code, minutes, payment_method, gcash_transaction_id) VALUES (?, ?, ?, ?)',
    [code, minutes, 'gcash', gcashTxnId],
    function (err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      
      // Return payment link for GCash
      const paymentUrl = `https://api.gcash.com/pay?txn=${gcashTxnId}&amount=${amount}&reference=${code}`;
      return res.json({
        code,
        gcashTxnId,
        paymentUrl,
        amount,
        minutes
      });
    }
  );
});

// GCash Webhook Callback (production: verify signature & transaction status)
app.post('/api/gcash/webhook', (req, res) => {
  const { transactionId, status, reference, amount } = req.body;

  if (status !== 'COMPLETED') {
    return res.status(400).json({ error: 'Payment not completed' });
  }

  db.get('SELECT code, minutes FROM vouchers WHERE gcash_transaction_id = ?', [transactionId], (err, voucher) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });

    // Log successful payment
    db.run('UPDATE vouchers SET payment_method = ? WHERE code = ?', ['gcash_confirmed', voucher.code]);

    return res.json({ success: true, message: 'Payment confirmed', voucherCode: voucher.code });
  });
});

// Check voucher payment status
app.get('/api/voucher/status/:code', (req, res) => {
  const code = req.params.code;
  db.get('SELECT * FROM vouchers WHERE code = ?', [code], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'Voucher not found' });

    const status = {
      code: row.code,
      minutes: row.minutes,
      paymentMethod: row.payment_method,
      gcashTxnId: row.gcash_transaction_id,
      createdAt: row.created_at,
      paid: row.payment_method.includes('confirmed')
    };

    return res.json(status);
  });
});

// GCash SMS Parser Helper
function parseGcashSms(body) {
  if (!body) return null;
  const text = body.replace(/\s+/g, ' ');
  
  // Match amount: PHP XX.XX or ₱ XX.XX
  const amountMatch = text.match(/(?:PHP|₱)\s*([0-9,]+\.[0-9]{2})/i);
  // Match reference number (10 to 13 digits following Ref or Reference)
  const refMatch = text.match(/(?:Ref|Reference)\b[\s\S]*?\b([0-9]{10,13})\b/i);

  if (amountMatch && refMatch) {
    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    const refNo = refMatch[1];
    return { amount, refNo };
  }
  return null;
}

// SMS Forwarder Webhook
app.post('/api/sms-webhook', (req, res) => {
  console.log('[Webhook] Received SMS forward request:', req.body);
  
  const webhookSecret = process.env.SMS_WEBHOOK_SECRET;
  if (webhookSecret) {
    const receivedSecret = req.headers['x-webhook-secret'] || req.query.secret || req.body.secret;
    if (receivedSecret !== webhookSecret) {
      console.warn('[Webhook] Unauthorized request blocked.');
      return res.status(401).json({ error: 'Unauthorized secret' });
    }
  }
  
  const sender = req.body.from || req.body.sender || req.body.phone || req.body.address;
  const message = req.body.content || req.body.message || req.body.body || req.body.text;
  
  if (!message) {
    return res.status(400).json({ error: 'Message content is empty' });
  }
  
  console.log(`[Webhook] Parsing message from "${sender}": "${message}"`);
  const parsed = parseGcashSms(message);
  if (!parsed) {
    console.log('[Webhook] SMS does not match GCash payment format. Ignored.');
    return res.json({ success: false, message: 'Not a valid GCash payment SMS format' });
  }
  
  const { amount, refNo } = parsed;
  console.log(`[Webhook] Extracted payment - Ref: ${refNo}, Amount: ₱${amount}`);
  
  db.run(
    `INSERT INTO gcash_payments (ref_no, amount, sms_content, status) VALUES (?, ?, ?, 'unclaimed')`,
    [refNo, amount, message],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          console.log(`[Webhook] Reference number ${refNo} already exists in DB. Skipping.`);
          return res.json({ success: true, message: 'Duplicate transaction ignored' });
        }
        console.error('[Webhook] DB error saving payment:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      console.log(`[Webhook] Payment saved as unclaimed.`);
      return res.json({ success: true, refNo, amount });
    }
  );
});

// Claim GCash payment using Reference Number
app.post('/api/gcash/claim-payment', (req, res) => {
  const { refNo, mac, minutes } = req.body;
  
  if (!refNo || !mac || !minutes) {
    return res.status(400).json({ error: 'refNo, mac, and minutes are required' });
  }
  
  const expectedPrice = getPlanPrice(parseInt(minutes, 10));
  console.log(`[Claim] MAC ${mac} claiming Ref: ${refNo} for ${minutes} mins (expects ₱${expectedPrice})`);
  
  db.get(
    `SELECT * FROM gcash_payments WHERE ref_no = ?`,
    [refNo],
    (err, payment) => {
      if (err) {
        console.error('[Claim] DB error looking up payment:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!payment) {
        return res.json({ status: 'pending', message: 'Payment notification not received yet. Still waiting...' });
      }
      
      if (payment.status !== 'unclaimed') {
        return res.status(400).json({ error: 'This payment has already been claimed.' });
      }
      
      if (payment.amount < expectedPrice) {
        return res.status(400).json({ 
          error: `Payment amount of ₱${payment.amount} is insufficient for this plan (requires ₱${expectedPrice}).` 
        });
      }
      
      db.run(
        `UPDATE gcash_payments SET status = 'claimed', claimed_by = ?, claimed_at = datetime('now', 'localtime') WHERE ref_no = ?`,
        [mac, refNo],
        function (updateErr) {
          if (updateErr) {
            console.error('[Claim] DB error updating payment status:', updateErr);
            return res.status(500).json({ error: 'Database error' });
          }
          
          const code = nanoid(8).toUpperCase();
          db.run(
            `INSERT INTO vouchers (code, minutes, payment_method, gcash_transaction_id) VALUES (?, ?, ?, ?)`,
            [code, minutes, 'gcash_confirmed', refNo],
            function (voucherErr) {
              if (voucherErr) {
                console.error('[Claim] DB error creating voucher:', voucherErr);
                return res.status(500).json({ error: 'Database error' });
              }
              
              const expiresAt = new Date(Date.now() + minutes * 60000).toISOString();
              db.run(
                `INSERT INTO sessions (mac, voucher_code, expires_at) VALUES (?, ?, ?)`,
                [mac.toUpperCase(), code, expiresAt],
                function (sessionErr) {
                  if (sessionErr) {
                    console.error('[Claim] DB error creating session:', sessionErr);
                    return res.status(500).json({ error: 'Database error' });
                  }
                  
                  console.log(`[Claim] Success! MAC ${mac} authorized for ${minutes} mins (expires ${expiresAt})`);
                  return res.json({
                    status: 'success',
                    mac,
                    code,
                    expires_at: expiresAt,
                    amount: payment.amount
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

function getPlanPrice(minutes) {
  if (minutes === 30) return 50;
  if (minutes === 60) return 100;
  if (minutes === 120) return 200;
  if (minutes === 180) return 300;
  return 0;
}

app.listen(PORT, () => {
  console.log(`BonWifi server running on http://localhost:${PORT}`);
});
