/** Episode numbers 1..total. */
export function episodeRange(total: number): number[] {
  return Array.from({ length: Math.max(0, total) }, (_, i) => i + 1);
}

export type EpisodeOrder = 'asc' | 'desc';

/** A copy of the episodes ordered by number (the input is never mutated). */
export function sortEpisodes<T extends { number: number }>(episodes: readonly T[], order: EpisodeOrder): T[] {
  const sorted = [...episodes].sort((a, b) => a.number - b.number);
  return order === 'desc' ? sorted.reverse() : sorted;
}

/**
 * Episodes already released: everything before the next scheduled one,
 * or the full count when nothing is scheduled.
 */
export function airedEpisodes(total: number | null, nextEpisode: number | null): number {
  if (nextEpisode !== null) return Math.max(0, nextEpisode - 1);
  return total ?? 0;
}
