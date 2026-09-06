import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  recordCatalogRedemption,
  type RecordCatalogRedemptionDeps,
  type RecordCatalogRedemptionInput,
} from './recordCatalogRedemption.ts';

const INPUT: RecordCatalogRedemptionInput = {
  catalogDealId: 'deal-1',
  businessNameSnapshot: 'Silver Street Tavern',
  dealTitleSnapshot: '10% Off Food Order',
  discountDetailSnapshot: '10% off food order. Excludes alcohol. Dine in only.',
  categorySnapshot: 'drinks',
};

function makeDeps(
  error: { code?: string; message: string } | null,
): RecordCatalogRedemptionDeps & { calls: RecordCatalogRedemptionInput[] } {
  const calls: RecordCatalogRedemptionInput[] = [];
  return {
    calls,
    async insertRedemption(input) {
      calls.push(input);
      return { error };
    },
  };
}

describe('recordCatalogRedemption: a fresh redemption succeeds', () => {
  it('inserts the exact snapshot fields and reports ok', async () => {
    const deps = makeDeps(null);

    const result = await recordCatalogRedemption(INPUT, deps);

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(deps.calls, [INPUT]);
  });
});

describe('recordCatalogRedemption: already redeemed today', () => {
  it('maps a 23505 unique-violation to a clear already_redeemed_today failure, not a raw error', async () => {
    const deps = makeDeps({ code: '23505', message: 'duplicate key value violates unique constraint' });

    const result = await recordCatalogRedemption(INPUT, deps);

    assert.deepEqual(result, { ok: false, failure: 'already_redeemed_today' });
  });
});

describe('recordCatalogRedemption: recurring deals can be redeemed again on a later day', () => {
  it('is not this module\'s concern to enforce -- the database allows a later redeemed_date; a fresh call with no constraint violation still succeeds', async () => {
    // The unique constraint is (user_id, catalog_deal_id, redeemed_date), so
    // "same deal, later day" never collides -- proven at the database layer
    // in the earlier checkpoint's pgTAP suite. This module only needs to
    // prove it does not treat every insert as a conflict.
    const deps = makeDeps(null);
    const result = await recordCatalogRedemption(INPUT, deps);
    assert.equal(result.ok, true);
  });
});

describe('recordCatalogRedemption: an unrelated database error', () => {
  it('is reported as server_error, not confused with already_redeemed_today', async () => {
    const deps = makeDeps({ message: 'network error' });

    const result = await recordCatalogRedemption(INPUT, deps);

    assert.deepEqual(result, { ok: false, failure: 'server_error' });
  });
});
