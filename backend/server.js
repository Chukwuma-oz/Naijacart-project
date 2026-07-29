// NaijaCart API — entry point
// Configuration comes from environment variables (12-factor style) so the same
// code runs locally, on EC2 (via user data), in Docker/ECS, or Elastic Beanstalk.
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initPool } = require('./db');
const cache = require('./cache');

const { router: productsRouter } = require('./routes/products');
const ordersRouter = require('./routes/orders');
const authRouter = require('./routes/auth');

const app = express();

// CORS: in production, set CORS_ORIGIN to your CloudFront domain,
// e.g. https://dxxxxxxxx.cloudfront.net
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// Health check — point your ALB Target Group health check at /health
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'naijacart-api' }));

app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/auth', authRouter);

// central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 8080;
cache.init();
initPool()
  .then(() => {
    app.listen(PORT, () => console.log(`NaijaCart API listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialise database connection:', err.message);
    process.exit(1);
  });
