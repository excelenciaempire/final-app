import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useGlobalState, US_STATES } from '../context/GlobalStateContext';
import { useAuth, useUser } from '@clerk/clerk-expo';
import axios from 'axios';
import { BASE_URL } from '../config/api';
import { COLORS } from '../styles/colors';
import { FileText, Download, Eye } from 'lucide-react-native';

const ORGANIZATIONS = ['None', 'ASHI', 'InterNACHI'];

const SopScreen: React.FC = () => {
  const { selectedState, setSelectedState } = useGlobalState();
  const { getToken } = useAuth();
  const { user } = useUser();
  const [organization, setOrganization] = useState<string>('None');
  const [activeStateSop, setActiveStateSop] = useState<any>(null);
  const [activeOrgSop, setActiveOrgSop] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize organization from user metadata
  useEffect(() => {
    if (user?.unsafeMetadata?.organization) {
      setOrganization(user.unsafeMetadata.organization as string);
    }
  }, [user]);

  const fetchSopData = useCallback(async () => {
    if (!selectedState) return;

    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      
      if (!token) {
        setIsLoading(false);
        return;
      }

      const params: any = { state: selectedState };
      if (organization && organization !== 'None') {
        params.organization = organization;
      }

      const response = await axios.get(`${BASE_URL}/api/sop/active`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      setActiveStateSop(response.data.stateSop);
      setActiveOrgSop(response.data.orgSop);
    } catch (err: any) {
      console.error('Error fetching SOP data:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch SOPs');
    } finally {
      setIsLoading(false);
    }
  }, [selectedState, organization, getToken]);

  useEffect(() => {
    fetchSopData();
  }, [fetchSopData]);

  const handleDownload = async (fileUrl: string, documentName: string) => {
    try {
      const canOpen = await Linking.canOpenURL(fileUrl);
      if (canOpen) {
        await Linking.openURL(fileUrl);
      } else {
        Alert.alert('Error', 'Cannot open this file URL');
      }
    } catch (err) {
      console.error('Error opening file:', err);
      Alert.alert('Error', 'Failed to open document');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>SOP Configuration</Text>
      <Text style={styles.description}>
        View and download Standard Operating Procedures for your state and organization.
      </Text>

      {/* State Selector */}
      <View style={styles.section}>
        <Text style={styles.label}>State</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedState || 'NC'}
            onValueChange={(value) => setSelectedState(value)}
            style={styles.picker}
          >
            {US_STATES.map((state) => (
              <Picker.Item key={state} label={state} value={state} />
            ))}
          </Picker>
        </View>
      </View>

      {/* Organization Selector */}
      <View style={styles.section}>
        <Text style={styles.label}>Organization</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={organization}
            onValueChange={(value) => setOrganization(value)}
            style={styles.picker}
          >
            {ORGANIZATIONS.map((org) => (
              <Picker.Item key={org} label={org} value={org} />
            ))}
          </Picker>
        </View>
      </View>

      {/* Active SOP Sources */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active SOP Sources</Text>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchSopData}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* State SOP */}
            <View style={styles.sopCard}>
              <View style={styles.sopHeader}>
                <FileText size={20} color={COLORS.primary} />
                <Text style={styles.sopCardTitle}>State SOP ({selectedState})</Text>
              </View>
              {activeStateSop ? (
                <>
                  <Text style={styles.sopDocumentName}>{activeStateSop.documentName}</Text>
                  <View style={styles.sopActions}>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleDownload(activeStateSop.fileUrl, activeStateSop.documentName)}
                    >
                      <Download size={16} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>Download</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.secondaryButton]}
                      onPress={() => handleDownload(activeStateSop.fileUrl, activeStateSop.documentName)}
                    >
                      <Eye size={16} color={COLORS.primary} />
                      <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>Preview</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <Text style={styles.noSopText}>No state SOP configured for {selectedState}</Text>
              )}
            </View>

            {/* Organization SOP */}
            {organization && organization !== 'None' && (
              <View style={styles.sopCard}>
                <View style={styles.sopHeader}>
                  <FileText size={20} color={COLORS.primary} />
                  <Text style={styles.sopCardTitle}>Organization SOP ({organization})</Text>
                </View>
                {activeOrgSop ? (
                  <>
                    <Text style={styles.sopDocumentName}>{activeOrgSop.documentName}</Text>
                    <View style={styles.sopActions}>
                      <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => handleDownload(activeOrgSop.fileUrl, activeOrgSop.documentName)}
                      >
                        <Download size={16} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Download</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.secondaryButton]}
                        onPress={() => handleDownload(activeOrgSop.fileUrl, activeOrgSop.documentName)}
                      >
                        <Eye size={16} color={COLORS.primary} />
                        <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>Preview</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <Text style={styles.noSopText}>No organization SOP configured for {organization}</Text>
                )}
              </View>
            )}
          </>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>About SOPs</Text>
        <Text style={styles.instructionsText}>
          Standard Operating Procedures (SOPs) ensure your inspection statements comply with state regulations and organizational standards. 
          {'\n\n'}
          Select your state and organization above to view applicable SOPs. Contact your administrator if you need different SOPs assigned.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorContainer: {
    padding: 20,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sopCard: {
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
  sopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sopCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  sopDocumentName: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  sopActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  secondaryButtonText: {
    color: COLORS.primary,
  },
  noSopText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  instructionsContainer: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
});

export default SopScreen;

