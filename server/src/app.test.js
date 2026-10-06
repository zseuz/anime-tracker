import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach } from 'vitest';

const require = createRequire(import.meta.url);
const request = require('supertest');
const { createApp } = require('./app');
const { DuplicateUserError } = require('./repositories');

const PASSWORD = 'secret12';

function memoryRepos() {
  const rows = [];
  const lists = new Map();
  return {
    users: {
      async create(username, passwordHash) {
        if (rows.some(u => u.username.toLowerCase() === username.toLowerCase())) throw new DuplicateUserError();
        const u = { id: rows.length + 1, username, passwordHash, avatar: 'violet' };
        rows.push(u);
        return u;
      },
      async findByUsername(n) { return rows.find(u => u.username.toLowerCase() === n.toLowerCase()) ?? null; },
      async findById(id) { return rows.find(u => u.id === id) ?? null; },
      async updateProfile(id, { username, avatar }) {
        if (rows.some(u => u.id !== id && u.username.toLowerCase() === username.toLowerCase())) throw new DuplicateUserError();
        Object.assign(rows.find(u => u.id === id), { username, avatar });
      },
      async updatePassword(id, hash) { rows.find(u => u.id === id).passwordHash = hash; },
      async remove(id) { rows.splice(rows.findIndex(u => u.id === id), 1); lists.delete(id); },
    },
    lists: {
      async get(id) { return lists.get(id) ?? []; },
      async replace(id, items) { lists.set(id, items); },
    },
  };
}

const item = (over = {}) => ({
  id: 7, title: 'Frieren', image: 'i.jpg', following: true, watched: [1, 2], knownEpisodes: 12, newEpisodes: 0,
  status: 'watching', rating: 9, notes: 'Genial', ...over,
});

const build = (opts = {}) => createApp({ ...memoryRepos(), jwtSecret: 'test-secret-test-secret-test-secret', ...opts });

describe('API', () => {
  let app;
  beforeEach(() => { app = build({ authRateLimit: { windowMs: 60_000, max: 1000 } }); });

  /** A client that keeps cookies, like a browser. */
  const client = () => request.agent(app);
  const register = async (agent = client(), username = 'rei', password = PASSWORD) => {
    await agent.post('/api/auth/register').send({ username, password });
    return agent;
  };

  it('refuses to start without a JWT secret', () => {
    expect(() => createApp({ ...memoryRepos() })).toThrow(/JWT_SECRET/);
  });

  describe('register', () => {
    it('creates the account and sets an HttpOnly session cookie (no token in the body)', async () => {
      const res = await request(app).post('/api/auth/register').send({ username: ' rei ', password: PASSWORD });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ username: 'rei', avatar: 'violet' });
      const cookie = res.headers['set-cookie'][0];
      expect(cookie).toMatch(/^at_token=/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
    });

    it('marks the cookie Secure in production mode', async () => {
      const prod = request(build({ secureCookies: true }));
      const res = await prod.post('/api/auth/register').send({ username: 'rei', password: PASSWORD });
      expect(res.headers['set-cookie'][0]).toMatch(/Secure/i);
    });

    it.each([
      ['too short', 'abc12'],
      ['no digits', 'abcdefghij'],
      ['no letters', '1234567890'],
    ])('rejects a weak password (%s)', async (_label, password) => {
      const res = await request(app).post('/api/auth/register').send({ username: 'rei', password });
      expect(res.status).toBe(400);
    });

    it('rejects missing fields', async () => {
      expect((await request(app).post('/api/auth/register').send({})).status).toBe(400);
      expect((await request(app).post('/api/auth/register')).status).toBe(400);
    });

    it('rejects duplicates, ignoring case', async () => {
      await register(client(), 'Rei');
      const res = await request(app).post('/api/auth/register').send({ username: 'rei', password: PASSWORD });
      expect(res.status).toBe(409);
    });

    it('never returns the hash', async () => {
      const res = await request(app).post('/api/auth/register').send({ username: 'rei', password: PASSWORD });
      expect(JSON.stringify(res.body)).not.toMatch(/hash|\$2/i);
    });
  });

  describe('login / logout', () => {
    it('accepts valid credentials (case-insensitive username)', async () => {
      await register();
      const res = await request(app).post('/api/auth/login').send({ username: 'REI', password: PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.username).toBe('rei');
      expect(res.headers['set-cookie'][0]).toMatch(/^at_token=/);
    });

    it('gives the same error for wrong password and unknown user', async () => {
      await register();
      const wrong = await request(app).post('/api/auth/login').send({ username: 'rei', password: 'nope!' });
      const ghost = await request(app).post('/api/auth/login').send({ username: 'ghost', password: PASSWORD });
      expect([wrong.status, ghost.status]).toEqual([401, 401]);
      expect(wrong.body).toEqual(ghost.body);
    });

    it('still lets accounts with a legacy short password log in', async () => {
      const bcrypt = require('bcryptjs');
      const repos = memoryRepos();
      await repos.users.create('old', await bcrypt.hash('7773', 4));
      const legacy = request(createApp({ ...repos, jwtSecret: 'x'.repeat(40) }));
      expect((await legacy.post('/api/auth/login').send({ username: 'old', password: '7773' })).status).toBe(200);
    });

    it('logout clears the cookie and ends the session', async () => {
      const agent = await register();
      expect((await agent.get('/api/me')).status).toBe(200);
      const out = await agent.post('/api/auth/logout');
      expect(out.status).toBe(204);
      expect((await agent.get('/api/me')).status).toBe(401);
    });
  });

  describe('rate limiting', () => {
    it('blocks repeated auth attempts with 429', async () => {
      const limited = request(build({ authRateLimit: { windowMs: 60_000, max: 3 } }));
      const attempt = () => limited.post('/api/auth/login').send({ username: 'a', password: 'b' });
      const statuses = [];
      for (let i = 0; i < 5; i++) statuses.push((await attempt()).status);
      expect(statuses).toEqual([401, 401, 401, 429, 429]);
    });

    it('does not limit the list endpoints', async () => {
      const agent = await register(request.agent(build({ authRateLimit: { windowMs: 60_000, max: 1 } })));
      for (let i = 0; i < 5; i++) expect((await agent.get('/api/list')).status).toBe(200);
    });
  });

  describe('auth', () => {
    it('protects /api/me and /api/list', async () => {
      expect((await request(app).get('/api/me')).status).toBe(401);
      expect((await request(app).get('/api/list')).status).toBe(401);
      expect((await request(app).put('/api/list').send([])).status).toBe(401);
    });
    it('rejects a forged cookie', async () => {
      const res = await request(app).get('/api/me').set('Cookie', 'at_token=garbage');
      expect(res.status).toBe(401);
    });
    it('returns the current user', async () => {
      const agent = await register();
      expect((await agent.get('/api/me')).body).toEqual({ username: 'rei', avatar: 'violet' });
    });
    it('answers CORS only for the configured origin, with credentials', async () => {
      const cors = request(build({ corsOrigin: 'http://localhost:4200' }));
      const ok = await cors.get('/api/health').set('Origin', 'http://localhost:4200');
      expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:4200');
      expect(ok.headers['access-control-allow-credentials']).toBe('true');
      const bad = await cors.get('/api/health').set('Origin', 'http://evil.test');
      // The header always names the configured origin, so browsers refuse any other site.
      expect(bad.headers['access-control-allow-origin']).toBe('http://localhost:4200');
      expect(bad.headers['access-control-allow-origin']).not.toBe('http://evil.test');
    });
  });

  describe('profile', () => {
    it('changes the username and keeps the session', async () => {
      const agent = await register(client(), 'rei');
      const res = await agent.patch('/api/me').send({ username: '  Rei Ayanami ' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ username: 'Rei Ayanami', avatar: 'violet' });
      expect((await agent.get('/api/me')).body.username).toBe('Rei Ayanami'); // same cookie still valid
      // and the new name is the one that logs in
      const login = await request(app).post('/api/auth/login').send({ username: 'rei ayanami', password: PASSWORD });
      expect(login.status).toBe(200);
      expect((await request(app).post('/api/auth/login').send({ username: 'rei', password: PASSWORD })).status).toBe(401);
    });

    it('changes the avatar colour', async () => {
      const agent = await register();
      const res = await agent.patch('/api/me').send({ avatar: 'teal' });
      expect(res.body).toEqual({ username: 'rei', avatar: 'teal' });
      expect((await agent.get('/api/me')).body.avatar).toBe('teal');
    });

    it('allows re-casing your own name', async () => {
      const agent = await register(client(), 'rei');
      expect((await agent.patch('/api/me').send({ username: 'REI' })).status).toBe(200);
    });

    it('rejects a username that belongs to someone else', async () => {
      await register(client(), 'shinji');
      const agent = await register(client(), 'rei');
      const res = await agent.patch('/api/me').send({ username: 'Shinji' });
      expect(res.status).toBe(409);
    });

    it.each([
      ['nothing to change', {}],
      ['empty username', { username: '   ' }],
      ['too long username', { username: 'x'.repeat(51) }],
      ['unknown avatar', { avatar: 'neon' }],
    ])('rejects %s', async (_label, body) => {
      const agent = await register();
      expect((await agent.patch('/api/me').send(body)).status).toBe(400);
    });

    it('requires a session', async () => {
      expect((await request(app).patch('/api/me').send({ avatar: 'rose' })).status).toBe(401);
    });
  });

  describe('change password', () => {
    const change = (agent, body) => agent.put('/api/me/password').send(body);

    it('changes it: the old one stops working, the new one works', async () => {
      const agent = await register();
      expect((await change(agent, { currentPassword: PASSWORD, newPassword: 'Nueva9876' })).status).toBe(204);
      expect((await request(app).post('/api/auth/login').send({ username: 'rei', password: PASSWORD })).status).toBe(401);
      expect((await request(app).post('/api/auth/login').send({ username: 'rei', password: 'Nueva9876' })).status).toBe(200);
    });

    it('needs the correct current password', async () => {
      const agent = await register();
      expect((await change(agent, { currentPassword: 'equivocada1', newPassword: 'Nueva9876' })).status).toBe(403);
      expect((await change(agent, { newPassword: 'Nueva9876' })).status).toBe(403);
    });

    it('enforces the password rules and rejects reusing the current one', async () => {
      const agent = await register();
      expect((await change(agent, { currentPassword: PASSWORD, newPassword: 'corta1' })).status).toBe(400);
      expect((await change(agent, { currentPassword: PASSWORD, newPassword: 'sinnumeros' })).status).toBe(400);
      expect((await change(agent, { currentPassword: PASSWORD, newPassword: PASSWORD })).status).toBe(400);
    });

    it('requires a session', async () => {
      expect((await request(app).put('/api/me/password').send({ currentPassword: PASSWORD, newPassword: 'Nueva9876' })).status).toBe(401);
    });

    it('is rate limited so it cannot be used to guess the password', async () => {
      const limited = request.agent(build({ authRateLimit: { windowMs: 60_000, max: 3 } }));
      await limited.post('/api/auth/register').send({ username: 'rei', password: PASSWORD }); // uses 1 of 3
      const statuses = [];
      for (let i = 0; i < 4; i++) {
        statuses.push((await limited.put('/api/me/password').send({ currentPassword: 'mal', newPassword: 'Nueva9876' })).status);
      }
      expect(statuses).toEqual([403, 403, 429, 429]);
    });
  });

  describe('delete account', () => {
    it('removes the account and its data, and ends the session', async () => {
      const agent = await register();
      await agent.put('/api/list').send([item()]).expect(204);
      const res = await agent.delete('/api/me').send({ password: PASSWORD });
      expect(res.status).toBe(204);
      expect((await agent.get('/api/me')).status).toBe(401);
      expect((await request(app).post('/api/auth/login').send({ username: 'rei', password: PASSWORD })).status).toBe(401);
      // the name can be registered again, with an empty list
      const again = await register(client(), 'rei');
      expect((await again.get('/api/list')).body).toEqual([]);
    });

    it('needs the correct password', async () => {
      const agent = await register();
      expect((await agent.delete('/api/me').send({ password: 'equivocada1' })).status).toBe(403);
      expect((await agent.delete('/api/me')).status).toBe(403);
      expect((await agent.get('/api/me')).status).toBe(200); // still there
    });

    it('requires a session', async () => {
      expect((await request(app).delete('/api/me').send({ password: PASSWORD })).status).toBe(401);
    });

    it('a session of a deleted account is rejected everywhere', async () => {
      const agent = await register();
      await agent.delete('/api/me').send({ password: PASSWORD });
      expect((await agent.get('/api/list')).status).toBe(401);
      expect((await agent.put('/api/list').send([item()])).status).toBe(401);
    });
  });

  describe('list', () => {
    it('round-trips a list per user', async () => {
      const a = await register(client(), 'rei');
      const b = await register(client(), 'shinji');
      await a.put('/api/list').send([item()]).expect(204);
      expect((await a.get('/api/list')).body).toEqual([item()]);
      expect((await b.get('/api/list')).body).toEqual([]);
    });

    it('accepts a null rating', async () => {
      const a = await register();
      await a.put('/api/list').send([item({ rating: null })]).expect(204);
    });

    it.each([
      ['not an array', {}],
      ['non-numeric episodes', [item({ watched: ['x'] })]],
      ['negative id', [item({ id: -1 })]],
      ['duplicate ids', [item(), item()]],
      ['unknown status', [item({ status: 'bogus' })]],
      ['rating out of range', [item({ rating: 11 })]],
      ['rating zero', [item({ rating: 0 })]],
      ['notes too long', [item({ notes: 'x'.repeat(2001) })]],
      ['missing status', [item({ status: undefined })]],
    ])('rejects %s', async (_label, body) => {
      const a = await register();
      expect((await a.put('/api/list').send(body)).status).toBe(400);
    });
  });
});
