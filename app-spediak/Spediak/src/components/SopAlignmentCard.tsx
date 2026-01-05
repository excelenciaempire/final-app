import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useGlobalState } from '../context/GlobalStateContext';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { BASE_URL } from '../config/api';
import { COLORS } from '../styles/colors';
import { FileText, ArrowRight } from 'lucide-react-native';

interface ActiveSop {
  state_sop?: {
    document_name: string;
    file_url: string;
  };
  org_sop?: {
    document_name: string;
    file_url: string;
  };
}

export const SopAlignmentCard: React.FC = () => {
  const { selectedState } = useGlobalState();
  const { getToken } = useAuth();
  const { user } = useUser();
  const navigation = useNavigation<any>();
  const [activeSops, setActiveSops] = useState<ActiveSop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userOrganization = user?.unsafeMetadata?.organization as string | undefined;

  useEffect(() => {
    const fetchActiveSops = async () => {
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

        const response = await axios.get(`${BASE_URL}/api/sop/active`, {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            state: selectedState,
            organization: userOrganization || null,
          },
        });

        setActiveSops(response.data || null);
      } catch (err: any) {
        console.error('Error fetching active SOPs:', err);
        setError('Failed to load SOP information');
        setActiveSops(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveSops();
  }, [selectedState, userOrganization, getToken]);

  const handleNavigateToSop = () => {
    navigation.navigate('SOP');
  };

  if (isLoading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  if (error || !activeSops) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <FileText size={20} color={COLORS.primary} />
          <Text style={styles.title}>SOP Alignment</Text>
        </View>
        <Text style={styles.noSopText}>No active SOPs configured</Text>
        <TouchableOpacity style={styles.configureButton} onPress={handleNavigateToSop}>
          <Text style={styles.configureButtonText}>Configure SOPs</Text>
          <ArrowRight size={16} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    );
  }

  const hasStateSop = !!activeSops.state_sop;
  const hasOrgSop = !!activeSops.org_sop;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <FileText size={20} color={COLORS.primary} />
        <Text style={styles.title}>SOP Alignment</Text>
      </View>

      <View style={styles.content}>
        {hasStateSop && (
          <View style={styles.sopItem}>
            <Text style={styles.sopLabel}>State SOP:</Text>
            <Text style={styles.sopName}>{activeSops.state_sop?.document_name}</Text>
          </View>
        )}

        {hasOrgSop && (
          <View style={styles.sopItem}>
            <Text style={styles.sopLabel}>Organization SOP:</Text>
            <Text style={styles.sopName}>{activeSops.org_sop?.document_name}</Text>
          </View>
        )}

        {!hasStateSop && !hasOrgSop && (
          <Text style={styles.noSopText}>No active SOPs for this state/organization</Text>
        )}
      </View>

      <TouchableOpacity style={styles.configureButton} onPress={handleNavigateToSop}>
        <Text style={styles.configureButtonText}>View/Configure SOPs</Text>
        <ArrowRight size={16} color={COLORS.white} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.darkText,
  },
  content: {
    marginBottom: 12,
    gap: 8,
  },
  sopItem: {
    paddingVertical: 8,
  },
  sopLabel: {
    fontSize: 14,
    color: COLORS.textSeco,
    marginBottom: 4,
  },
  sopName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.darkText,
  },
  noSopText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  configureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  configureButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SopAlignmentCard;

