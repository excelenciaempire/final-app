import Constants from 'expo-constants';

// Get the API URL from environment variables via app.config.js extra section
const ENV_API_URL = Constants.expoConfig?.extra?.apiUrl as string | undefined;

// Validate the URL from environment
if (!ENV_API_URL) {
  console.error("API URL not found in environment variables (Constants.expoConfig.extra.apiUrl). Please check app.config.js and .env file.");
  // Optionally throw error or use a default non-functional URL to make errors obvious
  // throw new Error("Missing API_URL configuration");
}

// Use the environment variable URL as the base URL
export const BASE_URL = ENV_API_URL || 'http://error.invalid.url'; // Fallback to clearly invalid URL if missing

console.log("Using API BASE_URL:", BASE_URL); // Log the URL being used

// Remove old Platform.select logic
/*
import { Platform } from 'react-native';
export const BASE_URL_OLD = Platform.select({
  web: 'http://localhost:5000',
  ios: 'http://172.20.5.8:5000',
  android: 'http://172.20.5.8:5000',
});
if (!BASE_URL_OLD) {
    console.error("Unsupported platform detected for API BASE_URL configuration.");
}
*/ 