import type { ManufacturingOrder } from './order.model';

/**
 * Real-time stream events — what an actual backend would push over a
 * WebSocket. Discriminated union on `kind`: the store reduces them into
 * state and TypeScript guarantees exhaustive handling.
 */

/** Nature of an order update (the brief's 3 update cases, besides creation). */
export type OrderUpdateKind = 'progress' | 'cost' | 'status';

export type OrderEvent =
  /** A new manufacturing order was just launched. */
  | { readonly kind: 'created'; readonly order: ManufacturingOrder }
  /**
   * An existing order changed. `order` is the full up-to-date snapshot (not a
   * delta): applying it in the store is a plain replace-by-`id`, and `change`
   * remains available to the UI (row highlight, activity log).
   */
  | {
      readonly kind: 'updated';
      readonly change: OrderUpdateKind;
      readonly order: ManufacturingOrder;
    };
