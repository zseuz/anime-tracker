/**
 * Generates the README screenshots (docs/screenshots/*.png) from the running app.
 *
 * Needs the web app on :4200 and the API reachable. AniList is replaced by demo data with
 * generated posters (no copyrighted artwork), and a throwaway "demo" user is created.
 *
 *   node scripts/screenshots.mjs
 *   API_REWRITE=http://localhost:3100 node scripts/screenshots.mjs   # use an API on another port
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'screenshots');
mkdirSync(out, { recursive: true });
const BASE = process.env.WEB_URL ?? 'http://localhost:4200';
const API_REWRITE = process.env.API_REWRITE;
export const DEMO_USER = process.env.DEMO_USER ?? `demo${Date.now().toString(36)}`;

// ---------------------------------------------------------------- demo data
const NOW = Math.floor(Date.now() / 1000);
const HUES = [265, 330, 200, 150, 30, 175, 290, 350, 220, 95, 15, 250];
const TITLES = [
  ['Estrella del Alba', 'Dawn Star', 'TV', ['Adventure', 'Fantasy'], 91, 24],
  ['Crónicas del Mar Hueco', 'Hollow Sea Chronicles', 'TV', ['Drama', 'Mystery'], 89, 12],
  ['Ciudad de Neón', 'Neon City', 'TV', ['Action', 'Sci-Fi'], 88, 26],
  ['La Última Estación', 'The Last Station', 'MOVIE', ['Drama', 'Romance'], 87, 1],
  ['Cocina de Medianoche', 'Midnight Kitchen', 'TV', ['Comedy', 'Slice of Life'], 86, 13],
  ['Guardianes del Eco', 'Echo Guardians', 'TV', ['Action', 'Fantasy'], 85, 25],
  ['Rutas de Papel', 'Paper Routes', 'ONA', ['Slice of Life'], 84, 8],
  ['Tormenta Escarlata', 'Scarlet Storm', 'TV', ['Action', 'Drama'], 83, 22],
  ['Jardín de Cristal', 'Glass Garden', 'OVA', ['Fantasy', 'Romance'], 82, 4],
  ['Orquesta del Cielo', 'Sky Orchestra', 'TV', ['Music', 'Drama'], 81, 12],
  ['Detective Luna', 'Detective Luna', 'TV', ['Mystery', 'Comedy'], 80, 24],
  ['Mecánica del Destino', 'Mechanics of Fate', 'TV', ['Mecha', 'Sci-Fi'], 79, 26],
].map(([romaji, english, format, genres, score, episodes], i) => ({
  id: i + 1, romaji, english, format, genres, score, episodes: i === 0 ? null : episodes,
  next: i === 0 ? { episode: 9, airingAt: NOW + 2 * 86400 + 3600 } : undefined, hue: HUES[i],
}));

const posterSvg = (title, hue) => (
  `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 70% 55%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360} 70% 28%)"/></linearGradient></defs>
    <rect width="300" height="450" fill="url(#g)"/>
    <circle cx="220" cy="120" r="70" fill="hsl(${hue} 80% 75%)" opacity=".35"/>
    <circle cx="80" cy="330" r="110" fill="hsl(${hue} 80% 20%)" opacity=".35"/>
    <text x="24" y="392" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="700" fill="#fff">${title.replace(/&/g, '&amp;')}</text>
  </svg>`);

/** Short URLs (the API stores cover URLs, max 500 chars) that the mock serves as generated SVGs. */
const POSTER_HOST = 'https://s4.anilist.co/demo/';
const posterUrl = a => `${POSTER_HOST}${a.id}.svg`;

const media = a => ({
  id: a.id,
  title: { romaji: a.romaji, english: a.english },
  coverImage: { large: posterUrl(a) },
  averageScore: a.score,
  format: a.format,
  episodes: a.episodes,
  status: a.next ? 'RELEASING' : 'FINISHED',
  description: `Serie de demostración «${a.english}». Una historia inventada para ilustrar la documentación del proyecto.<br>Los carteles son imágenes generadas.`,
  seasonYear: 2025,
  genres: a.genres,
  nextAiringEpisode: a.next ? { episode: a.next.episode, airingAt: a.next.airingAt } : null,
});

async function mock(page) {
  await page.route('https://graphql.anilist.co/**', async route => {
    const { query, variables } = route.request().postDataJSON();
    if (query.includes('GenreCollection')) {
      return route.fulfill({ json: { data: { GenreCollection: ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Mystery', 'Romance', 'Sci-Fi'] } } });
    }
    if (query.includes('Page(')) {
      const list = TITLES.filter(a => !variables.genre || a.genres.includes(variables.genre));
      return route.fulfill({ json: { data: { Page: {
        pageInfo: { currentPage: 1, lastPage: 1, hasNextPage: false }, media: list.map(media),
      } } } });
    }
    const found = TITLES.find(a => a.id === variables.id);
    return route.fulfill({ json: { data: { Media: found ? media(found) : null } } });
  });
  await page.route(`${POSTER_HOST}**`, route => {
    const id = Number(new URL(route.request().url()).pathname.match(/(\d+)\.svg$/)?.[1]);
    const a = TITLES.find(t => t.id === id);
    return route.fulfill({ contentType: 'image/svg+xml', body: posterSvg(a?.english ?? '?', a?.hue ?? 200) });
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.continue());
  if (API_REWRITE) {
    await page.route('http://localhost:3000/**', route =>
      route.continue({ url: route.request().url().replace('http://localhost:3000', API_REWRITE) }));
  }
}

// ---------------------------------------------------------------- run
const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? 'msedge' });

async function context(viewport, colorScheme = 'dark') {
  const ctx = await browser.newContext({ viewport, colorScheme, locale: 'es-ES', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await mock(page);
  return { ctx, page };
}
const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(out, `${name}.png`), ...opts });
const settle = page => page.waitForTimeout(900);

const desktop = { width: 1280, height: 800 };
const { ctx, page } = await context(desktop);

// Login
await page.goto(BASE + '/login');
await page.getByRole('button', { name: 'Entrar' }).waitFor();
await settle(page);
await shot(page, 'login');

// Register
await page.getByRole('tab', { name: 'Crear cuenta' }).click();
await page.getByLabel('Usuario').fill(DEMO_USER);
await page.locator('input[name=password]').fill('Clave1234');
await page.getByRole('button', { name: 'Crear cuenta' }).click();
await page.getByRole('heading', { name: 'Explorar' }).waitFor();
await page.locator('app-anime-card').first().waitFor();

// Seed a believable list through the UI
await page.locator('app-anime-card', { hasText: 'Dawn Star' }).click();
await page.getByRole('heading', { name: 'Dawn Star' }).waitFor();
for (const n of [1, 2, 3, 4, 5, 6]) await page.getByRole('checkbox', { name: new RegExp(`Capítulo ${n}$`) }).check();
await page.getByRole('switch', { name: 'Avisarme de nuevos capítulos' }).check();
await page.getByRole('combobox', { name: 'Mi nota' }).click();
await page.getByRole('option', { name: '9 / 10' }).click();
await page.getByRole('textbox', { name: 'Mis notas' }).fill('Banda sonora increíble. Voy por el capítulo 7.');
await page.getByRole('textbox', { name: 'Mis notas' }).blur();
await settle(page);

for (const [title, count, status] of [['Hollow Sea', 12, 'Completado'], ['Neon City', 8, 'Viendo'], ['Sky Orchestra', 0, 'Pendiente']]) {
  await page.goto(BASE + '/');
  await page.locator('app-anime-card', { hasText: title }).click();
  await page.getByRole('combobox', { name: 'Estado' }).waitFor();
  for (let n = 1; n <= count; n++) await page.getByRole('checkbox', { name: new RegExp(`Capítulo ${n}$`) }).check();
  await page.getByRole('combobox', { name: 'Estado' }).click();
  await page.getByRole('option', { name: status }).click();
}
await page.waitForTimeout(800);

// Catalogue
await page.goto(BASE + '/');
await page.locator('app-anime-card').nth(5).waitFor();
await settle(page);
await shot(page, 'catalogo');

// Filters in the URL
await page.getByRole('combobox', { name: 'Género' }).click();
await page.getByRole('option', { name: 'Drama' }).click();
await page.waitForTimeout(800);
await shot(page, 'catalogo-filtrado');

// Detail
await page.goto(BASE + '/');
await page.locator('app-anime-card', { hasText: 'Dawn Star' }).click();
await page.getByRole('heading', { name: 'Dawn Star' }).waitFor();
await settle(page);
await shot(page, 'detalle');
await page.getByRole('radio', { name: 'Descendente' }).click();
await page.locator('#ep-6').scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await page.getByRole('heading', { name: 'Capítulos' }).scrollIntoViewIfNeeded();
await shot(page, 'capitulos');

// Watch list
await page.getByRole('link', { name: 'Mi lista' }).first().click();
await page.getByRole('heading', { name: 'Mi lista' }).waitFor();
await settle(page);
await shot(page, 'mi-lista');

// User menu
await page.getByRole('button', { name: 'Menú de usuario' }).click();
await page.waitForTimeout(400);
await shot(page, 'menu-usuario', { clip: { x: 640, y: 0, width: 640, height: 360 } });
await page.getByRole('menuitem', { name: 'Mi perfil' }).click();
await page.getByRole('heading', { name: 'Mi perfil' }).waitFor();
await page.getByRole('radio', { name: 'Turquesa' }).click();
await settle(page);
await shot(page, 'perfil', { fullPage: true });

// Light theme
await page.getByRole('button', { name: 'Cambiar a tema claro' }).click();
await page.goto(BASE + '/');
await page.locator('app-anime-card').nth(5).waitFor();
await settle(page);
await shot(page, 'tema-claro');
await ctx.close();

// Mobile
const mobile = await context({ width: 390, height: 844 });
await mobile.page.goto(BASE + '/');
await mobile.page.waitForURL(/login/).catch(() => {});
await mobile.page.getByRole('tab', { name: 'Entrar' }).click();
await mobile.page.getByLabel('Usuario').fill(DEMO_USER);
await mobile.page.locator('input[name=password]').fill('Clave1234');
await mobile.page.getByRole('button', { name: 'Entrar' }).click();
await mobile.page.locator('app-anime-card').nth(3).waitFor();
await settle(mobile.page);
await shot(mobile.page, 'movil');
await mobile.page.getByRole('link', { name: 'Mi lista' }).last().click();
await mobile.page.getByRole('heading', { name: 'Mi lista' }).waitFor();
await settle(mobile.page);
await shot(mobile.page, 'movil-mi-lista');
await mobile.ctx.close();

await browser.close();
console.log(`Capturas en docs/screenshots (usuario de demostración: ${DEMO_USER})`);
