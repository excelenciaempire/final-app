import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { COLORS } from '../styles/colors';
import { CheckCircle, Star, Zap } from 'lucide-react-native';
import { useSubscription } from '../context/SubscriptionContext';

const PlanSelectionScreen: React.FC = () => {
  const { subscription } = useSubscription();
  const currentPlan = subscription?.plan_type || 'free';

  const handleUpgradeToPro = () => {
    Alert.alert(
      "Upgrade to Pro",
      "Pro plan integration with payment gateway will be available soon. Contact support for early access.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Contact Support", onPress: () => Linking.openURL('mailto:support@spediak.com?subject=Pro Plan Inquiry') }
      ]
    );
  };

  const handleContactPlatinum = () => {
    Linking.openURL('mailto:sales@spediak.com?subject=Inquiry about Platinum Plan');
  };

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for getting started',
      features: [
        '5 statements per 30 days',
        'Basic AI-powered analysis',
        'Image upload support',
        'Voice note transcription',
        'Ad-supported',
        'Email support'
      ],
      icon: CheckCircle,
      color: '#9E9E9E',
      action: 'current',
      actionLabel: 'Current Plan'
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$7.99',
      period: 'per month',
      description: 'For professional inspectors',
      features: [
        'Unlimited statements',
        'Advanced AI analysis',
        'No advertisements',
        'Priority processing',
        'SOP compliance checking',
        'Priority email support',
        'Export to multiple formats'
      ],
      icon: Star,
      color: '#FFA500',
      action: 'upgrade',
      actionLabel: 'Start 7-Day Trial',
      popular: true
    },
    {
      id: 'platinum',
      name: 'Platinum',
      price: '$14.99',
      period: 'per month',
      description: 'Maximum power and features',
      features: [
        'Everything in Pro',
        'Advanced AI features',
        'Custom SOP templates',
        'Team collaboration tools',
        'API access',
        'Dedicated account manager',
        'Phone support',
        'Custom integrations'
      ],
      icon: Zap,
      color: '#9C27B0',
      action: 'contact',
      actionLabel: 'Contact Sales'
    }
  ];

  const handlePlanAction = (planId: string, action: string) => {
    if (action === 'current') {
      Alert.alert('Current Plan', 'This is your current plan.');
    } else if (action === 'upgrade') {
      handleUpgradeToPro();
    } else if (action === 'contact') {
      handleContactPlatinum();
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Choose the plan that fits your inspections</Text>
      <Text style={styles.subtitle}>
        Upgrade anytime. Cancel anytime. No hidden fees.
      </Text>

      <View style={styles.plansContainer}>
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isCurrentPlan = currentPlan === plan.id;

          return (
            <View 
              key={plan.id} 
              style={[
                styles.planCard,
                plan.popular && styles.popularCard,
                isCurrentPlan && styles.currentPlanCard
              ]}
            >
              {plan.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                </View>
              )}

              <View style={styles.planHeader}>
                <View style={[styles.iconContainer, { backgroundColor: `${plan.color}20` }]}>
                  <Icon size={24} color={plan.color} />
                </View>
                <Text style={styles.planName}>{plan.name}</Text>
              </View>

              <View style={styles.priceContainer}>
                <Text style={styles.price}>{plan.price}</Text>
                <Text style={styles.period}>{plan.period}</Text>
              </View>

              <Text style={styles.planDescription}>{plan.description}</Text>

              <View style={styles.featuresContainer}>
                {plan.features.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <CheckCircle size={16} color={COLORS.primary} />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  plan.popular && styles.popularActionButton,
                  isCurrentPlan && styles.currentPlanButton
                ]}
                onPress={() => handlePlanAction(plan.id, isCurrentPlan ? 'current' : plan.action)}
                disabled={isCurrentPlan}
              >
                <Text style={[
                  styles.actionButtonText,
                  plan.popular && styles.popularActionButtonText,
                  isCurrentPlan && styles.currentPlanButtonText
                ]}>
                  {isCurrentPlan ? 'Current Plan' : plan.actionLabel}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* FAQ Section */}
      <View style={styles.faqContainer}>
        <Text style={styles.faqTitle}>Frequently Asked Questions</Text>
        
        <View style={styles.faqItem}>
          <Text style={styles.faqQuestion}>Can I change plans later?</Text>
          <Text style={styles.faqAnswer}>
            Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
          </Text>
        </View>

        <View style={styles.faqItem}>
          <Text style={styles.faqQuestion}>What happens when I reach my statement limit?</Text>
          <Text style={styles.faqAnswer}>
            On the Free plan, you'll need to wait for your monthly reset or upgrade to Pro for unlimited statements.
          </Text>
        </View>

        <View style={styles.faqItem}>
          <Text style={styles.faqQuestion}>Is there a free trial?</Text>
          <Text style={styles.faqAnswer}>
            Yes! Pro plan includes a 7-day free trial. No credit card required to start.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  plansContainer: {
    marginBottom: 32,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
  },
  popularCard: {
    borderWidth: 2,
    borderColor: '#FFA500',
  },
  currentPlanCard: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    backgroundColor: '#FFA500',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  price: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginRight: 8,
  },
  period: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  planDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  popularActionButton: {
    backgroundColor: '#FFA500',
  },
  currentPlanButton: {
    backgroundColor: '#E0E0E0',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  popularActionButtonText: {
    color: '#FFFFFF',
  },
  currentPlanButtonText: {
    color: COLORS.textSecondary,
  },
  faqContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  faqTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  faqItem: {
    marginBottom: 16,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  faqAnswer: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});

export default PlanSelectionScreen;

