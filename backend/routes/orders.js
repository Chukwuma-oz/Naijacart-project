// Order endpoints (authenticated).
// Prices are looked up server-side and stock is decremented inside a
// transaction — never trust the client for money or inventory.
const express = require('express');
const { getPool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const cache = require('../cache');
const { CATALOGUE_KEY } = require('./products');
const router = express.Router();

// POST /api/orders   { items: [ { product_id, qty } ] }
router.post('/', requireAuth, async (req, res, next) => {
  const items = (req.body && req.body.items) || [];
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required' });
  }
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();

    let total = 0;
    const priced = [];
    for (const it of items) {
      const qty = Number(it.qty) || 0;
      if (qty <= 0) throw Object.assign(new Error('Invalid quantity'), { status: 400 });
      const [rows] = await conn.query(
        'SELECT id, name, price_ngn, stock FROM products WHERE id = ? AND active = 1 FOR UPDATE',
        [it.product_id]
      );
      if (rows.length === 0) throw Object.assign(new Error(`Product ${it.product_id} not found`), { status: 400 });
      const p = rows[0];
      if (p.stock < qty) throw Object.assign(new Error(`Insufficient stock for ${p.name}`), { status: 409 });
      total += Number(p.price_ngn) * qty;
      priced.push({ product_id: p.id, qty, unit_price_ngn: p.price_ngn });
    }

    const [orderResult] = await conn.query(
      'INSERT INTO orders (user_id, total_ngn, status) VALUES (?, ?, ?)',
      [req.user.id, total, 'PLACED']
    );
    const orderId = orderResult.insertId;

    for (const it of priced) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, qty, unit_price_ngn) VALUES (?, ?, ?, ?)',
        [orderId, it.product_id, it.qty, it.unit_price_ngn]
      );
      await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [it.qty, it.product_id]);
    }

    await conn.commit();
    await cache.del(CATALOGUE_KEY); // stock changed -> invalidate the catalogue cache
    res.status(201).json({ order_id: orderId, total_ngn: total, status: 'PLACED' });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

// GET /api/orders — the caller's order history
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [orders] = await getPool().query(
      `SELECT o.id, o.total_ngn, o.status, o.created_at,
              JSON_ARRAYAGG(JSON_OBJECT('product_id', oi.product_id, 'name', p.name,
                                        'qty', oi.qty, 'unit_price_ngn', oi.unit_price_ngn)) AS items
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         JOIN products p ON p.id = oi.product_id
        WHERE o.user_id = ?
        GROUP BY o.id
        ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json(orders);
  } catch (e) { next(e); }
});

module.exports = router;
