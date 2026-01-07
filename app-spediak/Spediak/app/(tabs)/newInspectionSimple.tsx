import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useGlobalState } from '../../src/context/GlobalStateContext';
import { useSubscription } from '../../src/context/SubscriptionContext';
import { COLORS } from '../../src/styles/colors';
import StatementUsageCard from '../../src/components/StatementUsageCard';
import AdBanner from '../../src/components/AdBanner';

/**
 * SIMPLIFIED NEW INSPECTION SCREEN FOR DEBUGGING
 * This replaces the complex newInspection.tsx to test if the issue is in that screen
 */
const NewInspectionSimple: React.FC = () => {
  const { selectedState } = useGlobalState();
  const { subscription } = useSubscription();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>🏠 Home - Simplified</Text>
        
        <View style={styles.card}>
          <Text style={styles.cardTitle}>✅ Phase 5: Full RootNavigator</Text>
          <Text style={styles.cardText}>
            This is using the REAL RootNavigator with CustomHeaderTitle and CustomDrawerContent,
            but with a simplified Home screen.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 Context Data</Text>
          <Text style={styles.cardText}>State: {selectedState}</Text>
          <Text style={styles.cardText}>Plan: {subscription?.plan_type}</Text>
          <Text style={styles.cardText}>Usage: {subscription?.statements_used}/{subscription?.statements_limit}</Text>
        </View>

        {/* PHASE 6.1: Testing StatementUsageCard */}
        <StatementUsageCard />

        {/* PHASE 6.2: Testing AdBanner */}
        <AdBanner />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔍 Phase 6.2: Testing AdBanner</Text>
          <Text style={styles.cardText}>✓ CustomHeaderTitle with state selector</Text>
          <Text style={styles.cardText}>✓ CustomDrawerContent with user info</Text>
          <Text style={styles.cardText}>✓ Full drawer navigation</Text>
          <Text style={styles.cardText}>✓ StatementUsageCard (PASSED)</Text>
          <Text style={styles.cardText}>🧪 AdBanner (TESTING NOW)</Text>
          <Text style={styles.cardText}>✗ SopAlignmentCard (removed for test)</Text>
          <Text style={styles.cardText}>✗ Complex image upload UI (removed for test)</Text>
        </View>

        <Text style={styles.success}>
          💡 If you see this without Error #130, AdBanner is OK!
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 24,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.darkText,
    marginBottom: 12,
  },
  cardText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
    lineHeight: 20,
  },
  success: {
    fontSize: 16,
    color: COLORS.success,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 16,
    paddingHorizontal: 20,
  },
});

export default NewInspectionSimple;

