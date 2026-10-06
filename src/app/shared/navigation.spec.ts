import { FROM_PARAM, FROM_WATCH_LIST, fromWatchList, parentCrumb } from './navigation';

describe('navigation', () => {
  it('maps the watch-list origin to Mi lista', () => {
    expect(parentCrumb(FROM_WATCH_LIST)).toEqual({ label: 'Mi lista', link: '/mi-lista' });
  });

  it.each([undefined, null, '', 'otra-cosa'])('falls back to Explorar for %j', from => {
    expect(parentCrumb(from)).toEqual({ label: 'Explorar', link: '/' });
  });

  it('builds the query params used by links from the watch list', () => {
    expect(fromWatchList).toEqual({ [FROM_PARAM]: FROM_WATCH_LIST });
  });
});
