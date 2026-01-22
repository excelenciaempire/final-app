import React from 'react';
import { ClerkProvider, SignedIn, SignedOut } from "@clerk/clerk-expo";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { StyleSheet, Text, View, Platform, ScrollView } from 'react-native';
import AuthNavigator from "./src/navigation/AuthNavigator";
import RootNavigator from "./src/navigation/RootNavigator";
import { GlobalStateProvider } from "./src/context/GlobalStateContext";
import { SubscriptionProvider } from "./src/context/SubscriptionContext";
import { AdRotationProvider } from "./src/context/AdRotationContext";

// Version: 2.1.0 - Production Ready
// Error #130 resolved: Fixed imports in newInspection.tsx

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <ScrollView contentContainerStyle={errorStyles.content}>
            <Text style={errorStyles.title}>Something went wrong</Text>
            <Text style={errorStyles.message}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </Text>
            <Text style={errorStyles.stack}>
              {this.state.error?.stack}
            </Text>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  content: {
    paddingVertical: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
  stack: {
    fontSize: 12,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});

const clerkPublishableKey = Constants.expoConfig?.extra?.clerkPublishableKey;

if (!clerkPublishableKey) {
  throw new Error("Missing Clerk Publishable Key. Please check your app.config.js and .env file.");
}

const tokenCache = {
  async getToken(key: string) {
    try {
      return SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

export default function App() {
  // Set document title for web
  React.useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Spediak';
    }
  }, []);

  return (
    <ErrorBoundary>
      <View style={styles.appWrapper}>
        <ClerkProvider
          tokenCache={tokenCache}
          publishableKey={clerkPublishableKey}
        >
          <GlobalStateProvider>
            <SubscriptionProvider>
              <AdRotationProvider>
                <SignedIn>
                  <NavigationContainer
                    documentTitle={{
                      enabled: true,
                      formatter: () => 'Spediak',
                    }}
                  >
                    <RootNavigator />
                  </NavigationContainer>
                </SignedIn>
                <SignedOut>
                  <NavigationContainer
                    documentTitle={{
                      enabled: true,
                      formatter: () => 'Spediak',
                    }}
                  >
                    <AuthNavigator />
                  </NavigationContainer>
                </SignedOut>
                <StatusBar style="auto" />
              </AdRotationProvider>
            </SubscriptionProvider>
          </GlobalStateProvider>
        </ClerkProvider>
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  appWrapper: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      display: 'flex',
      justifyContent: 'center',
      minHeight: '100%',
      backgroundColor: '#f8f9fa',
    }),
  },
});

/*
// Original Code Below
import { ClerkProvider, SignedIn, SignedOut } from "@clerk/clerk-expo";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import AuthNavigator from "./src/navigation/AuthNavigator"; // Revert path
import RootNavigator from "./src/navigation/RootNavigator"; // Import RootNavigator

const clerkPublishableKey = Constants.expoConfig?.extra?.clerkPublishableKey;

if (!clerkPublishableKey) {
  throw new Error("Missing Clerk Publishable Key. Please check your app.config.js and .env file.");
}

const tokenCache = {
  async getToken(key: string) {
    try {
      return SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};


export default function App_Original() { // Renamed to avoid conflict
  return (
    <ClerkProvider
      tokenCache={tokenCache}
      publishableKey={clerkPublishableKey}
    >
      <NavigationContainer>
        <SignedIn>
          {/* Restore RootNavigator * /}
          {/* <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
            <Text>Signed In - Debug View</Text>
          </View> * /}
          <RootNavigator />
        </SignedIn>
        <SignedOut>
           <AuthNavigator />
        </SignedOut>
      </NavigationContainer>
      <StatusBar style="auto" />
    </ClerkProvider>
  );
}

const styles_original = StyleSheet.create({
  // container: {
  //   flex: 1,
  //   backgroundColor: '#fff',
  //   alignItems: 'center',
  //   justifyContent: 'center',
  // },
});
*/
