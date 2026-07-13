import type { Observable } from 'rxjs';

import type { OrderEvent } from '../models/order-event.model';
import type { ManufacturingOrder } from '../models/order.model';

/**
 * The minimal feed contract the dashboard depends on — the one seam a real
 * backend implements. A production transport would likely extend it
 * (connection status, reconnection, initial resync); kept minimal here on
 * purpose. `OrdersStream` is the in-app **simulation**; a WebSocket
 * client of the same shape drops in by swapping the provider
 * (`{ provide: OrdersFeed, useExisting: OrdersStream }` in `app.config`),
 * leaving the store and components untouched.
 *
 * An **abstract class** (not just a TS `interface`) so it doubles as the DI
 * token: the store does `inject(OrdersFeed)` against the contract, never the
 * concrete class.
 */
export abstract class OrdersFeed {
  /** Orders present at startup — the initial snapshot the store materializes. */
  abstract readonly initialOrders: readonly ManufacturingOrder[];

  /** Live updates — one full-snapshot event per change. */
  abstract readonly events$: Observable<OrderEvent>;
}
