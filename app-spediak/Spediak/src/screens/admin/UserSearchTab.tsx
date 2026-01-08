import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  ActivityIndicator, 
  useWindowDimensions,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@clerk/clerk-expo';
import axios from 'axios';
import { BASE_URL } from '../../config/api';
import { COLORS } from '../../styles/colors';
import { 
  Search, 
  User, 
  Shield, 
  CreditCard, 
  MessageSquare, 
  History, 
  RefreshCcw,
  X,
  ChevronDown,
  Check
} from 'lucide-react-native';

interface LoadedUser {
  id: number;
  clerk_id: string;
  email: string;
  name?: string;
  role?: string;
  plan_type?: string;
  statements_used?: number;
  statements_limit?: number;
  subscription_status?: string;
  is_active?: boolean;
  is_suspended?: boolean;
  created_at?: string;
  last_login?: string;
  updated_at?: string;
}

// Support tag options
const SUPPORT_TAG_OPTIONS = [
  { key: 'vip', label: 'VIP' },
  { key: 'beta_tester', label: 'Beta tester' },
  { key: 'fraud_risk', label: 'Fraud risk' },
  { key: 'chargeback_risk', label: 'Chargeback risk' },
];

const UserSearchTab: React.FC = () => {
  const { getToken } = useAuth();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  // User Search State
  const [searchEmail, setSearchEmail] = useState('');
  const [loadedUser, setLoadedUser] = useState<LoadedUser | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Admin Notes State
  const [adminNotes, setAdminNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Roles & Security State
  const [userRole, setUserRole] = useState('standard');
  const [twoFARequirement, setTwoFARequirement] = useState('off');
  const [isSuspended, setIsSuspended] = useState(false);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);

  // Usage & Billing State
  const [statementEvents, setStatementEvents] = useState<any[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Support Workflow State
  const [supportTags, setSupportTags] = useState<Record<string, boolean>>({
    vip: false,
    beta_tester: false,
    fraud_risk: false,
    chargeback_risk: false,
  });
  const [supportNotes, setSupportNotes] = useState('');
  const [isSavingSupport, setIsSavingSupport] = useState(false);

  // Audit Trail State
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Action loading states
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Search user by email
  const handleSearchUser = useCallback(async () => {
    if (!searchEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    setIsSearching(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/api/admin/search-user`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { email: searchEmail.trim() }
      });

      if (response.data.user) {
        const user = response.data.user;
        setLoadedUser(user);
        
        // Set initial values
        setUserRole(user.role || 'standard');
        setAdminNotes(user.admin_notes || '');
        setSupportNotes(user.support_notes || '');
        
        // Load related data
        loadUserSecurityFlags(user.clerk_id);
        loadStatementEvents(user.clerk_id);
        loadAuditTrail(user.clerk_id);
        loadSupportTags(user.clerk_id);
      } else {
        Alert.alert('Not Found', 'No user found with that email address');
        handleClearUser();
      }
    } catch (error: any) {
      console.error('Error searching user:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to search user');
    } finally {
      setIsSearching(false);
    }
  }, [searchEmail, getToken]);

  // Clear loaded user
  const handleClearUser = () => {
    setLoadedUser(null);
    setAdminNotes('');
    setUserRole('standard');
    setTwoFARequirement('off');
    setIsSuspended(false);
    setStatementEvents([]);
    setSupportTags({ vip: false, beta_tester: false, fraud_risk: false, chargeback_risk: false });
    setSupportNotes('');
    setAuditEvents([]);
  };

  // Load security flags
  const loadUserSecurityFlags = async (userId: string) => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/api/admin/users/${userId}/security-flags`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const flags = response.data.flags || {};
      setUserRole(flags.role || flags.is_admin ? 'admin' : 'standard');
      setTwoFARequirement(flags.two_fa_required ? 'on' : 'off');
      setIsSuspended(flags.is_suspended || false);
    } catch (error) {
      console.log('Error loading security flags:', error);
    }
  };

  // Load support tags
  const loadSupportTags = async (userId: string) => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/api/admin/users/${userId}/tags`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const tags = response.data.tags || [];
      const tagMap: Record<string, boolean> = {
        vip: false,
        beta_tester: false,
        fraud_risk: false,
        chargeback_risk: false,
      };
      
      tags.forEach((tag: any) => {
        const key = tag.tag_name?.toLowerCase().replace(' ', '_');
        if (key in tagMap) {
          tagMap[key] = true;
        }
      });
      
      setSupportTags(tagMap);
    } catch (error) {
      console.log('Error loading support tags:', error);
    }
  };

  // Load statement events
  const loadStatementEvents = async (userId: string) => {
    setIsLoadingEvents(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/api/admin/users/${userId}/statement-events`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 10 }
      });
      
      setStatementEvents(response.data.events || []);
    } catch (error) {
      console.log('Error loading statement events:', error);
      setStatementEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  // Load audit trail
  const loadAuditTrail = async (userId: string) => {
    setIsLoadingAudit(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/api/admin/users/${userId}/audit-trail`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 20 }
      });
      
      setAuditEvents(response.data.events || []);
    } catch (error) {
      console.log('Error loading audit trail:', error);
      setAuditEvents([]);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  // Save admin notes
  const handleSaveNotes = async () => {
    if (!loadedUser) return;

    setIsSavingNotes(true);
    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/notes`, 
        { note: adminNotes },
        { headers: { Authorization: `Bearer ${token}` }}
      );

      Alert.alert('Success', 'Notes saved successfully');
      addLocalAuditEvent('Notes updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to save notes');
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Suspend user
  const handleSuspendUser = async () => {
    if (!loadedUser) return;

    Alert.alert('Confirm Suspend', 'Are you sure you want to suspend this user?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Suspend',
        style: 'destructive',
        onPress: async () => {
          setActionLoading('suspend');
          try {
            const token = await getToken();
            if (!token) return;

            await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/suspend`, {}, {
              headers: { Authorization: `Bearer ${token}` }
            });

            Alert.alert('Success', 'User suspended');
            addLocalAuditEvent('User suspended');
            handleSearchUser();
          } catch (error) {
            Alert.alert('Error', 'Failed to suspend user');
          } finally {
            setActionLoading(null);
          }
        }
      }
    ]);
  };

  // Reactivate user
  const handleReactivateUser = async () => {
    if (!loadedUser) return;

    setActionLoading('reactivate');
    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/reactivate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', 'User reactivated');
      addLocalAuditEvent('User reactivated');
      handleSearchUser();
    } catch (error) {
      Alert.alert('Error', 'Failed to reactivate user');
    } finally {
      setActionLoading(null);
    }
  };

  // Cancel subscription
  const handleCancelSubscription = async () => {
    if (!loadedUser) return;

    Alert.alert('Confirm Cancel', 'Are you sure you want to cancel this subscription?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          setActionLoading('cancel-sub');
          try {
            const token = await getToken();
            if (!token) return;

            await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/cancel-subscription`, {}, {
              headers: { Authorization: `Bearer ${token}` }
            });

            Alert.alert('Success', 'Subscription cancelled');
            addLocalAuditEvent('Subscription cancelled');
            handleSearchUser();
          } catch (error) {
            Alert.alert('Error', 'Failed to cancel subscription');
          } finally {
            setActionLoading(null);
          }
        }
      }
    ]);
  };

  // Soft delete user
  const handleSoftDelete = async () => {
    if (!loadedUser) return;

    Alert.alert('Soft Delete', 'This will deactivate the user account. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete (soft)',
        style: 'destructive',
        onPress: async () => {
          setActionLoading('soft-delete');
          try {
            const token = await getToken();
            if (!token) return;

            await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/soft-delete`, {}, {
              headers: { Authorization: `Bearer ${token}` }
            });

            Alert.alert('Success', 'User soft deleted');
            addLocalAuditEvent('User soft deleted');
            handleClearUser();
          } catch (error) {
            Alert.alert('Error', 'Failed to soft delete user');
          } finally {
            setActionLoading(null);
          }
        }
      }
    ]);
  };

  // Hard delete user
  const handleHardDelete = async () => {
    if (!loadedUser) return;

    Alert.alert(
      'Permanent Delete',
      'WARNING: This will permanently delete the user and all their data. This cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'DELETE PERMANENTLY',
          style: 'destructive',
          onPress: async () => {
            setActionLoading('hard-delete');
            try {
              const token = await getToken();
              if (!token) return;

              await axios.delete(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}`, {
                headers: { Authorization: `Bearer ${token}` }
              });

              Alert.alert('Success', 'User permanently deleted');
              handleClearUser();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete user');
            } finally {
              setActionLoading(null);
            }
          }
        }
      ]
    );
  };

  // Save role/security
  const handleSaveRoleSecurity = async () => {
    if (!loadedUser) return;

    setIsSavingSecurity(true);
    try {
      const token = await getToken();
      if (!token) return;

      await axios.put(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/security-flags`, {
        role: userRole,
        two_fa_required: twoFARequirement === 'on'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', 'Role & security saved');
      addLocalAuditEvent(`Role changed to ${userRole}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to save role/security');
    } finally {
      setIsSavingSecurity(false);
    }
  };

  // Force logout
  const handleForceLogout = async () => {
    if (!loadedUser) return;

    setActionLoading('force-logout');
    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/force-logout`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', 'User sessions terminated');
      addLocalAuditEvent('Force logout executed');
    } catch (error) {
      Alert.alert('Error', 'Failed to force logout');
    } finally {
      setActionLoading(null);
    }
  };

  // Force password reset
  const handleForcePasswordReset = async () => {
    if (!loadedUser) return;

    setActionLoading('force-password');
    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/force-password-reset`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', 'Password reset email sent');
      addLocalAuditEvent('Password reset forced');
    } catch (error) {
      Alert.alert('Error', 'Failed to force password reset');
    } finally {
      setActionLoading(null);
    }
  };

  // Reset monthly usage
  const handleResetMonthlyUsage = async () => {
    if (!loadedUser) return;

    setActionLoading('reset-usage');
    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/reset-usage`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', 'Monthly usage reset');
      addLocalAuditEvent('Monthly usage reset');
      handleSearchUser();
    } catch (error) {
      Alert.alert('Error', 'Failed to reset usage');
    } finally {
      setActionLoading(null);
    }
  };

  // Grant trial
  const handleGrantTrial = async () => {
    if (!loadedUser) return;

    setActionLoading('grant-trial');
    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/grant-trial`, 
        { days: 30 },
        { headers: { Authorization: `Bearer ${token}` }}
      );

      Alert.alert('Success', '30-day trial granted');
      addLocalAuditEvent('Trial granted (30 days)');
      handleSearchUser();
    } catch (error) {
      Alert.alert('Error', 'Failed to grant trial');
    } finally {
      setActionLoading(null);
    }
  };

  // Revoke trial
  const handleRevokeTrial = async () => {
    if (!loadedUser) return;

    setActionLoading('revoke-trial');
    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/revoke-trial`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', 'Trial revoked');
      addLocalAuditEvent('Trial revoked');
      handleSearchUser();
    } catch (error) {
      Alert.alert('Error', 'Failed to revoke trial');
    } finally {
      setActionLoading(null);
    }
  };

  // Record statement event
  const handleRecordStatementEvent = async () => {
    if (!loadedUser) return;

    setActionLoading('record-event');
    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/record-statement`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', 'Statement event recorded (+1)');
      addLocalAuditEvent('Statement event recorded');
      handleSearchUser();
      loadStatementEvents(loadedUser.clerk_id);
    } catch (error) {
      Alert.alert('Error', 'Failed to record event');
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle support tag
  const handleToggleSupportTag = (tagKey: string) => {
    setSupportTags(prev => ({
      ...prev,
      [tagKey]: !prev[tagKey]
    }));
  };

  // Save support info
  const handleSaveSupportInfo = async () => {
    if (!loadedUser) return;

    setIsSavingSupport(true);
    try {
      const token = await getToken();
      if (!token) return;

      // Save tags
      await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/support-info`, {
        tags: supportTags,
        notes: supportNotes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', 'Support info saved');
      addLocalAuditEvent('Support info updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to save support info');
    } finally {
      setIsSavingSupport(false);
    }
  };

  // Enter read-only impersonation
  const handleEnterImpersonation = async () => {
    if (!loadedUser) return;
    Alert.alert('Impersonation', 'Read-only impersonation mode would be activated here. (Feature in development)');
    addLocalAuditEvent('Impersonation started');
  };

  // Exit impersonation
  const handleExitImpersonation = async () => {
    Alert.alert('Info', 'Exiting impersonation mode. (Feature in development)');
    addLocalAuditEvent('Impersonation ended');
  };

  // Refresh audit
  const handleRefreshAudit = () => {
    if (loadedUser) {
      loadAuditTrail(loadedUser.clerk_id);
    }
  };

  // Add audit event locally (will be synced when action is performed on backend)
  const addLocalAuditEvent = (action: string) => {
    const newEvent = {
      id: Date.now(),
      action_type: action,
      created_at: new Date().toISOString(),
      admin_name: 'Current Admin'
    };
    setAuditEvents(prev => [newEvent, ...prev]);
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* ==================== USER SEARCH ==================== */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>User Search</Text>
        <Text style={styles.cardDescription}>
          Find and manage any user account. All changes are logged for audit compliance.
        </Text>

        <Text style={styles.label}>Search by email</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, styles.searchInput]}
            placeholder="chipspra@gmail.com"
            value={searchEmail}
            onChangeText={setSearchEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#9CA3AF"
          />
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]} 
            onPress={handleSearchUser}
            disabled={isSearching}
          >
            {isSearching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Search</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.outlineButton]} 
            onPress={handleClearUser}
          >
            <Text style={styles.outlineButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* User Info Display */}
        {loadedUser && (
          <View style={styles.userInfoSection}>
            <View style={styles.userInfoHeader}>
              <View>
                <Text style={styles.userEmail}>{loadedUser.email}</Text>
                <Text style={styles.userMeta}>
                  Role: {userRole} | Plan: {loadedUser.plan_type || 'free'} | Subscription: {loadedUser.subscription_status || 'none'}
                </Text>
              </View>
              <View style={[
                styles.statusBadge, 
                isSuspended ? styles.suspendedBadge : (loadedUser.is_active !== false ? styles.activeBadge : styles.inactiveBadge)
              ]}>
                <Text style={styles.statusBadgeText}>
                  {isSuspended ? 'SUSPENDED' : (loadedUser.is_active !== false ? 'ACTIVE' : 'INACTIVE')}
                </Text>
              </View>
            </View>

            <View style={styles.userDates}>
              <Text style={styles.userDateRow}>Created: {formatDate(loadedUser.created_at)}</Text>
              <Text style={styles.userDateRow}>Last login: {formatDate(loadedUser.last_login)}</Text>
              <Text style={styles.userDateRow}>Updated: {formatDate(loadedUser.updated_at)}</Text>
            </View>

            {/* Admin Notes */}
            <Text style={styles.label}>Admin notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Internal notes (support context, billing notes, policy flags, etc.)"
              value={adminNotes}
              onChangeText={setAdminNotes}
              multiline
              numberOfLines={4}
              placeholderTextColor="#9CA3AF"
            />

            {/* Action Buttons */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.underlineButton]} 
                onPress={handleSaveNotes}
                disabled={isSavingNotes}
              >
                <Text style={styles.underlineButtonText}>
                  {isSavingNotes ? 'Saving...' : 'Save notes'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, styles.underlineButton]} 
                onPress={handleSuspendUser}
                disabled={actionLoading === 'suspend'}
              >
                <Text style={styles.underlineButtonText}>Suspend</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, styles.underlineButton]} 
                onPress={handleReactivateUser}
                disabled={actionLoading === 'reactivate'}
              >
                <Text style={styles.underlineButtonText}>Reactivate</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, styles.underlineButton]} 
                onPress={handleCancelSubscription}
                disabled={actionLoading === 'cancel-sub'}
              >
                <Text style={styles.underlineButtonText}>Cancel subscription</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.deleteButtonsRow}>
              <TouchableOpacity 
                style={[styles.deleteButton, styles.softDeleteButton]} 
                onPress={handleSoftDelete}
                disabled={actionLoading === 'soft-delete'}
              >
                <Text style={styles.deleteButtonText}>Delete (soft)</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteButton, styles.hardDeleteButton]} 
                onPress={handleHardDelete}
                disabled={actionLoading === 'hard-delete'}
              >
                <Text style={styles.deleteButtonText}>Delete (hard)</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ==================== ROLES & SECURITY ==================== */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Roles & Security</Text>
        <Text style={styles.cardDescription}>
          Manage access flags and security controls for the selected user.
        </Text>

        {loadedUser ? (
          <View>
            <View style={styles.pickerRow}>
              <View style={styles.pickerField}>
                <Text style={styles.label}>Role</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={userRole}
                    onValueChange={setUserRole}
                    style={styles.picker}
                  >
                    <Picker.Item label="standard" value="standard" />
                    <Picker.Item label="admin" value="admin" />
                    <Picker.Item label="moderator" value="moderator" />
                    <Picker.Item label="support" value="support" />
                  </Picker>
                  <ChevronDown size={18} color={COLORS.textSecondary} style={styles.pickerIcon} />
                </View>
              </View>

              <View style={styles.pickerField}>
                <Text style={styles.label}>2FA requirement</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={twoFARequirement}
                    onValueChange={setTwoFARequirement}
                    style={styles.picker}
                  >
                    <Picker.Item label="off" value="off" />
                    <Picker.Item label="on" value="on" />
                  </Picker>
                  <ChevronDown size={18} color={COLORS.textSecondary} style={styles.pickerIcon} />
                </View>
              </View>
            </View>

            <View style={styles.securityButtonsRow}>
              <TouchableOpacity 
                style={[styles.button, styles.primaryButton]} 
                onPress={handleSaveRoleSecurity}
                disabled={isSavingSecurity}
              >
                <Text style={styles.buttonText}>
                  {isSavingSecurity ? 'Saving...' : 'Save role/security'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.outlineButton]} 
                onPress={handleForceLogout}
                disabled={actionLoading === 'force-logout'}
              >
                <Text style={styles.outlineButtonText}>Force logout</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.outlineButton]} 
                onPress={handleForcePasswordReset}
                disabled={actionLoading === 'force-password'}
              >
                <Text style={styles.outlineButtonText}>Force password reset</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.statusText}>No changes yet.</Text>
          </View>
        ) : (
          <Text style={styles.loadUserPrompt}>Load a user to manage roles and security.</Text>
        )}
      </View>

      {/* ==================== USAGE & BILLING ==================== */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Usage & Billing</Text>
        <Text style={styles.cardDescription}>
          Monitor usage limits and manage subscription status. All changes are synced to the database.
        </Text>

        {loadedUser ? (
          <View>
            <View style={styles.usageInfo}>
              <Text style={styles.usageRow}>Plan: <Text style={styles.usageValue}>{loadedUser.plan_type || 'free'}</Text></Text>
              <Text style={styles.usageRow}>Plan limit: <Text style={styles.usageValue}>{loadedUser.statements_limit || 5} statements / month</Text></Text>
              <Text style={styles.usageRow}>Statements used: <Text style={styles.usageValue}>{loadedUser.statements_used || 0}</Text></Text>
              <Text style={styles.usageRow}>Subscription status: <Text style={styles.usageValue}>{loadedUser.subscription_status || 'none'}</Text></Text>
            </View>

            <View style={styles.usageButtonsRow}>
              <TouchableOpacity 
                style={[styles.button, styles.outlineButton, styles.smallButton]} 
                onPress={handleResetMonthlyUsage}
                disabled={actionLoading === 'reset-usage'}
              >
                <Text style={styles.outlineButtonText}>Reset monthly usage</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.outlineButton, styles.smallButton]} 
                onPress={handleGrantTrial}
                disabled={actionLoading === 'grant-trial'}
              >
                <Text style={styles.outlineButtonText}>Grant trial (30)</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.outlineButton, styles.smallButton]} 
                onPress={handleRevokeTrial}
                disabled={actionLoading === 'revoke-trial'}
              >
                <Text style={styles.outlineButtonText}>Revoke trial</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.primaryButton, styles.smallButton]} 
                onPress={handleRecordStatementEvent}
                disabled={actionLoading === 'record-event'}
              >
                <Text style={styles.buttonText}>Record statement event (+1)</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.eventsSection}>
              <Text style={styles.eventsTitle}>Last 10 statement generations</Text>
              {isLoadingEvents ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : statementEvents.length > 0 ? (
                statementEvents.map((event, idx) => (
                  <Text key={idx} style={styles.eventItem}>
                    • {formatDate(event.created_at)} - Statement generated
                  </Text>
                ))
              ) : (
                <Text style={styles.noEventsText}>No statement events recorded.</Text>
              )}
            </View>
          </View>
        ) : (
          <Text style={styles.loadUserPrompt}>Load a user to view usage and billing.</Text>
        )}
      </View>

      {/* ==================== SUPPORT WORKFLOW ==================== */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Support Workflow</Text>
        <Text style={styles.cardDescription}>
          Tags and support notes help your team handle billing issues, beta users, fraud checks, etc.
        </Text>

        {loadedUser ? (
          <View>
            {/* Tag Checkboxes */}
            <View style={styles.tagsCheckboxRow}>
              {SUPPORT_TAG_OPTIONS.map(tag => (
                <TouchableOpacity 
                  key={tag.key}
                  style={styles.checkboxItem}
                  onPress={() => handleToggleSupportTag(tag.key)}
                >
                  <View style={[styles.checkbox, supportTags[tag.key] && styles.checkboxChecked]}>
                    {supportTags[tag.key] && <Check size={12} color="#fff" />}
                  </View>
                  <Text style={styles.checkboxLabel}>{tag.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Support Notes */}
            <Text style={styles.label}>Support notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Support context, timeline, billing notes, escalation reasons..."
              value={supportNotes}
              onChangeText={setSupportNotes}
              multiline
              numberOfLines={4}
              placeholderTextColor="#9CA3AF"
            />

            <View style={styles.supportButtonsRow}>
              <TouchableOpacity 
                style={[styles.button, styles.primaryButton]} 
                onPress={handleSaveSupportInfo}
                disabled={isSavingSupport}
              >
                <Text style={styles.buttonText}>
                  {isSavingSupport ? 'Saving...' : 'Save support info'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.outlineButton]} 
                onPress={handleEnterImpersonation}
              >
                <Text style={styles.outlineButtonText}>Enter read-only impersonation</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.outlineButton]} 
                onPress={handleExitImpersonation}
              >
                <Text style={styles.outlineButtonText}>Exit impersonation</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.statusText}>No changes yet.</Text>
          </View>
        ) : (
          <Text style={styles.loadUserPrompt}>Load a user to manage support workflow.</Text>
        )}
      </View>

      {/* ==================== AUDIT TRAIL ==================== */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Audit Trail</Text>
        <Text style={styles.cardDescription}>
          Track all administrative actions performed on this user for compliance and accountability.
        </Text>

        <View style={styles.auditButtonsRow}>
          <TouchableOpacity 
            style={[styles.button, styles.outlineButton]} 
            onPress={handleRefreshAudit}
          >
            <RefreshCcw size={16} color={COLORS.textPrimary} />
            <Text style={styles.outlineButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {isLoadingAudit ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : auditEvents.length > 0 ? (
          <View style={styles.auditList}>
            {auditEvents.slice(0, 10).map((event, idx) => (
              <View key={event.id || idx} style={styles.auditItem}>
                <Text style={styles.auditAction}>{event.action_type}</Text>
                <Text style={styles.auditDate}>{formatDate(event.created_at)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noAuditText}>No audit events recorded.</Text>
        )}
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E3A5F',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 18,
  },
  label: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
    minHeight: 48,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: 1,
    minWidth: 200,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
  },
  primaryButton: {
    backgroundColor: '#0B2455',
  },
  outlineButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  dangerOutlineButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  outlineButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  dangerOutlineButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
  },
  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  userInfoSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
  },
  userInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  userMeta: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  activeBadge: {
    backgroundColor: '#DCFCE7',
  },
  inactiveBadge: {
    backgroundColor: '#FEE2E2',
  },
  suspendedBadge: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  userDates: {
    marginBottom: 16,
  },
  userDateRow: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  underlineButton: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  underlineButtonText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  deleteButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  softDeleteButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  hardDeleteButton: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#DC2626',
    textDecorationLine: 'underline',
  },
  loadUserPrompt: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  pickerField: {
    flex: 1,
    minWidth: 150,
  },
  pickerContainer: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  picker: {
    height: 48,
    color: '#1F2937',
  },
  pickerIcon: {
    position: 'absolute',
    right: 12,
    top: 15,
    pointerEvents: 'none',
  },
  securityButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  statusText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 12,
    fontStyle: 'italic',
  },
  usageInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  usageRow: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  usageValue: {
    fontWeight: '600',
    color: '#1F2937',
  },
  usageButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  eventsSection: {
    marginTop: 8,
  },
  eventsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  eventItem: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  noEventsText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  tagsCheckboxRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#1E3A5F',
    borderColor: '#1E3A5F',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#374151',
  },
  supportButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  auditButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  auditList: {
    gap: 8,
  },
  auditItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 6,
  },
  auditAction: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  auditDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  noAuditText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
});

export default UserSearchTab;
