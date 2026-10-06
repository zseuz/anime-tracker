import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../application/auth.service';
import { WatchListService } from '../../application/watch-list.service';
import { AnimeCatalog, AuthGateway, KeyValueStore, Notifier, WatchListRepository } from '../../domain/ports';
import {
  FakeAuthGateway, FakeCatalog, FakeNotifier, FakeWatchListRepository, InMemoryStore, makeAnime, makeEpisodes, makeTracked,
} from '../../testing/fakes';
import { AnimeDetailPage, EPISODE_ORDER_KEY } from './anime-detail.page';

describe('AnimeDetailPage', () => {
  let fixture: ComponentFixture<AnimeDetailPage>;
  let repo: FakeWatchListRepository;
  let catalog: FakeCatalog;
  let store: InMemoryStore;
  type Internals = Record<string, any>;
  const el = () => fixture.nativeElement as HTMLElement;
  const page = () => fixture.componentInstance as unknown as Internals;

  const setup = async (opts: { order?: string; stored?: ReturnType<typeof makeTracked>[]; anime?: Partial<ReturnType<typeof makeAnime>> } = {}) => {
    catalog = new FakeCatalog();
    store = new InMemoryStore();
    if (opts.order) store.set(EPISODE_ORDER_KEY, opts.order);
    repo = new FakeWatchListRepository();
    repo.stored = opts.stored ?? [];
    catalog.animeById.set(1, makeAnime({ id: 1, ...opts.anime }));
    catalog.episodeLists.set(1, makeEpisodes(5));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AnimeCatalog, useValue: catalog },
        { provide: KeyValueStore, useValue: store },
        { provide: AuthGateway, useValue: new FakeAuthGateway() },
        { provide: WatchListRepository, useValue: repo },
        { provide: Notifier, useValue: new FakeNotifier() },
      ],
    });
    fixture = TestBed.createComponent(AnimeDetailPage);
    fixture.componentRef.setInput('id', '1');
  };

  const signIn = async () => {
    await TestBed.inject(AuthService).register('rei', 'secret12');
    TestBed.tick();
    await TestBed.inject(WatchListService).whenLoaded();
  };

  const render = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  describe('navigation', () => {
    beforeEach(() => setup());

    it('by default goes back to Explorar and shows it in the breadcrumbs', async () => {
      await render();
      const crumb = el().querySelector('app-breadcrumbs a');
      expect(crumb?.textContent).toContain('Explorar');
      expect(crumb?.getAttribute('href')).toBe('/');
      expect(el().textContent).toContain('Volver a Explorar');
      expect(el().querySelector('[aria-current="page"]')?.textContent).toContain('Frieren');
    });

    it('comes back to Mi lista when opened from the watch list', async () => {
      fixture.componentRef.setInput('from', 'mi-lista');
      await render();
      expect(el().querySelector('app-breadcrumbs a')?.getAttribute('href')).toBe('/mi-lista');
      expect(el().textContent).toContain('Volver a Mi lista');
    });

    it('falls back to Explorar for an unknown origin', async () => {
      fixture.componentRef.setInput('from', 'otra-cosa');
      await render();
      expect(el().textContent).toContain('Volver a Explorar');
    });
  });

  describe('episode order', () => {
    const numbers = () => [...el().querySelectorAll('mat-list-item')].map(i => i.id);

    it('is ascending by default', async () => {
      await setup();
      await render();
      expect(numbers()).toEqual(['ep-1', 'ep-2', 'ep-3', 'ep-4', 'ep-5']);
      expect(page()['order']()).toBe('asc');
    });

    it('can be switched to descending, and remembered', async () => {
      await setup();
      await render();
      page()['setOrder']('desc');
      fixture.detectChanges();
      expect(numbers()).toEqual(['ep-5', 'ep-4', 'ep-3', 'ep-2', 'ep-1']);
      expect(store.get(EPISODE_ORDER_KEY, '')).toBe('desc');
    });

    it('starts descending when that was the saved preference', async () => {
      await setup({ order: 'desc' });
      await render();
      expect(numbers()[0]).toBe('ep-5');
    });

    it('ignores a corrupt saved preference', async () => {
      await setup({ order: 'sideways' });
      await render();
      expect(page()['order']()).toBe('asc');
    });

    it('offers both options as a labelled toggle group', async () => {
      await setup();
      await render();
      const labels = [...el().querySelectorAll('mat-button-toggle')].map(t => t.textContent?.trim());
      expect(labels.join(' ')).toContain('Ascendente');
      expect(labels.join(' ')).toContain('Descendente');
    });

    it('keeps the checkboxes tied to the right episode when reversed', async () => {
      await setup({ stored: [makeTracked({ id: 1, watched: [2] })] });
      await signIn();
      await render();
      page()['setOrder']('desc');
      fixture.detectChanges();
      const checked = [...el().querySelectorAll('mat-list-item')].filter(i => i.classList.contains('done')).map(i => i.id);
      expect(checked).toEqual(['ep-2']);
    });
  });

  describe('next episode and resume', () => {
    it('shows when the next episode airs', async () => {
      await setup({ anime: { nextEpisode: { number: 6, airingAt: Math.floor(Date.now() / 1000) + 2 * 86400 + 600 } } });
      await render();
      expect(el().querySelector('.chip.next')?.textContent).toContain('Ep. 6 · en 2 días');
    });

    it('has no next-episode chip for a finished series', async () => {
      await setup();
      await render();
      expect(el().querySelector('.chip.next')).toBeNull();
    });

    it('offers to continue at the first unwatched episode', async () => {
      await setup();
      await render();
      expect(el().textContent).toContain('Continuar: Capítulo 1');
    });

    it('hides "continue" when every released episode is watched', async () => {
      await setup();
      await render();
      expect(page()['resume']()).toBe(1);
      const wl = TestBed.inject(WatchListService);
      wl.setAllWatched(makeAnime({ id: 1 }), 5, true);
      fixture.detectChanges();
      expect(page()['resume']()).toBeNull();
      expect(el().textContent).not.toContain('Continuar:');
    });

    it('goToEpisode scrolls to the episode row', async () => {
      await setup();
      await render();
      const row = el().querySelector<HTMLElement>('#ep-3')!;
      row.scrollIntoView = vi.fn();
      page()['goToEpisode'](3);
      expect(row.scrollIntoView).toHaveBeenCalled();
    });
  });

  describe('status, rating and notes', () => {
    beforeEach(async () => {
      await setup();
      await signIn();
      await render();
    });
    const a = () => makeAnime({ id: 1 });
    const settle = () => new Promise(r => setTimeout(r));

    it('choosing a status adds the anime to the list and saves it', async () => {
      page()['setStatus'](a(), 'completed');
      await settle();
      expect(repo.stored[0]).toMatchObject({ id: 1, status: 'completed' });
    });

    it('stores a rating', async () => {
      page()['setRating'](a(), 9);
      await settle();
      expect(repo.stored[0]).toMatchObject({ id: 1, rating: 9 });
    });

    it('saves notes only when they changed', async () => {
      page()['saveNotes'](a(), '');
      await settle();
      expect(repo.saves).toHaveLength(0);
      page()['saveNotes'](a(), 'Me encantó');
      await settle();
      expect(repo.stored[0]).toMatchObject({ notes: 'Me encantó' });
    });
  });
});
