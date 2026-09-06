import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from './supabase';
import { Session, User } from '@supabase/supabase-js';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { mapCatalogDealRow, type CatalogDealJoinRow } from './lib/catalog/browseDeals';
import { toggleSavedDeal } from './lib/catalog/toggleSavedDeal';
import {
  recordCatalogRedemption,
  type RecordCatalogRedemptionFailure,
} from './lib/catalog/recordCatalogRedemption';

// Where a discount comes from. Everything today is a Chamber discount, but this
// makes it trivial to filter/tag once non-Chamber partner discounts are added.
export type DealSource = 'chamber' | 'partner';

export const SOURCE_LABELS: Record<DealSource, string> = {
  chamber: 'Mid-Maine Chamber of Commerce',
  partner: 'Lokala Partner',
};

// Compact form for tight spaces (list cards) — full name still used in the deal detail modal.
export const SOURCE_SHORT_LABELS: Record<DealSource, string> = {
  chamber: 'MMCC',
  partner: 'Partner',
};

export interface Deal {
  id: string;
  businessName: string;
  title: string;
  subtitle: string;
  expiresAt: string;
  isSaved?: boolean;
  category: 'coffee' | 'food' | 'drinks' | 'retail' | 'health' | 'services' | 'auto';
  distanceMeters: number;
  lat?: number;
  lng?: number;
  percentOff?: number;
  discountDetail: string;
  address: string;
  phone?: string;
  website?: string;
  source: DealSource;
}

export interface Profile {
  id: string;
  full_name: string;
  member_id: string;
  member_type: string;
}

export interface Redemption {
  id: string;
  businessName: string;
  dealTitle: string;
  discountDetail: string;
  redeemedAt: string;
  category: Deal['category'];
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isInitializing: boolean;
  deals: Deal[];
  redemptions: Redemption[];
  dealsLoading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  toggleSave: (dealId: string) => Promise<void>;
  /** Informational/tracking redemption for the MMCC catalog only -- entirely
   * separate from the gift-balance wallet redemption. Returns the outcome so
   * the caller can show "already redeemed today" distinctly rather than
   * treating every call as a success. */
  recordRedemption: (deal: Deal) => Promise<RecordRedemptionResult>;
  refreshRedemptions: () => Promise<void>;
}

export type RecordRedemptionResult =
  | { ok: true }
  | { ok: false; failure: RecordCatalogRedemptionFailure };

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isInitializing: true,
  deals: [],
  redemptions: [],
  dealsLoading: false,
  signIn: async () => null,
  signUp: async () => null,
  signOut: async () => {},
  deleteAccount: async () => {},
  toggleSave: async () => {},
  recordRedemption: async () => ({ ok: false, failure: 'server_error' }),
  refreshRedemptions: async () => {},
});

/** catalog_deals joined to catalog_locations/catalog_businesses -- the same
 * anon-safe RLS-scoped shape web's marketplace page reads (Supabase
 * migration 20260901000019). Row -> Deal mapping (including the Silver
 * Street Tavern non-dedup behavior) lives in ./lib/catalog/browseDeals.ts,
 * unit-tested there. */
const CATALOG_DEAL_SELECT =
  'id, title, subtitle, discount_detail, expires_at, category, distance_meters, percent_off, ' +
  'catalog_locations!inner(address, latitude, longitude, phone, website, catalog_businesses!inner(business_name))';

export const AuthProvider = ({ children }: any) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);

  useEffect(() => {
  const timeout = setTimeout(() => {
    setIsInitializing(false); // failsafe: never hang forever
  }, 10000);

  supabase.auth.getSession().then(({ data: { session } }) => {
    clearTimeout(timeout);
    setSession(session);
    setUser(session?.user ?? null);
    setIsInitializing(false);
  }).catch(() => {
    clearTimeout(timeout);
    setIsInitializing(false);
  });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadProfile(user.id);
      loadDeals(user.id);
      loadRedemptions(user.id);
    } else {
      setProfile(null);
      setDeals([]);
      setSavedIds(new Set());
      setRedemptions([]);
    }
  }, [user?.id]);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data as Profile);
  };

  const loadDeals = async (userId: string) => {
    setDealsLoading(true);
    try {
      const { data: savedData } = await supabase
        .from('saved_catalog_deals')
        .select('catalog_deal_id')
        .eq('user_id', userId);
      const ids = new Set<string>((savedData ?? []).map((r: any) => r.catalog_deal_id));
      setSavedIds(ids);

      const { data: dealsData, error } = await supabase
        .from('catalog_deals')
        .select(CATALOG_DEAL_SELECT)
        .eq('status', 'active');
      if (error) throw error;
      setDeals(
        ((dealsData ?? []) as unknown as CatalogDealJoinRow[]).map((row) =>
          mapCatalogDealRow(row, ids.has(row.id)),
        ),
      );
    } catch (e) {
      console.error('loadDeals error', e);
    } finally {
      setDealsLoading(false);
    }
  };

  const loadRedemptions = async (userId: string) => {
    const { data } = await supabase
      .from('catalog_deal_redemptions')
      .select('*')
      .eq('user_id', userId)
      .order('redeemed_at', { ascending: false })
      .limit(20);
    if (data) {
      setRedemptions(data.map((r: any) => ({
        id: r.id,
        businessName: r.business_name_snapshot,
        dealTitle: r.deal_title_snapshot,
        discountDetail: r.discount_detail_snapshot,
        category: r.category_snapshot,
        redeemedAt: formatRelativeTime(r.redeemed_at),
      })));
    }
  };

  const refreshRedemptions = async () => {
    if (user) await loadRedemptions(user.id);
  };

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  };

  const signUp = async (email: string, password: string, fullName: string): Promise<string | null> => {
    // This dynamically gets the correct app URL (exp:// for Expo Go, or lokala:// for Production)
    const redirectUrl = Linking.createURL('');

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: redirectUrl
      }
    });
    return error ? error.message : null;
  };

  const signOut = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Sign out error", e);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
    }
  };

  // PROPER ACCOUNT DELETION
  const deleteAccount = async (): Promise<void> => {
    if (!user) return;
    try {
      // 1. Manually clean up associated table data (just to be safe)
      await supabase.from('saved_catalog_deals').delete().eq('user_id', user.id);
      await supabase.from('catalog_deal_redemptions').delete().eq('user_id', user.id);
      await supabase.from('profiles').delete().eq('id', user.id);
      
      // 2. Call our secure SQL function to permanently delete the Auth account
      const { error } = await supabase.rpc('delete_user');
      
      if (error) {
        console.error("RPC Deletion Error:", error);
        Alert.alert("Error", "Failed to delete account from the server.");
        return;
      }

      // 3. Clear local session
      await signOut();
    } catch (e) {
      console.error('Delete account error', e);
      Alert.alert("Error", "An unexpected error occurred while deleting your account.");
    }
  };

  const toggleSave = async (dealId: string) => {
    if (!user) return;
    const isCurrentlySaved = savedIds.has(dealId);

    const result = await toggleSavedDeal(isCurrentlySaved, {
      insertSave: () => supabase.from('saved_catalog_deals').insert({ user_id: user.id, catalog_deal_id: dealId }),
      deleteSave: () =>
        supabase.from('saved_catalog_deals').delete().eq('user_id', user.id).eq('catalog_deal_id', dealId),
    });

    if (!result.ok) {
      console.error('toggleSave error', result.error);
      return;
    }

    // Sync local state to the database's actual outcome -- for the state-drift
    // self-heal case (already saved, now unsaved) this may differ from a naive
    // optimistic flip of isCurrentlySaved.
    setSavedIds(prev => {
      const next = new Set(prev);
      result.isSaved ? next.add(dealId) : next.delete(dealId);
      return next;
    });
    setDeals(prev => prev.map(d => (d.id === dealId ? { ...d, isSaved: result.isSaved } : d)));
  };

  const recordRedemption = async (deal: Deal): Promise<RecordRedemptionResult> => {
    if (!user) return { ok: false, failure: 'server_error' };

    const result = await recordCatalogRedemption(
      {
        catalogDealId: deal.id,
        businessNameSnapshot: deal.businessName,
        dealTitleSnapshot: deal.title,
        discountDetailSnapshot: deal.discountDetail,
        categorySnapshot: deal.category,
      },
      {
        insertRedemption: (input) =>
          supabase.from('catalog_deal_redemptions').insert({
            user_id: user.id,
            catalog_deal_id: input.catalogDealId,
            business_name_snapshot: input.businessNameSnapshot,
            deal_title_snapshot: input.dealTitleSnapshot,
            discount_detail_snapshot: input.discountDetailSnapshot,
            category_snapshot: input.categorySnapshot,
          }),
      },
    );

    if (!result.ok) {
      if (result.failure !== 'already_redeemed_today') {
        console.error('recordRedemption error', result.failure);
      }
      return result;
    }

    // Refresh UI to show the newly saved database row
    await loadRedemptions(user.id);
    return result;
  };

  return (
    <AuthContext.Provider value={{
      user, profile, isInitializing, deals, redemptions, dealsLoading,
      signIn, signUp, signOut, deleteAccount, toggleSave, recordRedemption, refreshRedemptions,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) {
    const h = date.getHours(), ampm = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12;
    return `Today, ${h12}:${date.getMinutes().toString().padStart(2, '0')} ${ampm}`;
  }
  if (diffDays === 1) return 'Yesterday';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}