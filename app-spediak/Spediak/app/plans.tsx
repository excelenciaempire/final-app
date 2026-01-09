import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import PlanSelectionScreen from '../src/screens/PlanSelectionScreen';

export default function PlansRoute() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Spediak - Plans';
    }
  }, []);
  
  return <PlanSelectionScreen />;
}

