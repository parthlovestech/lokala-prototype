import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toggleSavedDeal, type ToggleSavedDealDeps } from './toggleSavedDeal.ts';

type Deps = ToggleSavedDealDeps & { insertCalls: number; deleteCalls: number };

function makeDeps(overrides: Partial<{
  insertError: { code?: string; message: string } | null;
  deleteError: { code?: string; message: string } | null;
}> = {}): Deps {
  const deps: Deps = {
    insertCalls: 0,
    deleteCalls: 0,
    async insertSave() {
      deps.insertCalls += 1;
      return { error: overrides.insertError ?? null };
    },
    async deleteSave() {
      deps.deleteCalls += 1;
      return { error: overrides.deleteError ?? null };
    },
  };
  return deps;
}

describe('toggleSavedDeal: not currently saved -> saves', () => {
  it('inserts and reports isSaved: true', async () => {
    const deps = makeDeps();
    const result = await toggleSavedDeal(false, deps);

    assert.deepEqual(result, { ok: true, isSaved: true });
    assert.equal(deps.insertCalls, 1);
    assert.equal(deps.deleteCalls, 0);
  });
});

describe('toggleSavedDeal: currently saved -> unsaves', () => {
  it('deletes and reports isSaved: false', async () => {
    const deps = makeDeps();
    const result = await toggleSavedDeal(true, deps);

    assert.deepEqual(result, { ok: true, isSaved: false });
    assert.equal(deps.deleteCalls, 1);
    assert.equal(deps.insertCalls, 0);
  });
});

describe('toggleSavedDeal: saving an already-saved deal (state drift)', () => {
  it('a 23505 on insert self-heals to unsaved instead of erroring', async () => {
    const deps = makeDeps({ insertError: { code: '23505', message: 'duplicate key value violates unique constraint' } });

    const result = await toggleSavedDeal(false, deps);

    assert.deepEqual(result, { ok: true, isSaved: false });
    assert.equal(deps.insertCalls, 1);
    assert.equal(deps.deleteCalls, 1, 'must fall back to a real delete, not just report success');
  });

  it('a real failure during the self-heal delete is still surfaced as an error', async () => {
    const deps = makeDeps({
      insertError: { code: '23505', message: 'duplicate key' },
      deleteError: { message: 'network error' },
    });

    const result = await toggleSavedDeal(false, deps);

    assert.equal(result.ok, false);
  });
});

describe('toggleSavedDeal: a non-constraint insert failure is surfaced as an error', () => {
  it('does not attempt the 23505 self-heal path for an unrelated error', async () => {
    const deps = makeDeps({ insertError: { message: 'network error' } });

    const result = await toggleSavedDeal(false, deps);

    assert.equal(result.ok, false);
    assert.equal(deps.deleteCalls, 0);
  });
});

describe('toggleSavedDeal: an unsave failure is surfaced, not silently treated as success', () => {
  it('reports ok: false when the delete errors', async () => {
    const deps = makeDeps({ deleteError: { message: 'network error' } });

    const result = await toggleSavedDeal(true, deps);

    assert.equal(result.ok, false);
  });
});
