/**
 * Typed client for the unified Lokala payment API.
 *
 * Two endpoints, one contract:
 *   * POST /api/payments               → start/replay a durable payment
 *   * GET  /api/payments/[paymentId]   → canonical, webhook-confirmed status
 *
 * Design rules enforced here:
 *   * every amount crossing the wire is an INTEGER number of cents;
 *   * the current Supabase access token is sent as `Authorization: Bearer …`;
 *   * every request is bounded by an AbortController timeout;
 *   * server errors are parsed into a small, safe, typed set — the raw Stripe or
 *     Postgres text the backend logs is never surfaced to a user;
 *   * the app calculates NO fees or totals; the server is authoritative.
 */

import { supabase } from '../supabase';
import type { PaymentMethod, PaymentReceipt, PaymentSession } from './types';

// Production stays on the live domain; a build may override the base for local
// or preview testing via EXPO_PUBLIC_API_URL. Trailing slashes are trimmed so we
// never emit a `//api/payments` path.
const DEFAULT_API_BASE = 'https://www.mylokala.com';
const API_BASE = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_BASE).replace(/\/+$/, '');

/** A lookup/creation that has not answered by now is cut loose. */
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * The full set of failure codes a caller may need to branch on. The first block
 * mirrors the backend's own `code` field; the rest are client-side transport
 * conditions the server never sends.
 */
export type PaymentErrorCode =
  // ── mirrored from the backend ─────────────────────────────────────────────
  | 'invalid_request'
  | 'invalid_amount'
  | 'invalid_client_request_id'
  | 'invalid_recipient'
  | 'merchant_unavailable'
  | 'already_succeeded'
  | 'attempt_closed'
  | 'request_mismatch'
  | 'stripe_unavailable'
  | 'db_error'
  | 'server_error'
  | 'unauthenticated'
  | 'not_found'
  // ── client-side only ──────────────────────────────────────────────────────
  | 'network_error'
  | 'timeout'
  | 'aborted'
  | 'unexpected';

const BACKEND_CODES: readonly PaymentErrorCode[] = [
  'invalid_request',
  'invalid_amount',
  'invalid_client_request_id',
  'invalid_recipient',
  'merchant_unavailable',
  'already_succeeded',
  'attempt_closed',
  'request_mismatch',
  'stripe_unavailable',
  'db_error',
  'server_error',
  'unauthenticated',
  'not_found',
];

/** Friendly, non-revealing copy. Never contains raw server internals. */
const SAFE_MESSAGES: Record<PaymentErrorCode, string> = {
  invalid_request: 'Something about this payment was invalid. Please try again.',
  invalid_amount: 'Please enter a valid amount.',
  invalid_client_request_id: 'We could not start this payment. Please try again.',
  invalid_recipient: 'A valid recipient is required.',
  merchant_unavailable: 'This business is not able to accept payments right now.',
  already_succeeded: 'This payment has already been completed.',
  attempt_closed: 'This payment attempt is closed. Start a new one.',
  request_mismatch:
    'This does not match the original payment. Please start a new one.',
  stripe_unavailable: 'We could not start the payment. Please try again.',
  db_error: 'Something went wrong. Please try again.',
  server_error: 'Something went wrong. Please try again.',
  unauthenticated: 'Please sign in to make a payment.',
  not_found: 'We could not find this payment.',
  network_error: 'We could not reach Lokala. Check your connection and try again.',
  timeout: 'This is taking longer than expected. Please try again.',
  aborted: 'The request was canceled.',
  unexpected: 'Something went wrong. Please try again.',
};

/**
 * The only error type this module throws. Carries a stable machine code and the
 * HTTP status when there was one, plus a safe, user-presentable message.
 */
export class PaymentApiError extends Error {
  readonly code: PaymentErrorCode;
  readonly httpStatus: number | null;

  constructor(code: PaymentErrorCode, httpStatus: number | null, message?: string) {
    super(message ?? SAFE_MESSAGES[code]);
    this.name = 'PaymentApiError';
    this.code = code;
    this.httpStatus = httpStatus;
  }

  /** A 409 replay whose amounts/target no longer match the original attempt. */
  get isRequestMismatch(): boolean {
    return this.code === 'request_mismatch';
  }

  /** The attempt is over on the server (settled or closed) and is not retryable. */
  get isAttemptSettledOrClosed(): boolean {
    return this.code === 'already_succeeded' || this.code === 'attempt_closed';
  }

  /** No/expired credentials — the caller should route the user to sign in. */
  get isAuthError(): boolean {
    return this.code === 'unauthenticated' || this.httpStatus === 401;
  }

  /** Transport-level: the create/replay never reached a definitive server answer. */
  get isTransient(): boolean {
    return (
      this.code === 'network_error' ||
      this.code === 'timeout' ||
      this.code === 'stripe_unavailable' ||
      this.httpStatus === 500 ||
      this.httpStatus === 502
    );
  }
}

function safeMessageFor(code: PaymentErrorCode): string {
  return SAFE_MESSAGES[code] ?? SAFE_MESSAGES.unexpected;
}

/** Map a backend `code`/HTTP status onto our typed set, never trusting free text. */
function normalizeErrorCode(rawCode: unknown, httpStatus: number): PaymentErrorCode {
  if (typeof rawCode === 'string' && (BACKEND_CODES as readonly string[]).includes(rawCode)) {
    return rawCode as PaymentErrorCode;
  }
  switch (httpStatus) {
    case 400:
      return 'invalid_request';
    case 401:
      return 'unauthenticated';
    case 404:
      return 'not_found';
    case 409:
      return 'attempt_closed';
    case 500:
      return 'server_error';
    case 502:
      return 'stripe_unavailable';
    default:
      return 'unexpected';
  }
}

export interface PaymentRequestOptions {
  /** The current Supabase access token, or null when the user is signed out. */
  accessToken: string | null;
  /** Overall bound for this request. */
  timeoutMs?: number;
  /** Lets a screen cancel the request on blur/unmount. */
  signal?: AbortSignal;
}

/**
 * Perform one JSON request against the payment API with a bounded timeout and
 * structured error parsing. Always resolves to parsed JSON of type `T`, or throws
 * a `PaymentApiError`.
 */
async function requestJson<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: string },
  options: PaymentRequestOptions,
): Promise<T> {
  const { accessToken, signal } = options;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  let timedOut = false;

  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onExternalAbort);
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: init.method,
      headers,
      body: init.body,
      signal: controller.signal,
    });
  } catch (err) {
    if (timedOut) throw new PaymentApiError('timeout', null);
    if (signal?.aborted) throw new PaymentApiError('aborted', null);
    // Any other fetch rejection is a transport failure; its text may be noisy.
    throw new PaymentApiError('network_error', null);
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }

  // Read as text first so an HTML error page (proxy 502, etc.) never crashes the
  // JSON parse and never leaks its body to the user.
  const rawText = await response.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const bodyCode =
      parsed && typeof parsed === 'object' ? (parsed as { code?: unknown }).code : undefined;
    const code = normalizeErrorCode(bodyCode, response.status);
    throw new PaymentApiError(code, response.status, safeMessageFor(code));
  }

  if (parsed == null || typeof parsed !== 'object') {
    throw new PaymentApiError('unexpected', response.status);
  }

  return parsed as T;
}

function assertIntegerCents(label: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new PaymentApiError('invalid_amount', null, `A valid ${label} is required.`);
  }
}

export interface CreateMerchantPaymentRequest {
  /** A persistent RFC4122 UUID identifying this payment attempt (idempotency key). */
  clientRequestId: string;
  /** The scanned QR public code — NOT a business UUID. */
  qrPublicCode: string;
  subtotalCents: number;
  tipCents: number;
  paymentMethod?: PaymentMethod;
}

/**
 * Start (or idempotently replay) a merchant QR payment.
 *
 * Because the request is keyed on `clientRequestId`, calling this again with the
 * SAME id after a network failure returns the SAME payment session and can never
 * create a second PaymentIntent.
 */
export async function createMerchantQrPayment(
  request: CreateMerchantPaymentRequest,
  options: PaymentRequestOptions,
): Promise<PaymentSession> {
  assertIntegerCents('amount', request.subtotalCents);
  assertIntegerCents('tip', request.tipCents);
  if (request.subtotalCents < 1) {
    throw new PaymentApiError('invalid_amount', null, 'A valid amount is required.');
  }

  const body = JSON.stringify({
    kind: 'merchant_qr_payment',
    clientRequestId: request.clientRequestId,
    qrPublicCode: request.qrPublicCode,
    subtotalCents: request.subtotalCents,
    tipCents: request.tipCents,
    paymentMethod: request.paymentMethod ?? 'card',
  });

  return requestJson<PaymentSession>('/api/payments', { method: 'POST', body }, options);
}

/**
 * Fetch the canonical receipt/status for a payment. Requires authentication — the
 * backend returns 401 without a valid token — so we short-circuit rather than
 * make a call that cannot succeed.
 */
export async function getPaymentReceipt(
  paymentId: string,
  options: PaymentRequestOptions,
): Promise<PaymentReceipt> {
  if (!options.accessToken) {
    throw new PaymentApiError('unauthenticated', 401);
  }
  return requestJson<PaymentReceipt>(
    `/api/payments/${encodeURIComponent(paymentId)}`,
    { method: 'GET' },
    options,
  );
}

/**
 * The current Supabase access token, or null when signed out. Read fresh each
 * time so an auto-refreshed token is always the one that gets sent.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Exposed for display/debugging; never used to build financial values. */
export const paymentApiBase = API_BASE;
