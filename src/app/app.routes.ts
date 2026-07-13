import { Routes } from '@angular/router';

/**
 * SPA routes. A single route for now; features will be attached here as
 * **lazy-loaded** standalone components (`loadComponent`) once they exist.
 */
export const routes: Routes = [
  { path: '', title: 'Ordres de fabrication — Vela' },
  { path: '**', redirectTo: '' },
];
