import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity, Platform, TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MOCK_BUSINESS } from './mockData';
import { useAuth } from './AuthContext';
import { Business, TipRecord, buildQrValue, createBusiness, getMyBusiness, getTipsForBusiness } from './business';

const STAT_CARDS = [
  { label: 'Redemptions', value: String(MOCK_BUSINESS.totalRedemptions), icon: 'ticket-outline' as const },
  { label: 'New Customers', value: String(MOCK_BUSINESS.newCustomers), icon: 'people-outline' as const },
  { label: 'Via Lokala', value: `$${MOCK_BUSINESS.lokalaRevenue.toLocaleString()}`, icon: 'trending-up-outline' as const },
  { label: 'Cost / Customer', value: MOCK_BUSINESS.activeDeal.costPerAcquisition, icon: 'analytics-outline' as const },
];

const MAX_R = Math.max(...MOCK_BUSINESS.weeklyData.map(d => d.redemptions));

const TAB_LABELS: Record<'overview' | 'deals' | 'qrcode', string> = {
  overview: 'Overview',
  deals: 'Deals',
  qrcode: 'QR Code',
};

export default function BusinessDashboard() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<'overview' | 'deals' | 'qrcode'>('overview');
  const { user } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessLoading, setBusinessLoading] = useState(true);
  const [nameInput, setNameInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [recentTips, setRecentTips] = useState<TipRecord[]>([]);

  const loadBusiness = useCallback(async () => {
    if (!user) return;
    setBusinessLoading(true);
    const biz = await getMyBusiness(user.id);
    setBusiness(biz);
    if (biz) setRecentTips(await getTipsForBusiness(biz.id));
    setBusinessLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'qrcode') loadBusiness();
    }, [activeTab, loadBusiness])
  );

  const handleCreateBusiness = async () => {
    if (!user || !nameInput.trim()) return;
    setCreating(true);
    setCreateError(null);
    const { business: created, error } = await createBusiness(user.id, nameInput);
    setCreating(false);
    if (error || !created) {
      setCreateError(error ?? 'Something went wrong — please try again.');
      return;
    }
    setBusiness(created);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>Business Portal</Text>
            <Text style={styles.bizName}>{MOCK_BUSINESS.name}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.ownerAvatar}>
              <Text style={styles.ownerInitial}>{MOCK_BUSINESS.owner.charAt(0)}</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
              <Ionicons name="close" size={26} color="#111" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabRow}>
          {(['overview', 'deals', 'qrcode'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {TAB_LABELS[tab]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'overview' && (
          <>
            <View style={styles.statsGrid}>
              {STAT_CARDS.map(card => (
                <View key={card.label} style={styles.statCard}>
                  <Ionicons name={card.icon} size={18} color="#888" style={{ marginBottom: 10 }} />
                  <Text style={styles.statValue}>{card.value}</Text>
                  <Text style={styles.statLabel}>{card.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Redemptions This Week</Text>
              <View style={styles.chartArea}>
                {MOCK_BUSINESS.weeklyData.map(d => (
                  <View key={d.day} style={styles.barCol}>
                    <Text style={styles.barValue}>{d.redemptions}</Text>
                    <View style={styles.barBg}>
                      <View style={[styles.barFill, {
                        height: `${(d.redemptions / MAX_R) * 100}%` as any,
                      }]} />
                    </View>
                    <Text style={styles.barDay}>{d.day}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.revenueCard}>
              <View style={styles.revenueRow}>
                <View style={styles.revenueItem}>
                  <Text style={styles.revenueLabel}>Total Revenue</Text>
                  <Text style={styles.revenueValue}>${MOCK_BUSINESS.monthlyRevenue.toLocaleString()}</Text>
                </View>
                <View style={styles.revenueDivider} />
                <View style={styles.revenueItem}>
                  <Text style={styles.revenueLabel}>Via Lokala</Text>
                  <Text style={styles.revenueValue}>${MOCK_BUSINESS.lokalaRevenue.toLocaleString()}</Text>
                </View>
              </View>
              <View style={styles.revBar}>
                <View style={[styles.revBarFill, {
                  width: `${(MOCK_BUSINESS.lokalaRevenue / MOCK_BUSINESS.monthlyRevenue) * 100}%` as any,
                }]} />
              </View>
              <Text style={styles.revBarLabel}>
                Lokala drives {Math.round((MOCK_BUSINESS.lokalaRevenue / MOCK_BUSINESS.monthlyRevenue) * 100)}% of monthly revenue
              </Text>
            </View>
          </>
        )}

        {activeTab === 'deals' && (
          <>
            <View style={styles.dealCard}>
              <View style={styles.activePill}>
                <View style={styles.activeDot} />
                <Text style={styles.activeText}>Active</Text>
              </View>
              <Text style={styles.dealTitle}>{MOCK_BUSINESS.activeDeal.title}</Text>
              <View style={styles.dealStats}>
                <View style={styles.dealStat}>
                  <Text style={styles.dealStatVal}>{MOCK_BUSINESS.activeDeal.redemptionsThisMonth}</Text>
                  <Text style={styles.dealStatLbl}>redemptions</Text>
                </View>
                <View style={styles.dealStat}>
                  <Text style={styles.dealStatVal}>{MOCK_BUSINESS.activeDeal.costPerAcquisition}</Text>
                  <Text style={styles.dealStatLbl}>per customer</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.createBtn} activeOpacity={0.85}>
              <Ionicons name="add" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.createBtnText}>Create New Deal</Text>
            </TouchableOpacity>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>How billing works</Text>
              <Text style={styles.infoBody}>
                Free until 100 monthly redemptions. After that, $5/month flat — no commissions or hidden fees.
              </Text>
            </View>
          </>
        )}

        {activeTab === 'qrcode' && (
          <>
            {businessLoading && (
              <View style={styles.qrLoading}>
                <ActivityIndicator color="#1a1a1a" />
              </View>
            )}

            {!businessLoading && !business && (
              <View style={styles.setupCard}>
                <Ionicons name="qr-code-outline" size={28} color="#1a1a1a" style={{ marginBottom: 12 }} />
                <Text style={styles.setupTitle}>Set up your business</Text>
                <Text style={styles.setupBody}>
                  Add your business name to generate a printable QR code. Customers scan it to log their visit.
                </Text>
                <TextInput
                  style={styles.setupInput}
                  placeholder="Business name"
                  placeholderTextColor="#aaa"
                  value={nameInput}
                  onChangeText={setNameInput}
                />
                {createError && <Text style={styles.setupError}>{createError}</Text>}
                <TouchableOpacity
                  style={[styles.createBtn, (!nameInput.trim() || creating) && { opacity: 0.5 }]}
                  onPress={handleCreateBusiness}
                  disabled={!nameInput.trim() || creating}
                  activeOpacity={0.85}
                >
                  {creating
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.createBtnText}>Generate My QR Code</Text>}
                </TouchableOpacity>
              </View>
            )}

            {!businessLoading && business && (
              <>
                <View style={styles.qrCard}>
                  <Text style={styles.qrBizName}>{business.name}</Text>
                  <View style={styles.qrWrap}>
                    <QRCode value={buildQrValue(business.id)} size={220} />
                  </View>
                  <Text style={styles.qrHint}>Print this and keep it at the register or on tables</Text>
                </View>

                <View style={styles.recentCard}>
                  <Text style={styles.chartTitle}>Recent Check-ins</Text>
                  {recentTips.length === 0 && (
                    <Text style={styles.recentEmpty}>No visits logged yet — once customers scan and confirm, they'll show up here.</Text>
                  )}
                  {recentTips.slice(0, 8).map(tip => (
                    <View key={tip.id} style={styles.recentRow}>
                      <View>
                        <Text style={styles.recentAmount}>${tip.total.toFixed(2)}</Text>
                        <Text style={styles.recentSub}>
                          ${tip.subtotal.toFixed(2)} + ${tip.tipAmount.toFixed(2)} tip
                        </Text>
                      </View>
                      <Text style={styles.recentTime}>
                        {new Date(tip.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fafafa' },
  container: { paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 24 : 12, paddingBottom: 60 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  headerLabel: { fontSize: 12, color: '#aaa', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.7 },
  bizName: { fontSize: 22, fontWeight: '700', color: '#111', letterSpacing: -0.4 },
  ownerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center',
  },
  ownerInitial: { fontSize: 18, fontWeight: '700', color: '#fff' },

  tabRow: {
    flexDirection: 'row', backgroundColor: '#f0f0f0',
    borderRadius: 12, padding: 3, marginBottom: 20,
  },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  tabText: { fontSize: 14, fontWeight: '500', color: '#aaa' },
  tabTextActive: { color: '#111', fontWeight: '600' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard: {
    width: '47.5%', backgroundColor: '#fff', borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: '#efefef',
  },
  statValue: { fontSize: 22, fontWeight: '700', color: '#111', letterSpacing: -0.4, marginBottom: 2 },
  statLabel: { fontSize: 12, color: '#aaa', fontWeight: '500' },

  chartCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 18,
    marginBottom: 14, borderWidth: 1, borderColor: '#efefef',
  },
  chartTitle: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 16 },
  chartArea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 110 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValue: { fontSize: 10, fontWeight: '600', color: '#888', marginBottom: 4 },
  barBg: {
    width: '55%', flex: 1, backgroundColor: '#f4f4f4',
    borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden',
  },
  barFill: { backgroundColor: '#1a1a1a', borderRadius: 4, width: '100%' },
  barDay: { fontSize: 11, color: '#aaa', marginTop: 6 },

  revenueCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: '#efefef', marginBottom: 14,
  },
  revenueRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  revenueItem: { alignItems: 'center' },
  revenueLabel: { fontSize: 12, color: '#aaa', marginBottom: 4 },
  revenueValue: { fontSize: 22, fontWeight: '700', color: '#111', letterSpacing: -0.4 },
  revenueDivider: { width: 1, backgroundColor: '#efefef' },
  revBar: { height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  revBarFill: { height: 6, backgroundColor: '#1a1a1a', borderRadius: 3 },
  revBarLabel: { fontSize: 12, color: '#aaa', textAlign: 'center' },

  dealCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: '#efefef', marginBottom: 12,
  },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2d6a4f' },
  activeText: { fontSize: 12, fontWeight: '600', color: '#2d6a4f' },
  dealTitle: { fontSize: 17, fontWeight: '600', color: '#111', marginBottom: 16, letterSpacing: -0.2 },
  dealStats: { flexDirection: 'row', gap: 24 },
  dealStat: {},
  dealStatVal: { fontSize: 20, fontWeight: '700', color: '#111', letterSpacing: -0.3 },
  dealStatLbl: { fontSize: 12, color: '#aaa', marginTop: 2 },

  createBtn: {
    backgroundColor: '#1a1a1a', borderRadius: 12, paddingVertical: 15,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  createBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  infoCard: {
    backgroundColor: '#f7f7f7', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#ebebeb',
  },
  infoTitle: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  infoBody: { fontSize: 13, color: '#888', lineHeight: 19 },

  qrLoading: { paddingVertical: 60, alignItems: 'center' },

  setupCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 22,
    borderWidth: 1, borderColor: '#efefef', alignItems: 'center',
  },
  setupTitle: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 6 },
  setupBody: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  setupInput: {
    width: '100%', borderWidth: 1.5, borderColor: '#eee', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#111', marginBottom: 8,
  },
  setupError: { color: '#DC2626', fontSize: 12, marginBottom: 8, alignSelf: 'flex-start' },

  qrCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: '#efefef', alignItems: 'center', marginBottom: 14,
  },
  qrBizName: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 18 },
  qrWrap: { padding: 16, backgroundColor: '#fff', borderRadius: 12 },
  qrHint: { fontSize: 12, color: '#aaa', marginTop: 16, textAlign: 'center' },

  recentCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: '#efefef',
  },
  recentEmpty: { fontSize: 13, color: '#aaa', lineHeight: 19 },
  recentRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f4f4f4',
  },
  recentAmount: { fontSize: 15, fontWeight: '700', color: '#111' },
  recentSub: { fontSize: 12, color: '#aaa', marginTop: 2 },
  recentTime: { fontSize: 12, color: '#aaa' },
});