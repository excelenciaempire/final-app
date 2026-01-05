import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useGlobalState } from '../context/GlobalStateContext';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { BASE_URL } from '../config/api';
import { COLORS } from '../styles/colors';
import { FileText, ArrowRight } from 'lucide-react-native';

interface ActiveSop {
  state_sop?: {
    id: number;
    document_name: string;
    file_url: string;
  };
  org_sop?: {
    id: number;
    document_name: string;
    file_url: string;
  };
}

export const SopAlignmentCard: React.FC = () => {
  const { selectedState } = useGlobalState();
  const { getToken } = useAuth();
  const { user } = useUser();
  const navigation = useNavigation();
  const [activeSops, setActiveSops] = useState<ActiveSop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        const organization = user?.unsafeMetadata?.organization as string || null;

        const response = await axios.get(`${BASE_URL}/api/sop/active`, {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            state: selectedState,
            organization: organization || undefined,
          }
        });

        setActiveSops(response.data);
      } catch (err: any) {
        console.error('Error fetching active SOPs:', err);
        setError('Failed to load SOP information');
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveSops();
  }, [selectedState, user, getToken]);

  const handleViewSops = () => {
    navigation.navigate('SOP');
  };

  const handleDownload = async (url: string, documentName: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.error('Cannot open URL:', url);
      }
    } catch (error) {
      console.error('Error opening SOP:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  if (error || (!activeSops?.state_sop && !activeSops?.org_sop)) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <FileText size={20} color={COLORS.primary} />
          <Text style={styles.title}>SOP Alignment</Text>
        </View>
        <Text style={styles.noSopText}>
          No active SOPs configured for {selectedState || 'selected state'}
        </Text>
        <TouchableOpacity style={styles.configureButton} onPress={handleViewSops}>
          <Text style={styles.configureButtonText}>Configure SOPs →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <FileText size={20} color={COLORS.primary} />
        <Text style={styles.title}>SOP Alignment</Text>
      </View>

      <View style={styles.content}>
        {activeSops.state_sop && (
          <View style={styles.sopItem}>
            <View style={styles.sopInfo}>
              <Text style={styles.sopLabel}>State SOP:</Text>
              <Text style={styles.sopName}>{activeSops.state_sop.document_name}</Text>
            </View>
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => handleDownload(activeSops.state_sop!.file_url, activeSops.state_sop!.document_name)}
            >
              <Text style={styles.downloadButtonText}>View</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeSops.org_sop && (
          <View style={styles.sopItem}>
            <View style={styles.sopInfo}>
              <Text style={styles.sopLabel}>Organization SOP:</Text>
              <Text style={styles.sopName}>{activeSops.org_sop.document_name}</Text>
            </View>
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => handleDownload(activeSops.org_sop!.file_url, activeSops.org_sop!.document_name)}
            >
              <Text style={styles.downloadButtonText}>View</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.configureButton} onPress={handleViewSops}>
        <Text style={styles.configureButtonText}>Configure SOPs</Text>
        <ArrowRight size={16} color={COLORS.primary} />
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
    gap: 12,
  },
  sopItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.secondary,
  },
  sopInfo: {
    flex: 1,
    marginRight: 12,
  },
  sopLabel: {
    fontSize: 12,
    color: COLORS.darkText,
    opacity: 0.7,
    marginBottom: 4,
  },
  sopName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkText,
  },
  downloadButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.secondary,
    borderRadius: 6,
  },
  downloadButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  noSopText: {
    fontSize: 14,
    color: COLORS.darkText,
    opacity: 0.7,
    marginBottom: 12,
    textAlign: 'center',
  },
  configureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.secondary,
    marginTop: 8,
    gap: 8,
  },
  configureButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default SopAlignmentCard;

