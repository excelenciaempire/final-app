import React from 'react';
// import { NavigationContainer } from '@react-navigation/native'; // Remove this import
// import { createStackNavigator } from '@react-navigation/stack'; // Remove this line
import { createNativeStackNavigator } from '@react-navigation/native-stack'; // Keep/Restore this line
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import TermsScreen from '../screens/auth/TermsScreen';
import PrivacyPolicyScreen from '../screens/legal/PrivacyPolicyScreen'; // Import new screen

// Define the stack parameter list
export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined; // Add new route
};

// const Stack = createStackNavigator<AuthStackParamList>(); // Remove this line
const Stack = createNativeStackNavigator<AuthStackParamList>(); // Keep/Restore this line

const AuthNavigator: React.FC = () => {
  return (
    // No NavigationContainer here
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="TermsAndConditions" component={TermsScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} /> {/* Add new screen */}
    </Stack.Navigator>
    // No NavigationContainer here
  );
};

export default AuthNavigator; 