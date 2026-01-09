import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import ProfileSettingsScreen from '../src/screens/ProfileSettingsScreen';

export default function ProfileRoute() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Spediak - Profile';
    }
  }, []);
  
  return <ProfileSettingsScreen />;
}

