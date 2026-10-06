/** MySQL-backed repositories. The HTTP layer only depends on their method names. */

class DuplicateUserError extends Error {}

function userRepository(pool) {
  return {
    async create(username, passwordHash) {
      try {
        const [res] = await pool.execute(
          'INSERT INTO users (username, password_hash) VALUES (?, ?)',
          [username, passwordHash],
        );
        return { id: res.insertId, username };
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') throw new DuplicateUserError();
        throw e;
      }
    },
    async findByUsername(username) {
      const [rows] = await pool.execute(
        'SELECT id, username, password_hash AS passwordHash FROM users WHERE username = ?',
        [username],
      );
      return rows[0] ?? null;
    },
    async findById(id) {
      const [rows] = await pool.execute('SELECT id, username FROM users WHERE id = ?', [id]);
      return rows[0] ?? null;
    },
  };
}

function watchListRepository(pool) {
  return {
    async get(userId) {
      const [rows] = await pool.execute(
        `SELECT anime_id AS id, title, image, following, watched,
                known_episodes AS knownEpisodes, new_episodes AS newEpisodes,
                status, rating, notes
         FROM watch_list WHERE user_id = ? ORDER BY title`,
        [userId],
      );
      return rows.map(r => ({
        ...r,
        following: !!r.following,
        watched: typeof r.watched === 'string' ? JSON.parse(r.watched) : r.watched,
      }));
    },
    /** Replaces the user's whole list atomically. */
    async replace(userId, items) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.execute('DELETE FROM watch_list WHERE user_id = ?', [userId]);
        for (const t of items) {
          await conn.execute(
            `INSERT INTO watch_list
               (user_id, anime_id, title, image, following, watched, known_episodes, new_episodes, status, rating, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, t.id, t.title, t.image, t.following ? 1 : 0, JSON.stringify(t.watched),
              t.knownEpisodes, t.newEpisodes, t.status, t.rating ?? null, t.notes],
          );
        }
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },
  };
}

module.exports = { userRepository, watchListRepository, DuplicateUserError };
