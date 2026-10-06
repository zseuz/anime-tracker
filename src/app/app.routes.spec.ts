import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { AuthGateway, KeyValueStore } from './domain/ports';
import { FakeAuthGateway, InMemoryStore } from './testing/fakes';
import { AuthService } from './application/auth.service';
import { authGuard, routes } from './app.routes';

describe('authGuard', () => {
  const run = () => TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: KeyValueStore, useValue: new InMemoryStore() },
        { provide: AuthGateway, useValue: new FakeAuthGateway() },
      ],
    });
  });

  it('redirects anonymous users to /login', () => {
    const result = run() as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login');
  });

  it('lets a logged-in user through', async () => {
    await TestBed.inject(AuthService).register('rei', 'secret');
    expect(run()).toBe(true);
  });
});
