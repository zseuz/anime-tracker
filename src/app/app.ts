import { DOCUMENT } from '@angular/common';
import { Component, computed, effect, inject, untracked } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from './application/auth.service';
import { EpisodeWatcher } from './application/episode-watcher.service';
import { NotificationService } from './application/notification.service';
import { ThemeService } from './application/theme.service';
import { WatchListService } from './application/watch-list.service';
import { avatarGradient } from './shared/avatar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatBadgeModule, MatButtonModule, MatDividerModule,
    MatIconModule, MatMenuModule, MatToolbarModule, MatTooltipModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly watchList = inject(WatchListService);
  protected readonly theme = inject(ThemeService);
  protected readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  /** First letter of the username, shown in the avatar. */
  protected readonly initial = computed(() => (this.auth.user() ?? '?').charAt(0).toUpperCase());

  /** Gradient of the avatar colour the user picked in their profile. */
  protected readonly gradient = computed(() => avatarGradient(this.auth.avatar()));

  constructor() {
    inject(EpisodeWatcher); // starts background checks for new episodes while signed in

    // If the session ends for any reason (expired, signed out elsewhere, server restarted),
    // leave the protected pages instead of showing them without the navigation.
    effect(() => {
      if (this.auth.loggedIn()) return;
      untracked(() => {
        if (!this.router.url.startsWith('/login')) void this.router.navigateByUrl('/login');
      });
    });
  }

  /** Skip link: moves focus to the page content (keyboard and screen-reader users). */
  protected skipToContent(event: Event) {
    event.preventDefault();
    this.document.getElementById('main')?.focus();
  }

  protected logout() {
    this.auth.logout();
    return this.router.navigateByUrl('/login');
  }

  protected get bellLabel() {
    if (this.notifications.blocked()) return 'Notificaciones bloqueadas en el navegador';
    return this.notifications.enabled() ? 'Desactivar notificaciones' : 'Activar notificaciones de capítulos nuevos';
  }
}
