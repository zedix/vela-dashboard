import type { ManufacturingOrder, OrderStatus } from '../models/order.model';

/**
 * P&L logic for manufacturing orders — **pure** functions, no Angular.
 *
 * This is the testable core of the app: the signal store merely composes
 * these functions inside `computed()`, and components implement no math at
 * all.
 */

/**
 * Revenue on the good (non-scrap) quantities, in EUR:
 *
 *   prixVenteUnitaire × quantiteProduite × (1 − tauxRebut)
 *
 * `tauxRebut` is a 0–1 ratio (see model). This is the positive leg of the
 * margin; the detail panel breaks it out, so it lives here as one source.
 */
export function computeRevenue(order: ManufacturingOrder): number {
  return order.prixVenteUnitaire * order.quantiteProduite * (1 - order.tauxRebut);
}

/**
 * Margin of an order, in EUR: revenue on good quantities − costs incurred
 * (`computeRevenue(order) − (coutMatiere + coutMainOeuvre)`). Can be negative
 * (costs already incurred while production is still low, or scrap is high).
 */
export function computeMargin(order: ManufacturingOrder): number {
  return computeRevenue(order) - (order.coutMatiere + order.coutMainOeuvre);
}

/** Header aggregates — computed over the *filtered* list. */
export interface OrderAggregates {
  /** Sum of margins, EUR. */
  readonly totalMargin: number;
  /** Number of orders with status `en_cours`. */
  readonly inProgressCount: number;
  /** Simple average of scrap rates, 0–1 ratio (0 for an empty list). */
  readonly averageScrapRate: number;
}

/**
 * Computes all aggregates in a single pass.
 *
 * `averageScrapRate` is a **simple** average (every order weighs the same),
 * not weighted by quantities — deliberate choice: it is the most readable
 * "order health" indicator, and swapping in the weighted version here would
 * be trivial without touching the UI.
 */
export function computeAggregates(orders: readonly ManufacturingOrder[]): OrderAggregates {
  if (orders.length === 0) {
    return { totalMargin: 0, inProgressCount: 0, averageScrapRate: 0 };
  }

  let totalMargin = 0;
  let inProgressCount = 0;
  let scrapRateSum = 0;
  for (const order of orders) {
    totalMargin += computeMargin(order);
    if (order.statut === 'en_cours') inProgressCount++;
    scrapRateSum += order.tauxRebut;
  }

  return { totalMargin, inProgressCount, averageScrapRate: scrapRateSum / orders.length };
}

/** Table filter criteria. `status: 'all'` disables the status filter. */
export interface OrderFilter {
  readonly status: OrderStatus | 'all';
  /** Text search on reference and product (case/accent-insensitive). */
  readonly search: string;
}

export const NO_FILTER: OrderFilter = { status: 'all', search: '' };

/**
 * Normalizes text for case- and accent-insensitive search matching:
 * lowercases, then strips diacritics ("Défaut" → "defaut") so the search
 * ignores accents.
 */
function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD') // decompose "é" into "e" + combining accent…
    .replace(/[\u0300-\u036f]/g, ''); // …then drop the combining accents
}

/**
 * Filters the list by status and text search.
 *
 * The search matches `reference` OR `produit`, ignoring case and accents
 * ("defaut" matches "Défaut").
 */
export function filterOrders(
  orders: readonly ManufacturingOrder[],
  filter: OrderFilter,
): readonly ManufacturingOrder[] {
  const byStatus =
    filter.status === 'all' ? orders : orders.filter((order) => order.statut === filter.status);

  const needle = normalizeForSearch(filter.search.trim());
  if (needle === '') return byStatus;

  return byStatus.filter(
    (order) =>
      normalizeForSearch(order.reference).includes(needle) ||
      normalizeForSearch(order.produit).includes(needle),
  );
}

/** Sortable columns: raw fields (verbatim names) + the computed margin. */
export type SortKey =
  'reference' | 'produit' | 'quantiteProduite' | 'tauxRebut' | 'margin' | 'statut';

export type SortDirection = 'asc' | 'desc';

export interface OrderSort {
  readonly key: SortKey;
  readonly direction: SortDirection;
}

/** Value extracted for comparison, per column. */
const SORT_ACCESSORS: Record<SortKey, (order: ManufacturingOrder) => number | string> = {
  reference: (order) => order.reference,
  produit: (order) => order.produit,
  quantiteProduite: (order) => order.quantiteProduite,
  tauxRebut: (order) => order.tauxRebut,
  margin: computeMargin,
  statut: (order) => order.statut,
};

/** Compares two column values: strings by French locale, numbers numerically. */
function compareValues(a: number | string, b: number | string): number {
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, 'fr');
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return 0; // mixed types never occur (accessor is fixed per key) — explicit guard
}

/**
 * Returns the input unchanged when no sort is active (preserving referential
 * identity, so the downstream computeds stay memoized); otherwise sorts a copy
 * — never mutates, since signals rely on immutability. Strings compare with the
 * French locale (accents), numbers numerically. `Array.prototype.sort` is
 * spec-stable: equal rows keep their stream order.
 */
export function sortOrders(
  orders: readonly ManufacturingOrder[],
  sort: OrderSort | null,
): readonly ManufacturingOrder[] {
  if (sort === null) return orders;

  const accessor = SORT_ACCESSORS[sort.key];
  const direction = sort.direction === 'asc' ? 1 : -1;

  return [...orders].sort((a, b) => compareValues(accessor(a), accessor(b)) * direction);
}
