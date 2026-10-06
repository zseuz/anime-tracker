/** Results per catalogue page. */
export const PAGE_SIZE = 24;

export interface NextEpisode {
  number: number;
  /** Unix timestamp (seconds) of the scheduled release. */
  airingAt: number;
}

export interface Anime {
  id: number;
  title: string;
  title_english?: string | null;
  /** Cover image URL. */
  image: string;
  /** Average score on a 0–10 scale. */
  score: number | null;
  type: string | null;
  /** Total episodes planned/released, when known. */
  episodes: number | null;
  /** Human-readable airing status. */
  status: string;
  synopsis: string | null;
  year: number | null;
  genres: string[];
  /** Next scheduled episode, for series that are still airing. */
  nextEpisode: NextEpisode | null;
}

export interface Episode {
  number: number;
  title: string;
  aired: string | null;
}

export interface Pagination {
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
}

export interface Page<T> {
  data: T[];
  pagination: Pagination;
}

export type SortOrder = 'score' | 'popularity' | 'trending' | 'newest';

export interface AnimeFilters {
  q?: string;
  type?: string;
  genre?: string | null;
  status?: string;
  orderBy?: SortOrder;
  minScore?: number | null;
  page?: number;
}

export type WatchStatus = 'plan' | 'watching' | 'completed' | 'dropped';

export const WATCH_STATUSES: readonly { value: WatchStatus; label: string }[] = [
  { value: 'watching', label: 'Viendo' },
  { value: 'plan', label: 'Pendiente' },
  { value: 'completed', label: 'Completado' },
  { value: 'dropped', label: 'Abandonado' },
];

export const MAX_NOTES_LENGTH = 2000;

/** An anime in a user's watch list. */
export interface TrackedAnime {
  id: number;
  title: string;
  image: string;
  /** User wants to be told about new episodes. */
  following: boolean;
  /** Episode numbers marked as watched. */
  watched: number[];
  /** Episode count seen at the last check. */
  knownEpisodes: number;
  /** New episodes detected and not yet acknowledged. */
  newEpisodes: number;
  status: WatchStatus;
  /** Personal rating 1–10. */
  rating: number | null;
  notes: string;
}

export const AVATAR_IDS = ['violet', 'rose', 'blue', 'green', 'orange', 'teal'] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];
export const DEFAULT_AVATAR: AvatarId = 'violet';

export interface Session {
  username: string;
  avatar: AvatarId;
}

export interface ProfileChanges {
  username?: string;
  avatar?: AvatarId;
}

export const displayTitle = (a: Pick<Anime, 'title' | 'title_english'>): string =>
  a.title_english || a.title;
