const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use('/public', express.static(path.join(__dirname, 'public')));

// Simple SQLite DB
const db = new sqlite3.Database(path.join(__dirname, 'bonwifi.db'));
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
});

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

// Create a voucher (simulate payment)
app.post('/api/create-voucher', (req, res) => {
  const minutes = parseInt(req.body.minutes || '30', 10);
  const code = nanoid(8).toUpperCase();
  db.run(
    'INSERT INTO vouchers (code, minutes) VALUES (?, ?)',
    [code, minutes],
    function (err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      return res.json({ code, minutes });
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
        return res.json({ mac, code, expiresAt });
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

app.listen(PORT, () => {
  console.log(`BonWifi server running on http://localhost:${PORT}`);
});
