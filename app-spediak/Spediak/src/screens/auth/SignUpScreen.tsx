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
import Checkbox from 'expo-checkbox';

type SignUpScreenProps = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

const SignUpScreen: React.FC<SignUpScreenProps> = ({ navigation }) => {
  const { isLoaded, signUp, setActive } = useSignUp();

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
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false); // New state for Privacy Policy

  // --- NEW: State for inline error messages ---
  const [emailError, setEmailError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null); // For non-field specific errors
  // --------------------------------------------

  // Function to clear errors
  const clearErrors = () => {
      setEmailError(null);
      setUsernameError(null);
      setPasswordError(null);
      setConfirmPasswordError(null);
      setGeneralError(null);
  };

  // Start the sign up process.
  const onSignUpPress = async () => {
    console.log("[SignUpScreen] onSignUpPress called");
    if (!isLoaded || loading) {
      console.log("[SignUpScreen] EXITING: SignUp not loaded or already loading.");
      return;
    }

    clearErrors(); // Clear previous errors first
    let isValid = true;

    // Add terms agreement check first
    if (!agreedToTerms) {
        setGeneralError('You must agree to the Terms and Conditions to create an account.');
        isValid = false;
    }
    // Add privacy policy agreement check
    if (!agreedToPrivacy) {
        setGeneralError(prev => prev ? 'You must agree to both the Terms and Conditions and the Privacy Policy.' : 'You must agree to the Privacy Policy to create an account.');
        isValid = false;
    }

    // --- Password Validation ---
    // Client-side validation for length, uppercase, and symbol will be removed.
    // Clerk will handle this, and its errors will be processed in the catch block.
    
    // Check for matching passwords
    if (password !== confirmPassword) {
        setConfirmPasswordError('Passwords do not match.');
        isValid = false;
    }

    // Check for other missing fields (could add individual errors if needed)
    if (!firstName || !lastName || !emailAddress || !password || !username || !confirmPassword) { 
        setGeneralError("Please fill in all required fields."); 
        isValid = false;
    }

    // If client-side validation fails, stop here
    if (!isValid) {
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
      clearErrors(); // Clear previous before setting new ones
      console.error("[SignUpScreen] ERROR in try block:", JSON.stringify(err, null, 2));
      let userMessage = "An unexpected error occurred during sign up.";
      if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
          const firstError = err.errors[0];
          console.error("Clerk SignUp Error Code:", firstError.code);
          console.error("Clerk SignUp Error Message:", firstError.message);
          console.error("Clerk SignUp Error Meta:", firstError.meta);

          switch (firstError.code) {
              case 'form_identifier_exists':
                  if (firstError.meta?.paramName === 'email_address') {
                      setEmailError("This email address is already taken.");
                  } else if (firstError.meta?.paramName === 'username') {
                      setUsernameError("This username is already taken.");
                  } else {
                      setGeneralError("This email or username is already taken.");
                  }
                  break;
              case 'form_password_pwned':
                  setPasswordError("This password is too common or known to be compromised. Please choose another.");
                  break;
              case 'form_password_length_too_short':
                   setPasswordError(`Password too short. Minimum ${firstError.meta?.minimumLength || '8'} characters.`); // Ensure a default if meta is not present
                   break;
              case 'form_password_complexity': 
                   // Updated error message for password complexity (no symbol requirement)
                   setPasswordError("Password must contain at least one uppercase letter and one number.");
                   break;
              case 'unauthenticated': // Example of another common Clerk error
                  setGeneralError("Authentication error. Please try again.");
                  break;
              // Add more cases for other specific Clerk error codes as needed
              // For example, for username validation from Clerk:
              // case 'form_param_format_invalid':
              //    if (firstError.meta?.paramName === 'username') {
              //        setUsernameError(firstError.message); // Use Clerk's message for username
              //    } else {
              //        setGeneralError(firstError.longMessage || firstError.message || userMessage);
              //    }
              //    break;
              default:
                  // Attempt to set field-specific errors if possible from Clerk's response, otherwise general
                  if (firstError.meta?.paramName === 'password') {
                    setPasswordError(firstError.longMessage || firstError.message);
                  } else if (firstError.meta?.paramName === 'username') {
                    setUsernameError(firstError.longMessage || firstError.message);
                  } else if (firstError.meta?.paramName === 'email_address') {
                    setEmailError(firstError.longMessage || firstError.message);
                  } else {
                    setGeneralError(firstError.longMessage || firstError.message || userMessage);
                  }
                  break;
          }
      } else if (err.message) {
           setGeneralError(err.message);
      }
      // No Alert needed here now, errors are in state
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
    clearErrors(); // Clear previous errors
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
      let errorMessage = 'Verification failed.';
      let isCodeError = false;
      if (err.errors && err.errors[0]) {
          if (err.errors[0].code === 'form_code_incorrect') {
              errorMessage = 'Incorrect verification code. Please try again.';
              isCodeError = true;
          } else {
              errorMessage = err.errors[0].message;
          }
      }
      console.error(JSON.stringify(err, null, 2)); 
      if (isCodeError) {
          // Set specific state for code error if needed, or use general
          setGeneralError(errorMessage); // Display error near the code input ideally
      } else {
           Alert.alert('Verification Error', errorMessage); // Keep alert for other verification errors
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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
                  onChangeText={(text) => { setEmailAddress(text); setEmailError(null); }}
                  />
              </View>
              {emailError && <Text style={styles.errorText}>{emailError}</Text>}
               <View style={styles.inputContainer}>
                   <Ionicons name="lock-closed-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                  <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={COLORS.darkText}
                  value={password}
                  secureTextEntry={!passwordVisible}
                  onChangeText={(text) => { setPassword(text); setPasswordError(null); }}
                  />
                   <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)} style={styles.eyeIconContainer}>
                      <Ionicons name={passwordVisible ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.darkText} />
                  </TouchableOpacity>
              </View>
              {passwordError && <Text style={styles.errorText}>{passwordError}</Text>}
               <View style={styles.inputContainer}>
                   <Ionicons name="lock-closed-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                  <TextInput
                      style={styles.input}
                      placeholder="Confirm Password"
                      placeholderTextColor={COLORS.darkText}
                      value={confirmPassword}
                      secureTextEntry={!confirmPasswordVisible}
                      onChangeText={(text) => { setConfirmPassword(text); setConfirmPasswordError(null); }}
                  />
                   <TouchableOpacity onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)} style={styles.eyeIconContainer}>
                      <Ionicons name={confirmPasswordVisible ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.darkText} />
                  </TouchableOpacity>
              </View>
              {confirmPasswordError && <Text style={styles.errorText}>{confirmPasswordError}</Text>}
               <View style={styles.inputContainer}>
                   <Ionicons name="person-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                  <TextInput
                      style={styles.input}
                      placeholder="Username"
                      placeholderTextColor={COLORS.darkText}
                      value={username}
                      onChangeText={(text) => { setUsername(text); setUsernameError(null); }}
                      autoCapitalize="none"
                  />
              </View>
              {usernameError && <Text style={styles.errorText}>{usernameError}</Text>}

              {/* Terms and Conditions Checkbox */}
              <View style={styles.checkboxContainer}>
                  <Checkbox
                      style={styles.checkbox}
                      value={agreedToTerms}
                      onValueChange={setAgreedToTerms}
                      color={agreedToTerms ? COLORS.primary : undefined}
                  />
                  <TouchableOpacity onPress={() => navigation.navigate('TermsAndConditions')}>
                      <Text style={styles.checkboxLabel}>
                          I agree to the <Text style={styles.linkText}>Terms and Conditions</Text>
                      </Text>
                  </TouchableOpacity>
              </View>

              {/* Privacy Policy Checkbox */}
              <View style={styles.checkboxContainer}>
                  <Checkbox
                      style={styles.checkbox}
                      value={agreedToPrivacy}
                      onValueChange={setAgreedToPrivacy}
                      color={agreedToPrivacy ? COLORS.primary : undefined}
                  />
                  <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
                      <Text style={styles.checkboxLabel}>
                          I agree to the <Text style={styles.linkText}>Privacy Policy</Text>
                      </Text>
                  </TouchableOpacity>
              </View>

              {/* Display general errors here */}
              {generalError && <Text style={styles.errorText}>{generalError}</Text>}

              <TouchableOpacity
                  style={[styles.button, (!isLoaded || loading || !agreedToTerms || !agreedToPrivacy) && styles.buttonDisabled]}
                  onPress={onSignUpPress}
                  disabled={!isLoaded || loading || !agreedToTerms || !agreedToPrivacy}
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
                      onChangeText={(text) => { setCode(text); setGeneralError(null); }}
                  />
              </View>
              {/* Display general errors (like incorrect code) here */}
              {generalError && <Text style={styles.errorText}>{generalError}</Text>}
              <TouchableOpacity 
                  style={[styles.button, (!isLoaded || loading) && styles.buttonDisabled]}
                  onPress={onPressVerify} 
                  disabled={!isLoaded || loading}
              >
                   {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>Verify Email</Text>}
              </TouchableOpacity>
            </>
          )}

          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.signUpLink}>Log In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Reuse or adapt styles from LoginScreen, making necessary adjustments
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  keyboardAvoidingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
  },
  scrollContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 500, // Match LoginScreen max width
  },
  spediakTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 40,
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
    marginBottom: 30,
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
    marginTop: 10,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  signUpText: {
    color: COLORS.darkText,
    fontSize: 14,
  },
  signUpLink: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonDisabled: {
        backgroundColor: '#a0a0a0',
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    marginBottom: 15,
    paddingHorizontal: 5,
    textAlign: 'left',
    width: '100%',
    paddingLeft: 15,
  },
  checkboxContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'center',
  },
  checkbox: {
    marginRight: 10,
  },
  checkboxLabel: {
    fontSize: 14,
    color: COLORS.darkText,
  },
  linkText: {
    fontSize: 14,
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
});

export default SignUpScreen; 