import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Anime, WatchStatus } from '../domain/models';
import { WatchListRepository } from '../domain/ports';
import * as wl from '../domain/watch-list';
import { AuthService } from './auth.service';
import { EpisodesService } from './episodes.service';
import { NotificationService } from './notification.service';

/** The signed-in user's watch list: server sync + new-episode detection. */
@Injectable({ providedIn: 'root' })
export class WatchListService {
  private readonly auth = inject(AuthService);
  private readonly repo = inject(WatchListRepository);
  private readonly episodes = inject(EpisodesService);
  private readonly notifications = inject(NotificationService);

  private readonly state = signal<wl.WatchList>([]);
  readonly items = this.state.asReadonly();
  readonly checking = signal(false);
  readonly loading = signal(false);
  /** True when the last attempt to load or save the list failed. */
  readonly syncError = signal(false);
  readonly totalNew = computed(() => wl.totalNew(this.state()));

  private loaded: Promise<void> = Promise.resolve();
  /** Saves are chained so they reach the server in the order they were made. */
  private saves: Promise<void> = Promise.resolve();

  constructor() {
    // Keyed on the session, not the username: renaming your profile must not reload the list.
    effect(() => {
      const session = this.auth.sessionId();
      untracked(() => {
        this.state.set([]);
        this.loaded = this.auth.loggedIn() ? this.load(session) : Promise.resolve();
      });
    });
  }

  get(id: number) {
    return wl.find(this.state(), id);
  }

  toggleEpisode(anime: Anime, episode: number, knownTotal: number) {
    this.commit(list => wl.toggleEpisode(wl.addIfMissing(list, anime, knownTotal), anime.id, episode));
  }

  setAllWatched(anime: Anime, total: number, watched: boolean) {
    this.commit(list => wl.setAllWatched(wl.addIfMissing(list, anime, total), anime.id, total, watched));
  }

  toggleFollow(anime: Anime, knownTotal: number) {
    this.commit(list => wl.toggleFollow(wl.addIfMissing(list, anime, knownTotal, 'plan'), anime.id, knownTotal));
  }

  setStatus(anime: Anime, status: WatchStatus, knownTotal = 0) {
    this.commit(list => wl.setStatus(wl.addIfMissing(list, anime, knownTotal, status), anime.id, status));
  }

  setRating(anime: Anime, rating: number | null, knownTotal = 0) {
    this.commit(list => wl.setRating(wl.addIfMissing(list, anime, knownTotal), anime.id, rating));
  }

  setNotes(anime: Anime, notes: string, knownTotal = 0) {
    this.commit(list => wl.setNotes(wl.addIfMissing(list, anime, knownTotal), anime.id, notes));
  }

  acknowledge(id: number) {
    this.commit(list => wl.acknowledge(list, id));
  }

  remove(id: number) {
    this.commit(list => wl.remove(list, id));
  }

  /** Compares each followed series' current episode count with the last known one. */
  async checkForNewEpisodes(): Promise<void> {
    if (this.checking()) return;
    this.checking.set(true);
    try {
      await this.loaded;
      for (const { id } of wl.followed(this.state())) {
        try {
          const count = await this.episodes.count(id);
          const before = this.get(id);
          if (!before) continue; // removed meanwhile
          this.commit(list => wl.applyEpisodeCount(list, id, count));
          if (count > before.knownEpisodes) this.notifications.notifyNewEpisodes(before.title, count - before.knownEpisodes);
        } catch {
          // Transient API failure: this series is retried on the next check.
        }
      }
    } finally {
      this.checking.set(false);
    }
  }

  /** Resolves once the current user's list has been fetched (or failed to). */
  whenLoaded() {
    return this.loaded;
  }

  private async load(session: number) {
    this.loading.set(true);
    this.syncError.set(false);
    try {
      const list = await this.repo.load();
      if (this.auth.sessionId() === session) this.state.set(list);
    } catch {
      if (this.auth.sessionId() === session) this.syncError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private commit(change: (list: wl.WatchList) => wl.WatchList) {
    const next = change(this.state());
    if (next === this.state()) return;
    this.state.set(next);
    if (!this.auth.loggedIn()) return;
    this.saves = this.saves
      .then(() => this.repo.save(next))
      .then(() => this.syncError.set(false))
      .catch(() => this.syncError.set(true));
  }
}
