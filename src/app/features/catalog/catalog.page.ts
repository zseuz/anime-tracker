import { Component, DestroyRef, ElementRef, OnInit, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { WatchListService } from '../../application/watch-list.service';
import { filtersFromParams, filtersToParams } from '../../domain/filters';
import { Anime, AnimeFilters } from '../../domain/models';
import { AnimeCatalog } from '../../domain/ports';
import { AnimeCard } from '../../shared/anime-card/anime-card';

export const SEARCH_DEBOUNCE_MS = 400;

@Component({
  selector: 'app-catalog-page',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressBarModule, MatSelectModule, AnimeCard],
  templateUrl: './catalog.page.html',
  styleUrl: './catalog.page.scss',
})
export class CatalogPage implements OnInit {
  private readonly catalog = inject(AnimeCatalog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly watchList = inject(WatchListService);

  protected readonly types = ['tv', 'movie', 'ova', 'ona', 'special', 'music'];
  protected readonly minScores = [6, 7, 8, 9];
  protected readonly skeletons = Array.from({ length: 12 });

  protected readonly genres = signal<string[]>([]);
  protected readonly results = signal<Anime[]>([]);
  protected readonly hasNext = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  /** Form state. The URL is the source of truth: it is rewritten on apply() and read back on navigation. */
  protected filters: AnimeFilters = filtersFromParams({});

  private page = 0;
  /** Guards against slow responses of an outdated query overwriting newer results. */
  private requestId = 0;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private observer?: IntersectionObserver;
  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  constructor() {
    effect(() => {
      const el = this.sentinel()?.nativeElement;
      this.observer?.disconnect();
      if (!el || typeof IntersectionObserver === 'undefined') return;
      this.observer = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) void this.loadMore();
      }, { rootMargin: '400px' });
      this.observer.observe(el);
    });
    this.destroyRef.onDestroy(() => {
      this.observer?.disconnect();
      clearTimeout(this.searchTimer);
    });
  }

  ngOnInit() {
    this.catalog.genres().then(g => this.genres.set(g)).catch(() => undefined);
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.filters = filtersFromParams(params);
      void this.reload();
    });
  }

  /** Typing in the search box searches after a short pause. */
  protected onSearchInput() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.apply(), SEARCH_DEBOUNCE_MS);
  }

  /** Puts the filters in the URL (which triggers the search); re-runs it if the URL did not change. */
  protected async apply() {
    clearTimeout(this.searchTimer);
    const next = filtersToParams(this.filters);
    const current = filtersToParams(filtersFromParams(this.route.snapshot.queryParams));
    if (JSON.stringify(next) === JSON.stringify(current)) return this.reload();
    await this.router.navigate([], { relativeTo: this.route, queryParams: next });
  }

  protected loadMore() {
    if (this.loading() || !this.hasNext() || this.error()) return Promise.resolve();
    return this.load(this.page + 1);
  }

  protected retry() {
    return this.page === 0 ? this.reload() : this.load(this.page + 1);
  }

  private reload() {
    this.results.set([]);
    this.hasNext.set(false);
    this.page = 0;
    return this.load(1);
  }

  private async load(page: number) {
    const id = ++this.requestId;
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.catalog.search({ ...this.filters, page });
      if (id !== this.requestId) return;
      // The API occasionally repeats an entry across pages.
      const merged = new Map([...this.results(), ...result.data].map(a => [a.id, a] as const));
      this.results.set([...merged.values()]);
      this.hasNext.set(result.pagination.hasNextPage);
      this.page = page;
    } catch (e) {
      if (id === this.requestId) this.error.set((e as Error).message);
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }
}
