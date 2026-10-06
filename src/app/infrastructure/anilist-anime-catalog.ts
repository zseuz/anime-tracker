import { Injectable } from '@angular/core';
import { airedEpisodes } from '../domain/episodes';
import { Anime, AnimeFilters, Episode, PAGE_SIZE, Page, SortOrder } from '../domain/models';
import { AnimeCatalog } from '../domain/ports';
import { RequestScheduler } from './request-scheduler';

const ENDPOINT = 'https://graphql.anilist.co';
const MAX_ATTEMPTS = 4;

/** Genres left out of the genre filter. */
const HIDDEN_GENRES = new Set(['Hentai', 'Ecchi']);

export class AniListError extends Error {}

const MEDIA_FIELDS = `
  id title { romaji english } coverImage { large } averageScore format episodes
  status description(asHtml: false) seasonYear genres nextAiringEpisode { episode airingAt }`;

const SEARCH_QUERY = `
  query ($page: Int, $perPage: Int, $search: String, $format: MediaFormat, $genre: String,
         $status: MediaStatus, $minScore: Int, $sort: [MediaSort]) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { currentPage lastPage hasNextPage }
      media(type: ANIME, isAdult: false, search: $search, format: $format, genre: $genre,
            status: $status, averageScore_greater: $minScore, sort: $sort) { ${MEDIA_FIELDS} }
    }
  }`;

const DETAIL_QUERY = `query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} } }`;
const GENRES_QUERY = '{ GenreCollection }';

const SORTS: Record<SortOrder, string> = {
  score: 'SCORE_DESC',
  popularity: 'POPULARITY_DESC',
  trending: 'TRENDING_DESC',
  newest: 'START_DATE_DESC',
};
const STATUS_FILTER: Record<string, string> = {
  airing: 'RELEASING',
  complete: 'FINISHED',
  upcoming: 'NOT_YET_RELEASED',
};
const STATUS_LABEL: Record<string, string> = {
  RELEASING: 'En emisión',
  FINISHED: 'Finalizado',
  NOT_YET_RELEASED: 'Próximamente',
  CANCELLED: 'Cancelado',
  HIATUS: 'En pausa',
};

interface Media {
  id: number;
  title: { romaji: string | null; english: string | null };
  coverImage: { large: string | null };
  averageScore: number | null;
  format: string | null;
  episodes: number | null;
  status: string;
  description: string | null;
  seasonYear: number | null;
  genres: string[] | null;
  nextAiringEpisode: { episode: number; airingAt: number } | null;
}

/** AnimeCatalog backed by the public AniList GraphQL API (no key required). */
@Injectable()
export class AniListAnimeCatalog extends AnimeCatalog {
  private readonly scheduler = new RequestScheduler(700);
  private readonly cache = new Map<string, unknown>();

  async search(f: AnimeFilters): Promise<Page<Anime>> {
    const { Page } = await this.query<{ Page: { pageInfo: Page<Anime>['pagination']; media: Media[] } }>(SEARCH_QUERY, {
      page: f.page || 1,
      perPage: PAGE_SIZE,
      search: f.q?.trim() || undefined,
      format: f.type ? f.type.toUpperCase() : undefined,
      genre: f.genre || undefined,
      status: f.status ? STATUS_FILTER[f.status] : undefined,
      minScore: f.minScore ? f.minScore * 10 : undefined,
      sort: [SORTS[f.orderBy ?? 'score']],
    });
    return { data: Page.media.map(toAnime), pagination: Page.pageInfo };
  }

  async genres(): Promise<string[]> {
    const { GenreCollection } = await this.query<{ GenreCollection: string[] }>(GENRES_QUERY, {});
    return GenreCollection.filter(g => !HIDDEN_GENRES.has(g));
  }

  async anime(id: number): Promise<Anime> {
    return toAnime((await this.media(id)));
  }

  async airedEpisodes(id: number): Promise<number> {
    const m = await this.media(id);
    return airedEpisodes(m.episodes, m.nextAiringEpisode?.episode ?? null);
  }

  /** AniList has no per-episode listing, so released episodes are numbered 1..n. */
  async episodes(id: number): Promise<Episode[]> {
    const count = await this.airedEpisodes(id);
    return Array.from({ length: count }, (_, i) => ({ number: i + 1, title: `Capítulo ${i + 1}`, aired: null }));
  }

  private async media(id: number): Promise<Media> {
    return (await this.query<{ Media: Media }>(DETAIL_QUERY, { id })).Media;
  }

  private query<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const body = JSON.stringify({ query, variables });
    if (this.cache.has(body)) return Promise.resolve(this.cache.get(body) as T);
    return this.scheduler.schedule(async () => {
      const data = await this.post<T>(body);
      this.cache.set(body, data);
      return data;
    });
  }

  private async post<T>(body: string): Promise<T> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body,
      });
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, this.backoff(attempt)));
        continue;
      }
      const json = (await res.json().catch(() => null)) as { data?: T; errors?: { message: string }[] } | null;
      if (!res.ok || !json?.data) {
        throw new AniListError(json?.errors?.[0]?.message ?? `AniList respondió ${res.status}`);
      }
      return json.data;
    }
    throw new AniListError('AniList: demasiadas peticiones, intenta de nuevo en un minuto');
  }

  protected backoff(attempt: number) {
    return 2500 * attempt;
  }
}

function toAnime(m: Media): Anime {
  return {
    id: m.id,
    title: m.title.romaji || m.title.english || `Anime ${m.id}`,
    title_english: m.title.english,
    image: m.coverImage.large ?? '',
    score: m.averageScore === null ? null : m.averageScore / 10,
    type: m.format,
    episodes: m.episodes,
    status: STATUS_LABEL[m.status] ?? m.status,
    synopsis: m.description ? stripHtml(m.description) : null,
    year: m.seasonYear,
    genres: m.genres ?? [],
    nextEpisode: m.nextAiringEpisode
      ? { number: m.nextAiringEpisode.episode, airingAt: m.nextAiringEpisode.airingAt }
      : null,
  };
}

function stripHtml(text: string): string {
  return text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
}
