import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../styles/colors';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { BASE_URL } from '../../config/api';

type ForgotPasswordScreenProps = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ navigation }) => {
  const { signIn, setActive, isLoaded } = useSignIn();

  const [emailAddress, setEmailAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [secondFactor, setSecondFactor] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Hide the browser's native password-reveal button on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'hide-pw-reveal';
      if (!document.getElementById(styleId)) {
        const s = document.createElement('style');
        s.id = styleId;
        s.textContent =
          'input::-ms-reveal { display: none !important; } ' +
          'input::-webkit-contacts-auto-fill-button { visibility: hidden !important; } ' +
          'input::-webkit-credentials-auto-fill-button { visibility: hidden !important; }';
        document.head.appendChild(s);
      }
    }
  }, []);

  // Request password reset code
  const onRequestReset = async () => {
    if (!isLoaded) return;
    if (!emailAddress.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if email exists in the database first
      const checkRes = await fetch(`${BASE_URL}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailAddress.trim().toLowerCase() }),
      });
      const checkData = await checkRes.json();

      if (!checkData.exists) {
        setError('No account found with that email address.');
        return;
      }

      // Email exists — request reset code via Clerk
      await signIn!.create({
        strategy: 'reset_password_email_code',
        identifier: emailAddress.trim(),
      });
      setSecondFactor(true);
    } catch (err: any) {
      const clerkCode = err.errors?.[0]?.code;
      const clerkMsg = err.errors?.[0]?.message;

      if (clerkCode === 'session_exists') {
        setError(
          'You are already signed in. Sign out first to reset your password, or change it from your Profile settings.'
        );
      } else {
        setError(clerkMsg || 'Password reset request failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Complete the password reset
  const onReset = async () => {
    if (!isLoaded) return;
    if (!code.trim() || !password.trim()) {
      setError('Please enter both the verification code and your new password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await signIn!.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password,
      });

      if (result.status === 'complete') {
        // Activate the new session (required by Clerk after password reset)
        await setActive!({ session: result.createdSessionId });
        setSuccessMessage('Password reset successfully! Redirecting…');
        setTimeout(() => navigation.navigate('Login'), 1500);
      } else {
        setError('Password reset could not be completed. Please try again.');
      }
    } catch (err: any) {
      const clerkMsg = err.errors?.[0]?.longMessage || err.errors?.[0]?.message;
      setError(clerkMsg || 'Password reset failed. Please check your code and try again.');
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

      <View style={styles.formContainer}>
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
                onChangeText={(t) => { setEmailAddress(t); setError(null); }}
              />
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity style={styles.button} onPress={onRequestReset} disabled={loading}>
              {loading
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.buttonText}>Send Reset Code</Text>}
            </TouchableOpacity>
          </>
        )}

        {secondFactor && (
          <>
            <Text style={styles.description}>
              A reset code was sent to <Text style={{ fontWeight: '600' }}>{emailAddress}</Text>.{'\n'}
              Enter the code and your new password below.
            </Text>

            <View style={styles.inputContainer}>
              <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={code}
                placeholder="Verification Code"
                placeholderTextColor={COLORS.darkText}
                keyboardType="numeric"
                onChangeText={(t) => { setCode(t); setError(null); }}
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
                onChangeText={(t) => { setPassword(t); setError(null); }}
              />
              <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)} style={styles.eyeIconContainer}>
                <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.darkText} />
              </TouchableOpacity>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}
            {successMessage && <Text style={styles.successText}>{successMessage}</Text>}

            <TouchableOpacity style={styles.button} onPress={onReset} disabled={loading}>
              {loading
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.buttonText}>Set New Password</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: COLORS.white,
  },
  backButton: {
    position: 'absolute',
    top: 60,
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
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  description: {
    fontSize: 16,
    color: COLORS.darkText,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
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
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    marginTop: -4,
  },
  successText: {
    color: '#16A34A',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    marginTop: -4,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 10,
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 10,
    minWidth: 180,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ForgotPasswordScreen;
