import { NextEpisode } from './models';

const HOUR = 3600;
const DAY = 24 * HOUR;

/** "en 3 días", "en 5 h", "en menos de 1 h" or "ya disponible", relative to `nowMs`. */
export function untilAiring(airingAt: number, nowMs = Date.now()): string {
  const diff = airingAt - Math.floor(nowMs / 1000);
  if (diff <= 0) return 'ya disponible';
  if (diff < HOUR) return 'en menos de 1 h';
  if (diff < DAY) return `en ${Math.floor(diff / HOUR)} h`;
  const days = Math.floor(diff / DAY);
  return days === 1 ? 'en 1 día' : `en ${days} días`;
}

/** "Ep. 8 · en 3 días", or null when nothing is scheduled. */
export function nextEpisodeLabel(next: NextEpisode | null, nowMs = Date.now()): string | null {
  return next ? `Ep. ${next.number} · ${untilAiring(next.airingAt, nowMs)}` : null;
}
