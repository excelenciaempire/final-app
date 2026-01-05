import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Linking, Platform } from 'react-native';
import { useSubscription } from '../context/SubscriptionContext';
import { useAuth } from '@clerk/clerk-expo';
import axios from 'axios';
import { BASE_URL } from '../config/api';
import { COLORS } from '../styles/colors';

interface Ad {
  id: number;
  title: string;
  subtitle?: string;
  destination_url: string;
  image_url?: string;
}

const AD_ROTATION_INTERVAL = 10000; // 10 seconds

export const AdBanner: React.FC = () => {
  const { subscription } = useSubscription();
  const { getToken } = useAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const planType = subscription?.plan_type || 'free';

  // Only show ads for free users
  if (planType !== 'free') {
    return null;
  }

  const fetchAds = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await axios.get(`${BASE_URL}/api/ads/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        setAds(response.data);
      } else {
        setAds([]);
      }
    } catch (err: any) {
      console.error('Error fetching ads:', err);
      setError('Failed to load ads');
      setAds([]); // Graceful fallback - just don't show ads
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  // Rotate ads every 10 seconds
  useEffect(() => {
    if (ads.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentAdIndex((prevIndex) => (prevIndex + 1) % ads.length);
    }, AD_ROTATION_INTERVAL);

    return () => clearInterval(interval);
  }, [ads.length]);

  const handleAdClick = async (ad: Ad) => {
    try {
      // Open destination URL (click tracking can be added later if needed)
      const canOpen = await Linking.canOpenURL(ad.destination_url);
      if (canOpen) {
        await Linking.openURL(ad.destination_url);
      }
    } catch (err) {
      console.error('Error opening ad URL:', err);
    }
  };

  // Don't render anything if no ads available (graceful fallback)
  if (isLoading) {
    return null; // Silent loading - don't show loading spinner for ads
  }

  if (error || ads.length === 0) {
    return null; // Graceful fallback - just don't render anything
  }

  const currentAd = ads[currentAdIndex];

  if (!currentAd) {
    return null;
  }

  return (
    <View style={styles.container}>
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
          <View style={styles.adTextContainer}>
            <Text style={styles.adTitle}>{currentAd.title}</Text>
            {currentAd.subtitle && (
              <Text style={styles.adSubtitle}>{currentAd.subtitle}</Text>
            )}
          </View>
        )}
        {ads.length > 1 && (
          <View style={styles.adIndicatorContainer}>
            {ads.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.adIndicator,
                  index === currentAdIndex && styles.adIndicatorActive,
                ]}
              />
            ))}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    marginHorizontal: 16,
  },
  adContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 100,
  },
  adImage: {
    width: '100%',
    height: 120,
  },
  adTextContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  adTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.darkText,
    textAlign: 'center',
    marginBottom: 4,
  },
  adSubtitle: {
    fontSize: 14,
    color: COLORS.textSeco,
    textAlign: 'center',
  },
  adIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 6,
    backgroundColor: COLORS.secondary,
  },
  adIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.textMuted,
  },
  adIndicatorActive: {
    backgroundColor: COLORS.primary,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default AdBanner;

