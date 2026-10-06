import { Crumb } from './breadcrumbs/breadcrumbs';

/**
 * Where the user came from when opening an anime. It travels in the URL (?from=...)
 * so "back" and the breadcrumbs survive a reload and work with the browser buttons.
 */
export const FROM_PARAM = 'from';
export const FROM_WATCH_LIST = 'mi-lista';

const EXPLORE: Crumb = { label: 'Explorar', link: '/' };
const WATCH_LIST: Crumb = { label: 'Mi lista', link: '/mi-lista' };

/** The parent page of an anime, given the `from` query value. Unknown values fall back to Explorar. */
export function parentCrumb(from: string | undefined | null): Crumb {
  return from === FROM_WATCH_LIST ? WATCH_LIST : EXPLORE;
}

/** Router query params to attach to links that open an anime from the watch list. */
export const fromWatchList = { [FROM_PARAM]: FROM_WATCH_LIST };
