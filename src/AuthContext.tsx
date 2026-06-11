import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from './supabase';
import { Session, User } from '@supabase/supabase-js';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';

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
  recordRedemption: (deal: Deal) => Promise<void>;
  refreshRedemptions: () => Promise<void>;
}

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
  recordRedemption: async () => {},
  refreshRedemptions: async () => {},
});

function mapRow(row: any, savedIds: Set<string>): Deal {
  return {
    id: row.id,
    businessName: row.business_name,
    title: row.title,
    subtitle: row.subtitle,
    discountDetail: row.discount_detail,
    expiresAt: row.expires_at,
    isSaved: savedIds.has(row.id),
    category: row.category,
    distanceMeters: row.distance_meters,
    lat: row.latitude,
    lng: row.longitude,
    percentOff: row.percent_off ?? undefined,
    address: row.address,
    phone: row.phone ?? undefined,
    website: row.website ?? undefined,
  };
}

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
      const { data: savedData } = await supabase.from('saved_deals').select('deal_id').eq('user_id', userId);
      const ids = new Set<string>((savedData ?? []).map((r: any) => r.deal_id));
      setSavedIds(ids);

      const { data: dealsData, error } = await supabase.from('deals').select('*').eq('is_active', true);
      if (error) throw error;
      setDeals((dealsData ?? []).map((row: any) => mapRow(row, ids)));
    } catch (e) {
      console.error('loadDeals error', e);
    } finally {
      setDealsLoading(false);
    }
  };

  const loadRedemptions = async (userId: string) => {
    const { data } = await supabase.from('redemptions').select('*').eq('user_id', userId).order('redeemed_at', { ascending: false }).limit(20);
    if (data) {
      setRedemptions(data.map((r: any) => ({
        id: r.id,
        businessName: r.business_name,
        dealTitle: r.deal_title,
        discountDetail: r.discount_detail,
        category: r.category,
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
      await supabase.from('saved_deals').delete().eq('user_id', user.id);
      await supabase.from('redemptions').delete().eq('user_id', user.id);
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
    setSavedIds(prev => {
      const next = new Set(prev);
      isCurrentlySaved ? next.delete(dealId) : next.add(dealId);
      return next;
    });
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, isSaved: !d.isSaved } : d));

    if (isCurrentlySaved) {
      await supabase.from('saved_deals').delete().eq('user_id', user.id).eq('deal_id', dealId);
    } else {
      await supabase.from('saved_deals').insert({ user_id: user.id, deal_id: dealId });
    }
  };

  const recordRedemption = async (deal: Deal) => {
    if (!user) return;

    // Writes permanently to the Supabase database
    const { error } = await supabase.from('redemptions').insert({
      user_id: user.id,
      deal_id: deal.id,
      business_name: deal.businessName,
      deal_title: deal.title,
      discount_detail: deal.discountDetail,
      category: deal.category,
    });

    if (error) console.error("Database Redemption Error:", error);

    // Refresh UI to show the newly saved database row
    await loadRedemptions(user.id);
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