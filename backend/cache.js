// Cache-aside helper (Deliverable 5 requirement: "uses caching").
// Two modes:
//   AWS mode   — set REDIS_URL (redis://<elasticache-endpoint>:6379) and this
//                uses ElastiCache Redis (Session 21 pattern).
//   Local mode — no REDIS_URL: a simple in-memory Map with TTL, so local dev
//                needs no Redis installed. Same interface either way.
// All operations fail OPEN: if the cache is down, the app still serves from
// the database (a cache must never become a point of failure).
let redis = null;
const mem = new Map();

function init() {
  if (process.env.REDIS_URL) {
    const Redis = require('ioredis');
    redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
    redis.on('error', (e) => console.error('Redis error (serving from DB):', e.message));
    console.log('Cache: ElastiCache Redis at', process.env.REDIS_URL);
  } else {
    console.log('Cache: in-memory fallback (set REDIS_URL for ElastiCache Redis)');
  }
}

async function get(key) {
  try {
    if (redis) {
      const v = await redis.get(key);
      return v ? JSON.parse(v) : null;
    }
    const e = mem.get(key);
    if (!e) return null;
    if (Date.now() > e.exp) { mem.delete(key); return null; }
    return e.val;
  } catch { return null; }              // fail open
}

async function set(key, val, ttlSeconds = 60) {
  try {
    if (redis) return await redis.set(key, JSON.stringify(val), 'EX', ttlSeconds);
    mem.set(key, { val, exp: Date.now() + ttlSeconds * 1000 });
  } catch { /* fail open */ }
}

async function del(key) {
  try {
    if (redis) return await redis.del(key);
    mem.delete(key);
  } catch { /* fail open */ }
}

module.exports = { init, get, set, del };
