import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';
import { KeyValueStore } from '../domain/ports';

export type ThemeMode = 'dark' | 'light';
export const THEME_KEY = 'at.theme';

/** Light/dark theme: remembers the choice, otherwise follows the system preference. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly store = inject(KeyValueStore);
  private readonly document = inject(DOCUMENT);

  readonly mode = signal<ThemeMode>(this.initial());

  constructor() {
    effect(() => {
      this.document.documentElement.setAttribute('data-theme', this.mode());
    });
  }

  toggle(): void {
    const next: ThemeMode = this.mode() === 'dark' ? 'light' : 'dark';
    this.mode.set(next);
    this.store.set(THEME_KEY, next);
  }

  private initial(): ThemeMode {
    const saved = this.store.get<string | null>(THEME_KEY, null);
    if (saved === 'dark' || saved === 'light') return saved;
    const prefersLight = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: light)').matches;
    return prefersLight ? 'light' : 'dark';
  }
}
