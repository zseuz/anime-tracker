import { Injectable, inject } from '@angular/core';
import { ProfileChanges, Session } from '../domain/models';
import { AuthGateway } from '../domain/ports';
import { AuthError } from '../domain/session';
import { API_URL, apiFetch, errorMessage } from './api-config';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

@Injectable()
export class HttpAuthGateway extends AuthGateway {
  private readonly api = inject(API_URL);

  register(username: string, password: string) {
    return this.session('/auth/register', 'POST', { username, password });
  }

  login(username: string, password: string) {
    return this.session('/auth/login', 'POST', { username, password });
  }

  async logout(): Promise<void> {
    await apiFetch(`${this.api}/auth/logout`, { method: 'POST', credentials: 'include' });
  }

  me() {
    return this.session('/me', 'GET');
  }

  updateProfile(changes: ProfileChanges) {
    return this.session('/me', 'PATCH', changes);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.send('/me/password', 'PUT', { currentPassword, newPassword });
  }

  async deleteAccount(password: string): Promise<void> {
    await this.send('/me', 'DELETE', { password });
  }

  private async session(path: string, method: string, body?: unknown): Promise<Session> {
    return (await (await this.send(path, method, body)).json()) as Session;
  }

  private async send(path: string, method: string, body?: unknown): Promise<Response> {
    const res = await apiFetch(`${this.api}${path}`, {
      method,
      credentials: 'include',
      ...(body === undefined ? {} : { headers: JSON_HEADERS, body: JSON.stringify(body) }),
    });
    if (!res.ok) throw new AuthError(await errorMessage(res, 'Error de autenticación'), res.status);
    return res;
  }
}
