import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-expo';
import { BASE_URL } from '../config/api';
import { COLORS } from '../styles/colors';
import { useSubscription } from '../context/SubscriptionContext';

interface AdData {
  id: number;
  title: string;
  subtitle?: string;
  destination_url: string;
  image_url?: string;
}

const AdBanner: React.FC = () => {
  const { getToken } = useAuth();
  const { subscription } = useSubscription();
  const [ads, setAds] = useState<AdData[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only show ads for free tier users
  const shouldShowAds = subscription?.plan_type === 'free';

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

      if (response.data.ads && response.data.ads.length > 0) {
        setAds(response.data.ads);
      }
    } catch (err: any) {
      console.error('Error fetching ads:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (shouldShowAds) {
      fetchAds();
    }
  }, [shouldShowAds, fetchAds]);

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
      // Track click
      const token = await getToken();
      if (token) {
        await axios.post(`${BASE_URL}/api/ads/${ad.id}/click`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      // Open destination URL
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

  // Don't render if loading failed or no ads
  if (error || ads.length === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  const currentAd = ads[currentAdIndex];

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => handleAdClick(currentAd)}
      activeOpacity={0.8}
    >
      {currentAd.image_url && (
        <Image 
          source={{ uri: currentAd.image_url }} 
          style={styles.adImage}
          resizeMode="cover"
        />
      )}
      <View style={styles.adContent}>
        <Text style={styles.adTitle}>{currentAd.title}</Text>
        {currentAd.subtitle && (
          <Text style={styles.adSubtitle}>{currentAd.subtitle}</Text>
        )}
        <View style={styles.adIndicator}>
          <Text style={styles.adLabel}>Sponsored</Text>
          {ads.length > 1 && (
            <View style={styles.dotContainer}>
              {ads.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index === currentAdIndex && styles.dotActive
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  adImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#F5F5F5',
  },
  adContent: {
    padding: 16,
  },
  adTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  adSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  adIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  adLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
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
});

export default AdBanner;
