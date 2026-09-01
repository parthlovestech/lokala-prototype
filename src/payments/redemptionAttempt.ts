/**
 * Idempotency-key persistence for a redemption attempt.
 *
 * redeem_lokala_balance is synchronous -- it returns a definitive answer in
 * one round trip, unlike the old Stripe PaymentSheet flow (charge accepted,
 * then confirmed later by webhook). So there is no "resume by checking status
 * after a crash" case to handle here, unlike the retired attemptStore.ts.
 * The one thing that still needs to survive a lost network or an app kill
 * mid-request is the clientRequestId itself: reusing it on retry replays
 * redeem_lokala_balance's own idempotency instead of risking a second debit.
 *
 * Keyed only by publicCode (not amount) and cleared on success -- mirrors
 * web's redeem-panel.tsx exactly. A retry of an in-flight redemption reuses
 * the id and safely replays; the NEXT distinct redemption (same or different
 * amount) always gets a fresh id. Keying by amount too would make a second,
 * legitimate same-amount redemption silently replay the first instead of
 * charging again.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { uuidv4 } from '../lib/uuid';

function storageKey(publicCode: string): string {
  return `lokala.redeem.crid.${publicCode}`;
}

export async function getOrCreateAttemptId(publicCode: string): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(storageKey(publicCode));
    if (existing) return existing;
    const fresh = uuidv4();
    await AsyncStorage.setItem(storageKey(publicCode), fresh);
    return fresh;
  } catch {
    return uuidv4();
  }
}

export async function clearAttemptId(publicCode: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(publicCode));
  } catch {
    // Best-effort only -- a leftover key just means the next attempt at this
    // exact publicCode would need a manual reload to rotate, not a hazard.
  }
}
