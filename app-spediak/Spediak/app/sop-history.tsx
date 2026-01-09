import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import SopHistoryScreen from '../src/screens/SopHistoryScreen';

export default function SopHistoryRoute() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Spediak - SOP History';
    }
  }, []);
  
  return <SopHistoryScreen />;
}

