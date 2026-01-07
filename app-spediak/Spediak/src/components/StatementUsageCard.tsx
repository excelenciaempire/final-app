import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { useSubscription } from '../context/SubscriptionContext';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../styles/colors';
import { TrendingUp, AlertCircle, Zap } from 'lucide-react-native';

const StatementUsageCard: React.FC = () => {
  const { subscription, isLoading } = useSubscription();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 600;

  if (isLoading) {
    return (
      <View style={[styles.card, isLargeScreen && styles.cardLarge]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading usage...</Text>
        </View>
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
    <View style={[styles.card, isLargeScreen && styles.cardLarge]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.iconContainer}>
            <TrendingUp size={24} color="#FFFFFF" />
          </View>
          <Text style={[styles.title, isLargeScreen && styles.titleLarge]}>Statement Usage</Text>
        </View>
        {isFreePlan && (
          <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
            <Zap size={16} color="#FFFFFF" />
            <Text style={styles.upgradeButtonText}>Upgrade</Text>
          </TouchableOpacity>
        )}
      </View>

      {isFreePlan ? (
        <>
          {/* Usage Stats */}
          <View style={[styles.statsContainer, isLargeScreen && styles.statsContainerLarge]}>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, isLargeScreen && styles.statNumberLarge]}>
                {statements_used}
              </Text>
              <Text style={styles.statLabel}>Used</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, styles.statNumberRemaining, isLargeScreen && styles.statNumberLarge]}>
                {statements_remaining}
              </Text>
              <Text style={styles.statLabel}>Remaining</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, styles.statNumberTotal, isLargeScreen && styles.statNumberLarge]}>
                {statements_limit}
              </Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressSection}>
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
            <Text style={styles.progressText}>{Math.round(usagePercentage)}% used</Text>
          </View>

          {/* Warnings */}
          {isLowUsage && (
            <View style={styles.warningContainer}>
              <AlertCircle size={18} color="#FFA500" />
              <Text style={styles.warningText}>
                Only {statements_remaining} statement{statements_remaining !== 1 ? 's' : ''} left this period
              </Text>
            </View>
          )}

          {isLimitReached && (
            <View style={styles.limitReachedContainer}>
              <AlertCircle size={18} color={COLORS.error} />
              <View style={styles.limitReachedContent}>
                <Text style={styles.limitReachedText}>Free plan limit reached</Text>
                <TouchableOpacity onPress={handleUpgrade}>
                  <Text style={styles.upgradeLink}>Upgrade to Pro for unlimited →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      ) : (
        <View style={styles.unlimitedContainer}>
          <View style={styles.unlimitedBadge}>
            <Zap size={20} color="#FFFFFF" />
            <Text style={styles.unlimitedBadgeText}>UNLIMITED</Text>
          </View>
          <Text style={[styles.unlimitedText, isLargeScreen && styles.unlimitedTextLarge]}>
            Generate unlimited statements
          </Text>
          <Text style={styles.planBadge}>
            {plan_type === 'pro' ? '⭐ Pro Plan' : '👑 Platinum Plan'} Active
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  cardLarge: {
    padding: 24,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  titleLarge: {
    fontSize: 24,
  },
  upgradeButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statsContainerLarge: {
    padding: 20,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  statNumberLarge: {
    fontSize: 36,
  },
  statNumberRemaining: {
    color: COLORS.primary,
  },
  statNumberTotal: {
    color: COLORS.textSecondary,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: '#E8E8E8',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'right',
    fontWeight: '500',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FFA500',
  },
  warningText: {
    fontSize: 14,
    color: '#E65100',
    fontWeight: '600',
    flex: 1,
  },
  limitReachedContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
  },
  limitReachedContent: {
    flex: 1,
  },
  limitReachedText: {
    fontSize: 14,
    color: COLORS.error,
    fontWeight: '600',
    marginBottom: 4,
  },
  upgradeLink: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
  },
  unlimitedContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  unlimitedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  unlimitedBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  unlimitedText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  unlimitedTextLarge: {
    fontSize: 20,
  },
  planBadge: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});

export default StatementUsageCard;
