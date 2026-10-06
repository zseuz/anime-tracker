import { TestBed } from '@angular/core/testing';
import { AnimeCatalog, AuthGateway, KeyValueStore, Notifier, WatchListRepository } from '../domain/ports';
import {
  FakeAuthGateway, FakeCatalog, FakeNotifier, FakeWatchListRepository, InMemoryStore, makeAnime, makeEpisodes, makeTracked,
} from '../testing/fakes';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { WatchListService } from './watch-list.service';

describe('WatchListService', () => {
  let catalog: FakeCatalog;
  let repo: FakeWatchListRepository;
  let notifier: FakeNotifier;
  let auth: AuthService;
  let service: WatchListService;
  const anime = makeAnime({ id: 7 });

  const setup = async (login = true) => {
    TestBed.configureTestingModule({
      providers: [
        { provide: KeyValueStore, useValue: new InMemoryStore() },
        { provide: AuthGateway, useValue: new FakeAuthGateway() },
        { provide: AnimeCatalog, useValue: catalog },
        { provide: WatchListRepository, useValue: repo },
        { provide: Notifier, useValue: notifier },
      ],
    });
    auth = TestBed.inject(AuthService);
    service = TestBed.inject(WatchListService);
    if (login) {
      await auth.register('rei', 'secret12');
      TestBed.tick();
      await service.whenLoaded();
    }
  };
  const settle = () => new Promise(r => setTimeout(r));

  beforeEach(() => {
    catalog = new FakeCatalog();
    repo = new FakeWatchListRepository();
    notifier = new FakeNotifier();
  });

  it('is empty when logged out and never calls the server', async () => {
    await setup(false);
    TestBed.tick();
    service.toggleEpisode(anime, 1, 12);
    await settle();
    expect(repo.saves).toEqual([]);
  });

  describe('loading', () => {
    it('loads the list from the server after login', async () => {
      repo.stored = [makeTracked({ watched: [1, 2] })];
      await setup();
      expect(service.get(7)?.watched).toEqual([1, 2]);
      expect(service.syncError()).toBe(false);
    });

    it('clears the list on logout', async () => {
      repo.stored = [makeTracked()];
      await setup();
      auth.logout();
      TestBed.tick();
      expect(service.items()).toEqual([]);
    });

    it('flags a sync error when loading fails', async () => {
      repo.failLoad = true;
      await setup();
      expect(service.syncError()).toBe(true);
      expect(service.items()).toEqual([]);
    });
  });

  describe('saving', () => {
    it('adds the anime on first interaction and saves to the server', async () => {
      await setup();
      service.toggleEpisode(anime, 2, 28);
      await settle();
      expect(service.get(7)?.watched).toEqual([2]);
      expect(repo.stored[0]).toMatchObject({ id: 7, watched: [2], knownEpisodes: 28, status: 'watching' });
    });

    it('does not save when nothing changed', async () => {
      await setup();
      service.acknowledge(7);
      await settle();
      expect(repo.saves).toEqual([]);
    });

    it('saves in order so the last change wins', async () => {
      await setup();
      service.toggleEpisode(anime, 1, 3);
      service.toggleEpisode(anime, 2, 3);
      service.toggleEpisode(anime, 3, 3);
      await settle();
      expect(repo.saves.map(s => s[0].watched)).toEqual([[1], [1, 2], [1, 2, 3]]);
    });

    it('keeps the local change and flags an error when saving fails, then recovers', async () => {
      await setup();
      repo.failSave = true;
      service.toggleEpisode(anime, 1, 3);
      await settle();
      expect(service.get(7)?.watched).toEqual([1]);
      expect(service.syncError()).toBe(true);
      repo.failSave = false;
      service.toggleEpisode(anime, 2, 3);
      await settle();
      expect(service.syncError()).toBe(false);
    });

    it('marks/clears all and removes entries', async () => {
      await setup();
      service.setAllWatched(anime, 3, true);
      expect(service.get(7)?.watched).toEqual([1, 2, 3]);
      service.setAllWatched(anime, 3, false);
      expect(service.get(7)?.watched).toEqual([]);
      service.remove(7);
      await settle();
      expect(service.get(7)).toBeUndefined();
      expect(repo.stored).toEqual([]);
    });
  });

  describe('status, rating and notes', () => {
    it('creates the entry on demand with the requested status and persists it', async () => {
      await setup();
      service.setStatus(anime, 'completed', 12);
      await settle();
      expect(repo.stored[0]).toMatchObject({ id: 7, status: 'completed', knownEpisodes: 12 });
    });

    it('stores a rating and notes', async () => {
      await setup();
      service.setRating(anime, 9);
      service.setNotes(anime, 'Imperdible');
      await settle();
      expect(repo.stored[0]).toMatchObject({ rating: 9, notes: 'Imperdible' });
    });

    it('following something new files it under "plan"; marking an episode moves it to "watching"', async () => {
      await setup();
      service.toggleFollow(anime, 10);
      expect(service.get(7)?.status).toBe('plan');
      service.toggleEpisode(anime, 1, 10);
      expect(service.get(7)?.status).toBe('watching');
    });
  });

  describe('checkForNewEpisodes', () => {
    it('waits for the list to load, then flags growth only for followed series', async () => {
      repo.stored = [
        makeTracked({ id: 7, following: true, knownEpisodes: 10 }),
        makeTracked({ id: 8, following: false, knownEpisodes: 10 }),
      ];
      catalog.episodeLists.set(7, makeEpisodes(12));
      catalog.episodeLists.set(8, makeEpisodes(15));
      await setup(false);
      await auth.register('rei', 'secret12');
      TestBed.tick();

      await service.checkForNewEpisodes(); // called before the list finished loading

      expect(service.get(7)).toMatchObject({ knownEpisodes: 12, newEpisodes: 2 });
      expect(service.get(8)).toMatchObject({ knownEpisodes: 10, newEpisodes: 0 });
      expect(service.totalNew()).toBe(2);
    });

    it('sends a notification per series with new episodes when enabled', async () => {
      repo.stored = [
        makeTracked({ id: 7, title: 'Frieren', following: true, knownEpisodes: 10 }),
        makeTracked({ id: 8, title: 'Quieto', following: true, knownEpisodes: 5 }),
      ];
      catalog.episodeLists.set(7, makeEpisodes(12));
      catalog.episodeLists.set(8, makeEpisodes(5));
      await setup();
      await TestBed.inject(NotificationService).toggle();

      await service.checkForNewEpisodes();

      expect(notifier.sent).toEqual([{ title: 'Frieren', body: '2 capítulos nuevos disponibles' }]);
    });

    it('does not notify when notifications are off', async () => {
      repo.stored = [makeTracked({ following: true, knownEpisodes: 1 })];
      catalog.episodeLists.set(7, makeEpisodes(3));
      await setup();
      await service.checkForNewEpisodes();
      expect(notifier.sent).toEqual([]);
    });

    it('acknowledging clears the badge', async () => {
      repo.stored = [makeTracked({ following: true, knownEpisodes: 10 })];
      catalog.episodeLists.set(7, makeEpisodes(11));
      await setup();
      await service.checkForNewEpisodes();
      service.acknowledge(7);
      expect(service.totalNew()).toBe(0);
    });

    it('survives a failing series and still checks the others', async () => {
      repo.stored = [
        makeTracked({ id: 7, following: true, knownEpisodes: 10 }),
        makeTracked({ id: 8, following: true, knownEpisodes: 10 }),
      ];
      catalog.failEpisodesFor.add(7);
      catalog.episodeLists.set(8, makeEpisodes(11));
      await setup();
      await service.checkForNewEpisodes();
      expect(service.get(7)?.newEpisodes).toBe(0);
      expect(service.get(8)?.newEpisodes).toBe(1);
      expect(service.checking()).toBe(false);
    });

    it('does not start a second check while one is running', async () => {
      repo.stored = [makeTracked({ following: true, knownEpisodes: 10 })];
      catalog.episodeLists.set(7, makeEpisodes(10));
      await setup();
      const first = service.checkForNewEpisodes();
      await service.checkForNewEpisodes();
      await first;
      expect(catalog.episodeCalls).toBe(1);
    });
  });
});
