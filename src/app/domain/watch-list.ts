import { Anime, MAX_NOTES_LENGTH, TrackedAnime, WatchStatus, displayTitle } from './models';
import { episodeRange } from './episodes';

/**
 * Pure, immutable operations over a watch list. No framework, no I/O:
 * the application layer decides when to persist the result.
 */
export type WatchList = readonly TrackedAnime[];

export const find = (list: WatchList, id: number) => list.find(t => t.id === id);

/** Applies `fn` to one entry; returns the same list instance when nothing changed. */
const patch = (list: WatchList, id: number, fn: (t: TrackedAnime) => TrackedAnime): WatchList => {
  const index = list.findIndex(t => t.id === id);
  if (index === -1) return list;
  const updated = fn(list[index]);
  return updated === list[index] ? list : list.map((t, i) => (i === index ? updated : t));
};

export function addIfMissing(
  list: WatchList,
  anime: Anime,
  knownEpisodes = 0,
  status: WatchStatus = 'watching',
): WatchList {
  if (find(list, anime.id)) return list;
  return [
    ...list,
    {
      id: anime.id,
      title: displayTitle(anime),
      image: anime.image,
      following: false,
      watched: [],
      knownEpisodes,
      newEpisodes: 0,
      status,
      rating: null,
      notes: '',
    },
  ];
}

export const remove = (list: WatchList, id: number): WatchList => list.filter(t => t.id !== id);

/** Watching an episode of something "pending" or "dropped" means you are watching it now. */
const resumeIfIdle = (t: TrackedAnime): WatchStatus =>
  t.status === 'plan' || t.status === 'dropped' ? 'watching' : t.status;

export function toggleEpisode(list: WatchList, id: number, episode: number): WatchList {
  return patch(list, id, t => {
    const marking = !t.watched.includes(episode);
    return {
      ...t,
      watched: marking ? [...t.watched, episode] : t.watched.filter(e => e !== episode),
      status: marking ? resumeIfIdle(t) : t.status,
    };
  });
}

export function setAllWatched(list: WatchList, id: number, total: number, watched: boolean): WatchList {
  return patch(list, id, t => ({ ...t, watched: watched ? episodeRange(total) : [] }));
}

export function toggleFollow(list: WatchList, id: number, currentTotal: number): WatchList {
  return patch(list, id, t => ({
    ...t,
    following: !t.following,
    knownEpisodes: currentTotal || t.knownEpisodes,
    newEpisodes: 0,
  }));
}

export const setStatus = (list: WatchList, id: number, status: WatchStatus): WatchList =>
  patch(list, id, t => (t.status === status ? t : { ...t, status }));

/** `rating` of null clears it; values are clamped to whole numbers 1–10. */
export function setRating(list: WatchList, id: number, rating: number | null): WatchList {
  const value = rating === null ? null : Math.min(10, Math.max(1, Math.round(rating)));
  return patch(list, id, t => (t.rating === value ? t : { ...t, rating: value }));
}

export const MAX_NOTES = MAX_NOTES_LENGTH;

export const setNotes = (list: WatchList, id: number, notes: string): WatchList => {
  const value = notes.slice(0, MAX_NOTES);
  return patch(list, id, t => (t.notes === value ? t : { ...t, notes: value }));
};

export const acknowledge = (list: WatchList, id: number): WatchList =>
  patch(list, id, t => (t.newEpisodes ? { ...t, newEpisodes: 0 } : t));

/** Records a fresh episode count; only growth counts as "new". */
export function applyEpisodeCount(list: WatchList, id: number, count: number): WatchList {
  return patch(list, id, t =>
    count > t.knownEpisodes
      ? { ...t, knownEpisodes: count, newEpisodes: t.newEpisodes + (count - t.knownEpisodes) }
      : t,
  );
}

export const totalNew = (list: WatchList): number =>
  list.filter(t => t.following).reduce((n, t) => n + t.newEpisodes, 0);

export const followed = (list: WatchList): WatchList => list.filter(t => t.following);

/** First released episode not yet watched, or null when the user is up to date. */
export function nextUnwatched(t: Pick<TrackedAnime, 'watched' | 'knownEpisodes'>, released = t.knownEpisodes): number | null {
  const seen = new Set(t.watched);
  for (let n = 1; n <= released; n++) if (!seen.has(n)) return n;
  return null;
}

export const byStatus = (list: WatchList, status: WatchStatus | 'all'): WatchList =>
  status === 'all' ? list : list.filter(t => t.status === status);
