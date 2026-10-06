import { filtersFromParams, filtersToParams } from './filters';

describe('catalogue filters <-> URL params', () => {
  it('defaults when the URL has no params', () => {
    expect(filtersFromParams({})).toEqual({
      q: '', type: '', genre: null, status: '', orderBy: 'score', minScore: null,
    });
  });

  it('reads every filter', () => {
    expect(filtersFromParams({ q: 'frieren', type: 'tv', genre: 'Drama', status: 'airing', orderBy: 'popularity', minScore: '8' }))
      .toEqual({ q: 'frieren', type: 'tv', genre: 'Drama', status: 'airing', orderBy: 'popularity', minScore: 8 });
  });

  it('ignores invalid values instead of failing', () => {
    const f = filtersFromParams({ orderBy: 'hacked', minScore: 'abc' });
    expect(f.orderBy).toBe('score');
    expect(f.minScore).toBeNull();
    expect(filtersFromParams({ minScore: '99' }).minScore).toBeNull();
    expect(filtersFromParams({ minScore: '7.5' }).minScore).toBeNull();
  });

  it('writes only non-default values', () => {
    expect(filtersToParams({ q: '  ', type: '', genre: null, status: '', orderBy: 'score', minScore: null })).toEqual({
      q: undefined, type: undefined, genre: undefined, status: undefined, orderBy: undefined, minScore: undefined,
    });
    expect(filtersToParams({ q: ' naruto ', type: 'tv', genre: 'Action', status: 'airing', orderBy: 'trending', minScore: 7 })).toEqual({
      q: 'naruto', type: 'tv', genre: 'Action', status: 'airing', orderBy: 'trending', minScore: '7',
    });
  });

  it('round-trips', () => {
    const f = { q: 'x', type: 'movie', genre: 'Drama', status: 'complete', orderBy: 'newest' as const, minScore: 9 };
    expect(filtersFromParams(filtersToParams(f) as Record<string, string>)).toEqual(f);
  });
});
