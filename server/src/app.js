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
const AVATARS = ['violet', 'rose', 'blue', 'green', 'orange', 'teal'];

const isInt = v => Number.isInteger(v) && v >= 0;

/** At least 8 characters with a letter and a digit. */
const strongPassword = p =>
  typeof p === 'string' && p.length >= MIN_PASSWORD && p.length <= MAX_PASSWORD && /[A-Za-z]/.test(p) && /\d/.test(p);

const validUsername = u => typeof u === 'string' && u.trim().length >= 1 && u.trim().length <= MAX_USERNAME;
const validPasswordInput = p => typeof p === 'string' && p.length > 0 && p.length <= MAX_PASSWORD;

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

const publicProfile = user => ({ username: user.username, avatar: user.avatar ?? 'violet' });

/**
 * @param {{users: object, lists: object, jwtSecret: string, corsOrigin?: string,
 *          secureCookies?: boolean, authRateLimit?: {windowMs: number, max: number}}} deps
 */
function createApp({ users, lists, jwtSecret, corsOrigin, secureCookies = false, authRateLimit }) {
  if (!jwtSecret) throw new Error('JWT_SECRET es obligatorio');
  const app = express();
  app.use(cors({ origin: corsOrigin || false, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  /** Shared by every endpoint that checks a password, so none of them can be used to guess it. */
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

  /** Loads the signed-in user; 401 if the account no longer exists (e.g. it was deleted). */
  const loadUser = async (req, res, next) => {
    try {
      req.user = await users.findById(req.userId);
      if (!req.user) {
        res.clearCookie(COOKIE, cookieOptions);
        return res.status(401).json({ error: 'Usuario inexistente' });
      }
      next();
    } catch (e) { next(e); }
  };

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.post('/api/auth/register', limiter, async (req, res, next) => {
    try {
      const { username, password } = req.body ?? {};
      if (!validUsername(username)) return res.status(400).json({ error: 'Usuario requerido (máx. 50 caracteres)' });
      if (!strongPassword(password)) {
        return res.status(400).json({ error: `La contraseña debe tener ${MIN_PASSWORD}+ caracteres, con letras y números` });
      }
      const user = await users.create(username.trim(), await bcrypt.hash(password, 10));
      startSession(res, user);
      res.status(201).json(publicProfile(user));
    } catch (e) {
      if (e instanceof DuplicateUserError) return res.status(409).json({ error: 'Ese usuario ya existe' });
      next(e);
    }
  });

  app.post('/api/auth/login', limiter, async (req, res, next) => {
    try {
      const { username, password } = req.body ?? {};
      const bad = () => res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      if (!validUsername(username) || !validPasswordInput(password)) return bad();
      const user = await users.findByUsername(username.trim());
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) return bad();
      startSession(res, user);
      res.json(publicProfile(user));
    } catch (e) { next(e); }
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(COOKIE, cookieOptions);
    res.status(204).end();
  });

  app.get('/api/me', requireAuth, loadUser, (req, res) => res.json(publicProfile(req.user)));

  /** Edits the profile: username and/or avatar colour. */
  app.patch('/api/me', requireAuth, loadUser, async (req, res, next) => {
    try {
      const { username, avatar } = req.body ?? {};
      if (username === undefined && avatar === undefined) return res.status(400).json({ error: 'Nada que cambiar' });
      if (username !== undefined && !validUsername(username)) {
        return res.status(400).json({ error: 'Usuario requerido (máx. 50 caracteres)' });
      }
      if (avatar !== undefined && !AVATARS.includes(avatar)) return res.status(400).json({ error: 'Color de avatar inválido' });
      const next_ = {
        username: username === undefined ? req.user.username : username.trim(),
        avatar: avatar ?? req.user.avatar ?? 'violet',
      };
      await users.updateProfile(req.userId, next_);
      res.json(publicProfile(next_));
    } catch (e) {
      if (e instanceof DuplicateUserError) return res.status(409).json({ error: 'Ese usuario ya existe' });
      next(e);
    }
  });

  app.put('/api/me/password', requireAuth, limiter, loadUser, async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body ?? {};
      if (!validPasswordInput(currentPassword) || !(await bcrypt.compare(currentPassword, req.user.passwordHash))) {
        return res.status(403).json({ error: 'La contraseña actual no es correcta' });
      }
      if (!strongPassword(newPassword)) {
        return res.status(400).json({ error: `La contraseña nueva debe tener ${MIN_PASSWORD}+ caracteres, con letras y números` });
      }
      if (newPassword === currentPassword) {
        return res.status(400).json({ error: 'La contraseña nueva debe ser distinta de la actual' });
      }
      await users.updatePassword(req.userId, await bcrypt.hash(newPassword, 10));
      res.status(204).end();
    } catch (e) { next(e); }
  });

  /** Deletes the account and its data; needs the password so a stolen session cannot do it. */
  app.delete('/api/me', requireAuth, limiter, loadUser, async (req, res, next) => {
    try {
      const { password } = req.body ?? {};
      if (!validPasswordInput(password) || !(await bcrypt.compare(password, req.user.passwordHash))) {
        return res.status(403).json({ error: 'La contraseña no es correcta' });
      }
      await users.remove(req.userId);
      res.clearCookie(COOKIE, cookieOptions);
      res.status(204).end();
    } catch (e) { next(e); }
  });

  app.get('/api/list', requireAuth, loadUser, async (req, res, next) => {
    try { res.json(await lists.get(req.userId)); } catch (e) { next(e); }
  });

  app.put('/api/list', requireAuth, loadUser, async (req, res, next) => {
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
