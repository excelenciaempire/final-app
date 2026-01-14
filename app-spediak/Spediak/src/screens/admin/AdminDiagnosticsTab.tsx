import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl
} from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import axios from 'axios';
import { BASE_URL } from '../../config/api';
import { COLORS } from '../../styles/colors';
import { 
  Activity, 
  Database, 
  Users, 
  FileText, 
  Building, 
  History, 
  Shield, 
  Image,
  RefreshCcw,
  CheckCircle,
  AlertCircle
} from 'lucide-react-native';

interface DiagnosticsData {
  adminName: string;
  demoMode: string;
  stateSopAssignments: number;
  orgSopAssignments: number;
  sopHistoryEntries: number;
  usersStored: number;
  adminAuditEvents: number;
  adsInInventory: number;
  adsEnabled: number;
  knowledgeDocuments: number;
  activePromotions: number;
}

const AdminDiagnosticsTab: React.FC = () => {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDiagnostics = useCallback(async () => {
    try {
      setError(null);
      const token = await getToken();
      if (!token) {
        setError('Not authenticated');
        setIsLoading(false);
        return;
      }

      const response = await axios.get(`${BASE_URL}/api/admin/diagnostics`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000
      });

      setDiagnostics({
        adminName: user?.fullName || user?.emailAddresses?.[0]?.emailAddress || 'Admin',
        demoMode: 'Production',
        ...response.data
      });
    } catch (err: any) {
      console.error('Error fetching diagnostics:', err);
      setError(err.response?.data?.message || 'Failed to load diagnostics');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [getToken, user]);

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDiagnostics();
  };

  const StatRow = ({ icon: Icon, label, value, color = COLORS.primary }: { 
    icon: any; 
    label: string; 
    value: string | number; 
    color?: string 
  }) => (
    <View style={styles.statRow}>
      <View style={styles.statIconContainer}>
        <Icon size={18} color={color} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading diagnostics...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Activity size={24} color={COLORS.primary} />
          <Text style={styles.headerTitle}>Admin Diagnostics</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          System health and configuration status
        </Text>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <RefreshCcw size={16} color={COLORS.primary} />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorCard}>
          <AlertCircle size={20} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {diagnostics && (
        <>
          {/* Admin Info */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Admin Session</Text>
            <StatRow icon={Shield} label="Admin name:" value={diagnostics.adminName} />
            <StatRow 
              icon={CheckCircle} 
              label="Demo mode:" 
              value={diagnostics.demoMode} 
              color="#059669" 
            />
          </View>

          {/* SOP Statistics */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SOP Configuration</Text>
            <StatRow icon={FileText} label="State SOP assignments:" value={diagnostics.stateSopAssignments} />
            <StatRow icon={Building} label="Org SOP assignments:" value={diagnostics.orgSopAssignments} />
            <StatRow icon={History} label="SOP history entries:" value={diagnostics.sopHistoryEntries} />
          </View>

          {/* User Statistics */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>User Data</Text>
            <StatRow icon={Users} label="Users stored:" value={diagnostics.usersStored} />
            <StatRow icon={Shield} label="Admin audit events:" value={diagnostics.adminAuditEvents} />
          </View>

          {/* Content Statistics */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Content & Ads</Text>
            <StatRow 
              icon={Image} 
              label="Ads in inventory:" 
              value={`${diagnostics.adsInInventory} (${diagnostics.adsEnabled} enabled)`} 
            />
            <StatRow icon={FileText} label="Knowledge documents:" value={diagnostics.knowledgeDocuments} />
            <StatRow icon={Activity} label="Active promotions:" value={diagnostics.activePromotions} />
          </View>

          {/* System Status */}
          <View style={styles.statusCard}>
            <CheckCircle size={20} color="#059669" />
            <Text style={styles.statusText}>All systems operational</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  refreshButtonText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statIconContainer: {
    width: 28,
    alignItems: 'center',
  },
  statLabel: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    flex: 1,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  statusText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default AdminDiagnosticsTab;
