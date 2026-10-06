import { airedEpisodes, episodeRange, sortEpisodes } from './episodes';

describe('sortEpisodes', () => {
  const eps = [{ number: 2 }, { number: 3 }, { number: 1 }];
  it('orders ascending', () => expect(sortEpisodes(eps, 'asc').map(e => e.number)).toEqual([1, 2, 3]));
  it('orders descending', () => expect(sortEpisodes(eps, 'desc').map(e => e.number)).toEqual([3, 2, 1]));
  it('does not mutate the input', () => {
    sortEpisodes(eps, 'desc');
    expect(eps.map(e => e.number)).toEqual([2, 3, 1]);
  });
  it('handles an empty list', () => expect(sortEpisodes([], 'desc')).toEqual([]));
});

describe('episodeRange', () => {
  it('builds 1..n', () => expect(episodeRange(3)).toEqual([1, 2, 3]));
  it('is empty for 0 or negatives', () => {
    expect(episodeRange(0)).toEqual([]);
    expect(episodeRange(-4)).toEqual([]);
  });
});

describe('airedEpisodes', () => {
  it('is everything before the next scheduled episode', () => {
    expect(airedEpisodes(24, 8)).toBe(7);
    expect(airedEpisodes(null, 3)).toBe(2);
  });
  it('is the full count when nothing is scheduled', () => expect(airedEpisodes(12, null)).toBe(12));
  it('is 0 when nothing is known', () => expect(airedEpisodes(null, null)).toBe(0));
  it('never goes negative', () => expect(airedEpisodes(12, 0)).toBe(0));
});
