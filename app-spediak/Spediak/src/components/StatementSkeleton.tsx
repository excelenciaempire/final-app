import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface StatementSkeletonProps {
  lines?: number;
  animate?: boolean;
}

const StatementSkeleton: React.FC<StatementSkeletonProps> = ({ 
  lines = 6, 
  animate = true 
}) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animate) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [animate, pulseAnim]);

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.8],
  });

  // Generate random-ish line widths to mimic paragraph text
  const lineWidths = [
    '100%', '95%', '88%', '100%', '92%', '75%', '100%', '85%', '70%'
  ];

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        {Array.from({ length: lines }).map((_, index) => (
          <Animated.View
            key={index}
            style={[
              styles.skeletonLine,
              { 
                width: lineWidths[index % lineWidths.length],
                opacity: animate ? opacity : 0.5,
              },
              index === lines - 1 && styles.lastLine
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  textContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  skeletonLine: {
    height: 14,
    backgroundColor: '#CBD5E1',
    borderRadius: 4,
    marginBottom: 10,
  },
  lastLine: {
    marginBottom: 0,
  },
});

export default StatementSkeleton;
