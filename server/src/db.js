const mysql = require('mysql2/promise');

/** Connection pool for the (restricted) application user. The schema is created by `npm run db:setup`. */
async function connect(env = process.env) {
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME || 'anime_tracker',
    connectionLimit: 10,
  });
  // Fail fast with a clear message when the DB or schema is missing.
  try {
    await pool.query('SELECT 1 FROM watch_list LIMIT 1');
  } catch (e) {
    await pool.end();
    throw new Error(`Base de datos no lista (${e.code}). Ejecuta "npm run db:setup" en /server.`);
  }
  return pool;
}

module.exports = { connect };
