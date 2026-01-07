import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView, useWindowDimensions, Image } from 'react-native';
import { COLORS } from '../styles/colors';
import { MessageCircle, Users, Lightbulb, Bell, BarChart3, ExternalLink } from 'lucide-react-native';
import StatementUsageCard from '../components/StatementUsageCard';
import AdBanner from '../components/AdBanner';

// Discord invite link
const DISCORD_INVITE_URL = 'https://discord.gg/2XEWBe64';

const DiscordScreen: React.FC = () => {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 600;

  const handleJoinDiscord = async () => {
    try {
      const canOpen = await Linking.canOpenURL(DISCORD_INVITE_URL);
      if (canOpen) {
        await Linking.openURL(DISCORD_INVITE_URL);
      }
    } catch (err) {
      console.error('Error opening Discord link:', err);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Usage & Ad Banner for free users */}
      <StatementUsageCard />
      <AdBanner />
      
      {/* Main Card */}
      <View style={[styles.card, isLargeScreen && styles.cardLarge]}>
        {/* Discord Logo/Icon */}
        <View style={styles.discordIconContainer}>
          <View style={styles.discordIcon}>
            <MessageCircle size={32} color="#5865F2" />
          </View>
        </View>

        <Text style={styles.title}>Join Our Discord Community</Text>
        <Text style={styles.description}>
          Connect with the National Inspector Community to collaborate, share findings, and stay updated on Spediak features.
        </Text>

        {/* Join Button */}
        <TouchableOpacity style={styles.joinButton} onPress={handleJoinDiscord}>
          <MessageCircle size={20} color="#FFFFFF" />
          <Text style={styles.joinButtonText}>Join Discord Community</Text>
          <ExternalLink size={16} color="#FFFFFF" style={styles.externalIcon} />
        </TouchableOpacity>
      </View>

      {/* Benefits Card */}
      <View style={[styles.card, isLargeScreen && styles.cardLarge]}>
        <Text style={styles.benefitsTitle}>What you'll get</Text>
        
        <View style={styles.benefitItem}>
          <View style={styles.benefitIcon}>
            <MessageCircle size={18} color={COLORS.primary} />
          </View>
          <Text style={styles.benefitText}>Inspector-only Q&A and discussion channels</Text>
        </View>

        <View style={styles.benefitItem}>
          <View style={styles.benefitIcon}>
            <Lightbulb size={18} color="#F59E0B" />
          </View>
          <Text style={styles.benefitText}>AI usage tips and best practices</Text>
        </View>

        <View style={styles.benefitItem}>
          <View style={styles.benefitIcon}>
            <Bell size={18} color="#10B981" />
          </View>
          <Text style={styles.benefitText}>Release notes, bug reports, and early betas</Text>
        </View>

        <View style={styles.benefitItem}>
          <View style={styles.benefitIcon}>
            <BarChart3 size={18} color="#8B5CF6" />
          </View>
          <Text style={styles.benefitText}>Polls to help shape future Spediak features</Text>
        </View>

        <View style={styles.benefitItem}>
          <View style={styles.benefitIcon}>
            <Users size={18} color="#EC4899" />
          </View>
          <Text style={styles.benefitText}>Network with home inspectors nationwide</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  cardLarge: {
    padding: 28,
  },
  discordIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  discordIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  joinButton: {
    backgroundColor: '#5865F2', // Discord brand color
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  externalIcon: {
    marginLeft: 4,
    opacity: 0.8,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F0F4F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  benefitText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
});

export default DiscordScreen;
