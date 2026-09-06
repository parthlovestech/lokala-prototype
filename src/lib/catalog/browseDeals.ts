/**
 * MMCC catalog browsing: category filter + row -> app Deal mapping.
 *
 * Reads catalog_deals joined to catalog_locations/catalog_businesses via the
 * same anon-safe RLS policies web's marketplace page uses
 * (catalog_*_select_active, Supabase migration 20260901000019 on the
 * hosted project) -- this module never assumes or requires a service-role
 * client, and none exists anywhere in this app.
 *
 * CATALOG_CATEGORIES intentionally matches web's
 * src/lib/catalog/browse-deals.ts CATALOG_CATEGORIES exactly (same 7
 * values, same order) -- these are two separate repos with no shared
 * package, so this is a deliberately duplicated constant, not an
 * independent choice. If the fixed category set ever changes, both repos
 * need the same edit.
 *
 * Does not import the app's `Deal` type from AuthContext.tsx (that would
 * create a circular import, since AuthContext imports mapCatalogDealRow
 * from here) -- CatalogDeal below is structurally identical to Deal, and
 * TypeScript's structural typing makes that sufficient.
 */

export const CATALOG_CATEGORIES = [
  'auto',
  'coffee',
  'drinks',
  'food',
  'health',
  'retail',
  'services',
] as const;

export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

export function isCatalogCategory(value: string): value is CatalogCategory {
  return (CATALOG_CATEGORIES as readonly string[]).includes(value);
}

/** Raw shape of one row from the catalog_deals + catalog_locations +
 * catalog_businesses embedded-resource query. */
export type CatalogDealJoinRow = {
  id: string;
  title: string;
  subtitle: string | null;
  discount_detail: string;
  expires_at: string | null;
  category: string;
  distance_meters: number | null;
  percent_off: number | null;
  catalog_locations: {
    address: string;
    latitude: number;
    longitude: number;
    phone: string | null;
    website: string | null;
    catalog_businesses: {
      business_name: string;
    } | null;
  } | null;
};

/** Structurally matches AuthContext.tsx's `Deal` interface. */
export type CatalogDeal = {
  id: string;
  businessName: string;
  title: string;
  subtitle: string;
  expiresAt: string;
  isSaved?: boolean;
  category: CatalogCategory;
  distanceMeters: number;
  lat?: number;
  lng?: number;
  percentOff?: number;
  discountDetail: string;
  address: string;
  phone?: string;
  website?: string;
  source: 'chamber' | 'partner';
};

const UNKNOWN_BUSINESS_NAME = 'Local business';
const UNKNOWN_ADDRESS = 'Address unavailable';

/**
 * Maps one joined row to the app's Deal shape. Two rows sharing a business/
 * location (Silver Street Tavern: two distinct catalog_deals rows, one
 * shared business+location) each map to their own independent CatalogDeal
 * here -- nothing in this function groups or dedupes by business or
 * location, matching the underlying data (see browseDeals.test.ts).
 */
export function mapCatalogDealRow(row: CatalogDealJoinRow, isSaved: boolean): CatalogDeal {
  return {
    id: row.id,
    businessName: row.catalog_locations?.catalog_businesses?.business_name ?? UNKNOWN_BUSINESS_NAME,
    title: row.title,
    subtitle: row.subtitle ?? '',
    discountDetail: row.discount_detail,
    expiresAt: row.expires_at ?? '',
    isSaved,
    // category is a plain text column in Postgres, not a real enum, but the
    // full 2026-08-29 MMCC export was verified to contain only the 7 known
    // values (see the earlier checkpoint's field audit) -- trusted here
    // rather than re-validated per row.
    category: row.category as CatalogCategory,
    distanceMeters: row.distance_meters ?? 0,
    lat: row.catalog_locations?.latitude,
    lng: row.catalog_locations?.longitude,
    percentOff: row.percent_off ?? undefined,
    address: row.catalog_locations?.address ?? UNKNOWN_ADDRESS,
    phone: row.catalog_locations?.phone ?? undefined,
    website: row.catalog_locations?.website ?? undefined,
    // MMCC = Mid-Maine Chamber of Commerce -- every deal in this catalog
    // (source='mmcc_legacy_export' on catalog_deals, a different, unrelated
    // "source" concept from this app's DealSource) genuinely comes from the
    // Chamber today. Not read from the row: catalog_deals.source records
    // import provenance, not this business-facing distinction.
    source: 'chamber',
  };
}

/**
 * `category` of `null` (the "All" chip) or any value outside
 * CATALOG_CATEGORIES returns every deal unfiltered, rather than an empty
 * or broken list -- mirrors web's filterDealsByCategory exactly.
 */
export function filterDealsByCategory<T extends { category: string }>(
  deals: T[],
  category: string | null,
): T[] {
  if (!category || !isCatalogCategory(category)) return deals;
  return deals.filter((deal) => deal.category === category);
}
