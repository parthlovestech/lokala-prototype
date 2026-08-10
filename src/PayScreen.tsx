import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStripe } from '@stripe/stripe-react-native';
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
import { createMerchantQrPayment, getAccessToken, PaymentApiError } from './payments/client';
import type { PaymentReceipt, PaymentSession } from './payments/types';
import { isFailureStatus } from './payments/types';
import {
  attemptMatchesInputs,
  clearActiveAttempt,
  loadActiveAttempt,
  newAttempt,
  patchAttempt,
  saveAttempt,
  type PaymentAttempt,
} from './payments/attemptStore';
import { pollPaymentReceipt } from './payments/pollReceipt';
import { formatCents, parseAmountToCents } from './payments/money';

const TIP_PERCENTS = [15, 20, 25];

/**
 * The screen's lifecycle. `input` collects the amount; `working` covers creating
 * the durable payment and presenting Stripe's sheet; `processing` is reached once
 * the sheet reports success and means "the charge is in flight — the SERVER now
 * decides the outcome, not this device"; `failed` is a confirmed terminal failure.
 */
type Phase = 'input' | 'working' | 'processing' | 'failed';

export default function PayScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Pay'>>();
  const { publicCode, businessName } = route.params;
  const { user } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [amountText, setAmountText] = useState('');
  const [selectedPercent, setSelectedPercent] = useState<number | null>(20);
  const [isCustom, setIsCustom] = useState(false);
  const [customTipText, setCustomTipText] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [error, setError] = useState<string | null>(null);
  // The authoritative, server-calculated breakdown. Null until POST succeeds.
  const [session, setSession] = useState<PaymentSession | null>(null);
  // The canonical receipt once status polling has an answer.
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  // True once polling exhausted its window without a terminal status. The charge
  // may still be settling, so we stay on "Payment processing" and offer a manual
  // re-check of the SAME payment — never a new charge.
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Synchronous lock around payment creation. A ref (not state) so a second tap
  // in the same tick is rejected before React can re-render — the guard against
  // creating two PaymentIntents.
  const creatingLockRef = useRef(false);
  // Latched once Stripe's PaymentSheet reports success. From then on this screen
  // may NEVER create another intent; anything that fails afterwards is a status
  // question about an existing charge, never a reason to charge again.
  const sheetCompletedRef = useRef(false);
  // The durable attempt. Held in a ref so it survives rerenders and every retry
  // reuses the SAME clientRequestId.
  const attemptRef = useRef<PaymentAttempt | null>(null);
  // Guards against navigation/state updates after the screen has gone away.
  const isMountedRef = useRef(true);
  // The current polling session, aborted on unmount or when a new check starts.
  const pollAbortRef = useRef<AbortController | null>(null);

  const subtotalCents = useMemo(() => parseAmountToCents(amountText) ?? 0, [amountText]);

  const tipCents = useMemo(() => {
    if (isCustom) return parseAmountToCents(customTipText) ?? 0;
    if (selectedPercent === null) return 0;
    return Math.round((subtotalCents * selectedPercent) / 100);
  }, [isCustom, customTipText, selectedPercent, subtotalCents]);

  const localPreviewCents = subtotalCents + tipCents;
  const canConfirm = subtotalCents > 0 && phase === 'input';

  const selectPercent = (p: number) => {
    setIsCustom(false);
    setSelectedPercent(p);
  };

  const selectCustom = () => {
    setIsCustom(true);
    setSelectedPercent(null);
  };

  /** Reuse the in-flight attempt if it is for these exact inputs, else start one. */
  const ensureAttempt = async (): Promise<PaymentAttempt> => {
    const inputs = { publicCode, businessName, subtotalCents, tipCents };
    const current = attemptRef.current;
    if (current && attemptMatchesInputs(current, inputs)) {
      return current;
    }
    const fresh = await saveAttempt(newAttempt(inputs));
    attemptRef.current = fresh;
    return fresh;
  };

  const applyError = (err: unknown) => {
    if (err instanceof PaymentApiError) {
      setError(err.message);
    } else {
      setError('Something went wrong. Please try again.');
    }
  };

  /**
   * A confirmed terminal status. Success routes to the canonical receipt screen;
   * a failure/cancel surfaces a safe failure state. Either way the durable attempt
   * is cleared, because the payment is over.
   */
  const handleTerminal = async (settled: PaymentReceipt) => {
    await clearActiveAttempt();
    if (!isMountedRef.current) return;
    if (settled.status === 'succeeded') {
      navigation.replace('Confirmation', { receipt: settled });
      return;
    }
    if (isFailureStatus(settled.status)) {
      setReceipt(settled);
      setPhase('failed');
    }
  };

  /**
   * Resolve a payment by reading its canonical status — never by charging. Used
   * after PaymentSheet success, on a "Check status" tap, and on app resume. It
   * checks the SAME paymentId every time, so it can never create a second charge.
   */
  const startStatusResolution = async (paymentId: string) => {
    setPhase('processing');
    setPollTimedOut(false);
    setError(null);
    setIsChecking(true);

    pollAbortRef.current?.abort();
    const controller = new AbortController();
    pollAbortRef.current = controller;

    const accessToken = await getAccessToken();

    try {
      const result = await pollPaymentReceipt(paymentId, {
        accessToken,
        signal: controller.signal,
        onUpdate: (r) => {
          if (isMountedRef.current) setReceipt(r);
        },
      });
      if (!isMountedRef.current) return;
      if (result.outcome === 'terminal') {
        await handleTerminal(result.receipt);
      } else if (result.outcome === 'timeout') {
        // Still in flight after the window. Never offer a re-charge — only a
        // re-check of this same payment.
        if (result.lastReceipt) setReceipt(result.lastReceipt);
        setPollTimedOut(true);
      }
      // 'aborted' → the screen went away; leave state untouched.
    } catch (err) {
      if (!isMountedRef.current) return;
      if (err instanceof PaymentApiError && err.isAuthError) {
        setError('Please sign in again to check this payment.');
      }
      // A charge may already have happened, so we stay on processing and let the
      // customer re-check — we never fall back to allowing another charge.
      setPollTimedOut(true);
    } finally {
      if (isMountedRef.current) setIsChecking(false);
    }
  };

  /** Manual re-check of the existing payment. Checks status, never charges. */
  const handleCheckStatus = () => {
    const paymentId = attemptRef.current?.paymentId;
    if (!paymentId || isChecking) return;
    void startStatusResolution(paymentId);
  };

  /**
   * Start a genuinely NEW attempt after a confirmed terminal failure. Clears the
   * old attempt and every guard so the next confirm generates a fresh
   * clientRequestId.
   */
  const handleStartNewPayment = async () => {
    await clearActiveAttempt();
    attemptRef.current = null;
    sheetCompletedRef.current = false;
    creatingLockRef.current = false;
    setSession(null);
    setReceipt(null);
    setPollTimedOut(false);
    setError(null);
    setPhase('input');
  };

  // Recover an interrupted payment. If a stored attempt has already reached
  // PaymentSheet success, a charge is in flight: resume by CHECKING its status,
  // never by charging again. A pre-charge attempt is kept only so re-entering the
  // same amount reuses its clientRequestId.
  useEffect(() => {
    isMountedRef.current = true;
    let cancelled = false;

    (async () => {
      const active = await loadActiveAttempt();
      if (cancelled || !active) return;
      attemptRef.current = active;
      if (active.paymentId && active.sheetCompleted) {
        sheetCompletedRef.current = true;
        creatingLockRef.current = true;
        void startStatusResolution(active.paymentId);
      }
    })();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
      pollAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirm = async () => {
    // Ref checks first — they apply synchronously, unlike state.
    if (creatingLockRef.current || sheetCompletedRef.current) return;
    creatingLockRef.current = true;
    setError(null);

    // Authentication is required to attribute the payment to a customer.
    const accessToken = await getAccessToken();
    if (!user || !accessToken) {
      setError('Please sign in to make a payment.');
      creatingLockRef.current = false;
      return;
    }

    if (subtotalCents < 1) {
      setError('Please enter a valid amount.');
      creatingLockRef.current = false;
      return;
    }

    setPhase('working');

    try {
      const attempt = await ensureAttempt();

      // Idempotent on clientRequestId: a retry after a failure returns the SAME
      // session and can never create a second PaymentIntent.
      const created = await createMerchantQrPayment(
        {
          clientRequestId: attempt.clientRequestId,
          qrPublicCode: publicCode,
          subtotalCents,
          tipCents,
        },
        { accessToken },
      );

      // Record the paymentId the instant we have it, so a crash from here on
      // resumes by CHECKING this payment rather than starting a new one.
      attemptRef.current = await patchAttempt(attempt, { paymentId: created.paymentId });
      setSession(created);

      // No client secret means the payment is already terminal on the server
      // (e.g. an idempotent replay of a settled attempt). There is nothing to
      // present — move to processing and let the status check resolve it.
      if (!created.clientSecret) {
        sheetCompletedRef.current = true;
        attemptRef.current = await patchAttempt(attemptRef.current, { sheetCompleted: true });
        void startStatusResolution(created.paymentId);
        return;
      }

      const initResult = await initPaymentSheet({
        merchantDisplayName: created.businessName ?? businessName,
        paymentIntentClientSecret: created.clientSecret,
        allowsDelayedPaymentMethods: true,
      });
      if (initResult.error) {
        // Init failure is pre-charge and safe to retry with the same id.
        setError(initResult.error.message);
        setPhase('input');
        creatingLockRef.current = false;
        return;
      }

      const presentResult = await presentPaymentSheet();
      if (presentResult.error) {
        // Cancel/close is not an error the customer needs to see; any other
        // present error is still pre-charge and retryable with the same id.
        const code = String(presentResult.error.code);
        if (code !== 'Canceled') {
          setError(presentResult.error.message);
        }
        setPhase('input');
        creatingLockRef.current = false;
        return;
      }

      // PaymentSheet reported success. This is NOT canonical success — the ledger
      // is advanced by Stripe's webhook, confirmed via the status check. We latch
      // the guard so no further intent can ever be created for this attempt, and
      // hand off to the processing phase.
      sheetCompletedRef.current = true;
      attemptRef.current = await patchAttempt(attemptRef.current, { sheetCompleted: true });
      void startStatusResolution(created.paymentId);
    } catch (err) {
      // Reaches here only from the create call (or an unexpected throw). A 409
      // (mismatch / already-settled / closed) must NOT silently spawn a new
      // attempt: we surface the safe message and stop. The user may change the
      // amount — which is an explicit new attempt with a new id — to try again.
      applyError(err);
      setPhase('input');
      creatingLockRef.current = false;
    }
  };

  const renderServerSummary = (s: {
    subtotalCents: number;
    tipCents: number;
    customerFeeCents: number;
    totalCents: number;
  }) => (
    <View style={styles.summaryCard}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Subtotal</Text>
        <Text style={styles.summaryValue}>{formatCents(s.subtotalCents)}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Tip</Text>
        <Text style={styles.summaryValue}>{formatCents(s.tipCents)}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Lokala fee</Text>
        <Text style={styles.summaryValue}>{formatCents(s.customerFeeCents)}</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatCents(s.totalCents)}</Text>
      </View>
    </View>
  );

  const summarySource = receipt ?? session;

  if (phase === 'processing') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.processingContent}>
          {!pollTimedOut && <ActivityIndicator size="large" color="#059669" />}
          {pollTimedOut && (
            <Ionicons name="time-outline" size={56} color="#059669" />
          )}
          <Text style={styles.processingTitle}>Payment processing</Text>
          <Text style={styles.processingBody}>
            {pollTimedOut
              ? "Your payment is still being confirmed. You haven't been charged twice — you can check again in a moment."
              : "We're confirming your payment. This can take a moment."}
          </Text>
          {summarySource && renderServerSummary(summarySource)}
          {error && <Text style={styles.errorText}>{error}</Text>}
          {pollTimedOut && (
            <TouchableOpacity
              style={[styles.secondaryBtn, isChecking && styles.confirmBtnDisabled]}
              onPress={handleCheckStatus}
              disabled={isChecking}
              activeOpacity={0.85}
            >
              {isChecking
                ? <ActivityIndicator color="#059669" />
                : <Text style={styles.secondaryBtnText}>Check status</Text>}
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'failed') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.processingContent}>
          <View style={styles.failCircle}>
            <Ionicons name="close" size={48} color="#fff" />
          </View>
          <Text style={styles.processingTitle}>Payment not completed</Text>
          <Text style={styles.processingBody}>
            {receipt?.status === 'canceled'
              ? 'This payment was canceled. You were not charged.'
              : 'This payment did not go through. You were not charged.'}
          </Text>
          <View style={styles.footerInline}>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={handleStartNewPayment}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmBtnText}>Start New Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

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
              editable={phase === 'input'}
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

          {/* Input phase always shows a fresh local preview; the authoritative,
              server-calculated breakdown appears in the processing and
              confirmation screens (and in Stripe's own sheet at checkout). */}
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
              <Text style={styles.totalLabel}>Subtotal + tip</Text>
              <Text style={styles.totalValue}>{formatCents(localPreviewCents)}</Text>
            </View>
            <Text style={styles.feeNote}>A small Lokala fee is calculated at checkout.</Text>
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
            {phase === 'working'
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.confirmBtnText}>Continue to Payment</Text>}
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
  feeNote: { fontSize: 12, color: '#94A3B8', marginTop: 10 },

  errorText: { color: '#DC2626', fontSize: 13, fontWeight: '500', marginTop: 16, textAlign: 'center' },

  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 8 : 16 },
  confirmBtn: {
    backgroundColor: '#059669', borderRadius: 14, paddingVertical: 17, alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: '#A7D8C4' },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  processingContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  processingTitle: { fontSize: 20, fontWeight: '800', color: '#111', marginTop: 20 },
  processingBody: { fontSize: 14, color: '#64748B', marginTop: 8, textAlign: 'center', lineHeight: 20 },

  failCircle: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: '#DC2626',
    alignItems: 'center', justifyContent: 'center',
  },

  secondaryBtn: {
    marginTop: 24, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 40,
    borderWidth: 1.5, borderColor: '#059669', alignItems: 'center', minWidth: 220,
  },
  secondaryBtnText: { color: '#059669', fontWeight: '700', fontSize: 16 },

  footerInline: { marginTop: 28, width: '100%' },
});
