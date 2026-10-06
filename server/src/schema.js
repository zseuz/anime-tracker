/** Schema and migrations. Run by `npm run db:setup` with an administrative MySQL account, never by the API. */

const TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) CHARACTER SET utf8mb4`,
  `CREATE TABLE IF NOT EXISTS watch_list (
    user_id INT UNSIGNED NOT NULL,
    anime_id INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    image VARCHAR(500) NOT NULL,
    following TINYINT(1) NOT NULL DEFAULT 0,
    watched JSON NOT NULL,
    known_episodes INT UNSIGNED NOT NULL DEFAULT 0,
    new_episodes INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, anime_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) CHARACTER SET utf8mb4`,
];

/** Columns added after the first version: [table, column, definition]. */
const COLUMNS = [
  ['watch_list', 'status', "ENUM('plan','watching','completed','dropped') NOT NULL DEFAULT 'watching'"],
  ['watch_list', 'rating', 'TINYINT UNSIGNED NULL'],
  ['watch_list', 'notes', "VARCHAR(2000) NOT NULL DEFAULT ''"],
];

/** Creates tables and adds missing columns. Safe to run repeatedly. */
async function migrate(conn, database) {
  for (const sql of TABLES) await conn.query(sql);
  for (const [table, column, definition] of COLUMNS) {
    const [rows] = await conn.query(
      'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [database, table, column],
    );
    if (!rows.length) await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

module.exports = { migrate };
