import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { Logo } from '@ui';

/**
 * App shell: brand bar + routing area.
 *
 * Standalone component, `OnPush` — the app runs zoneless, so every component
 * re-renders only when a signal it reads changes.
 */
@Component({
  selector: 'vela-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [RouterOutlet, RouterLink, Logo],
  templateUrl: './app.html',
})
export class App {}
