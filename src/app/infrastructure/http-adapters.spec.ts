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
      fetchMock.mockReturnValue(reply(201, { username: 'rei' }));
      const session = await TestBed.inject(HttpAuthGateway).register('rei', 'secret12');
      expect(session).toEqual({ username: 'rei' });
      expect(url()).toBe('http://api.test/api/auth/register');
      expect(init().method).toBe('POST');
      expect(init().credentials).toBe('include');
      expect(JSON.parse(init().body as string)).toEqual({ username: 'rei', password: 'secret12' });
    });

    it('never sets an Authorization header (the session is a cookie)', async () => {
      fetchMock.mockReturnValue(reply(200, { username: 'rei' }));
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

    it('me() returns the session user, with cookies', async () => {
      fetchMock.mockReturnValue(reply(200, { username: 'rei' }));
      expect(await TestBed.inject(HttpAuthGateway).me()).toEqual({ username: 'rei' });
      expect(url()).toBe('http://api.test/api/me');
      expect(init().credentials).toBe('include');
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
