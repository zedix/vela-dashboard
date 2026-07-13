/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Formatting helpers — Intl-native, pure and stateless.
   Locale-parameterized core; the app's locale is a default, not a lock.
   ────────────────────────────────────────────────────────────────────── */

/**
 * The app's ambient locale — configuration resolved once per session, not
 * per-call data, hence a default parameter rather than a required one.
 * The app is currently French-facing only; under i18n, a thin DI layer
 * (pipe or service injecting `LOCALE_ID`) passes the active locale as the
 * last argument, leaving this module untouched.
 */
const DEFAULT_LOCALE = 'fr-FR';

/**
 * One `Intl.NumberFormat` per (locale, currency, sign mode) — construction
 * is the expensive part, formatting is cheap. Lazily built, reused forever.
 */
const formatters = new Map<string, Intl.NumberFormat>();

function priceFormatter(locale: string, currency: string, signDisplay: 'auto' | 'exceptZero') {
  const key = `price:${locale}:${currency}:${signDisplay}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0, // dashboard-level amounts: whole units
      signDisplay,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

function rateFormatter(locale: string) {
  const key = `rate:${locale}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'percent', // scales the ratio and places the % sign per locale
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

/** Price in whole units, e.g. formatPrice(12480) → "12 480 €". */
export function formatPrice(value: number, currency = 'EUR', locale = DEFAULT_LOCALE): string {
  return priceFormatter(locale, currency, 'auto').format(value);
}

/** Signed price — zero stays bare, e.g. "+72 000 €" / "-12 300 €". */
export function formatSignedPrice(
  value: number,
  currency = 'EUR',
  locale = DEFAULT_LOCALE,
): string {
  return priceFormatter(locale, currency, 'exceptZero').format(value);
}

/** Percentage from a 0–1 ratio, e.g. formatRate(0.042) → "4,2 %". */
export function formatRate(ratio: number, locale = DEFAULT_LOCALE): string {
  return rateFormatter(locale).format(ratio);
}
