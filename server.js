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

app.listen(PORT, () => {
  console.log(`BonWifi server running on http://localhost:${PORT}`);
});
