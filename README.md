# AnimeTracker

Explora animes (API de AniList), marca capítulos vistos, ponles estado, nota y comentarios, y recibe avisos de capítulos nuevos.
Frontend en Angular + Angular Material (PWA instalable), backend en Node/Express con MySQL.

## Funciones

- **Cuentas y sesión** con cookie `HttpOnly` (el token no es accesible desde JavaScript), límite de intentos de login y contraseñas con letras y números (8+).
- **Perfil editable** (`/perfil`): nombre de usuario, color del avatar, cambio de contraseña (pide la actual) y eliminación de la cuenta con todos sus datos (pide la contraseña).
- **Catálogo** con filtros por tipo, género, estado, nota mínima y orden. Los filtros viven en la URL (se pueden compartir y sobreviven a recargar), búsqueda con pausa y desplazamiento infinito.
- **Seguimiento**: capítulos vistos, estado (Viendo / Pendiente / Completado / Abandonado), nota 1–10, notas personales y botón "Continuar: Capítulo N".
- **Avisos de capítulos nuevos**: se revisan al iniciar sesión, cada 15 minutos y al volver a la pestaña; opcionalmente con notificaciones del navegador. En cada tarjeta se ve cuándo sale el próximo capítulo.
- **Migas de pan** y "Volver" que respetan de dónde vienes (Explorar o Mi lista).
- **Tema claro/oscuro**, enlace "Saltar al contenido", etiquetas ARIA y revisión automática de accesibilidad (axe).

## Arquitectura

```
src/app/
  domain/          Modelos, puertos (interfaces) y lógica pura (lista, filtros, horarios, contraseña)
  application/     Casos de uso: AuthService, WatchListService, EpisodeWatcher, NotificationService, ThemeService
  infrastructure/  Adaptadores: AniList, API propia (HTTP), localStorage, Notification API
  features/        Pantallas: auth, catalog, anime-detail, watch-list
  shared/          Componentes reutilizables (tarjeta, migas de pan)
  app.config.ts    Raíz de composición (une puertos con adaptadores)
server/
  src/app.js           API REST (auth con cookie, lista, límite de intentos)
  src/repositories.js  Acceso a MySQL
  src/schema.js        Tablas y migraciones (las ejecuta `db:setup`, no la API)
  scripts/setup-db.js  Crea base(s), usuario MySQL restringido y tablas
e2e/                   Pruebas de extremo a extremo (Playwright + axe)
```

La API usa un usuario de MySQL con permisos **solo** `SELECT/INSERT/UPDATE/DELETE`: no puede crear ni borrar tablas.

## Puesta en marcha

1. Con MySQL en marcha, crea la base y el usuario restringido (las credenciales de administrador solo se leen del entorno, no se guardan):

   ```bash
   cd server
   ADMIN_USER=root ADMIN_PASSWORD=... APP_PASSWORD=... DB_NAMES=anime_tracker,anime_tracker_test npm run db:setup
   ```

   En PowerShell: `$env:ADMIN_USER='root'; $env:ADMIN_PASSWORD='...'; $env:APP_PASSWORD='...'; npm run db:setup`.
2. Copia `server/.env.example` a `server/.env` y rellena `DB_PASSWORD` (el `APP_PASSWORD` anterior) y `JWT_SECRET` (32+ caracteres aleatorios).
3. `npm run install:all` y luego **`npm start`**: levanta la API (http://localhost:3000) y el frontend (http://localhost:4200).

### Con Docker

```bash
cp .env.docker.example .env   # y completa los secretos
docker compose up --build     # web en http://localhost:8080, API en :3000
```

## Pruebas

| Comando | Qué ejecuta |
|---|---|
| `npm test` | Frontend: Vitest + jsdom |
| `npm run test:api` | API: Vitest + supertest |
| `npm run test:e2e` | Playwright + axe contra una API y una base de pruebas (`anime_tracker_test`), con AniList simulado. Para `npm start` antes: usa los mismos puertos. Por defecto usa Microsoft Edge instalado (`E2E_CHANNEL=chrome` o `E2E_CHANNEL=` + `npx playwright install chromium` para otros). |
| `npm run test:all` | Frontend + API |

CI en GitHub Actions: `.github/workflows/ci.yml` (frontend, API y e2e con MySQL).

## Producción

- Sirve todo por HTTPS y arranca la API con `NODE_ENV=production` para que la cookie sea `Secure`.
- Usa un `JWT_SECRET` largo y aleatorio y un usuario de MySQL restringido (lo crea `db:setup`).
- La URL de la API se cambia con el token `API_URL` (`src/app/infrastructure/api-config.ts`).
- El service worker solo se activa en la compilación de producción (`npx ng build`).
"# anime-tracker" 
