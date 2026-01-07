import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/clerk-expo';
import { COLORS } from '../styles/colors';
import { useGlobalState } from '../context/GlobalStateContext';
import { useSubscription } from '../context/SubscriptionContext';

const Stack = createNativeStackNavigator();

/**
 * Simple test screen with contexts
 */
const TestHomeScreen: React.FC = () => {
  const { signOut } = useAuth();
  const { selectedState } = useGlobalState();
  const { subscription } = useSubscription();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>✅ Phase 3: NavigationContainer</Text>
      
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>🗺️ State: {selectedState || 'NC'}</Text>
        <Text style={styles.infoText}>💳 Plan: {subscription?.plan_type || 'loading'}</Text>
      </View>

      <Text style={styles.success}>
        ℹ️ If you see this, NavigationContainer works!
      </Text>

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
 * ROOT NAVIGATOR WITH NAVIGATION CONTAINER TEST
 * Tests if NavigationContainer + Stack Navigator work
 */
const RootNavigatorNavTest: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen 
        name="Home" 
        component={TestHomeScreen}
        options={{ title: 'Spediak - Nav Test' }}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  container: {
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
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
    maxWidth: 400,
  },
  infoText: {
    fontSize: 16,
    color: COLORS.darkText,
    marginBottom: 4,
  },
  success: {
    fontSize: 14,
    color: COLORS.success,
    textAlign: 'center',
    marginVertical: 16,
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RootNavigatorNavTest;

