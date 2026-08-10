import { supabase } from './supabase';

// QR codes encode this prefix + the business's uuid, e.g. "lokala:pay:3fa8...".
// Keeping a prefix makes it easy to tell a Lokala QR apart from a random one.
export const QR_PREFIX = 'lokala:pay:';

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
}

export interface TipRecord {
  id: string;
  businessId: string;
  businessName: string;
  subtotal: number;
  tipPercent: number | null;
  tipAmount: number;
  total: number;
  createdAt: string;
}

function mapBusiness(row: any): Business {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    createdAt: row.created_at,
  };
}

function mapTip(row: any): TipRecord {
  return {
    id: row.id,
    businessId: row.business_id,
    businessName: row.business_name,
    subtotal: Number(row.subtotal),
    tipPercent: row.tip_percent === null ? null : Number(row.tip_percent),
    tipAmount: Number(row.tip_amount),
    total: Number(row.total),
    createdAt: row.created_at,
  };
}

/** Builds the string that gets encoded into a business's printable QR code. */
export function buildQrValue(businessId: string): string {
  return `${QR_PREFIX}${businessId}`;
}

/** 
 * Pulls a business id/public code back out of a scanned QR value. 
 * Supports both the new Web URL format and legacy format.
 */
export function parseQrValue(raw: string): string | null {
  const value = raw.trim();
  
  try {
    const url = new URL(value);
    if (url.pathname.includes('/pay/')) {
      // Removes trailing slash if present, then splits
      const cleanPath = url.pathname.replace(/\/$/, '');
      const parts = cleanPath.split('/');
      const code = parts[parts.length - 1];
      if (code && code !== 'pay') return code;
    }
  } catch (e) {
    // Ignore URL parse errors, fall back to legacy check
  }

  // Fallback for legacy QR codes (lokala:pay:UUID)
  if (value.startsWith(QR_PREFIX)) {
    const id = value.slice(QR_PREFIX.length);
    return id.length > 0 ? id : null;
  }
  
  // Fallback for manual entry
  if (value.length > 0 && !value.includes(' ')) {
    return value;
  }

  return null;
}

/** 
 * Look up a business by its public code (from the QR code URL).
 * Uses the Supabase RPC function that returns business details.
 */
export async function getBusinessByPublicCode(publicCode: string, signal?: AbortSignal): Promise<{ name: string } | null> {
  let query = supabase.rpc('get_business_for_qr_code', {
    input_public_code: publicCode,
  });

  // Lets the caller cancel a stalled lookup instead of waiting forever.
  if (signal) query = query.abortSignal(signal);

  const { data, error } = await query;

  if (error || !data) {
    console.error('getBusinessByPublicCode error:', error);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;

  // If the RPC returned nothing valid
  if (!row || (!row.public_code && !row.business_name)) return null;

  // Display information only. The merchant is resolved server-side from the
  // scanned public code by the payment API — the mobile app never derives, holds,
  // or forwards an internal business/owner id (doing so is what previously fed a
  // non-uuid into a uuid column).
  return {
    name: row.business_name || 'Lokala Business',
  };
}

/** Fetches the current user's business, if they've set one up. */
export async function getMyBusiness(ownerId: string): Promise<Business | null> {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error) {
    console.error('getMyBusiness error', error);
    return null;
  }
  return data ? mapBusiness(data) : null;
}

/** Creates a business for the current user. Fails if they already have one (one business per owner for now). */
export async function createBusiness(ownerId: string, name: string): Promise<{ business: Business | null; error: string | null }> {
  const { data, error } = await supabase
    .from('businesses')
    .insert({ owner_id: ownerId, name: name.trim() })
    .select('*')
    .single();

  if (error) return { business: null, error: error.message };
  return { business: mapBusiness(data), error: null };
}

/** Looks up a business by id — used after a customer scans (or manually enters) a QR code. */
export async function getBusinessById(id: string, signal?: AbortSignal): Promise<Business | null> {
  let query = supabase
    .from('businesses')
    .select('*')
    .eq('id', id);

  // Lets the caller cancel a stalled lookup instead of waiting forever.
  if (signal) query = query.abortSignal(signal);

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('getBusinessById error', error);
    return null;
  }
  return data ? mapBusiness(data) : null;
}

// NOTE: The mobile app no longer writes any payment/tip/financial record. All
// money movement and its ledger are owned by the web backend via POST
// /api/payments and the Stripe webhook. The read helper below only powers the
// merchant dashboard's historical display and performs no writes.

/** All tips logged against a given business — read-only, used for the business owner's dashboard. */
export async function getTipsForBusiness(businessId: string): Promise<TipRecord[]> {
  const { data, error } = await supabase
    .from('tips')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getTipsForBusiness error', error);
    return [];
  }
  return (data ?? []).map(mapTip);
}