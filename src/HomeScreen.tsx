import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Platform, ScrollView,
  Linking, ActivityIndicator, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { useAuth, Deal } from './AuthContext';

const CATEGORIES = ['All', 'i', 'drinks', 'coffee', 'health', 'retail', 'services', 'auto'];
const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  All: 'apps', coffee: 'cafe', food: 'restaurant', drinks: 'beer',
  health: 'heart', retail: 'bag', services: 'briefcase', auto: 'car',
};
const CATEGORY_LABELS: Record<string, string> = {
  All: 'All', coffee: 'Coffee', food: 'Food', drinks: 'Drinks',
  health: 'Health', retail: 'Retail', services: 'Services', auto: 'Auto',
};

const openMaps = (deal: Deal) => {
  const label = encodeURIComponent(deal.businessName);
  let url = '';

  if (deal.lat && deal.lng) {
    const latLng = `${deal.lat},${deal.lng}`;
    url = Platform.select({
      ios: `maps://0,0?q=${label}&ll=${latLng}`,
      android: `geo:0,0?q=${latLng}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${deal.lat},${deal.lng}`
    });
  } else {
    const query = encodeURIComponent(`${deal.businessName} ${deal.address}`);
    url = Platform.select({
      ios: `maps://?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`
    });
  }
  
  if (url) Linking.openURL(url);
};

export default function HomeScreen() {
  const route = useRoute();
  const { deals, dealsLoading, toggleSave, profile, recordRedemption } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  
  const [hasPressedDiscount, setHasPressedDiscount] = useState(false);
  const [showBizDetail, setShowBizDetail] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const isMyDealsTab = route.name === 'Saved';

  const filteredDeals = deals.filter((d: Deal) => {
    const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase()) || d.businessName.toLowerCase().includes(search.toLowerCase());
    const matchesTab = isMyDealsTab ? d.isSaved : true;
    const matchesCategory = activeCategory === 'All' || d.category === activeCategory;
    return matchesSearch && matchesTab && matchesCategory;
  });

  const handleRedeem = async () => {
    if (!selectedDeal || isRedeeming) return;
    setIsRedeeming(true);
    await recordRedemption(selectedDeal);
    setIsRedeeming(false);
    setHasPressedDiscount(true);
  };

  const closeModal = () => {
    setSelectedDeal(null);
    setHasPressedDiscount(false);
    setShowBizDetail(false);
  };

  const renderDeal = ({ item }: { item: Deal }) => {
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => setSelectedDeal(item)}>
        <View style={styles.cardContent}>
          <View style={styles.textContainer}>
            <View style={styles.topRow}>
              <Text style={styles.businessLabel}>{item.businessName}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
            
            <View style={styles.bottomRow}>
              {item.percentOff ? (
                <View style={styles.discountTag}>
                  <Text style={styles.discountTagText}>{item.percentOff}% off</Text>
                </View>
              ) : (
                <View style={[styles.discountTag, styles.discountTagAlt]}>
                  <Text style={[styles.discountTagText, styles.discountTagTextAlt]}>Special deal</Text>
                </View>
              )}
              
              <TouchableOpacity style={styles.directionsBtn} onPress={(e) => { e.stopPropagation(); openMaps(item); }}>
                <Ionicons name="navigate" size={14} color="#059669" />
                <Text style={styles.directionsText}>Directions</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <TouchableOpacity
            style={[styles.saveBtn, item.isSaved && styles.saveBtnActive]}
            onPress={(e) => { e.stopPropagation(); toggleSave(item.id); }}
          >
            <Ionicons name={item.isSaved ? 'bookmark' : 'bookmark-outline'} size={20} color={item.isSaved ? '#059669' : '#94A3B8'} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.headerTitle}>{isMyDealsTab ? 'Saved Deals' : 'Discover'}</Text>
        {!isMyDealsTab && <Text style={styles.headerSub}>Mid-Maine Chamber of Commerce</Text>}

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
            placeholder="Search businesses or deals"
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#CBD5E1" />
            </TouchableOpacity>
          )}
        </View>

        {!isMyDealsTab && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, alignItems: 'center' }}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity key={cat} style={[styles.catChip, activeCategory === cat && styles.catChipActive]} onPress={() => setActiveCategory(cat)}>
                <Ionicons name={CATEGORY_ICONS[cat]} size={14} color={activeCategory === cat ? '#FFF' : '#64748B'} />
                <Text style={[styles.catChipText, activeCategory === cat && styles.catChipTextActive]}>{CATEGORY_LABELS[cat]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {dealsLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#059669" />
          </View>
        ) : (
          <FlatList
            data={filteredDeals}
            keyExtractor={(item) => item.id}
            renderItem={renderDeal}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 110, paddingHorizontal: 20 }}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="compass-outline" size={32} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>No deals found</Text>
                <Text style={styles.emptySub}>{isMyDealsTab ? 'Save deals to see them here.' : 'Try a different category or search.'}</Text>
              </View>
            )}
          />
        )}

        <Modal 
          visible={!!selectedDeal} 
          animationType="slide" 
          presentationStyle="pageSheet"
          onRequestClose={closeModal}
        >
          <View style={styles.modalContentFullscreen}>
            <View style={styles.modalHandle} />

            {hasPressedDiscount ? (
              <View style={styles.successWrap}>
                <Text style={styles.successTitle}>Discount Unlocked!</Text>
                <Text style={styles.qrLabel}>Present to cashier to verify</Text>
                
                <View style={styles.qrWrap}>
                  <Image source={require('../assets/qrcode.png')} style={styles.staticQr} resizeMode="contain" />
                </View>
                
                <Text style={styles.qrMemberId}>{profile?.member_id}</Text>
                <Text style={styles.qrHelperText}>Scan or manually verify Member ID</Text>

                <TouchableOpacity style={[styles.cancelBtn, { marginTop: 24 }]} onPress={closeModal}>
                  <Text style={[styles.cancelBtnText, { color: '#059669', fontSize: 16 }]}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : showBizDetail ? (
              <>
                <TouchableOpacity style={styles.backRow} onPress={() => setShowBizDetail(false)}>
                  <Ionicons name="arrow-back" size={18} color="#64748B" />
                  <Text style={styles.backText}>Back to deal</Text>
                </TouchableOpacity>
                <Text style={styles.bizDetailName}>{selectedDeal?.businessName}</Text>
                <Text style={styles.bizDetailAddress}>{selectedDeal?.address}</Text>

                <TouchableOpacity style={styles.actionCard} onPress={() => selectedDeal && openMaps(selectedDeal)} activeOpacity={0.8}>
                  <View style={[styles.actionIconWrap, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="map" size={20} color="#059669" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionTitle}>Get Directions</Text>
                    <Text style={styles.actionSub}>Open in Maps</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                </TouchableOpacity>

                {selectedDeal?.phone ? (
                  <TouchableOpacity style={styles.actionCard} onPress={() => Linking.openURL(`tel:${selectedDeal.phone}`)} activeOpacity={0.8}>
                    <View style={[styles.actionIconWrap, { backgroundColor: '#F0F9FF' }]}>
                      <Ionicons name="call" size={20} color="#0284C7" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actionTitle}>Call Business</Text>
                      <Text style={styles.actionSub}>{selectedDeal.phone}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.noBizInfo}><Text style={styles.noBizInfoText}>Phone number not available.</Text></View>
                )}

                <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                  <Text style={styles.cancelBtnText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.modalTopRow}>
                  <TouchableOpacity onPress={() => setShowBizDetail(true)} style={styles.modalBizRow} activeOpacity={0.7}>
                    <Text style={styles.modalBiz}>{selectedDeal?.businessName}</Text>
                    <Ionicons name="chevron-forward" size={14} color="#94A3B8" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalTitle}>{selectedDeal?.title}</Text>
                
                <View style={styles.discountDetailCard}>
                  <Text style={styles.discountDetailText}>{selectedDeal?.discountDetail}</Text>
                  <Text style={styles.discountExpiry}>Valid: {selectedDeal?.expiresAt}</Text>
                </View>

                {/* Removed the flex: 1 spacer that caused the huge gap */}

                <TouchableOpacity style={[styles.redeemBtn, isRedeeming && { opacity: 0.7 }]} onPress={handleRedeem} disabled={isRedeeming} activeOpacity={0.9}>
                  {isRedeeming ? <ActivityIndicator color="#fff" /> : <Text style={styles.redeemBtnText}>Press for discount</Text>}
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                  <Text style={styles.cancelBtnText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1, paddingTop: Platform.OS === 'web' ? 24 : 12 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5, paddingHorizontal: 20 },
  headerSub: { fontSize: 14, color: '#64748B', marginBottom: 16, paddingHorizontal: 20 },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 16, height: 52, marginHorizontal: 20, marginBottom: 16, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 6, elevation: 1 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, color: '#0F172A' },

  categoryRow: { marginBottom: 20, flexGrow: 0, height: 48 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  catChipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  catChipText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  catChipTextActive: { color: '#FFF' },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 18, marginBottom: 14, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  cardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  textContainer: { flex: 1, paddingRight: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  businessLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 4, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 14 },
  
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  discountTag: { backgroundColor: '#ECFDF5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  discountTagAlt: { backgroundColor: '#F1F5F9' },
  discountTagText: { fontSize: 12, fontWeight: '700', color: '#059669' },
  discountTagTextAlt: { color: '#475569' },
  
  directionsBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 4 },
  directionsText: { fontSize: 12, fontWeight: '600', color: '#059669' },
  
  saveBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  saveBtnActive: { backgroundColor: '#ECFDF5' },

  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  emptySub: { fontSize: 15, color: '#64748B', textAlign: 'center' },

  modalContentFullscreen: { flex: 1, backgroundColor: '#FFF', padding: 24, paddingTop: 16, alignItems: 'center' },
  modalHandle: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, marginBottom: 24 },

  modalTopRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 12 },
  modalBizRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  modalBiz: { fontSize: 13, fontWeight: '700', color: '#475569' },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', textAlign: 'left', marginBottom: 20, letterSpacing: -0.5, width: '100%' },

  discountDetailCard: { backgroundColor: '#ECFDF5', borderRadius: 20, padding: 20, width: '100%', borderWidth: 1, borderColor: '#D1FAE5' },
  discountDetailText: { fontSize: 16, fontWeight: '600', color: '#065F46', lineHeight: 24, marginBottom: 8 },
  discountExpiry: { fontSize: 13, color: '#059669', fontWeight: '500' },

  qrLabel: { fontSize: 13, color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  qrWrap: { backgroundColor: '#FFF', borderRadius: 24, padding: 16, marginBottom: 16, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4 },
  staticQr: { width: 140, height: 140 },
  qrMemberId: { fontSize: 22, fontWeight: '800', color: '#0F172A', letterSpacing: 2, marginBottom: 6 },
  qrHelperText: { fontSize: 13, color: '#94A3B8' },

  redeemBtn: { backgroundColor: '#059669', paddingVertical: 18, borderRadius: 16, width: '100%', alignItems: 'center', marginBottom: 8, marginTop: 32, shadowColor: '#059669', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  redeemBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  cancelBtn: { paddingVertical: 16, width: '100%', alignItems: 'center' },
  cancelBtnText: { color: '#64748B', fontWeight: '600', fontSize: 15 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginBottom: 24, backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  backText: { fontSize: 14, color: '#475569', fontWeight: '600' },
  bizDetailName: { fontSize: 24, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5, alignSelf: 'flex-start', marginBottom: 6 },
  bizDetailAddress: { fontSize: 15, color: '#64748B', alignSelf: 'flex-start', marginBottom: 24 },

  actionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 16, width: '100%', marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 6, elevation: 1 },
  actionIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  actionTitle: { fontSize: 16, color: '#0F172A', fontWeight: '600', marginBottom: 2 },
  actionSub: { fontSize: 13, color: '#64748B' },

  noBizInfo: { paddingVertical: 24, alignItems: 'center' },
  noBizInfoText: { fontSize: 14, color: '#94A3B8' },

  successWrap: { width: '100%', alignItems: 'center', marginTop: 16 },
  successTitle: { fontSize: 26, fontWeight: '800', color: '#0F172A', marginBottom: 24, letterSpacing: -0.5 },
});
