import { Injectable } from '@angular/core';
import { expand, map, share, timer, type Observable } from 'rxjs';

import { pick, randomBetween, randomInt } from '@shared/utils';
import { createInitialOrders, createNewOrder } from '../data/order-generator';
import type { OrderEvent, OrderUpdateKind } from '../models/order-event.model';
import type { ManufacturingOrder } from '../models/order.model';
import { OrdersFeed } from './orders-feed';

const INITIAL_COUNT = 50;
const MIN_DELAY_MS = 500;
const MAX_DELAY_MS = 2_000;

/**
 * Real-time stream simulator — plays the backend's role.
 *
 * Why **RxJS** here (and not signals): an event stream is a series of facts
 * **over time** (random cadence, cancellable) — that is the semantics of an
 * `Observable`. A signal represents a *current value*, not an event. The
 * stream→state conversion happens in exactly one place, the store (next
 * commit) — never in components.
 *
 * The service owns the simulation's truth (internal `orders` mirror) and
 * implements the `OrdersFeed` contract — the store depends on that abstraction,
 * not this class (see `orders-feed.ts`).
 *
 * `events$` is **cold until subscribed** (nothing runs without a listener →
 * no ghost work) then multicast via `share()`: a hypothetical second
 * subscriber would not spawn a second timer chain. Note it is a **stateful
 * multicast** source, not a pure/replayable cold stream: the simulator's own
 * state (`orders`, `nextSeq`) lives on the instance and survives a
 * resubscription — a new subscriber *continues* the simulation, it does not
 * replay it from the start. Cleanup belongs to the consumer (the store
 * subscribes with `takeUntilDestroyed`).
 */
@Injectable({ providedIn: 'root' })
export class OrdersStream implements OrdersFeed {
  /** Internal simulation mirror — the "backend-side" state. */
  private readonly orders = new Map<string, ManufacturingOrder>();

  /** Next serial number for OF-2026-XXXX references. */
  private nextSeq = INITIAL_COUNT + 1;

  readonly initialOrders: readonly ManufacturingOrder[] = createInitialOrders(INITIAL_COUNT);

  /**
   * One event every 500ms–2s (delay re-drawn on every tick).
   *
   * `timer` + `expand`: `expand` re-subscribes a fresh `timer` after each
   * emission → random cadence *per event*, where `interval` would impose a
   * fixed period. Everything stays declarative and cancellable (the
   * consumer's unsubscribe tears down the pending timer — no `setInterval`
   * to clean up by hand).
   */
  readonly events$: Observable<OrderEvent> = timer(randomDelay()).pipe(
    expand(() => timer(randomDelay())),
    map(() => this.nextEvent()),
    share(),
  );

  constructor() {
    for (const order of this.initialOrders) {
      this.orders.set(order.id, order);
    }
  }

  /**
   * Draws the next event, weighted: ~50% progress, ~25% cost, ~15% status,
   * ~10% creation. If no order is eligible for the drawn type (e.g. nothing
   * in progress anymore), fall back to a creation — the stream never dries
   * up.
   */
  private nextEvent(): OrderEvent {
    const roll = Math.random();
    if (roll < 0.1) return this.createEvent();
    if (roll < 0.25) return this.statusEvent() ?? this.createEvent();
    if (roll < 0.5) return this.costEvent() ?? this.createEvent();
    return this.progressEvent() ?? this.costEvent() ?? this.createEvent();
  }

  private createEvent(): OrderEvent {
    const order = createNewOrder(this.nextSeq++);
    this.orders.set(order.id, order);
    return { kind: 'created', order };
  }

  /** Production advances by 2–10% of the plan (capped at the plan). */
  private progressEvent(): OrderEvent | null {
    const candidate = this.pickWhere(
      (o) => o.statut === 'en_cours' && o.quantiteProduite < o.quantitePrevue,
    );
    if (!candidate) return null;

    const step = Math.max(1, Math.round(candidate.quantitePrevue * randomBetween(0.02, 0.1)));
    const quantiteProduite = Math.min(candidate.quantitePrevue, candidate.quantiteProduite + step);
    return this.commit({ ...candidate, quantiteProduite }, 'progress');
  }

  /** One of the two costs drifts by ±1–6% (supply hazards, overtime…). */
  private costEvent(): OrderEvent | null {
    const candidate = this.pickWhere((o) => o.statut === 'en_cours');
    if (!candidate) return null;

    const factor = 1 + randomBetween(0.01, 0.06) * (Math.random() < 0.5 ? -1 : 1);
    const patch: Partial<ManufacturingOrder> =
      Math.random() < 0.5
        ? { coutMatiere: Math.max(0, Math.round(candidate.coutMatiere * factor)) }
        : { coutMainOeuvre: Math.max(0, Math.round(candidate.coutMainOeuvre * factor)) };
    return this.commit({ ...candidate, ...patch }, 'cost');
  }

  /**
   * Plausible transitions: an in-progress order completes (if production is
   * ≥ 80%) or gets blocked; a blocked order restarts. `termine` is terminal.
   */
  private statusEvent(): OrderEvent | null {
    const candidate = this.pickWhere((o) => o.statut !== 'termine');
    if (!candidate) return null;

    const statut =
      candidate.statut === 'bloque'
        ? 'en_cours'
        : candidate.quantiteProduite >= candidate.quantitePrevue * 0.8 && Math.random() < 0.6
          ? 'termine'
          : 'bloque';
    return this.commit({ ...candidate, statut }, 'status');
  }

  /** Applies an immutable update to the mirror and builds the event. */
  private commit(order: ManufacturingOrder, change: OrderUpdateKind): OrderEvent {
    this.orders.set(order.id, order);
    return { kind: 'updated', change, order };
  }

  private pickWhere(predicate: (order: ManufacturingOrder) => boolean): ManufacturingOrder | null {
    const candidates = [...this.orders.values()].filter(predicate);
    if (candidates.length === 0) return null;
    // Uniform pick: `randomInt` would half-weight the first/last candidate
    // (Math.round buckets the endpoints), biasing selection toward the middle.
    return pick(candidates);
  }
}

function randomDelay(): number {
  return randomInt(MIN_DELAY_MS, MAX_DELAY_MS);
}
