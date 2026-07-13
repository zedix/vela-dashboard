import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { computeMargin, type SortKey } from '../../core/domain/pnl';
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  type ManufacturingOrder,
  type OrderStatus,
} from '../../core/models/order.model';
import { OrdersStore } from '../../core/store/orders-store';
import { formatRate, formatSignedPrice } from '@shared/utils';
import { StatCard } from './stat-card';
import { StatusBadge } from './status-badge';

/** Row view-model: margin is computed once per row, in one place. */
interface OrderRow {
  readonly order: ManufacturingOrder;
  readonly margin: number;
}

/** Column definition: header label + its sort key. */
interface Column {
  readonly key: SortKey;
  readonly label: string;
  readonly numeric?: boolean;
}

const COLUMNS: readonly Column[] = [
  { key: 'reference', label: 'Référence' },
  { key: 'produit', label: 'Produit' },
  { key: 'statut', label: 'Statut' },
  { key: 'quantiteProduite', label: 'Production', numeric: true },
  { key: 'tauxRebut', label: 'Rebut', numeric: true },
  { key: 'margin', label: 'Marge', numeric: true },
];

/**
 * Real-time manufacturing-orders dashboard: header aggregates, filters,
 * sortable table with computed margin and ~1s update highlight.
 *
 * Thin view over `OrdersStore`: every piece of logic lives in the store or
 * the pure domain — this class only adapts DOM events and formats values.
 * Layout is utility-first (Tailwind, resolving the `--v-*` tokens via the
 * `@theme` bridge); the native filter controls keep the `.field` class.
 */
@Component({
  selector: 'vela-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [StatCard, StatusBadge],
  templateUrl: './orders.html',
  styleUrl: './orders.css',
})
export class Orders {
  protected readonly store = inject(OrdersStore);

  protected readonly columns = COLUMNS;
  protected readonly statuses = ORDER_STATUSES;
  protected readonly statusLabels = STATUS_LABELS;

  protected readonly rows = computed<readonly OrderRow[]>(() =>
    this.store.visibleOrders().map((order) => ({ order, margin: computeMargin(order) })),
  );

  // Formatting helpers exposed to the template.
  protected readonly formatRate = formatRate;
  protected readonly formatSignedPrice = formatSignedPrice;

  protected onSearch(event: Event): void {
    this.store.setSearch((event.target as HTMLInputElement).value);
  }

  protected onStatusChange(event: Event): void {
    this.store.setStatusFilter((event.target as HTMLSelectElement).value as OrderStatus | 'all');
  }

  /** `aria-sort` value for a column header. */
  protected ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    const sort = this.store.sort();
    if (sort?.key !== key) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }
}
