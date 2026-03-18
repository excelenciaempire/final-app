import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { useImpersonation } from '../context/ImpersonationContext';
import { Eye, X } from 'lucide-react-native';

const ImpersonationBanner: React.FC = () => {
  const { isImpersonating, impersonatedUser, endImpersonation } = useImpersonation();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  if (!isImpersonating || !impersonatedUser) {
    return null;
  }

  return (
    <View style={[styles.banner, Platform.OS === 'web' && (isMobile ? (styles.bannerFixedBottom as any) : (styles.bannerFixed as any))]}>
      <View style={styles.iconContainer}>
        <Eye size={isMobile ? 14 : 18} color="#FFFFFF" />
      </View>
      <View style={styles.textContainer}>
        {!isMobile && <Text style={styles.bannerTitle}>READ-ONLY MODE</Text>}
        <Text style={styles.bannerSubtitle} numberOfLines={1} ellipsizeMode="middle">
          {isMobile ? impersonatedUser.email : `Viewing as: ${impersonatedUser.email}`}
        </Text>
      </View>
      <TouchableOpacity style={[styles.exitButton, isMobile && styles.exitButtonMobile]} onPress={endImpersonation}>
        <X size={14} color="#FFFFFF" />
        <Text style={[styles.exitButtonText, isMobile && styles.exitButtonTextMobile]}>Exit</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#7C3AED',
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  bannerFixed: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  bannerFixedBottom: {
    position: 'fixed' as any,
    bottom: 0,
    top: undefined,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  iconContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bannerSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '500',
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 5,
    marginLeft: 8,
    flexShrink: 0,
  },
  exitButtonMobile: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  exitButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  exitButtonTextMobile: {
    fontSize: 12,
  },
});

export default ImpersonationBanner;
