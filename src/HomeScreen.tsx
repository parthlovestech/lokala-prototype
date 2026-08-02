// --- START OF FILE lokala-prototype/src/HomeScreen.tsx ---

import React, { useState, useRef, useEffect } from 'react';
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
  { id: 'p2', name: 'Silver Street Tavern', address: '2 Silver St, Waterville' },
  { id: 'p3', name: 'Holy Cannoli', address: 'Waterville, ME' },
];

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

  // --- Pulse Animations for Status Dots (staggered per card) ---
  const pulseAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0.6),
    new Animated.Value(1.2),
  ]).current;

  useEffect(() => {
    const loops = pulseAnims.map((anim, index) => {
      const initialDelay = index * 600;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(initialDelay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return loop;
    });
    
    return () => loops.forEach(loop => loop.stop());
  }, []);

  const pulseScales = pulseAnims.map(anim => 
    anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.7, 1.15],
    })
  );
  const pulseOpacities = pulseAnims.map(anim => 
    anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.6, 0],
    })
  );

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

  const filteredDeals = deals.filter((d: Deal) => {
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

  const handleToggleSave = (dealId: string) => {
    if (!selectedDeal) return;
    toggleSave(dealId);
    setSelectedDeal({ ...selectedDeal, isSaved: !selectedDeal.isSaved });
  };

  const closeModal = () => {
    setSelectedDeal(null);
    setHasPressedDiscount(false);
    panY.setValue(0);
  };

  // --- Press Animation for Cards ---
  const cardScale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => {
    Animated.spring(cardScale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(cardScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
    }).start();
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
            activeOpacity={0.7}
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

        {/* --- COMPACT LOKALA DIRECT SECTION --- */}
        {!isMyDealsTab && (
          <View style={styles.directPaySection}>
            <View style={styles.directPayHeader}>
              <Ionicons name="flash" size={14} color="#059669" />
              <Text style={styles.directPayTitle}>Lokala Direct</Text>
            </View>
            
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.directPayScroll}
            >
              {PAY_LOCATIONS.map((biz, index) => {
                const scale = pulseScales[index] || new Animated.Value(1);
                const opacity = pulseOpacities[index] || new Animated.Value(0);
                
                return (
                  <TouchableOpacity
                    key={biz.id}
                    activeOpacity={1}
                    onPress={() => openMaps({ businessName: biz.name, address: biz.address })}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                  >
                    <Animated.View style={[
                      styles.directPayCard,
                      { transform: [{ scale: cardScale }] }
                    ]}>
                      <View style={styles.directPayAccentLine} />
                      
                      <View style={styles.directPayContent}>
                        <View style={styles.directPayIconContainer}>
                          <Animated.View 
                            style={[
                              styles.directPayPulse,
                              {
                                transform: [{ scale }],
                                opacity,
                              }
                            ]} 
                          />
                          <Ionicons name="scan-circle-outline" size={18} color="#059669" />
                        </View>
                        
                        <View style={styles.directPayTextContainer}>
                          <Text style={styles.directPayName} numberOfLines={1}>{biz.name}</Text>
                          <Text style={styles.directPayAddress} numberOfLines={1}>{biz.address}</Text>
                        </View>
                      </View>
                    </Animated.View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* --- SEARCH & FILTERS --- */}
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

        {/* --- ELEVATED DEAL MODAL --- */}
        <Modal 
          visible={!!selectedDeal} 
          animationType="slide" 
          transparent={true}
          onRequestClose={closeModal}
        >
          <View style={styles.modalBackdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeModal} />
            <Animated.View style={[styles.modalBottomSheet, { transform: [{ translateY: panY }] }]}>
              
              <View style={styles.handleZone} {...modalPanResponder.panHandlers}>
                <View style={styles.modalHandle} />
              </View>

              {hasPressedDiscount ? (
                <View style={styles.successWrap}>
                  <Text style={styles.successTitle}>Discount Unlocked!</Text>
                  <Text style={styles.qrLabel}>Show this card to the cashier</Text>
                  
                  <View style={styles.memberCardWrap}>
                    <Image source={require('../assets/card.jpeg')} style={styles.actualCardImage} resizeMode="contain" />
                  </View>

                  <Text style={styles.qrMemberId}>{profile?.member_id}</Text>
                  <Text style={styles.qrHelperText}>Business verifies by Member ID</Text>

                  <TouchableOpacity style={[styles.cancelBtn, { marginTop: 20 }]} onPress={closeModal}>
                    <Text style={[styles.cancelBtnText, { color: '#059669', fontSize: 16 }]}>Done</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                  
                  {/* Hero Header */}
                  <View style={styles.modalHeroHeader}>
                    <View style={styles.modalHeroHeaderLeft}>
                      <Text style={styles.modalBiz} numberOfLines={1}>{selectedDeal?.businessName}</Text>
                      <View style={styles.sourceBadge}>
                        <Ionicons name="ribbon" size={11} color="#FFF" />
                        <Text style={styles.sourceBadgeText} numberOfLines={1}>
                          {SOURCE_LABELS[selectedDeal?.source ?? 'chamber']}
                        </Text>
                      </View>
                    </View>
                    
                    <TouchableOpacity
                      style={styles.modalSaveCircle}
                      onPress={() => selectedDeal && handleToggleSave(selectedDeal.id)}
                    >
                      <Ionicons
                        name={selectedDeal?.isSaved ? 'bookmark' : 'bookmark-outline'}
                        size={22}
                        color={selectedDeal?.isSaved ? '#059669' : '#0F172A'}
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.modalTitle}>{selectedDeal?.title}</Text>

                  {/* The "Coupon Ticket" Look */}
                  <View style={styles.couponContainer}>
                    <View style={styles.couponInner}>
                      <Text style={styles.couponLabel}>OFFER DETAILS</Text>
                      <Text style={styles.couponText}>{selectedDeal?.discountDetail}</Text>
                      <View style={styles.couponDivider} />
                      <View style={styles.couponFooter}>
                        <Ionicons name="time-outline" size={14} color="#047857" />
                        <Text style={styles.couponExpiry}>Valid: {selectedDeal?.expiresAt}</Text>
                      </View>
                    </View>
                    {/* Visual cutout dots for ticket effect */}
                    <View style={[styles.ticketCutout, styles.ticketCutoutLeft]} />
                    <View style={[styles.ticketCutout, styles.ticketCutoutRight]} />
                  </View>

                  {/* Modern Quick Actions Row */}
                  <View style={styles.quickActionsRow}>
                    <TouchableOpacity style={styles.quickActionItem} onPress={() => selectedDeal && openMaps(selectedDeal)}>
                      <View style={styles.quickActionCircle}>
                        <Ionicons name="map" size={24} color="#0F172A" />
                      </View>
                      <Text style={styles.quickActionText}>Directions</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.quickActionItem, !selectedDeal?.phone && styles.quickActionDisabled]} 
                      onPress={() => selectedDeal?.phone && Linking.openURL(`tel:${selectedDeal.phone}`)}
                      disabled={!selectedDeal?.phone}
                    >
                      <View style={styles.quickActionCircle}>
                        <Ionicons name="call" size={24} color={selectedDeal?.phone ? "#0F172A" : "#CBD5E1"} />
                      </View>
                      <Text style={[styles.quickActionText, !selectedDeal?.phone && { color: '#94A3B8' }]}>Call</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.quickActionItem, !selectedDeal?.website && styles.quickActionDisabled]} 
                      onPress={() => selectedDeal?.website && Linking.openURL(selectedDeal.website)}
                      disabled={!selectedDeal?.website}
                    >
                      <View style={styles.quickActionCircle}>
                        <Ionicons name="globe" size={24} color={selectedDeal?.website ? "#0F172A" : "#CBD5E1"} />
                      </View>
                      <Text style={[styles.quickActionText, !selectedDeal?.website && { color: '#94A3B8' }]}>Website</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.addressBox}>
                    <Ionicons name="location-sharp" size={16} color="#64748B" />
                    <Text style={styles.addressText}>{selectedDeal?.address || 'Address not available'}</Text>
                  </View>

                  {/* Redeem CTA */}
                  <TouchableOpacity
                    style={[styles.redeemBtn, isRedeeming && { opacity: 0.8 }]}
                    onPress={handleRedeem}
                    disabled={isRedeeming}
                    activeOpacity={0.85}
                  >
                    {isRedeeming ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="scan-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.redeemBtnText}>Unlock Discount</Text>
                      </>
                    )}
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
  headerTitle: { fontSize: 30, fontWeight: '900', color: '#0F172A', letterSpacing: -0.8, paddingHorizontal: 20, marginBottom: 2, marginTop: Platform.OS === 'ios' ? 8 : 4 },
  
  locationContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12, marginTop: 0, gap: 6 },
  locationText: { fontSize: 14, color: '#059669', fontWeight: '700' },

  // --- COMPACT DIRECT PAY SECTION ---
  directPaySection: { marginBottom: 16 },
  directPayHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    paddingHorizontal: 20, 
    marginBottom: 8,
  },
  directPayTitle: { 
    fontSize: 13, 
    fontWeight: '800', 
    color: '#0F172A', 
    textTransform: 'uppercase', 
    letterSpacing: 0.8,
  },
  directPayScroll: { 
    paddingHorizontal: 20, 
    gap: 10,
  },

  // Compact card - no wasted space
  directPayCard: { 
    width: 150,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.12)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  
  directPayAccentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: '#059669',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  
  directPayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },

  directPayIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  directPayPulse: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },

  directPayTextContainer: {
    flex: 1,
    minWidth: 0, // Prevents overflow
  },
  directPayName: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#0F172A',
    marginBottom: 1,
  },
  directPayAddress: { 
    fontSize: 10, 
    color: '#64748B', 
    fontWeight: '500',
  },

  // --- SEARCH & CATEGORIES ---
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, paddingHorizontal: 16, height: 48, marginHorizontal: 20, marginBottom: 14, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1, borderWidth: 1, borderColor: '#F1F5F9' },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#0F172A' },

  categoryRow: { marginBottom: 12, flexGrow: 0, minHeight: 44 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', borderRadius: 24, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#F1F5F9', minHeight: 36, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 3, elevation: 1 },
  catChipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  catChipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  catChipTextActive: { color: '#FFF' },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // --- LIST CARDS ---
  card: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9' },
  cardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  textContainer: { flex: 1, paddingRight: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 8, gap: 8, flexWrap: 'wrap' },
  businessLabel: { fontSize: 12, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8 },
  sourceChipMini: { backgroundColor: '#F1F5F9', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  sourceChipMiniText: { fontSize: 9, fontWeight: '800', color: '#64748B', letterSpacing: 0.4 },
  title: { fontSize: 19, fontWeight: '800', color: '#0F172A', marginBottom: 4, letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 16 },
  
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  discountTag: { backgroundColor: '#ECFDF5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  discountTagAlt: { backgroundColor: '#F1F5F9' },
  discountTagText: { fontSize: 12, fontWeight: '800', color: '#059669' },
  discountTagTextAlt: { color: '#475569' },
  
  saveBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  saveBtnActive: { backgroundColor: '#ECFDF5', borderColor: '#D1FAE5' },

  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  emptySub: { fontSize: 15, color: '#64748B', textAlign: 'center' },

  // --- MODAL BACKDROP & BASE ---
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modalBottomSheet: { width: '100%', backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, alignItems: 'center', maxHeight: '92%' },
  
  handleZone: { width: '100%', alignItems: 'center', paddingTop: 16, paddingBottom: 20 },
  modalHandle: { width: 48, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3 },

  // --- ELEVATED DEAL MODAL ---
  modalHeroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: 12 },
  modalHeroHeaderLeft: { flex: 1, paddingRight: 16 },
  modalBiz: { fontSize: 16, fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  sourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0F172A', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start' },
  sourceBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  
  modalSaveCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  
  modalTitle: { fontSize: 32, fontWeight: '900', color: '#0F172A', textAlign: 'left', marginBottom: 24, letterSpacing: -1, width: '100%', lineHeight: 38 },

  // The "Ticket/Coupon" design
  couponContainer: { width: '100%', backgroundColor: '#ECFDF5', borderRadius: 20, padding: 2, marginBottom: 24, position: 'relative', overflow: 'hidden' },
  couponInner: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#34D399', borderRadius: 18, padding: 24 },
  couponLabel: { fontSize: 12, fontWeight: '800', color: '#059669', letterSpacing: 1.2, marginBottom: 8 },
  couponText: { fontSize: 20, fontWeight: '800', color: '#064E3B', lineHeight: 28, marginBottom: 16 },
  couponDivider: { height: 1, backgroundColor: 'rgba(5, 150, 105, 0.2)', marginBottom: 16 },
  couponFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  couponExpiry: { fontSize: 13, color: '#047857', fontWeight: '600' },
  
  // Cutouts for ticket effect
  ticketCutout: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF', top: '50%', marginTop: -12 },
  ticketCutoutLeft: { left: -14 },
  ticketCutoutRight: { right: -14 },

  // Quick Actions (Map, Call, Web)
  quickActionsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 28, paddingHorizontal: 10 },
  quickActionItem: { alignItems: 'center', gap: 8 },
  quickActionDisabled: { opacity: 0.5 },
  quickActionCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  quickActionText: { fontSize: 13, fontWeight: '600', color: '#0F172A' },

  addressBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, marginBottom: 28 },
  addressText: { fontSize: 14, color: '#475569', fontWeight: '500', flex: 1 },

  // Huge Redeem CTA
  redeemBtn: { flexDirection: 'row', backgroundColor: '#059669', paddingVertical: 18, borderRadius: 100, width: '100%', alignItems: 'center', justifyContent: 'center', shadowColor: '#059669', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  redeemBtnText: { color: '#FFF', fontWeight: '800', fontSize: 18, letterSpacing: -0.2 },
  
  cancelBtn: { paddingVertical: 16, width: '100%', alignItems: 'center' },
  cancelBtnText: { color: '#64748B', fontWeight: '700', fontSize: 16 },

  // --- UNLOCKED SCREEN ---
  successWrap: { width: '100%', alignItems: 'center', marginTop: 8 },
  successTitle: { fontSize: 26, fontWeight: '900', color: '#0F172A', marginBottom: 8, letterSpacing: -0.5 },
  qrLabel: { fontSize: 13, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 24 },
  
  memberCardWrap: { 
    width: '100%', 
    alignItems: 'center',
    marginBottom: 28, 
    shadowColor: '#0F172A', 
    shadowOffset: { width: 0, height: 12 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 24, 
    elevation: 8,
    borderRadius: 12,
  },
  actualCardImage: { 
    width: '100%', 
    height: 220, 
    borderRadius: 16, 
  },
  
  qrMemberId: { fontSize: 32, fontWeight: '900', color: '#0F172A', letterSpacing: 2, marginBottom: 4 },
  qrHelperText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
});