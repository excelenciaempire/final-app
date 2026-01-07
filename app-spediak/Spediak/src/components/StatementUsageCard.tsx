import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useSubscription } from '../context/SubscriptionContext';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../styles/colors';
import { FileText } from 'lucide-react-native';

const StatementUsageCard: React.FC = () => {
  const { subscription, isLoading } = useSubscription();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();

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
  const isPro = plan_type === 'pro';
  const isPlatinum = plan_type === 'platinum';

  const handleUpgrade = () => {
    navigation.navigate('PlanSelection');
  };

  const handleViewDetails = () => {
    navigation.navigate('Profile');
  };

  // For paid plans
  if (!isFreePlan) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.iconBox}>
            <FileText size={20} color={COLORS.primary} />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>
              Statements ({isPro ? 'Pro Plan' : 'Platinum Plan'})
            </Text>
            <Text style={styles.subtitle}>Unlimited statements included</Text>
          </View>
          <View style={styles.badgeUnlimited}>
            <Text style={styles.badgeUnlimitedText}>∞ Unlimited</Text>
          </View>
        </View>
      </View>
    );
  }

  // Free plan view
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconBox}>
          <FileText size={20} color={COLORS.primary} />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Statements (Free Plan)</Text>
          <Text style={styles.subtitle}>
            You have {statements_remaining} of {statements_limit} free statements remaining.
          </Text>
        </View>
        <View style={styles.usageBadge}>
          <Text style={styles.usageBadgeText}>{statements_used} / {statements_limit} used</Text>
        </View>
      </View>

      <Text style={styles.infoText}>
        Free plan statements reset every 30 days. Upgrade now to unlock{' '}
        <Text style={styles.boldText}>unlimited statements</Text> and remove ads.
      </Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
          <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.detailsButton} onPress={handleViewDetails}>
          <Text style={styles.detailsButtonText}>View limits & details</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0E6CC',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#E8F4FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  usageBadge: {
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  usageBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  badgeUnlimited: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  badgeUnlimitedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  boldText: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  upgradeButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  detailsButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  detailsButtonText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default StatementUsageCard;
