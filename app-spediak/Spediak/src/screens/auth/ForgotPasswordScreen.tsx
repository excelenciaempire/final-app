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
} from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../styles/colors';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

type ForgotPasswordScreenProps = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ navigation }) => {
  const { signIn, isLoaded } = useSignIn();

  const [emailAddress, setEmailAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [successfulCreation, setSuccessfulCreation] = useState(false);
  const [secondFactor, setSecondFactor] = useState(false); // For handling the next step (code + new password)
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);


  // Request password reset code
  const onRequestReset = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: emailAddress,
      });
      setSuccessfulCreation(true);
      setSecondFactor(true); // Move to the next step UI
       Alert.alert('Check your email', 'A password reset code has been sent to your email.');
    } catch (err: any) {
      Alert.alert('Error', err.errors ? err.errors[0].message : 'Password reset request failed');
    } finally {
      setLoading(false);
    }
  };

  // Complete the password reset
  const onReset = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password,
      });
      console.log(result);
      Alert.alert('Success', 'Password reset successfully.');
      navigation.navigate('Login'); // Navigate back to Login on success
    } catch (err: any) {
      Alert.alert('Error', err.errors ? err.errors[0].message : 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
      </TouchableOpacity>

      <Text style={styles.title}>Reset Password</Text>

      {!secondFactor && (
          <>
            <Text style={styles.description}>
              Enter your email address to receive a password reset code.
            </Text>
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
            <TouchableOpacity style={styles.button} onPress={onRequestReset} disabled={loading}>
                {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>Reset Password</Text>}
            </TouchableOpacity>
        </>
      )}

        {secondFactor && (
            <>
                <Text style={styles.description}>
                    Check your email for the reset code and enter it below along with your new password.
                </Text>
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
                 <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="New Password"
                        placeholderTextColor={COLORS.darkText}
                        value={password}
                        secureTextEntry={!passwordVisible}
                        onChangeText={setPassword}
                    />
                    <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)} style={styles.eyeIconContainer}>
                        <Ionicons name={passwordVisible ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.darkText} />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.button} onPress={onReset} disabled={loading}>
                    {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>Set New Password</Text>}
                </TouchableOpacity>
            </>
        )}
    </SafeAreaView>
  );
};

// Reuse or adapt styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: COLORS.white,
  },
  backButton: {
    position: 'absolute',
    top: 60, // Adjust as needed for SafeAreaView
    left: 20,
    zIndex: 1,
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
    marginTop: 10, // Added margin top
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default ForgotPasswordScreen; 