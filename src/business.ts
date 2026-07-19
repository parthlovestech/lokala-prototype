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

/** Pulls a business id back out of a scanned QR value. Returns null if it's not a Lokala code. */
export function parseQrValue(raw: string): string | null {
  const value = raw.trim();
  if (!value.startsWith(QR_PREFIX)) return null;
  const id = value.slice(QR_PREFIX.length);
  return id.length > 0 ? id : null;
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
export async function getBusinessById(id: string): Promise<Business | null> {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('getBusinessById error', error);
    return null;
  }
  return data ? mapBusiness(data) : null;
}

interface RecordTipInput {
  userId: string;
  businessId: string;
  businessName: string;
  subtotal: number;
  tipPercent: number | null; // null when a custom dollar amount was used
  tipAmount: number;
  total: number;
}

/** Logs a customer's self-reported amount + tip against a business. No money actually moves. */
export async function recordTip(input: RecordTipInput): Promise<{ tip: TipRecord | null; error: string | null }> {
  const { data, error } = await supabase
    .from('tips')
    .insert({
      user_id: input.userId,
      business_id: input.businessId,
      business_name: input.businessName,
      subtotal: input.subtotal,
      tip_percent: input.tipPercent,
      tip_amount: input.tipAmount,
      total: input.total,
    })
    .select('*')
    .single();

  if (error) return { tip: null, error: error.message };
  return { tip: mapTip(data), error: null };
}

/** All tips logged against a given business — used for the business owner's dashboard. */
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

/** A customer's own history of logged visits. */
export async function getMyTips(userId: string): Promise<TipRecord[]> {
  const { data, error } = await supabase
    .from('tips')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('getMyTips error', error);
    return [];
  }
  return (data ?? []).map(mapTip);
}
