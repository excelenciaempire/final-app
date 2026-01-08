import React, { createContext, useContext, useCallback } from 'react';
import { Platform } from 'react-native';

type ScreenName = 'Home' | 'InspectionHistory' | 'SOP' | 'Discord' | 'ProfileSettings' | 'PlanSelection' | 'AdminDashboard' | 'SopHistory';

interface AppNavigationContextType {
  navigateTo: (screen: ScreenName) => void;
  isWebDesktop: boolean;
}

const AppNavigationContext = createContext<AppNavigationContextType | null>(null);

interface AppNavigationProviderProps {
  children: React.ReactNode;
  setActiveScreen?: (screen: ScreenName) => void;
  isWebDesktop?: boolean;
}

export const AppNavigationProvider: React.FC<AppNavigationProviderProps> = ({
  children,
  setActiveScreen,
  isWebDesktop = false,
}) => {
  const navigateTo = useCallback((screen: ScreenName) => {
    if (isWebDesktop && setActiveScreen) {
      // For web desktop, use state-based navigation
      setActiveScreen(screen);
    } else if (Platform.OS === 'web') {
      // For web mobile/small screens, use URL navigation
      const urlMap: Record<ScreenName, string> = {
        Home: '/home',
        InspectionHistory: '/statement-history',
        SOP: '/sop',
        Discord: '/discord',
        ProfileSettings: '/profile',
        PlanSelection: '/plans',
        AdminDashboard: '/admin',
        SopHistory: '/sop-history',
      };
      window.location.href = urlMap[screen] || '/home';
    }
  }, [isWebDesktop, setActiveScreen]);

  return (
    <AppNavigationContext.Provider value={{ navigateTo, isWebDesktop }}>
      {children}
    </AppNavigationContext.Provider>
  );
};

export const useAppNavigation = () => {
  const context = useContext(AppNavigationContext);

  // URL map for fallback navigation
  const urlMap: Record<ScreenName, string> = {
    Home: '/home',
    InspectionHistory: '/statement-history',
    SOP: '/sop',
    Discord: '/discord',
    ProfileSettings: '/profile',
    PlanSelection: '/plans',
    AdminDashboard: '/admin',
    SopHistory: '/sop-history',
  };

  // Fallback navigation if context is not available
  const navigateTo = useCallback((screen: ScreenName) => {
    if (context) {
      context.navigateTo(screen);
    } else {
      // Fallback to URL-based navigation for web
      if (Platform.OS === 'web') {
        window.location.href = urlMap[screen] || '/home';
      }
      // For native without context, we can't navigate (but this shouldn't happen)
    }
  }, [context]);

  return {
    navigateTo,
    isWebDesktop: context?.isWebDesktop || false,
  };
};

export default AppNavigationContext;
