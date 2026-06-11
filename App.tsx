import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthProvider, useAuth } from './src/AuthContext';
import AuthScreen from './src/AuthScreen';
import HomeScreen from './src/HomeScreen';
import AccountScreen from './src/AccountScreen';
import NearbyScreen from './src/NearbyScreen';
import OnboardingScreen from './src/OnboardingScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#059669', // Friendly Emerald Green
        tabBarInactiveTintColor: '#94A3B8', // Soft Slate
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#F1F5F9',
          height: Platform.OS === 'ios' ? 88 : 72,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          paddingTop: 10,
          elevation: 0, // Removes harsh Android shadow
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.02,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4
        },
        tabBarIcon: ({ focused, color }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'Deals') iconName = focused ? 'pricetag' : 'pricetag-outline';
          if (route.name === 'Nearby') iconName = focused ? 'map' : 'map-outline';
          if (route.name === 'Saved') iconName = focused ? 'bookmark' : 'bookmark-outline';
          if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Deals" component={HomeScreen} />
      <Tab.Screen name="Nearby" component={NearbyScreen} />
      <Tab.Screen name="Saved" component={HomeScreen} />
      <Tab.Screen name="Profile" component={AccountScreen} />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { user, isInitializing } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    // Check local storage to see if they've ever completed onboarding
    AsyncStorage.getItem('has_seen_onboarding').then(value => {
      setHasSeenOnboarding(value === 'true');
    });
  }, []);

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('has_seen_onboarding', 'true');
    setHasSeenOnboarding(true);
  };

  // Wait until both Supabase auth AND local storage are loaded
  if (isInitializing || hasSeenOnboarding === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  // Only show onboarding if there's no user AND they haven't seen it yet
  if (!user && !hasSeenOnboarding) {
    return <OnboardingScreen onComplete={completeOnboarding} />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {user ? (
        <Stack.Screen name="MainApp" component={MainTabNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <AppContent />
      </NavigationContainer>
    </AuthProvider>
  );
}