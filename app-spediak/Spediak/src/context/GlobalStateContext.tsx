import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// US States list
export const US_STATES = [
  { label: 'Alabama', value: 'AL' },
  { label: 'Alaska', value: 'AK' },
  { label: 'Arizona', value: 'AZ' },
  { label: 'Arkansas', value: 'AR' },
  { label: 'California', value: 'CA' },
  { label: 'Colorado', value: 'CO' },
  { label: 'Connecticut', value: 'CT' },
  { label: 'Delaware', value: 'DE' },
  { label: 'Florida', value: 'FL' },
  { label: 'Georgia', value: 'GA' },
  { label: 'Hawaii', value: 'HI' },
  { label: 'Idaho', value: 'ID' },
  { label: 'Illinois', value: 'IL' },
  { label: 'Indiana', value: 'IN' },
  { label: 'Iowa', value: 'IA' },
  { label: 'Kansas', value: 'KS' },
  { label: 'Kentucky', value: 'KY' },
  { label: 'Louisiana', value: 'LA' },
  { label: 'Maine', value: 'ME' },
  { label: 'Maryland', value: 'MD' },
  { label: 'Massachusetts', value: 'MA' },
  { label: 'Michigan', value: 'MI' },
  { label: 'Minnesota', value: 'MN' },
  { label: 'Mississippi', value: 'MS' },
  { label: 'Missouri', value: 'MO' },
  { label: 'Montana', value: 'MT' },
  { label: 'Nebraska', value: 'NE' },
  { label: 'Nevada', value: 'NV' },
  { label: 'New Hampshire', value: 'NH' },
  { label: 'New Jersey', value: 'NJ' },
  { label: 'New Mexico', value: 'NM' },
  { label: 'New York', value: 'NY' },
  { label: 'North Carolina', value: 'NC' },
  { label: 'North Dakota', value: 'ND' },
  { label: 'Ohio', value: 'OH' },
  { label: 'Oklahoma', value: 'OK' },
  { label: 'Oregon', value: 'OR' },
  { label: 'Pennsylvania', value: 'PA' },
  { label: 'Rhode Island', value: 'RI' },
  { label: 'South Carolina', value: 'SC' },
  { label: 'South Dakota', value: 'SD' },
  { label: 'Tennessee', value: 'TN' },
  { label: 'Texas', value: 'TX' },
  { label: 'Utah', value: 'UT' },
  { label: 'Vermont', value: 'VT' },
  { label: 'Virginia', value: 'VA' },
  { label: 'Washington', value: 'WA' },
  { label: 'West Virginia', value: 'WV' },
  { label: 'Wisconsin', value: 'WI' },
  { label: 'Wyoming', value: 'WY' },
];

interface GlobalStateContextType {
  selectedState: string | null;
  setSelectedState: (state: string) => void;
  isContentStale: boolean;
  markContentAsStale: () => void;
  clearStaleFlag: () => void;
}

const GlobalStateContext = createContext<GlobalStateContextType | undefined>(undefined);

const STORAGE_KEY = '@spediak_selected_state';
const STALE_FLAG_KEY = '@spediak_content_stale';

export const GlobalStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedState, setSelectedStateInternal] = useState<string | null>('NC');
  const [isContentStale, setIsContentStale] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    const loadPersistedState = async () => {
      try {
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            setSelectedStateInternal(saved);
          }
        } else if (Platform.OS !== 'web') {
          const saved = await AsyncStorage.getItem(STORAGE_KEY);
          if (saved) {
            setSelectedStateInternal(saved);
          }
        }
      } catch (error) {
        console.error('Error loading persisted state:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadPersistedState();
  }, []);

  const setSelectedState = async (state: string) => {
    // If state is changing and we have existing content, mark as stale
    if (selectedState && selectedState !== state) {
      markContentAsStale();
    }

    setSelectedStateInternal(state);

    // Persist to storage
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, state);
      } else if (Platform.OS !== 'web') {
        await AsyncStorage.setItem(STORAGE_KEY, state);
      }
    } catch (error) {
      console.error('Error persisting state:', error);
    }
  };

  const markContentAsStale = () => {
    setIsContentStale(true);
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(STALE_FLAG_KEY, 'true');
      } else if (Platform.OS !== 'web') {
        AsyncStorage.setItem(STALE_FLAG_KEY, 'true');
      }
    } catch (error) {
      console.error('Error setting stale flag:', error);
    }
  };

  const clearStaleFlag = () => {
    setIsContentStale(false);
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(STALE_FLAG_KEY);
      } else if (Platform.OS !== 'web') {
        AsyncStorage.removeItem(STALE_FLAG_KEY);
      }
    } catch (error) {
      console.error('Error clearing stale flag:', error);
    }
  };

  // Render immediately with default state (don't wait for load)
  return (
    <GlobalStateContext.Provider
      value={{
        selectedState,
        setSelectedState,
        isContentStale,
        markContentAsStale,
        clearStaleFlag,
      }}
    >
      {children}
    </GlobalStateContext.Provider>
  );
};

export const useGlobalState = () => {
  const context = useContext(GlobalStateContext);
  if (context === undefined) {
    // Return default values instead of throwing to prevent crashes during initialization
    console.warn('useGlobalState called outside of GlobalStateProvider - using defaults');
    return {
      selectedState: 'NC',
      setSelectedState: () => {},
      isContentStale: false,
      markContentAsStale: () => {},
      clearStaleFlag: () => {},
    };
  }
  return context;
};

