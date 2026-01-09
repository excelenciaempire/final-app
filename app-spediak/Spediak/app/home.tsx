import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import NewInspectionScreen from './(tabs)/newInspection';

export default function HomeRoute() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Spediak';
    }
  }, []);
  
  return <NewInspectionScreen />;
}

