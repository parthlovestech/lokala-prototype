/**
 * Save/unsave a catalog deal (saved_catalog_deals, authenticated-only,
 * owner-scoped -- user_id = auth.uid() via RLS, Supabase migration
 * 20260901000019). Separate from the gift-balance wallet system entirely.
 *
 * unique(user_id, catalog_deal_id) means a second INSERT for an
 * already-saved deal raises Postgres 23505 (unique_violation). Rather than
 * surface that as an error, a 23505 on insert is treated as "this is
 * already saved" and self-heals by deleting it instead -- so saving an
 * already-saved deal toggles it to unsaved rather than failing, even if
 * the caller's locally-tracked saved state has drifted from the database
 * (a stale Set after some other client action, for instance).
 */

export type ToggleSaveDbError = { code?: string; message: string };

export type ToggleSavedDealDeps = {
  insertSave: () => PromiseLike<{ error: ToggleSaveDbError | null }>;
  deleteSave: () => PromiseLike<{ error: ToggleSaveDbError | null }>;
};

export type ToggleSavedDealResult =
  | { ok: true; isSaved: boolean }
  | { ok: false; error: ToggleSaveDbError };

const UNIQUE_VIOLATION = '23505';

export async function toggleSavedDeal(
  isCurrentlySaved: boolean,
  deps: ToggleSavedDealDeps,
): Promise<ToggleSavedDealResult> {
  if (isCurrentlySaved) {
    const { error } = await deps.deleteSave();
    if (error) return { ok: false, error };
    return { ok: true, isSaved: false };
  }

  const { error } = await deps.insertSave();
  if (!error) return { ok: true, isSaved: true };

  if (error.code === UNIQUE_VIOLATION) {
    // Already saved despite the caller believing otherwise -- toggle to
    // unsaved instead of reporting an error the user did not cause.
    const { error: deleteError } = await deps.deleteSave();
    if (deleteError) return { ok: false, error: deleteError };
    return { ok: true, isSaved: false };
  }

  return { ok: false, error };
}
