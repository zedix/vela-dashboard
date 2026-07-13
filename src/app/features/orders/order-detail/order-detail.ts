import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { computeMargin, computeRevenue } from '../../../core/domain/pnl';
import type { ManufacturingOrder } from '../../../core/models/order.model';
import { Button, Drawer, Progress } from '@ui';
import { formatPrice, formatRate, formatSignedPrice } from '@shared/utils';
import { OrderDetailRow } from './order-detail-row';
import { StatusBadge } from '../status-badge';

/**
 * Order detail — the OF-specific *content* projected into a `<vela-drawer>`.
 *
 * **Dumb component**: it owns no state and never touches the store. It receives
 * the order through a signal `input()` and reports the close intent through an
 * `output()`. The parent binds `[order]="store.selectedOrder()"`, so a stream
 * update to the selected order refreshes the panel on its own.
 *
 * All modal mechanics (native `<dialog>`, `showModal`, backdrop, Esc, focus
 * trap, single-source open/close) live in the reusable `Drawer` primitive —
 * this component only maps `order` → open state and lays out the P&L.
 *
 * The P&L block re-tells `computeMargin` visually: revenue on good quantities
 * − costs = margin.
 */
@Component({
  selector: 'vela-order-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Drawer, Progress, StatusBadge, OrderDetailRow],
  templateUrl: './order-detail.html',
})
export class OrderDetail {
  /** The order to display — `null` keeps the drawer closed. */
  readonly order = input.required<ManufacturingOrder | null>();

  /** Emitted when the drawer is dismissed (Esc, backdrop, button). */
  readonly closed = output<void>();

  protected readonly margin = computed(() => {
    const order = this.order();
    return order === null ? 0 : computeMargin(order);
  });

  /** Revenue on good quantities — the positive leg of the margin. */
  protected readonly revenue = computed(() => {
    const order = this.order();
    return order === null ? 0 : computeRevenue(order);
  });

  protected readonly formatPrice = formatPrice;
  protected readonly formatRate = formatRate;
  protected readonly formatSignedPrice = formatSignedPrice;
}
