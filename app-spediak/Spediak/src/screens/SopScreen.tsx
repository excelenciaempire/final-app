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
import { FileText, Download, CheckSquare, Square, ExternalLink, AlertCircle } from 'lucide-react-native';
import AdBanner from '../components/AdBanner';

const ORGANIZATIONS = [
  { value: 'None', label: 'None / Not using organization SOP' },
  { value: 'ASHI', label: 'ASHI' },
  { value: 'InterNACHI', label: 'InterNACHI' },
];

const SopScreen: React.FC = () => {
  const { selectedState, setSelectedState } = useGlobalState();
  const { getToken } = useAuth();
  const { user } = useUser();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 600;
  
  const [organization, setOrganization] = useState<string>('None');
  const [useStateSop, setUseStateSop] = useState<boolean>(true);
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
        params,
        timeout: 10000
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
      {/* Ad Banner */}
      <View style={[styles.cardContainer, isLargeScreen && styles.cardContainerLarge]}>
        <Text style={styles.adBannerTitle}>Ad Banner</Text>
        <View style={styles.adBannerPlaceholder}>
          <Text style={styles.adBannerText}>
            SOP reference & compliance helper. Ad placeholder or educational banner here.
          </Text>
        </View>
      </View>

      {/* Main SOP Card */}
      <View style={[styles.cardContainer, isLargeScreen && styles.cardContainerLarge]}>
        <Text style={styles.title}>SOP or Organization</Text>
        <Text style={styles.description}>
          Select your state and (optionally) an organization SOP. Spediak will generate DDID statements that align with the active SOP sources.
        </Text>

        {/* State Selector */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Select state</Text>
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
          </View>
        </View>

        {/* Current State Display */}
        <Text style={styles.currentStateText}>Current state: <Text style={styles.currentStateValue}>{selectedState || 'NC'}</Text></Text>

        {/* Use State SOP Checkbox */}
        <TouchableOpacity 
          style={styles.checkboxRow}
          onPress={() => setUseStateSop(!useStateSop)}
          activeOpacity={0.7}
        >
          {useStateSop ? (
            <CheckSquare size={22} color={COLORS.primary} />
          ) : (
            <Square size={22} color={COLORS.textSecondary} />
          )}
          <Text style={styles.checkboxLabel}>Use State SOP (if assigned)</Text>
        </TouchableOpacity>

        {/* Organization Selector */}
        <View style={styles.fieldContainer}>
          <Text style={styles.labelSmall}>Organization SOP <Text style={styles.optionalText}>(optional)</Text>:</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={organization}
              onValueChange={(value) => setOrganization(value)}
              style={styles.picker}
              dropdownIconColor={COLORS.textSecondary}
            >
              {ORGANIZATIONS.map((org) => (
                <Picker.Item key={org.value} label={org.label} value={org.value} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Active SOP Sources Banner */}
        <View style={styles.activeSopBanner}>
          <View style={styles.activeSopBannerIcon}>
            <FileText size={18} color="#FFFFFF" />
          </View>
          <View style={styles.activeSopBannerContent}>
            <Text style={styles.activeSopBannerTitle}>ACTIVE SOP SOURCES</Text>
            <Text style={styles.activeSopBannerText}>
              {isLoading 
                ? 'Loading...' 
                : hasStateSop 
                  ? activeStateSop.documentName 
                  : 'No assigned State SOP yet'}
            </Text>
          </View>
        </View>

        {/* Downloads Section */}
        <View style={styles.downloadsSection}>
          <Text style={styles.downloadsSectionTitle}>Downloads</Text>
          
          {/* State SOP Download */}
          <View style={styles.downloadItem}>
            <View style={styles.downloadItemHeader}>
              <Text style={styles.downloadItemTitle}>State SOP</Text>
              {hasStateSop && activeStateSop.fileUrl && (
                <TouchableOpacity 
                  style={styles.downloadButton}
                  onPress={() => handleDownload(activeStateSop.fileUrl, activeStateSop.documentName)}
                >
                  <Download size={16} color={COLORS.primary} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.downloadItemStatus}>
              {hasStateSop ? activeStateSop.documentName : 'No State SOP assigned yet.'}
            </Text>
          </View>

          {/* Organization SOP Download */}
          <View style={styles.downloadItem}>
            <View style={styles.downloadItemHeader}>
              <Text style={styles.downloadItemTitle}>Organization SOP</Text>
              {hasOrgSop && activeOrgSop.fileUrl && (
                <TouchableOpacity 
                  style={styles.downloadButton}
                  onPress={() => handleDownload(activeOrgSop.fileUrl, activeOrgSop.documentName)}
                >
                  <Download size={16} color={COLORS.primary} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.downloadItemStatus}>
              {organization === 'None' 
                ? 'No organization selected.' 
                : hasOrgSop 
                  ? activeOrgSop.documentName 
                  : `No ${organization} SOP assigned yet.`}
            </Text>
          </View>
        </View>

        {/* Quick Reference Sample */}
        <View style={styles.quickReferenceSection}>
          <Text style={styles.quickReferenceTitle}>Quick reference sample</Text>
          <Text style={styles.quickReferenceText}>
            No State SOP assigned yet for {selectedState || 'NC'}. Quick reference sample will use general guidance until a state SOP is configured.
          </Text>
        </View>

        {/* Compliance Note */}
        <Text style={styles.complianceNote}>
          When both a State SOP and an Organization SOP are active, the AI will be expected to remain compliant with <Text style={styles.boldText}>both</Text> when generating inspection statements.
        </Text>

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
  adBannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  adBannerPlaceholder: {
    backgroundColor: '#F0F4F8',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  adBannerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
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
    marginBottom: 20,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  labelSmall: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  optionalText: {
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  pickerWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E4E8',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  currentStateText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  currentStateValue: {
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    paddingVertical: 4,
  },
  checkboxLabel: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '500',
  },
  activeSopBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 14,
    marginBottom: 20,
  },
  activeSopBannerIcon: {
    marginRight: 12,
  },
  activeSopBannerContent: {
    flex: 1,
  },
  activeSopBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  activeSopBannerText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  downloadsSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  downloadsSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  downloadItem: {
    marginBottom: 16,
  },
  downloadItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  downloadItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  downloadButton: {
    padding: 6,
  },
  downloadItemStatus: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  quickReferenceSection: {
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  quickReferenceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  quickReferenceText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  complianceNote: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  boldText: {
    fontWeight: '600',
    color: COLORS.textPrimary,
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
