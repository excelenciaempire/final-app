import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

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

// Organizations list
export const ORGANIZATIONS = [
  { label: 'None', value: 'None' },
  { label: 'ASHI (American Society of Home Inspectors)', value: 'ASHI' },
  { label: 'InterNACHI (International Association of Certified Home Inspectors)', value: 'InterNACHI' },
  { label: 'NAHI (National Association of Home Inspectors)', value: 'NAHI' },
  { label: 'Other', value: 'Other' },
];

interface GlobalStateContextType {
  selectedState: string | null;
  setSelectedState: (state: string) => void;
  selectedOrganization: string | null;
  setSelectedOrganization: (org: string) => void;
  isContentStale: boolean;
  markContentAsStale: () => void;
  clearStaleFlag: () => void;
}

const GlobalStateContext = createContext<GlobalStateContextType | undefined>(undefined);

const STORAGE_KEY = '@spediak_selected_state';
const ORG_STORAGE_KEY = '@spediak_selected_organization';
const STALE_FLAG_KEY = '@spediak_content_stale';

export const GlobalStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedState, setSelectedStateInternal] = useState<string | null>(null);
  const [selectedOrganization, setSelectedOrganizationInternal] = useState<string | null>(null);
  const [isContentStale, setIsContentStale] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();

  // Fetch user profile from backend to get their configured state/org
  const fetchUserProfile = useCallback(async () => {
    if (!isSignedIn) return;
    
    try {
      const token = await getToken();
      if (!token) return;
      
      const response = await fetch(`${API_URL}/api/user/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.profile) {
          const profileState = data.profile.primary_state;
          const profileOrgs = data.profile.organizations || [];
          const profileOrg = profileOrgs.length > 0 ? profileOrgs[0] : 'None';
          
          // Only set if we don't have a value yet (respect local changes)
          if (!selectedState && profileState) {
            setSelectedStateInternal(profileState);
            // Also persist to storage
            if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
              localStorage.setItem(STORAGE_KEY, profileState);
            } else if (Platform.OS !== 'web') {
              await AsyncStorage.setItem(STORAGE_KEY, profileState);
            }
          }
          
          if (!selectedOrganization && profileOrg) {
            setSelectedOrganizationInternal(profileOrg);
            if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
              localStorage.setItem(ORG_STORAGE_KEY, profileOrg);
            } else if (Platform.OS !== 'web') {
              await AsyncStorage.setItem(ORG_STORAGE_KEY, profileOrg);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user profile for global state:', error);
    } finally {
      setProfileLoaded(true);
    }
  }, [isSignedIn, getToken, selectedState, selectedOrganization]);

  // Load persisted state and organization on mount
  useEffect(() => {
    const loadPersistedState = async () => {
      try {
        let savedState: string | null = null;
        let savedOrg: string | null = null;
        
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
          savedState = localStorage.getItem(STORAGE_KEY);
          savedOrg = localStorage.getItem(ORG_STORAGE_KEY);
        } else if (Platform.OS !== 'web') {
          savedState = await AsyncStorage.getItem(STORAGE_KEY);
          savedOrg = await AsyncStorage.getItem(ORG_STORAGE_KEY);
        }
        
        if (savedState) {
          setSelectedStateInternal(savedState);
        }
        if (savedOrg) {
          setSelectedOrganizationInternal(savedOrg);
        }
        
        // Also try to use Clerk metadata as fallback
        if (!savedState && user?.unsafeMetadata?.inspectionState) {
          const clerkState = user.unsafeMetadata.inspectionState as string;
          setSelectedStateInternal(clerkState);
        }
      } catch (error) {
        console.error('Error loading persisted state:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadPersistedState();
  }, [user]);

  // Fetch profile from backend when signed in (to sync with profile settings)
  useEffect(() => {
    if (isSignedIn && isLoaded && !profileLoaded) {
      fetchUserProfile();
    }
  }, [isSignedIn, isLoaded, profileLoaded, fetchUserProfile]);

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

  const setSelectedOrganization = async (org: string) => {
    // If organization is changing and we have existing content, mark as stale
    if (selectedOrganization && selectedOrganization !== org) {
      markContentAsStale();
    }

    setSelectedOrganizationInternal(org);

    // Persist to storage
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(ORG_STORAGE_KEY, org);
      } else if (Platform.OS !== 'web') {
        await AsyncStorage.setItem(ORG_STORAGE_KEY, org);
      }
    } catch (error) {
      console.error('Error persisting organization:', error);
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
        selectedOrganization,
        setSelectedOrganization,
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
      selectedState: null,
      setSelectedState: () => {},
      selectedOrganization: null,
      setSelectedOrganization: () => {},
      isContentStale: false,
      markContentAsStale: () => {},
      clearStaleFlag: () => {},
    };
  }
  return context;
};

