import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Platform, Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './navigation';
import { parseQrValue, getBusinessById, getBusinessByPublicCode } from './business';

// A lookup that hasn't answered by now is never going to — cut it loose so the
// "Looking up business…" spinner can't run forever.
const LOOKUP_TIMEOUT_MS = 12000;

// Shown for timeouts and transport failures. Raw Supabase errors stay in the logs.
const CONNECTION_ERROR_TEXT = 'We could not reach Lokala. Check your connection and try again.';

export default function ScanScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [permission, requestPermission] = useCameraPermissions();
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);

  // The camera fires onBarcodeScanned faster than React can flush state, so the
  // `scanLocked` state alone can let a second frame through before it applies.
  // This ref is the race-free guard; `scanLocked` stays purely for rendering.
  const processingRef = useRef(false);
  // Latches the "not a Lokala QR" notice so an unrecognised code sitting in the
  // frame doesn't re-set state on every single frame.
  const invalidNoticeRef = useRef(false);
  // Guards against state updates landing after the screen has gone away.
  const isMountedRef = useRef(true);
  // A tab screen blurs without unmounting, so `isMountedRef` alone stays true
  // after a tab switch. This tracks focus so a late lookup can't write state or
  // push Pay on top of whichever tab the user moved to.
  const isFocusedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Drop any lookup still in flight when the screen unmounts.
      abortRef.current?.abort();
    };
  }, []);

  // Only run the camera while this tab is actually focused (avoids the
  // "only one Camera preview can be active" issue mentioned in expo-camera docs).
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      setIsCameraActive(true);
      // Coming back to the scanner always clears the guard so the next scan works.
      processingRef.current = false;
      invalidNoticeRef.current = false;
      setScanLocked(false);
      // A lookup abandoned at blur leaves this set; clear it so returning to the
      // tab never shows a spinner for a request that is already gone.
      setIsLookingUp(false);
      return () => {
        isFocusedRef.current = false;
        // Blur is a real exit for this screen — drop the request rather than
        // letting it resolve into a tab the user is no longer looking at.
        abortRef.current?.abort();
        setIsCameraActive(false);
      };
    }, [])
  );

  const lookupAndGo = async (codeOrId: string) => {
    setIsLookingUp(true);
    setErrorText(null);

    // Cancels the Supabase request if it stalls, so the spinner always has an exit.
    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, LOOKUP_TIMEOUT_MS);

    // Only a completed navigation should leave the scanner locked.
    let didNavigate = false;

    try {
      // Check if it's a legacy UUID (length 36 with dashes) or a new public code
      let business = null;
      if (codeOrId.length === 36 && codeOrId.includes('-')) {
        // Legacy UUID format (from old QR codes)
        business = await getBusinessById(codeOrId, controller.signal);
      } else {
        // New public code format (e.g., "nAOpsGQ5ZqhcNHJL" from URL)
        business = await getBusinessByPublicCode(codeOrId, controller.signal);
      }

      // Gone or blurred: leave silently. An abort triggered by blur is not a
      // failure, so it must not surface as not-found or as a timeout.
      if (!isMountedRef.current || !isFocusedRef.current) return;

      if (!business) {
        setErrorText(
          timedOut
            ? CONNECTION_ERROR_TEXT
            : "That code doesn't match a Lokala business. Double check and try again."
        );
        return;
      }

      // Forward the SCANNED public code itself — never a resolved/owner id. The
      // payment API resolves the merchant from this code server-side; the lookup
      // above is only used to confirm the business exists and to show its name.
      navigation.navigate('Pay', { publicCode: codeOrId, businessName: business.name });
      didNavigate = true;
    } catch (e) {
      // Supabase folds most failures into `error`, but a transport-level throw
      // would otherwise skip the reset below and hang the spinner for good.
      console.error('lookupAndGo error', e);
      if (isMountedRef.current && isFocusedRef.current) setErrorText(CONNECTION_ERROR_TEXT);
    } finally {
      clearTimeout(timeoutId);
      // Only clear the shared handle if this lookup still owns it.
      if (abortRef.current === controller) abortRef.current = null;

      // While blurred, leave the lock alone — the scanner must not come back to
      // life behind the user's back. Re-focusing resets all of it anyway.
      if (isMountedRef.current && isFocusedRef.current) {
        setIsLookingUp(false);
        if (!didNavigate) {
          // Failure, timeout or not-found: let the customer try again immediately.
          processingRef.current = false;
          setScanLocked(false);
        }
      }
    }
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    // Ref check first — it applies synchronously, unlike the state flags.
    if (processingRef.current) return;

    const parsedValue = parseQrValue(result.data);
    if (!parsedValue) {
      // Set once, not once per frame.
      if (!invalidNoticeRef.current) {
        invalidNoticeRef.current = true;
        setErrorText("That doesn't look like a Lokala QR code.");
      }
      return;
    }

    invalidNoticeRef.current = false;
    processingRef.current = true;
    setScanLocked(true);
    lookupAndGo(parsedValue);
  };

  const handleManualSubmit = () => {
    if (processingRef.current) return;

    const parsedValue = parseQrValue(manualCode);
    if (!parsedValue) {
      setErrorText("Please enter a valid business code.");
      return;
    }
    Keyboard.dismiss();
    invalidNoticeRef.current = false;
    processingRef.current = true;
    setScanLocked(true);
    lookupAndGo(parsedValue);
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator color="#059669" />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Ionicons name="camera-outline" size={48} color="#94A3B8" style={{ marginBottom: 16 }} />
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionBody}>
            Lokala needs your camera to scan a business's QR code.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Allow Camera Access</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowManualEntry(true)}>
            <Text style={styles.manualLink}>Or enter a code manually</Text>
          </TouchableOpacity>
        </View>
        {showManualEntry && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', zIndex: 100 }]}
            pointerEvents="box-none"
          >
            <ManualEntryPanel
              value={manualCode}
              onChangeText={setManualCode}
              onSubmit={handleManualSubmit}
              onClose={() => {
                setShowManualEntry(false);
                setErrorText(null);
              }}
              isLoading={isLookingUp}
              errorText={errorText}
            />
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {isCameraActive && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          // Detaching the handler while a lookup runs stops the native side from
          // delivering frames at all — the ref guard is the backstop.
          onBarcodeScanned={scanLocked ? undefined : handleBarcodeScanned}
        />
      )}

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.overlayTop}>
          <Text style={styles.overlayTitle}>Scan to Log Your Visit</Text>
          <Text style={styles.overlaySubtitle}>Line up the business's QR code in the frame</Text>
        </View>

        <View style={styles.frameWrap}>
          <View style={styles.frame} />
        </View>

        {isLookingUp && (
          <View style={styles.lookupPill}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.lookupText}>Looking up business…</Text>
          </View>
        )}

        {!isLookingUp && errorText && (
          <View style={styles.errorPill}>
            <Text style={styles.errorPillText}>{errorText}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.manualBtn}
          onPress={() => setShowManualEntry(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="keypad-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.manualBtnText}>Enter code manually</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {showManualEntry && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', zIndex: 100 }]}
          pointerEvents="box-none"
        >
          <ManualEntryPanel
            value={manualCode}
            onChangeText={setManualCode}
            onSubmit={handleManualSubmit}
            onClose={() => {
              setShowManualEntry(false);
              setErrorText(null);
            }}
            isLoading={isLookingUp}
            errorText={errorText}
          />
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function ManualEntryPanel({
  value, onChangeText, onSubmit, onClose, isLoading, errorText,
}: {
  value: string;
  onChangeText: (t: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  isLoading: boolean;
  errorText: string | null;
}) {
  return (
    <View style={styles.manualPanel}>
      <View style={styles.manualPanelHeader}>
        <Text style={styles.manualPanelTitle}>Enter Business Code</Text>
        <TouchableOpacity onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={22} color="#64748B" />
        </TouchableOpacity>
      </View>
      <Text style={styles.manualPanelHint}>
        Ask staff for their business code if the scanner isn't working.
      </Text>
      <TextInput
        style={styles.manualInput}
        placeholder="Business code"
        placeholderTextColor="#94A3B8"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {errorText && <Text style={styles.manualError}>{errorText}</Text>}
      <TouchableOpacity
        style={[styles.primaryBtn, { marginTop: 14 }, (!value.trim() || isLoading) && styles.primaryBtnDisabled]}
        onPress={onSubmit}
        disabled={!value.trim() || isLoading}
        activeOpacity={0.85}
      >
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Continue</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },

  permissionTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 6 },
  permissionBody: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 24, lineHeight: 20 },

  primaryBtn: {
    backgroundColor: '#059669', borderRadius: 12, paddingVertical: 15, paddingHorizontal: 28,
    alignItems: 'center', justifyContent: 'center', minWidth: 220,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  manualLink: { color: '#059669', fontWeight: '600', fontSize: 14, marginTop: 18 },

  overlay: { flex: 1, justifyContent: 'space-between' },
  overlayTop: { paddingHorizontal: 24, paddingTop: 16, alignItems: 'center' },
  overlayTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  overlaySubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },

  frameWrap: { alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: 240, height: 240, borderRadius: 24,
    borderWidth: 3, borderColor: '#059669', backgroundColor: 'transparent',
  },

  lookupPill: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, marginBottom: 12, gap: 8,
  },
  lookupText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  errorPill: {
    alignSelf: 'center', backgroundColor: 'rgba(220,38,38,0.85)',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginBottom: 12, maxWidth: '85%',
  },
  errorPillText: { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' },

  manualBtn: {
    flexDirection: 'row', alignSelf: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 24, marginBottom: Platform.OS === 'ios' ? 12 : 20,
  },
  manualBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  manualPanel: {
    // REMOVED: position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24,
    padding: 24, 
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12,
  },
  manualPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  manualPanelTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  manualPanelHint: { fontSize: 13, color: '#64748B', marginBottom: 16, lineHeight: 18 },
  manualInput: {
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111',
  },
  manualError: { color: '#DC2626', fontSize: 13, marginTop: 10, fontWeight: '500' },
});