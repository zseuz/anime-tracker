import { AniListAnimeCatalog, AniListError } from './anilist-anime-catalog';

class FastCatalog extends AniListAnimeCatalog {
  protected override backoff() { return 0; }
}

const media = (over: Record<string, unknown> = {}) => ({
  id: 154587,
  title: { romaji: 'Sousou no Frieren', english: 'Frieren: Beyond Journey\'s End' },
  coverImage: { large: 'cover.jpg' },
  averageScore: 91,
  format: 'TV',
  episodes: 28,
  status: 'FINISHED',
  description: 'An elf<br>mage <i>story</i>.',
  seasonYear: 2023,
  genres: ['Adventure', 'Drama'],
  nextAiringEpisode: null,
  ...over,
});

const ok = (data: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data }) } as Response);
const fail = (status: number, body: unknown = {}) =>
  Promise.resolve({ ok: false, status, json: () => Promise.resolve(body) } as Response);

describe('AniListAnimeCatalog', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let catalog: FastCatalog;
  const sent = () => JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string) as {
    query: string; variables: Record<string, unknown>;
  };

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    catalog = new FastCatalog();
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('search', () => {
    const page = { pageInfo: { currentPage: 2, lastPage: 9, hasNextPage: true }, media: [media()] };

    it('maps UI filters to AniList variables', async () => {
      fetchMock.mockReturnValue(ok({ Page: page }));
      await catalog.search({ q: ' frieren ', type: 'tv', genre: 'Drama', status: 'airing', orderBy: 'popularity', minScore: 8, page: 2 });
      expect(sent().variables).toEqual({
        page: 2, perPage: 24, search: 'frieren', format: 'TV', genre: 'Drama',
        status: 'RELEASING', minScore: 80, sort: ['POPULARITY_DESC'],
      });
      expect(fetchMock.mock.calls[0][0]).toBe('https://graphql.anilist.co');
    });

    it('omits empty filters and defaults to best score, page 1', async () => {
      fetchMock.mockReturnValue(ok({ Page: page }));
      await catalog.search({ q: '', type: '', genre: null, status: '', minScore: null });
      const v = sent().variables;
      expect(v['sort']).toEqual(['SCORE_DESC']);
      expect(v['page']).toBe(1);
      for (const key of ['search', 'format', 'genre', 'status', 'minScore']) expect(v[key]).toBeUndefined();
    });

    it('maps results to the domain model and passes pagination through', async () => {
      fetchMock.mockReturnValue(ok({ Page: page }));
      const result = await catalog.search({});
      expect(result.pagination).toEqual({ currentPage: 2, lastPage: 9, hasNextPage: true });
      expect(result.data[0]).toEqual({
        id: 154587,
        title: 'Sousou no Frieren',
        title_english: 'Frieren: Beyond Journey\'s End',
        image: 'cover.jpg',
        score: 9.1,
        type: 'TV',
        episodes: 28,
        status: 'Finalizado',
        synopsis: 'An elf\nmage story.',
        year: 2023,
        genres: ['Adventure', 'Drama'],
        nextEpisode: null,
      });
    });

    it('maps the next scheduled episode', async () => {
      fetchMock.mockReturnValue(ok({ Page: { ...page, media: [media({ nextAiringEpisode: { episode: 8, airingAt: 1_800_000_000 } })] } }));
      const [a] = (await catalog.search({})).data;
      expect(a.nextEpisode).toEqual({ number: 8, airingAt: 1_800_000_000 });
    });

    it('copes with missing optional data', async () => {
      fetchMock.mockReturnValue(ok({ Page: { ...page, media: [media({ averageScore: null, genres: null, description: null, title: { romaji: null, english: 'Only EN' } })] } }));
      const [a] = (await catalog.search({})).data;
      expect(a).toMatchObject({ score: null, genres: [], synopsis: null, title: 'Only EN' });
    });
  });

  it('lists genres without the hidden ones (Hentai, Ecchi)', async () => {
    fetchMock.mockReturnValue(ok({ GenreCollection: ['Action', 'Ecchi', 'Hentai', 'Drama'] }));
    expect(await catalog.genres()).toEqual(['Action', 'Drama']);
  });

  it('fetches one anime by id', async () => {
    fetchMock.mockReturnValue(ok({ Media: media() }));
    expect((await catalog.anime(154587)).id).toBe(154587);
    expect(sent().variables).toEqual({ id: 154587 });
  });

  describe('airedEpisodes / episodes', () => {
    it('is the total for a finished series', async () => {
      fetchMock.mockReturnValue(ok({ Media: media({ episodes: 12 }) }));
      expect(await catalog.airedEpisodes(1)).toBe(12);
    });

    it('is everything before the next scheduled episode for a running series', async () => {
      fetchMock.mockReturnValue(ok({ Media: media({ episodes: null, nextAiringEpisode: { episode: 8 } }) }));
      expect(await catalog.airedEpisodes(1)).toBe(7);
    });

    it('numbers released episodes 1..n', async () => {
      fetchMock.mockReturnValue(ok({ Media: media({ episodes: 3 }) }));
      const eps = await catalog.episodes(1);
      expect(eps.map(e => e.number)).toEqual([1, 2, 3]);
      expect(eps[0]).toEqual({ number: 1, title: 'Capítulo 1', aired: null });
    });
  });

  describe('transport', () => {
    it('caches identical queries', async () => {
      fetchMock.mockReturnValue(ok({ GenreCollection: ['Action'] }));
      await catalog.genres();
      await catalog.genres();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries after a 429 and then succeeds', async () => {
      fetchMock.mockReturnValueOnce(fail(429)).mockReturnValueOnce(ok({ GenreCollection: [] }));
      await expect(catalog.genres()).resolves.toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('gives up after repeated 429s', async () => {
      fetchMock.mockImplementation(() => fail(429));
      await expect(catalog.genres()).rejects.toBeInstanceOf(AniListError);
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it('surfaces GraphQL errors and does not cache failures', async () => {
      fetchMock.mockReturnValueOnce(fail(404, { errors: [{ message: 'Not Found.' }] }))
        .mockReturnValueOnce(ok({ GenreCollection: ['Action'] }));
      await expect(catalog.genres()).rejects.toThrow('Not Found.');
      await expect(catalog.genres()).resolves.toEqual(['Action']);
    });
  });
});
