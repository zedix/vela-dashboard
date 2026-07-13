/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Random helpers — pure, framework-free utilities.
   ────────────────────────────────────────────────────────────────────── */

/** Uniform float in [min, max). */
export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Integer in [min, max] (endpoints half-weighted by rounding). */
export function randomInt(min: number, max: number): number {
  return Math.round(randomBetween(min, max));
}

/** One random element of a non-empty list. */
export function pick<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

/**
 * One random value from `[value, weight]` entries, drawn proportionally to the
 * weights (cumulative distribution). Weights need not sum to 1 — any remainder
 * falls to the last entry.
 */
export function weightedPick<T>(weighted: readonly (readonly [T, number])[]): T {
  const roll = Math.random();
  let cumulative = 0;
  for (const [value, weight] of weighted) {
    cumulative += weight;
    if (roll < cumulative) return value;
  }
  return weighted[weighted.length - 1][0];
}
