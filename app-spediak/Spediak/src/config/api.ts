import Constants from 'expo-constants';
import axios from 'axios';
import { Alert, Platform } from 'react-native';

// Get the API URL from environment variables via app.config.js extra section
const ENV_API_URL = Constants.expoConfig?.extra?.apiUrl as string | undefined;

// Validate the URL from environment
if (!ENV_API_URL) {
  console.error("API URL not found in environment variables (Constants.expoConfig.extra.apiUrl). Please check app.config.js and .env file.");
}

// Use the environment variable URL as the base URL
export const BASE_URL = ENV_API_URL || 'http://error.invalid.url'; // Fallback to clearly invalid URL if missing

console.log("Using API BASE_URL:", BASE_URL); // Log the URL being used

// Create a centralized axios instance with interceptors
export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// Flag to prevent multiple alerts
let suspendedAlertShown = false;

// Add response interceptor to handle ACCOUNT_SUSPENDED globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Check for suspended account error
    if (error.response?.status === 403 && error.response?.data?.code === 'ACCOUNT_SUSPENDED') {
      if (!suspendedAlertShown) {
        suspendedAlertShown = true;
        const message = 'Your account has been suspended. Please contact support at support@spediak.com for assistance.';
        
        if (Platform.OS === 'web') {
          alert(message);
        } else {
          Alert.alert('Account Suspended', message);
        }
        
        // Reset flag after 5 seconds to allow showing again if user tries another action
        setTimeout(() => {
          suspendedAlertShown = false;
        }, 5000);
      }
    }
    
    return Promise.reject(error);
  }
);

// Export a function to check if account is suspended from error
export const isAccountSuspendedError = (error: any): boolean => {
  return error?.response?.status === 403 && error?.response?.data?.code === 'ACCOUNT_SUSPENDED';
}; 