import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSubscription } from '../context/SubscriptionContext';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../styles/colors';
import { TrendingUp } from 'lucide-react-native';

const StatementUsageCard: React.FC = () => {
  const { subscription, isLoading } = useSubscription();
  const navigation = useNavigation<any>();

  if (isLoading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  const planType = subscription?.plan_type || 'free';
  const statementsUsed = subscription?.statements_used || 0;
  const statementsLimit = subscription?.statements_limit || 5;
  const isUnlimited = subscription?.is_unlimited || false;
  const statementsRemaining = subscription?.statements_remaining || (statementsLimit - statementsUsed);

  const handleUpgrade = () => {
    navigation.navigate('PlanSelection');
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Statement Usage</Text>
        {planType === 'free' && (
          <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
            <TrendingUp size={16} color={COLORS.white} />
            <Text style={styles.upgradeButtonText}>Upgrade</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        {isUnlimited ? (
          <View style={styles.unlimitedContainer}>
            <Text style={styles.unlimitedText}>Unlimited Statements</Text>
            <Text style={styles.unlimitedSubtext}>Pro Plan Active</Text>
          </View>
        ) : (
          <View style={styles.usageContainer}>
            <View style={styles.usageBar}>
              <View
                style={[
                  styles.usageBarFill,
                  { width: `${(statementsUsed / statementsLimit) * 100}%` },
                ]}
              />
            </View>
            <View style={styles.usageTextContainer}>
              <Text style={styles.usageText}>
                {statementsUsed} / {statementsLimit} used
              </Text>
              <Text style={styles.remainingText}>
                {statementsRemaining} remaining
              </Text>
            </View>
          </View>
        )}
      </View>

      {planType === 'free' && statementsRemaining <= 2 && statementsRemaining > 0 && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>
            ⚠️ Only {statementsRemaining} statement{statementsRemaining !== 1 ? 's' : ''} left this month
          </Text>
        </View>
      )}

      {planType === 'free' && statementsRemaining === 0 && (
        <View style={styles.limitReachedContainer}>
          <Text style={styles.limitReachedText}>
            Monthly limit reached. Upgrade to Pro for unlimited statements.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.darkText,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  upgradeButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    marginTop: 8,
  },
  unlimitedContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  unlimitedText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 4,
  },
  unlimitedSubtext: {
    fontSize: 14,
    color: COLORS.darkText,
    opacity: 0.7,
  },
  usageContainer: {
    gap: 8,
  },
  usageBar: {
    height: 8,
    backgroundColor: COLORS.secondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  usageBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  usageTextContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usageText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.darkText,
  },
  remainingText: {
    fontSize: 14,
    color: COLORS.darkText,
    opacity: 0.7,
  },
  warningContainer: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#FFF3CD',
    borderRadius: 6,
  },
  warningText: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
  },
  limitReachedContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8D7DA',
    borderRadius: 6,
  },
  limitReachedText: {
    fontSize: 14,
    color: '#721C24',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default StatementUsageCard;
