/** Episode numbers 1..total. */
export function episodeRange(total: number): number[] {
  return Array.from({ length: Math.max(0, total) }, (_, i) => i + 1);
}

/**
 * Episodes already released: everything before the next scheduled one,
 * or the full count when nothing is scheduled.
 */
export function airedEpisodes(total: number | null, nextEpisode: number | null): number {
  if (nextEpisode !== null) return Math.max(0, nextEpisode - 1);
  return total ?? 0;
}
