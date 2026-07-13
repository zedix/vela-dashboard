import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  computeAggregates,
  computeMargin,
  filterOrders,
  NO_FILTER,
  sortOrders,
  type OrderFilter,
  type OrderSort,
  type SortKey,
} from '../domain/pnl';
import type { OrderEvent } from '../models/order-event.model';
import type { ManufacturingOrder, OrderStatus } from '../models/order.model';
import { OrdersFeed } from '../stream/orders-feed';

/**
 * Signal store for the dashboard — the single owner of UI state.
 *
 * Shape (hand-rolled, NgRx-free):
 *  - private writable `signal()`s, exposed read-only;
 *  - derivations as `computed()` chains composing the pure domain functions;
 *  - mutations encapsulated in methods (components never write signals).
 *
 * This is also where the ONE RxJS→signal seam lives: the constructor
 * subscribes to the stream (`takeUntilDestroyed` ties the subscription to the
 * store's lifetime — for a root service, the app's lifetime) and reduces each
 * event into `_orders` via `apply()`. Components never see an Observable.
 *
 * Derivation chain — lazy, memoized computeds. A layer recomputes only when
 * read after an input changed, and one computation is shared across all its
 * readers in a tick. So a filter/sort keystroke invalidates only
 * `filteredOrders`/`visibleOrders` downward (the stream is never re-read),
 * while a stream event — which does touch every layer — still costs one
 * recompute per layer per tick, not one per reader:
 *
 *   _orders ─┬─ allOrders ── filteredOrders ─┬─ visibleOrders (+ _sort)
 *            │                (+ _filter)    └─ aggregates
 *            └─ selectedOrder (+ _selectedId)
 */
/** How long a row stays flagged as "just updated" (brief: ~1s). */
const HIGHLIGHT_MS = 1_000;

/** Sliding window of the margin chart: number of points kept. */
export const MARGIN_HISTORY_CAPACITY = 120;

@Injectable({ providedIn: 'root' })
export class OrdersStore {
  private readonly stream = inject(OrdersFeed);
  private readonly destroyRef = inject(DestroyRef);

  // --- State: private writable signals -----------------------------------

  /** Keyed by id: the stream's upserts are O(1) lookups. */
  private readonly _orders = signal<ReadonlyMap<string, ManufacturingOrder>>(
    new Map(this.stream.initialOrders.map((order) => [order.id, order])),
  );
  private readonly _filter = signal<OrderFilter>(NO_FILTER);
  private readonly _sort = signal<OrderSort | null>(null);
  private readonly _selectedId = signal<string | null>(null);

  /**
   * Ids of orders updated in the last ~1s (row highlight). One pending timer
   * per id, reset when the same order changes again — so the highlight lasts
   * 1s after the LAST update, and timers can never accumulate.
   */
  private readonly _recentlyUpdated = signal<ReadonlySet<string>>(new Set());
  private readonly highlightTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Total margin (over ALL orders, not the filtered view — the history must
   * not rewrite itself when the user plays with filters) sampled after each
   * stream event. Temporal accumulation → state, not a computed. Bounded ring
   * buffer: the slice IS the sliding window.
   */
  private readonly _marginHistory = signal<readonly number[]>([]);

  // --- Public read-only state --------------------------------------------

  readonly filter = this._filter.asReadonly();
  readonly sort = this._sort.asReadonly();
  readonly recentlyUpdated = this._recentlyUpdated.asReadonly();
  readonly marginHistory = this._marginHistory.asReadonly();

  // --- Derivations (pure domain functions composed in computeds) ---------

  private readonly allOrders = computed(() => [...this._orders().values()]);

  private readonly filteredOrders = computed(() => filterOrders(this.allOrders(), this._filter()));

  /** What the table renders: filtered then sorted. */
  readonly visibleOrders = computed(() => sortOrders(this.filteredOrders(), this._sort()));

  /** Header aggregates — over the FILTERED list, per the brief. */
  readonly aggregates = computed(() => computeAggregates(this.filteredOrders()));

  /**
   * The order shown in the detail drawer. Derived from `_orders` by id, so a
   * stream update to the selected order refreshes the drawer for free.
   */
  readonly selectedOrder = computed<ManufacturingOrder | null>(() => {
    const id = this._selectedId();
    return id === null ? null : (this._orders().get(id) ?? null);
  });

  constructor() {
    this.pushMarginPoint(); // starting point of the chart

    // The one seam: events flow in here and nowhere else.
    this.stream.events$.pipe(takeUntilDestroyed()).subscribe((event) => this.apply(event));

    // Root store ≈ app lifetime, but the hygiene stays explicit — and would
    // matter as-is if the store were ever provided at component level.
    this.destroyRef.onDestroy(() => {
      for (const timer of this.highlightTimers.values()) clearTimeout(timer);
      this.highlightTimers.clear();
    });
  }

  // --- Mutations: the only write paths ------------------------------------

  setStatusFilter(status: OrderStatus | 'all'): void {
    this._filter.update((filter) => ({ ...filter, status }));
  }

  setSearch(search: string): void {
    this._filter.update((filter) => ({ ...filter, search }));
  }

  /** First click sorts ascending; clicking the same column flips direction. */
  toggleSort(key: SortKey): void {
    this._sort.update((sort) =>
      sort?.key === key
        ? { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  }

  select(id: string | null): void {
    this._selectedId.set(id);
  }

  /**
   * Reduces one stream event into state. Both event kinds carry the full
   * order snapshot → a plain idempotent upsert by id, insensitive to event
   * ordering. A new Map identity is required: computeds react to reference
   * changes, never to in-place mutation.
   */
  private apply(event: OrderEvent): void {
    this._orders.update((orders) => new Map(orders).set(event.order.id, event.order));
    this.markRecentlyUpdated(event.order.id);
    this.pushMarginPoint();
  }

  /** Samples the global total margin into the bounded history. */
  private pushMarginPoint(): void {
    let total = 0;
    for (const order of this._orders().values()) total += computeMargin(order);

    this._marginHistory.update((points) => {
      const next = [...points, total];
      return next.length > MARGIN_HISTORY_CAPACITY
        ? next.slice(next.length - MARGIN_HISTORY_CAPACITY)
        : next;
    });
  }

  /** Flags an id for ~1s; a repeat update on the same id resets its timer. */
  private markRecentlyUpdated(id: string): void {
    this._recentlyUpdated.update((ids) => new Set(ids).add(id));

    clearTimeout(this.highlightTimers.get(id));
    this.highlightTimers.set(
      id,
      setTimeout(() => {
        this.highlightTimers.delete(id);
        this._recentlyUpdated.update((ids) => {
          const next = new Set(ids);
          next.delete(id);
          return next;
        });
      }, HIGHLIGHT_MS),
    );
  }
}
