import { ClerkProvider, SignedIn, SignedOut } from "@clerk/clerk-expo";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { StyleSheet, Text, View, Platform } from 'react-native';
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

export default function App() {
  return (
    <View style={styles.appWrapper}>
      <ClerkProvider
        tokenCache={tokenCache}
        publishableKey={clerkPublishableKey}
      >
        <NavigationContainer>
          <SignedIn>
            {/* Restore RootNavigator */}
            {/* <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
              <Text>Signed In - Debug View</Text>
            </View> */}
            <RootNavigator />
          </SignedIn>
          <SignedOut>
             <AuthNavigator />
          </SignedOut>
        </NavigationContainer>
        <StatusBar style="auto" />
      </ClerkProvider>
    </View>
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
