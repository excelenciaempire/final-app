import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import axios from 'axios';
import { BASE_URL } from '../config/api';
import { COLORS } from '../styles/colors';
import { FileText, ArrowRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

interface Statement {
  id: number;
  ddid_text: string;
  state_used: string;
  created_at: string;
}

const LastStatementCard: React.FC = () => {
  const { getToken } = useAuth();
  const navigation = useNavigation<any>();
  const [lastStatement, setLastStatement] = useState<Statement | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLastStatement = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await axios.get(`${BASE_URL}/api/inspections`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 1 },
        timeout: 8000
      });

      // Handle both possible response structures
      const inspections = response.data.inspections || response.data.history || response.data || [];
      if (Array.isArray(inspections) && inspections.length > 0) {
        const inspection = inspections[0];
        setLastStatement({
          id: inspection.id,
          ddid_text: inspection.ddid || inspection.ddid_text || '',
          state_used: inspection.state || inspection.state_used || '',
          created_at: inspection.created_at || ''
        });
      }
    } catch (err: any) {
      // Silently fail - this is not critical
      console.log('No statements found or error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchLastStatement();
  }, [fetchLastStatement]);

  const handleViewHistory = () => {
    navigation.navigate('Statement History');
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    } catch {
      return dateString;
    }
  };

  const getPreview = (text: string) => {
    if (!text) return '';
    // Get first 100 characters, end at a word boundary
    const truncated = text.substring(0, 100);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 60) {
      return truncated.substring(0, lastSpace) + '...';
    }
    return truncated + '...';
  };

  if (isLoading) {
    return (
      <View style={styles.card}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  if (!lastStatement) {
    return null; // Don't show if no statements
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <FileText size={20} color={COLORS.primary} />
        <Text style={styles.title}>Last Statement</Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Date:</Text>
        <Text style={styles.metaValue}>{formatDate(lastStatement.created_at)}</Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>State:</Text>
        <Text style={styles.metaValue}>{lastStatement.state_used || 'N/A'}</Text>
      </View>

      <View style={styles.previewSection}>
        <Text style={styles.previewLabel}>Preview:</Text>
        <Text style={styles.previewText}>{getPreview(lastStatement.ddid_text)}</Text>
      </View>

      <TouchableOpacity style={styles.viewHistoryLink} onPress={handleViewHistory}>
        <Text style={styles.viewHistoryText}>View full statement history</Text>
        <ArrowRight size={16} color={COLORS.primary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  metaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    width: 50,
  },
  metaValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  previewSection: {
    marginTop: 8,
    marginBottom: 12,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
  },
  previewText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  viewHistoryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  viewHistoryText: {
    fontSize: 14,
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
});

export default LastStatementCard;

