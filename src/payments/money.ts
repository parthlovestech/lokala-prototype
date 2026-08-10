/**
 * Money helpers for the payment UI.
 *
 * Everything the payment API sees is an INTEGER number of cents. These helpers are
 * the single place dollars-as-typed become cents, and cents become a display
 * string — so there is exactly one rounding boundary and no floating-point cents
 * ever leave the screen.
 */

/**
 * Parse a user-typed dollar amount (e.g. "12", "12.5", "$12.50") into integer
 * cents. Returns null for anything that is not a clean, non-negative amount with
 * at most two decimal places.
 */
export function parseAmountToCents(text: string): number | null {
  if (typeof text !== 'string') return null;
  const cleaned = text.trim().replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  // Whole dollars, dollars.cc, or .cc — nothing else.
  if (!/^(\d+(\.\d{1,2})?|\.\d{1,2})$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** Format integer cents as a `$1,234.56` string for display. */
export function formatCents(cents: number): string {
  if (!Number.isFinite(cents)) return '$0.00';
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const remainder = (abs % 100).toString().padStart(2, '0');
  return `${negative ? '-' : ''}$${dollars.toLocaleString('en-US')}.${remainder}`;
}
