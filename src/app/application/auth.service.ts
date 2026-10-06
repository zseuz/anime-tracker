import { Injectable, computed, inject, signal } from '@angular/core';
import { Session } from '../domain/models';
import { AuthGateway, KeyValueStore } from '../domain/ports';
import { AuthError } from '../domain/session';

/** Only a hint of who is signed in, so the UI can render before the server confirms it. */
export const SESSION_HINT_KEY = 'at.session';

/**
 * Account and session handling. The real session is an HttpOnly cookie managed by the server;
 * nothing secret is kept in the browser's storage.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly gateway = inject(AuthGateway);
  private readonly store = inject(KeyValueStore);

  private readonly session = signal<Session | null>(this.store.get<Session | null>(SESSION_HINT_KEY, null));
  readonly user = computed(() => this.session()?.username ?? null);
  readonly loggedIn = computed(() => this.session() !== null);

  constructor() {
    this.revalidate();
  }

  async register(username: string, password: string): Promise<void> {
    this.start(await this.gateway.register(username.trim(), password));
  }

  async login(username: string, password: string): Promise<void> {
    this.start(await this.gateway.login(username.trim(), password));
  }

  logout(): void {
    this.store.remove(SESSION_HINT_KEY);
    this.session.set(null);
    this.gateway.logout().catch(() => undefined); // the cookie also expires on its own
  }

  private start(session: Session) {
    this.store.set(SESSION_HINT_KEY, session);
    this.session.set(session);
  }

  /** Drops the local hint when the server says there is no valid session. Network errors keep it. */
  private revalidate() {
    if (!this.session()) return;
    this.gateway.me().then(
      server => this.start(server),
      e => {
        if (e instanceof AuthError && e.status === 401) {
          this.store.remove(SESSION_HINT_KEY);
          this.session.set(null);
        }
      },
    );
  }
}
