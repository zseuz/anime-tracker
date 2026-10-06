import { Injectable, inject } from '@angular/core';
import { TrackedAnime } from '../domain/models';
import { WatchListRepository } from '../domain/ports';
import { API_URL, apiFetch, errorMessage } from './api-config';

@Injectable()
export class HttpWatchListRepository extends WatchListRepository {
  private readonly api = inject(API_URL);

  async load(): Promise<TrackedAnime[]> {
    const res = await apiFetch(`${this.api}/list`, { credentials: 'include' });
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo cargar tu lista'));
    return (await res.json()) as TrackedAnime[];
  }

  async save(list: readonly TrackedAnime[]): Promise<void> {
    const res = await apiFetch(`${this.api}/list`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(list),
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo guardar tu lista'));
  }
}
