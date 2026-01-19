import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Linking, Platform } from 'react-native';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-expo';
import { BASE_URL } from '../config/api';
import { COLORS } from '../styles/colors';
import { useSubscription } from '../context/SubscriptionContext';
import { useAdRotation } from '../context/AdRotationContext';
import { Megaphone, ExternalLink } from 'lucide-react-native';

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
  const { ads, currentAdIndex, isLoading, error, fetchAds } = useAdRotation();

  // Show ads for free tier users OR when admin preview mode is enabled
  const isAdmin = subscription?.is_admin;
  const shouldShowAds = (subscription?.plan_type === 'free' && !isAdmin) || adminPreviewMode;

  // Trigger fetch when component mounts (only fetches once due to context logic)
  useEffect(() => {
    if (shouldShowAds) {
      fetchAds();
    }
  }, [shouldShowAds, fetchAds]);

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
  const hasTextContent = (currentAd.title && currentAd.title !== 'Ad') || currentAd.subtitle;

  return (
    <View style={styles.card}>
      <TouchableOpacity 
        style={styles.adContainer} 
        onPress={() => handleAdClick(currentAd)}
        activeOpacity={0.9}
      >
        {/* Image Section */}
        {currentAd.image_url ? (
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: currentAd.image_url }} 
              style={styles.adImage}
              resizeMode="cover"
            />
            {/* Gradient overlay for better text readability */}
            {hasTextContent && <View style={styles.imageGradient} />}
          </View>
        ) : (
          <View style={styles.noImageContainer}>
            <Megaphone size={32} color="#9CA3AF" />
          </View>
        )}

        {/* Bottom Section - Title, Description & Indicators */}
        <View style={styles.bottomSection}>
          {/* Text Content */}
          {hasTextContent ? (
            <View style={styles.textContent}>
              {currentAd.title && currentAd.title !== 'Ad' && (
                <Text style={styles.adTitle} numberOfLines={1}>{currentAd.title}</Text>
              )}
              {currentAd.subtitle && (
                <Text style={styles.adSubtitle} numberOfLines={1}>{currentAd.subtitle}</Text>
              )}
            </View>
          ) : (
            <View style={styles.textContent}>
              <View style={styles.tapToVisitRow}>
                <ExternalLink size={14} color={COLORS.textSecondary} />
                <Text style={styles.tapToVisitText}>Tap to visit</Text>
              </View>
            </View>
          )}

          {/* Right side: Preview badge & dots */}
          <View style={styles.rightSection}>
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
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
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
    margin: 16,
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
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
  },
  adImage: {
    width: '100%',
    height: 130,
    backgroundColor: '#E5E7EB',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'transparent',
  },
  noImageContainer: {
    height: 100,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  textContent: {
    flex: 1,
    marginRight: 12,
  },
  adTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  adSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  tapToVisitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tapToVisitText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dotContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#D0D0D0',
  },
  dotActive: {
    backgroundColor: COLORS.primary,
  },
  previewBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
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
