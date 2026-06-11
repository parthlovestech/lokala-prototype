import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, TextInput as RNTextInput, Image, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './AuthContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_DOMAINS = ['colby.edu', 'thomas.edu', 'kvcc.me.edu'];

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

    // Enforce School Domains & Consent on Sign Up
    if (!isLogin) {
      if (!hasConsented) {
        setError('You must agree to the Terms of Service and Privacy Policy to create an account.');
        return;
      }

      const domain = formattedEmail.split('@')[1];
      if (!ALLOWED_DOMAINS.includes(domain)) {
        setError('Lokala is currently only available to colleges in Waterville.');
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

          <Text style={styles.label}>School Email</Text>
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
            
            <Text style={styles.pText}>
              <Text style={styles.pBold}>Section 1: Introduction</Text>{'\n'}
              Welcome to Lokala! When you use our website or our iOS and Android mobile applications (collectively, the "Services"), you trust us with your personal information. Lokala connects you with local discounts and a flexible gift certificate ecosystem valid at multiple independent businesses across the Northeastern United States.{'\n\n'}
              This Privacy Policy explains exactly what data we collect, how we use and share it, where it is stored, and how you can control it. We believe in transparency and write our policies in plain English. By creating an account or using our Services, you agree to the practices described here.
            </Text>

            <Text style={styles.pText}>
              <Text style={styles.pBold}>Section 2: The Data We Collect</Text>{'\n'}
              We collect information that is strictly necessary to run our platform and deliver relevant local deals. This includes:{'\n\n'}
              • <Text style={styles.pSemiBold}>Account & Authentication Data:</Text> Your email address, which we use to securely verify your identity during account registration and login.{'\n'}
              • <Text style={styles.pSemiBold}>Transaction & Ecosystem Data:</Text> Details regarding the gift certificates you purchase, transfer, or redeem, including the timestamp, dollar value, and the specific local establishments where they are spent.{'\n'}
              • <Text style={styles.pSemiBold}>Location Data:</Text> With your explicit device-level permission (via your mobile phone or web browser settings), we collect your geographic location (GPS coordinates).{'\n'}
              • <Text style={styles.pSemiBold}>Preference & App Interaction Data:</Text> We track how you interact with the app, such as the types of local businesses you view, the specific discounts you click on, and the geographic clusters you frequent.
            </Text>

            <Text style={styles.pText}>
              <Text style={styles.pBold}>Section 3: How We Use, Share, and Sell Your Data</Text>{'\n'}
              We use your data to power the core functionality of the platform, including identifying discounts near you and authenticating your account.{'\n\n'}
              <Text style={styles.pSemiBold}>Data Sharing & Commercial Transfers:</Text>{'\n'}
              • <Text style={styles.pSemiBold}>Service Providers (Supabase):</Text> All user accounts, transactional tokens, and application data are hosted via secure cloud servers managed by our third-party infrastructure partner, Supabase.{'\n'}
              • <Text style={styles.pSemiBold}>Ecosystem Partnerships (Selling Data):</Text> To help local economies thrive, Lokala sells aggregated, de-identified user preference data to participating local businesses. For example, we share trends showing which retail or restaurant categories are most popular in a specific zip code or town. We do not sell your raw email address or your real-time individual tracking history.{'\n'}
              • <Text style={styles.pSemiBold}>Redemption Processing:</Text> When you use a universal Lokala gift certificate at a partner establishment, we share the verification status and deduction amount with that business to securely process the merchant transaction.
            </Text>

            <Text style={styles.pText}>
              <Text style={styles.pBold}>Section 4: Data Storage, Protection, and Retention</Text>{'\n'}
              • <Text style={styles.pSemiBold}>Infrastructure:</Text> Your account data is securely organized and stored through our database provider, Supabase.{'\n'}
              • <Text style={styles.pSemiBold}>Security Standards:</Text> We use industry-standard encryption protocols to protect your information in transit and at rest. We implement strict server-side access parameters to keep your raw account identifiers hidden from external lookup threats.{'\n'}
              • <Text style={styles.pSemiBold}>Retention Boundaries:</Text> We store your records for as long as your account remains open. If you request account closure, your identifying markers are deleted from our operational systems.
            </Text>

            <Text style={styles.pText}>
              <Text style={styles.pBold}>Section 5: Your Rights, Protections, and Contacts</Text>{'\n'}
              Because Lokala commercializes localized data patterns, laws across the Northeast (including states like Connecticut) provide you with explicit rights:{'\n\n'}
              • <Text style={styles.pSemiBold}>The Right to Opt-Out of Data Selling:</Text> You have the absolute right to direct us not to sell your preference data. You can activate this restriction at any time via a "Do Not Sell My Personal Information" toggle inside your application profile settings.{'\n'}
              • <Text style={styles.pSemiBold}>The Right to Access & Delete:</Text> You can request a summary report of your profile details or command the full deletion of your user account.{'\n'}
              • <Text style={styles.pSemiBold}>Location Management:</Text> You can turn off GPS permissions inside your phone settings. If disabled, you can still search the app manually by entering a town or zip code.{'\n\n'}
              <Text style={styles.pSemiBold}>Contact Our Privacy Liaison:</Text>{'\n'}
              Email: calmaloneybusiness@gmail.com{'\n'}
              Address: 4 Drew St. Augusta, Maine
            </Text>

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
            
            <Text style={styles.pText}>
              <Text style={styles.pBold}>1. Acceptance of Terms</Text>{'\n'}
              By downloading, installing, or accessing Lokala via our mobile apps or website, you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the app. These terms govern all users within our Northeastern US operational territory.
            </Text>

            <Text style={styles.pText}>
              <Text style={styles.pBold}>2. Account Eligibility & Verification</Text>{'\n'}
              <Text style={styles.pSemiBold}>Requirements:</Text> You must create an account to view discounts and purchase gift certificates. You agree to provide an accurate, authentic email address.{'\n\n'}
              <Text style={styles.pSemiBold}>Security Responsibilities:</Text> Lokala relies on automated email validation to confirm account authenticity. You are entirely responsible for maintaining the privacy of your login session. Lokala is not liable for unauthorized app interactions stemming from a compromised email inbox.
            </Text>

            <Text style={styles.pText}>
              <Text style={styles.pBold}>3. Location-Based Services & App Behavior</Text>{'\n'}
              Our services rely directly on proximity metrics to reveal real-time local discounts. While you can opt out of providing your geographic position, you acknowledge that doing so severely limits the app's core automated value.
            </Text>

            <Text style={styles.pText}>
              <Text style={styles.pBold}>4. The Multi-Establishment Gift Certificate Ecosystem</Text>{'\n'}
              Lokala coordinates a shared gift certificate framework across independent small businesses. By purchasing or using a Lokala gift certificate, you acknowledge the following structure:{'\n\n'}
              • <Text style={styles.pSemiBold}>Universal Redemption:</Text> A Lokala gift certificate holds a cash value that can be split or fully redeemed across multiple, distinct participating local merchants listed within our system.{'\n'}
              • <Text style={styles.pSemiBold}>Merchant Responsibility:</Text> Lokala acts as the technological network manager. The individual participating merchant—not Lokala—is solely responsible for providing the actual goods, services, or dining experiences you purchase. If a local business closes or changes ownership, Lokala will work to redirect your certificate balance to other active merchants in the ecosystem, but holds no direct liability for merchant defaults.{'\n'}
              • <Text style={styles.pSemiBold}>No Cash Back:</Text> Unless explicitly required by state law throughout the Northeastern US, Lokala gift certificates are non-refundable and cannot be exchanged for physical currency.
            </Text>

            <Text style={styles.pText}>
              <Text style={styles.pBold}>5. Data Commercialization Consent</Text>{'\n'}
              By using Lokala to browse local storefront promotions, you grant Lokala permission to analyze your user preference habits and market trends. This includes the monetization of aggregated choice metrics sold to regional commercial entities, subject to your right to opt-out via the app settings.
            </Text>

            <Text style={styles.pText}>
              <Text style={styles.pBold}>6. Limitation of Liability & Account Termination</Text>{'\n'}
              <Text style={styles.pSemiBold}>Disclaimers:</Text> Lokala provides discount listings "as available." Local merchants change their operational discounts frequently; we do not guarantee that a discount displayed in the app will always be honored if a business fails to update its store layout parameters.{'\n\n'}
              <Text style={styles.pSemiBold}>Termination Right:</Text> We reserve the right to suspend or ban accounts that attempt to manipulate authentication codes, spoof location tracking data, or forge gift certificate redemption tokens.
            </Text>

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
  pText: { fontSize: 15, color: '#334155', lineHeight: 24, marginBottom: 24 },
  pBold: { fontWeight: '700', fontSize: 17, color: '#0F172A' },
  pSemiBold: { fontWeight: '600', color: '#1E293B' },
});