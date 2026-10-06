import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Anime, TrackedAnime, WATCH_STATUSES, displayTitle } from '../../domain/models';
import { nextEpisodeLabel } from '../../domain/schedule';

@Component({
  selector: 'app-anime-card',
  imports: [RouterLink, MatIconModule],
  templateUrl: './anime-card.html',
  styleUrl: './anime-card.scss',
})
export class AnimeCard {
  readonly anime = input.required<Anime>();
  readonly tracked = input<TrackedAnime | undefined>();
  protected readonly title = displayTitle;

  protected readonly next = computed(() => nextEpisodeLabel(this.anime().nextEpisode));
  protected readonly statusLabel = computed(
    () => WATCH_STATUSES.find(s => s.value === this.tracked()?.status)?.label,
  );
}
