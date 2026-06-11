import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MOCK_BUSINESS } from './mockData';

const STAT_CARDS = [
  { label: 'Redemptions', value: String(MOCK_BUSINESS.totalRedemptions), icon: 'ticket-outline' as const },
  { label: 'New Customers', value: String(MOCK_BUSINESS.newCustomers), icon: 'people-outline' as const },
  { label: 'Via Lokala', value: `$${MOCK_BUSINESS.lokalaRevenue.toLocaleString()}`, icon: 'trending-up-outline' as const },
  { label: 'Cost / Customer', value: MOCK_BUSINESS.activeDeal.costPerAcquisition, icon: 'analytics-outline' as const },
];

const MAX_R = Math.max(...MOCK_BUSINESS.weeklyData.map(d => d.redemptions));

export default function BusinessDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'deals'>('overview');

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
          <View style={styles.ownerAvatar}>
            <Text style={styles.ownerInitial}>{MOCK_BUSINESS.owner.charAt(0)}</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          {(['overview', 'deals'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
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
});