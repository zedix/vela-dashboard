import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { STATUS_LABELS, type OrderStatus } from '../../core/models/order.model';
import { Badge, type BadgeVariant } from '@ui';

/** Badge variant per order status — the single status→appearance mapping. */
const STATUS_VARIANTS: Record<OrderStatus, BadgeVariant> = {
  en_cours: 'info',
  termine: 'success',
  bloque: 'danger',
};

/**
 * Domain wrapper: turns an `OrderStatus` into a `<vela-badge>` with the right
 * variant and French label. The single place that knows how a status looks —
 * reused by the table and the detail panel. Adds domain meaning over the
 * design-system badge primitive.
 */
@Component({
  selector: 'vela-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Badge],
  template: `<vela-badge [variant]="variant()" appearance="filled-outlined" pill>{{
    label()
  }}</vela-badge>`,
})
export class StatusBadge {
  readonly status = input.required<OrderStatus>();

  protected readonly variant = computed(() => STATUS_VARIANTS[this.status()]);
  protected readonly label = computed(() => STATUS_LABELS[this.status()]);
}
