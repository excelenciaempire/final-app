import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Linking, Platform } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import axios from 'axios';
import { BASE_URL } from '../config/api';
import { COLORS } from '../styles/colors';
import { CheckCircle, XCircle, LogOut } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const DiscordScreen: React.FC = () => {
  const { getToken } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkConnectionStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = await getToken();
      
      if (!token) {
        setError('Authentication required. Please log in again.');
        setIsLoading(false);
        return;
      }

      const response = await axios.get(`${BASE_URL}/api/discord/status`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000 // 10 second timeout
      });

      setIsConnected(response.data.connected);
      if (response.data.connected && response.data.connection) {
        const username = response.data.connection.discordUsername;
        const discriminator = response.data.connection.discordDiscriminator;
        setDiscordUsername(discriminator !== '0' ? `${username}#${discriminator}` : username);
      }
    } catch (err: any) {
      console.error('Error checking Discord connection:', err);
      if (err.code === 'ECONNABORTED') {
        setError('Request timed out. Please check your connection and try again.');
      } else if (err.response?.status === 401) {
        setError('Authentication expired. Please log out and log in again.');
      } else {
        setError(err.response?.data?.message || 'Failed to check connection status');
      }
      // Set connected to false on error so UI is usable
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    checkConnectionStatus();
  }, [checkConnectionStatus]);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      const token = await getToken();
      
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const response = await axios.get(`${BASE_URL}/api/discord/auth-url`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const authUrl = response.data.authUrl;

      if (Platform.OS === 'web') {
        // For web, open in same window
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.location.href = authUrl;
        } else {
          Linking.openURL(authUrl);
        }
      } else {
        // For mobile, use WebBrowser
        const result = await WebBrowser.openAuthSessionAsync(authUrl, `${BASE_URL}/api/discord/callback`);
        
        if (result.type === 'success') {
          // Re-check connection status after successful auth
          await checkConnectionStatus();
          Alert.alert('Success', 'Discord account connected successfully!');
        } else if (result.type === 'cancel') {
          Alert.alert('Cancelled', 'Discord connection was cancelled');
        }
      }
    } catch (err: any) {
      console.error('Error connecting Discord:', err);
      setError(err.response?.data?.message || err.message);
      Alert.alert('Error', 'Failed to connect Discord account');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect Discord',
      'Are you sure you want to disconnect your Discord account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              
              if (!token) {
                Alert.alert('Error', 'Authentication required');
                return;
              }

              await axios.delete(`${BASE_URL}/api/discord/disconnect`, {
                headers: { Authorization: `Bearer ${token}` }
              });

              setIsConnected(false);
              setDiscordUsername(null);
              Alert.alert('Success', 'Discord account disconnected');
            } catch (err: any) {
              console.error('Error disconnecting Discord:', err);
              Alert.alert('Error', 'Failed to disconnect Discord account');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect Discord</Text>
      <Text style={styles.description}>
        Join the Spediak community on Discord to connect with other home inspectors, share insights, and get support.
      </Text>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <>
          {/* Connection Status */}
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Text style={styles.statusLabel}>Connection Status</Text>
              {isConnected ? (
                <CheckCircle size={24} color="#4CAF50" />
              ) : (
                <XCircle size={24} color="#9E9E9E" />
              )}
            </View>
            <Text style={[styles.statusText, isConnected && styles.statusTextConnected]}>
              {isConnected ? 'Connected' : 'Not connected'}
            </Text>
            {isConnected && discordUsername && (
              <Text style={styles.usernameText}>
                Connected as: {discordUsername}
              </Text>
            )}
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Action Button */}
          {!isConnected ? (
            <TouchableOpacity 
              style={[styles.button, isConnecting && styles.buttonDisabled]}
              onPress={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Authorize with Discord</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.button, styles.disconnectButton]}
              onPress={handleDisconnect}
            >
              <LogOut size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Disconnect</Text>
            </TouchableOpacity>
          )}

          {/* Benefits */}
          <View style={styles.benefitsContainer}>
            <Text style={styles.benefitsTitle}>Why Connect Discord?</Text>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitBullet}>•</Text>
              <Text style={styles.benefitText}>Get real-time support from the community</Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitBullet}>•</Text>
              <Text style={styles.benefitText}>Share inspection tips and best practices</Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitBullet}>•</Text>
              <Text style={styles.benefitText}>Stay updated on new features and updates</Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitBullet}>•</Text>
              <Text style={styles.benefitText}>Network with other home inspectors</Text>
            </View>
          </View>
        </>
      )}
    </View>
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
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  statusTextConnected: {
    color: '#4CAF50',
  },
  usernameText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5865F2', // Discord blue
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  disconnectButton: {
    backgroundColor: '#ED4245', // Discord red
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  benefitsContainer: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  benefitBullet: {
    fontSize: 16,
    color: COLORS.primary,
    marginRight: 8,
    fontWeight: '600',
  },
  benefitText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
});

export default DiscordScreen;

