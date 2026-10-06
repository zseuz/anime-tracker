require('dotenv').config({ quiet: true });
const { connect } = require('./db');
const { userRepository, watchListRepository } = require('./repositories');
const { createApp } = require('./app');

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  console.error('JWT_SECRET debe tener al menos 32 caracteres (genera uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))").');
  process.exit(1);
}

(async () => {
  const pool = await connect();
  const app = createApp({
    users: userRepository(pool),
    lists: watchListRepository(pool),
    jwtSecret: secret,
    corsOrigin: process.env.CORS_ORIGIN,
    secureCookies: process.env.NODE_ENV === 'production',
  });
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`API lista en http://localhost:${port}`));
})().catch(e => {
  console.error('No se pudo iniciar:', e.message);
  process.exit(1);
});
