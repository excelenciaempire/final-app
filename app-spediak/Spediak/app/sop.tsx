import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import SopScreen from '../src/screens/SopScreen';

export default function SopRoute() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Spediak - SOP';
    }
  }, []);
  
  return <SopScreen />;
}

