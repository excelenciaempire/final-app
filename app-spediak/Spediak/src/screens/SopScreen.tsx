import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useGlobalState, US_STATES, ORGANIZATION_OPTIONS } from '../context/GlobalStateContext';
import { useAuth, useUser } from '@clerk/clerk-expo';
import axios from 'axios';
import { BASE_URL } from '../config/api';
import { COLORS } from '../styles/colors';
import { FileText, ExternalLink, CheckCircle, AlertCircle, ChevronDown, Check } from 'lucide-react-native';
import AdBanner from '../components/AdBanner';
import StatementUsageCard from '../components/StatementUsageCard';

const SopScreen: React.FC = () => {
  const { selectedState, setSelectedState, selectedOrganizations, setSelectedOrganizations } = useGlobalState();
  const { getToken } = useAuth();
  const { user } = useUser();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 600;

  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);
  const [hasOrgChanges, setHasOrgChanges] = useState(false);
  const [isSavingOrgs, setIsSavingOrgs] = useState(false);
  const [activeStateSop, setActiveStateSop] = useState<any>(null);
  const [activeOrgSops, setActiveOrgSops] = useState<any[]>([]);
  const [isStateExcluded, setIsStateExcluded] = useState(false);
  const [isLoadingSop, setIsLoadingSop] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [dataReady, setDataReady] = useState(false);

  // Refs to prevent infinite loops and track state
  const initialLoadDone = useRef(false);
  const isInitializing = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchParams = useRef<string>('');

  // Load user's organizations from backend on mount
  useEffect(() => {
    const loadOrgsFromBackend = async () => {
      if (!isInitializing.current) return;

      try {
        const token = await getToken();
        if (token) {
          const response = await axios.get(`${BASE_URL}/api/user/profile`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000
          });

          const orgsData = response.data.profile?.organizations;
          if (Array.isArray(orgsData) && orgsData.length > 0) {
            setSelectedOrgs(orgsData);
          } else if (response.data.profile?.organization && response.data.profile.organization !== 'None') {
            setSelectedOrgs([response.data.profile.organization]);
          } else if (selectedOrganizations.length > 0) {
            setSelectedOrgs(selectedOrganizations);
          }
        }
      } catch (err) {
        // Fallback to global context
        if (selectedOrganizations.length > 0) {
          setSelectedOrgs(selectedOrganizations);
        }
      }

      isInitializing.current = false;
    };

    loadOrgsFromBackend();
  }, [getToken]);

  // Keep selectedOrgs in sync with global context when profile is updated elsewhere
  useEffect(() => {
    if (!isInitializing.current && selectedOrganizations.length > 0 && !hasOrgChanges) {
      setSelectedOrgs(selectedOrganizations);
    }
  }, [selectedOrganizations]);

  // Toggle an org in the selection
  const handleToggleOrg = (orgValue: string) => {
    setSelectedOrgs(prev => {
      const next = prev.includes(orgValue)
        ? prev.filter(o => o !== orgValue)
        : [...prev, orgValue];
      setHasOrgChanges(true);
      return next;
    });
  };

  // Save org selection to backend and sync global context
  const handleSaveOrgs = async () => {
    setIsSavingOrgs(true);
    try {
      const token = await getToken();
      if (token) {
        await axios.put(`${BASE_URL}/api/user/profile`, {
          organizations: selectedOrgs,
          organization: selectedOrgs[0] || null,
        }, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        });
      }
      // Sync global context
      setSelectedOrganizations(selectedOrgs);
      setHasOrgChanges(false);
      // Refetch SOP data with updated orgs
      lastFetchParams.current = '';
      fetchSopData(selectedState, selectedOrgs);
    } catch (err) {
      console.error('[SopScreen] Error saving organizations:', err);
      if (Platform.OS === 'web') {
        alert('Failed to save organization changes. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to save organization changes. Please try again.');
      }
    } finally {
      setIsSavingOrgs(false);
    }
  };

  // Fetch SOP data - accepts array of orgs for multi-org support
  const fetchSopData = useCallback(async (state: string | null, orgs: string[], retryCount = 0) => {
    if (!state) {
      setDataReady(true);
      return;
    }

    const validOrgs = orgs.filter(o => o && o !== 'None');
    const fetchKey = `${state}-${validOrgs.join(',')}`;
    if (fetchKey === lastFetchParams.current && dataReady) {
      return;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setIsLoadingSop(true);
      setLoadingMessage('Loading SOP data...');

      const slowLoadTimer = setTimeout(() => {
        setLoadingMessage('Server starting up, please wait...');
      }, 5000);

      const token = await getToken();

      if (!token) {
        clearTimeout(slowLoadTimer);
        setIsLoadingSop(false);
        setDataReady(true);
        return;
      }

      const params: any = { state };
      if (validOrgs.length > 0) {
        params.organizations = validOrgs.join(',');
      }

      const response = await axios.get(`${BASE_URL}/api/sop/active`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
        timeout: 30000,
        signal: abortControllerRef.current.signal
      });

      clearTimeout(slowLoadTimer);
      lastFetchParams.current = fetchKey;
      setActiveStateSop(response.data.stateSop);
      setActiveOrgSops(response.data.orgSops || []);
      setIsStateExcluded(response.data.isStateExcluded || false);
      setDataReady(true);
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;

      console.error('Error fetching SOP data:', err?.message);
      if (retryCount < 1 && err?.code === 'ECONNABORTED') {
        setLoadingMessage('Retrying connection...');
        setTimeout(() => fetchSopData(state, orgs, retryCount + 1), 3000);
        return;
      }
      setActiveStateSop(null);
      setActiveOrgSops([]);
      setIsStateExcluded(false);
      setDataReady(true);
    } finally {
      setIsLoadingSop(false);
      setLoadingMessage('Loading...');
    }
  }, [getToken, dataReady]);

  // Fetch SOP data when state or selectedOrgs change (debounced)
  useEffect(() => {
    if (isInitializing.current) return;

    const debounceTimer = setTimeout(() => {
      fetchSopData(selectedState, selectedOrgs);
    }, 100);

    return () => {
      clearTimeout(debounceTimer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedState, selectedOrgs]);

  // Initial load after component mounts
  useEffect(() => {
    if (!initialLoadDone.current && selectedState) {
      initialLoadDone.current = true;
      const timer = setTimeout(() => {
        isInitializing.current = false;
        fetchSopData(selectedState, selectedOrgs);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [selectedState]);

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

  const hasStateSop = activeStateSop !== null;
  const hasAnyOrgSop = activeOrgSops.some(o => o.documentId !== null);

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
          Select your state and organizations to configure which Standards of Practice Spediak will use when generating DDID statements.
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

        {/* Organizations - Multi-select checkboxes */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Professional Organizations <Text style={styles.optionalText}>(optional)</Text></Text>
          <Text style={styles.fieldHint}>Select all organizations you belong to</Text>
          <View style={styles.organizationsContainer}>
            {ORGANIZATION_OPTIONS.map(org => {
              const isSelected = selectedOrgs.includes(org.value);
              return (
                <TouchableOpacity
                  key={org.value}
                  style={[styles.organizationChip, isSelected && styles.organizationChipSelected]}
                  onPress={() => handleToggleOrg(org.value)}
                  disabled={isSavingOrgs}
                >
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Check size={12} color="#fff" />}
                  </View>
                  <Text style={[styles.organizationChipText, isSelected && styles.organizationChipTextSelected]}>
                    {org.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedOrgs.length > 0 && (
            <Text style={styles.selectedOrgsText}>Selected: {selectedOrgs.join(', ')}</Text>
          )}
          {hasOrgChanges && (
            <TouchableOpacity
              style={[styles.saveOrgsButton, isSavingOrgs && styles.saveOrgsButtonDisabled]}
              onPress={handleSaveOrgs}
              disabled={isSavingOrgs}
            >
              {isSavingOrgs ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Check size={16} color="#fff" />
                  <Text style={styles.saveOrgsButtonText}>Save Organization Changes</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Active SOP Documents Section */}
        <View style={styles.activeSopSection}>
          <View style={styles.sectionHeader}>
            <FileText size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Active SOP Documents</Text>
          </View>

          {isLoadingSop ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>{loadingMessage}</Text>
            </View>
          ) : (
            <>
              {/* State SOP Row */}
              {!isStateExcluded && (
                <View style={styles.sopRow}>
                  <View style={styles.sopRowLeft}>
                    <View style={[styles.sopTypeTag, activeStateSop?.isDefault ? styles.defaultTag : styles.stateTag]}>
                      <Text style={styles.sopTypeTagText}>{activeStateSop?.isDefault ? 'DEFAULT' : 'STATE'}</Text>
                    </View>
                    <View style={styles.sopInfo}>
                      <Text style={styles.sopLabel}>{selectedState || 'NC'} SOP</Text>
                      <Text style={[styles.sopStatus, hasStateSop ? styles.sopStatusAssigned : styles.sopStatusMissing]}>
                        {hasStateSop ? `Using ${activeStateSop.documentName}` : 'Not assigned'}
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
              )}

              {/* Organization SOP Rows — one per selected org */}
              {selectedOrgs.length === 0 ? (
                <View style={styles.sopRow}>
                  <View style={styles.sopRowLeft}>
                    <View style={[styles.sopTypeTag, styles.orgTag]}>
                      <Text style={styles.sopTypeTagText}>ORG</Text>
                    </View>
                    <View style={styles.sopInfo}>
                      <Text style={styles.sopLabel}>Organization SOP</Text>
                      <Text style={[styles.sopStatus, styles.sopStatusNone]}>None selected</Text>
                    </View>
                  </View>
                  <View style={styles.statusBadgeNeutral}>
                    <Text style={styles.statusBadgeText}>—</Text>
                  </View>
                </View>
              ) : (
                activeOrgSops.map((orgEntry: any) => {
                  const hasSop = orgEntry.documentId !== null && orgEntry.documentName !== null;
                  return (
                    <View key={orgEntry.orgName} style={styles.sopRow}>
                      <View style={styles.sopRowLeft}>
                        <View style={[styles.sopTypeTag, styles.orgTag]}>
                          <Text style={styles.sopTypeTagText}>ORG</Text>
                        </View>
                        <View style={styles.sopInfo}>
                          <Text style={styles.sopLabel}>{orgEntry.orgName} SOP</Text>
                          <Text style={[styles.sopStatus, hasSop ? styles.sopStatusAssigned : styles.sopStatusMissing]}>
                            {hasSop ? `Using ${orgEntry.documentName}` : 'Not assigned'}
                          </Text>
                        </View>
                      </View>
                      {hasSop && orgEntry.fileUrl && (
                        <TouchableOpacity
                          style={styles.viewButton}
                          onPress={() => handleViewDocument(orgEntry.fileUrl, orgEntry.documentName)}
                        >
                          <ExternalLink size={16} color="#fff" />
                          <Text style={styles.viewButtonText}>View</Text>
                        </TouchableOpacity>
                      )}
                      {!hasSop && (
                        <View style={styles.statusBadge}>
                          <AlertCircle size={14} color="#F59E0B" />
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </>
          )}
        </View>

        {/* Status Summary */}
        {!isLoadingSop && dataReady && (
          <View style={[
            styles.statusSummary,
            (hasStateSop || hasAnyOrgSop) ? styles.statusSummaryActive : styles.statusSummaryInactive
          ]}>
            {(hasStateSop || hasAnyOrgSop) ? (
              <>
                <CheckCircle size={18} color="#10B981" />
                <Text style={styles.statusSummaryTextActive}>
                  {hasStateSop && hasAnyOrgSop
                    ? 'Statements will comply with State and Organization SOPs'
                    : hasStateSop
                      ? 'Statements will comply with State SOP'
                      : 'Statements will comply with Organization SOP'}
                </Text>
              </>
            ) : (
              <>
                <AlertCircle size={18} color="#6B7280" />
                <Text style={styles.statusSummaryTextInactive}>
                  {isStateExcluded
                    ? "No State SOP required for this state. Statements will use Spediak's general best-practice guidance."
                    : "No SOP configured. Statements will use Spediak's general best-practice guidance."}
                </Text>
              </>
            )}
          </View>
        )}

        {/* Support contact */}
        <Text style={styles.supportText}>
          Questions or SOP requests? Contact us at{' '}
          <Text style={styles.supportEmail}>support@spediak.com</Text>
        </Text>
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
    // @ts-ignore - Web-specific CSS for cross-browser compatibility (Chrome, Safari, Firefox)
    ...(Platform.OS === 'web' && {
      WebkitAppearance: 'none',
      MozAppearance: 'none',
      appearance: 'none',
      backgroundColor: 'transparent',
      border: 'none',
      outline: 'none',
      fontSize: 15,
      paddingLeft: 14,
      paddingRight: 36,
      cursor: 'pointer',
    }),
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
  serverStartingText: {
    fontSize: 12,
    color: '#F59E0B',
    textAlign: 'center',
    marginTop: 4,
  },
  fieldHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 10,
    marginTop: -4,
  },
  organizationsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  organizationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 4,
  },
  organizationChipSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: COLORS.primary,
  },
  organizationChipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 8,
    flexShrink: 1,
  },
  organizationChipTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  selectedOrgsText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  saveOrgsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 4,
  },
  saveOrgsButtonDisabled: {
    opacity: 0.6,
  },
  saveOrgsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
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
  defaultTag: {
    backgroundColor: '#D1FAE5',
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
  supportText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 20,
  },
  supportEmail: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default SopScreen;
