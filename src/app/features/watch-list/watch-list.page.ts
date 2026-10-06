import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { WatchListService } from '../../application/watch-list.service';
import { TrackedAnime, WATCH_STATUSES, WatchStatus } from '../../domain/models';
import { byStatus, nextUnwatched } from '../../domain/watch-list';
import { Breadcrumbs, Crumb } from '../../shared/breadcrumbs/breadcrumbs';
import { fromWatchList } from '../../shared/navigation';

type Filter = WatchStatus | 'all';

@Component({
  selector: 'app-watch-list-page',
  imports: [RouterLink, Breadcrumbs, MatButtonModule, MatButtonToggleModule, MatIconModule, MatProgressBarModule],
  templateUrl: './watch-list.page.html',
  styleUrl: './watch-list.page.scss',
})
export class WatchListPage implements OnInit {
  protected readonly watchList = inject(WatchListService);
  /** Marks links to an anime so its page knows to come back here. */
  protected readonly fromWatchList = fromWatchList;
  protected readonly crumbs: Crumb[] = [{ label: 'Explorar', link: '/' }, { label: 'Mi lista' }];

  protected readonly tabs: readonly { value: Filter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    ...WATCH_STATUSES,
  ];
  protected readonly filter = signal<Filter>('all');
  protected readonly visible = computed(() => byStatus(this.watchList.items(), this.filter()));

  ngOnInit() {
    return this.watchList.checkForNewEpisodes();
  }

  protected count(filter: Filter) {
    return byStatus(this.watchList.items(), filter).length;
  }

  protected next(t: TrackedAnime) {
    return nextUnwatched(t);
  }
}
