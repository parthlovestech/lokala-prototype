import { supabase } from './supabase';

/**
 * Resolve a scanned/entered payment-hub public code against
 * public.resolve_payment_hub (Supabase, migration 20260901000012). Mirrors
 * web's src/lib/merchant/setup.ts resolvePaymentHub exactly -- same RPC, same
 * shape -- since both apps read the identical hosted schema.
 *
 * resolve_payment_hub is granted to anon/authenticated/service_role and
 * returns nothing (empty result) for an inactive/unknown code, an inactive
 * merchant, or an inactive location -- callers cannot distinguish which, by
 * design (same as the web app's /pay/[public_code] "not found" state).
 */
export type ResolvedPaymentHub = {
  paymentHubId: string;
  publicCode: string;
  merchantDisplayName: string;
  locationLabel: string | null;
  currency: string;
};

export async function resolvePaymentHub(
  publicCode: string,
  signal?: AbortSignal,
): Promise<ResolvedPaymentHub | null> {
  const code = publicCode.trim();
  if (!code) return null;

  let query = supabase.rpc('resolve_payment_hub', { p_public_code: code });
  if (signal) query = query.abortSignal(signal);

  const { data, error } = await query;
  if (error || !data) return null;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;

  const record = row as {
    payment_hub_id?: string | null;
    public_code?: string | null;
    merchant_display_name?: string | null;
    location_label?: string | null;
    currency?: string | null;
  };

  if (!record.payment_hub_id || !record.public_code || !record.merchant_display_name) {
    return null;
  }

  return {
    paymentHubId: record.payment_hub_id,
    publicCode: record.public_code,
    merchantDisplayName: record.merchant_display_name,
    locationLabel: record.location_label ?? null,
    currency: record.currency ?? 'USD',
  };
}
