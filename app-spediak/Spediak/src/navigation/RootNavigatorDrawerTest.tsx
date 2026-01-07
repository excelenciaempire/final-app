import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/colors';
import { useGlobalState } from '../context/GlobalStateContext';
import { useSubscription } from '../context/SubscriptionContext';

const Drawer = createDrawerNavigator();

/**
 * Simple Home Screen for testing
 */
const TestHomeScreen: React.FC = () => {
  const { selectedState } = useGlobalState();
  const { subscription } = useSubscription();

  return (
    <View style={styles.screenContainer}>
      <Text style={styles.title}>🏠 Home Screen</Text>
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>State: {selectedState}</Text>
        <Text style={styles.infoText}>Plan: {subscription?.plan_type}</Text>
        <Text style={styles.infoText}>Usage: {subscription?.statements_used}/{subscription?.statements_limit}</Text>
      </View>
      <Text style={styles.hint}>Open drawer menu (☰) to navigate</Text>
    </View>
  );
};

/**
 * Simple Profile Screen for testing
 */
const TestProfileScreen: React.FC = () => {
  const { signOut } = useAuth();

  return (
    <View style={styles.screenContainer}>
      <Text style={styles.title}>👤 Profile Screen</Text>
      <Text style={styles.infoText}>This is a test profile screen</Text>
      <TouchableOpacity 
        style={styles.button}
        onPress={() => signOut()}
      >
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * ROOT NAVIGATOR WITH DRAWER TEST
 * Tests if Drawer Navigator works with simple screens
 */
const RootNavigatorDrawerTest: React.FC = () => {
  return (
    <Drawer.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        headerTitleAlign: 'center',
        drawerStyle: {
          backgroundColor: COLORS.background,
        },
        drawerActiveTintColor: COLORS.primary,
        drawerInactiveTintColor: COLORS.darkText,
      }}
    >
      <Drawer.Screen 
        name="Home" 
        component={TestHomeScreen}
        options={{
          title: 'Phase 4: Drawer Test',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen 
        name="Profile" 
        component={TestProfileScreen}
        options={{
          title: 'Profile',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 24,
  },
  infoBox: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoText: {
    fontSize: 16,
    color: COLORS.darkText,
    marginBottom: 4,
  },
  hint: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RootNavigatorDrawerTest;

