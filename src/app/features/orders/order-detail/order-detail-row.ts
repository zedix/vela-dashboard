import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * One labelled value line of the detail panel: a left-aligned label and a
 * right-aligned, tabular value. The value is **projected**, so callers keep
 * full control of it — a sub-quantity, a leading `−`, a colour-coded margin.
 *
 * Presentational and feature-local: it factors out the row repeated across the
 * detail panel's sections. It stays here (not in `ui/`) until a second feature
 * needs it — promoting it to the design system is then a move, not a rewrite.
 */
@Component({
  selector: 'vela-order-detail-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-baseline justify-between gap-3 text-sm' },
  template: `<span class="text-secondary" [class.pl-3]="indent()">{{ label() }}</span>
    <span class="tabular-nums"><ng-content /></span>`,
})
export class OrderDetailRow {
  readonly label = input.required<string>();

  /** Indents the label — for sub-items nested under a total (the cost legs). */
  readonly indent = input(false, { transform: booleanAttribute });
}
