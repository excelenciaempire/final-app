import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import axios from 'axios';
import { BASE_URL } from '../../config/api';
import { COLORS } from '../../styles/colors';
import { Plus, Trash2, ExternalLink, Image as ImageIcon } from 'lucide-react-native';

interface Ad {
  id: number;
  title: string;
  subtitle?: string;
  destination_url: string;
  image_url?: string;
  is_active: boolean;
  created_at: string;
}

const AdManagerTab: React.FC = () => {
  const { getToken } = useAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // New ad form
  const [newAd, setNewAd] = useState({
    title: '',
    subtitle: '',
    destinationUrl: '',
    imageUrl: ''
  });

  const fetchAds = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/api/admin/ads`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAds(response.data.ads || []);
    } catch (error: any) {
      console.error('Error fetching ads:', error);
      Alert.alert('Error', 'Failed to load ads');
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  const handleCreateAd = async () => {
    if (!newAd.title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }
    if (!newAd.destinationUrl.trim()) {
      Alert.alert('Error', 'Destination URL is required');
      return;
    }

    try {
      setIsSaving(true);
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/ads`, {
        title: newAd.title,
        subtitle: newAd.subtitle,
        destination_url: newAd.destinationUrl,
        image_url: newAd.imageUrl
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', 'Ad created successfully');
      setNewAd({ title: '', subtitle: '', destinationUrl: '', imageUrl: '' });
      fetchAds();
    } catch (error: any) {
      console.error('Error creating ad:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to create ad');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAd = async (adId: number) => {
    Alert.alert(
      'Delete Ad',
      'Are you sure you want to delete this ad?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              if (!token) return;

              await axios.delete(`${BASE_URL}/api/admin/ads/${adId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });

              Alert.alert('Success', 'Ad deleted successfully');
              fetchAds();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete ad');
            }
          }
        }
      ]
    );
  };

  const handleClearAllAds = async () => {
    Alert.alert(
      'Clear All Ads',
      'Are you sure you want to deactivate all ads?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              if (!token) return;

              // Delete all ads
              for (const ad of ads) {
                await axios.delete(`${BASE_URL}/api/admin/ads/${ad.id}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
              }

              Alert.alert('Success', 'All ads cleared');
              fetchAds();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to clear ads');
            }
          }
        }
      ]
    );
  };

  const createTestAd = async () => {
    try {
      setIsSaving(true);
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/ads`, {
        title: 'Upgrade to Pro Today!',
        subtitle: 'Get unlimited statements and remove all ads',
        destination_url: 'https://spediak.com/upgrade',
        image_url: ''
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', 'Test ad created');
      fetchAds();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to create test ad');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading ads...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Create New Ad */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create New Ad</Text>
        <Text style={styles.cardDescription}>
          Create ads to display to free-plan users. Ads help promote upgrades or affiliate products.
        </Text>

        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Upgrade to Pro!"
          value={newAd.title}
          onChangeText={(text) => setNewAd({ ...newAd, title: text })}
        />

        <Text style={styles.label}>Subtitle</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Get unlimited statements"
          value={newAd.subtitle}
          onChangeText={(text) => setNewAd({ ...newAd, subtitle: text })}
        />

        <Text style={styles.label}>Destination URL *</Text>
        <TextInput
          style={styles.input}
          placeholder="https://example.com"
          value={newAd.destinationUrl}
          onChangeText={(text) => setNewAd({ ...newAd, destinationUrl: text })}
          autoCapitalize="none"
          keyboardType="url"
        />

        <Text style={styles.label}>Image URL (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="https://example.com/image.jpg"
          value={newAd.imageUrl}
          onChangeText={(text) => setNewAd({ ...newAd, imageUrl: text })}
          autoCapitalize="none"
          keyboardType="url"
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.createButton, isSaving && styles.buttonDisabled]} 
            onPress={handleCreateAd}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Plus size={18} color="#fff" />
                <Text style={styles.createButtonText}>Create Ad</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.testButton} 
            onPress={createTestAd}
            disabled={isSaving}
          >
            <Text style={styles.testButtonText}>Create Test Ad</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Current Ads */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Current Ads ({ads.length})</Text>
          {ads.length > 0 && (
            <TouchableOpacity style={styles.clearAllButton} onPress={handleClearAllAds}>
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {ads.length === 0 ? (
          <View style={styles.emptyState}>
            <ImageIcon size={48} color="#ccc" />
            <Text style={styles.emptyText}>No ads configured</Text>
            <Text style={styles.emptySubtext}>Create an ad above to display to free users</Text>
          </View>
        ) : (
          ads.map((ad) => (
            <View key={ad.id} style={styles.adItem}>
              {ad.image_url ? (
                <Image source={{ uri: ad.image_url }} style={styles.adThumbnail} />
              ) : (
                <View style={styles.adThumbnailPlaceholder}>
                  <ImageIcon size={24} color="#999" />
                </View>
              )}
              <View style={styles.adInfo}>
                <Text style={styles.adTitle}>{ad.title}</Text>
                {ad.subtitle && <Text style={styles.adSubtitle}>{ad.subtitle}</Text>}
                <View style={styles.adUrlRow}>
                  <ExternalLink size={12} color={COLORS.primary} />
                  <Text style={styles.adUrl} numberOfLines={1}>{ad.destination_url}</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.deleteAdButton}
                onPress={() => handleDeleteAd(ad.id)}
              >
                <Trash2 size={18} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ))
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
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
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  createButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  testButton: {
    flex: 1,
    backgroundColor: '#F0F4F8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  testButtonText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  clearAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  clearAllText: {
    fontSize: 13,
    color: COLORS.error,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  adItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  adThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    marginRight: 12,
  },
  adThumbnailPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adInfo: {
    flex: 1,
  },
  adTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  adSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  adUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  adUrl: {
    fontSize: 12,
    color: COLORS.primary,
    flex: 1,
  },
  deleteAdButton: {
    padding: 10,
  },
});

export default AdManagerTab;

