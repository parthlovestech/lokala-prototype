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
import { supabase } from './supabase';
import { resolvePaymentHub } from './paymentHub';
import {
  redeemBalance,
  validateRedemptionInput,
  REDEMPTION_MESSAGES,
  type RedeemBalanceDeps,
} from './payments/redeemBalance';
import { getOrCreateAttemptId, clearAttemptId } from './payments/redemptionAttempt';
import { formatCents } from './payments/money';

const TIP_PERCENTS = [15, 20, 25];

/**
 * Redeem Lokala gift balance at a merchant's QR code -- a wallet debit, not a
 * card charge. There is no PaymentSheet and nothing to poll for: unlike the
 * retired Stripe flow (charge accepted now, confirmed later by webhook),
 * redeem_lokala_balance answers definitively in one round trip, so `working`
 * is the only in-flight phase and a result is either a navigable success or
 * a retryable, distinctly-messaged error surfaced right here.
 */
type Phase = 'input' | 'working';

function defaultDeps(publicCode: string): RedeemBalanceDeps {
  return {
    redeem: (args) => supabase.rpc('redeem_lokala_balance', args),
    async resolveMerchantDisplayName(code) {
      const hub = await resolvePaymentHub(code);
      return hub?.merchantDisplayName ?? null;
    },
    async getWalletBalanceCents() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return null;
      const { data } = await supabase
        .from('wallets')
        .select('balance_cents')
        .eq('user_id', userId)
        .eq('currency', 'USD')
        .maybeSingle();
      return (data?.balance_cents as number | undefined) ?? null;
    },
  };
}

export default function PayScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Pay'>>();
  const { publicCode, businessName, locationLabel } = route.params;
  const { user } = useAuth();

  const [amountText, setAmountText] = useState('');
  const [selectedPercent, setSelectedPercent] = useState<number | null>(20);
  const [isCustom, setIsCustom] = useState(false);
  const [customTipText, setCustomTipText] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [error, setError] = useState<string | null>(null);

  const subtotalCents = useMemo(() => parseDollarsToCents(amountText) ?? 0, [amountText]);

  const tipCents = useMemo(() => {
    if (isCustom) return parseDollarsToCents(customTipText) ?? 0;
    if (selectedPercent === null) return 0;
    return Math.round((subtotalCents * selectedPercent) / 100);
  }, [isCustom, customTipText, selectedPercent, subtotalCents]);

  const totalCents = subtotalCents + tipCents;
  const canConfirm = subtotalCents > 0 && phase === 'input';

  const selectPercent = (p: number) => {
    setIsCustom(false);
    setSelectedPercent(p);
  };

  const selectCustom = () => {
    setIsCustom(true);
    setSelectedPercent(null);
  };

  const handleConfirm = async () => {
    if (phase !== 'input') return;
    setError(null);

    if (!user) {
      setError(REDEMPTION_MESSAGES.unauthenticated);
      return;
    }

    const clientRequestId = await getOrCreateAttemptId(publicCode);
    const validated = validateRedemptionInput({
      publicCode,
      subtotalCents,
      tipCents,
      clientRequestId,
    });
    if (!validated.ok) {
      setError(REDEMPTION_MESSAGES[validated.failure]);
      return;
    }

    setPhase('working');
    try {
      const result = await redeemBalance(validated.value, defaultDeps(publicCode));

      if (!result.ok) {
        setError(REDEMPTION_MESSAGES[result.failure]);
        setPhase('input');
        return;
      }

      // A fresh success or an idempotent replay both mean the redemption is
      // final -- the next attempt at this publicCode must get a new id.
      await clearAttemptId(publicCode);
      navigation.replace('Confirmation', { confirmation: result.confirmation });
    } catch {
      setError(REDEMPTION_MESSAGES.server_error);
      setPhase('input');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} disabled={phase === 'working'}>
            <Ionicons name="chevron-back" size={26} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pay</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.businessName}>{businessName}</Text>
          <Text style={styles.businessSub}>{locationLabel ?? 'Waterville, ME'}</Text>

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
              editable={phase === 'input'}
              autoFocus
            />
          </View>

          <Text style={[styles.label, { marginTop: 24 }]}>Tip (optional)</Text>
          <View style={styles.tipRow}>
            {TIP_PERCENTS.map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.tipChip, !isCustom && selectedPercent === p && styles.tipChipActive]}
                onPress={() => selectPercent(p)}
                disabled={phase !== 'input'}
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
              disabled={phase !== 'input'}
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
                editable={phase === 'input'}
                autoFocus
              />
            </View>
          )}

          {/* redeem_lokala_balance computes the merchant fee; nothing here is
              a fee preview, only the amount actually debited from the wallet. */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatCents(subtotalCents)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Tip{!isCustom && selectedPercent !== null ? ` (${selectedPercent}%)` : ''}
              </Text>
              <Text style={styles.summaryValue}>{formatCents(tipCents)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total to redeem</Text>
              <Text style={styles.totalValue}>{formatCents(totalCents)}</Text>
            </View>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
            onPress={() => void handleConfirm()}
            disabled={!canConfirm}
            activeOpacity={0.85}
          >
            {phase === 'working'
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.confirmBtnText}>Confirm redemption</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Same parsing discipline as web's redeem-panel: at most two decimal places,
 * rounded to the nearest cent, never negative. */
function parseDollarsToCents(text: string): number | null {
  const dollars = Number(text);
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
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
