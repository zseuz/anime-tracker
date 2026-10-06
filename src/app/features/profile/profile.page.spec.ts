import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../application/auth.service';
import { AuthGateway, KeyValueStore } from '../../domain/ports';
import { FakeAuthGateway, InMemoryStore } from '../../testing/fakes';
import { ProfilePage } from './profile.page';

describe('ProfilePage', () => {
  let fixture: ComponentFixture<ProfilePage>;
  let auth: AuthService;
  let gateway: FakeAuthGateway;
  let navigate: ReturnType<typeof vi.spyOn>;
  type Internals = Record<string, any>;
  const page = () => fixture.componentInstance as unknown as Internals;
  const el = () => fixture.nativeElement as HTMLElement;
  const settle = async () => { await fixture.whenStable(); fixture.detectChanges(); };

  beforeEach(async () => {
    gateway = new FakeAuthGateway();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: KeyValueStore, useValue: new InMemoryStore() },
        { provide: AuthGateway, useValue: gateway },
      ],
    });
    auth = TestBed.inject(AuthService);
    await auth.register('rei', 'secret12');
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(ProfilePage);
    await settle();
  });

  it('starts with the current username and avatar, and nothing to save', () => {
    expect(page()['username']).toBe('rei');
    expect(page()['avatar']()).toBe('violet');
    expect(page()['canSaveProfile']).toBe(false);
    expect(el().querySelector('app-breadcrumbs')?.textContent).toContain('Mi perfil');
  });

  describe('profile', () => {
    it('offers the avatar colours as an accessible radio group', () => {
      const radios = el().querySelectorAll('[role="radio"]');
      expect(radios).toHaveLength(6);
      expect(el().querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('Color del avatar');
      expect(el().querySelectorAll('[role="radio"][aria-checked="true"]')).toHaveLength(1);
    });

    it('picking a colour previews it and enables saving', async () => {
      page()['pickAvatar']('teal');
      await settle();
      expect(el().querySelector('[role="radio"][aria-checked="true"]')?.getAttribute('aria-label')).toBe('Turquesa');
      expect(page()['canSaveProfile']).toBe(true);
    });

    it('saves a new username and avatar', async () => {
      page()['username'] = '  Rei Ayanami ';
      page()['pickAvatar']('rose');
      await page()['saveProfile']();
      await settle();
      expect(auth.user()).toBe('Rei Ayanami');
      expect(auth.avatar()).toBe('rose');
      expect(page()['username']).toBe('Rei Ayanami');
      expect(el().querySelector('[role="status"]')?.textContent).toContain('Perfil actualizado');
      expect(page()['canSaveProfile']).toBe(false);
    });

    it('sends only what changed', async () => {
      const spy = vi.spyOn(gateway, 'updateProfile');
      page()['pickAvatar']('blue');
      await page()['saveProfile']();
      expect(spy).toHaveBeenCalledWith({ avatar: 'blue' });
    });

    it('rejects an empty or too long username', () => {
      page()['username'] = '   ';
      page()['pickAvatar']('blue');
      expect(page()['canSaveProfile']).toBe(false);
      page()['username'] = 'x'.repeat(51);
      expect(page()['canSaveProfile']).toBe(false);
    });

    it('shows the server error when the username is taken and keeps the old one', async () => {
      await gateway.register('shinji', 'secret12');
      await gateway.login('rei', 'secret12');
      page()['username'] = 'Shinji';
      await page()['saveProfile']();
      await settle();
      expect(el().querySelector('[role="alert"]')?.textContent).toContain('ya existe');
      expect(auth.user()).toBe('rei');
    });
  });

  describe('password', () => {
    const fill = (current: string, next: string, confirm = next) => {
      page()['currentPassword'] = current;
      page()['newPassword'] = next;
      page()['confirmPassword'] = confirm;
    };

    it('needs the current password, a strong new one that matches and differs', () => {
      fill('', 'Nueva9876');
      expect(page()['canChangePassword']).toBe(false);
      fill('secret12', 'corta1');
      expect(page()['canChangePassword']).toBe(false);
      fill('secret12', 'Nueva9876', 'Otra99999');
      expect(page()['canChangePassword']).toBe(false);
      expect(page()['passwordMismatch']).toBe(true);
      fill('secret12', 'secret12');
      expect(page()['canChangePassword']).toBe(false);
      fill('secret12', 'Nueva9876');
      expect(page()['canChangePassword']).toBe(true);
    });

    it('changes it, clears the fields and confirms', async () => {
      fill('secret12', 'Nueva9876');
      await page()['changePassword']();
      await settle();
      expect(page()['currentPassword']).toBe('');
      expect(el().textContent).toContain('Contraseña actualizada');
      await expect(gateway.login('rei', 'Nueva9876')).resolves.toBeTruthy();
    });

    it('shows the server error for a wrong current password and keeps the fields', async () => {
      fill('mal-mal-1', 'Nueva9876');
      await page()['changePassword']();
      await settle();
      expect(el().textContent).toContain('La contraseña actual no es correcta');
      expect(page()['newPassword']).toBe('Nueva9876');
    });

    it('can reveal the passwords', async () => {
      const type = () => el().querySelector<HTMLInputElement>('input[name=new]')!.type;
      expect(type()).toBe('password');
      page()['showPasswords'].set(true);
      await settle();
      expect(type()).toBe('text');
    });
  });

  describe('delete account', () => {
    it('asks for confirmation first, and can be cancelled', async () => {
      expect(el().querySelector('input[name=deletePassword]')).toBeNull();
      page()['startDelete']();
      await settle();
      expect(el().querySelector('input[name=deletePassword]')).not.toBeNull();
      page()['cancelDelete']();
      await settle();
      expect(el().querySelector('input[name=deletePassword]')).toBeNull();
      expect(auth.loggedIn()).toBe(true);
    });

    it('deletes the account with the right password and goes to the login', async () => {
      page()['startDelete']();
      page()['deletePassword'] = 'secret12';
      await page()['deleteAccount']();
      expect(gateway.has('rei')).toBe(false);
      expect(auth.loggedIn()).toBe(false);
      expect(navigate).toHaveBeenCalledWith('/login');
    });

    it('does nothing and shows the error when the password is wrong', async () => {
      page()['startDelete']();
      page()['deletePassword'] = 'incorrecta1';
      await page()['deleteAccount']();
      await settle();
      expect(gateway.has('rei')).toBe(true);
      expect(auth.loggedIn()).toBe(true);
      expect(navigate).not.toHaveBeenCalled();
      expect(el().textContent).toContain('La contraseña no es correcta');
    });

    it('does not even try without a password', async () => {
      const spy = vi.spyOn(gateway, 'deleteAccount');
      page()['startDelete']();
      await page()['deleteAccount']();
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
