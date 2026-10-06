import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './application/auth.service';
import { NOTIFY_PREF_KEY } from './application/notification.service';
import { THEME_KEY } from './application/theme.service';
import { AnimeCatalog, AuthGateway, KeyValueStore, Notifier, WatchListRepository } from './domain/ports';
import { FakeAuthGateway, FakeCatalog, FakeNotifier, FakeWatchListRepository, InMemoryStore } from './testing/fakes';
import { App } from './app';

describe('App shell', () => {
  let fixture: ComponentFixture<App>;
  let store: InMemoryStore;
  let notifier: FakeNotifier;
  const el = () => fixture.nativeElement as HTMLElement;

  const create = async (signedIn: boolean) => {
    store = new InMemoryStore();
    notifier = new FakeNotifier();
    if (signedIn) store.set('at.session', { username: 'rei' });
    const gateway = new FakeAuthGateway();
    gateway.serverSession = 'rei';
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'login', children: [] }]),
        { provide: KeyValueStore, useValue: store },
        { provide: AuthGateway, useValue: gateway },
        { provide: AnimeCatalog, useValue: new FakeCatalog() },
        { provide: WatchListRepository, useValue: new FakeWatchListRepository() },
        { provide: Notifier, useValue: notifier },
      ],
    });
    fixture = TestBed.createComponent(App);
    await fixture.whenStable();
  };
  const button = (label: RegExp) =>
    [...el().querySelectorAll('button')].find(b => label.test(b.getAttribute('aria-label') ?? '')) as HTMLButtonElement;

  it('always offers a skip link that moves focus to the content', async () => {
    await create(false);
    const skip = el().querySelector<HTMLAnchorElement>('.skip')!;
    expect(skip.textContent).toContain('Saltar al contenido');
    skip.click();
    expect(document.activeElement?.id).toBe('main');
  });

  it('hides the navigation when signed out', async () => {
    await create(false);
    expect(el().querySelector('mat-toolbar')).toBeNull();
  });

  it('shows the navigation and the user when signed in', async () => {
    await create(true);
    expect(el().querySelector('mat-toolbar')).not.toBeNull();
    expect(el().textContent).toContain('Mi lista');
    expect(el().textContent).toContain('rei');
  });

  it('toggles and remembers the theme', async () => {
    await create(true);
    button(/tema claro/i).click();
    await fixture.whenStable();
    expect(store.get(THEME_KEY, '')).toBe('light');
    expect(button(/tema oscuro/i)).toBeTruthy();
  });

  it('enables notifications through the bell and reflects the state', async () => {
    await create(true);
    button(/activar notificaciones/i).click();
    await fixture.whenStable();
    expect(store.get(NOTIFY_PREF_KEY, false)).toBe(true);
    expect(button(/desactivar notificaciones/i).getAttribute('aria-pressed')).toBe('true');
  });

  it('hides the bell when the browser has no Notification API', async () => {
    store = new InMemoryStore();
    notifier = new FakeNotifier();
    notifier.state = 'unsupported';
    store.set('at.session', { username: 'rei' });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: KeyValueStore, useValue: store },
        { provide: AuthGateway, useValue: new FakeAuthGateway() },
        { provide: AnimeCatalog, useValue: new FakeCatalog() },
        { provide: WatchListRepository, useValue: new FakeWatchListRepository() },
        { provide: Notifier, useValue: notifier },
      ],
    });
    fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(button(/notificaciones/i)).toBeUndefined();
  });

  it('logging out returns to the signed-out view', async () => {
    await create(true);
    button(/cerrar sesión/i).click();
    await fixture.whenStable();
    expect(TestBed.inject(AuthService).loggedIn()).toBe(false);
    expect(el().querySelector('mat-toolbar')).toBeNull();
  });
});
