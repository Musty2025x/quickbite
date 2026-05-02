// services/delivery-service/server.js
require('dotenv').config();
const express  = require('express');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 3004;
app.use(express.json());

const db = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'delivery_db',
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS drivers (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(100) NOT NULL,
      phone       VARCHAR(20),
      vehicle     VARCHAR(50),
      plate       VARCHAR(20),
      status      VARCHAR(20) DEFAULT 'available',
      rating      DECIMAL(2,1) DEFAULT 5.0,
      lat         DECIMAL(10,7),
      lng         DECIMAL(10,7),
      created_at  TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS deliveries (
      id              SERIAL PRIMARY KEY,
      order_id        INT UNIQUE NOT NULL,
      driver_id       INT REFERENCES drivers(id),
      status          VARCHAR(50) DEFAULT 'looking_for_driver',
      pickup_address  TEXT,
      dropoff_address TEXT,
      picked_up_at    TIMESTAMP,
      delivered_at    TIMESTAMP,
      estimated_mins  INT DEFAULT 30,
      created_at      TIMESTAMP DEFAULT NOW()
    );
  `);

  const { rows } = await db.query('SELECT COUNT(*) FROM drivers');
  if (parseInt(rows[0].count) === 0) {
    await db.query(`
      INSERT INTO drivers (name,phone,vehicle,plate,status,lat,lng) VALUES
      ('Emeka Okafor','+2348012345678','Motorcycle','LAG-123-NG','available',6.4550,3.3841),
      ('Fatima Aliyu','+2348023456789','Bicycle','ABJ-456-NG','available',6.4580,3.3920),
      ('Chidi Nwosu','+2348034567890','Motorcycle','LAG-789-NG','on_delivery',6.4510,3.3780)
    `);
    console.log('🌱 Sample drivers seeded');
  }
  console.log('✅ Delivery tables ready');
}

app.post('/api/delivery/assign', async (req, res) => {
  try {
    const { order_id, pickup_address, dropoff_address } = req.body;
    // Find available driver
    const { rows: [driver] } = await db.query(
      "SELECT * FROM drivers WHERE status='available' ORDER BY RANDOM() LIMIT 1"
    );
    if (!driver) return res.status(503).json({ error: 'No drivers available' });

    const { rows: [delivery] } = await db.query(
      `INSERT INTO deliveries (order_id,driver_id,pickup_address,dropoff_address,estimated_mins)
       VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [order_id, driver.id, pickup_address, dropoff_address, 25 + Math.floor(Math.random() * 20)]
    );
    await db.query("UPDATE drivers SET status='on_delivery' WHERE id=$1", [driver.id]);
    res.status(201).json({ delivery, driver: { id: driver.id, name: driver.name, phone: driver.phone, vehicle: driver.vehicle, rating: driver.rating } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/delivery/order/:orderId', async (req, res) => {
  try {
    const { rows: [d] } = await db.query(
      `SELECT del.*, drv.name AS driver_name, drv.phone AS driver_phone,
              drv.vehicle, drv.rating AS driver_rating, drv.lat, drv.lng
       FROM deliveries del LEFT JOIN drivers drv ON del.driver_id=drv.id
       WHERE del.order_id=$1`, [req.params.orderId]
    );
    d ? res.json(d) : res.status(404).json({ error: 'Delivery not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/delivery/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const { rows: [d] } = await db.query(
      `UPDATE deliveries SET status=$1,
        picked_up_at=CASE WHEN $1='picked_up' THEN NOW() ELSE picked_up_at END,
        delivered_at=CASE WHEN $1='delivered' THEN NOW() ELSE delivered_at END
       WHERE id=$2 RETURNING *`, [status, req.params.id]
    );
    if (status === 'delivered') {
      await db.query("UPDATE drivers SET status='available' WHERE id=$1", [d.driver_id]);
    }
    res.json(d);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/delivery/drivers', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id,name,vehicle,status,rating,lat,lng FROM drivers');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'delivery-service' }));

migrate().then(() => app.listen(PORT, () => console.log(`🛵 Delivery Service on :${PORT}`)));
