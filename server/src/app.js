const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { DuplicateUserError } = require('./repositories');

const COOKIE = 'at_token';
const SESSION_DAYS = 30;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72; // bcrypt limit
const MAX_USERNAME = 50;
const MAX_LIST = 2000;
const STATUSES = ['plan', 'watching', 'completed', 'dropped'];

const isInt = v => Number.isInteger(v) && v >= 0;

/** At least 8 characters with a letter and a digit. */
const strongPassword = p =>
  typeof p === 'string' && p.length >= MIN_PASSWORD && p.length <= MAX_PASSWORD && /[A-Za-z]/.test(p) && /\d/.test(p);

const validUsername = u => typeof u === 'string' && u.trim().length >= 1 && u.trim().length <= MAX_USERNAME;

function validItem(t) {
  return (
    t && isInt(t.id) && t.id > 0 &&
    typeof t.title === 'string' && t.title.length > 0 && t.title.length <= 255 &&
    typeof t.image === 'string' && t.image.length <= 500 &&
    typeof t.following === 'boolean' &&
    Array.isArray(t.watched) && t.watched.length <= 20000 && t.watched.every(isInt) &&
    isInt(t.knownEpisodes) && isInt(t.newEpisodes) &&
    STATUSES.includes(t.status) &&
    (t.rating === null || (Number.isInteger(t.rating) && t.rating >= 1 && t.rating <= 10)) &&
    typeof t.notes === 'string' && t.notes.length <= 2000
  );
}

/**
 * @param {{users: object, lists: object, jwtSecret: string, corsOrigin?: string,
 *          secureCookies?: boolean, authRateLimit?: {windowMs: number, max: number}}} deps
 */
function createApp({ users, lists, jwtSecret, corsOrigin, secureCookies = false, authRateLimit }) {
  if (!jwtSecret) throw new Error('JWT_SECRET es obligatorio');
  const app = express();
  app.use(cors({ origin: corsOrigin || false, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  const limiter = rateLimit({
    windowMs: authRateLimit?.windowMs ?? 15 * 60 * 1000,
    limit: authRateLimit?.max ?? 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Espera unos minutos.' },
  });

  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: secureCookies, path: '/' };
  const startSession = (res, user) => {
    const token = jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: `${SESSION_DAYS}d` });
    res.cookie(COOKIE, token, { ...cookieOptions, maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });
  };

  const requireAuth = (req, res, next) => {
    const token = req.cookies?.[COOKIE];
    if (!token) return res.status(401).json({ error: 'No autenticado' });
    try {
      req.userId = Number(jwt.verify(token, jwtSecret).sub);
      next();
    } catch {
      res.clearCookie(COOKIE, cookieOptions);
      res.status(401).json({ error: 'Sesión inválida o expirada' });
    }
  };

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.post('/api/auth/register', limiter, async (req, res, next) => {
    try {
      const { username, password } = req.body ?? {};
      if (!validUsername(username)) return res.status(400).json({ error: 'Usuario requerido (máx. 50 caracteres)' });
      if (!strongPassword(password)) {
        return res.status(400).json({ error: `La contraseña debe tener ${MIN_PASSWORD}+ caracteres, con letras y números` });
      }
      const name = username.trim();
      const user = await users.create(name, await bcrypt.hash(password, 10));
      startSession(res, user);
      res.status(201).json({ username: name });
    } catch (e) {
      if (e instanceof DuplicateUserError) return res.status(409).json({ error: 'Ese usuario ya existe' });
      next(e);
    }
  });

  app.post('/api/auth/login', limiter, async (req, res, next) => {
    try {
      const { username, password } = req.body ?? {};
      const bad = () => res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      if (!validUsername(username) || typeof password !== 'string' || password.length > MAX_PASSWORD) return bad();
      const user = await users.findByUsername(username.trim());
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) return bad();
      startSession(res, user);
      res.json({ username: user.username });
    } catch (e) { next(e); }
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(COOKIE, cookieOptions);
    res.status(204).end();
  });

  app.get('/api/me', requireAuth, async (req, res, next) => {
    try {
      const user = await users.findById(req.userId);
      if (!user) return res.status(401).json({ error: 'Usuario inexistente' });
      res.json({ username: user.username });
    } catch (e) { next(e); }
  });

  app.get('/api/list', requireAuth, async (req, res, next) => {
    try { res.json(await lists.get(req.userId)); } catch (e) { next(e); }
  });

  app.put('/api/list', requireAuth, async (req, res, next) => {
    try {
      const items = req.body;
      if (!Array.isArray(items) || items.length > MAX_LIST || !items.every(validItem)) {
        return res.status(400).json({ error: 'Lista inválida' });
      }
      if (new Set(items.map(t => t.id)).size !== items.length) {
        return res.status(400).json({ error: 'Lista con animes repetidos' });
      }
      await lists.replace(req.userId, items);
      res.status(204).end();
    } catch (e) { next(e); }
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  });

  return app;
}

module.exports = { createApp };
