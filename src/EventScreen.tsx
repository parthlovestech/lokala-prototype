import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, Linking, Modal, Animated, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// ── Mock event data ──────────────────────────────────────────────────────
// Later on, businesses will be able to submit these themselves. For now these
// are hand-entered, same as the discount list. Dates are 'YYYY-MM-DD'.
export interface LokalaEvent {
  id: string;
  date: string;
  time: string;
  businessName: string;
  title: string;
  description: string;
  address: string;
  category: 'coffee' | 'food' | 'drinks' | 'retail' | 'health' | 'services' | 'auto' | 'community';
}

const MOCK_EVENTS: LokalaEvent[] = [
  {
    id: 'e1',
    date: '2026-07-19',
    time: '6:00 PM',
    businessName: 'Silver Street Tavern',
    title: 'Trivia Night',
    description: 'Weekly trivia night — teams of up to 6. Show your Lokala card for a free appetizer.',
    address: '2 Silver St, Waterville ME',
    category: 'drinks',
  },
  {
    id: 'e2',
    date: '2026-07-22',
    time: '7:30 AM',
    businessName: "Aroma Joe's",
    title: 'Community Coffee Morning',
    description: 'Meet other Lokala members over coffee. First 20 members get a free pastry.',
    address: '280 Kennedy Memorial Dr, Waterville ME',
    category: 'coffee',
  },
  {
    id: 'e3',
    date: '2026-07-25',
    time: '5:00 PM',
    businessName: 'Jewel of India',
    title: 'Cultural Food Night',
    description: 'A special prix-fixe menu celebrating regional Indian cuisine.',
    address: '4 Silver St, Waterville ME',
    category: 'food',
  },
  {
    id: 'e4',
    date: '2026-07-25',
    time: '6:00 PM',
    businessName: 'Mainely Brews',
    title: 'Live Music: Local Artists',
    description: 'Local musicians take the stage. No cover for Lokala members.',
    address: 'Waterville, ME',
    category: 'drinks',
  },
  {
    id: 'e5',
    date: '2026-08-02',
    time: '10:00 AM',
    businessName: 'Mid-Maine Chamber of Commerce',
    title: 'Small Business Networking Breakfast',
    description: 'Monthly networking breakfast for Chamber members and local business owners.',
    address: 'Waterville, ME',
    category: 'community',
  },
  {
    id: 'e6',
    date: '2026-08-08',
    time: '11:00 AM',
    businessName: 'Fieldstone Garden',
    title: 'Late-Summer Plant Sale',
    description: 'Discounted perennials and shrubs — Lokala members get an extra 5% off.',
    address: 'Waterville, ME',
    category: 'retail',
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  coffee: '#92400E', food: '#B45309', drinks: '#7C3AED',
  health: '#DB2777', retail: '#0369A1', services: '#334155',
  auto: '#475569', community: '#059669',
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function toKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildMonthGrid(year: number, month: number): (number | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const openMaps = (event: LokalaEvent) => {
  const query = encodeURIComponent(`${event.businessName} ${event.address}`);
  const url = Platform.select({
    ios: `maps://?q=${query}`,
    android: `geo:0,0?q=${query}`,
    default: `https://www.google.com/maps/search/?api=1&query=${query}`,
  });
  if (url) Linking.openURL(url);
};

export default function EventsScreen() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState(toKey(today.getFullYear(), today.getMonth(), today.getDate()));
  const [selectedEvent, setSelectedEvent] = useState<LokalaEvent | null>(null);

  const panY = useRef(new Animated.Value(0)).current;
  const modalPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4,
      onPanResponderMove: (_, g) => { if (g.dy > 0) panY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 1.0) {
          Animated.timing(panY, { toValue: 900, duration: 200, useNativeDriver: true }).start(() => {
            setSelectedEvent(null);
            panY.setValue(0);
          });
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const eventsByDate = useMemo(() => {
    const map: Record<string, LokalaEvent[]> = {};
    for (const ev of MOCK_EVENTS) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, []);

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const todayKey = toKey(today.getFullYear(), today.getMonth(), today.getDate());
  const selectedDayEvents = eventsByDate[selectedKey] ?? [];

  const goToMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  };

  const selectedDateLabel = useMemo(() => {
    const [y, m, d] = selectedKey.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }, [selectedKey]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.headerTitle}>Events</Text>
        <Text style={styles.headerSub}>What's happening at local businesses</Text>

        {/* Month navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.monthNavBtn} onPress={() => goToMonth(-1)}>
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
          <TouchableOpacity style={styles.monthNavBtn} onPress={() => goToMonth(1)}>
            <Ionicons name="chevron-forward" size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
          {/* Weekday header */}
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((w, i) => (
              <Text key={i} style={styles.weekdayLabel}>{w}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.grid}>
            {grid.map((day, idx) => {
              if (day === null) return <View key={idx} style={styles.dayCell} />;
              const key = toKey(viewYear, viewMonth, day);
              const hasEvents = !!eventsByDate[key];
              const isSelected = key === selectedKey;
              const isToday = key === todayKey;
              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.dayCell}
                  onPress={() => setSelectedKey(key)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.dayCircle,
                    isSelected && styles.dayCircleSelected,
                    !isSelected && isToday && styles.dayCircleToday,
                  ]}>
                    <Text style={[
                      styles.dayNumber,
                      isSelected && styles.dayNumberSelected,
                      !isSelected && isToday && styles.dayNumberToday,
                    ]}>{day}</Text>
                  </View>
                  {hasEvents && <View style={[styles.eventDot, isSelected && styles.eventDotSelected]} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selected day's events */}
          <View style={styles.eventsSection}>
            <Text style={styles.eventsSectionTitle}>{selectedDateLabel}</Text>

            {selectedDayEvents.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="calendar-outline" size={28} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>No events this day</Text>
                <Text style={styles.emptySub}>Check another date on the calendar above.</Text>
              </View>
            ) : (
              selectedDayEvents.map(ev => (
                <TouchableOpacity
                  key={ev.id}
                  style={styles.eventCard}
                  activeOpacity={0.9}
                  onPress={() => setSelectedEvent(ev)}
                >
                  <View style={[styles.eventTimeWrap, { backgroundColor: `${CATEGORY_COLORS[ev.category]}14` }]}>
                    <Text style={[styles.eventTime, { color: CATEGORY_COLORS[ev.category] }]}>{ev.time}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventBusiness}>{ev.businessName}</Text>
                    <Text style={styles.eventTitle}>{ev.title}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>

        {/* Event detail modal */}
        <Modal visible={!!selectedEvent} animationType="slide" transparent onRequestClose={() => setSelectedEvent(null)}>
          <View style={styles.modalBackdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSelectedEvent(null)} />
            <Animated.View style={[styles.modalBottomSheet, { transform: [{ translateY: panY }] }]}>
              <View style={styles.handleZone} {...modalPanResponder.panHandlers}>
                <View style={styles.modalHandle} />
              </View>

              {selectedEvent && (
                <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
                  <View style={styles.modalBizHeader}>
                    <View style={styles.modalBizIconWrap}>
                      <Ionicons name="storefront-outline" size={16} color="#059669" />
                    </View>
                    <Text style={styles.modalBiz}>{selectedEvent.businessName}</Text>
                  </View>

                  <Text style={styles.modalTitle}>{selectedEvent.title}</Text>

                  <View style={styles.eventDetailCard}>
                    <View style={styles.eventDetailRow}>
                      <Ionicons name="calendar-outline" size={16} color="#059669" />
                      <Text style={styles.eventDetailText}>
                        {new Date(`${selectedEvent.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </Text>
                    </View>
                    <View style={styles.eventDetailRow}>
                      <Ionicons name="time-outline" size={16} color="#059669" />
                      <Text style={styles.eventDetailText}>{selectedEvent.time}</Text>
                    </View>
                  </View>

                  <View style={styles.bizInfoSection}>
                    <Text style={styles.bizInfoSectionTitle}>About</Text>
                    <Text style={styles.bizInfoText}>{selectedEvent.description}</Text>
                  </View>

                  <View style={styles.bizInfoSection}>
                    <Text style={styles.bizInfoSectionTitle}>Location</Text>
                    <View style={styles.bizInfoRow}>
                      <Ionicons name="location-outline" size={16} color="#64748B" style={{ marginTop: 1 }} />
                      <Text style={styles.bizInfoText}>{selectedEvent.address}</Text>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.directionsActionBtn} onPress={() => openMaps(selectedEvent)} activeOpacity={0.8}>
                    <View style={styles.directionsActionIcon}>
                      <Ionicons name="map-outline" size={20} color="#059669" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.directionsActionTitle}>Get Directions</Text>
                      <Text style={styles.directionsActionSub}>Open in Maps</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelectedEvent(null)}>
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
  container: { flex: 1 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5, paddingHorizontal: 20, marginBottom: 2, marginTop: Platform.OS === 'ios' ? 8 : 4 },
  headerSub: { fontSize: 14, color: '#64748B', paddingHorizontal: 20, marginBottom: 16 },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  monthNavBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: '#0F172A' },

  weekdayRow: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 4 },
  weekdayLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#94A3B8' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20 },
  dayCell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, minHeight: 44 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  dayCircleSelected: { backgroundColor: '#059669' },
  dayCircleToday: { borderWidth: 1.5, borderColor: '#059669' },
  dayNumber: { fontSize: 14, fontWeight: '600', color: '#334155' },
  dayNumberSelected: { color: '#FFF', fontWeight: '800' },
  dayNumberToday: { color: '#059669', fontWeight: '800' },
  eventDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#059669', marginTop: 2 },
  eventDotSelected: { backgroundColor: '#0F172A' },

  eventsSection: { paddingHorizontal: 20, marginTop: 18 },
  eventsSectionTitle: { fontSize: 13, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },

  eventCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 10, gap: 12, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  eventTimeWrap: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, minWidth: 76, alignItems: 'center' },
  eventTime: { fontSize: 12, fontWeight: '800' },
  eventBusiness: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  eventTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },

  emptyState: { alignItems: 'center', marginTop: 40, marginBottom: 20 },
  emptyIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#64748B', textAlign: 'center' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  modalBottomSheet: { width: '100%', backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, alignItems: 'center', maxHeight: '90%' },
  handleZone: { width: '100%', alignItems: 'center', paddingTop: 14, paddingBottom: 18 },
  modalHandle: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 3 },

  modalBizHeader: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 12 },
  modalBizIconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  modalBiz: { fontSize: 13, fontWeight: '700', color: '#475569', flex: 1 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', textAlign: 'left', marginBottom: 16, letterSpacing: -0.5, width: '100%' },

  eventDetailCard: { backgroundColor: '#ECFDF5', borderRadius: 20, padding: 18, width: '100%', borderWidth: 1, borderColor: '#D1FAE5', marginBottom: 16, gap: 10 },
  eventDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventDetailText: { fontSize: 14, fontWeight: '700', color: '#065F46' },

  bizInfoSection: { width: '100%', marginBottom: 14, backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  bizInfoSectionTitle: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  bizInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bizInfoText: { fontSize: 14, color: '#475569', flex: 1, lineHeight: 20 },

  directionsActionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 14, width: '100%', marginBottom: 14, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 6, elevation: 1 },
  directionsActionIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  directionsActionTitle: { fontSize: 15, color: '#0F172A', fontWeight: '600', marginBottom: 2 },
  directionsActionSub: { fontSize: 12, color: '#64748B' },

  cancelBtn: { paddingVertical: 16, width: '100%', alignItems: 'center' },
  cancelBtnText: { color: '#64748B', fontWeight: '600', fontSize: 15 },
});