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

  // Only show ads for free tier users
  const shouldShowAds = subscription?.plan_type === 'free';

  const fetchAds = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await axios.get(`${BASE_URL}/api/ads/active`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000
      });

      if (response.data.ads && response.data.ads.length > 0) {
        setAds(response.data.ads);
      }
    } catch (err: any) {
      console.log('No active ads or error fetching:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (shouldShowAds) {
      fetchAds();
    } else {
      setIsLoading(false);
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
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  // Show placeholder if no ads
  if (ads.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ad Banner</Text>
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderText}>
            Ad space placeholder (e.g., 320×100 or 468×60).
          </Text>
          <Text style={styles.placeholderSubtext}>
            This is where ad units will appear in the production app.
          </Text>
        </View>
      </View>
    );
  }

  const currentAd = ads[currentAdIndex];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Ad Banner</Text>
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
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  placeholderBox: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  placeholderText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  placeholderSubtext: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
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
});

export default AdBanner;
