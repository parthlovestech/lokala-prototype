/**
 * Record a catalog deal redemption (catalog_deal_redemptions, authenticated-
 * only, owner-scoped, Supabase migration 20260901000019).
 *
 * This is informational/tracking only -- there is no payment, no balance
 * debit, nothing moves through the gift-balance ledger. Completely separate
 * from redeem_lokala_balance / src/payments/redeemBalance.ts, which is the
 * real-money wallet redemption at a merchant's QR code.
 *
 * unique(user_id, catalog_deal_id, redeemed_date) allows redeeming the same
 * recurring deal again on a later calendar day, but rejects a second
 * redemption of the same deal on the same day with Postgres 23505
 * (unique_violation). That is mapped to a distinct 'already_redeemed_today'
 * outcome here so the caller can show a clear message instead of a raw
 * database error.
 */

export type RecordCatalogRedemptionDbError = { code?: string; message: string };

export type RecordCatalogRedemptionInput = {
  catalogDealId: string;
  businessNameSnapshot: string;
  dealTitleSnapshot: string;
  discountDetailSnapshot: string;
  categorySnapshot: string;
};

export type RecordCatalogRedemptionDeps = {
  insertRedemption: (
    input: RecordCatalogRedemptionInput,
  ) => PromiseLike<{ error: RecordCatalogRedemptionDbError | null }>;
};

export type RecordCatalogRedemptionFailure = 'already_redeemed_today' | 'server_error';

export type RecordCatalogRedemptionResult =
  | { ok: true }
  | { ok: false; failure: RecordCatalogRedemptionFailure };

const UNIQUE_VIOLATION = '23505';

export async function recordCatalogRedemption(
  input: RecordCatalogRedemptionInput,
  deps: RecordCatalogRedemptionDeps,
): Promise<RecordCatalogRedemptionResult> {
  const { error } = await deps.insertRedemption(input);

  if (!error) return { ok: true };
  if (error.code === UNIQUE_VIOLATION) {
    return { ok: false, failure: 'already_redeemed_today' };
  }
  return { ok: false, failure: 'server_error' };
}
