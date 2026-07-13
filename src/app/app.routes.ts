import { Routes } from '@angular/router';

/**
 * SPA routes. Each feature is a **lazy-loaded** standalone component
 * (`loadComponent`): a route's code is only fetched on navigation.
 *
 * The order detail is a panel (`<vela-drawer>`) driven by the store, not a
 * route: see the `orders` feature.
 */
export const routes: Routes = [
  {
    path: '',
    title: 'Ordres de fabrication — Vela',
    loadComponent: () => import('./features/orders/orders').then((m) => m.Orders),
  },
  { path: '**', redirectTo: '' },
];
