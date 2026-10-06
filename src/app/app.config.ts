import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { isDevMode } from '@angular/core';
import { AnimeCatalog, AuthGateway, KeyValueStore, Notifier, WatchListRepository } from './domain/ports';
import { AniListAnimeCatalog } from './infrastructure/anilist-anime-catalog';
import { BrowserNotifier } from './infrastructure/browser-notifier';
import { HttpAuthGateway } from './infrastructure/http-auth-gateway';
import { HttpWatchListRepository } from './infrastructure/http-watch-list-repository';
import { LocalStorageStore } from './infrastructure/local-storage-store';
import { routes } from './app.routes';

/** Composition root: the only place that binds ports to concrete adapters. */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    { provide: AnimeCatalog, useClass: AniListAnimeCatalog },
    { provide: KeyValueStore, useClass: LocalStorageStore },
    { provide: AuthGateway, useClass: HttpAuthGateway },
    { provide: WatchListRepository, useClass: HttpWatchListRepository },
    { provide: Notifier, useClass: BrowserNotifier },
  ],
};
