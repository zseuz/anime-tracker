import { Injectable, computed, inject, signal } from '@angular/core';
import { AVATAR_IDS, AvatarId, DEFAULT_AVATAR, ProfileChanges, Session } from '../domain/models';
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

  private readonly session = signal<Session | null>(this.readHint());
  readonly user = computed(() => this.session()?.username ?? null);
  readonly avatar = computed<AvatarId>(() => this.session()?.avatar ?? DEFAULT_AVATAR);
  readonly loggedIn = computed(() => this.session() !== null);
  /**
   * Changes whenever someone signs in or out (or the account is deleted), but NOT when the
   * profile is edited, so data tied to the session is not reloaded just because of a rename.
   */
  readonly sessionId = signal(0);

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
    this.end();
    this.gateway.logout().catch(() => undefined); // the cookie also expires on its own
  }

  async updateProfile(changes: ProfileChanges): Promise<void> {
    this.setSession(await this.gateway.updateProfile(changes));
  }

  changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return this.gateway.changePassword(currentPassword, newPassword);
  }

  /** Deletes the account for good, then leaves the session. */
  async deleteAccount(password: string): Promise<void> {
    await this.gateway.deleteAccount(password);
    this.end();
  }

  private start(session: Session) {
    this.setSession(session);
    this.sessionId.update(n => n + 1);
  }

  private end() {
    this.store.remove(SESSION_HINT_KEY);
    this.session.set(null);
    this.sessionId.update(n => n + 1);
  }

  private setSession(session: Session) {
    this.store.set(SESSION_HINT_KEY, session);
    this.session.set(session);
  }

  /** Reads the stored hint, tolerating older formats that had no avatar. */
  private readHint(): Session | null {
    const hint = this.store.get<Partial<Session> | null>(SESSION_HINT_KEY, null);
    if (!hint?.username) return null;
    const avatar = AVATAR_IDS.includes(hint.avatar as AvatarId) ? (hint.avatar as AvatarId) : DEFAULT_AVATAR;
    return { username: hint.username, avatar };
  }

  /** Drops the local hint when the server says there is no valid session. Network errors keep it. */
  private revalidate() {
    if (!this.session()) return;
    this.gateway.me().then(
      server => this.setSession(server),
      e => {
        if (e instanceof AuthError && e.status === 401) this.end();
      },
    );
  }
}
