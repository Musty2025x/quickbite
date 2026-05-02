// services/api-gateway/server.js - v4 (axios proxy)
const express = require('express');
const axios   = require('axios');
const jwt     = require('jsonwebtoken');
const cors    = require('cors');
const morgan  = require('morgan');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(morgan('dev'));
app.use(express.json());

const SERVICES = {
  user:         process.env.USER_SERVICE_URL        || 'http://user-service:3001',
  restaurant:   process.env.RESTAURANT_SERVICE_URL  || 'http://restaurant-service:3002',
  order:        process.env.ORDER_SERVICE_URL        || 'http://order-service:3003',
  delivery:     process.env.DELIVERY_SERVICE_URL     || 'http://delivery-service:3004',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:5001',
};

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    req.headers['x-user-id']   = String(req.user.id);
    req.headers['x-user-role'] = req.user.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Generic forward function
async function forward(target, req, res) {
  const url = `${target}${req.originalUrl}`;
  console.log(`[Gateway] ${req.method} ${req.originalUrl} → ${url}`);
  try {
    const response = await axios({
      method:  req.method,
      url,
      data:    req.body,
      headers: {
        'Content-Type':  'application/json',
        'x-user-id':     req.headers['x-user-id']   || '',
        'x-user-role':   req.headers['x-user-role'] || '',
        'authorization': req.headers['authorization'] || '',
      },
      validateStatus: () => true,
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    console.error('[Gateway] Forward error:', err.message);
    res.status(502).json({ error: 'Service unavailable', detail: err.message });
  }
}

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'api-gateway-v4' }));

// Public routes
app.all('/api/users/register',  (req, res) => forward(SERVICES.user, req, res));
app.all('/api/users/login',     (req, res) => forward(SERVICES.user, req, res));
app.all('/api/restaurants*',    (req, res) => forward(SERVICES.restaurant, req, res));

// Protected routes
app.all('/api/users*',         authenticate, (req, res) => forward(SERVICES.user, req, res));
app.all('/api/orders*',        authenticate, (req, res) => forward(SERVICES.order, req, res));
app.all('/api/delivery*',      authenticate, (req, res) => forward(SERVICES.delivery, req, res));
app.all('/api/notifications*', authenticate, (req, res) => forward(SERVICES.notification, req, res));

app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));

app.listen(PORT, '0.0.0.0', () => console.log(`Gateway v4 on :${PORT}`));
