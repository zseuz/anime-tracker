import { AnimeFilters, SortOrder } from './models';

export const DEFAULT_ORDER: SortOrder = 'score';
const ORDERS: readonly SortOrder[] = ['score', 'popularity', 'trending', 'newest'];

/** Catalogue filters as plain strings, as they appear in the URL query string. */
export type FilterParams = Record<string, string | undefined>;

export function filtersFromParams(params: FilterParams): AnimeFilters {
  const min = Number(params['minScore']);
  const order = params['orderBy'] as SortOrder;
  return {
    q: params['q'] ?? '',
    type: params['type'] ?? '',
    genre: params['genre'] || null,
    status: params['status'] ?? '',
    orderBy: ORDERS.includes(order) ? order : DEFAULT_ORDER,
    minScore: Number.isInteger(min) && min >= 1 && min <= 10 ? min : null,
  };
}

/** Only non-default values go in the URL, so the default page keeps a clean address. */
export function filtersToParams(f: AnimeFilters): FilterParams {
  return {
    q: f.q?.trim() || undefined,
    type: f.type || undefined,
    genre: f.genre || undefined,
    status: f.status || undefined,
    orderBy: f.orderBy && f.orderBy !== DEFAULT_ORDER ? f.orderBy : undefined,
    minScore: f.minScore ? String(f.minScore) : undefined,
  };
}
