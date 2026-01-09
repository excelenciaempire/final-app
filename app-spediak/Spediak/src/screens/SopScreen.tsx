import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Linking, 
  Alert,
  Platform,
  useWindowDimensions
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useGlobalState, US_STATES } from '../context/GlobalStateContext';
import { useAuth, useUser } from '@clerk/clerk-expo';
import axios from 'axios';
import { BASE_URL } from '../config/api';
import { COLORS } from '../styles/colors';
import { FileText, ExternalLink, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react-native';
import AdBanner from '../components/AdBanner';
import StatementUsageCard from '../components/StatementUsageCard';

const SopScreen: React.FC = () => {
  const { selectedState, setSelectedState } = useGlobalState();
  const { getToken } = useAuth();
  const { user } = useUser();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 600;
  
  const [organization, setOrganization] = useState<string>('None');
  const [organizations, setOrganizations] = useState<{ value: string; label: string }[]>([
    { value: 'None', label: 'None / Not using organization SOP' }
  ]);
  const [activeStateSop, setActiveStateSop] = useState<any>(null);
  const [activeOrgSop, setActiveOrgSop] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);

  // Initialize organization from user metadata
  useEffect(() => {
    if (user?.unsafeMetadata?.organization) {
      setOrganization(user.unsafeMetadata.organization as string);
    }
  }, [user]);

  // Fetch organizations from backend
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        setIsLoadingOrgs(true);
        const token = await getToken();
        if (!token) {
          setIsLoadingOrgs(false);
          return;
        }
        
        const response = await axios.get(`${BASE_URL}/api/sop/organizations`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        });
        
        const backendOrgs = response.data.organizations || [];
        const orgOptions = [
          { value: 'None', label: 'None / Not using organization SOP' },
          ...backendOrgs.map((org: any) => ({ 
            value: org.name, 
            label: org.name 
          }))
        ];
        setOrganizations(orgOptions);
      } catch (err) {
        console.log('Could not fetch organizations:', err);
        // Keep default option
      } finally {
        setIsLoadingOrgs(false);
      }
    };
    fetchOrganizations();
  }, [getToken]);

  // Save organization selection to user metadata
  const handleOrganizationChange = async (value: string) => {
    setOrganization(value);
    
    // Save to user metadata
    if (user) {
      try {
        await user.update({
          unsafeMetadata: {
            ...user.unsafeMetadata,
            organization: value
          }
        });
      } catch (err) {
        console.error('Error saving organization preference:', err);
      }
    }
  };

  const fetchSopData = useCallback(async () => {
    if (!selectedState) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
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
        params,
        timeout: 15000
      });

      setActiveStateSop(response.data.stateSop);
      setActiveOrgSop(response.data.orgSop);
    } catch (err: any) {
      console.error('Error fetching SOP data:', err);
      setActiveStateSop(null);
      setActiveOrgSop(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedState, organization, getToken]);

  useEffect(() => {
    fetchSopData();
  }, [fetchSopData]);

  // Open PDF in browser/viewer
  const handleViewDocument = async (fileUrl: string, documentName: string) => {
    try {
      if (Platform.OS === 'web') {
        const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
        window.open(viewerUrl, '_blank');
        return;
      }
      
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

  const handleReportIssue = () => {
    const subject = encodeURIComponent('SOP Request/Issue');
    const body = encodeURIComponent(`State: ${selectedState}\nOrganization: ${organization}\n\nPlease describe your request or issue:\n`);
    Linking.openURL(`mailto:support@spediak.com?subject=${subject}&body=${body}`);
  };

  const hasStateSop = activeStateSop !== null;
  const hasOrgSop = activeOrgSop !== null && organization !== 'None';

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, isLargeScreen && styles.contentContainerLarge]}
    >
      {/* Usage & Ad Banner for free users */}
      <StatementUsageCard />
      <AdBanner />

      {/* Main SOP Card */}
      <View style={[styles.cardContainer, isLargeScreen && styles.cardContainerLarge]}>
        <Text style={styles.title}>SOP Configuration</Text>
        <Text style={styles.description}>
          Select your state and organization to configure which Standards of Practice Spediak will use when generating DDID statements.
        </Text>

        {/* State Selector */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Select State</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedState || 'NC'}
              onValueChange={(value) => setSelectedState(value)}
              style={styles.picker}
              dropdownIconColor={COLORS.textSecondary}
            >
              {US_STATES.map((state) => (
                <Picker.Item 
                  key={state.value} 
                  label={state.value} 
                  value={state.value} 
                />
              ))}
            </Picker>
            <ChevronDown size={18} color={COLORS.textSecondary} style={styles.pickerIcon} />
          </View>
        </View>

        {/* Organization Selector */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Organization SOP <Text style={styles.optionalText}>(optional)</Text></Text>
          <View style={styles.pickerWrapper}>
            {isLoadingOrgs ? (
              <View style={styles.loadingPicker}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingPickerText}>Loading organizations...</Text>
              </View>
            ) : (
              <Picker
                selectedValue={organization}
                onValueChange={handleOrganizationChange}
                style={styles.picker}
                dropdownIconColor={COLORS.textSecondary}
              >
                {organizations.map((org) => (
                  <Picker.Item key={org.value} label={org.label} value={org.value} />
                ))}
              </Picker>
            )}
            {!isLoadingOrgs && <ChevronDown size={18} color={COLORS.textSecondary} style={styles.pickerIcon} />}
          </View>
        </View>

        {/* Active SOP Documents Section */}
        <View style={styles.activeSopSection}>
          <View style={styles.sectionHeader}>
            <FileText size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Active SOP Documents</Text>
          </View>
          
          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading SOP assignments...</Text>
            </View>
          ) : (
            <>
              {/* State SOP Row */}
              <View style={styles.sopRow}>
                <View style={styles.sopRowLeft}>
                  <View style={[styles.sopTypeTag, styles.stateTag]}>
                    <Text style={styles.sopTypeTagText}>STATE</Text>
                  </View>
                  <View style={styles.sopInfo}>
                    <Text style={styles.sopLabel}>{selectedState || 'NC'} SOP</Text>
                    <Text style={[
                      styles.sopStatus,
                      hasStateSop ? styles.sopStatusAssigned : styles.sopStatusMissing
                    ]}>
                      {hasStateSop ? activeStateSop.documentName : 'Not assigned'}
                    </Text>
                  </View>
                </View>
                {hasStateSop && activeStateSop.fileUrl && (
                  <TouchableOpacity 
                    style={styles.viewButton}
                    onPress={() => handleViewDocument(activeStateSop.fileUrl, activeStateSop.documentName)}
                  >
                    <ExternalLink size={16} color="#fff" />
                    <Text style={styles.viewButtonText}>View</Text>
                  </TouchableOpacity>
                )}
                {!hasStateSop && (
                  <View style={styles.statusBadge}>
                    <AlertCircle size={14} color="#F59E0B" />
                  </View>
                )}
              </View>

              {/* Organization SOP Row */}
              <View style={styles.sopRow}>
                <View style={styles.sopRowLeft}>
                  <View style={[styles.sopTypeTag, styles.orgTag]}>
                    <Text style={styles.sopTypeTagText}>ORG</Text>
                  </View>
                  <View style={styles.sopInfo}>
                    <Text style={styles.sopLabel}>
                      {organization === 'None' ? 'Organization SOP' : `${organization} SOP`}
                    </Text>
                    <Text style={[
                      styles.sopStatus,
                      organization === 'None' 
                        ? styles.sopStatusNone
                        : hasOrgSop 
                          ? styles.sopStatusAssigned 
                          : styles.sopStatusMissing
                    ]}>
                      {organization === 'None' 
                        ? 'None selected'
                        : hasOrgSop 
                          ? activeOrgSop.documentName 
                          : 'Not assigned'}
                    </Text>
                  </View>
                </View>
                {hasOrgSop && activeOrgSop.fileUrl && (
                  <TouchableOpacity 
                    style={styles.viewButton}
                    onPress={() => handleViewDocument(activeOrgSop.fileUrl, activeOrgSop.documentName)}
                  >
                    <ExternalLink size={16} color="#fff" />
                    <Text style={styles.viewButtonText}>View</Text>
                  </TouchableOpacity>
                )}
                {organization !== 'None' && !hasOrgSop && (
                  <View style={styles.statusBadge}>
                    <AlertCircle size={14} color="#F59E0B" />
                  </View>
                )}
                {organization === 'None' && (
                  <View style={styles.statusBadgeNeutral}>
                    <Text style={styles.statusBadgeText}>—</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>

        {/* Status Summary */}
        {!isLoading && (
          <View style={[
            styles.statusSummary,
            (hasStateSop || hasOrgSop) ? styles.statusSummaryActive : styles.statusSummaryInactive
          ]}>
            {(hasStateSop || hasOrgSop) ? (
              <>
                <CheckCircle size={18} color="#10B981" />
                <Text style={styles.statusSummaryTextActive}>
                  {hasStateSop && hasOrgSop 
                    ? 'Statements will comply with both State and Organization SOPs'
                    : hasStateSop 
                      ? 'Statements will comply with State SOP'
                      : 'Statements will comply with Organization SOP'}
                </Text>
              </>
            ) : (
              <>
                <AlertCircle size={18} color="#6B7280" />
                <Text style={styles.statusSummaryTextInactive}>
                  No SOP configured. Statements will use Spediak's general best-practice guidance.
                </Text>
              </>
            )}
          </View>
        )}

        {/* Report Issue Button */}
        <TouchableOpacity 
          style={styles.reportButton}
          onPress={handleReportIssue}
          activeOpacity={0.7}
        >
          <Text style={styles.reportButtonText}>Report an issue / Request SOP update</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  contentContainerLarge: {
    paddingHorizontal: 24,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardContainerLarge: {
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  optionalText: {
    color: COLORS.textSecondary,
    fontWeight: '400',
    fontStyle: 'italic',
  },
  pickerWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    overflow: 'hidden',
    minHeight: 48,
    justifyContent: 'center',
    position: 'relative',
  },
  picker: {
    height: 48,
    width: '100%',
    color: COLORS.textPrimary,
  },
  pickerIcon: {
    position: 'absolute',
    right: 12,
    top: 15,
    pointerEvents: 'none',
  },
  loadingPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  loadingPickerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  activeSopSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  sopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sopRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  sopTypeTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 50,
    alignItems: 'center',
  },
  stateTag: {
    backgroundColor: '#DBEAFE',
  },
  orgTag: {
    backgroundColor: '#E0E7FF',
  },
  sopTypeTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E40AF',
    letterSpacing: 0.5,
  },
  sopInfo: {
    flex: 1,
  },
  sopLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  sopStatus: {
    fontSize: 13,
  },
  sopStatusAssigned: {
    color: '#059669',
  },
  sopStatusMissing: {
    color: '#D97706',
  },
  sopStatusNone: {
    color: '#9CA3AF',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  viewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  statusBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeNeutral: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  statusSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 8,
    marginBottom: 20,
  },
  statusSummaryActive: {
    backgroundColor: '#ECFDF5',
  },
  statusSummaryInactive: {
    backgroundColor: '#F3F4F6',
  },
  statusSummaryTextActive: {
    fontSize: 13,
    color: '#065F46',
    flex: 1,
    lineHeight: 18,
  },
  statusSummaryTextInactive: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
    lineHeight: 18,
  },
  reportButton: {
    backgroundColor: '#F0F4F8',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E4E8',
  },
  reportButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
});

export default SopScreen;
