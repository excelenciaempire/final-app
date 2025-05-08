import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useSignUp } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../styles/colors';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useNavigation } from '@react-navigation/native';

type SignUpScreenProps = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

const SignUpScreen: React.FC<SignUpScreenProps> = ({ navigation }) => {
  const { isLoaded, signUp, setActive } = useSignUp();
  const navigationNative = useNavigation();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState(''); // Assuming full name is first + last
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [username, setUsername] = useState('');

  // Start the sign up process.
  const onSignUpPress = async () => {
    console.log("[SignUpScreen] onSignUpPress called");
    if (!isLoaded || loading) {
      console.log("[SignUpScreen] EXITING: SignUp not loaded or already loading.");
      return;
    }

    // --- Password Validation --- 
    if (password.length < 8) {
        console.log("[SignUpScreen] EXITING: Password too short."); 
        Alert.alert('Password Too Short', 'Password must be at least 8 characters long.');
        return;
    }
    
    // Check for uppercase
    const hasUppercase = /[A-Z]/.test(password);
    console.log(`[SignUpScreen] Password Uppercase Test Result: ${hasUppercase}`); // Log test result
    if (!hasUppercase) {
         console.log("[SignUpScreen] EXITING: Password missing uppercase."); 
         Alert.alert('Password Weak', 'Password must contain at least one uppercase letter.');
         return;
    }

    // Check for symbol (using a common set)
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password); // Use slightly modified regex just in case
    console.log(`[SignUpScreen] Password Symbol Test Result: ${hasSymbol}`); // Log test result
    if (!hasSymbol) {
         console.log("[SignUpScreen] EXITING: Password missing symbol."); 
         Alert.alert('Password Weak', 'Password must contain at least one symbol (e.g., !@#$%^&*).');
         return;
    }
    // --- End Password Validation ---

    // Check for matching passwords
    if (password !== confirmPassword) {
        console.log("[SignUpScreen] EXITING: Passwords do not match."); 
        Alert.alert('Error', 'Passwords do not match.');
        return;
    }

    // Check for other missing fields
    if (!firstName || !lastName || !emailAddress || !password || !username || !confirmPassword) { 
        console.log("[SignUpScreen] EXITING: Missing required fields."); 
        Alert.alert("Missing Information", "Please fill in all fields.");
        return;
    }

    // --- Proceed to Clerk --- 
    console.log("[SignUpScreen] Validation passed. Setting loading to true..."); 
    setLoading(true);
    try {
      console.log("[SignUpScreen] Attempting signUp.create...");
      await signUp.create({
        firstName,
        lastName,
        emailAddress,
        password,
        username: username.trim(), 
        unsafeMetadata: { username: username.trim() },
      });
      console.log("[SignUpScreen] signUp.create SUCCEEDED.");

      console.log("[SignUpScreen] Attempting prepareEmailAddressVerification...");
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      console.log("[SignUpScreen] prepareEmailAddressVerification SUCCEEDED.");

      setPendingVerification(true);
      console.log("[SignUpScreen] Set pendingVerification to true.");

    } catch (err: any) {
      console.error("[SignUpScreen] ERROR in try block:", JSON.stringify(err, null, 2));
      
      let userMessage = "An unexpected error occurred during sign up.";
      // DEFENSIVE CHECK: Only proceed if err.errors exists and has content
      if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
          const firstError = err.errors[0];
          console.error("Clerk SignUp Error Code:", firstError.code);
          console.error("Clerk SignUp Error Message:", firstError.message);
          console.error("Clerk SignUp Error Meta:", firstError.meta);

          switch (firstError.code) {
              case 'form_identifier_exists':
                  if (firstError.meta?.paramName === 'email_address') {
                      userMessage = "This email address is already taken. Please use a different email or log in.";
                  } else if (firstError.meta?.paramName === 'username') {
                      userMessage = "This username is already taken. Please choose another one.";
                  } else {
                      userMessage = "This email or username is already taken.";
                  }
                  break;
              case 'form_password_pwned':
                  userMessage = "This password has been exposed in data breaches. Please choose a stronger, unique password.";
                  break;
              case 'form_password_length_too_short':
                  userMessage = `Password is too short. Minimum length is ${firstError.meta?.minimumLength || 8} characters.`;
                  break;
              case 'form_password_complexity':
                   userMessage = "Password does not meet complexity requirements (e.g., uppercase, symbol)." ;
                   break;
              default:
                  // Use Clerk's message if available, otherwise keep the generic one
                  userMessage = firstError.longMessage || firstError.message || userMessage;
                  break;
          }
      } else if (err.message) {
           // If no .errors array, maybe it's a network error or different structure
           userMessage = err.message; // Use the top-level error message if possible
      }
      // Always show an alert
      Alert.alert('Sign Up Error', userMessage);
    } finally {
      console.log("[SignUpScreen] Setting loading to false in finally block.");
      setLoading(false);
    }
  };

  // Verify the email code
  const onPressVerify = async () => {
    if (!isLoaded || loading) {
      return;
    }
    setLoading(true);
    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      // If verification is successful, set the session active
      if (completeSignUp.status === 'complete') {
        await setActive({ session: completeSignUp.createdSessionId });
         // Navigation to the main app will happen automatically
      } else {
        // Handle other statuses like 'missing_requirements' if necessary
        console.error(JSON.stringify(completeSignUp, null, 2));
         Alert.alert('Verification Error', 'Could not complete sign up.');
      }
    } catch (err: any) {
        // Check for specific incorrect code error
        let errorMessage = 'Verification failed';
        if (err.errors && err.errors[0]) {
            if (err.errors[0].code === 'form_code_incorrect') {
                errorMessage = 'Incorrect verification code. Please try again.';
            } else {
                errorMessage = err.errors[0].message; // Use Clerk's message for other errors
            }
        }
        console.error(JSON.stringify(err, null, 2)); // Log the full error
        Alert.alert('Verification Error', errorMessage);
    } finally {
        setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.spediakTitle}>Spediak</Text>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.description}>
            Fill in the details below to create your account.
          </Text>

          {!pendingVerification && (
            <>
               {/* Input fields for Sign Up */}
               <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                  <TextInput
                      style={styles.input}
                      placeholder="First Name"
                      placeholderTextColor={COLORS.darkText}
                      value={firstName}
                      onChangeText={setFirstName}
                  />
              </View>
               <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                  <TextInput
                      style={styles.input}
                      placeholder="Last Name"
                      placeholderTextColor={COLORS.darkText}
                      value={lastName}
                      onChangeText={setLastName}
                  />
              </View>
               <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                  <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor={COLORS.darkText}
                  value={emailAddress}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onChangeText={setEmailAddress}
                  />
              </View>
               <View style={styles.inputContainer}>
                   <Ionicons name="lock-closed-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                  <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={COLORS.darkText}
                  value={password}
                  secureTextEntry={!passwordVisible}
                  onChangeText={setPassword}
                  />
                   <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)} style={styles.eyeIconContainer}>
                      <Ionicons name={passwordVisible ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.darkText} />
                  </TouchableOpacity>
              </View>
               <View style={styles.inputContainer}>
                   <Ionicons name="lock-closed-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                  <TextInput
                      style={styles.input}
                      placeholder="Confirm Password"
                      placeholderTextColor={COLORS.darkText}
                      value={confirmPassword}
                      secureTextEntry={!confirmPasswordVisible}
                      onChangeText={setConfirmPassword}
                  />
                   <TouchableOpacity onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)} style={styles.eyeIconContainer}>
                      <Ionicons name={confirmPasswordVisible ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.darkText} />
                  </TouchableOpacity>
              </View>
               <View style={styles.inputContainer}>
                   <Ionicons name="person-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                  <TextInput
                      style={styles.input}
                      placeholder="Username"
                      placeholderTextColor={COLORS.darkText}
                      value={username}
                      onChangeText={setUsername}
                  />
              </View>

              <TouchableOpacity 
                  style={[styles.button, (!isLoaded || loading) && styles.buttonDisabled]}
                  onPress={onSignUpPress} 
                  disabled={!isLoaded || loading}
              >
                  {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>Create Account</Text>}
              </TouchableOpacity>
            </>
          )}

          {pendingVerification && (
            <>
              <Text style={styles.description}>Check your email for a verification code.</Text>
               <View style={styles.inputContainer}>
                   <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                  <TextInput
                      style={styles.input}
                      value={code}
                      placeholder="Verification Code"
                      placeholderTextColor={COLORS.darkText}
                      keyboardType="numeric"
                      onChangeText={setCode}
                  />
              </View>
              <TouchableOpacity 
                  style={[styles.button, (!isLoaded || loading) && styles.buttonDisabled]}
                  onPress={onPressVerify} 
                  disabled={!isLoaded || loading}
              >
                   {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>Verify Email</Text>}
              </TouchableOpacity>
            </>
          )}

          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.signInLink}>Log In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Reuse or adapt styles from LoginScreen, making necessary adjustments
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  keyboardAvoidingContainer: {
      flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 30, // Add padding for scroll view
  },
  spediakTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.darkText,
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: COLORS.darkText,
    textAlign: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    borderRadius: 10,
    marginBottom: 15,
    paddingHorizontal: 15,
  },
  inputIcon: {
      marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: COLORS.darkText,
    fontSize: 16,
  },
  eyeIconContainer: {
     padding: 5,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10, // Add some margin top
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10, // Add margin top
  },
  signInText: {
    color: COLORS.darkText,
    fontSize: 14,
  },
  signInLink: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonDisabled: {
        backgroundColor: '#a0a0a0',
  },
});

export default SignUpScreen; 