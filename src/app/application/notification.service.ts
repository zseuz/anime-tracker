import { Injectable, computed, inject, signal } from '@angular/core';
import { KeyValueStore, NotificationPermissionState, Notifier } from '../domain/ports';

export const NOTIFY_PREF_KEY = 'at.notify';

/** Opt-in system notifications for new episodes. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly notifier = inject(Notifier);
  private readonly store = inject(KeyValueStore);

  private readonly wanted = signal(this.store.get<boolean>(NOTIFY_PREF_KEY, false));
  private readonly permission = signal<NotificationPermissionState>(this.notifier.permission());

  readonly supported = computed(() => this.permission() !== 'unsupported');
  readonly blocked = computed(() => this.permission() === 'denied');
  /** Wanted by the user and allowed by the browser. */
  readonly enabled = computed(() => this.wanted() && this.permission() === 'granted');

  /** Turns notifications on (asking the browser for permission if needed) or off. */
  async toggle(): Promise<void> {
    if (this.enabled()) {
      this.setWanted(false);
      return;
    }
    if (this.permission() !== 'granted') this.permission.set(await this.notifier.requestPermission());
    this.setWanted(this.permission() === 'granted');
  }

  notifyNewEpisodes(title: string, count: number): void {
    if (!this.enabled()) return;
    this.notifier.notify(title, count === 1 ? '1 capítulo nuevo disponible' : `${count} capítulos nuevos disponibles`);
  }

  private setWanted(value: boolean) {
    this.wanted.set(value);
    this.store.set(NOTIFY_PREF_KEY, value);
  }
}
