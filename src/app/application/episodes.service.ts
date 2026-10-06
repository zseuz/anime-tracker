import { Injectable, inject } from '@angular/core';
import { Episode } from '../domain/models';
import { AnimeCatalog } from '../domain/ports';

@Injectable({ providedIn: 'root' })
export class EpisodesService {
  private readonly catalog = inject(AnimeCatalog);

  /** Released episodes of a series. */
  list(id: number): Promise<Episode[]> {
    return this.catalog.episodes(id);
  }

  /** Number of released episodes. */
  count(id: number): Promise<number> {
    return this.catalog.airedEpisodes(id);
  }
}
