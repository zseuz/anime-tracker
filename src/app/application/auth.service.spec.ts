import { TestBed } from '@angular/core/testing';
import { AuthGateway, KeyValueStore } from '../domain/ports';
import { AuthError } from '../domain/session';
import { FakeAuthGateway, InMemoryStore } from '../testing/fakes';
import { AuthService, SESSION_HINT_KEY } from './auth.service';

describe('AuthService', () => {
  let store: InMemoryStore;
  let gateway: FakeAuthGateway;

  const create = () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: KeyValueStore, useValue: store },
        { provide: AuthGateway, useValue: gateway },
      ],
    });
    return TestBed.inject(AuthService);
  };
  const flush = () => new Promise(r => setTimeout(r));

  beforeEach(() => {
    store = new InMemoryStore();
    gateway = new FakeAuthGateway();
  });

  it('starts logged out and does not call the server', () => {
    const auth = create();
    expect(auth.loggedIn()).toBe(false);
    expect(auth.user()).toBeNull();
    expect(auth.avatar()).toBe('violet');
    expect(gateway.meCalls).toBe(0);
  });

  describe('register / login', () => {
    it('register trims the name and starts a session', async () => {
      const auth = create();
      await auth.register('  rei ', 'secret12');
      expect(auth.user()).toBe('rei');
    });

    it('only keeps the username and avatar locally, never a token or password', async () => {
      const auth = create();
      await auth.register('rei', 'secret12');
      expect(store.get(SESSION_HINT_KEY, null)).toEqual({ username: 'rei', avatar: 'violet' });
      expect(JSON.stringify([...store.data])).not.toMatch(/secret12|token/i);
    });

    it('surfaces server errors without starting a session', async () => {
      const auth = create();
      await auth.register('rei', 'secret12');
      auth.logout();
      await expect(auth.register('REI', 'other123')).rejects.toBeInstanceOf(AuthError);
      await expect(auth.login('rei', 'wrong')).rejects.toThrow('incorrectos');
      expect(auth.loggedIn()).toBe(false);
    });

    it('login starts a session with the stored avatar', async () => {
      const auth = create();
      await auth.register('rei', 'secret12');
      await auth.updateProfile({ avatar: 'teal' });
      auth.logout();
      await auth.login('rei', 'secret12');
      expect(auth.user()).toBe('rei');
      expect(auth.avatar()).toBe('teal');
    });
  });

  describe('session id', () => {
    it('changes on sign in and sign out', async () => {
      const auth = create();
      const start = auth.sessionId();
      await auth.register('rei', 'secret12');
      const signedIn = auth.sessionId();
      auth.logout();
      expect(signedIn).toBeGreaterThan(start);
      expect(auth.sessionId()).toBeGreaterThan(signedIn);
    });

    it('does NOT change when the profile is edited', async () => {
      const auth = create();
      await auth.register('rei', 'secret12');
      const id = auth.sessionId();
      await auth.updateProfile({ username: 'Rei Ayanami', avatar: 'rose' });
      expect(auth.sessionId()).toBe(id);
    });
  });

  it('logout clears the hint and tells the server to drop the cookie', async () => {
    const auth = create();
    await auth.register('rei', 'secret12');
    auth.logout();
    expect(auth.loggedIn()).toBe(false);
    expect(store.get(SESSION_HINT_KEY, null)).toBeNull();
    expect(gateway.logoutCalls).toBe(1);
  });

  it('logs out locally even if the server cannot be reached', async () => {
    const auth = create();
    await auth.register('rei', 'secret12');
    gateway.logout = () => Promise.reject(new Error('offline'));
    auth.logout();
    await flush();
    expect(auth.loggedIn()).toBe(false);
  });

  describe('profile', () => {
    it('updates the username and avatar, in memory and in the stored hint', async () => {
      const auth = create();
      await auth.register('rei', 'secret12');
      await auth.updateProfile({ username: 'Rei Ayanami', avatar: 'orange' });
      expect(auth.user()).toBe('Rei Ayanami');
      expect(auth.avatar()).toBe('orange');
      expect(store.get(SESSION_HINT_KEY, null)).toEqual({ username: 'Rei Ayanami', avatar: 'orange' });
    });

    it('keeps the old data when the server refuses (username taken)', async () => {
      const auth = create();
      await auth.register('shinji', 'secret12');
      auth.logout();
      await auth.register('rei', 'secret12');
      await expect(auth.updateProfile({ username: 'Shinji' })).rejects.toMatchObject({ status: 409 });
      expect(auth.user()).toBe('rei');
    });
  });

  describe('change password', () => {
    it('delegates to the server', async () => {
      const auth = create();
      await auth.register('rei', 'secret12');
      await auth.changePassword('secret12', 'Nueva9876');
      auth.logout();
      await expect(auth.login('rei', 'secret12')).rejects.toBeInstanceOf(AuthError);
      await auth.login('rei', 'Nueva9876');
      expect(auth.loggedIn()).toBe(true);
    });

    it('surfaces a wrong current password and stays signed in', async () => {
      const auth = create();
      await auth.register('rei', 'secret12');
      await expect(auth.changePassword('mal', 'Nueva9876')).rejects.toMatchObject({ status: 403 });
      expect(auth.loggedIn()).toBe(true);
    });
  });

  describe('delete account', () => {
    it('removes the account and ends the session', async () => {
      const auth = create();
      await auth.register('rei', 'secret12');
      await auth.deleteAccount('secret12');
      expect(gateway.has('rei')).toBe(false);
      expect(auth.loggedIn()).toBe(false);
      expect(store.get(SESSION_HINT_KEY, null)).toBeNull();
    });

    it('keeps everything when the password is wrong', async () => {
      const auth = create();
      await auth.register('rei', 'secret12');
      await expect(auth.deleteAccount('mal')).rejects.toMatchObject({ status: 403 });
      expect(gateway.has('rei')).toBe(true);
      expect(auth.loggedIn()).toBe(true);
    });
  });

  describe('restoring a stored session', () => {
    beforeEach(() => store.set(SESSION_HINT_KEY, { username: 'rei', avatar: 'blue' }));

    it('is logged in immediately and confirms with the server in the background', async () => {
      await gateway.register('rei', 'secret12'); // the server knows this user
      const auth = create();
      expect(auth.user()).toBe('rei');
      expect(auth.avatar()).toBe('blue');
      await flush();
      expect(gateway.meCalls).toBe(1);
      expect(auth.loggedIn()).toBe(true);
    });

    it('adopts the profile the server reports, without changing the session id', async () => {
      await gateway.register('Rei', 'secret12');
      await gateway.updateProfile({ avatar: 'green' });
      const auth = create();
      const id = auth.sessionId();
      await flush();
      expect(auth.user()).toBe('Rei');
      expect(auth.avatar()).toBe('green');
      expect(auth.sessionId()).toBe(id);
    });

    it('logs out when the server has no valid session (401)', async () => {
      const auth = create(); // the server has no session -> 401
      await flush();
      expect(auth.loggedIn()).toBe(false);
      expect(store.get(SESSION_HINT_KEY, null)).toBeNull();
    });

    it('stays logged in when the server is unreachable', async () => {
      gateway.meError = new Error('No se pudo conectar con el servidor');
      const auth = create();
      await flush();
      expect(auth.loggedIn()).toBe(true);
    });

    it('tolerates a hint from an older version (no avatar, extra token field)', () => {
      store.set(SESSION_HINT_KEY, { username: 'rei', token: 'old' });
      const auth = create();
      expect(auth.user()).toBe('rei');
      expect(auth.avatar()).toBe('violet');
    });

    it('ignores an unknown avatar id in the hint', () => {
      store.set(SESSION_HINT_KEY, { username: 'rei', avatar: 'neon' });
      expect(create().avatar()).toBe('violet');
    });
  });
});
