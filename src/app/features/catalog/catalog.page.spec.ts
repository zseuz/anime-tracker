import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AnimeCatalog, AuthGateway, KeyValueStore, Notifier, WatchListRepository } from '../../domain/ports';
import {
  FakeAuthGateway, FakeCatalog, FakeNotifier, FakeWatchListRepository, InMemoryStore, makeAnime, makePage,
} from '../../testing/fakes';
import { CatalogPage, SEARCH_DEBOUNCE_MS } from './catalog.page';

describe('CatalogPage', () => {
  let catalog: FakeCatalog;
  type Internals = Record<string, any>;

  const open = async (url = '/') => {
    const harness = await RouterTestingHarness.create();
    const page = (await harness.navigateByUrl(url, CatalogPage)) as unknown as Internals;
    await harness.fixture.whenStable();
    return { harness, page, el: harness.routeNativeElement as HTMLElement };
  };

  beforeEach(() => {
    catalog = new FakeCatalog();
    catalog.searchPages = [
      makePage([makeAnime({ id: 1 }), makeAnime({ id: 2 })], 1, 3),
      makePage([makeAnime({ id: 2 }), makeAnime({ id: 3 })], 2, 3),
      makePage([makeAnime({ id: 4 })], 3, 3),
    ];
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '', component: CatalogPage }]),
        { provide: AnimeCatalog, useValue: catalog },
        { provide: KeyValueStore, useValue: new InMemoryStore() },
        { provide: AuthGateway, useValue: new FakeAuthGateway() },
        { provide: WatchListRepository, useValue: new FakeWatchListRepository() },
        { provide: Notifier, useValue: new FakeNotifier() },
      ],
    });
  });

  it('loads genres and the first page on init', async () => {
    const { page, el } = await open();
    expect(page['genres']()).toEqual(catalog.genreList);
    expect(catalog.searches).toHaveLength(1);
    expect(catalog.searches[0]).toMatchObject({ page: 1, orderBy: 'score' });
    expect(el.querySelectorAll('app-anime-card')).toHaveLength(2);
  });

  describe('filters in the URL', () => {
    it('are read from the query string on load', async () => {
      await open('/?q=naruto&type=movie&genre=Drama&minScore=8&orderBy=popularity');
      expect(catalog.searches[0]).toMatchObject({
        q: 'naruto', type: 'movie', genre: 'Drama', minScore: 8, orderBy: 'popularity', page: 1,
      });
    });

    it('are written to the URL when applied, which runs the search', async () => {
      const { harness, page } = await open();
      page['filters'].type = 'tv';
      page['filters'].genre = 'Action';
      await page['apply']();
      await harness.fixture.whenStable();
      const url = TestBed.inject(Router).url;
      expect(url).toContain('type=tv');
      expect(url).toContain('genre=Action');
      expect(catalog.searches.at(-1)).toMatchObject({ type: 'tv', genre: 'Action', page: 1 });
    });

    it('re-run the search when applied with unchanged filters', async () => {
      const { page } = await open();
      await page['apply']();
      expect(catalog.searches).toHaveLength(2);
    });

    it('restore the form when navigating back to a previous URL', async () => {
      const { harness, page } = await open('/?type=tv');
      await harness.navigateByUrl('/?type=movie', CatalogPage);
      await harness.navigateByUrl('/?type=tv', CatalogPage);
      expect(page['filters'].type).toBe('tv');
    });
  });

  describe('infinite scroll', () => {
    it('loads the next page and merges it, dropping repeated entries', async () => {
      const { page } = await open();
      await page['loadMore']();
      expect(catalog.searches.at(-1)).toMatchObject({ page: 2 });
      expect(page['results']().map((a: { id: number }) => a.id)).toEqual([1, 2, 3]);
      expect(page['hasNext']()).toBe(true);
    });

    it('stops at the last page', async () => {
      const { page } = await open();
      await page['loadMore']();
      await page['loadMore']();
      expect(page['hasNext']()).toBe(false);
      const calls = catalog.searches.length;
      await page['loadMore']();
      expect(catalog.searches).toHaveLength(calls);
    });

    it('does not load while a request is in flight', async () => {
      const { page } = await open();
      const first = page['loadMore']();
      await page['loadMore']();
      await first;
      expect(catalog.searches).toHaveLength(2);
    });

    it('a new search discards the accumulated results', async () => {
      const { page } = await open();
      await page['loadMore']();
      await page['apply']();
      expect(page['results']().map((a: { id: number }) => a.id)).toEqual([1, 2]);
    });
  });

  describe('typing in the search box', () => {
    afterEach(() => vi.useRealTimers());

    it('searches once after a pause, not on every keystroke', async () => {
      const { page } = await open();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const base = catalog.searches.length;
      page['filters'].q = 'a';
      page['onSearchInput']();
      page['filters'].q = 'ab';
      page['onSearchInput']();
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 50);
      expect(catalog.searches.length).toBe(base);
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(0);
      expect(TestBed.inject(Router).url).toContain('q=ab');
    });
  });

  describe('errors', () => {
    it('surfaces API errors and retries', async () => {
      const { page } = await open();
      catalog.searchPages = [];
      catalog.search = () => Promise.reject(new Error('AniList respondió 500'));
      await page['apply']();
      expect(page['error']()).toContain('500');
      expect(page['loading']()).toBe(false);

      catalog.search = () => Promise.resolve(makePage([makeAnime({ id: 9 })]));
      await page['retry']();
      expect(page['error']()).toBe('');
      expect(page['results']().map((a: { id: number }) => a.id)).toEqual([9]);
    });

    it('ignores a slow response from an outdated query', async () => {
      const { page } = await open();
      let release!: () => void;
      const slow = new Promise<void>(r => (release = r));
      catalog.searchPages = [];
      catalog.search = (async (f: { q?: string }) => {
        if (f.q === 'old') { await slow; return makePage([makeAnime({ id: 100 })]); }
        return makePage([makeAnime({ id: 200 })]);
      }) as typeof catalog.search;

      page['filters'].q = 'old';
      const oldRun = page['apply']();
      page['filters'].q = 'new';
      await page['apply']();
      release();
      await oldRun;
      expect(page['results']().map((a: { id: number }) => a.id)).toEqual([200]);
    });
  });
});
