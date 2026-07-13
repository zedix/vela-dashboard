import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type BadgeAppearance = 'outlined' | 'filled' | 'filled-outlined';
export type BadgeSize = 'sm' | 'md' | 'lg';

/**
 * Badge — a status pill. The `<vela-badge>` host **is** the pill (no wrapper):
 * inputs are reflected onto the host as `data-*` and the CSS selects on them
 * (`:host([data-variant='…'])`), the label is projected in.
 *
 * Design-system primitive: no domain knowledge, styled only from the semantic
 * `--v-*` tokens. Modelled on Luxen's badge — `variant` sets the text colour,
 * `appearance` derives the background/border from it, `size`/`pill` tune shape.
 */
@Component({
  selector: 'vela-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-variant]': 'variant()',
    '[attr.data-appearance]': 'appearance()',
    '[attr.data-size]': 'size()',
    '[attr.data-pill]': "pill() ? '' : null",
  },
  template: `<ng-content />`,
  styleUrl: './badge.css',
})
export class Badge {
  readonly variant = input<BadgeVariant>('neutral');
  readonly appearance = input<BadgeAppearance>('outlined');
  readonly size = input<BadgeSize>('md');
  readonly pill = input(false, { transform: booleanAttribute });
}
