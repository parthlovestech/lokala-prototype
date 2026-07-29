import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Image, Alert, Switch, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './AuthContext';

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  coffee: 'cafe-outline',
  food: 'restaurant-outline',
  drinks: 'beer-outline',
  health: 'heart-outline',
  retail: 'bag-outline',
  services: 'briefcase-outline',
  auto: 'car-outline',
};

export default function AccountScreen() {
  const { user, profile, deals, redemptions, signOut, deleteAccount, refreshRedemptions } = useAuth();

  const [doNotSell, setDoNotSell] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  useEffect(() => {
    refreshRedemptions();
  }, []);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Member';
  const displayEmail = user?.email || '';
  const savedCount = deals.filter(d => d.isSaved).length;
  const memberId = profile?.member_id ?? '···';

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to permanently delete your account and history? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteAccount() }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Profile</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userEmail}>{displayEmail}</Text>
            {profile?.member_type && (
              <View style={styles.memberBadge}>
                <Ionicons name="ribbon-outline" size={12} color="#555" />
                <Text style={styles.memberText}>{profile.member_type}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.idCard}>
          <View style={styles.idCardTop}>
            <View>
              <Text style={styles.idCardLabel}>Member ID</Text>
              <Text style={styles.idCardValue}>{memberId}</Text>
            </View>
            <View style={styles.idCardIconWrap}>
              <Ionicons name="card-outline" size={22} color="#fff" />
            </View>
          </View>

          <View style={styles.idCardDivider} />
          <View style={styles.idCardBottom}>
            <View style={styles.idCardStat}>
              <Text style={styles.idCardStatNum}>{savedCount}</Text>
              <Text style={styles.idCardStatLabel}>Saved deals</Text>
            </View>
            <View style={styles.idCardStatDivider} />
            <View style={styles.idCardStat}>
              <Text style={styles.idCardStatNum}>{redemptions.length}</Text>
              <Text style={styles.idCardStatLabel}>Redeemed</Text>
            </View>
            <View style={styles.idCardStatDivider} />
            <View style={styles.idCardStat}>
              <Text style={styles.idCardStatNum}>MMCC</Text>
              <Text style={styles.idCardStatLabel}>Chamber</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Redemptions</Text>
          {redemptions.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{redemptions.length}</Text>
            </View>
          )}
        </View>

        {redemptions.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Ionicons name="receipt-outline" size={28} color="#ddd" />
            <Text style={styles.emptyHistoryText}>No redemptions yet.</Text>
            <Text style={styles.emptyHistorySub}>Open a deal and tap "Press for discount" to log it.</Text>
          </View>
        ) : (
          <View style={styles.historyCard}>
            {redemptions.map((item, i) => (
              <View key={item.id} style={[styles.historyRow, i < redemptions.length - 1 && styles.historyRowBorder]}>
                <View style={styles.historyIconWrap}>
                  <Ionicons name={CATEGORY_ICONS[item.category] || 'pricetag-outline'} size={16} color="#555" />
                </View>
                <View style={styles.historyText}>
                  <Text style={styles.historyBiz}>{item.businessName}</Text>
                  <Text style={styles.historyDeal}>{item.discountDetail}</Text>
                </View>
                <Text style={styles.historyTime}>{item.redeemedAt}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Settings & Privacy</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={styles.settingTitle}>Do Not Sell My Personal Information</Text>
              <Text style={styles.settingSub}>Opt-out of aggregated data selling to partner businesses.</Text>
            </View>
            <Switch
              value={doNotSell}
              onValueChange={setDoNotSell}
              trackColor={{ false: '#E2E8F0', true: '#059669' }}
              thumbColor={Platform.OS === 'ios' ? '#FFF' : doNotSell ? '#FFF' : '#F8FAFC'}
            />
          </View>
          <View style={styles.settingDivider} />
          
          <TouchableOpacity style={styles.settingRow} onPress={() => setShowPrivacyModal(true)} activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>Privacy Policy</Text>
              <Text style={styles.settingSub}>View our detailed privacy terms.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>
          <View style={styles.settingDivider} />
          
          <TouchableOpacity style={styles.settingRow} onPress={() => setShowTermsModal(true)} activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>Terms of Service</Text>
              <Text style={styles.settingSub}>View our rules and guidelines.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.7}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.7}>
          <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Privacy Policy Modal */}
      <Modal visible={showPrivacyModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Privacy Policy</Text>
            <TouchableOpacity onPress={() => setShowPrivacyModal(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={styles.pText}>
              <Text style={styles.pBold}>Section 1: Introduction</Text>{'\n'}
              Welcome to Lokala!...
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Terms of Service Modal */}
      <Modal visible={showTermsModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Terms of Service</Text>
            <TouchableOpacity onPress={() => setShowTermsModal(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={styles.pText}>
              <Text style={styles.pBold}>1. Acceptance of Terms</Text>{'\n'}
              By downloading, installing, or accessing Lokala via our mobile apps or website...
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fafafa' },
  content: { paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 24 : 12, paddingBottom: 110 },
  pageTitle: { fontSize: 26, fontWeight: '700', color: '#111', letterSpacing: -0.5, marginBottom: 20 },

  profileCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 18, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#efefef', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1, marginBottom: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#fff' },
  profileInfo: { flex: 1 },
  userName: { fontSize: 17, fontWeight: '600', color: '#111', marginBottom: 2 },
  userEmail: { fontSize: 13, color: '#aaa', marginBottom: 8 },
  memberBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f2f2f2', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  memberText: { fontSize: 11, color: '#555', fontWeight: '500' },

  idCard: { backgroundColor: '#1a1a1a', borderRadius: 18, padding: 20, marginBottom: 28 },
  idCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  idCardLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  idCardValue: { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: 2 },
  idCardIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },

  idCardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 16 },
  idCardBottom: { flexDirection: 'row', alignItems: 'center' },
  idCardStat: { flex: 1, alignItems: 'center' },
  idCardStatNum: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 3 },
  idCardStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
  idCardStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.1)' },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#111' },
  countBadge: { backgroundColor: '#1a1a1a', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  emptyHistory: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#efefef', paddingVertical: 32, marginBottom: 28, gap: 8 },
  emptyHistoryText: { fontSize: 14, fontWeight: '600', color: '#bbb' },
  emptyHistorySub: { fontSize: 12, color: '#ccc', textAlign: 'center', paddingHorizontal: 24 },

  historyCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#efefef', marginBottom: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  historyRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  historyRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  historyIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  historyText: { flex: 1 },
  historyBiz: { fontSize: 13, fontWeight: '600', color: '#111', marginBottom: 2 },
  historyDeal: { fontSize: 12, color: '#aaa' },
  historyTime: { fontSize: 10, color: '#ccc', fontWeight: '500', textAlign: 'right', maxWidth: 80 },

  settingsCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#efefef', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, justifyContent: 'space-between' },
  settingTitle: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 4 },
  settingSub: { fontSize: 12, color: '#888', lineHeight: 18 },
  settingDivider: { height: 1, backgroundColor: '#f5f5f5' },

  signOutBtn: { paddingVertical: 14, borderRadius: 12, backgroundColor: '#f7f7f7', alignItems: 'center', marginTop: 6 },
  signOutText: { color: '#64748B', fontWeight: '600', fontSize: 15 },

  deleteBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  deleteText: { color: '#DC2626', fontWeight: '600', fontSize: 15 },

  // Privacy & Terms Modal Styles
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  modalCloseBtn: { padding: 4 },
  modalScroll: { flex: 1 },
  modalContent: { padding: 24, paddingBottom: 60 },
  pText: { fontSize: 15, color: '#334155', lineHeight: 24, marginBottom: 24 },
  pBold: { fontWeight: '700', fontSize: 17, color: '#0F172A' },
  pSemiBold: { fontWeight: '600', color: '#1E293B' },
});
