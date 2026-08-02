import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Image, Modal, ScrollView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './AuthContext';
import { PrivacyPolicyContent, TermsOfServiceContent } from './LegalContent';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_DOMAINS = ['colby.edu', 'thomas.edu', 'kvcc.me.edu', 'midmainechamber.com'];

// Add any specific individual emails you want to whitelist here:
const ALLOWED_EMAILS = ['jplourde@cbplourde.com'];

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSignupSuccess, setIsSignupSuccess] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const nameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const setError = (msg: string) => {
    setErrorMessage(msg);
    shake();
  };
  
  const clearMessages = () => {
    setErrorMessage('');
  };

  const handleAuth = async () => {
    Keyboard.dismiss();
    clearMessages();
    const formattedEmail = email.trim().toLowerCase();

    if (!isLogin && !fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!formattedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }
    if (!EMAIL_REGEX.test(formattedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    // Enforce School Domains, Specific Emails & Consent on Sign Up
    if (!isLogin) {
      if (!hasConsented) {
        setError('You must agree to the Terms of Service and Privacy Policy to create an account.');
        return;
      }

      const domain = formattedEmail.split('@')[1];
      const isAllowedDomain = ALLOWED_DOMAINS.includes(domain);
      const isAllowedEmail = ALLOWED_EMAILS.includes(formattedEmail);

      // If it's NOT an allowed domain AND it's NOT an allowed specific email, block them
      if (!isAllowedDomain && !isAllowedEmail) {
        setError('Please use a valid participating college or partner email address.');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        const err = await signIn(formattedEmail, password);
        if (err) {
          setError('Incorrect email or password.');
        }
      } else {
        const err = await signUp(formattedEmail, password, fullName.trim());
        if (err) {
          if (err.toLowerCase().includes('already registered')) {
            setError('An account with this email already exists. Try signing in.');
          } else {
            setError(err);
          }
        } else {
          // Success! Show the "Check your email" screen
          setIsSignupSuccess(true);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    Keyboard.dismiss();
    setIsLogin(v => !v);
    clearMessages();
    setPassword('');
    setFullName('');
    setHasConsented(false);
    setIsSignupSuccess(false);
  };

  if (isSignupSuccess) {
    return (
      <SafeAreaView style={styles.successContainer}>
        <View style={styles.successIconWrap}>
          <Ionicons name="mail-outline" size={48} color="#059669" />
        </View>
        <Text style={styles.successTitle}>Check your email</Text>
        <Text style={styles.successText}>
          We sent a verification link to <Text style={{ fontWeight: '600', color: '#0F172A' }}>{email}</Text>. 
          Please check your inbox (and spam folder) to verify your account before logging in.
        </Text>
        <TouchableOpacity style={styles.successBtn} onPress={() => {
          setIsSignupSuccess(false);
          setIsLogin(true);
        }}>
          <Text style={styles.successBtnText}>Return to Log In</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Tap outside inputs to dismiss keyboard */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
          <View style={styles.header}>
            <Image source={require('../assets/appicon.png')} style={styles.appIcon} resizeMode="contain" />
            <Text style={styles.logo}>Lokala</Text>
            <Text style={styles.subtitle}>
              {isLogin ? 'Welcome back.' : 'Join the local movement.'}
            </Text>
          </View>

          <Animated.View style={[styles.form, { transform: [{ translateX: shakeAnim }] }]}>
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 8 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {!isLogin && (
              <>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  ref={nameRef}
                  style={styles.input}
                  value={fullName}
                  onChangeText={(t) => { setFullName(t); clearMessages(); }}
                  autoCapitalize="words"
                  autoCorrect={false}
                  autoComplete="off"
                  textContentType="none"
                  importantForAutofill="no"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </>
            )}

            <Text style={styles.label}>School or Partner Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(t) => { setEmail(t); clearMessages(); }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                ref={passwordRef}
                style={styles.passwordInput}
                value={password}
                onChangeText={(t) => { setPassword(t); clearMessages(); }}
                secureTextEntry={!showPassword}
                autoComplete="off"
                textContentType="none"
                importantForAutofill="no"
                returnKeyType="done"
                onSubmitEditing={handleAuth}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {!isLogin && (
              <View style={styles.checkboxContainer}>
                <TouchableOpacity onPress={() => { setHasConsented(!hasConsented); clearMessages(); }} style={styles.checkboxTouch}>
                  <Ionicons name={hasConsented ? "checkbox" : "square-outline"} size={22} color={hasConsented ? "#059669" : "#CBD5E1"} />
                </TouchableOpacity>
                <Text style={styles.checkboxText}>
                  I agree to the{' '}
                  <Text style={styles.consentLink} onPress={() => setShowTermsModal(true)}>Terms of Service</Text>
                  {' '}and{' '}
                  <Text style={styles.consentLink} onPress={() => setShowPrivacyModal(true)}>Privacy Policy</Text>.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
              onPress={handleAuth}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.primaryBtnText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
              }
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={switchMode} style={styles.switchBtn}>
              <Text style={styles.switchText}>
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <Text style={styles.switchTextBold}>{isLogin ? 'Sign up' : 'Log in'}</Text>
              </Text>
            </TouchableOpacity>

            <View style={styles.chamberBadge}>
              <Ionicons name="ribbon-outline" size={12} color="#94A3B8" />
              <Text style={styles.chamberText}>Mid-Maine Chamber of Commerce Partner</Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      {/* Privacy Policy Modal */}
      <Modal visible={showPrivacyModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Privacy Policy</Text>
            <TouchableOpacity onPress={() => setShowPrivacyModal(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <PrivacyPolicyContent />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Terms of Service Modal */}
      <Modal visible={showTermsModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Terms of Service</Text>
            <TouchableOpacity onPress={() => setShowTermsModal(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <TermsOfServiceContent />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { flex: 1, justifyContent: 'center', padding: 24, maxWidth: 500, width: '100%', alignSelf: 'center' },
  header: { marginBottom: 30, alignItems: 'center' },
  appIcon: { width: 64, height: 64, borderRadius: 16, marginBottom: 16 },
  logo: { fontSize: 42, fontWeight: '900', color: '#0F172A', letterSpacing: -1 },
  subtitle: { fontSize: 18, color: '#64748B', marginTop: 4 },

  form: { backgroundColor: '#FFF', padding: 24, borderRadius: 24, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 4 },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FCA5A5' },
  errorText: { color: '#DC2626', fontSize: 14, fontWeight: '500', flex: 1, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#F1F5F9', borderRadius: 12, padding: 16, fontSize: 16, color: '#0F172A', marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  passwordRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
  passwordInput: { flex: 1, padding: 16, fontSize: 16, color: '#0F172A' },
  eyeBtn: { paddingRight: 16 },

  checkboxContainer: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, paddingRight: 12 },
  checkboxTouch: { marginRight: 10, marginTop: 2 },
  checkboxText: { flex: 1, fontSize: 13, color: '#475569', lineHeight: 18 },
  consentLink: { color: '#059669', fontWeight: '600' },

  primaryBtn: { backgroundColor: '#059669', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 4 },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  footer: { alignItems: 'center', marginTop: 28, gap: 20 },
  switchBtn: { paddingVertical: 4 },
  switchText: { color: '#64748B', fontSize: 15 },
  switchTextBold: { color: '#059669', fontWeight: '700' },
  chamberBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chamberText: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },

  // Success Screen Styles
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#F8FAFC' },
  successIconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  successTitle: { fontSize: 28, fontWeight: '800', color: '#0F172A', marginBottom: 12, letterSpacing: -0.5 },
  successText: { fontSize: 16, color: '#64748B', textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  successBtn: { backgroundColor: '#F1F5F9', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12, width: '100%', alignItems: 'center' },
  successBtnText: { color: '#0F172A', fontSize: 16, fontWeight: '700' },

  // Privacy & Terms Modal Styles
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  modalCloseBtn: { padding: 4 },
  modalScroll: { flex: 1 },
  modalContent: { padding: 24, paddingBottom: 60 },
});