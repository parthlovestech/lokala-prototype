/**
 * browseDeals: category filter and row -> Deal mapping for the MMCC
 * catalog. Run with `npm test`.
 *
 * There is no React Native component-rendering test harness in this repo
 * (no jest, no testing-library) -- every test here proves logic through
 * plain functions, same as src/payments/redeemBalance.test.ts. HomeScreen
 * renders exactly one card per entry in the array these functions produce,
 * so proving "Silver Street Tavern renders as two distinct cards" is
 * proving mapping never collapses its two rows into one array entry --
 * the same approach web's browse-deals.test.ts uses.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CATALOG_CATEGORIES,
  filterDealsByCategory,
  isCatalogCategory,
  mapCatalogDealRow,
  type CatalogDealJoinRow,
} from './browseDeals.ts';

function joinRow(over: Partial<CatalogDealJoinRow> = {}): CatalogDealJoinRow {
  return {
    id: 'deal-1',
    title: '10% Off Entire Purchase',
    subtitle: 'Show Lokala card at checkout',
    discount_detail: '10% off entire purchase',
    expires_at: 'Ongoing',
    category: 'retail',
    distance_meters: 1600,
    percent_off: 10,
    catalog_locations: {
      address: 'Waterville, ME',
      latitude: 44.5546277,
      longitude: -69.6297798,
      phone: null,
      website: null,
      catalog_businesses: { business_name: '3D Stitchery' },
    },
    ...over,
  };
}

describe('CATALOG_CATEGORIES', () => {
  it('matches the fixed 7-category set web uses, in the same order', () => {
    assert.deepEqual(CATALOG_CATEGORIES, [
      'auto',
      'coffee',
      'drinks',
      'food',
      'health',
      'retail',
      'services',
    ]);
  });
});

describe('mapCatalogDealRow', () => {
  it('maps a joined row to a Deal, preserving text fields verbatim', () => {
    const deal = mapCatalogDealRow(
      joinRow({
        title: 'Buy 1 Swim Pass Get 1 Free',
        discount_detail: 'Buy one Swim and Fitness daily pass and get one free. Limit ONE pass per person daily.',
        percent_off: null,
      }),
      false,
    );

    assert.equal(deal.title, 'Buy 1 Swim Pass Get 1 Free');
    assert.equal(
      deal.discountDetail,
      'Buy one Swim and Fitness daily pass and get one free. Limit ONE pass per person daily.',
    );
    assert.equal(deal.percentOff, undefined);
  });

  it('carries the isSaved flag through from the caller', () => {
    assert.equal(mapCatalogDealRow(joinRow(), true).isSaved, true);
    assert.equal(mapCatalogDealRow(joinRow(), false).isSaved, false);
  });

  it('falls back to placeholder business name/address if the join is unexpectedly missing', () => {
    const deal = mapCatalogDealRow(joinRow({ catalog_locations: null }), false);
    assert.equal(deal.businessName, 'Local business');
    assert.equal(deal.address, 'Address unavailable');
  });

  it('every mapped deal is source "chamber" (MMCC = Mid-Maine Chamber of Commerce)', () => {
    assert.equal(mapCatalogDealRow(joinRow(), false).source, 'chamber');
  });
});

describe('Silver Street Tavern: two distinct deal rows map to two distinct Deals', () => {
  it('both deal rows survive mapping as separate entries, not merged', () => {
    const rows: CatalogDealJoinRow[] = [
      joinRow({
        id: 'deal-silver-1',
        title: '10% Off Food Order',
        discount_detail: '10% off food order. Excludes alcohol. Dine in only.',
        category: 'drinks',
        catalog_locations: {
          address: '2 Silver St, Waterville ME',
          latitude: 44.548894,
          longitude: -69.629304,
          phone: null,
          website: null,
          catalog_businesses: { business_name: 'Silver Street Tavern' },
        },
      }),
      joinRow({
        id: 'deal-silver-2',
        title: '10% Off Food Order',
        discount_detail: '10% off food order. Excludes alcohol. Dine in only.',
        category: 'drinks',
        catalog_locations: {
          address: '2 Silver St, Waterville ME',
          latitude: 44.548894,
          longitude: -69.629304,
          phone: null,
          website: null,
          catalog_businesses: { business_name: 'Silver Street Tavern' },
        },
      }),
    ];

    const deals = rows.map((row) => mapCatalogDealRow(row, false));

    assert.equal(deals.length, 2, 'two source rows must produce two Deal entries, not one deduplicated entry');
    assert.notEqual(deals[0]!.id, deals[1]!.id);
    assert.equal(deals[0]!.businessName, 'Silver Street Tavern');
    assert.equal(deals[1]!.businessName, 'Silver Street Tavern');
  });

  it('both survive filtering by the drinks category together', () => {
    const deals = [
      mapCatalogDealRow(
        joinRow({
          id: 's1',
          category: 'drinks',
          catalog_locations: {
            address: '2 Silver St, Waterville ME',
            latitude: 44.548894,
            longitude: -69.629304,
            phone: null,
            website: null,
            catalog_businesses: { business_name: 'Silver Street Tavern' },
          },
        }),
        false,
      ),
      mapCatalogDealRow(
        joinRow({
          id: 's2',
          category: 'drinks',
          catalog_locations: {
            address: '2 Silver St, Waterville ME',
            latitude: 44.548894,
            longitude: -69.629304,
            phone: null,
            website: null,
            catalog_businesses: { business_name: 'Silver Street Tavern' },
          },
        }),
        false,
      ),
      mapCatalogDealRow(joinRow({ id: 'other', category: 'retail' }), false),
    ];

    const filtered = filterDealsByCategory(deals, 'drinks');

    assert.equal(filtered.length, 2);
    assert.deepEqual(
      filtered.map((d) => d.id).sort(),
      ['s1', 's2'],
    );
  });
});

describe('filterDealsByCategory', () => {
  const deals = [
    mapCatalogDealRow(joinRow({ id: 'a', category: 'food' }), false),
    mapCatalogDealRow(joinRow({ id: 'b', category: 'retail' }), false),
    mapCatalogDealRow(joinRow({ id: 'c', category: 'food' }), false),
  ];

  it('returns every deal when category is null (the "All" chip)', () => {
    assert.equal(filterDealsByCategory(deals, null).length, 3);
  });

  it('returns only deals matching the given category', () => {
    const result = filterDealsByCategory(deals, 'food');
    assert.deepEqual(
      result.map((d) => d.id),
      ['a', 'c'],
    );
  });

  it('returns every deal for an unrecognized category value rather than an empty list', () => {
    assert.equal(filterDealsByCategory(deals, 'not-a-real-category').length, 3);
  });

  it('returns an empty array for a recognized category with no matching deals', () => {
    assert.equal(filterDealsByCategory(deals, 'auto').length, 0);
  });
});

describe('isCatalogCategory', () => {
  it('accepts every category in the fixed set', () => {
    for (const category of CATALOG_CATEGORIES) {
      assert.equal(isCatalogCategory(category), true);
    }
  });

  it('rejects an arbitrary string', () => {
    assert.equal(isCatalogCategory('not-a-category'), false);
  });
});
