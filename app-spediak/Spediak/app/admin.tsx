import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import AdminDashboardScreen from '../src/screens/AdminDashboardScreen';

export default function AdminRoute() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Spediak - Admin';
    }
  }, []);
  
  return <AdminDashboardScreen />;
}

