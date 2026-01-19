import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-expo';
import { BASE_URL } from '../config/api';

interface AdData {
  id: number;
  title: string;
  subtitle?: string;
  destination_url: string;
  image_url?: string;
}

interface AdRotationContextType {
  ads: AdData[];
  currentAdIndex: number;
  rotationInterval: number;
  isLoading: boolean;
  error: boolean;
  fetchAds: () => Promise<void>;
}

const AdRotationContext = createContext<AdRotationContextType | undefined>(undefined);

export const AdRotationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { getToken } = useAuth();
  const [ads, setAds] = useState<AdData[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [rotationInterval, setRotationInterval] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  
  // Use ref for interval to persist across renders
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAds = useCallback(async () => {
    // Only fetch once
    if (hasFetched) return;
    
    try {
      setIsLoading(true);
      setError(false);
      const token = await getToken();
      
      if (!token) {
        setIsLoading(false);
        return;
      }

      const [adsResponse, settingsResponse] = await Promise.all([
        axios.get(`${BASE_URL}/api/ads/active`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 8000
        }),
        axios.get(`${BASE_URL}/api/ads/settings`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 8000
        }).catch(() => ({ data: { settings: { rotation_interval: 10 } } }))
      ]);

      if (adsResponse.data.ads && adsResponse.data.ads.length > 0) {
        setAds(adsResponse.data.ads);
      }

      if (settingsResponse.data.settings?.rotation_interval) {
        setRotationInterval(settingsResponse.data.settings.rotation_interval);
      }
      
      setHasFetched(true);
    } catch (err: any) {
      console.log('No active ads or error fetching:', err.message);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [getToken, hasFetched]);

  // Global rotation timer - runs independently of component mounting
  useEffect(() => {
    if (ads.length > 1 && rotationInterval > 0) {
      // Clear existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Start new interval
      intervalRef.current = setInterval(() => {
        setCurrentAdIndex((prevIndex) => (prevIndex + 1) % ads.length);
      }, rotationInterval * 1000);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [ads.length, rotationInterval]);

  return (
    <AdRotationContext.Provider
      value={{
        ads,
        currentAdIndex,
        rotationInterval,
        isLoading,
        error,
        fetchAds,
      }}
    >
      {children}
    </AdRotationContext.Provider>
  );
};

export const useAdRotation = () => {
  const context = useContext(AdRotationContext);
  if (context === undefined) {
    // Return default values if used outside provider
    return {
      ads: [],
      currentAdIndex: 0,
      rotationInterval: 10,
      isLoading: false,
      error: false,
      fetchAds: async () => {},
    };
  }
  return context;
};
