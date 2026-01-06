import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSubscription } from '../context/SubscriptionContext';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../styles/colors';
import { TrendingUp, AlertCircle } from 'lucide-react-native';

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

  if (!subscription) {
    return null;
  }

  const { plan_type, statements_used, statements_limit, statements_remaining, is_unlimited } = subscription;
  const isFreePlan = plan_type === 'free';
  const usagePercentage = isFreePlan ? (statements_used / statements_limit) * 100 : 0;
  const isLowUsage = isFreePlan && statements_remaining <= 2 && statements_remaining > 0;
  const isLimitReached = isFreePlan && statements_remaining <= 0;

  const handleUpgrade = () => {
    navigation.navigate('PlanSelection');
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <TrendingUp size={20} color={COLORS.primary} />
          <Text style={styles.title}>Statement Usage</Text>
        </View>
        {isFreePlan && (
          <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
            <Text style={styles.upgradeButtonText}>Upgrade</Text>
          </TouchableOpacity>
        )}
      </View>

      {isFreePlan ? (
        <>
          <View style={styles.usageContainer}>
            <Text style={styles.usageText}>
              {statements_used} / {statements_limit} used
            </Text>
            <Text style={styles.remainingText}>
              {statements_remaining} statement{statements_remaining !== 1 ? 's' : ''} remaining
            </Text>
          </View>

          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBarFill, 
                { 
                  width: `${Math.min(usagePercentage, 100)}%`,
                  backgroundColor: isLimitReached ? COLORS.error : isLowUsage ? '#FFA500' : COLORS.primary
                }
              ]} 
            />
          </View>

          {isLowUsage && (
            <View style={styles.warningContainer}>
              <AlertCircle size={16} color="#FFA500" />
              <Text style={styles.warningText}>
                Only {statements_remaining} statement{statements_remaining !== 1 ? 's' : ''} left
              </Text>
            </View>
          )}

          {isLimitReached && (
            <View style={styles.limitReachedContainer}>
              <AlertCircle size={16} color={COLORS.error} />
              <Text style={styles.limitReachedText}>
                Free plan limit reached. Upgrade to Pro for unlimited statements.
              </Text>
            </View>
          )}
        </>
      ) : (
        <View style={styles.unlimitedContainer}>
          <Text style={styles.unlimitedText}>
            ✨ Unlimited Statements
          </Text>
          <Text style={styles.planBadge}>
            {plan_type === 'pro' ? 'Pro Plan' : 'Platinum Plan'} Active
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  upgradeButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  usageContainer: {
    marginBottom: 12,
  },
  usageText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  remainingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FFA500',
  },
  warningText: {
    fontSize: 14,
    color: '#F57C00',
    fontWeight: '500',
    flex: 1,
  },
  limitReachedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.error,
  },
  limitReachedText: {
    fontSize: 14,
    color: COLORS.error,
    fontWeight: '500',
    flex: 1,
  },
  unlimitedContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  unlimitedText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 8,
  },
  planBadge: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});

export default StatementUsageCard;
