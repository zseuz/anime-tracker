import { TestBed } from '@angular/core/testing';
import { KeyValueStore } from '../domain/ports';
import { InMemoryStore } from '../testing/fakes';
import { THEME_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  let store: InMemoryStore;
  const create = () => {
    TestBed.configureTestingModule({ providers: [{ provide: KeyValueStore, useValue: store }] });
    return TestBed.inject(ThemeService);
  };
  const prefersLight = (light: boolean) =>
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: light && q.includes('light') }));

  beforeEach(() => { store = new InMemoryStore(); prefersLight(false); });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to dark', () => expect(create().mode()).toBe('dark'));

  it('follows a light system preference when nothing is saved', () => {
    prefersLight(true);
    expect(create().mode()).toBe('light');
  });

  it('prefers the saved choice over the system', () => {
    prefersLight(true);
    store.set(THEME_KEY, 'dark');
    expect(create().mode()).toBe('dark');
  });

  it('ignores a corrupt saved value', () => {
    store.set(THEME_KEY, 'neon');
    expect(create().mode()).toBe('dark');
  });

  it('toggles, persists and reflects it on <html>', () => {
    const theme = create();
    TestBed.tick();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    theme.toggle();
    TestBed.tick();
    expect(theme.mode()).toBe('light');
    expect(store.get(THEME_KEY, '')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
