import { createRequire } from 'node:module';
import path from 'node:path';

/** Removes the users (and, by cascade, their lists) the e2e tests created in the test database. */
export default async function globalTeardown() {
  const serverDir = path.resolve('server');
  const require = createRequire(path.join(serverDir, 'package.json'));
  require('dotenv').config({ quiet: true, path: path.join(serverDir, '.env') });
  const mysql = require('mysql2/promise');
  const conn = await mysql.createConnection({
    host: process.env['DB_HOST'],
    user: process.env['DB_USER'],
    password: process.env['DB_PASSWORD'],
    database: 'anime_tracker_test',
  });
  await conn.query("DELETE FROM users WHERE username LIKE 'e2e%'");
  await conn.end();
}
