/**
 * Durable payment-attempt storage.
 *
 * A payment must survive a rerender, a navigation, a lost network, and a full app
 * restart without ever becoming a second charge. This module persists exactly the
 * state needed to safely resume or check a payment:
 *
 *   * `clientRequestId` — generated ONCE per attempt; the idempotency key. Reusing
 *     it across retries guarantees the server returns the same PaymentIntent.
 *   * `publicCode`, `subtotalCents`, `tipCents` — what the attempt is for.
 *   * `paymentId` — recorded the instant the server returns it, so a crash after
 *     creation resumes by CHECKING that payment rather than creating a new one.
 *   * `sheetCompleted` — set once Stripe's PaymentSheet reports success, so the app
 *     never offers "Pay again" for an attempt that may already be charging.
 *
 * The app handles one payment at a time, so a single "active attempt" slot is
 * stored. It is cleared only after a confirmed terminal status, or when the user
 * explicitly abandons an attempt that has not yet been charged.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isUuid, uuidv4 } from '../lib/uuid';

const ACTIVE_ATTEMPT_KEY = 'lokala.payment.activeAttempt.v1';

export interface PaymentAttempt {
  /** RFC4122 UUID. Generated once; stable across every retry of this attempt. */
  clientRequestId: string;
  /** Scanned QR public code — never a business UUID. */
  publicCode: string;
  businessName: string;
  subtotalCents: number;
  tipCents: number;
  /** Set the moment POST /api/payments returns; null until then. */
  paymentId: string | null;
  /** True once Stripe PaymentSheet reported success at least once. */
  sheetCompleted: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface NewAttemptInput {
  publicCode: string;
  businessName: string;
  subtotalCents: number;
  tipCents: number;
}

function isPaymentAttempt(value: unknown): value is PaymentAttempt {
  if (!value || typeof value !== 'object') return false;
  const a = value as Record<string, unknown>;
  return (
    isUuid(a.clientRequestId) &&
    typeof a.publicCode === 'string' &&
    typeof a.businessName === 'string' &&
    typeof a.subtotalCents === 'number' &&
    typeof a.tipCents === 'number' &&
    (a.paymentId === null || typeof a.paymentId === 'string') &&
    typeof a.sheetCompleted === 'boolean'
  );
}

/**
 * Build a brand-new attempt with a freshly generated `clientRequestId`. This does
 * NOT persist — call `saveAttempt` to commit it. Kept pure so a caller can decide
 * whether an existing stored attempt should be reused first.
 */
export function newAttempt(input: NewAttemptInput): PaymentAttempt {
  const now = Date.now();
  return {
    clientRequestId: uuidv4(),
    publicCode: input.publicCode,
    businessName: input.businessName,
    subtotalCents: input.subtotalCents,
    tipCents: input.tipCents,
    paymentId: null,
    sheetCompleted: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** True when a stored attempt is for exactly this business and these amounts. */
export function attemptMatchesInputs(
  attempt: PaymentAttempt,
  input: NewAttemptInput,
): boolean {
  return (
    attempt.publicCode === input.publicCode &&
    attempt.subtotalCents === input.subtotalCents &&
    attempt.tipCents === input.tipCents
  );
}

export async function loadActiveAttempt(): Promise<PaymentAttempt | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_ATTEMPT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPaymentAttempt(parsed) ? parsed : null;
  } catch {
    // A corrupt or unreadable slot must never wedge the payment flow.
    return null;
  }
}

export async function saveAttempt(attempt: PaymentAttempt): Promise<PaymentAttempt> {
  const next: PaymentAttempt = { ...attempt, updatedAt: Date.now() };
  await AsyncStorage.setItem(ACTIVE_ATTEMPT_KEY, JSON.stringify(next));
  return next;
}

/**
 * Merge a partial change into an attempt and persist it. Identity fields
 * (`clientRequestId`, `createdAt`) are protected from being overwritten.
 */
export async function patchAttempt(
  attempt: PaymentAttempt,
  changes: Partial<Omit<PaymentAttempt, 'clientRequestId' | 'createdAt'>>,
): Promise<PaymentAttempt> {
  const next: PaymentAttempt = {
    ...attempt,
    ...changes,
    clientRequestId: attempt.clientRequestId,
    createdAt: attempt.createdAt,
    updatedAt: Date.now(),
  };
  await AsyncStorage.setItem(ACTIVE_ATTEMPT_KEY, JSON.stringify(next));
  return next;
}

/**
 * Clear the active attempt. Call this ONLY after a confirmed terminal status, or
 * when the user explicitly abandons an attempt that has not been charged
 * (`sheetCompleted === false` and no `paymentId` in flight).
 */
export async function clearActiveAttempt(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ACTIVE_ATTEMPT_KEY);
  } catch {
    // Best effort — a failed clear is not user-facing and will be overwritten by
    // the next attempt's save.
  }
}
