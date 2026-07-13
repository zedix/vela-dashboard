/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   String helpers — pure, framework-free utilities.
   ────────────────────────────────────────────────────────────────────── */

/**
 * Normalizes text for case- and accent-insensitive search matching:
 * lowercases, then strips diacritics (“Défaut” → “defaut”) so the search
 * ignores accents. Named by intent — it produces the comparison key a search
 * uses, not a general `String.prototype.normalize` (only the first step here).
 */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD') // decompose “é” into “e” + combining accent…
    .replace(/[\u0300-\u036f]/g, ''); // …then drop the combining accents
}
