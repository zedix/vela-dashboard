import { describe, expect, it } from 'vitest';

import type { ManufacturingOrder } from '../models/order.model';
import {
  computeAggregates,
  computeMargin,
  computeRevenue,
  filterOrders,
  NO_FILTER,
  sortOrders,
} from './pnl';

/**
 * Tests for the critical logic (heart of the brief): revenue, margin,
 * aggregates, filtering, sorting. Pure functions → no TestBed, no DOM.
 */

/** Builds a plausible order; each test only overrides what it verifies. */
function makeOrder(overrides: Partial<ManufacturingOrder> = {}): ManufacturingOrder {
  return {
    id: 'of-1',
    reference: 'OF-2026-0001',
    produit: 'Carter aluminium',
    quantitePrevue: 100,
    quantiteProduite: 80,
    coutMatiere: 1_000,
    coutMainOeuvre: 500,
    tauxRebut: 0.05,
    prixVenteUnitaire: 30,
    statut: 'en_cours',
    ...overrides,
  };
}

describe('computeRevenue()', () => {
  it('bills only the produced, non-scrap quantities', () => {
    // €30 × 80 × (1 − 0.05) = €2,280.
    expect(computeRevenue(makeOrder())).toBe(2_280);
  });
});

describe('computeMargin()', () => {
  it('applies revenue on good quantities minus incurred costs', () => {
    // €30 × 80 × (1 − 0.05) = €2,280 revenue; €1,500 costs.
    expect(computeMargin(makeOrder())).toBe(780);
  });

  it('goes negative when incurred costs exceed revenue (early order, high scrap)', () => {
    const order = makeOrder({ quantiteProduite: 10, tauxRebut: 0.5 });
    // revenue = 30 × 10 × 0.5 = 150; costs = 1,500 → margin = −1,350.
    expect(computeMargin(order)).toBe(-1_350);
  });
});

describe('computeAggregates()', () => {
  it('sums margins, counts in-progress orders and averages scrap rates', () => {
    // Shared base: full revenue = €30 × 80 = €2,400; costs = €1,500.
    const orders = [
      makeOrder({ id: 'a', statut: 'en_cours', tauxRebut: 0.1 }), // 2400×0.9 − 1500 = 660
      makeOrder({ id: 'b', statut: 'termine', tauxRebut: 0.3 }), // 2400×0.7 − 1500 = 180
      makeOrder({ id: 'c', statut: 'bloque', tauxRebut: 0.2 }), // 2400×0.8 − 1500 = 420
    ];

    const agg = computeAggregates(orders);

    expect(agg.totalMargin).toBe(660 + 180 + 420);
    expect(agg.inProgressCount).toBe(1);
    expect(agg.averageScrapRate).toBeCloseTo(0.2, 10);
  });

  it('returns zeros on an empty list (no NaN from the division)', () => {
    expect(computeAggregates([])).toEqual({
      totalMargin: 0,
      inProgressCount: 0,
      averageScrapRate: 0,
    });
  });
});

describe('filterOrders()', () => {
  const orders = [
    makeOrder({
      id: 'a',
      reference: 'OF-2026-0001',
      produit: 'Carter aluminium',
      statut: 'en_cours',
    }),
    makeOrder({ id: 'b', reference: 'OF-2026-0002', produit: 'Arbre à cames', statut: 'bloque' }),
    makeOrder({ id: 'c', reference: 'OF-2026-0003', produit: 'Carter fonte', statut: 'termine' }),
  ];

  it('returns the same list (by reference) when no filter is active', () => {
    // Referential identity is the contract: the downstream computeds stay memoized.
    expect(filterOrders(orders, NO_FILTER)).toBe(orders);
  });

  it('filters by status', () => {
    const result = filterOrders(orders, { status: 'bloque', search: '' });
    expect(result.map((order) => order.id)).toEqual(['b']);
  });

  it('searches reference OR product, case- and accent-insensitive', () => {
    expect(filterOrders(orders, { status: 'all', search: 'carter' })).toHaveLength(2);
    expect(filterOrders(orders, { status: 'all', search: '0002' })).toHaveLength(1);
    // "a cames" (no accent) must match "à cames".
    expect(filterOrders(orders, { status: 'all', search: 'arbre a cames' })).toHaveLength(1);
  });

  it('combines status and search (aggregates depend on this)', () => {
    const result = filterOrders(orders, { status: 'en_cours', search: 'carter' });
    expect(result.map((order) => order.id)).toEqual(['a']);
  });
});

describe('sortOrders()', () => {
  const orders = [
    // margins: a = 2400×0.9 − 1500 = 660 ; b = 180 ; c = 420 (same base as above)
    makeOrder({ id: 'a', produit: 'Carter aluminium', tauxRebut: 0.1 }),
    makeOrder({ id: 'b', produit: 'Étrier usiné', tauxRebut: 0.3 }),
    makeOrder({ id: 'c', produit: 'Arbre à cames', tauxRebut: 0.2 }),
  ];

  it('sorts by computed margin, descending', () => {
    const result = sortOrders(orders, { key: 'margin', direction: 'desc' });
    expect(result.map((order) => order.id)).toEqual(['a', 'c', 'b']);
  });

  it('sorts a raw numeric column ascending', () => {
    const result = sortOrders(
      [
        makeOrder({ id: 'a', quantiteProduite: 80 }),
        makeOrder({ id: 'b', quantiteProduite: 20 }),
        makeOrder({ id: 'c', quantiteProduite: 50 }),
      ],
      { key: 'quantiteProduite', direction: 'asc' },
    );

    expect(result.map((order) => order.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts strings with the French locale (accents) and never mutates the input', () => {
    const result = sortOrders(orders, { key: 'produit', direction: 'asc' });
    // fr locale: Arbre < Carter < Étrier (É sorts as E, not after Z).
    expect(result.map((order) => order.produit)).toEqual([
      'Arbre à cames',
      'Carter aluminium',
      'Étrier usiné',
    ]);
    expect(orders.map((order) => order.id)).toEqual(['a', 'b', 'c']); // untouched
  });
});
