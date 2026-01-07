import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView, useWindowDimensions } from 'react-native';
import { COLORS } from '../styles/colors';
import { MessageCircle, Users, Lightbulb, Bell, BarChart3, X } from 'lucide-react-native';

// Discord invite link - replace with your actual Discord server invite
const DISCORD_INVITE_URL = 'https://discord.gg/spediak-community';

const DiscordScreen: React.FC = () => {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 600;
  const [showCancel, setShowCancel] = useState(false);

  const handleAuthorize = async () => {
    try {
      const canOpen = await Linking.canOpenURL(DISCORD_INVITE_URL);
      if (canOpen) {
        await Linking.openURL(DISCORD_INVITE_URL);
      }
    } catch (err) {
      console.error('Error opening Discord link:', err);
    }
  };

  const handleCancel = () => {
    // Navigate back or close
    setShowCancel(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={[styles.card, isLargeScreen && styles.cardLarge]}>
        <Text style={styles.title}>Connect Discord</Text>
        <Text style={styles.description}>
          Join the National Inspector Community to collaborate, share findings, and track feature updates.
        </Text>

        {/* Status Box */}
        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>Status: <Text style={styles.statusValue}>Not linked</Text></Text>
          <Text style={styles.statusHint}>
            Connect your Discord to unlock discussion channels, release notes, and AI tips.
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.authorizeButton} onPress={handleAuthorize}>
            <Text style={styles.authorizeButtonText}>Authorize with Discord</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
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
    padding: 20,
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
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  statusBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  statusValue: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statusHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  authorizeButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  authorizeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
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
    width: 32,
    height: 32,
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
