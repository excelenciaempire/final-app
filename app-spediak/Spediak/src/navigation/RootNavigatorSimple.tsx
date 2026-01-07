import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { COLORS } from '../styles/colors';

/**
 * SIMPLIFIED ROOT NAVIGATOR FOR DEBUGGING
 * This is a minimal version to isolate the error #130 issue
 */
const RootNavigatorSimple: React.FC = () => {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>✅ Login Successful!</Text>
        <Text style={styles.message}>
          You are now authenticated.
        </Text>
        <Text style={styles.debug}>
          This is a simplified view for debugging.
        </Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => signOut()}
        >
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: COLORS.darkText,
    textAlign: 'center',
    marginBottom: 12,
  },
  debug: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RootNavigatorSimple;

