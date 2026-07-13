import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';

/**
 * Application configuration.
 *
 * `provideZonelessChangeDetection()`: we run **zoneless** (no Zone.js).
 * Change detection is driven by signals — the recommended default in Angular
 * v22, and decisive here: with a stream event every 500ms–2s, Zone.js would
 * re-check the whole component tree on every timer tick, whereas signals
 * re-render only what actually changed. The app ships no zone.js polyfill.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
  ],
};
