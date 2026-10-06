import { Anime, AvatarId, Episode, Page, ProfileChanges, Session, TrackedAnime } from '../domain/models';
import {
  AnimeCatalog, AuthGateway, KeyValueStore, NotificationPermissionState, Notifier, WatchListRepository,
} from '../domain/ports';
import { AuthError } from '../domain/session';

export function makeAnime(overrides: Partial<Anime> = {}): Anime {
  return {
    id: 1,
    title: 'Sousou no Frieren',
    title_english: 'Frieren: Beyond Journey\'s End',
    image: 'cover.jpg',
    score: 9.3,
    type: 'TV',
    episodes: 28,
    status: 'Finalizado',
    synopsis: 'An elf mage...',
    year: 2023,
    genres: ['Adventure'],
    nextEpisode: null,
    ...overrides,
  };
}

export const makeTracked = (over: Partial<TrackedAnime> = {}): TrackedAnime => ({
  id: 7, title: 'Frieren', image: 'i.jpg', following: false, watched: [], knownEpisodes: 0, newEpisodes: 0,
  status: 'watching', rating: null, notes: '', ...over,
});

export function makePage<T>(data: T[], current = 1, last = 1): Page<T> {
  return { data, pagination: { currentPage: current, lastPage: last, hasNextPage: current < last } };
}

export const makeEpisodes = (n: number): Episode[] =>
  Array.from({ length: n }, (_, i) => ({ number: i + 1, title: `Capítulo ${i + 1}`, aired: null }));

export class InMemoryStore extends KeyValueStore {
  readonly data = new Map<string, unknown>();
  get<T>(key: string, fallback: T): T {
    return this.data.has(key) ? (structuredClone(this.data.get(key)) as T) : fallback;
  }
  set<T>(key: string, value: T) { this.data.set(key, structuredClone(value)); }
  remove(key: string) { this.data.delete(key); }
}

interface FakeUser { username: string; password: string; avatar: AvatarId }

/** In-memory stand-in for the backend's account endpoints (the session is the "cookie"). */
export class FakeAuthGateway extends AuthGateway {
  private readonly users = new Map<string, FakeUser>();
  /** Username the "server" currently considers signed in, i.e. the cookie. */
  serverSession: string | null = null;
  /** When set, me() rejects with this error (e.g. a network failure). */
  meError: Error | null = null;
  meCalls = 0;
  logoutCalls = 0;

  register(username: string, password: string): Promise<Session> {
    if (this.users.has(username.toLowerCase())) return Promise.reject(new AuthError('Ese usuario ya existe', 409));
    this.users.set(username.toLowerCase(), { username, password, avatar: 'violet' });
    this.serverSession = username;
    return Promise.resolve({ username, avatar: 'violet' });
  }

  login(username: string, password: string): Promise<Session> {
    const user = this.users.get(username.toLowerCase());
    if (!user || user.password !== password) {
      return Promise.reject(new AuthError('Usuario o contraseña incorrectos', 401));
    }
    this.serverSession = user.username;
    return Promise.resolve({ username: user.username, avatar: user.avatar });
  }

  logout() {
    this.logoutCalls++;
    this.serverSession = null;
    return Promise.resolve();
  }

  me(): Promise<Session> {
    this.meCalls++;
    if (this.meError) return Promise.reject(this.meError);
    const user = this.current();
    return user ? Promise.resolve({ username: user.username, avatar: user.avatar })
      : Promise.reject(new AuthError('No autenticado', 401));
  }

  updateProfile(changes: ProfileChanges): Promise<Session> {
    const user = this.current();
    if (!user) return Promise.reject(new AuthError('No autenticado', 401));
    if (changes.username !== undefined) {
      const key = changes.username.trim().toLowerCase();
      if (key !== user.username.toLowerCase() && this.users.has(key)) {
        return Promise.reject(new AuthError('Ese usuario ya existe', 409));
      }
      this.users.delete(user.username.toLowerCase());
      user.username = changes.username.trim();
      this.users.set(user.username.toLowerCase(), user);
      this.serverSession = user.username;
    }
    if (changes.avatar) user.avatar = changes.avatar;
    return Promise.resolve({ username: user.username, avatar: user.avatar });
  }

  changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.current();
    if (!user) return Promise.reject(new AuthError('No autenticado', 401));
    if (user.password !== currentPassword) return Promise.reject(new AuthError('La contraseña actual no es correcta', 403));
    user.password = newPassword;
    return Promise.resolve();
  }

  deleteAccount(password: string): Promise<void> {
    const user = this.current();
    if (!user) return Promise.reject(new AuthError('No autenticado', 401));
    if (user.password !== password) return Promise.reject(new AuthError('La contraseña no es correcta', 403));
    this.users.delete(user.username.toLowerCase());
    this.serverSession = null;
    return Promise.resolve();
  }

  /** Test helper: is there an account with this name? */
  has(username: string) { return this.users.has(username.toLowerCase()); }

  private current() {
    return this.serverSession ? this.users.get(this.serverSession.toLowerCase()) : undefined;
  }
}

/** Remembers the last saved list; tests can make loads/saves fail. */
export class FakeWatchListRepository extends WatchListRepository {
  stored: TrackedAnime[] = [];
  failLoad = false;
  failSave = false;
  readonly saves: TrackedAnime[][] = [];

  load() {
    return this.failLoad ? Promise.reject(new Error('down')) : Promise.resolve(structuredClone(this.stored));
  }
  save(list: readonly TrackedAnime[]) {
    if (this.failSave) return Promise.reject(new Error('down'));
    this.stored = structuredClone([...list]);
    this.saves.push(this.stored);
    return Promise.resolve();
  }
}

export class FakeNotifier extends Notifier {
  state: NotificationPermissionState = 'default';
  /** What requestPermission() will resolve to. */
  grantOnRequest: NotificationPermissionState = 'granted';
  readonly sent: { title: string; body: string }[] = [];

  permission() { return this.state; }
  async requestPermission() { this.state = this.grantOnRequest; return this.state; }
  notify(title: string, body: string) { this.sent.push({ title, body }); }
}

/** Catalogue whose responses tests set directly. */
export class FakeCatalog extends AnimeCatalog {
  searchResult = makePage<Anime>([]);
  /** When set, search() returns the entry matching the requested page number (1-based). */
  searchPages: Page<Anime>[] = [];
  genreList = ['Action'];
  animeById = new Map<number, Anime>();
  /** Released episodes per series id. */
  episodeLists = new Map<number, Episode[]>();
  failEpisodesFor = new Set<number>();
  readonly searches: { page?: number; [k: string]: unknown }[] = [];
  /** Number of airedEpisodes() calls. */
  episodeCalls = 0;

  search(filters: { page?: number }) {
    this.searches.push({ ...filters });
    const index = Math.min((filters.page ?? 1) - 1, this.searchPages.length - 1);
    return Promise.resolve(this.searchPages.length ? this.searchPages[index] : this.searchResult);
  }
  genres() { return Promise.resolve(this.genreList); }
  anime(id: number) {
    const a = this.animeById.get(id);
    return a ? Promise.resolve(a) : Promise.reject(new Error('not found'));
  }
  episodes(id: number) { return Promise.resolve(this.episodeLists.get(id) ?? []); }
  airedEpisodes(id: number) {
    this.episodeCalls++;
    if (this.failEpisodesFor.has(id)) return Promise.reject(new Error('boom'));
    return Promise.resolve(this.episodeLists.get(id)?.length ?? 0);
  }
}
