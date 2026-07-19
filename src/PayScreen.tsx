import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './navigation';
import { useAuth } from './AuthContext';
import { recordTip } from './business';

const TIP_PERCENTS = [15, 20, 25];

export default function PayScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Pay'>>();
  const { businessId, businessName } = route.params;
  const { user } = useAuth();

  const [amountText, setAmountText] = useState('');
  const [selectedPercent, setSelectedPercent] = useState<number | null>(20);
  const [isCustom, setIsCustom] = useState(false);
  const [customTipText, setCustomTipText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(() => {
    const n = parseFloat(amountText);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amountText]);

  const tipAmount = useMemo(() => {
    if (isCustom) {
      const n = parseFloat(customTipText);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    }
    if (selectedPercent === null) return 0;
    return Math.round(subtotal * (selectedPercent / 100) * 100) / 100;
  }, [isCustom, customTipText, selectedPercent, subtotal]);

  const total = Math.round((subtotal + tipAmount) * 100) / 100;
  const canConfirm = subtotal > 0 && !isSubmitting;

  const selectPercent = (p: number) => {
    setIsCustom(false);
    setSelectedPercent(p);
  };

  const selectCustom = () => {
    setIsCustom(true);
    setSelectedPercent(null);
  };

  const handleConfirm = async () => {
    if (!user || !canConfirm) return;
    setIsSubmitting(true);
    setError(null);

    const { tip, error: submitError } = await recordTip({
      userId: user.id,
      businessId,
      businessName,
      subtotal,
      tipPercent: isCustom ? null : selectedPercent,
      tipAmount,
      total,
    });

    setIsSubmitting(false);

    if (submitError || !tip) {
      setError(submitError ?? 'Something went wrong — please try again.');
      return;
    }

    navigation.replace('Confirmation', {
      businessName,
      subtotal,
      tipPercent: isCustom ? null : selectedPercent,
      tipAmount,
      total,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Log Your Visit</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.businessName}>{businessName}</Text>
          <Text style={styles.businessSub}>Enter what you paid, then add a tip if you'd like.</Text>

          <Text style={styles.label}>Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currencySign}>$</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="#CBD5E1"
              keyboardType="decimal-pad"
              value={amountText}
              onChangeText={setAmountText}
              autoFocus
            />
          </View>

          <Text style={[styles.label, { marginTop: 24 }]}>Tip</Text>
          <View style={styles.tipRow}>
            {TIP_PERCENTS.map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.tipChip, !isCustom && selectedPercent === p && styles.tipChipActive]}
                onPress={() => selectPercent(p)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tipChipText, !isCustom && selectedPercent === p && styles.tipChipTextActive]}>
                  {p}%
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.tipChip, isCustom && styles.tipChipActive]}
              onPress={selectCustom}
              activeOpacity={0.85}
            >
              <Text style={[styles.tipChipText, isCustom && styles.tipChipTextActive]}>Custom</Text>
            </TouchableOpacity>
          </View>

          {isCustom && (
            <View style={styles.customRow}>
              <Text style={styles.currencySign}>$</Text>
              <TextInput
                style={styles.customInput}
                placeholder="0.00"
                placeholderTextColor="#CBD5E1"
                keyboardType="decimal-pad"
                value={customTipText}
                onChangeText={setCustomTipText}
                autoFocus
              />
            </View>
          )}

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Tip{!isCustom && selectedPercent !== null ? ` (${selectedPercent}%)` : ''}
              </Text>
              <Text style={styles.summaryValue}>${tipAmount.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
            </View>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!canConfirm}
            activeOpacity={0.85}
          >
            {isSubmitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.confirmBtnText}>Confirm ${total.toFixed(2)}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111' },

  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
  businessName: { fontSize: 24, fontWeight: '700', color: '#111', letterSpacing: -0.4 },
  businessSub: { fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 28 },

  label: { fontSize: 13, fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

  amountRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 16,
    paddingHorizontal: 18, paddingVertical: 6,
  },
  currencySign: { fontSize: 28, fontWeight: '700', color: '#94A3B8', marginRight: 6 },
  amountInput: { flex: 1, fontSize: 32, fontWeight: '700', color: '#111', paddingVertical: 10 },

  tipRow: { flexDirection: 'row', gap: 10 },
  tipChip: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center',
  },
  tipChipActive: { backgroundColor: '#059669', borderColor: '#059669' },
  tipChipText: { fontSize: 15, fontWeight: '700', color: '#111' },
  tipChipTextActive: { color: '#fff' },

  customRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 12,
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 4,
  },
  customInput: { flex: 1, fontSize: 20, fontWeight: '600', color: '#111', paddingVertical: 10 },

  summaryCard: {
    marginTop: 28, backgroundColor: '#F8FAFC', borderRadius: 16,
    padding: 18, borderWidth: 1, borderColor: '#F1F5F9',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: 14, color: '#64748B' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#111' },
  summaryDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 8 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#111' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#059669' },

  errorText: { color: '#DC2626', fontSize: 13, fontWeight: '500', marginTop: 16, textAlign: 'center' },

  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 8 : 16 },
  confirmBtn: {
    backgroundColor: '#059669', borderRadius: 14, paddingVertical: 17, alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: '#A7D8C4' },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
