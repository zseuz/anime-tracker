import { DOCUMENT } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from './application/auth.service';
import { EpisodeWatcher } from './application/episode-watcher.service';
import { NotificationService } from './application/notification.service';
import { ThemeService } from './application/theme.service';
import { WatchListService } from './application/watch-list.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatBadgeModule, MatButtonModule, MatIconModule,
    MatToolbarModule, MatTooltipModule],
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

  constructor() {
    inject(EpisodeWatcher); // starts background checks for new episodes while signed in
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
