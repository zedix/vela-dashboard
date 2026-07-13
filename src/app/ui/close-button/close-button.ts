import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type CloseButtonAppearance = 'square' | 'circle';

/**
 * Close button — an icon-only `<button>` for dismissing a drawer/dialog.
 *
 * Accessibility-first: renders a real `<button>` (keyboard + focus for free),
 * defaults its accessible name to "Fermer" (overridable via `label`), and the
 * ✕ is a masked SVG so no icon font is needed. `(click)` on `<vela-close-button>`
 * works — the inner button's click bubbles.
 *
 * Design-system primitive: styled only from `--v-*` tokens. Modelled on
 * Luxen's close-button.
 */
@Component({
  selector: 'vela-close-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-appearance]': 'appearance()' },
  template: `<button class="close" type="button" [attr.aria-label]="label()"></button>`,
  styleUrl: './close-button.css',
})
export class CloseButton {
  readonly appearance = input<CloseButtonAppearance>('square');
  readonly label = input('Fermer');
}
