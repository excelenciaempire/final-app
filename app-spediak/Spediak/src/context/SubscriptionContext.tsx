import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import axios from 'axios';
import { BASE_URL } from '../config/api';

interface SubscriptionData {
  id: number;
  clerk_id: string;
  plan_type: 'free' | 'pro' | 'platinum';
  statements_used: number;
  statements_limit: number;
  statements_remaining: number;
  is_unlimited: boolean;
  can_generate: boolean;
  last_reset_date: string;
  created_at: string;
  updated_at: string;
}

interface SubscriptionContextType {
  subscription: SubscriptionData | null;
  isLoading: boolean;
  error: string | null;
  refreshSubscription: () => Promise<void>;
  canGenerateStatement: boolean;
  incrementUsage: () => Promise<boolean>;
  // Admin preview mode - allows admins to see ads/banners as if they were free users
  adminPreviewMode: boolean;
  setAdminPreviewMode: (enabled: boolean) => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminPreviewMode, setAdminPreviewMode] = useState(false);
  const { getToken, isSignedIn } = useAuth();

  const refreshSubscription = useCallback(async () => {
    if (!isSignedIn) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const token = await getToken();
      
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await axios.get(`${BASE_URL}/api/user/subscription`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSubscription(response.data);
    } catch (err: any) {
      console.error('Error fetching subscription:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch subscription');
    } finally {
      setIsLoading(false);
    }
  }, [getToken, isSignedIn]);

  // Load subscription on mount and when auth changes
  useEffect(() => {
    if (isSignedIn) {
      refreshSubscription();
    } else {
      setIsLoading(false);
    }
  }, [isSignedIn]);

  const incrementUsage = async (): Promise<boolean> => {
    try {
      const token = await getToken();
      
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await axios.post(
        `${BASE_URL}/api/user/subscription/increment`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Refresh subscription data after increment
      await refreshSubscription();

      return true;
    } catch (err: any) {
      console.error('Error incrementing usage:', err);
      
      // Check if limit was reached
      if (err.response?.status === 403) {
        await refreshSubscription(); // Refresh to get updated data
        return false;
      }

      throw err;
    }
  };

  const canGenerateStatement = subscription?.can_generate ?? true; // Default to true if no subscription data yet

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        isLoading,
        error,
        refreshSubscription,
        canGenerateStatement,
        incrementUsage,
        adminPreviewMode,
        setAdminPreviewMode,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    // Return default values instead of throwing
    console.warn('useSubscription called outside of SubscriptionProvider - using defaults');
    return {
      subscription: null,
      isLoading: false,
      error: null,
      refreshSubscription: async () => {},
      canGenerateStatement: true,
      incrementUsage: async () => true,
      adminPreviewMode: false,
      setAdminPreviewMode: () => {},
    };
  }
  return context;
};

