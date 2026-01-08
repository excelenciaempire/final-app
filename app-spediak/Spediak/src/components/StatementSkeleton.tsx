import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Text, Platform } from 'react-native';
import { COLORS } from '../styles/colors';

interface StatementSkeletonProps {
  animate?: boolean;
}

const StatementSkeleton: React.FC<StatementSkeletonProps> = ({ animate = true }) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Analyzing image...');

  useEffect(() => {
    if (animate) {
      // Pulse animation for skeleton lines
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      // Progress animation (simulated - reaches 90% then waits)
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          const increment = prev < 30 ? 8 : prev < 60 ? 5 : prev < 80 ? 2 : 1;
          return Math.min(prev + increment, 90);
        });
      }, 300);

      // Status text updates
      const statusUpdates = [
        { time: 500, text: 'Processing image details...' },
        { time: 1500, text: 'Analyzing defects...' },
        { time: 3000, text: 'Consulting SOP guidelines...' },
        { time: 5000, text: 'Crafting professional statement...' },
        { time: 8000, text: 'Finalizing statement...' },
      ];

      const timeouts = statusUpdates.map(({ time, text }) =>
        setTimeout(() => setStatusText(text), time)
      );

      return () => {
        pulse.stop();
        clearInterval(progressInterval);
        timeouts.forEach(clearTimeout);
      };
    }
  }, [animate, pulseAnim]);

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  // Skeleton line widths for realistic text appearance
  const lines = [
    { width: '100%', delay: 0 },
    { width: '95%', delay: 50 },
    { width: '88%', delay: 100 },
    { width: '100%', delay: 150 },
    { width: '76%', delay: 200 },
  ];

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View 
            style={[
              styles.progressFill, 
              { width: `${progress}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>{Math.round(progress)}%</Text>
      </View>

      {/* Status Text */}
      <Animated.Text style={[styles.statusText, { opacity }]}>
        {statusText}
      </Animated.Text>

      {/* Skeleton Lines */}
      <View style={styles.skeletonContainer}>
        {lines.map((line, index) => (
          <Animated.View
            key={index}
            style={[
              styles.skeletonLine,
              { 
                width: line.width,
                opacity: animate ? opacity : 0.5,
              },
            ]}
          />
        ))}
      </View>

      {/* Helpful tip */}
      <Text style={styles.tipText}>
        ✨ AI is generating your professional statement
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    width: 40,
    textAlign: 'right',
  },
  statusText: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  skeletonContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  skeletonLine: {
    height: 12,
    backgroundColor: '#CBD5E1',
    borderRadius: 6,
    marginBottom: 10,
  },
  tipText: {
    marginTop: 16,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
});

export default StatementSkeleton;
