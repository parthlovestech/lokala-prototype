import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';

import {
  mapRedemptionRpcErrorMessage,
  redeemBalance,
  validateRedemptionInput,
  type RedeemBalanceDeps,
  type RedeemBalanceRpc,
} from './redeemBalance.ts';

const VALID_INPUT = {
  publicCode: 'abc123',
  subtotalCents: 1500,
  tipCents: 200,
  clientRequestId: randomUUID(),
};

describe('validateRedemptionInput', () => {
  it('accepts a well-formed input', () => {
    const result = validateRedemptionInput(VALID_INPUT);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.publicCode, 'abc123');
      assert.equal(result.value.subtotalCents, 1500);
      assert.equal(result.value.tipCents, 200);
    }
  });

  it('rejects a blank publicCode', () => {
    assert.deepEqual(validateRedemptionInput({ ...VALID_INPUT, publicCode: '  ' }), {
      ok: false,
      failure: 'invalid_request',
    });
  });

  it('rejects a non-positive or non-integer subtotalCents', () => {
    assert.equal(validateRedemptionInput({ ...VALID_INPUT, subtotalCents: 0 }).ok, false);
    assert.equal(validateRedemptionInput({ ...VALID_INPUT, subtotalCents: -100 }).ok, false);
    assert.equal(validateRedemptionInput({ ...VALID_INPUT, subtotalCents: 15.5 }).ok, false);
  });

  it('rejects a negative or non-integer tipCents', () => {
    assert.equal(validateRedemptionInput({ ...VALID_INPUT, tipCents: -1 }).ok, false);
    assert.equal(validateRedemptionInput({ ...VALID_INPUT, tipCents: 1.5 }).ok, false);
  });

  it('rejects a non-UUID clientRequestId', () => {
    assert.equal(
      validateRedemptionInput({ ...VALID_INPUT, clientRequestId: 'not-a-uuid' }).ok,
      false,
    );
  });
});

describe('mapRedemptionRpcErrorMessage', () => {
  const cases: Array<[string, string]> = [
    ['Authentication required', 'unauthenticated'],
    ['Payment hub is not available', 'hub_unavailable'],
    ['Merchant is not accepting payments', 'merchant_not_active'],
    [
      'Merchant Stripe Connect account is not ready for current platform mode (livemode=false)',
      'merchant_not_connect_ready',
    ],
    ['Wallet is not available', 'wallet_unavailable'],
    ['Insufficient balance', 'insufficient_balance'],
  ];

  for (const [message, code] of cases) {
    it(`maps "${message}" to ${code}`, () => {
      assert.equal(mapRedemptionRpcErrorMessage(message), code);
    });
  }

  it('falls back to server_error for an unrecognized message', () => {
    assert.equal(mapRedemptionRpcErrorMessage('something totally unexpected'), 'server_error');
  });
});

function freshRow(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: randomUUID(),
    confirmation_code: 'ABCD1234',
    merchant_display_name: 'Fresh Pork',
    subtotal_cents: 1500,
    tip_cents: 200,
    balance_debited_cents: 1700,
    merchant_fee_cents: 75,
    merchant_payable_cents: 1625,
    currency: 'USD',
    status: 'completed',
    idempotent: false,
    ...over,
  };
}

function makeDeps(over: Partial<RedeemBalanceDeps> = {}): RedeemBalanceDeps & {
  redeemCalls: Array<Parameters<RedeemBalanceRpc>[0]>;
} {
  const redeemCalls: Array<Parameters<RedeemBalanceRpc>[0]> = [];
  return {
    redeemCalls,
    redeem: async (args) => {
      redeemCalls.push(args);
      return { data: freshRow(), error: null };
    },
    resolveMerchantDisplayName: async () => {
      throw new Error('resolveMerchantDisplayName should not be called for this test');
    },
    getWalletBalanceCents: async () => 8300,
    ...over,
  };
}

const INPUT = {
  publicCode: 'abc123',
  subtotalCents: 1500,
  tipCents: 200,
  clientRequestId: randomUUID(),
};

describe('redeemBalance: server-only total computation', () => {
  it('passes only the validated subtotal/tip through to the RPC -- never a total', async () => {
    const deps = makeDeps();
    await redeemBalance(INPUT, deps);

    assert.equal(deps.redeemCalls.length, 1);
    const call = deps.redeemCalls[0]!;
    assert.equal(call.p_public_code, 'abc123');
    assert.equal(call.p_subtotal_cents, 1500);
    assert.equal(call.p_tip_cents, 200);
    assert.equal('p_total_cents' in call, false);
  });

  it('shapes a fresh success using the RPC\'s own fee/debit/payable math', async () => {
    const deps = makeDeps();
    const result = await redeemBalance(INPUT, deps);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.confirmation.balanceDebitedCents, 1700);
    assert.equal(result.confirmation.merchantDisplayName, 'Fresh Pork');
    assert.equal(result.confirmation.idempotent, false);
    assert.equal(result.confirmation.remainingWalletBalanceCents, 8300);
  });
});

describe('redeemBalance: idempotent replay', () => {
  it('surfaces idempotent:true using the original row, and is not treated as an error', async () => {
    const deps = makeDeps({
      redeem: async () => ({
        data: freshRow({ idempotent: true, merchant_display_name: null }),
        error: null,
      }),
      resolveMerchantDisplayName: async (publicCode) => {
        assert.equal(publicCode, 'abc123');
        return 'Fresh Pork';
      },
    });

    const result = await redeemBalance(INPUT, deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.confirmation.idempotent, true);
    assert.equal(result.confirmation.confirmationCode, 'ABCD1234');
    assert.equal(result.confirmation.merchantDisplayName, 'Fresh Pork');
  });
});

describe('redeemBalance: distinct error states', () => {
  const errorCases: Array<[string, string]> = [
    ['Payment hub is not available', 'hub_unavailable'],
    ['Merchant is not accepting payments', 'merchant_not_active'],
    [
      'Merchant Stripe Connect account is not ready for current platform mode (livemode=false)',
      'merchant_not_connect_ready',
    ],
    ['Wallet is not available', 'wallet_unavailable'],
    ['Insufficient balance', 'insufficient_balance'],
  ];

  for (const [message, code] of errorCases) {
    it(`surfaces ${code} distinctly, without touching the wallet-balance lookup`, async () => {
      const deps = makeDeps({
        redeem: async () => ({ data: null, error: { message } }),
        getWalletBalanceCents: async () => {
          throw new Error('getWalletBalanceCents should not be called on failure');
        },
      });

      const result = await redeemBalance(INPUT, deps);
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.failure, code);
    });
  }

  it('falls back to server_error for a malformed/unrecognized RPC row', async () => {
    const deps = makeDeps({
      redeem: async () => ({ data: { unexpected: 'shape' }, error: null }),
      getWalletBalanceCents: async () => {
        throw new Error('getWalletBalanceCents should not be called on failure');
      },
    });

    const result = await redeemBalance(INPUT, deps);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.failure, 'server_error');
  });
});
