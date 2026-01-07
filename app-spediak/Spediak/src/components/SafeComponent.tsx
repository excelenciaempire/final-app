import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SafeComponentProps {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface SafeComponentState {
  hasError: boolean;
  error: Error | null;
}

/**
 * SafeComponent - A wrapper to catch errors in child components
 * Prevents individual component errors from crashing the entire app
 */
class SafeComponent extends Component<SafeComponentProps, SafeComponentState> {
  constructor(props: SafeComponentProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): SafeComponentState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      `SafeComponent caught error in ${this.props.componentName || 'component'}:`,
      error,
      errorInfo
    );
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {this.props.componentName || 'Component'} Error
          </Text>
          {__DEV__ && (
            <Text style={styles.errorDetails}>
              {this.state.error?.message}
            </Text>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    padding: 10,
    backgroundColor: '#ffebee',
    borderRadius: 4,
    margin: 4,
  },
  errorText: {
    color: '#c62828',
    fontSize: 12,
    fontWeight: '600',
  },
  errorDetails: {
    color: '#e53935',
    fontSize: 10,
    marginTop: 4,
  },
});

export default SafeComponent;

