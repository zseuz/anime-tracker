import { Injectable } from '@angular/core';
import { NotificationPermissionState, Notifier } from '../domain/ports';

/** System notifications through the browser's Notification API. */
@Injectable()
export class BrowserNotifier extends Notifier {
  permission(): NotificationPermissionState {
    return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  }

  async requestPermission(): Promise<NotificationPermissionState> {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.requestPermission();
  }

  notify(title: string, body: string): void {
    if (this.permission() !== 'granted') return;
    new Notification(title, { body, icon: 'favicon.ico', tag: title });
  }
}
