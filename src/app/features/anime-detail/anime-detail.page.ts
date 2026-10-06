import { DOCUMENT } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { EpisodesService } from '../../application/episodes.service';
import { WatchListService } from '../../application/watch-list.service';
import { Anime, Episode, MAX_NOTES_LENGTH, WATCH_STATUSES, WatchStatus, displayTitle } from '../../domain/models';
import { EpisodeOrder, sortEpisodes } from '../../domain/episodes';
import { AnimeCatalog, KeyValueStore } from '../../domain/ports';
import { nextEpisodeLabel } from '../../domain/schedule';
import { nextUnwatched } from '../../domain/watch-list';
import { Breadcrumbs, Crumb } from '../../shared/breadcrumbs/breadcrumbs';
import { parentCrumb } from '../../shared/navigation';

export const EPISODE_ORDER_KEY = 'at.episodeOrder';

@Component({
  selector: 'app-anime-detail-page',
  imports: [RouterLink, Breadcrumbs, MatButtonModule, MatButtonToggleModule, MatCheckboxModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatListModule, MatProgressBarModule, MatSelectModule, MatSlideToggleModule],
  templateUrl: './anime-detail.page.html',
  styleUrl: './anime-detail.page.scss',
})
export class AnimeDetailPage {
  /** Route param. */
  readonly id = input.required<string>();
  /** Query param: the page the user came from (see shared/navigation). */
  readonly from = input<string>();

  private readonly catalog = inject(AnimeCatalog);
  private readonly episodesService = inject(EpisodesService);
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(KeyValueStore);
  protected readonly watchList = inject(WatchListService);

  protected readonly statuses = WATCH_STATUSES;
  protected readonly ratings = Array.from({ length: 10 }, (_, i) => 10 - i);
  protected readonly maxNotes = MAX_NOTES_LENGTH;

  protected readonly anime = signal<Anime | null>(null);
  protected readonly episodes = signal<Episode[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadingEpisodes = signal(false);
  protected readonly error = signal('');

  protected readonly tracked = computed(() => this.watchList.get(+this.id()));
  protected readonly total = computed(() => this.episodes().length);
  protected readonly watchedCount = computed(() => this.tracked()?.watched.length ?? 0);
  protected readonly progress = computed(() => (this.total() ? (this.watchedCount() / this.total()) * 100 : 0));
  protected readonly title = displayTitle;

  protected readonly parent = computed(() => parentCrumb(this.from()));
  protected readonly crumbs = computed<Crumb[]>(() => {
    const a = this.anime();
    return [this.parent(), { label: a ? displayTitle(a) : 'Cargando…' }];
  });

  /** First released episode the user has not watched yet (null when up to date). */
  protected readonly resume = computed(() =>
    nextUnwatched({ watched: this.tracked()?.watched ?? [], knownEpisodes: this.total() }),
  );
  protected readonly next = computed(() => nextEpisodeLabel(this.anime()?.nextEpisode ?? null));

  /** Ascending or descending; remembered because long series have hundreds of episodes. */
  protected readonly order = signal<EpisodeOrder>(this.store.get<EpisodeOrder>(EPISODE_ORDER_KEY, 'asc') === 'desc' ? 'desc' : 'asc');
  protected readonly orderedEpisodes = computed(() => sortEpisodes(this.episodes(), this.order()));

  protected setOrder(order: EpisodeOrder) {
    this.order.set(order);
    this.store.set(EPISODE_ORDER_KEY, order);
  }

  constructor() {
    effect(() => {
      void this.load(+this.id());
    });
  }

  protected isWatched(episodeNumber: number) {
    return !!this.tracked()?.watched.includes(episodeNumber);
  }

  protected setStatus(a: Anime, status: WatchStatus) {
    this.watchList.setStatus(a, status, this.total());
  }

  protected setRating(a: Anime, rating: number | null) {
    this.watchList.setRating(a, rating, this.total());
  }

  protected saveNotes(a: Anime, notes: string) {
    if (notes !== (this.tracked()?.notes ?? '')) this.watchList.setNotes(a, notes, this.total());
  }

  /** Scrolls to an episode and focuses its checkbox. */
  protected goToEpisode(n: number) {
    const row = this.document.getElementById(`ep-${n}`);
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  }

  private async load(id: number) {
    this.loading.set(true);
    this.error.set('');
    this.episodes.set([]);
    try {
      this.anime.set(await this.catalog.anime(id));
      this.watchList.acknowledge(id);
    } catch (e) {
      this.error.set((e as Error).message);
    }
    this.loading.set(false);

    this.loadingEpisodes.set(true);
    try {
      this.episodes.set(await this.episodesService.list(id));
    } catch (e) {
      this.error.set((e as Error).message);
    }
    this.loadingEpisodes.set(false);

    // Arriving from "Siguiente: Capítulo N" in Mi lista (#ep-N): the rows only exist now.
    const target = /^ep-(\d+)$/.exec(this.route.snapshot.fragment ?? '');
    if (target) setTimeout(() => this.goToEpisode(+target[1]), 0);
  }
}
