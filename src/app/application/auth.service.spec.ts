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
    expect(gateway.meCalls).toBe(0);
  });

  describe('register / login', () => {
    it('register trims the name and starts a session', async () => {
      const auth = create();
      await auth.register('  rei ', 'secret12');
      expect(auth.user()).toBe('rei');
    });

    it('only keeps the username locally, never a token or password', async () => {
      const auth = create();
      await auth.register('rei', 'secret12');
      expect(store.get(SESSION_HINT_KEY, null)).toEqual({ username: 'rei' });
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

    it('login starts a session', async () => {
      const auth = create();
      await auth.register('rei', 'secret12');
      auth.logout();
      await auth.login('rei', 'secret12');
      expect(auth.user()).toBe('rei');
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

  describe('restoring a stored session', () => {
    beforeEach(() => store.set(SESSION_HINT_KEY, { username: 'rei' }));

    it('is logged in immediately and confirms with the server in the background', async () => {
      gateway.serverSession = 'rei';
      const auth = create();
      expect(auth.user()).toBe('rei');
      await flush();
      expect(gateway.meCalls).toBe(1);
      expect(auth.loggedIn()).toBe(true);
    });

    it('adopts the username the server reports', async () => {
      gateway.serverSession = 'Rei';
      const auth = create();
      await flush();
      expect(auth.user()).toBe('Rei');
    });

    it('logs out when the server has no valid session (401)', async () => {
      const auth = create(); // serverSession is null -> 401
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
  });
});
