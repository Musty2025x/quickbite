// services/user-service/server.js
require('dotenv').config();
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

const db = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'users_db',
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// ── Migrations ────────────────────────────────────────────────
async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(100) NOT NULL,
      email       VARCHAR(150) UNIQUE NOT NULL,
      password    VARCHAR(255) NOT NULL,
      phone       VARCHAR(20),
      role        VARCHAR(20) DEFAULT 'customer',
      address     TEXT,
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ Users table ready');
}

// ── Routes ────────────────────────────────────────────────────
app.post('/api/users/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      'INSERT INTO users (name,email,password,phone) VALUES($1,$2,$3,$4) RETURNING id,name,email,role',
      [name, email, hash, phone]
    );
    const token = jwt.sign({ id: rows[0].id, role: rows[0].role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: rows[0] });
  } catch (e) {
    e.code === '23505'
      ? res.status(409).json({ error: 'Email already registered' })
      : res.status(500).json({ error: e.message });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await db.query('SELECT * FROM users WHERE email=$1', [email]);
    if (!rows[0] || !(await bcrypt.compare(password, rows[0].password)))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: rows[0].id, role: rows[0].role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: rows[0].id, name: rows[0].name, email: rows[0].email, role: rows[0].role } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/profile', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id,name,email,phone,role,address,created_at FROM users WHERE id=$1',
      [req.headers['x-user-id']]
    );
    rows[0] ? res.json(rows[0]) : res.status(404).json({ error: 'User not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/profile', async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const { rows } = await db.query(
      'UPDATE users SET name=$1,phone=$2,address=$3 WHERE id=$4 RETURNING id,name,email,phone,address',
      [name, phone, address, req.headers['x-user-id']]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'user-service' }));

migrate().then(() => app.listen(PORT, () => console.log(`👤 User Service on :${PORT}`)));
