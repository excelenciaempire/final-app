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

  // Start the sign up process.
  const onSignUpPress = async () => {
    if (!isLoaded) {
      return;
    }
    if (password !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match.');
        return;
    }

    setLoading(true);
    try {
      await signUp.create({
        firstName,
        lastName,
        emailAddress,
        password,
      });

      // Send email verification code
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });

      // Change the UI to verify the code
      setPendingVerification(true);
    } catch (err: any) {
      Alert.alert('Sign Up Error', err.errors ? err.errors[0].message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  // Verify the email code
  const onPressVerify = async () => {
    if (!isLoaded) {
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
        Alert.alert('Verification Error', err.errors ? err.errors[0].message : 'Verification failed');
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

              <TouchableOpacity style={styles.button} onPress={onSignUpPress} disabled={loading}>
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
              <TouchableOpacity style={styles.button} onPress={onPressVerify} disabled={loading}>
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
});

export default SignUpScreen; 