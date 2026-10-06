/**
 * One-time (idempotent) database setup, run with an administrative MySQL account:
 *
 *   ADMIN_USER=... ADMIN_PASSWORD=... APP_PASSWORD=... npm run db:setup
 *
 * Creates the database(s), a restricted application user (SELECT/INSERT/UPDATE/DELETE only)
 * and the schema. The admin credentials are only read from the environment and never stored.
 * DB_NAMES is a comma-separated list (default: anime_tracker).
 */
const mysql = require('mysql2/promise');
const { migrate } = require('../src/schema');

const env = process.env;
const required = ['ADMIN_USER', 'APP_PASSWORD'];
const missing = required.filter(k => !env[k]);
if (missing.length) {
  console.error(`Faltan variables: ${missing.join(', ')}`);
  process.exit(1);
}

const host = env.DB_HOST || 'localhost';
const port = Number(env.DB_PORT || 3306);
const appUser = env.APP_USER || 'anime_app';
const databases = (env.DB_NAMES || 'anime_tracker').split(',').map(s => s.trim()).filter(Boolean);
const ident = /^\w+$/;
for (const name of [appUser, ...databases]) {
  if (!ident.test(name)) throw new Error(`Nombre inválido: ${name}`);
}

(async () => {
  const admin = await mysql.createConnection({ host, port, user: env.ADMIN_USER, password: env.ADMIN_PASSWORD || '', multipleStatements: false });
  const accounts = ['localhost', '127.0.0.1', '::1'];
  for (const h of accounts) {
    await admin.query(`CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?`, [appUser, h, env.APP_PASSWORD]);
    await admin.query(`ALTER USER ?@? IDENTIFIED BY ?`, [appUser, h, env.APP_PASSWORD]);
  }
  for (const db of databases) {
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4`);
    for (const h of accounts) {
      await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON \`${db}\`.* TO ?@?`, [appUser, h]);
    }
    await admin.changeUser({ database: db });
    await migrate(admin, db);
    console.log(`OK: base ${db} lista`);
  }
  await admin.end();
  console.log(`OK: usuario ${appUser} con permisos limitados`);
})().catch(e => {
  console.error('Fallo:', e.message);
  process.exit(1);
});
