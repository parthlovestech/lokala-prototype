import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, ActivityIndicator, Dimensions, Modal, Linking, Image,
  Animated, PanResponder
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth, Deal } from './AuthContext';

const { height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.65;
const HEADER_HEIGHT = 70;
const CLOSED_OFFSET = SHEET_HEIGHT - HEADER_HEIGHT;

function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(meters: number): string {
  const feet = Math.round(meters * 3.28084);
  if (feet < 1000) return `${feet} ft`;
  const miles = meters / 1609.34;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

function getDistanceColor(m: number) {
  if (m < 800) return '#059669'; 
  if (m < 3200) return '#D97706'; 
  return '#64748B'; 
}

function getBadgeStyle(m: number) {
  if (m < 800) return { bg: '#ECFDF5', text: '#059669' };
  if (m < 3200) return { bg: '#FFFBEB', text: '#D97706' };
  return { bg: '#F1F5F9', text: '#64748B' };
}

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

export default function NearbyScreen() {
  const { deals, profile, recordRedemption } = useAuth();
  const mapRef = useRef<MapView>(null);

  const [sortedDeals, setSortedDeals] = useState<Deal[]>([]);
  const [userLoc, setUserLoc] = useState<Location.LocationObjectCoords | null>(null);
  const [locating, setLocating] = useState(true);

  // Modal & Selection states
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [hasPressedDiscount, setHasPressedDiscount] = useState(false);
  const [showBizDetail, setShowBizDetail] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  // Bottom Sheet states
  const isOpenRef = useRef(true);
  const translateY = useRef(new Animated.Value(0)).current;

  // Waterville, ME default center
  const defaultRegion = {
    latitude: 44.5520,
    longitude: -69.6317,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setSortedDeals([...deals].sort((a, b) => a.distanceMeters - b.distanceMeters));
          setLocating(false);
          return;
        }

        let location = await Location.getCurrentPositionAsync({});
        setUserLoc(location.coords);
        
        mapRef.current?.animateToRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }, 1000);

        const calculated = deals.map(d => {
          let actualDist = d.distanceMeters;
          if (d.lat && d.lng) {
            actualDist = getDistanceFromLatLonInMeters(location.coords.latitude, location.coords.longitude, d.lat, d.lng);
          }
          return { ...d, calculatedDistance: actualDist };
        }).sort((a: any, b: any) => a.calculatedDistance - b.calculatedDistance);

        setSortedDeals(calculated);
      } catch (err) {
        console.warn('Location error', err);
        setSortedDeals([...deals].sort((a, b) => a.distanceMeters - b.distanceMeters));
      } finally {
        setLocating(false);
      }
    })();
  }, [deals]);

  const snapTo = (open: boolean) => {
    isOpenRef.current = open;
    Animated.spring(translateY, {
      toValue: open ? 0 : CLOSED_OFFSET,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true, // Capture taps too
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 5,
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dy) < 5 && Math.abs(gesture.dx) < 5) {
          // Tap treated as toggle
          snapTo(!isOpenRef.current);
        } else if (gesture.dy > 30 && isOpenRef.current) {
          // Swipe down to close
          snapTo(false); 
        } else if (gesture.dy < -30 && !isOpenRef.current) {
          // Swipe up to open
          snapTo(true); 
        } else {
          // Revert to current state
          snapTo(isOpenRef.current);
        }
      }
    })
  ).current;

  const handleDealPress = (deal: Deal) => {
    if (deal.lat && deal.lng && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: deal.lat - 0.001,
        longitude: deal.lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 800);
    }
    setSelectedDeal(deal);
  };

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

  const mapDeals = sortedDeals.filter(d => d.lat && d.lng).slice(0, 25);

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        {Platform.OS !== 'web' ? (
          <MapView
            ref={mapRef}
            provider={PROVIDER_DEFAULT}
            style={StyleSheet.absoluteFillObject}
            initialRegion={defaultRegion}
            showsUserLocation={true}
            showsMyLocationButton={true}
            showsCompass={false}
            zoomEnabled={true}
            scrollEnabled={true}
            pitchEnabled={true}
            mapPadding={{ top: 0, right: 0, left: 0, bottom: HEADER_HEIGHT }}
          >
            {mapDeals.map(d => {
              const isSelected = selectedDeal?.id === d.id;
              return (
                <Marker
                  key={d.id}
                  coordinate={{ latitude: d.lat!, longitude: d.lng! }}
                  tracksViewChanges={false}
                  onPress={() => handleDealPress(d)}
                  zIndex={isSelected ? 999 : 1}
                >
                  <View style={[styles.markerDotWrap, isSelected && styles.markerDotWrapSelected]}>
                    <View style={[styles.markerDotInner, isSelected && styles.markerDotInnerSelected]} />
                  </View>
                </Marker>
              );
            })}
          </MapView>
        ) : (
          <View style={styles.webMapFallback}>
            <Ionicons name="map" size={48} color="#CBD5E1" />
            <Text style={styles.webMapText}>Map view available on iOS & Android</Text>
          </View>
        )}
      </View>

      <Animated.View style={[styles.sheetContainer, { transform: [{ translateY }] }]}>
        <View style={styles.sheetHeader} {...panResponder.panHandlers}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Places Nearby</Text>
          <Text style={styles.sheetSub}>
            {locating ? 'Finding you...' : `${sortedDeals.length} active deals`}
          </Text>
        </View>

        {locating ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#059669" />
          </View>
        ) : (
          <FlatList
            data={sortedDeals}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => {
              const dist = (item as any).calculatedDistance ?? item.distanceMeters;
              const badge = getBadgeStyle(dist);
              const distColor = getDistanceColor(dist);
              
              return (
                <View style={styles.row}>
                  <View style={styles.timelineCol}>
                    <View style={[styles.dot, { backgroundColor: distColor }]} />
                    {index < sortedDeals.length - 1 && <View style={styles.line} />}
                  </View>
                  <TouchableOpacity 
                    style={styles.card}
                    activeOpacity={0.7}
                    onPress={() => handleDealPress(item)}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={styles.bizName}>{item.businessName}</Text>
                      <View style={[styles.distBadge, { backgroundColor: badge.bg }]}>
                        <Ionicons name="navigate-outline" size={12} color={badge.text} />
                        <Text style={[styles.distText, { color: badge.text }]}>
                          {formatDistance(dist)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.dealTitle}>{item.title}</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}
      </Animated.View>

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

              <View style={{ flex: 1 }} />

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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  mapContainer: { flex: 1, backgroundColor: '#E2E8F0' },
  webMapFallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  webMapText: { marginTop: 12, color: '#64748B', fontWeight: '500' },

  markerDotWrap: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 4,
  },
  markerDotWrapSelected: {
    backgroundColor: '#0F172A',
    width: 32, height: 32, borderRadius: 16,
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  markerDotInner: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#059669' },
  markerDotInnerSelected: { backgroundColor: '#FFF' },

  sheetContainer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 12,
  },
  sheetHeader: { 
    height: HEADER_HEIGHT,
    alignItems: 'center', paddingTop: 12, 
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    backgroundColor: '#FAFAFA', borderTopLeftRadius: 28, borderTopRightRadius: 28,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', marginBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A', letterSpacing: -0.3 },
  sheetSub: { fontSize: 13, color: '#64748B', marginTop: 2 },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  row: { flexDirection: 'row', marginBottom: 0 },
  timelineCol: { alignItems: 'center', marginRight: 16, paddingTop: 6, width: 14 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#FAFAFA' },
  line: { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginTop: 6, borderRadius: 1 },

  card: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 6, elevation: 1
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  bizName: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.7, flex: 1 },
  distBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  distText: { fontSize: 12, fontWeight: '700' },
  dealTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A', letterSpacing: -0.2 },

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

  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, width: '100%' },
  successTitle: { fontSize: 26, fontWeight: '800', color: '#0F172A', marginBottom: 24, letterSpacing: -0.5 },
});
