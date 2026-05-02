// services/restaurant-service/server.js
require('dotenv').config();
const express  = require('express');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 3002;
app.use(express.json());

const db = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'restaurants_db',
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(200) NOT NULL,
      cuisine     VARCHAR(100),
      address     TEXT,
      rating      DECIMAL(2,1) DEFAULT 0,
      open        BOOLEAN DEFAULT TRUE,
      image_url   VARCHAR(500),
      delivery_time INT DEFAULT 30,
      min_order   DECIMAL(10,2) DEFAULT 0,
      owner_id    INT,
      created_at  TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS menu_items (
      id            SERIAL PRIMARY KEY,
      restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
      name          VARCHAR(200) NOT NULL,
      description   TEXT,
      price         DECIMAL(10,2) NOT NULL,
      category      VARCHAR(100),
      image_url     VARCHAR(500),
      available     BOOLEAN DEFAULT TRUE,
      created_at    TIMESTAMP DEFAULT NOW()
    );
  `);

  // Seed sample data
  const { rows } = await db.query('SELECT COUNT(*) FROM restaurants');
  if (parseInt(rows[0].count) === 0) {
    await db.query(`
      INSERT INTO restaurants (name,cuisine,address,rating,delivery_time,min_order,image_url) VALUES
      ('Mama Lagos Kitchen','Nigerian','Victoria Island, Lagos',4.8,25,2000,'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400'),
      ('Spice Garden','Indian','Lekki Phase 1, Lagos',4.6,35,1500,'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400'),
      ('The Burger Joint','American','Ikeja, Lagos',4.5,20,1000,'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400'),
      ('Suya Palace','Nigerian BBQ','Surulere, Lagos',4.9,30,1500,'https://images.unsplash.com/photo-1544025162-d76694265947?w=400')
    `);
    await db.query(`
      INSERT INTO menu_items (restaurant_id,name,description,price,category) VALUES
      (1,'Jollof Rice & Chicken','Party-style jollof with grilled chicken',3500,'Main'),
      (1,'Egusi Soup + Eba','Traditional egusi with eba',3000,'Main'),
      (1,'Puff Puff','6 pieces of sweet fried dough',800,'Snacks'),
      (2,'Chicken Biryani','Aromatic basmati rice with chicken',4500,'Main'),
      (2,'Butter Chicken','Creamy tomato curry',4000,'Main'),
      (3,'Classic Smash Burger','Double smash patty, cheese, special sauce',3200,'Burgers'),
      (3,'Crispy Chicken Burger','Buttermilk fried chicken',2800,'Burgers'),
      (3,'Loaded Fries','Cheese, bacon, jalapeño',1500,'Sides'),
      (4,'Suya Platter','Mixed meat suya with onions & tomatoes',4000,'Grills'),
      (4,'Asun','Spicy goat meat',3500,'Grills')
    `);
    console.log('🌱 Sample data seeded');
  }
  console.log('✅ Restaurant tables ready');
}

// ── Routes ────────────────────────────────────────────────────
app.get('/api/restaurants', async (req, res) => {
  try {
    const { cuisine, search } = req.query;
    let q = 'SELECT * FROM restaurants WHERE open=true';
    const params = [];
    if (cuisine) { params.push(cuisine); q += ` AND cuisine=$${params.length}`; }
    if (search)  { params.push(`%${search}%`); q += ` AND name ILIKE $${params.length}`; }
    q += ' ORDER BY rating DESC';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/restaurants/:id', async (req, res) => {
  try {
    const { rows: [r] } = await db.query('SELECT * FROM restaurants WHERE id=$1', [req.params.id]);
    if (!r) return res.status(404).json({ error: 'Restaurant not found' });
    const { rows: items } = await db.query(
      'SELECT * FROM menu_items WHERE restaurant_id=$1 AND available=true ORDER BY category,name',
      [req.params.id]
    );
    res.json({ ...r, menu: items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/restaurants/:id/menu', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM menu_items WHERE restaurant_id=$1 AND available=true',
      [req.params.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/restaurants', async (req, res) => {
  try {
    const { name, cuisine, address, image_url, delivery_time, min_order } = req.body;
    const { rows } = await db.query(
      'INSERT INTO restaurants (name,cuisine,address,image_url,delivery_time,min_order,owner_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [name, cuisine, address, image_url, delivery_time, min_order, req.headers['x-user-id']]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/restaurants/:id/menu', async (req, res) => {
  try {
    const { name, description, price, category, image_url } = req.body;
    const { rows } = await db.query(
      'INSERT INTO menu_items (restaurant_id,name,description,price,category,image_url) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.params.id, name, description, price, category, image_url]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'restaurant-service' }));

migrate().then(() => app.listen(PORT, () => console.log(`🍽  Restaurant Service on :${PORT}`)));
