import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Vela wordmark — the brand logo rendered as an inline SVG (`currentColor`), so
 * it takes its colour from the surrounding text token and stays crisp at any
 * size. `width`/`height` control the rendered box; the 203×65 viewBox keeps the
 * aspect ratio.
 *
 * Presentational and self-contained. It is the one brand-specific member of the
 * otherwise generic design system, but it still imports nothing from
 * `core/`/`features/` and is coloured only from `--v-*` tokens — so it lives
 * here with the other `vela-*` primitives.
 */
@Component({
  selector: 'vela-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'img', 'aria-label': 'Vela' },
  templateUrl: './logo.html',
  styleUrl: './logo.css',
})
export class Logo {
  readonly width = input<number | string>(81);
  readonly height = input<number | string>(26);
}
