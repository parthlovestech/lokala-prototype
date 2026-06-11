import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Define the Props type
interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image 
          source={require('../assets/appicon.png')} 
          style={styles.appIcon} 
          resizeMode="contain" 
        />
        <Text style={styles.title}>Welcome to Lokala</Text>
        <Text style={styles.description}>
          Discover local deals and discounts at businesses near you.
          Save your favorites and redeem them easily.
        </Text>
        
        <View style={styles.features}>
          <View style={styles.featureRow}>
            <Ionicons name="map-outline" size={24} color="#059669" />
            <Text style={styles.featureText}>Find deals near you</Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="bookmark-outline" size={24} color="#059669" />
            <Text style={styles.featureText}>Save your favorites</Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="qr-code-outline" size={24} color="#059669" />
            <Text style={styles.featureText}>Redeem with QR code</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={onComplete}>
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'space-between',
    padding: 24,
    paddingBottom: 48,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appIcon: {
    width: 100,
    height: 100,
    borderRadius: 24,
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
    paddingHorizontal: 20,
  },
  features: {
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  featureText: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#059669',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});