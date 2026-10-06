import { Injectable, inject } from '@angular/core';
import { Session } from '../domain/models';
import { AuthGateway } from '../domain/ports';
import { AuthError } from '../domain/session';
import { API_URL, apiFetch, errorMessage } from './api-config';

@Injectable()
export class HttpAuthGateway extends AuthGateway {
  private readonly api = inject(API_URL);

  register(username: string, password: string) {
    return this.post('/auth/register', username, password);
  }

  login(username: string, password: string) {
    return this.post('/auth/login', username, password);
  }

  async logout(): Promise<void> {
    await apiFetch(`${this.api}/auth/logout`, { method: 'POST', credentials: 'include' });
  }

  async me(): Promise<Session> {
    const res = await apiFetch(`${this.api}/me`, { credentials: 'include' });
    if (!res.ok) throw new AuthError(await errorMessage(res, 'Sesión inválida'), res.status);
    return (await res.json()) as Session;
  }

  private async post(path: string, username: string, password: string): Promise<Session> {
    const res = await apiFetch(`${this.api}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new AuthError(await errorMessage(res, 'Error de autenticación'), res.status);
    return (await res.json()) as Session;
  }
}
