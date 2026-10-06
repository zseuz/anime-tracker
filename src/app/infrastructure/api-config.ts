import { InjectionToken } from '@angular/core';

/** Base URL of the AnimeTracker backend (see /server). */
export const API_URL = new InjectionToken<string>('API_URL', { providedIn: 'root', factory: () => 'http://localhost:3000/api' });

/** fetch() that turns network failures and non-2xx answers into readable errors. */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error('No se pudo conectar con el servidor');
  }
  return res;
}

export async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}
