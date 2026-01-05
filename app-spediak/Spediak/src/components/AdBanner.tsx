import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Linking } from 'react-native';
import { useSubscription } from '../context/SubscriptionContext';
import { useAuth } from '@clerk/clerk-expo';
import axios from 'axios';
import { BASE_URL } from '../config/api';
import { COLORS } from '../styles/colors';

interface AdData {
  id: number;
  title: string;
  subtitle?: string;
  destination_url: string;
  image_url?: string;
}

export const AdBanner: React.FC = () => {
  const { subscription } = useSubscription();
  const { getToken } = useAuth();
  const [currentAd, setCurrentAd] = useState<AdData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ads, setAds] = useState<AdData[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);

  // Only show ads for free tier users
  const planType = subscription?.plan_type || 'free';
  const shouldShowAds = planType === 'free';

  useEffect(() => {
    if (!shouldShowAds) {
      setIsLoading(false);
      return;
    }

    const fetchAds = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const token = await getToken();
        
        if (!token) {
          setIsLoading(false);
          return;
        }

        const response = await axios.get<AdData[]>(`${BASE_URL}/api/ads/active`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const adsData = response.data as AdData[];
        if (adsData && Array.isArray(adsData) && adsData.length > 0) {
          setAds(adsData);
          setCurrentAd(adsData[0]);
          setCurrentAdIndex(0);
        } else {
          setError('No ads available');
        }
      } catch (err: any) {
        console.error('Error fetching ads:', err);
        setError('Failed to load ads');
        // Don't show error to user, just fail silently
      } finally {
        setIsLoading(false);
      }
    };

    fetchAds();
  }, [shouldShowAds, getToken]);

  // Rotate ads every 10 seconds
  useEffect(() => {
    if (!shouldShowAds || ads.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentAdIndex((prevIndex) => {
        const newIndex = (prevIndex + 1) % ads.length;
        setCurrentAd(ads[newIndex]);
        return newIndex;
      });
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [ads, shouldShowAds]);

  const handleAdClick = async () => {
    if (!currentAd) return;

    try {
      const token = await getToken();
      if (token) {
        // Track click (non-blocking)
        axios.post(
          `${BASE_URL}/api/ads/${currentAd.id}/click`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        ).catch(err => console.error('Error tracking click:', err));
      }

      // Open destination URL
      const supported = await Linking.canOpenURL(currentAd.destination_url);
      if (supported) {
        await Linking.openURL(currentAd.destination_url);
      } else {
        console.error('Cannot open URL:', currentAd.destination_url);
      }
    } catch (error) {
      console.error('Error handling ad click:', error);
    }
  };

  // Don't render anything if user is not on free plan
  if (!shouldShowAds) {
    return null;
  }

  // Don't render anything if loading and no ads yet (non-blocking)
  if (isLoading && !currentAd) {
    return null;
  }

  // Don't render anything if error (graceful fallback)
  if (error || !currentAd) {
    return null;
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handleAdClick}
      activeOpacity={0.8}
    >
      <View style={styles.adCard}>
        {currentAd.image_url ? (
          <Image
            source={{ uri: currentAd.image_url }}
            style={styles.adImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.adPlaceholder}>
            <Text style={styles.adPlaceholderText}>Ad</Text>
          </View>
        )}
        <View style={styles.adContent}>
          <Text style={styles.adTitle}>{currentAd.title}</Text>
          {currentAd.subtitle && (
            <Text style={styles.adSubtitle}>{currentAd.subtitle}</Text>
          )}
        </View>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    marginHorizontal: 16,
  },
  adCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 100,
    position: 'relative',
  },
  adImage: {
    width: '100%',
    height: 120,
    backgroundColor: COLORS.secondary,
  },
  adPlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adPlaceholderText: {
    fontSize: 16,
    color: COLORS.darkText,
    opacity: 0.5,
  },
  adContent: {
    padding: 12,
  },
  adTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.darkText,
    marginBottom: 4,
  },
  adSubtitle: {
    fontSize: 14,
    color: COLORS.darkText,
    opacity: 0.7,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AdBanner;

