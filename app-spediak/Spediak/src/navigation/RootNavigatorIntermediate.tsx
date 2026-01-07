import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { COLORS } from '../styles/colors';
import { useGlobalState } from '../context/GlobalStateContext';
import { useSubscription } from '../context/SubscriptionContext';

/**
 * INTERMEDIATE ROOT NAVIGATOR FOR DEBUGGING
 * Tests contexts but keeps UI simple
 */
const RootNavigatorIntermediate: React.FC = () => {
  const { signOut } = useAuth();
  const { selectedState, setSelectedState } = useGlobalState();
  const { subscription, isLoading } = useSubscription();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>✅ Phase 2: Testing Contexts</Text>
        
        <View style={styles.infoBox}>
          <Text style={styles.sectionTitle}>Global State Context:</Text>
          <Text style={styles.infoText}>Selected State: {selectedState || 'Not set'}</Text>
          <TouchableOpacity 
            style={styles.smallButton}
            onPress={() => setSelectedState('CA')}
          >
            <Text style={styles.smallButtonText}>Test: Set to CA</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.sectionTitle}>Subscription Context:</Text>
          {isLoading ? (
            <Text style={styles.infoText}>Loading...</Text>
          ) : subscription ? (
            <>
              <Text style={styles.infoText}>Plan: {subscription.plan_type}</Text>
              <Text style={styles.infoText}>
                Usage: {subscription.statements_used}/{subscription.statements_limit}
              </Text>
            </>
          ) : (
            <Text style={styles.infoText}>No subscription data</Text>
          )}
        </View>

        <Text style={styles.debug}>
          ℹ️ If you see this without errors, contexts work fine.
        </Text>

        <TouchableOpacity 
          style={styles.button}
          onPress={() => signOut()}
        >
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
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
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.darkText,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  smallButton: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  smallButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  debug: {
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
    alignSelf: 'center',
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RootNavigatorIntermediate;

