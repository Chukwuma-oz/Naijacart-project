// Database connection pool.
// Two modes:
//  1) AWS mode  — set DB_SECRET_ARN and the app fetches credentials from
//     AWS Secrets Manager at startup (requires an IAM role with
//     secretsmanager:GetSecretValue on that secret). This is the pattern
//     taught in Sessions 19 & 26: no passwords in code or env files.
//  2) Local mode — set DB_HOST / DB_USER / DB_PASSWORD / DB_NAME in .env.
const mysql = require('mysql2/promise');

let pool;

async function getDbConfig() {
  if (process.env.DB_SECRET_ARN) {
    const { SecretsManagerClient, GetSecretValueCommand } =
      require('@aws-sdk/client-secrets-manager');
    const client = new SecretsManagerClient({}); // region from instance metadata / env
    const out = await client.send(
      new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN })
    );
    const s = JSON.parse(out.SecretString);
    return {
      host: s.host,
      user: s.username,
      password: s.password,
      database: s.dbname || process.env.DB_NAME || 'naijacart',
      port: Number(s.port) || 3306,
    };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'naijacart',
    port: Number(process.env.DB_PORT) || 3306,
  };
}

async function initPool() {
  const cfg = await getDbConfig();
  pool = mysql.createPool({
    ...cfg,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  await pool.query('SELECT 1'); // fail fast if unreachable
  console.log(`Connected to MySQL at ${cfg.host}:${cfg.port}/${cfg.database}`);
  return pool;
}

function getPool() {
  if (!pool) throw new Error('DB pool not initialised — call initPool() first');
  return pool;
}

module.exports = { initPool, getPool };
