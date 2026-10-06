import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService } from './application/auth.service';

export const authGuard: CanActivateFn = () =>
  inject(AuthService).loggedIn() || inject(Router).createUrlTree(['/login']);

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login.page').then(m => m.LoginPage) },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./features/catalog/catalog.page').then(m => m.CatalogPage) },
      { path: 'anime/:id', loadComponent: () => import('./features/anime-detail/anime-detail.page').then(m => m.AnimeDetailPage) },
      { path: 'mi-lista', loadComponent: () => import('./features/watch-list/watch-list.page').then(m => m.WatchListPage) },
      { path: 'perfil', loadComponent: () => import('./features/profile/profile.page').then(m => m.ProfilePage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
