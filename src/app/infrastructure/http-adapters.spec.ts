import { TestBed } from '@angular/core/testing';
import { AuthError } from '../domain/session';
import { API_URL } from './api-config';
import { HttpAuthGateway } from './http-auth-gateway';
import { HttpWatchListRepository } from './http-watch-list-repository';

const reply = (status: number, body: unknown = {}) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response);

describe('HTTP adapters', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const init = () => fetchMock.mock.calls.at(-1)![1] as RequestInit;
  const url = () => fetchMock.mock.calls.at(-1)![0] as string;
  const sentBody = () => JSON.parse(init().body as string);

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({
      providers: [HttpAuthGateway, HttpWatchListRepository, { provide: API_URL, useValue: 'http://api.test/api' }],
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('HttpAuthGateway', () => {
    it('posts credentials as JSON, sending and accepting cookies', async () => {
      fetchMock.mockReturnValue(reply(201, { username: 'rei', avatar: 'violet' }));
      const session = await TestBed.inject(HttpAuthGateway).register('rei', 'secret12');
      expect(session).toEqual({ username: 'rei', avatar: 'violet' });
      expect(url()).toBe('http://api.test/api/auth/register');
      expect(init().method).toBe('POST');
      expect(init().credentials).toBe('include');
      expect(sentBody()).toEqual({ username: 'rei', password: 'secret12' });
    });

    it('never sets an Authorization header (the session is a cookie)', async () => {
      fetchMock.mockReturnValue(reply(200, { username: 'rei', avatar: 'violet' }));
      await TestBed.inject(HttpAuthGateway).login('rei', 'x');
      expect(JSON.stringify(init().headers)).not.toMatch(/authorization/i);
    });

    it('turns server errors into AuthError with the status and message', async () => {
      fetchMock.mockReturnValue(reply(409, { error: 'Ese usuario ya existe' }));
      const err = await TestBed.inject(HttpAuthGateway).login('rei', 'x').catch(e => e);
      expect(err).toBeInstanceOf(AuthError);
      expect(err).toMatchObject({ message: 'Ese usuario ya existe', status: 409 });
    });

    it('reports an unreachable server clearly', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
      await expect(TestBed.inject(HttpAuthGateway).login('a', 'b')).rejects.toThrow('No se pudo conectar');
    });

    it('me() returns the session user, with cookies and no body', async () => {
      fetchMock.mockReturnValue(reply(200, { username: 'rei', avatar: 'teal' }));
      expect(await TestBed.inject(HttpAuthGateway).me()).toEqual({ username: 'rei', avatar: 'teal' });
      expect(url()).toBe('http://api.test/api/me');
      expect(init().method).toBe('GET');
      expect(init().credentials).toBe('include');
      expect(init().body).toBeUndefined();
    });

    it('me() rejects with status 401 when there is no valid session', async () => {
      fetchMock.mockReturnValue(reply(401, { error: 'No autenticado' }));
      await expect(TestBed.inject(HttpAuthGateway).me()).rejects.toMatchObject({ status: 401 });
    });

    it('logout posts to the server so the cookie is cleared', async () => {
      fetchMock.mockReturnValue(reply(204));
      await TestBed.inject(HttpAuthGateway).logout();
      expect(url()).toBe('http://api.test/api/auth/logout');
      expect(init().method).toBe('POST');
      expect(init().credentials).toBe('include');
    });

    describe('profile', () => {
      it('updateProfile PATCHes only the given fields', async () => {
        fetchMock.mockReturnValue(reply(200, { username: 'Rei A', avatar: 'rose' }));
        const session = await TestBed.inject(HttpAuthGateway).updateProfile({ username: 'Rei A', avatar: 'rose' });
        expect(session).toEqual({ username: 'Rei A', avatar: 'rose' });
        expect(url()).toBe('http://api.test/api/me');
        expect(init().method).toBe('PATCH');
        expect(init().credentials).toBe('include');
        expect(sentBody()).toEqual({ username: 'Rei A', avatar: 'rose' });
      });

      it('updateProfile surfaces "username taken" as a 409 AuthError', async () => {
        fetchMock.mockReturnValue(reply(409, { error: 'Ese usuario ya existe' }));
        await expect(TestBed.inject(HttpAuthGateway).updateProfile({ username: 'x' }))
          .rejects.toMatchObject({ status: 409, message: 'Ese usuario ya existe' });
      });

      it('changePassword PUTs both passwords', async () => {
        fetchMock.mockReturnValue(reply(204));
        await TestBed.inject(HttpAuthGateway).changePassword('vieja123', 'Nueva9876');
        expect(url()).toBe('http://api.test/api/me/password');
        expect(init().method).toBe('PUT');
        expect(sentBody()).toEqual({ currentPassword: 'vieja123', newPassword: 'Nueva9876' });
      });

      it('changePassword surfaces a wrong current password (403)', async () => {
        fetchMock.mockReturnValue(reply(403, { error: 'La contraseña actual no es correcta' }));
        await expect(TestBed.inject(HttpAuthGateway).changePassword('x', 'Nueva9876'))
          .rejects.toMatchObject({ status: 403 });
      });

      it('deleteAccount DELETEs with the password in the body', async () => {
        fetchMock.mockReturnValue(reply(204));
        await TestBed.inject(HttpAuthGateway).deleteAccount('secret12');
        expect(url()).toBe('http://api.test/api/me');
        expect(init().method).toBe('DELETE');
        expect(init().credentials).toBe('include');
        expect(sentBody()).toEqual({ password: 'secret12' });
      });
    });
  });

  describe('HttpWatchListRepository', () => {
    it('loads the list with cookies', async () => {
      fetchMock.mockReturnValue(reply(200, [{ id: 7 }]));
      expect(await TestBed.inject(HttpWatchListRepository).load()).toEqual([{ id: 7 }]);
      expect(url()).toBe('http://api.test/api/list');
      expect(init().credentials).toBe('include');
    });

    it('saves the whole list with PUT', async () => {
      fetchMock.mockReturnValue(reply(204));
      await TestBed.inject(HttpWatchListRepository).save([]);
      expect(init().method).toBe('PUT');
      expect(init().body).toBe('[]');
      expect(init().credentials).toBe('include');
    });

    it('rejects on failure with the server message', async () => {
      fetchMock.mockReturnValue(reply(400, { error: 'Lista inválida' }));
      await expect(TestBed.inject(HttpWatchListRepository).save([])).rejects.toThrow('Lista inválida');
    });
  });
});
