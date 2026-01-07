import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { COLORS } from '../styles/colors';
import { Book, MessageCircle, ExternalLink } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

const DISCORD_INVITE_URL = 'https://discord.gg/2XEWBe64';

const ToolsAndCommunityCard: React.FC = () => {
  const navigation = useNavigation<any>();

  const handleSopReference = () => {
    navigation.navigate('SOP');
  };

  const handleDiscordCommunity = async () => {
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
    <View style={styles.card}>
      <Text style={styles.title}>Tools & Community</Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.button} onPress={handleSopReference}>
          <Book size={18} color={COLORS.primary} />
          <Text style={styles.buttonText}>SOP & Code Reference</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleDiscordCommunity}>
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

