import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Platform, ScrollView,
  Linking, ActivityIndicator, Image, Animated, PanResponder
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { useAuth, Deal, SOURCE_LABELS, SOURCE_SHORT_LABELS } from './AuthContext';

// Businesses where you can pay directly with your Lokala card/QR (separate from
// the discount deals below — these are places that accept Lokala as payment).
const PAY_LOCATIONS = [
  { id: 'p1', name: 'Cushnoc Cantina', address: 'Waterville, ME' },
  { id: 'p2', name: 'Silver Street Tavern', address: '2 Silver St, Waterville ME' },
  { id: 'p3', name: 'Holy Cannoli', address: 'Waterville, ME' },
];

// Removed 'drinks' category — only coffee discounts exist currently
const CATEGORIES = ['All', 'coffee', 'food', 'health', 'retail', 'services', 'auto'];
const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  All: 'apps', coffee: 'cafe', food: 'restaurant',
  health: 'heart', retail: 'bag', services: 'briefcase', auto: 'car',
};
const CATEGORY_LABELS: Record<string, string> = {
  All: 'All', coffee: 'Coffee', food: 'Food',
  health: 'Health', retail: 'Retail', services: 'Services', auto: 'Auto',
};

const openMaps = (deal: { businessName: string; address: string; lat?: number; lng?: number }) => {
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
  const isMyDealsTab = route.name === 'Saved';
  const { deals, dealsLoading, toggleSave, profile, recordRedemption } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  
  const [hasPressedDiscount, setHasPressedDiscount] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  // --- Slide to Close Logic ---
  const panY = useRef(new Animated.Value(0)).current;
  const resetPan = () => Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
  
  const modalPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 4,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) panY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 1.0) {
          Animated.timing(panY, { toValue: 900, duration: 220, useNativeDriver: true }).start(closeModal);
        } else {
          resetPan();
        }
      }
    })
  ).current;
  // ----------------------------

  const filteredDeals = deals.filter((d: Deal) => {
    // Search only by business name (not deal title) so users know exactly what they're searching
    const matchesSearch = d.businessName.toLowerCase().includes(search.toLowerCase());
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

  // Handle saving from modal with local state update
  const handleToggleSave = (dealId: string) => {
    if (!selectedDeal) return;
    
    // Call the context toggle function
    toggleSave(dealId);
    
    // Update local selectedDeal state to reflect the change immediately
    setSelectedDeal({
      ...selectedDeal,
      isSaved: !selectedDeal.isSaved
    });
  };

  const closeModal = () => {
    setSelectedDeal(null);
    setHasPressedDiscount(false);
    panY.setValue(0);
  };

  const renderDeal = ({ item }: { item: Deal }) => {
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => setSelectedDeal(item)}>
        <View style={styles.cardContent}>
          <View style={styles.textContainer}>
            <View style={styles.topRow}>
              <Text style={styles.businessLabel} numberOfLines={1}>{item.businessName}</Text>
              <View style={styles.sourceChipMini}>
                <Text style={styles.sourceChipMiniText}>{SOURCE_SHORT_LABELS[item.source]}</Text>
              </View>
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
        
        {!isMyDealsTab && (
          <View style={styles.locationContainer}>
            <Text style={styles.locationText}>Mid-Maine Chamber of Commerce</Text>
          </View>
        )}

        {!isMyDealsTab && (
          <View style={styles.payStripWrap}>
            <Text style={styles.payStripLabel}>Pay with Lokala at</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
            >
              {PAY_LOCATIONS.map(biz => (
                <TouchableOpacity
                  key={biz.id}
                  style={styles.payCard}
                  activeOpacity={0.85}
                  onPress={() => openMaps({ businessName: biz.name, address: biz.address })}
                >
                  <View style={styles.payCardIconWrap}>
                    <Ionicons name="card" size={16} color="#FFF" />
                  </View>
                  <Text style={styles.payCardText} numberOfLines={1}>{biz.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
            placeholder="Search by restaurant name"
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
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.categoryRow} 
            contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
          >
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
          transparent={true}
          onRequestClose={closeModal}
        >
          <View style={styles.modalBackdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeModal} />
            <Animated.View style={[styles.modalBottomSheet, { transform: [{ translateY: panY }] }]}>
              
              {/* Draggable Handle Zone */}
              <View style={styles.handleZone} {...modalPanResponder.panHandlers}>
                <View style={styles.modalHandle} />
              </View>

              {hasPressedDiscount ? (
                /* ── DISCOUNT UNLOCKED: show actual membership card image ── */
                <View style={styles.successWrap}>
                  <Text style={styles.successTitle}>Discount Unlocked!</Text>
                  <Text style={styles.qrLabel}>Show this card to the cashier</Text>
                  
                  {/* Actual Card Image */}
                  <View style={styles.memberCardWrap}>
                    <Image 
                      source={require('../assets/card.jpeg')} 
                      style={styles.actualCardImage} 
                      resizeMode="contain" 
                    />
                  </View>

                  {/* Show Member ID clearly so cashier can verify */}
                  <Text style={styles.qrMemberId}>{profile?.member_id}</Text>
                  <Text style={styles.qrHelperText}>Business verifies by Member ID</Text>

                  <TouchableOpacity style={[styles.cancelBtn, { marginTop: 20 }]} onPress={closeModal}>
                    <Text style={[styles.cancelBtnText, { color: '#059669', fontSize: 16 }]}>Done</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* ── DEAL DETAIL: unified screen with all actions ── */
                <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                  {/* Business name header */}
                  <View style={styles.modalBizHeader}>
                    <View style={styles.modalBizNameRow}>
                      <View style={styles.modalBizIconWrap}>
                        <Ionicons name="storefront-outline" size={16} color="#059669" />
                      </View>
                      <Text style={styles.modalBiz} numberOfLines={1}>{selectedDeal?.businessName}</Text>
                    </View>

                    <View style={styles.modalBizActionsCol}>
                      {/* Source badge — lets us filter by source once non-Chamber discounts exist */}
                      <View style={styles.sourceBadge}>
                        <Ionicons name="ribbon-outline" size={11} color="#64748B" />
                        <Text style={styles.sourceBadgeText} numberOfLines={1}>
                          {SOURCE_LABELS[selectedDeal?.source ?? 'chamber']}
                        </Text>
                      </View>

                      {/* Inline save button - NOW USING handleToggleSave */}
                      <TouchableOpacity
                        style={[styles.inlineSaveBtn, selectedDeal?.isSaved && styles.inlineSaveBtnActive]}
                        onPress={() => selectedDeal && handleToggleSave(selectedDeal.id)}
                      >
                        <Ionicons
                          name={selectedDeal?.isSaved ? 'bookmark' : 'bookmark-outline'}
                          size={18}
                          color={selectedDeal?.isSaved ? '#059669' : '#94A3B8'}
                        />
                        <Text style={[styles.inlineSaveBtnText, selectedDeal?.isSaved && { color: '#059669' }]}>
                          {selectedDeal?.isSaved ? 'Saved' : 'Save'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Deal title & discount details */}
                  <Text style={styles.modalTitle}>{selectedDeal?.title}</Text>

                  <View style={styles.discountDetailCard}>
                    <Text style={styles.discountDetailText}>{selectedDeal?.discountDetail}</Text>
                    <Text style={styles.discountExpiry}>Valid: {selectedDeal?.expiresAt}</Text>
                  </View>

                  {/* About the business */}
                  <View style={styles.bizInfoSection}>
                    <Text style={styles.bizInfoSectionTitle}>About</Text>
                    <View style={styles.bizInfoRow}>
                      <Ionicons name="location-outline" size={16} color="#64748B" style={{ marginTop: 1 }} />
                      <Text style={styles.bizInfoText}>{selectedDeal?.address || 'Address not available'}</Text>
                    </View>
                    {selectedDeal?.phone ? (
                      <TouchableOpacity style={styles.bizInfoRow} onPress={() => Linking.openURL(`tel:${selectedDeal.phone}`)}>
                        <Ionicons name="call-outline" size={16} color="#059669" style={{ marginTop: 1 }} />
                        <Text style={[styles.bizInfoText, { color: '#059669' }]}>{selectedDeal.phone}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {selectedDeal?.website ? (
                      <TouchableOpacity style={styles.bizInfoRow} onPress={() => Linking.openURL(selectedDeal.website!)}>
                        <Ionicons name="globe-outline" size={16} color="#059669" style={{ marginTop: 1 }} />
                        <Text style={[styles.bizInfoText, { color: '#059669' }]} numberOfLines={1}>{selectedDeal.website}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Directions button */}
                  <TouchableOpacity
                    style={styles.directionsActionBtn}
                    onPress={() => selectedDeal && openMaps(selectedDeal)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.directionsActionIcon}>
                      <Ionicons name="map-outline" size={20} color="#059669" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.directionsActionTitle}>Get Directions</Text>
                      <Text style={styles.directionsActionSub}>Open in Maps</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  </TouchableOpacity>

                  {/* Redeem button */}
                  <TouchableOpacity
                    style={[styles.redeemBtn, isRedeeming && { opacity: 0.7 }]}
                    onPress={handleRedeem}
                    disabled={isRedeeming}
                    activeOpacity={0.9}
                  >
                    {isRedeeming
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.redeemBtnText}>Press for discount</Text>
                    }
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                    <Text style={styles.cancelBtnText}>Close</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </Animated.View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1, paddingTop: 0 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5, paddingHorizontal: 20, marginBottom: 4, marginTop: Platform.OS === 'ios' ? 8 : 4 },
  
  locationContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8, marginTop: 0, gap: 6 },
  locationText: { fontSize: 14, color: '#059669', fontWeight: '600' },

  payStripWrap: { marginBottom: 14 },
  payStripLabel: { fontSize: 12, fontWeight: '700', color: '#059669', textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 20, marginBottom: 8 },
  payCard: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#ECFDF5', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1.5, borderColor: '#A7F3D0', shadowColor: '#059669', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
  payCardIconWrap: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#059669', justifyContent: 'center', alignItems: 'center' },
  payCardText: { fontSize: 13, fontWeight: '800', color: '#065F46', maxWidth: 140 },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 14, height: 44, marginHorizontal: 20, marginBottom: 10, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 1 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#0F172A' },

  categoryRow: { marginBottom: 10, flexGrow: 0, minHeight: 44 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#F1F5F9', minHeight: 32 },
  catChipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  catChipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  catChipTextActive: { color: '#FFF' },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 18, marginBottom: 14, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  cardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  textContainer: { flex: 1, paddingRight: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 },
  businessLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 },
  sourceChipMini: { backgroundColor: '#F1F5F9', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  sourceChipMiniText: { fontSize: 9, fontWeight: '800', color: '#64748B', letterSpacing: 0.4 },
  title: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 4, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 14 },
  
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  discountTag: { backgroundColor: '#ECFDF5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  discountTagAlt: { backgroundColor: '#F1F5F9' },
  discountTagText: { fontSize: 12, fontWeight: '700', color: '#059669' },
  discountTagTextAlt: { color: '#475569' },
  
  saveBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  saveBtnActive: { backgroundColor: '#ECFDF5' },

  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  emptySub: { fontSize: 15, color: '#64748B', textAlign: 'center' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  modalBottomSheet: { width: '100%', backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, alignItems: 'center', maxHeight: '90%' },
  
  handleZone: { width: '100%', alignItems: 'center', paddingTop: 14, paddingBottom: 18 },
  modalHandle: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 3 },

  // Unified modal deal view
  modalBizHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', marginBottom: 12 },
  modalBizNameRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  modalBizIconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  modalBiz: { fontSize: 13, fontWeight: '700', color: '#475569', flex: 1 },

  modalBizActionsCol: { alignItems: 'flex-end', gap: 6 },
  sourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, maxWidth: 180 },
  sourceBadgeText: { fontSize: 10, fontWeight: '700', color: '#64748B' },

  inlineSaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  inlineSaveBtnActive: { backgroundColor: '#ECFDF5' },
  inlineSaveBtnText: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },

  modalTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', textAlign: 'left', marginBottom: 16, letterSpacing: -0.5, width: '100%' },

  discountDetailCard: { backgroundColor: '#ECFDF5', borderRadius: 20, padding: 20, width: '100%', borderWidth: 1, borderColor: '#D1FAE5', marginBottom: 16 },
  discountDetailText: { fontSize: 16, fontWeight: '600', color: '#065F46', lineHeight: 24, marginBottom: 8 },
  discountExpiry: { fontSize: 13, color: '#059669', fontWeight: '500' },

  bizInfoSection: { width: '100%', marginBottom: 14, backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  bizInfoSectionTitle: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  bizInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  bizInfoText: { fontSize: 14, color: '#475569', flex: 1, lineHeight: 20 },

  directionsActionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 14, width: '100%', marginBottom: 14, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 6, elevation: 1 },
  directionsActionIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  directionsActionTitle: { fontSize: 15, color: '#0F172A', fontWeight: '600', marginBottom: 2 },
  directionsActionSub: { fontSize: 12, color: '#64748B' },

  redeemBtn: { backgroundColor: '#059669', paddingVertical: 18, borderRadius: 16, width: '100%', alignItems: 'center', marginBottom: 8, shadowColor: '#059669', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  redeemBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  cancelBtn: { paddingVertical: 16, width: '100%', alignItems: 'center' },
  cancelBtnText: { color: '#64748B', fontWeight: '600', fontSize: 15 },

  // Actual Image Card layout
  successWrap: { width: '100%', alignItems: 'center', marginTop: 8 },
  successTitle: { fontSize: 26, fontWeight: '800', color: '#0F172A', marginBottom: 8, letterSpacing: -0.5 },
  qrLabel: { fontSize: 13, color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 },
  
  memberCardWrap: { 
    width: '100%', 
    alignItems: 'center',
    marginBottom: 24, 
    shadowColor: '#0F172A', 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 20, 
    elevation: 8,
    borderRadius: 12,
  },
  actualCardImage: { 
    width: '100%', 
    height: 220, 
    borderRadius: 12, 
  },
  
  qrMemberId: { fontSize: 28, fontWeight: '900', color: '#0F172A', letterSpacing: 2, marginBottom: 4 },
  qrHelperText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
});