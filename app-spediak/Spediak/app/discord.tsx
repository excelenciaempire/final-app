import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import DiscordScreen from '../src/screens/DiscordScreen';

export default function DiscordRoute() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Spediak - Discord';
    }
  }, []);
  
  return <DiscordScreen />;
}

