import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Platform, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './navigation';
import { parseQrValue, getBusinessById } from './business';

export default function ScanScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [permission, requestPermission] = useCameraPermissions();
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);

  // Only run the camera while this tab is actually focused (avoids the
  // "only one Camera preview can be active" issue mentioned in expo-camera docs).
  useFocusEffect(
    useCallback(() => {
      setIsCameraActive(true);
      setScanLocked(false);
      return () => setIsCameraActive(false);
    }, [])
  );

  const lookupAndGo = async (businessId: string) => {
    setIsLookingUp(true);
    setErrorText(null);
    const business = await getBusinessById(businessId);
    setIsLookingUp(false);

    if (!business) {
      setErrorText("That code doesn't match a Lokala business. Double check and try again.");
      setScanLocked(false);
      return;
    }

    navigation.navigate('Pay', { businessId: business.id, businessName: business.name });
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanLocked || isLookingUp) return;
    const businessId = parseQrValue(result.data);
    if (!businessId) {
      setErrorText("That doesn't look like a Lokala QR code.");
      return;
    }
    setScanLocked(true);
    lookupAndGo(businessId);
  };

  const handleManualSubmit = () => {
    const businessId = parseQrValue(manualCode) ?? manualCode.trim();
    if (!businessId) return;
    Keyboard.dismiss();
    lookupAndGo(businessId);
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
          <ManualEntryPanel
            value={manualCode}
            onChangeText={setManualCode}
            onSubmit={handleManualSubmit}
            onClose={() => setShowManualEntry(false)}
            isLoading={isLookingUp}
            errorText={errorText}
          />
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
          onBarcodeScanned={handleBarcodeScanned}
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
        <ManualEntryPanel
          value={manualCode}
          onChangeText={setManualCode}
          onSubmit={handleManualSubmit}
          onClose={() => setShowManualEntry(false)}
          isLoading={isLookingUp}
          errorText={errorText}
        />
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
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
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
