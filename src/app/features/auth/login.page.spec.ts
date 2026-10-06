import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../application/auth.service';
import { AuthGateway, KeyValueStore } from '../../domain/ports';
import { FakeAuthGateway, InMemoryStore } from '../../testing/fakes';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let auth: AuthService;
  let navigate: ReturnType<typeof vi.spyOn>;
  // Protected members are reachable through a loosely-typed view in tests.
  const page = () => fixture.componentInstance as unknown as Record<string, any>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: KeyValueStore, useValue: new InMemoryStore() },
        { provide: AuthGateway, useValue: new FakeAuthGateway() },
      ],
    });
    auth = TestBed.inject(AuthService);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();
  });

  describe('show/hide password', () => {
    const input = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[name=password]')!;
    const toggle = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[matSuffix]')!;

    it('hides the password by default', () => {
      expect(input().type).toBe('password');
      expect(toggle().getAttribute('aria-label')).toBe('Mostrar contraseña');
      expect(toggle().getAttribute('aria-pressed')).toBe('false');
    });

    it('reveals it with the button and hides it again', async () => {
      toggle().click();
      await fixture.whenStable();
      expect(input().type).toBe('text');
      expect(toggle().getAttribute('aria-label')).toBe('Ocultar contraseña');
      expect(toggle().getAttribute('aria-pressed')).toBe('true');

      toggle().click();
      await fixture.whenStable();
      expect(input().type).toBe('password');
    });

    it('does not submit the form when pressed', async () => {
      page()['username'] = 'rei';
      page()['password'] = 'secret12';
      toggle().click();
      await fixture.whenStable();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('sign in', () => {
    it('only needs a username and some password (older accounts may have short ones)', () => {
      expect(page()['canSubmit']).toBe(false);
      page()['username'] = 'rei';
      page()['password'] = '7773';
      expect(page()['canSubmit']).toBe(true);
    });

    it('shows the server error for bad credentials and stays on the page', async () => {
      page()['username'] = 'ghost';
      page()['password'] = 'secret12';
      await page()['submit']();
      await fixture.whenStable();
      expect(page()['error']()).toContain('incorrectos');
      expect(navigate).not.toHaveBeenCalled();
      expect((fixture.nativeElement as HTMLElement).querySelector('[role=alert]')).not.toBeNull();
      expect(page()['submitting']()).toBe(false);
    });
  });

  describe('create account', () => {
    beforeEach(() => page()['setMode'](1));

    it('requires a strong password', () => {
      page()['username'] = 'rei';
      for (const weak of ['abc', 'abcdefgh', '12345678']) {
        page()['password'] = weak;
        expect(page()['canSubmit']).toBe(false);
      }
      page()['password'] = 'secret12';
      expect(page()['canSubmit']).toBe(true);
    });

    it('registers and navigates home', async () => {
      page()['username'] = 'rei';
      page()['password'] = 'secret12';
      await page()['submit']();
      expect(auth.user()).toBe('rei');
      expect(navigate).toHaveBeenCalledWith('/');
    });

    it('shows the password rule as a hint', async () => {
      await fixture.whenStable();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Mínimo 8 caracteres');
    });

    it('clears the error when switching mode', async () => {
      page()['setMode'](0);
      page()['username'] = 'ghost';
      page()['password'] = 'secret12';
      await page()['submit']();
      page()['setMode'](1);
      expect(page()['error']()).toBe('');
    });
  });
});
