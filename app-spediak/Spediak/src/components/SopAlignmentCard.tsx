import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Platform } from 'react-native';
import { useGlobalState } from '../context/GlobalStateContext';
import { useAuth, useUser } from '@clerk/clerk-expo';
import axios from 'axios';
import { BASE_URL } from '../config/api';
import { COLORS } from '../styles/colors';
import { FileText, Info } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppNavigation } from '../context/AppNavigationContext';
import { useSubscription } from '../context/SubscriptionContext';

interface ActiveSop {
  stateSop: { 
    documentName: string; 
    fileUrl?: string;
    isDefault?: boolean;
  } | null;
  orgSop: { 
    documentName: string; 
    fileUrl?: string;
  } | null;
}

const SopAlignmentCard: React.FC = () => {
  const { selectedState, selectedOrganization, setSelectedOrganization } = useGlobalState();
  const { getToken } = useAuth();
  const { user } = useUser();
  const navigation = useNavigation<any>();
  const { navigateTo, isWebDesktop } = useAppNavigation();
  const { subscription } = useSubscription();
  const [activeSops, setActiveSops] = useState<ActiveSop>({ stateSop: null, orgSop: null });
  const [isLoading, setIsLoading] = useState(false);
  const [localOrganization, setLocalOrganization] = useState<string | null>(null);
  
  // Check if user is on a paid plan (Pro or Platinum)
  const isPaidUser = subscription?.plan_type === 'pro' || subscription?.plan_type === 'platinum';
  const hasFetchedRef = useRef(false);
  const lastStateRef = useRef<string | null>(null);
  const lastOrgRef = useRef<string | null>(null);
  const hasLoadedOrgRef = useRef(false);

  // Load organization from backend profile if not already set
  useEffect(() => {
    const loadOrganizationFromBackend = async () => {
      if (hasLoadedOrgRef.current) return;
      if (selectedOrganization && selectedOrganization !== 'None') return;
      
      try {
        const token = await getToken();
        if (!token) return;
        
        const response = await axios.get(`${BASE_URL}/api/user/profile`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        });
        
        const savedOrg = response.data.profile?.organization;
        if (savedOrg && savedOrg !== 'None') {
          setLocalOrganization(savedOrg);
          setSelectedOrganization(savedOrg);
          console.log('[SopAlignmentCard] Loaded organization from backend:', savedOrg);
        }
        hasLoadedOrgRef.current = true;
      } catch (err) {
        console.log('[SopAlignmentCard] Could not load organization from backend');
        hasLoadedOrgRef.current = true;
      }
    };
    
    loadOrganizationFromBackend();
  }, [getToken, selectedOrganization, setSelectedOrganization]);

  // Use global context organization, local loaded, or fallback to user metadata
  const organization = selectedOrganization || localOrganization || user?.unsafeMetadata?.organization as string || null;

  useEffect(() => {
    // Only fetch if state/org changed or hasn't been fetched
    if (lastStateRef.current === selectedState && lastOrgRef.current === organization && hasFetchedRef.current) {
      return;
    }

    const fetchActiveSops = async () => {
      if (!selectedState) {
        setActiveSops({ stateSop: null, orgSop: null });
        return;
      }

      try {
        setIsLoading(true);
        const token = await getToken();
        
        if (!token) {
          setActiveSops({ stateSop: null, orgSop: null });
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

        setActiveSops({
          stateSop: response.data.stateSop ? {
            documentName: response.data.stateSop.documentName,
            fileUrl: response.data.stateSop.fileUrl,
            isDefault: response.data.stateSop.isDefault || false
          } : null,
          orgSop: response.data.orgSop ? {
            documentName: response.data.orgSop.documentName,
            fileUrl: response.data.orgSop.fileUrl
          } : null
        });
      } catch (err: any) {
        // Silently handle errors
        setActiveSops({ stateSop: null, orgSop: null });
      } finally {
        setIsLoading(false);
        hasFetchedRef.current = true;
        lastStateRef.current = selectedState;
        lastOrgRef.current = organization;
      }
    };

    fetchActiveSops();
  }, [selectedState, organization]);

  const handleConfigureClick = () => {
    // For web desktop, use app navigation context
    if (Platform.OS === 'web' && isWebDesktop) {
      navigateTo('SOP');
      return;
    }
    
    // For web mobile or native, use navigation or URL
    if (Platform.OS === 'web') {
      window.location.href = '/sop';
      return;
    }
    
    // For native, use React Navigation
    try {
      if (navigation && navigation.navigate) {
        navigation.navigate('SOP');
      }
    } catch (err) {
      console.error('Error navigating to SOP:', err);
    }
  };

  const hasStateSop = activeSops?.stateSop !== null;
  const hasOrgSop = activeSops?.orgSop !== null;
  const hasAnySop = hasStateSop || hasOrgSop;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <FileText size={20} color={COLORS.primary} />
          <Text style={styles.title}>SOP Alignment for Statements</Text>
        </View>
        {/* Gear icon removed as per user request */}
      </View>

      <Text style={styles.subtitle}>
        Your AI-generated statements will follow the active SOP sources shown below.
      </Text>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : (
        <>
          {/* Active SOP Sources Banner */}
          <View style={styles.sopBanner}>
            <View style={styles.sopBannerHeader}>
              <View style={[styles.statusDot, (hasAnySop || isPaidUser) ? styles.statusDotActive : styles.statusDotInactive]} />
              <Text style={styles.sopBannerTitle}>ACTIVE SOP SOURCES FOR STATEMENTS</Text>
            </View>
            
            {hasAnySop ? (
              <View style={styles.sopSourcesList}>
                {hasStateSop && (
                  <Text style={styles.sopSourceItem}>
                    • {activeSops.stateSop?.isDefault ? 'Default SOP' : `State SOP (${selectedState})`}: {activeSops.stateSop?.documentName}
                    {activeSops.stateSop?.isDefault && <Text style={styles.defaultBadge}> (InterNACHI)</Text>}
                  </Text>
                )}
                {hasOrgSop && (
                  <Text style={styles.sopSourceItem}>
                    • Organization SOP: {organization} - {activeSops.orgSop?.documentName}
                  </Text>
                )}
                {!hasOrgSop && organization && organization !== 'None' && (
                  <Text style={styles.sopSourceItem}>
                    • Organization: {organization} (no SOP document assigned)
                  </Text>
                )}
              </View>
            ) : isPaidUser ? (
              <View style={styles.sopSourcesList}>
                <Text style={styles.sopBannerText}>
                  Using Spediak's best-practice guidance for your statements.
                </Text>
                {organization && organization !== 'None' && (
                  <Text style={styles.sopSourceItem}>
                    • Your organization: {organization}
                  </Text>
                )}
              </View>
            ) : (
              <Text style={styles.sopBannerText}>
                No State or Organization SOP is currently active. Statements will follow general best-practice guidance only.
              </Text>
            )}
          </View>

          {/* Configure Link */}
          <Text style={styles.configureHint}>
            To change this, adjust SOP settings on the{' '}
            <Text 
              style={[styles.sopPageLink, Platform.OS === 'web' && { cursor: 'pointer' } as any]} 
              onPress={handleConfigureClick}
              accessibilityRole="link"
            >
              SOP page
            </Text>
            .
          </Text>
        </>
      )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  sopBanner: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  sopBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotActive: {
    backgroundColor: '#22C55E',
  },
  statusDotInactive: {
    backgroundColor: '#6B7280',
  },
  sopBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  sopBannerText: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  sopSourcesList: {
    gap: 4,
  },
  sopSourceItem: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 18,
  },
  defaultBadge: {
    color: '#22C55E',
    fontWeight: '600',
  },
  configureHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  sopPageLink: {
    color: '#DC2626',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
});

export default SopAlignmentCard;
