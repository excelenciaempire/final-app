import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function RootLayout() {
  // Set document title for web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Spediak';
    }
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        title: 'Spediak',
        // Prevent the default header from showing "undefined"
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Spediak' }} />
      <Stack.Screen name="(tabs)" options={{ title: 'Spediak', headerShown: false }} />
      <Stack.Screen name="home" options={{ title: 'Spediak' }} />
      <Stack.Screen name="sop" options={{ title: 'Spediak - SOP' }} />
      <Stack.Screen name="sop-history" options={{ title: 'Spediak - SOP History' }} />
      <Stack.Screen name="statement-history" options={{ title: 'Spediak - Statements' }} />
      <Stack.Screen name="discord" options={{ title: 'Spediak - Discord' }} />
      <Stack.Screen name="profile" options={{ title: 'Spediak - Profile' }} />
      <Stack.Screen name="admin" options={{ title: 'Spediak - Admin' }} />
      <Stack.Screen name="plans" options={{ title: 'Spediak - Plans' }} />
    </Stack>
  );
}
