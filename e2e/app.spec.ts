import { expect, expectAccessible, PASSWORD, register, test, uniqueUser } from './fixtures';

test.describe('registro y sesión', () => {
  test('rechaza una contraseña débil y acepta una fuerte', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('tab', { name: 'Crear cuenta' }).click();
    await page.getByLabel('Usuario').fill(uniqueUser());
    await page.getByLabel('Contraseña').fill('abc123');
    await expect(page.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled();
    await page.getByLabel('Contraseña').fill(PASSWORD);
    await expect(page.getByRole('button', { name: 'Crear cuenta' })).toBeEnabled();
  });

  test('un usuario repetido muestra el error del servidor', async ({ page }) => {
    const name = await register(page);
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page.getByRole('tab', { name: 'Crear cuenta' }).click();
    await page.getByLabel('Usuario').fill(name);
    await page.getByLabel('Contraseña').fill(PASSWORD);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByRole('alert')).toContainText('ya existe');
  });

  test('la sesión sobrevive a recargar y es una cookie HttpOnly', async ({ page, context }) => {
    await register(page);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Explorar' })).toBeVisible();

    const cookie = (await context.cookies()).find(c => c.name === 'at_token');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(stored).not.toMatch(/token|password|Clave/i);
  });

  test('cerrar sesión protege las rutas y se puede volver a entrar', async ({ page }) => {
    const name = await register(page);
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/mi-lista');
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel('Usuario').fill(name);
    await page.getByLabel('Contraseña').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { name: 'Explorar' })).toBeVisible();
  });

  test('credenciales incorrectas muestran un error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Usuario').fill('nadie');
    await page.getByLabel('Contraseña').fill('equivocada1');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toContainText('incorrectos');
  });
});

test.describe('catálogo', () => {
  test('muestra resultados, el género Ecchi no aparece y los filtros viven en la URL', async ({ page }) => {
    await register(page);
    await expect(page.locator('app-anime-card').nth(2)).toBeVisible();

    await page.getByRole('combobox', { name: 'Género' }).click();
    await expect(page.getByRole('option', { name: 'Ecchi' })).toHaveCount(0);
    await page.getByRole('option', { name: 'Drama' }).click();
    await expect(page).toHaveURL(/genre=Drama/);
    await expect(page.locator('app-anime-card')).toHaveCount(3);

    await page.reload();
    await expect(page).toHaveURL(/genre=Drama/);
    await expect(page.getByRole('combobox', { name: 'Género' })).toContainText('Drama');
  });

  test('buscar por texto filtra tras una pausa', async ({ page }) => {
    await register(page);
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('gintama');
    await expect(page).toHaveURL(/q=gintama/);
    await expect(page.locator('app-anime-card')).toHaveCount(1);
  });

  test('"Cargar más" añade la página siguiente', async ({ page }) => {
    await register(page);
    await expect(page.locator('app-anime-card').nth(2)).toBeVisible();
    // The next page may already have loaded by itself (the sentinel is on screen); either way we end with 4.
    const more = page.getByRole('button', { name: 'Cargar más' });
    if (await more.isVisible()) await more.click();
    await expect(page.locator('app-anime-card')).toHaveCount(4);
    await expect(page.getByText('Has llegado al final.')).toBeVisible();
  });

  test('muestra cuándo sale el próximo capítulo', async ({ page }) => {
    await register(page);
    await expect(page.locator('app-anime-card', { hasText: 'Frieren' })).toContainText('Ep. 6 · en 3 días');
  });
});

test.describe('seguimiento', () => {
  test('marcar capítulos, estado, nota y migas de pan hacia Mi lista', async ({ page }) => {
    await register(page);
    await page.locator('app-anime-card', { hasText: 'Fullmetal' }).click();
    await expect(page.getByRole('heading', { name: 'Fullmetal Alchemist: Brotherhood' })).toBeVisible();

    await page.getByRole('checkbox', { name: /Capítulo 1/ }).check();
    await page.getByRole('checkbox', { name: /Capítulo 2/ }).check();
    await expect(page.getByText('2 / 5 vistos')).toBeVisible();
    await expect(page.getByRole('button', { name: /Continuar: Capítulo 3/ })).toBeVisible();

    await page.getByRole('combobox', { name: 'Mi nota' }).click();
    await page.getByRole('option', { name: '9 / 10' }).click();
    await page.getByRole('textbox', { name: 'Mis notas' }).fill('Obra maestra');
    await page.getByRole('textbox', { name: 'Mis notas' }).blur();

    // Opening it from "Mi lista" makes "back" return there.
    await page.getByRole('link', { name: 'Mi lista' }).first().click();
    const item = page.locator('article', { hasText: 'Fullmetal' });
    await expect(item).toContainText('2 vistos');
    await expect(item).toContainText('★ 9');
    await item.getByRole('link', { name: 'Fullmetal Alchemist: Brotherhood' }).click();
    await expect(page).toHaveURL(/from=mi-lista/);
    await expect(page.getByRole('navigation', { name: 'Migas de pan' })).toContainText('Mi lista');
    await page.getByRole('link', { name: 'Volver a Mi lista' }).click();
    await expect(page).toHaveURL(/\/mi-lista$/);
  });

  test('la lista se guarda en la base de datos y reaparece al volver a entrar', async ({ page }) => {
    const name = await register(page);
    await page.locator('app-anime-card', { hasText: 'Your Name' }).click();
    await page.getByRole('checkbox', { name: /Capítulo 1/ }).check();
    await expect(page.getByText('1 / 1 vistos')).toBeVisible();
    await page.waitForTimeout(500); // let the save reach the server

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page.getByLabel('Usuario').fill(name);
    await page.getByLabel('Contraseña').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.getByRole('link', { name: 'Mi lista' }).first().click();
    await expect(page.locator('article', { hasText: 'Your Name' })).toContainText('1 vistos');
  });

  test('seguir un anime y filtrar Mi lista por estado', async ({ page }) => {
    await register(page);
    await page.locator('app-anime-card', { hasText: 'Frieren' }).click();
    await page.getByRole('switch', { name: 'Avisarme de nuevos capítulos' }).check();
    await page.getByRole('link', { name: 'Mi lista' }).first().click();

    await expect(page.getByRole('radio', { name: /Pendiente/ })).toContainText('1');
    await page.getByRole('radio', { name: /Viendo/ }).click();
    await expect(page.getByText('No hay animes con este estado.')).toBeVisible();
    await page.getByRole('radio', { name: /Pendiente/ }).click();
    await expect(page.locator('article', { hasText: 'Frieren' })).toContainText('Siguiendo');
  });
});

test.describe('apariencia y accesibilidad', () => {
  test('el tema se puede cambiar y se recuerda', async ({ page }) => {
    await register(page);
    await page.getByRole('button', { name: 'Cambiar a tema claro' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('login sin violaciones graves de accesibilidad', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
    await expectAccessible(page);
  });

  test('catálogo y detalle sin violaciones graves (oscuro y claro)', async ({ page }) => {
    await register(page);
    await expect(page.locator('app-anime-card').nth(2)).toBeVisible();
    await expectAccessible(page);

    await page.locator('app-anime-card', { hasText: 'Fullmetal' }).click();
    await expect(page.getByRole('heading', { name: 'Fullmetal Alchemist: Brotherhood' })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole('button', { name: 'Cambiar a tema claro' }).click();
    await expectAccessible(page);
    await page.getByRole('link', { name: 'Explorar' }).first().click();
    await expect(page.locator('app-anime-card').nth(2)).toBeVisible();
    await expectAccessible(page);
  });

  test('el enlace "Saltar al contenido" mueve el foco', async ({ page }) => {
    await register(page);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });
});
