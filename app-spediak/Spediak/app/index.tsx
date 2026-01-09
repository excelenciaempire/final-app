import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
 
// Redirect to the default tab (e.g., newInspection)
export default function Index() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Spediak';
    }
  }, []);
  
  return <Redirect href="/(tabs)/newInspection" />;
} 