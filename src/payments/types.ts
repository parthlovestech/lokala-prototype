/**
 * Shared payment types for the unified Lokala payment flow.
 *
 * These mirror the canonical shapes the web backend returns from
 * `POST /api/payments` and `GET /api/payments/[paymentId]`. The server is the
 * single source of truth for every amount and for the payment status; the mobile
 * app only ever reads these, never computes fees or totals itself.
 */

/** Canonical, webhook-confirmed payment status. Only the server may advance it. */
export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export type PaymentKind = 'merchant_qr_payment' | 'gift_certificate_purchase';

export type PaymentMethod = 'card' | 'ach';

/** A payment is only over — for better or worse — in one of these states. */
export const TERMINAL_STATUSES: readonly PaymentStatus[] = [
  'succeeded',
  'failed',
  'canceled',
];

export function isTerminalStatus(status: PaymentStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isFailureStatus(status: PaymentStatus): boolean {
  return status === 'failed' || status === 'canceled';
}

/**
 * The session returned by `POST /api/payments`. Every amount is integer cents and
 * is authoritative — the mobile app renders these directly and never recomputes.
 *
 * `clientSecret` is present only while the payment can still be confirmed; the
 * server omits it (null) once the payment is terminal, so a settled payment can
 * never be re-presented to Stripe.
 */
export interface PaymentSession {
  paymentId: string;
  status: PaymentStatus;
  kind: PaymentKind;
  subtotalCents: number;
  tipCents: number;
  customerFeeCents: number;
  merchantFeeCents: number;
  totalCents: number;
  currency: string;
  feePolicyVersion: string;
  businessName: string | null;
  clientSecret: string | null;
}

/**
 * The canonical receipt returned by `GET /api/payments/[paymentId]`.
 *
 * This is the shape the app trusts when deciding a payment succeeded — it is
 * advanced only by the signature-verified Stripe webhook, so it survives the app
 * closing, a lost network, or a client that reports success prematurely. It
 * deliberately carries no connected-account id, no owner/customer UUID, and no
 * Stripe intent/charge id.
 */
export interface PaymentReceipt {
  paymentId: string;
  kind: string;
  status: PaymentStatus;
  subtotalCents: number;
  tipCents: number;
  customerFeeCents: number;
  totalCents: number;
  currency: string;
  feePolicyVersion: string;
  businessName: string | null;
  refundStatus: string;
  refundedCents: number;
  failureCode: string | null;
  createdAt: string;
  succeededAt: string | null;
  refundedAt: string | null;
}
