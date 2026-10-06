import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test as base } from '@playwright/test';

const cover = (hue: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="300" height="450" fill="hsl(${hue} 60% 45%)"/></svg>`,
  )}`;

interface FakeAnime { id: number; romaji: string; english: string; format: string; genres: string[]; score: number; episodes: number | null; next?: { episode: number; airingAt: number } }

const NOW = Math.floor(Date.now() / 1000);
export const ANIME: FakeAnime[] = [
  { id: 1, romaji: 'Sousou no Frieren', english: 'Frieren: Beyond Journey\'s End', format: 'TV', genres: ['Adventure', 'Drama'], score: 91, episodes: null, next: { episode: 6, airingAt: NOW + 3 * 86400 + 600 } },
  { id: 2, romaji: 'Fullmetal Alchemist: Brotherhood', english: 'Fullmetal Alchemist: Brotherhood', format: 'TV', genres: ['Action', 'Drama'], score: 91, episodes: 5 },
  { id: 3, romaji: 'Kimi no Na wa.', english: 'Your Name.', format: 'MOVIE', genres: ['Drama', 'Romance'], score: 88, episodes: 1 },
  { id: 4, romaji: 'Gintama', english: 'Gintama', format: 'TV', genres: ['Comedy', 'Action'], score: 87, episodes: 5 },
];

const media = (a: FakeAnime) => ({
  id: a.id,
  title: { romaji: a.romaji, english: a.english },
  coverImage: { large: cover(a.id * 70) },
  averageScore: a.score,
  format: a.format,
  episodes: a.episodes,
  status: a.next ? 'RELEASING' : 'FINISHED',
  description: `Sinopsis de ${a.english}.<br>Segunda línea.`,
  seasonYear: 2023,
  genres: a.genres,
  nextAiringEpisode: a.next ?? null,
});

/** Pages of 3 results so that "load more" has something to do. */
const PER_PAGE = 3;

/** Replaces AniList with deterministic data and blocks every other external request. */
export async function mockExternal(page: Page) {
  await page.route('https://graphql.anilist.co/**', async route => {
    const { query, variables } = route.request().postDataJSON() as { query: string; variables: Record<string, any> };
    let data: unknown;
    if (query.includes('GenreCollection')) {
      data = { GenreCollection: ['Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Romance'] };
    } else if (query.includes('Page(')) {
      let list = ANIME.filter(a =>
        (!variables['search'] || (a.romaji + a.english).toLowerCase().includes(String(variables['search']).toLowerCase())) &&
        (!variables['format'] || a.format === variables['format']) &&
        (!variables['genre'] || a.genres.includes(variables['genre'])));
      const current = variables['page'] ?? 1;
      const last = Math.max(1, Math.ceil(list.length / PER_PAGE));
      list = list.slice((current - 1) * PER_PAGE, current * PER_PAGE);
      data = { Page: { pageInfo: { currentPage: current, lastPage: last, hasNextPage: current < last }, media: list.map(media) } };
    } else {
      const found = ANIME.find(a => a.id === variables['id']);
      data = { Media: found ? media(found) : null };
      if (!found) return route.fulfill({ status: 404, json: { errors: [{ message: 'Not Found.' }] } });
    }
    await route.fulfill({ json: { data } });
  });
  // Fonts and any other third-party host: not needed for the tests.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ status: 200, body: '', contentType: 'text/css' }));
}

let counter = 0;
export const uniqueUser = () => `e2e${Date.now().toString(36)}${counter++}`;
export const PASSWORD = 'Clave1234';

export async function register(page: Page, username = uniqueUser(), password = PASSWORD) {
  await page.goto('/login');
  await page.getByRole('tab', { name: 'Crear cuenta' }).click();
  await page.getByLabel('Usuario').fill(username);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Explorar' })).toBeVisible();
  return username;
}

/** Fails the test on serious or critical accessibility violations. */
export async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const blocking = violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  expect(
    blocking.map(v => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`),
  ).toEqual([]);
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await mockExternal(page);
    await use(page);
  },
});
export { expect };
