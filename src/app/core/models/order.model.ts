/**
 * Manufacturing order (French: « ordre de fabrication », OF) model.
 *
 * Naming convention: code identifiers are in **English**, but the fields and
 * values mandated by the case-study brief stay verbatim in French
 * (`reference`, `quantitePrevue`, `en_cours`…) — they are the ubiquitous
 * language of the end users (French plant managers) and the contract of the
 * exercise. Glossary below.
 *
 * Everything is `readonly`: state lives in the signal store and components
 * only receive immutable snapshots — a stream update produces a new object
 * (stable identity by `id` for the table's `track`).
 */

/** Possible statuses of an order (single source of truth, derives the type). */
export const ORDER_STATUSES = ['en_cours', 'termine', 'bloque'] as const;

/** `en_cours` = in progress · `termine` = completed · `bloque` = blocked. */
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * French UI labels for each status — single source of truth, consumed by the
 * status filter dropdown AND the status badge. Kept next to the type so a new
 * status is a compile error until it gets a label.
 */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  en_cours: 'En cours',
  termine: 'Terminé',
  bloque: 'Bloqué',
};

/**
 * A manufacturing order.
 *
 * Unit conventions:
 * - money fields (`coutMatiere`, `coutMainOeuvre`, `prixVenteUnitaire`) in EUR;
 * - `tauxRebut` as a **0–1 ratio** (0.04 = 4%). The brief labels it "(%)" but
 *   its own margin formula uses `(1 − tauxRebut)`, i.e. expects a ratio.
 *   Storing the ratio avoids `/100` scattered through the math — conversion
 *   to "%" only exists at display time (see `shared/utils/format.ts`).
 */
export interface ManufacturingOrder {
  readonly id: string;
  /** Factory reference, e.g. "OF-2026-0042". */
  readonly reference: string;
  /** Product being manufactured. */
  readonly produit: string;
  /** Planned quantity. */
  readonly quantitePrevue: number;
  /** Quantity produced so far. */
  readonly quantiteProduite: number;
  /** Material cost incurred to date, EUR. */
  readonly coutMatiere: number;
  /** Labour cost incurred to date, EUR. */
  readonly coutMainOeuvre: number;
  /** Scrap rate, 0–1 ratio. */
  readonly tauxRebut: number;
  /** Unit selling price, EUR. */
  readonly prixVenteUnitaire: number;
  readonly statut: OrderStatus;
}
