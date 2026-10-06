import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, untracked } from '@angular/core';
import { AuthService } from './auth.service';
import { WatchListService } from './watch-list.service';

export const CHECK_INTERVAL_MS = 15 * 60 * 1000;
/** Minimum gap between two checks, however they were triggered. */
export const MIN_GAP_MS = 5 * 60 * 1000;

/**
 * While someone is signed in: looks for new episodes right after the list loads,
 * every 15 minutes, and whenever the tab becomes visible again.
 */
@Injectable({ providedIn: 'root' })
export class EpisodeWatcher {
  private readonly auth = inject(AuthService);
  private readonly watchList = inject(WatchListService); // injected first so its load effect runs before ours
  private readonly document = inject(DOCUMENT);
  private lastRun = 0;

  constructor() {
    effect(onCleanup => {
      if (!this.auth.loggedIn()) return;

      const run = () => {
        const now = Date.now();
        if (now - this.lastRun < MIN_GAP_MS) return;
        this.lastRun = now;
        void this.watchList.checkForNewEpisodes();
      };
      const onVisible = () => {
        if (this.document.visibilityState === 'visible') run();
      };

      // Only the sign-in state may re-run this effect; whatever the check reads must not.
      untracked(() => {
        this.lastRun = 0;
        run();
      });
      const timer = setInterval(() => {
        this.lastRun = 0; // the interval itself is the throttle
        run();
      }, CHECK_INTERVAL_MS);
      this.document.addEventListener('visibilitychange', onVisible);

      onCleanup(() => {
        clearInterval(timer);
        this.document.removeEventListener('visibilitychange', onVisible);
      });
    });
  }
}
