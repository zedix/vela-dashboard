import { pick, randomBetween, randomInt, weightedPick } from '@shared/utils';
import type { ManufacturingOrder, OrderStatus } from '../models/order.model';

/**
 * Plausible order generation for the simulator.
 *
 * "Plausible" means the orders of magnitude hold together (costs correlated
 * with progress, margins mostly positive but not always) without pretending
 * to be a fine-grained industrial model — this is demo data.
 */

const PRODUCTS = [
  'Carter aluminium',
  'Arbre à cames',
  'Pignon conique',
  'Flasque inox',
  'Bâti soudé',
  'Vérin hydraulique',
  'Corps de pompe',
  'Bride DN80',
  'Axe traité',
  'Coquille de roulement',
] as const;

/** Initial status distribution (~60% in progress, 25% completed, 15% blocked). */
const INITIAL_STATUS_WEIGHTS: readonly (readonly [OrderStatus, number])[] = [
  ['en_cours', 0.6],
  ['termine', 0.25],
  ['bloque', 0.15],
];

const pickStatus = (): OrderStatus => weightedPick(INITIAL_STATUS_WEIGHTS);

/**
 * Creates an order at a given stage of completion.
 *
 * Cost model: a fixed setup cost (tooling, machine configuration) plus a
 * variable cost proportional to the quantities produced so far. Ratios are
 * drawn so that the final margin is positive most of the time — but not
 * guaranteed (young orders or high scrap → negative margin, a real business
 * case).
 */
function createOrderAt(seq: number, statut: OrderStatus, progress: number): ManufacturingOrder {
  const reference = `OF-2026-${String(seq).padStart(4, '0')}`;
  const quantitePrevue = randomInt(5, 50) * 10;
  const quantiteProduite = Math.round(quantitePrevue * progress);
  const prixVenteUnitaire = randomInt(10, 150);

  const unitCostRatio = randomBetween(0.45, 0.85);
  const materialShare = randomBetween(0.5, 0.75);
  const setupCost = quantitePrevue * prixVenteUnitaire * randomBetween(0.03, 0.08);

  const variableCost = quantiteProduite * prixVenteUnitaire * unitCostRatio;

  return {
    id: `of-${seq}`,
    reference,
    produit: pick(PRODUCTS),
    quantitePrevue,
    quantiteProduite,
    coutMatiere: Math.round(variableCost * materialShare + setupCost * 0.6),
    coutMainOeuvre: Math.round(variableCost * (1 - materialShare) + setupCost * (1 - 0.6)),
    tauxRebut: randomBetween(0, 0.15),
    prixVenteUnitaire,
    statut,
  };
}

/** Creates a freshly launched order (the stream's `created` event). */
export function createNewOrder(seq: number): ManufacturingOrder {
  return createOrderAt(seq, 'en_cours', randomBetween(0, 0.1));
}

/** The 50 startup orders, at varied stages of completion. */
export function createInitialOrders(count: number): readonly ManufacturingOrder[] {
  return Array.from({ length: count }, (_, i) => {
    const statut = pickStatus();
    const progress = statut === 'termine' ? 1 : randomBetween(0.05, 0.9);
    return createOrderAt(i + 1, statut, progress);
  });
}
