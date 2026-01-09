import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import InspectionHistoryScreen from '../src/screens/InspectionHistoryScreen';

export default function StatementHistoryRoute() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Spediak - Statements';
    }
  }, []);
  
  return <InspectionHistoryScreen />;
}

