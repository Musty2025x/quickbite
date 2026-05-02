// services/order-service/server.js
require('dotenv').config();
const express  = require('express');
const { Pool } = require('pg');
const axios    = require('axios');

const app  = express();
const PORT = process.env.PORT || 3003;
app.use(express.json());

const db = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'orders_db',
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id              SERIAL PRIMARY KEY,
      user_id         INT NOT NULL,
      restaurant_id   INT NOT NULL,
      restaurant_name VARCHAR(200),
      status          VARCHAR(50) DEFAULT 'pending',
      total           DECIMAL(10,2) NOT NULL,
      delivery_address TEXT,
      delivery_fee    DECIMAL(10,2) DEFAULT 500,
      payment_method  VARCHAR(50) DEFAULT 'cash',
      notes           TEXT,
      created_at      TIMESTAMP DEFAULT NOW(),
      updated_at      TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id          SERIAL PRIMARY KEY,
      order_id    INT REFERENCES orders(id) ON DELETE CASCADE,
      item_id     INT NOT NULL,
      name        VARCHAR(200) NOT NULL,
      price       DECIMAL(10,2) NOT NULL,
      quantity    INT NOT NULL
    );
  `);
  console.log('✅ Orders tables ready');
}

// ── Routes ────────────────────────────────────────────────────
app.post('/api/orders', async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { restaurant_id, restaurant_name, items, delivery_address, notes, payment_method } = req.body;
    const total = items.reduce((s, i) => s + i.price * i.quantity, 0) + 500;
    const { rows: [order] } = await client.query(
      `INSERT INTO orders (user_id,restaurant_id,restaurant_name,total,delivery_address,notes,payment_method)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.headers['x-user-id'], restaurant_id, restaurant_name, total, delivery_address, notes, payment_method]
    );
    for (const item of items) {
      await client.query(
        'INSERT INTO order_items (order_id,item_id,name,price,quantity) VALUES($1,$2,$3,$4,$5)',
        [order.id, item.id, item.name, item.price, item.quantity]
      );
    }
    await client.query('COMMIT');

    // Notify notification service async (fire and forget)
    axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/send`, {
      user_id: req.headers['x-user-id'],
      type: 'order_placed',
      message: `Order #${order.id} placed successfully! Estimated delivery: 30-45 mins`,
      order_id: order.id
    }).catch(console.error);

    res.status(201).json({ ...order, items });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

app.get('/api/orders', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT o.*, json_agg(json_build_object('name',oi.name,'qty',oi.quantity,'price',oi.price)) AS items
       FROM orders o LEFT JOIN order_items oi ON o.id=oi.order_id
       WHERE o.user_id=$1 GROUP BY o.id ORDER BY o.created_at DESC`,
      [req.headers['x-user-id']]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const { rows: [order] } = await db.query('SELECT * FROM orders WHERE id=$1', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const { rows: items } = await db.query('SELECT * FROM order_items WHERE order_id=$1', [req.params.id]);
    res.json({ ...order, items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending','confirmed','preparing','out_for_delivery','delivered','cancelled'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const { rows: [order] } = await db.query(
      'UPDATE orders SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    // Notify user of status update
    axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/send`, {
      user_id: order.user_id,
      type: 'order_status',
      message: `Order #${order.id} is now: ${status.replace(/_/g,' ')}`,
      order_id: order.id
    }).catch(console.error);
    res.json(order);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'order-service' }));

migrate().then(() => app.listen(PORT, () => console.log(`📦 Order Service on :${PORT}`)));
