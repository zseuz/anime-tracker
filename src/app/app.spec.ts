import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from './application/auth.service';
import { NOTIFY_PREF_KEY } from './application/notification.service';
import { THEME_KEY } from './application/theme.service';
import { AnimeCatalog, AuthGateway, KeyValueStore, Notifier, WatchListRepository } from './domain/ports';
import { FakeAuthGateway, FakeCatalog, FakeNotifier, FakeWatchListRepository, InMemoryStore } from './testing/fakes';
import { avatarGradient } from './shared/avatar';
import { App } from './app';

describe('App shell', () => {
  let fixture: ComponentFixture<App>;
  let store: InMemoryStore;
  let notifier: FakeNotifier;
  const el = () => fixture.nativeElement as HTMLElement;

  const create = async (signedIn: boolean, opts: { notifications?: 'unsupported'; avatar?: 'teal' } = {}) => {
    store = new InMemoryStore();
    notifier = new FakeNotifier();
    if (opts.notifications) notifier.state = opts.notifications;
    const gateway = new FakeAuthGateway();
    if (signedIn) {
      await gateway.register('rei', 'secret12'); // the server knows the user and has a session for them
      if (opts.avatar) await gateway.updateProfile({ avatar: opts.avatar });
      store.set('at.session', { username: 'rei', avatar: opts.avatar ?? 'violet' });
    }
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
    await create(true, { notifications: 'unsupported' });
    expect(el().querySelector('mat-toolbar')).not.toBeNull(); // really signed in, so the absence is meaningful
    expect(button(/notificaciones/i)).toBeUndefined();
  });

  it('paints the avatar with the colour chosen in the profile', async () => {
    await create(true, { avatar: 'teal' });
    const avatar = el().querySelector<HTMLElement>('.avatar-btn .avatar')!;
    const expected = (id: 'teal' | 'violet') => {
      const probe = document.createElement('div');
      probe.style.background = avatarGradient(id); // let the browser normalise the value
      return probe.style.background;
    };
    expect(avatar.style.background).toBe(expected('teal'));
    expect(avatar.style.background).not.toBe(expected('violet'));
  });

  describe('user menu', () => {
    const openMenu = async () => {
      button(/menú de usuario/i).click();
      fixture.detectChanges();
      await fixture.whenStable();
    };
    const menuItems = () => [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];

    it('shows the username, an avatar initial and the account options', async () => {
      await create(true);
      expect(el().querySelector('.avatar')?.textContent?.trim()).toBe('R');
      await openMenu();
      const labels = menuItems().map(i => i.textContent?.trim() ?? '');
      expect(labels.some(l => l.includes('Mi perfil'))).toBe(true);
      expect(labels.some(l => l.includes('Mi lista'))).toBe(true);
      expect(labels.some(l => l.includes('Cerrar sesión'))).toBe(true);
      expect(document.querySelector('.menu-head')?.textContent).toContain('rei');
    });

    it('logging out returns to the signed-out view', async () => {
      await create(true);
      await openMenu();
      menuItems().find(i => i.textContent?.includes('Cerrar sesión'))!.click();
      await fixture.whenStable();
      expect(TestBed.inject(AuthService).loggedIn()).toBe(false);
      expect(el().querySelector('mat-toolbar')).toBeNull();
    });
  });

  it('leaves the protected pages when the session turns out to be invalid', async () => {
    store = new InMemoryStore();
    store.set('at.session', { username: 'rei' }); // stale hint from an old session
    const gateway = new FakeAuthGateway(); // the server has no session -> 401
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'login', children: [] }, { path: '', children: [] }]),
        { provide: KeyValueStore, useValue: store },
        { provide: AuthGateway, useValue: gateway },
        { provide: AnimeCatalog, useValue: new FakeCatalog() },
        { provide: WatchListRepository, useValue: new FakeWatchListRepository() },
        { provide: Notifier, useValue: new FakeNotifier() },
      ],
    });
    await TestBed.inject(Router).navigateByUrl('/');
    fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    await new Promise(r => setTimeout(r));
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(el().querySelector('mat-toolbar')).toBeNull();
  });
});
