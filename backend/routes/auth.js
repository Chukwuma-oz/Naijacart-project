// User registration & login. Passwords are hashed with bcrypt.
const express = require('express');
const bcrypt = require('bcryptjs');
const { getPool } = require('../db');
const { signToken } = require('../middleware/auth');
const router = express.Router();

// POST /api/auth/register  { name, email, password }
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password || password.length < 6) {
      return res.status(400).json({ error: 'name, email and a password of 6+ chars are required' });
    }
    const hash = await bcrypt.hash(password, 10);
    try {
      const [result] = await getPool().query(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        [name, email.toLowerCase(), hash]
      );
      const user = { id: result.insertId, email: email.toLowerCase() };
      res.status(201).json({ token: signToken(user), user: { id: user.id, name, email: user.email } });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already registered' });
      throw err;
    }
  } catch (e) { next(e); }
});

// POST /api/auth/login  { email, password }
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const [rows] = await getPool().query(
      'SELECT id, name, email, password_hash FROM users WHERE email = ?',
      [email.toLowerCase()]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) { next(e); }
});

module.exports = router;
