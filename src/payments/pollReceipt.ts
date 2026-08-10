/**
 * Canonical payment-status polling.
 *
 * After Stripe's PaymentSheet reports success the charge is only *in flight*: the
 * ledger is advanced by the signature-verified webhook, and the single source of
 * truth for the outcome is `GET /api/payments/[paymentId]`. This module polls that
 * endpoint with bounded backoff and an overall timeout, so the app confirms
 * success from the server rather than trusting the device.
 *
 * It never creates or mutates a payment — it only reads status — so calling it
 * again (a "Check status" tap, an app resume) is always safe.
 */

import { getPaymentReceipt, PaymentApiError } from './client';
import { isTerminalStatus, type PaymentReceipt } from './types';

const DEFAULT_INTERVALS_MS = [1000, 1500, 2000, 2500, 3000, 4000];
const DEFAULT_OVERALL_TIMEOUT_MS = 30000;
const PER_REQUEST_TIMEOUT_MS = 10000;

export interface PollOptions {
  accessToken: string | null;
  signal?: AbortSignal;
  /** Backoff schedule; the last value repeats until the overall timeout. */
  intervalsMs?: number[];
  /** Hard ceiling for the whole polling session. */
  overallTimeoutMs?: number;
  /** Called with each fresh (non-terminal) receipt, for live UI. */
  onUpdate?: (receipt: PaymentReceipt) => void;
}

export type PollResult =
  | { outcome: 'terminal'; receipt: PaymentReceipt }
  | { outcome: 'timeout'; lastReceipt: PaymentReceipt | null }
  | { outcome: 'aborted' };

/** Resolves after `ms`, or early (still resolving) if the signal aborts. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      resolve();
    };
    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
    };
    if (signal) signal.addEventListener('abort', onAbort);
  });
}

/**
 * Poll until the payment reaches a terminal status, the overall timeout elapses,
 * or the caller aborts.
 *
 * Transient failures (network blips, timeouts, 5xx) are swallowed and retried
 * within the deadline. A non-transient error the caller must act on — an expired
 * token (401) — is rethrown as a `PaymentApiError`.
 */
export async function pollPaymentReceipt(
  paymentId: string,
  options: PollOptions,
): Promise<PollResult> {
  const intervals = options.intervalsMs ?? DEFAULT_INTERVALS_MS;
  const overallTimeoutMs = options.overallTimeoutMs ?? DEFAULT_OVERALL_TIMEOUT_MS;
  const deadline = Date.now() + overallTimeoutMs;

  let lastReceipt: PaymentReceipt | null = null;
  let attempt = 0;

  for (;;) {
    if (options.signal?.aborted) return { outcome: 'aborted' };

    try {
      const receipt = await getPaymentReceipt(paymentId, {
        accessToken: options.accessToken,
        signal: options.signal,
        timeoutMs: PER_REQUEST_TIMEOUT_MS,
      });
      lastReceipt = receipt;
      if (isTerminalStatus(receipt.status)) {
        return { outcome: 'terminal', receipt };
      }
      options.onUpdate?.(receipt);
    } catch (err) {
      if (err instanceof PaymentApiError) {
        if (err.code === 'aborted') return { outcome: 'aborted' };
        // Auth failures and other definitive errors are for the caller to handle;
        // transient transport errors just fall through to another attempt.
        if (!err.isTransient) throw err;
      } else {
        throw err;
      }
    }

    if (Date.now() >= deadline) {
      return { outcome: 'timeout', lastReceipt };
    }

    const wait = intervals[Math.min(attempt, intervals.length - 1)];
    attempt += 1;
    await delay(wait, options.signal);
  }
}
