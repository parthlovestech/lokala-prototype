/**
 * Redemption at a merchant's QR code (public.redeem_lokala_balance,
 * Supabase migration 20260901000009).
 *
 * Unlike the retired createMerchantQrPayment() (mylokala.com/api/payments,
 * kind: merchant_qr_payment -- now permanently 410 on the web backend, see
 * that repo's create-payment.ts), this calls the Supabase RPC DIRECTLY, the
 * same way the web app's own /api/redemptions route does internally. That
 * is possible -- and is the right shape, not a workaround -- because
 * redeem_lokala_balance is a plain-named function granted to `authenticated`
 * (not a service_role-only service_* wrapper): it derives the customer from
 * auth.uid() inside Postgres, which PostgREST resolves from WHATEVER JWT is
 * attached to the request, cookie-forwarded or a bare bearer token alike.
 * The mobile Supabase client (src/supabase.ts) already attaches the signed-in
 * user's access token to every request, so no separate bearer-token plumbing
 * is needed here -- confirmed directly against the hosted project before
 * writing this: a REST call bearing only `Authorization: Bearer <user token>`
 * (no cookies at all) reached past redeem_lokala_balance's
 * "Authentication required" check and into its business logic.
 *
 * This also means mobile never goes through mylokala.com's Next.js API for
 * redemption at all -- no new web-side endpoint was needed for this
 * checkpoint.
 *
 * The client never computes or sends a total: only subtotalCents and
 * tipCents (plus the public code and idempotency id) are ever sent.
 * redeem_lokala_balance alone computes the fee, the debit, and the merchant
 * payable, under its own row locks.
 */

export type RedemptionFailureCode =
  | 'invalid_request'
  | 'unauthenticated'
  | 'hub_unavailable'
  | 'merchant_not_active'
  | 'merchant_not_connect_ready'
  | 'wallet_unavailable'
  | 'insufficient_balance'
  | 'server_error';

/** Mirrors web's src/app/api/redemptions/route.ts CLIENT_MESSAGE verbatim --
 * same states, same copy, so a customer sees the identical message whether
 * they redeem on web or in the app. */
export const REDEMPTION_MESSAGES: Record<RedemptionFailureCode, string> = {
  invalid_request: 'A valid amount is required.',
  unauthenticated: 'Please sign in to redeem Lokala balance.',
  hub_unavailable:
    "This payment code isn't active. Ask the business for their current Lokala QR code.",
  merchant_not_active: "This business isn't accepting Lokala payments right now.",
  merchant_not_connect_ready: "This business hasn't finished payment setup yet.",
  wallet_unavailable: "Your Lokala wallet isn't available right now.",
  insufficient_balance: "Your Lokala balance isn't enough to cover this amount.",
  server_error: 'Something went wrong. Please try again.',
};

// ---------------------------------------------------------------------------
// Request validation. There is no "totalCents" input anywhere in this
// module -- structurally, the app cannot send a precomputed total.
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RedemptionInput = {
  publicCode: string;
  subtotalCents: number;
  tipCents: number;
  clientRequestId: string;
};

export type ValidateRedemptionInputResult =
  | { ok: true; value: RedemptionInput }
  | { ok: false; failure: 'invalid_request' };

export function validateRedemptionInput(input: {
  publicCode: string;
  subtotalCents: number;
  tipCents: number;
  clientRequestId: string;
}): ValidateRedemptionInputResult {
  if (typeof input.publicCode !== 'string' || input.publicCode.trim().length === 0) {
    return { ok: false, failure: 'invalid_request' };
  }
  if (
    typeof input.subtotalCents !== 'number' ||
    !Number.isInteger(input.subtotalCents) ||
    input.subtotalCents <= 0
  ) {
    return { ok: false, failure: 'invalid_request' };
  }
  if (
    typeof input.tipCents !== 'number' ||
    !Number.isInteger(input.tipCents) ||
    input.tipCents < 0
  ) {
    return { ok: false, failure: 'invalid_request' };
  }
  if (typeof input.clientRequestId !== 'string' || !UUID_RE.test(input.clientRequestId)) {
    return { ok: false, failure: 'invalid_request' };
  }

  return {
    ok: true,
    value: {
      publicCode: input.publicCode.trim(),
      subtotalCents: input.subtotalCents,
      tipCents: input.tipCents,
      clientRequestId: input.clientRequestId,
    },
  };
}

// ---------------------------------------------------------------------------
// redeem_lokala_balance error-message mapping. Ported verbatim from web's
// src/lib/payments/redeem-balance.ts -- every raise exception message in the
// function (migration 20260901000009), the same on any client since it's the
// same Postgres function.
// ---------------------------------------------------------------------------

const ERROR_MESSAGE_MAP: Array<[needle: string, code: RedemptionFailureCode]> = [
  ['Authentication required', 'unauthenticated'],
  ['Payment hub is not available', 'hub_unavailable'],
  ['Merchant is not accepting payments', 'merchant_not_active'],
  ['Merchant Stripe Connect account is not ready', 'merchant_not_connect_ready'],
  ['Wallet is not available', 'wallet_unavailable'],
  ['Insufficient balance', 'insufficient_balance'],
];

export function mapRedemptionRpcErrorMessage(message: string): RedemptionFailureCode {
  for (const [needle, code] of ERROR_MESSAGE_MAP) {
    if (message.includes(needle)) return code;
  }
  return 'server_error';
}

// ---------------------------------------------------------------------------
// RPC result shaping.
// ---------------------------------------------------------------------------

type RedemptionRpcRow = {
  id: string;
  confirmation_code: string;
  merchant_display_name?: string | null;
  subtotal_cents: number;
  tip_cents: number;
  balance_debited_cents: number;
  merchant_fee_cents: number;
  merchant_payable_cents: number;
  currency: string;
  status: string;
  idempotent: boolean;
};

function asRedemptionRow(data: unknown): RedemptionRpcRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.confirmation_code !== 'string' ||
    typeof record.subtotal_cents !== 'number' ||
    typeof record.tip_cents !== 'number' ||
    typeof record.balance_debited_cents !== 'number' ||
    typeof record.merchant_fee_cents !== 'number' ||
    typeof record.merchant_payable_cents !== 'number' ||
    typeof record.currency !== 'string' ||
    typeof record.status !== 'string' ||
    typeof record.idempotent !== 'boolean'
  ) {
    return null;
  }
  return record as unknown as RedemptionRpcRow;
}

export type RedemptionConfirmation = {
  redemptionId: string;
  confirmationCode: string;
  merchantDisplayName: string;
  subtotalCents: number;
  tipCents: number;
  balanceDebitedCents: number;
  merchantFeeCents: number;
  merchantPayableCents: number;
  currency: string;
  status: string;
  /** True when this is a replay of an earlier successful call for the same
   * clientRequestId -- no new debit happened. */
  idempotent: boolean;
  /** Null only if the post-redemption wallet lookup itself failed -- the
   * redemption already succeeded either way; this is purely for display. */
  remainingWalletBalanceCents: number | null;
};

export type RedeemBalanceRpc = (args: {
  p_public_code: string;
  p_subtotal_cents: number;
  p_tip_cents: number;
  p_client_request_id: string;
}) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

export type RedeemBalanceDeps = {
  redeem: RedeemBalanceRpc;
  /** Looks up the merchant's display name when the RPC's response omits it
   * (an idempotent replay's shape does not include merchant_display_name --
   * see redeem_lokala_balance's exception-handler branch). */
  resolveMerchantDisplayName: (publicCode: string) => Promise<string | null>;
  /** Current wallet balance for the authenticated caller, post-redemption. */
  getWalletBalanceCents: () => Promise<number | null>;
};

export type RedeemBalanceResult =
  | { ok: true; confirmation: RedemptionConfirmation }
  | { ok: false; failure: RedemptionFailureCode };

export async function redeemBalance(
  input: RedemptionInput,
  deps: RedeemBalanceDeps,
): Promise<RedeemBalanceResult> {
  const { data, error } = await deps.redeem({
    p_public_code: input.publicCode,
    p_subtotal_cents: input.subtotalCents,
    p_tip_cents: input.tipCents,
    p_client_request_id: input.clientRequestId,
  });

  if (error) {
    return { ok: false, failure: mapRedemptionRpcErrorMessage(error.message ?? '') };
  }

  const row = asRedemptionRow(data);
  if (!row) {
    return { ok: false, failure: 'server_error' };
  }

  const merchantDisplayName =
    row.merchant_display_name ?? (await deps.resolveMerchantDisplayName(input.publicCode));

  const remainingWalletBalanceCents = await deps.getWalletBalanceCents();

  return {
    ok: true,
    confirmation: {
      redemptionId: row.id,
      confirmationCode: row.confirmation_code,
      merchantDisplayName: merchantDisplayName ?? 'the merchant',
      subtotalCents: row.subtotal_cents,
      tipCents: row.tip_cents,
      balanceDebitedCents: row.balance_debited_cents,
      merchantFeeCents: row.merchant_fee_cents,
      merchantPayableCents: row.merchant_payable_cents,
      currency: row.currency,
      status: row.status,
      idempotent: row.idempotent,
      remainingWalletBalanceCents,
    },
  };
}
