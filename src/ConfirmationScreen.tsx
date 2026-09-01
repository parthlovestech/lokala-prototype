import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './navigation';
import { formatCents } from './payments/money';

export default function ConfirmationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Confirmation'>>();
  // Everything shown here comes from the server-confirmed redemption result --
  // no locally calculated totals.
  const { confirmation } = route.params;

  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleDone = () => {
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'MainApp' }] })
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Animated.View style={[styles.checkCircle, { transform: [{ scale }], opacity }]}>
          <Ionicons name="checkmark" size={56} color="#fff" />
        </Animated.View>

        <Text style={styles.title}>
          {formatCents(confirmation.balanceDebitedCents)} redeemed
        </Text>
        <Text style={styles.subtitle}>Paid to {confirmation.merchantDisplayName}</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Confirmation code</Text>
            <Text style={styles.rowMono}>{confirmation.confirmationCode}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Subtotal</Text>
            <Text style={styles.rowValue}>{formatCents(confirmation.subtotalCents)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Tip</Text>
            <Text style={styles.rowValue}>{formatCents(confirmation.tipCents)}</Text>
          </View>
          {confirmation.remainingWalletBalanceCents !== null && (
            <>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.totalLabel}>Remaining Lokala balance</Text>
                <Text style={styles.totalValue}>
                  {formatCents(confirmation.remainingWalletBalanceCents)}
                </Text>
              </View>
            </>
          )}
        </View>

        {confirmation.idempotent && (
          <Text style={styles.idempotentNote}>
            This redemption was already confirmed — showing your original receipt.
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.doneBtn} onPress={handleDone} activeOpacity={0.85}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff', justifyContent: 'space-between' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },

  checkCircle: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: '#059669',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111', letterSpacing: -0.3, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#64748B', marginTop: 4, marginBottom: 28 },

  card: {
    width: '100%', backgroundColor: '#F8FAFC', borderRadius: 18,
    padding: 22, borderWidth: 1, borderColor: '#F1F5F9',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { fontSize: 15, color: '#64748B' },
  rowValue: { fontSize: 15, fontWeight: '600', color: '#111' },
  rowMono: { fontSize: 15, fontWeight: '700', color: '#111', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 10 },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#111' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#059669' },

  idempotentNote: { fontSize: 12, color: '#94A3B8', marginTop: 20, textAlign: 'center' },

  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 8 : 16 },
  doneBtn: { backgroundColor: '#111', borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
