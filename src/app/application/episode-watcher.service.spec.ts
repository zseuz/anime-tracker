import { TestBed } from '@angular/core/testing';
import { AnimeCatalog, AuthGateway, KeyValueStore, Notifier, WatchListRepository } from '../domain/ports';
import {
  FakeAuthGateway, FakeCatalog, FakeNotifier, FakeWatchListRepository, InMemoryStore, makeEpisodes, makeTracked,
} from '../testing/fakes';
import { AuthService } from './auth.service';
import { CHECK_INTERVAL_MS, EpisodeWatcher, MIN_GAP_MS } from './episode-watcher.service';

describe('EpisodeWatcher', () => {
  let catalog: FakeCatalog;
  let auth: AuthService;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    catalog = new FakeCatalog();
    const repo = new FakeWatchListRepository();
    repo.stored = [makeTracked({ following: true, knownEpisodes: 3 })];
    catalog.episodeLists.set(7, makeEpisodes(3));
    TestBed.configureTestingModule({
      providers: [
        { provide: KeyValueStore, useValue: new InMemoryStore() },
        { provide: AuthGateway, useValue: new FakeAuthGateway() },
        { provide: AnimeCatalog, useValue: catalog },
        { provide: WatchListRepository, useValue: repo },
        { provide: Notifier, useValue: new FakeNotifier() },
      ],
    });
    auth = TestBed.inject(AuthService);
    TestBed.inject(EpisodeWatcher);
  });
  afterEach(() => vi.useRealTimers());

  const settle = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
  };
  const signIn = async () => {
    await auth.register('rei', 'secret12');
    TestBed.tick();
    await settle();
  };

  it('does nothing while signed out', async () => {
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 2);
    expect(catalog.episodeCalls).toBe(0);
  });

  it('checks right after signing in', async () => {
    await signIn();
    expect(catalog.episodeCalls).toBe(1);
  });

  it('checks again every interval while signed in', async () => {
    await signIn();
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);
    expect(catalog.episodeCalls).toBe(2);
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);
    expect(catalog.episodeCalls).toBe(3);
  });

  it('stops checking after logout', async () => {
    await signIn();
    auth.logout();
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 3);
    expect(catalog.episodeCalls).toBe(1);
  });

  describe('when the tab becomes visible', () => {
    const show = () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    };

    it('re-checks if enough time has passed', async () => {
      await signIn();
      await vi.advanceTimersByTimeAsync(MIN_GAP_MS + 1000);
      show();
      await settle();
      expect(catalog.episodeCalls).toBe(2);
    });

    it('does not re-check too soon after the previous check', async () => {
      await signIn();
      show();
      await settle();
      expect(catalog.episodeCalls).toBe(1);
    });
  });
});
