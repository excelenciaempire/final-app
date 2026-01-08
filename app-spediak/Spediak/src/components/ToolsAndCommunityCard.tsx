import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { COLORS } from '../styles/colors';
import { Book, MessageCircle } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppNavigation } from '../context/AppNavigationContext';

const DISCORD_INVITE_URL = 'https://discord.gg/rmEd32mkA5';

const ToolsAndCommunityCard: React.FC = () => {
  const navigation = useNavigation<any>();
  const { navigateTo, isWebDesktop } = useAppNavigation();

  const handleSopReference = () => {
    // For web desktop, use app navigation context
    if (Platform.OS === 'web' && isWebDesktop) {
      navigateTo('SOP');
      return;
    }
    
    // For web mobile, use direct URL navigation
    if (Platform.OS === 'web') {
      window.location.href = '/sop';
      return;
    }
    
    // For native, use React Navigation
    try {
      if (navigation && navigation.navigate) {
        navigation.navigate('SOP');
      }
    } catch (err) {
      console.error('Error navigating to SOP:', err);
    }
  };

  const handleDiscordCommunity = async () => {
    try {
      // Use window.open for web (more reliable)
      if (Platform.OS === 'web') {
        window.open(DISCORD_INVITE_URL, '_blank', 'noopener,noreferrer');
        return;
      }
      
      // For native platforms
      const canOpen = await Linking.canOpenURL(DISCORD_INVITE_URL);
      if (canOpen) {
        await Linking.openURL(DISCORD_INVITE_URL);
      }
    } catch (err) {
      console.error('Error opening Discord link:', err);
      // Fallback
      if (Platform.OS === 'web') {
        window.open(DISCORD_INVITE_URL, '_blank');
      }
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Tools & Community</Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.button, Platform.OS === 'web' && { cursor: 'pointer' } as any]} 
          onPress={handleSopReference}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Book size={18} color={COLORS.primary} />
          <Text style={styles.buttonText}>SOP & Code Reference</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, Platform.OS === 'web' && { cursor: 'pointer' } as any]} 
          onPress={handleDiscordCommunity}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <MessageCircle size={18} color={COLORS.primary} />
          <Text style={styles.buttonText}>Discord Community</Text>
        </TouchableOpacity>
      </View>
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
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F4FF',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
  },
});

export default ToolsAndCommunityCard;

