import { makeAnime } from '../testing/fakes';
import * as wl from './watch-list';

const anime = makeAnime({ id: 7 });
const withAnime = (known = 0, status: Parameters<typeof wl.addIfMissing>[3] = 'watching') =>
  wl.addIfMissing([], anime, known, status);

describe('watch-list', () => {
  describe('addIfMissing', () => {
    it('adds a new entry with defaults, preferring the English title', () => {
      const [t] = withAnime(12);
      expect(t).toEqual({
        id: 7, title: anime.title_english, image: 'cover.jpg',
        following: false, watched: [], knownEpisodes: 12, newEpisodes: 0,
        status: 'watching', rating: null, notes: '',
      });
    });
    it('falls back to the original title', () => {
      const [t] = wl.addIfMissing([], makeAnime({ title_english: null }));
      expect(t.title).toBe('Sousou no Frieren');
    });
    it('accepts an initial status', () => expect(withAnime(0, 'plan')[0].status).toBe('plan'));
    it('returns the same list when already present', () => {
      const list = withAnime();
      expect(wl.addIfMissing(list, anime)).toBe(list);
    });
  });

  it('remove drops only the given id', () => {
    const list = wl.addIfMissing(withAnime(), makeAnime({ id: 8 }));
    expect(wl.remove(list, 7).map(t => t.id)).toEqual([8]);
  });

  describe('toggleEpisode', () => {
    it('marks then unmarks an episode', () => {
      const on = wl.toggleEpisode(withAnime(), 7, 3);
      expect(on[0].watched).toEqual([3]);
      expect(wl.toggleEpisode(on, 7, 3)[0].watched).toEqual([]);
    });
    it('does not mutate the input', () => {
      const list = withAnime();
      wl.toggleEpisode(list, 7, 1);
      expect(list[0].watched).toEqual([]);
    });
    it('moves a pending or dropped anime to "watching" when an episode is marked', () => {
      expect(wl.toggleEpisode(withAnime(0, 'plan'), 7, 1)[0].status).toBe('watching');
      expect(wl.toggleEpisode(withAnime(0, 'dropped'), 7, 1)[0].status).toBe('watching');
    });
    it('keeps "completed" when an episode is marked', () => {
      expect(wl.toggleEpisode(withAnime(0, 'completed'), 7, 1)[0].status).toBe('completed');
    });
    it('does not touch the status when an episode is unmarked', () => {
      const watching = wl.toggleEpisode(withAnime(0, 'plan'), 7, 1); // plan -> watching
      const dropped = wl.setStatus(watching, 7, 'dropped');
      expect(wl.toggleEpisode(dropped, 7, 1)[0].status).toBe('dropped'); // unmarking: no resume
    });
  });

  describe('setAllWatched', () => {
    it('marks 1..total', () => expect(wl.setAllWatched(withAnime(), 7, 3, true)[0].watched).toEqual([1, 2, 3]));
    it('clears everything', () => {
      const all = wl.setAllWatched(withAnime(), 7, 3, true);
      expect(wl.setAllWatched(all, 7, 3, false)[0].watched).toEqual([]);
    });
  });

  describe('toggleFollow', () => {
    it('follows and snapshots the current episode count', () => {
      const [t] = wl.toggleFollow(withAnime(), 7, 10);
      expect(t.following).toBe(true);
      expect(t.knownEpisodes).toBe(10);
    });
    it('keeps the previous count when the new one is unknown (0)', () => {
      expect(wl.toggleFollow(withAnime(5), 7, 0)[0].knownEpisodes).toBe(5);
    });
    it('clears pending new episodes', () => {
      let list = wl.toggleFollow(withAnime(), 7, 10);
      list = wl.applyEpisodeCount(list, 7, 12);
      expect(wl.toggleFollow(list, 7, 12)[0].newEpisodes).toBe(0);
    });
  });

  describe('setStatus', () => {
    it('changes the status', () => expect(wl.setStatus(withAnime(), 7, 'completed')[0].status).toBe('completed'));
    it('returns the same list when unchanged', () => {
      const list = withAnime();
      expect(wl.setStatus(list, 7, 'watching')).toBe(list);
    });
  });

  describe('setRating', () => {
    it('sets, rounds and clamps to 1–10', () => {
      expect(wl.setRating(withAnime(), 7, 8)[0].rating).toBe(8);
      expect(wl.setRating(withAnime(), 7, 7.6)[0].rating).toBe(8);
      expect(wl.setRating(withAnime(), 7, 99)[0].rating).toBe(10);
      expect(wl.setRating(withAnime(), 7, -3)[0].rating).toBe(1);
    });
    it('clears with null', () => {
      expect(wl.setRating(wl.setRating(withAnime(), 7, 5), 7, null)[0].rating).toBeNull();
    });
    it('is a no-op for an unchanged value', () => {
      const list = withAnime();
      expect(wl.setRating(list, 7, null)).toBe(list);
    });
  });

  describe('setNotes', () => {
    it('stores notes, truncated to the limit', () => {
      expect(wl.setNotes(withAnime(), 7, 'hola')[0].notes).toBe('hola');
      expect(wl.setNotes(withAnime(), 7, 'x'.repeat(wl.MAX_NOTES + 50))[0].notes).toHaveLength(wl.MAX_NOTES);
    });
    it('is a no-op for unchanged notes', () => {
      const list = withAnime();
      expect(wl.setNotes(list, 7, '')).toBe(list);
    });
  });

  describe('applyEpisodeCount', () => {
    it('flags growth as new episodes', () => {
      const [t] = wl.applyEpisodeCount(withAnime(10), 7, 13);
      expect(t).toMatchObject({ knownEpisodes: 13, newEpisodes: 3 });
    });
    it('accumulates across checks', () => {
      let list = wl.applyEpisodeCount(withAnime(10), 7, 11);
      list = wl.applyEpisodeCount(list, 7, 12);
      expect(list[0].newEpisodes).toBe(2);
    });
    it('ignores equal or lower counts', () => {
      const list = withAnime(10);
      expect(wl.applyEpisodeCount(list, 7, 10)).toBe(list);
      expect(wl.applyEpisodeCount(list, 7, 8)).toBe(list);
    });
  });

  describe('acknowledge', () => {
    it('resets the new-episode counter', () => {
      const list = wl.applyEpisodeCount(withAnime(1), 7, 4);
      expect(wl.acknowledge(list, 7)[0].newEpisodes).toBe(0);
    });
    it('returns the same list when nothing is pending', () => {
      const list = withAnime();
      expect(wl.acknowledge(list, 7)).toBe(list);
    });
  });

  describe('totalNew / followed', () => {
    it('only counts followed series', () => {
      let list = wl.addIfMissing(withAnime(1), makeAnime({ id: 8 }), 1);
      list = wl.applyEpisodeCount(wl.applyEpisodeCount(list, 7, 3), 8, 2);
      list = wl.toggleFollow(list, 8, 2); // follow 8 only (resets its new count)
      list = wl.applyEpisodeCount(list, 8, 5);
      expect(wl.totalNew(list)).toBe(3);
      expect(wl.followed(list).map(t => t.id)).toEqual([8]);
    });
  });

  describe('nextUnwatched', () => {
    it('is the first released episode not watched', () => {
      expect(wl.nextUnwatched({ watched: [1, 2, 4], knownEpisodes: 6 })).toBe(3);
      expect(wl.nextUnwatched({ watched: [], knownEpisodes: 3 })).toBe(1);
    });
    it('is null when up to date or nothing is released', () => {
      expect(wl.nextUnwatched({ watched: [1, 2, 3], knownEpisodes: 3 })).toBeNull();
      expect(wl.nextUnwatched({ watched: [], knownEpisodes: 0 })).toBeNull();
    });
    it('accepts an explicit released count', () => {
      expect(wl.nextUnwatched({ watched: [1], knownEpisodes: 0 }, 5)).toBe(2);
    });
  });

  describe('byStatus', () => {
    it('filters by status, or returns everything for "all"', () => {
      const list = wl.setStatus(wl.addIfMissing(withAnime(), makeAnime({ id: 8 })), 8, 'completed');
      expect(wl.byStatus(list, 'completed').map(t => t.id)).toEqual([8]);
      expect(wl.byStatus(list, 'all')).toHaveLength(2);
    });
  });
});
