import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useGlobalState } from '../context/GlobalStateContext';
import { useAuth, useUser } from '@clerk/clerk-expo';
import axios from 'axios';
import { BASE_URL } from '../config/api';
import { COLORS } from '../styles/colors';
import { FileText, Settings } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

interface ActiveSop {
  stateSop: { 
    documentName: string; 
    fileUrl?: string;
  } | null;
  orgSop: { 
    documentName: string; 
    fileUrl?: string;
  } | null;
}

const SopAlignmentCard: React.FC = () => {
  const { selectedState } = useGlobalState();
  const { getToken } = useAuth();
  const { user } = useUser();
  const navigation = useNavigation<any>();
  const [activeSops, setActiveSops] = useState<ActiveSop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const organization = user?.unsafeMetadata?.organization as string || null;

  const fetchActiveSops = useCallback(async () => {
    if (!selectedState) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      
      if (!token) {
        setIsLoading(false);
        return;
      }

      const params: any = { state: selectedState };
      if (organization) {
        params.organization = organization;
      }

      const response = await axios.get(`${BASE_URL}/api/sop/active`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
        timeout: 8000 // 8 second timeout
      });

      setActiveSops({
        stateSop: response.data.stateSop ? {
          documentName: response.data.stateSop.documentName,
          fileUrl: response.data.stateSop.fileUrl
        } : null,
        orgSop: response.data.orgSop ? {
          documentName: response.data.orgSop.documentName,
          fileUrl: response.data.orgSop.fileUrl
        } : null
      });
      setError(null);
    } catch (err: any) {
      console.error('Error fetching active SOPs:', err);
      // Set empty state to prevent infinite retries
      setActiveSops({ stateSop: null, orgSop: null });
      setError('Could not load SOPs');
    } finally {
      setIsLoading(false);
    }
  }, [selectedState, organization, getToken]);

  useEffect(() => {
    fetchActiveSops();
  }, [fetchActiveSops]);

  const handleConfigureClick = () => {
    navigation.navigate('SOP');
  };

  if (isLoading) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <FileText size={20} color={COLORS.primary} />
          <Text style={styles.title}>SOP Alignment</Text>
        </View>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  if (error) {
    return null; // Gracefully hide on error
  }

  const hasStateSop = activeSops?.stateSop !== null;
  const hasOrgSop = activeSops?.orgSop !== null;
  const hasAnySop = hasStateSop || hasOrgSop;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <FileText size={20} color={COLORS.primary} />
          <Text style={styles.title}>SOP Alignment</Text>
        </View>
        <TouchableOpacity onPress={handleConfigureClick}>
          <Settings size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {hasAnySop ? (
        <View style={styles.sopList}>
          {hasStateSop && (
            <View style={styles.sopItem}>
              <Text style={styles.sopLabel}>State SOP:</Text>
              <Text style={styles.sopValue}>{activeSops.stateSop?.documentName}</Text>
            </View>
          )}
          {hasOrgSop && (
            <View style={styles.sopItem}>
              <Text style={styles.sopLabel}>Organization SOP:</Text>
              <Text style={styles.sopValue}>{activeSops.orgSop?.documentName}</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.noSopContainer}>
          <Text style={styles.noSopText}>
            No active SOPs configured for {selectedState}
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.configureButton} onPress={handleConfigureClick}>
        <Text style={styles.configureButtonText}>Configure SOPs →</Text>
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
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  sopList: {
    marginBottom: 12,
  },
  sopItem: {
    marginBottom: 12,
  },
  sopLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  sopValue: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  noSopContainer: {
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 12,
  },
  noSopText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  configureButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  configureButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default SopAlignmentCard;
