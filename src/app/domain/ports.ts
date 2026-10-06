import { Anime, AnimeFilters, Episode, Page, Session, TrackedAnime } from './models';

/** Read access to an anime catalogue. */
export abstract class AnimeCatalog {
  abstract search(filters: AnimeFilters): Promise<Page<Anime>>;
  abstract genres(): Promise<string[]>;
  abstract anime(id: number): Promise<Anime>;
  /** Episodes already released (numbered 1..n). */
  abstract episodes(id: number): Promise<Episode[]>;
  /** Cheap count of released episodes, used to detect new ones. */
  abstract airedEpisodes(id: number): Promise<number>;
}

/** Minimal local key/value storage (session hint, preferences). */
export abstract class KeyValueStore {
  abstract get<T>(key: string, fallback: T): T;
  abstract set<T>(key: string, value: T): void;
  abstract remove(key: string): void;
}

/** Account operations against the backend. The session itself lives in an HttpOnly cookie. */
export abstract class AuthGateway {
  abstract register(username: string, password: string): Promise<Session>;
  abstract login(username: string, password: string): Promise<Session>;
  abstract logout(): Promise<void>;
  /** The signed-in user; rejects with AuthError (status 401) when there is no valid session. */
  abstract me(): Promise<Session>;
}

/** Persistence of the signed-in user's watch list. */
export abstract class WatchListRepository {
  abstract load(): Promise<TrackedAnime[]>;
  abstract save(list: readonly TrackedAnime[]): Promise<void>;
}

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

/** System notifications (browser Notification API). */
export abstract class Notifier {
  abstract permission(): NotificationPermissionState;
  abstract requestPermission(): Promise<NotificationPermissionState>;
  abstract notify(title: string, body: string): void;
}
