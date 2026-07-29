// Product catalogue endpoints (public), now with cache-aside (Deliverable 5).
// The full catalogue is the hottest read in any shop — perfect cache candidate.
// Look for the X-Cache response header: HIT = served from Redis, MISS = from MySQL.
const express = require('express');
const { getPool } = require('../db');
const cache = require('../cache');
const router = express.Router();

const CATALOGUE_KEY = 'products:all';
const CATALOGUE_TTL = 60; // seconds — short TTL keeps stock counts fresh

// GET /api/products — list all active products (cache-aside)
router.get('/', async (req, res, next) => {
  try {
    const cached = await cache.get(CATALOGUE_KEY);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }
    const [rows] = await getPool().query(
      'SELECT id, name, description, price_ngn, stock, image_url FROM products WHERE active = 1 ORDER BY id'
    );
    await cache.set(CATALOGUE_KEY, rows, CATALOGUE_TTL);
    res.set('X-Cache', 'MISS');
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /api/products/:id — single product (uncached: shows the contrast)
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await getPool().query(
      'SELECT id, name, description, price_ngn, stock, image_url FROM products WHERE id = ? AND active = 1',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = { router, CATALOGUE_KEY };
