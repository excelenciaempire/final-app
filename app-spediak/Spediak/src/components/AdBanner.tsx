import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Linking, Platform } from 'react-native';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-expo';
import { BASE_URL } from '../config/api';
import { COLORS } from '../styles/colors';
import { useSubscription } from '../context/SubscriptionContext';
import { Megaphone } from 'lucide-react-native';

interface AdData {
  id: number;
  title: string;
  subtitle?: string;
  destination_url: string;
  image_url?: string;
}

const AdBanner: React.FC = () => {
  const { getToken } = useAuth();
  const { subscription, adminPreviewMode } = useSubscription();
  const [ads, setAds] = useState<AdData[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Show ads for free tier users OR when admin preview mode is enabled
  const isAdmin = subscription?.is_admin;
  const shouldShowAds = (subscription?.plan_type === 'free' && !isAdmin) || adminPreviewMode;

  const fetchAds = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(false);
      const token = await getToken();
      
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await axios.get(`${BASE_URL}/api/ads/active`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000
      });

      if (response.data.ads && response.data.ads.length > 0) {
        setAds(response.data.ads);
      }
    } catch (err: any) {
      console.log('No active ads or error fetching:', err.message);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []); // Remove getToken from deps to prevent infinite loops

  useEffect(() => {
    if (shouldShowAds) {
      fetchAds();
    } else {
      setIsLoading(false);
    }
  }, [shouldShowAds]); // Remove fetchAds from deps

  // Rotate ads every 10 seconds
  useEffect(() => {
    if (ads.length > 1) {
      const interval = setInterval(() => {
        setCurrentAdIndex((prevIndex) => (prevIndex + 1) % ads.length);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [ads.length]);

  const handleAdClick = async (ad: AdData) => {
    try {
      const token = await getToken();
      if (token) {
        axios.post(`${BASE_URL}/api/ads/${ad.id}/click`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {}); // Silent fail for tracking
      }

      if (ad.destination_url) {
        const canOpen = await Linking.canOpenURL(ad.destination_url);
        if (canOpen) {
          await Linking.openURL(ad.destination_url);
        }
      }
    } catch (err) {
      console.error('Error handling ad click:', err);
    }
  };

  // Don't render for non-free users
  if (!shouldShowAds) {
    return null;
  }

  if (isLoading) {
    return (
      <View style={styles.card}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  // Show placeholder if no ads or error
  if (ads.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.placeholderBox}>
          <Megaphone size={24} color="#9CA3AF" style={{ marginBottom: 8 }} />
          <Text style={styles.placeholderText}>Ad space placeholder</Text>
          <Text style={styles.placeholderSubtext}>
            Sponsored content will appear here
          </Text>
        </View>
      </View>
    );
  }

  const currentAd = ads[currentAdIndex];

  return (
    <View style={styles.card}>
      <TouchableOpacity 
        style={styles.adContainer} 
        onPress={() => handleAdClick(currentAd)}
        activeOpacity={0.8}
      >
        {currentAd.image_url ? (
          <Image 
            source={{ uri: currentAd.image_url }} 
            style={styles.adImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.adContent}>
            <Text style={styles.adTitle}>{currentAd.title}</Text>
            {currentAd.subtitle && (
              <Text style={styles.adSubtitle}>{currentAd.subtitle}</Text>
            )}
          </View>
        )}
        <View style={styles.sponsoredRow}>
          <Text style={styles.sponsoredLabel}>Sponsored</Text>
          {adminPreviewMode && (
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>👁 Admin Preview</Text>
            </View>
          )}
          {ads.length > 1 && (
            <View style={styles.dotContainer}>
              {ads.map((_, index) => (
                <View
                  key={index}
                  style={[styles.dot, index === currentAdIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
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
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderBox: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    minHeight: 100,
  },
  placeholderText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  placeholderSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
  },
  adContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  adImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#E0E0E0',
  },
  adContent: {
    padding: 16,
    backgroundColor: '#F0F4F8',
    minHeight: 80,
    justifyContent: 'center',
  },
  adTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  adSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  sponsoredRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FAFAFA',
  },
  sponsoredLabel: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  dotContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D0D0D0',
  },
  dotActive: {
    backgroundColor: COLORS.primary,
  },
  previewBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  previewBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#B45309',
  },
});

export default AdBanner;
