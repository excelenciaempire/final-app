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
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@clerk/clerk-expo';
import axios from 'axios';
import { BASE_URL } from '../../config/api';
import { COLORS } from '../../styles/colors';
import { useImpersonation } from '../../context/ImpersonationContext';
import { useAppNavigation } from '../../context/AppNavigationContext';
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
  Check,
  Eye
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
  const { isImpersonating, impersonatedUser, startImpersonation, endImpersonation } = useImpersonation();
  const { navigateTo, isWebDesktop } = useAppNavigation();

  // User Search State
  const [searchEmail, setSearchEmail] = useState('');
  const [loadedUser, setLoadedUser] = useState<LoadedUser | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Admin Notes State
  const [adminNotes, setAdminNotes] = useState('');
  const [adminNotesList, setAdminNotesList] = useState<any[]>([]);
  const [supportNotesList, setSupportNotesList] = useState<any[]>([]);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isDeletingNote, setIsDeletingNote] = useState<number | null>(null);

  // Roles & Security State
  const [userRole, setUserRole] = useState('standard');
  const [userPlanType, setUserPlanType] = useState('free');
  const [twoFARequirement, setTwoFARequirement] = useState('off');
  const [isSuspended, setIsSuspended] = useState(false);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

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

  // Statement Override State
  const [statementOverride, setStatementOverride] = useState<string>('');
  const [currentOverride, setCurrentOverride] = useState<number | null>(null);
  const [isSavingOverride, setIsSavingOverride] = useState(false);

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
        
        // Set initial values from search response
        setUserRole(user.role || (user.is_admin ? 'admin' : 'standard'));
        setUserPlanType(user.plan_type || 'free');
        setAdminNotes(user.admin_notes || '');
        setSupportNotes(user.support_notes || '');
        setIsSuspended(user.is_suspended || false);
        setTwoFARequirement(user.two_fa_required ? 'on' : 'off');
        
        // Load related data
        loadUserSecurityFlags(user.clerk_id);
        loadStatementEvents(user.clerk_id);
        loadAuditTrail(user.clerk_id);
        loadSupportTags(user.clerk_id);
        loadUserNotes(user.clerk_id);
        loadStatementOverride(user.clerk_id);
        
        console.log('[UserSearchTab] User loaded:', { 
          email: user.email, 
          role: user.role, 
          plan: user.plan_type,
          suspended: user.is_suspended 
        });
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
    setUserPlanType('free');
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
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });
      
      const flags = response.data.flags || {};
      // Use the role field from backend, or derive from is_admin
      const role = flags.role || (flags.is_admin ? 'admin' : 'standard');
      setUserRole(role);
      setTwoFARequirement(flags.two_fa_required ? 'on' : 'off');
      setIsSuspended(flags.is_suspended || false);
      
      console.log('[UserSearchTab] Loaded security flags:', { role, twoFA: flags.two_fa_required, suspended: flags.is_suspended });
    } catch (error) {
      console.log('Error loading security flags:', error);
      // Set defaults
      setUserRole('standard');
      setTwoFARequirement('off');
      setIsSuspended(false);
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

  // Load user notes (admin and support)
  const loadUserNotes = async (userId: string) => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/api/admin/users/${userId}/notes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const allNotes = response.data.notes || [];
      
      // Separate admin and support notes
      const adminNotes = allNotes.filter((n: any) => n.note_type === 'admin' || !n.note_type);
      const supportNotes = allNotes.filter((n: any) => n.note_type === 'support');
      
      setAdminNotesList(adminNotes);
      setSupportNotesList(supportNotes);
    } catch (error) {
      console.log('Error loading user notes:', error);
      setAdminNotesList([]);
      setSupportNotesList([]);
    }
  };

  // Delete a note
  const handleDeleteNote = async (noteId: number, noteType: string) => {
    if (!loadedUser) return;

    const doDelete = async () => {
      setIsDeletingNote(noteId);
      try {
        const token = await getToken();
        if (!token) return;

        await axios.delete(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/notes/${noteId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Remove from local state
        if (noteType === 'admin' || !noteType) {
          setAdminNotesList(prev => prev.filter(n => n.id !== noteId));
        } else {
          setSupportNotesList(prev => prev.filter(n => n.id !== noteId));
        }

        addLocalAuditEvent('Note deleted');
        // Refresh notes from backend
        if (loadedUser) {
          loadUserNotes(loadedUser.clerk_id);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to delete note');
      } finally {
        setIsDeletingNote(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this note?')) {
        doDelete();
      }
    } else {
      Alert.alert('Confirm Delete', 'Are you sure you want to delete this note?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete }
      ]);
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
    
    if (!adminNotes.trim()) {
      Alert.alert('Error', 'Please enter a note');
      return;
    }

    setIsSavingNotes(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/notes`, 
        { note: adminNotes, noteType: 'admin' },
        { headers: { Authorization: `Bearer ${token}` }}
      );

      // Add the new note to the list immediately
      const newNote = response.data.note || {
        id: Date.now(),
        note: adminNotes,
        note_type: 'admin',
        created_at: new Date().toISOString(),
        admin_email: user?.primaryEmailAddress?.emailAddress || 'Admin'
      };
      setAdminNotesList(prev => [newNote, ...prev]);
      
      // Clear input
      setAdminNotes('');
      
      addLocalAuditEvent('Admin note added');
      // Refresh notes from backend
      if (loadedUser) {
        loadUserNotes(loadedUser.clerk_id);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save note');
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Suspend user
  const handleSuspendUser = async () => {
    if (!loadedUser) return;

    const doSuspend = async () => {
      setActionLoading('suspend');
      try {
        const token = await getToken();
        if (!token) return;

        await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/suspend`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Update local state immediately
        setIsSuspended(true);
        setLoadedUser(prev => prev ? { ...prev, is_suspended: true } : null);
        
        if (Platform.OS === 'web') {
          alert('User suspended successfully. They will be blocked from accessing the app.');
        } else {
          Alert.alert('Success', 'User suspended. They will be blocked on their next API request.');
        }
        addLocalAuditEvent('User suspended', true);
      } catch (error: any) {
        console.error('Suspend error:', error);
        const errorMsg = error.response?.data?.message || 'Failed to suspend user';
        if (Platform.OS === 'web') {
          alert('Error: ' + errorMsg);
        } else {
          Alert.alert('Error', errorMsg);
        }
      } finally {
        setActionLoading(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to suspend this user? They will be blocked from accessing the app.')) {
        doSuspend();
      }
    } else {
      Alert.alert('Confirm Suspend', 'Are you sure you want to suspend this user? They will be blocked from accessing the app.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Suspend', style: 'destructive', onPress: doSuspend }
      ]);
    }
  };

  // Reactivate user
  const handleReactivateUser = async () => {
    if (!loadedUser) return;

    const doReactivate = async () => {
      setActionLoading('reactivate');
      try {
        const token = await getToken();
        if (!token) return;

        await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/reactivate`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Update local state immediately
        setIsSuspended(false);
        setLoadedUser(prev => prev ? { ...prev, is_suspended: false } : null);
        
        if (Platform.OS === 'web') {
          alert('User reactivated successfully. They can now access the app again.');
        } else {
          Alert.alert('Success', 'User reactivated. They can now access the app again.');
        }
        addLocalAuditEvent('User reactivated', true);
      } catch (error: any) {
        console.error('Reactivate error:', error);
        const errorMsg = error.response?.data?.message || 'Failed to reactivate user';
        if (Platform.OS === 'web') {
          alert('Error: ' + errorMsg);
        } else {
          Alert.alert('Error', errorMsg);
        }
      } finally {
        setActionLoading(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to reactivate this user?')) {
        doReactivate();
      }
    } else {
      Alert.alert('Confirm Reactivate', 'Are you sure you want to reactivate this user?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reactivate', onPress: doReactivate }
      ]);
    }
  };

  // Cancel subscription
  const handleCancelSubscription = async () => {
    if (!loadedUser) return;

    const doCancelSubscription = async () => {
      setActionLoading('cancel-sub');
      try {
        const token = await getToken();
        if (!token) return;

        await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/cancel-subscription`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (Platform.OS === 'web') {
          alert('Subscription cancelled successfully.');
        } else {
          Alert.alert('Success', 'Subscription cancelled');
        }
        addLocalAuditEvent('Subscription cancelled', true);
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || 'Failed to cancel subscription';
        if (Platform.OS === 'web') {
          alert('Error: ' + errorMsg);
        } else {
          Alert.alert('Error', errorMsg);
        }
      } finally {
        setActionLoading(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to cancel this subscription? The user will lose access to premium features.')) {
        doCancelSubscription();
      }
    } else {
      Alert.alert('Confirm Cancel', 'Are you sure you want to cancel this subscription?', [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', style: 'destructive', onPress: doCancelSubscription }
      ]);
    }
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

    const doSave = async () => {
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

        if (Platform.OS === 'web') {
          alert(`Role & security settings saved successfully.\nRole: ${userRole}\n2FA: ${twoFARequirement}`);
        } else {
          Alert.alert('Success', 'Role & security saved');
        }
        addLocalAuditEvent(`Role changed to ${userRole}`, true);
      } catch (error) {
        if (Platform.OS === 'web') {
          alert('Error: Failed to save role/security');
        } else {
          Alert.alert('Error', 'Failed to save role/security');
        }
      } finally {
        setIsSavingSecurity(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Save security settings?\n\nRole: ${userRole}\n2FA: ${twoFARequirement}`)) {
        doSave();
      }
    } else {
      Alert.alert('Confirm Save', `Save security settings?\n\nRole: ${userRole}\n2FA: ${twoFARequirement}`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save', onPress: doSave }
      ]);
    }
  };

  // Save plan type (independent of admin role)
  const handleSavePlanType = async () => {
    if (!loadedUser) return;

    const planLabel = userPlanType === 'free' ? 'Free (5 statements/month)' : 
                      userPlanType === 'pro' ? 'Pro (Unlimited)' : 'Platinum (Unlimited)';

    const doSave = async () => {
      setIsSavingPlan(true);
      try {
        const token = await getToken();
        if (!token) return;

        await axios.put(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/plan`, {
          plan_type: userPlanType
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (Platform.OS === 'web') {
          alert(`Subscription plan changed to ${planLabel}`);
        } else {
          Alert.alert('Success', `Plan changed to ${userPlanType}`);
        }
        addLocalAuditEvent(`Plan changed to ${userPlanType}`, true);
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || 'Failed to change plan';
        if (Platform.OS === 'web') {
          alert('Error: ' + errorMsg);
        } else {
          Alert.alert('Error', errorMsg);
        }
      } finally {
        setIsSavingPlan(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Change subscription plan to ${planLabel}?`)) {
        doSave();
      }
    } else {
      Alert.alert('Confirm Plan Change', `Change to ${planLabel}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Change', onPress: doSave }
      ]);
    }
  };

  // Force logout
  const handleForceLogout = async () => {
    if (!loadedUser) return;

    const doLogout = async () => {
      setActionLoading('force-logout');
      try {
        const token = await getToken();
        if (!token) return;

        await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/force-logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (Platform.OS === 'web') {
          alert('User has been logged out from all sessions.');
        } else {
          Alert.alert('Success', 'User sessions terminated');
        }
        addLocalAuditEvent('Force logout executed');
      } catch (error) {
        if (Platform.OS === 'web') {
          alert('Error: Failed to force logout');
        } else {
          Alert.alert('Error', 'Failed to force logout');
        }
      } finally {
        setActionLoading(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Force logout this user from all sessions?')) {
        doLogout();
      }
    } else {
      Alert.alert('Confirm Logout', 'Force logout this user from all sessions?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: doLogout }
      ]);
    }
  };

  // Force password reset
  const handleForcePasswordReset = async () => {
    if (!loadedUser) return;

    const doReset = async () => {
      setActionLoading('force-password');
      try {
        const token = await getToken();
        if (!token) return;

        await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/force-password-reset`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (Platform.OS === 'web') {
          alert('Password reset email has been sent to the user.');
        } else {
          Alert.alert('Success', 'Password reset email sent');
        }
        addLocalAuditEvent('Password reset forced');
      } catch (error) {
        if (Platform.OS === 'web') {
          alert('Error: Failed to force password reset');
        } else {
          Alert.alert('Error', 'Failed to force password reset');
        }
      } finally {
        setActionLoading(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Send a password reset email to this user?')) {
        doReset();
      }
    } else {
      Alert.alert('Confirm Reset', 'Send password reset email?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: doReset }
      ]);
    }
  };

  // Reset monthly usage
  const handleResetMonthlyUsage = async () => {
    if (!loadedUser) return;

    const doReset = async () => {
      setActionLoading('reset-usage');
      try {
        const token = await getToken();
        if (!token) return;

        await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/reset-usage`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (Platform.OS === 'web') {
          alert('Monthly usage has been reset to 0.');
        } else {
          Alert.alert('Success', 'Monthly usage reset');
        }
        addLocalAuditEvent('Monthly usage reset', true);
      } catch (error) {
        if (Platform.OS === 'web') {
          alert('Error: Failed to reset usage');
        } else {
          Alert.alert('Error', 'Failed to reset usage');
        }
      } finally {
        setActionLoading(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Reset this user\'s monthly statement usage to 0?')) {
        doReset();
      }
    } else {
      Alert.alert('Confirm Reset', 'Reset monthly usage to 0?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', onPress: doReset }
      ]);
    }
  };

  // Grant trial
  const handleGrantTrial = async () => {
    if (!loadedUser) return;

    const doGrant = async () => {
      setActionLoading('grant-trial');
      try {
        const token = await getToken();
        if (!token) return;

        await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/grant-trial`, 
          { days: 30 },
          { headers: { Authorization: `Bearer ${token}` }}
        );

        if (Platform.OS === 'web') {
          alert('30-day trial has been granted to this user.');
        } else {
          Alert.alert('Success', '30-day trial granted');
        }
        addLocalAuditEvent('Trial granted (30 days)', true);
      } catch (error) {
        if (Platform.OS === 'web') {
          alert('Error: Failed to grant trial');
        } else {
          Alert.alert('Error', 'Failed to grant trial');
        }
      } finally {
        setActionLoading(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Grant a 30-day trial to this user?')) {
        doGrant();
      }
    } else {
      Alert.alert('Confirm Trial', 'Grant 30-day trial to this user?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Grant', onPress: doGrant }
      ]);
    }
  };

  // Revoke trial
  const handleRevokeTrial = async () => {
    if (!loadedUser) return;

    const doRevoke = async () => {
      setActionLoading('revoke-trial');
      try {
        const token = await getToken();
        if (!token) return;

        await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/revoke-trial`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (Platform.OS === 'web') {
          alert('Trial has been revoked for this user.');
        } else {
          Alert.alert('Success', 'Trial revoked');
        }
        addLocalAuditEvent('Trial revoked', true);
      } catch (error) {
        if (Platform.OS === 'web') {
          alert('Error: Failed to revoke trial');
        } else {
          Alert.alert('Error', 'Failed to revoke trial');
        }
      } finally {
        setActionLoading(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Revoke the trial period for this user?')) {
        doRevoke();
      }
    } else {
      Alert.alert('Confirm Revoke', 'Revoke trial for this user?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revoke', style: 'destructive', onPress: doRevoke }
      ]);
    }
  };

  // Record statement event
  const handleRecordStatementEvent = async () => {
    if (!loadedUser) return;

    const doRecord = async () => {
      setActionLoading('record-event');
      try {
        const token = await getToken();
        if (!token) return;

        await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/record-statement`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (Platform.OS === 'web') {
          alert('Statement event recorded (+1 usage).');
        } else {
          Alert.alert('Success', 'Statement event recorded (+1)');
        }
        addLocalAuditEvent('Statement event recorded', true);
        loadStatementEvents(loadedUser.clerk_id);
      } catch (error) {
        if (Platform.OS === 'web') {
          alert('Error: Failed to record event');
        } else {
          Alert.alert('Error', 'Failed to record event');
        }
      } finally {
        setActionLoading(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Record a statement event for this user? (+1 to usage count)')) {
        doRecord();
      }
    } else {
      Alert.alert('Confirm', 'Record statement event (+1)?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Record', onPress: doRecord }
      ]);
    }
  };

  // Load statement override for user
  const loadStatementOverride = async (userId: string) => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/api/admin/users/${userId}/override`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.override) {
        setCurrentOverride(response.data.override.statement_override);
        setStatementOverride(response.data.override.statement_override?.toString() || '');
      } else {
        setCurrentOverride(null);
        setStatementOverride('');
      }
    } catch (error) {
      console.log('No override found or error loading:', error);
      setCurrentOverride(null);
      setStatementOverride('');
    }
  };

  // Save statement override
  const handleSaveStatementOverride = async () => {
    if (!loadedUser) return;

    const overrideValue = parseInt(statementOverride, 10);
    if (isNaN(overrideValue) || overrideValue < 0) {
      if (Platform.OS === 'web') {
        alert('Please enter a valid number (0 or greater)');
      } else {
        Alert.alert('Error', 'Please enter a valid number (0 or greater)');
      }
      return;
    }

    setIsSavingOverride(true);
    try {
      const token = await getToken();
      if (!token) return;

      await axios.put(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/override`, {
        statement_override: overrideValue
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setCurrentOverride(overrideValue);
      if (Platform.OS === 'web') {
        alert(`Statement override set to ${overrideValue} for this user.`);
      } else {
        Alert.alert('Success', `Statement override set to ${overrideValue}`);
      }
      addLocalAuditEvent(`Statement override set to ${overrideValue}`, true);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to save override';
      if (Platform.OS === 'web') {
        alert('Error: ' + errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setIsSavingOverride(false);
    }
  };

  // Clear statement override
  const handleClearStatementOverride = async () => {
    if (!loadedUser) return;

    const doClear = async () => {
      setIsSavingOverride(true);
      try {
        const token = await getToken();
        if (!token) return;

        await axios.delete(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/override`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setCurrentOverride(null);
        setStatementOverride('');
        if (Platform.OS === 'web') {
          alert('Statement override cleared for this user.');
        } else {
          Alert.alert('Success', 'Statement override cleared');
        }
        addLocalAuditEvent('Statement override cleared', true);
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || 'Failed to clear override';
        if (Platform.OS === 'web') {
          alert('Error: ' + errorMsg);
        } else {
          Alert.alert('Error', errorMsg);
        }
      } finally {
        setIsSavingOverride(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to clear the statement override for this user?')) {
        doClear();
      }
    } else {
      Alert.alert('Confirm', 'Clear statement override for this user?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', onPress: doClear }
      ]);
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
      addLocalAuditEvent('Support info updated', true);
    } catch (error) {
      Alert.alert('Error', 'Failed to save support info');
    } finally {
      setIsSavingSupport(false);
    }
  };

  // Enter read-only impersonation - view user's statement history
  const handleEnterImpersonation = async () => {
    if (!loadedUser) return;
    
    // Start impersonation mode
    startImpersonation({
      clerk_id: loadedUser.clerk_id,
      email: loadedUser.email,
      name: loadedUser.name,
      plan_type: loadedUser.plan_type,
    });
    
    addLocalAuditEvent(`Viewing statement history for ${loadedUser.email}`);
    
    // Navigate to Statement History to see the user's statements
    Alert.alert(
      'View User Statements', 
      `You are now viewing the statement history of ${loadedUser.email}. The purple banner at the top indicates READ-ONLY mode.`,
      [
        { 
          text: 'View Statement History', 
          onPress: () => {
            navigateTo('InspectionHistory');
          }
        },
        { text: 'Cancel', style: 'cancel', onPress: () => endImpersonation() }
      ]
    );
  };

  // Exit impersonation
  const handleExitImpersonation = async () => {
    if (!isImpersonating) {
      Alert.alert('Info', 'You are not currently impersonating any user.');
      return;
    }
    
    const previousEmail = impersonatedUser?.email;
    endImpersonation();
    addLocalAuditEvent(`Impersonation ended for ${previousEmail}`);
    Alert.alert('Success', 'Impersonation mode ended. You are now back to your admin view.');
  };

  // Refresh audit
  const handleRefreshAudit = () => {
    if (loadedUser) {
      loadAuditTrail(loadedUser.clerk_id);
    }
  };

  // Add audit event locally and refresh from backend
  const addLocalAuditEvent = (action: string, refreshUserData: boolean = false) => {
    // Add optimistic local event immediately
    const newEvent = {
      id: Date.now(),
      action_type: action,
      created_at: new Date().toISOString(),
      admin_name: 'Current Admin'
    };
    setAuditEvents(prev => [newEvent, ...prev]);
    
    // Refresh audit trail from backend after a brief delay to ensure backend has saved
    if (loadedUser) {
      setTimeout(() => {
        loadAuditTrail(loadedUser.clerk_id);
        if (refreshUserData) {
          handleSearchUser();
        }
      }, 500);
    }
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
                loadedUser.is_active === false ? styles.deletedBadge : 
                isSuspended ? styles.suspendedBadge : styles.activeBadge
              ]}>
                <Text style={[
                  styles.statusBadgeText,
                  loadedUser.is_active === false && styles.deletedBadgeText,
                  isSuspended && loadedUser.is_active !== false && styles.suspendedBadgeText
                ]}>
                  {loadedUser.is_active === false ? 'DELETED' : 
                   isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                </Text>
              </View>
            </View>

            <View style={styles.userDates}>
              <Text style={styles.userDateRow}>Created: {formatDate(loadedUser.created_at)}</Text>
              <Text style={styles.userDateRow}>Last login: {formatDate(loadedUser.last_login)}</Text>
              <Text style={styles.userDateRow}>Updated: {formatDate(loadedUser.updated_at)}</Text>
            </View>

            {/* Admin Notes - Add new note */}
            <Text style={styles.label}>Add admin note</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add a new internal note (support context, billing notes, policy flags, etc.)"
              value={adminNotes}
              onChangeText={setAdminNotes}
              multiline
              numberOfLines={3}
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity 
              style={[styles.button, styles.primaryButton, { marginBottom: 16 }]} 
              onPress={handleSaveNotes}
              disabled={isSavingNotes || !adminNotes.trim()}
            >
              <Text style={styles.buttonText}>
                {isSavingNotes ? 'Adding...' : 'Add Note'}
              </Text>
            </TouchableOpacity>

            {/* Admin Notes List */}
            {adminNotesList.length > 0 && (
              <View style={styles.notesList}>
                <Text style={styles.notesListTitle}>Admin Notes ({adminNotesList.length})</Text>
                {adminNotesList.map((note: any) => (
                  <View key={note.id} style={styles.noteItem}>
                    <View style={styles.noteContent}>
                      <Text style={styles.noteText}>{note.note}</Text>
                      <Text style={styles.noteMeta}>
                        {note.admin_email || 'Admin'} • {formatDate(note.created_at)}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.noteDeleteButton}
                      onPress={() => handleDeleteNote(note.id, 'admin')}
                      disabled={isDeletingNote === note.id}
                    >
                      {isDeletingNote === note.id ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <X size={16} color="#EF4444" />
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Lifecycle Action Buttons */}
            <Text style={[styles.label, { marginTop: 16 }]}>Lifecycle Actions</Text>
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.underlineButton, isSuspended && styles.disabledButton]} 
                onPress={handleSuspendUser}
                disabled={actionLoading === 'suspend' || isSuspended}
              >
                <Text style={[styles.underlineButtonText, isSuspended && styles.disabledButtonText]}>
                  {actionLoading === 'suspend' ? 'Suspending...' : 'Suspend'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, styles.underlineButton, !isSuspended && styles.disabledButton]} 
                onPress={handleReactivateUser}
                disabled={actionLoading === 'reactivate' || !isSuspended}
              >
                <Text style={[styles.underlineButtonText, !isSuspended && styles.disabledButtonText]}>
                  {actionLoading === 'reactivate' ? 'Reactivating...' : 'Reactivate'}
                </Text>
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
                    <Picker.Item label="Standard" value="standard" />
                    <Picker.Item label="Admin" value="admin" />
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
                    <Picker.Item label="Off" value="off" />
                    <Picker.Item label="On" value="on" />
                  </Picker>
                  <ChevronDown size={18} color={COLORS.textSecondary} style={styles.pickerIcon} />
                </View>
              </View>
            </View>

            {/* Plan Type - Independent of Admin Role */}
            <View style={styles.pickerRow}>
              <View style={styles.pickerField}>
                <Text style={styles.label}>Subscription Plan</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={userPlanType}
                    onValueChange={setUserPlanType}
                    style={styles.picker}
                  >
                    <Picker.Item label="Free (5 statements/month)" value="free" />
                    <Picker.Item label="Pro (Unlimited)" value="pro" />
                    <Picker.Item label="Platinum (Unlimited)" value="platinum" />
                  </Picker>
                  <ChevronDown size={18} color={COLORS.textSecondary} style={styles.pickerIcon} />
                </View>
              </View>
              <TouchableOpacity 
                style={[styles.button, styles.primaryButton, { flex: 0.5, marginTop: 24 }]} 
                onPress={handleSavePlanType}
                disabled={isSavingPlan}
              >
                <Text style={styles.buttonText}>
                  {isSavingPlan ? 'Saving...' : 'Update Plan'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.hintText, { marginBottom: 12 }]}>
              Note: Changing subscription plan is independent of admin role.
            </Text>

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

            {/* Statement Override Section */}
            <View style={styles.overrideSection}>
              <Text style={styles.overrideTitle}>Statement Override</Text>
              <Text style={styles.overrideDescription}>
                Set a custom statement allowance for this user that overrides their plan limit.
              </Text>
              
              {currentOverride !== null && (
                <View style={styles.currentOverrideBox}>
                  <Text style={styles.currentOverrideText}>
                    Current override: <Text style={styles.overrideValue}>{currentOverride} statements/month</Text>
                  </Text>
                </View>
              )}
              
              <View style={styles.overrideInputRow}>
                <TextInput
                  style={[styles.input, styles.overrideInput]}
                  value={statementOverride}
                  onChangeText={setStatementOverride}
                  placeholder="Number of statements"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton, styles.overrideButton]}
                  onPress={handleSaveStatementOverride}
                  disabled={isSavingOverride || !statementOverride}
                >
                  {isSavingOverride ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Save Override</Text>
                  )}
                </TouchableOpacity>
              </View>
              
              {currentOverride !== null && (
                <TouchableOpacity
                  style={[styles.button, styles.dangerButton, { marginTop: 8 }]}
                  onPress={handleClearStatementOverride}
                  disabled={isSavingOverride}
                >
                  <Text style={styles.dangerButtonText}>Clear Override</Text>
                </TouchableOpacity>
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

            {/* Support Notes - Add new */}
            <Text style={styles.label}>Add support note</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Support context, timeline, billing notes, escalation reasons..."
              value={supportNotes}
              onChangeText={setSupportNotes}
              multiline
              numberOfLines={3}
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
            </View>

            {/* Support Notes List */}
            {supportNotesList.length > 0 && (
              <View style={styles.notesList}>
                <Text style={styles.notesListTitle}>Support Notes ({supportNotesList.length})</Text>
                {supportNotesList.map((note: any) => (
                  <View key={note.id} style={styles.noteItem}>
                    <View style={styles.noteContent}>
                      <Text style={styles.noteText}>{note.note}</Text>
                      <Text style={styles.noteMeta}>
                        {note.admin_email || 'Support'} • {formatDate(note.created_at)}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.noteDeleteButton}
                      onPress={() => handleDeleteNote(note.id, 'support')}
                      disabled={isDeletingNote === note.id}
                    >
                      {isDeletingNote === note.id ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <X size={16} color="#EF4444" />
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Impersonation Buttons */}
            <Text style={[styles.label, { marginTop: 16 }]}>Impersonation</Text>
            <View style={styles.supportButtonsRow}>
              <TouchableOpacity 
                style={[styles.button, styles.outlineButton]} 
                onPress={handleEnterImpersonation}
              >
                <Eye size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                <Text style={styles.outlineButtonText}>View Statement History</Text>
              </TouchableOpacity>
              {isImpersonating && (
                <TouchableOpacity 
                  style={[styles.button, styles.dangerOutlineButton]} 
                  onPress={handleExitImpersonation}
                >
                  <Text style={styles.dangerOutlineButtonText}>Exit Impersonation</Text>
                </TouchableOpacity>
              )}
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
  suspendedBadge: {
    backgroundColor: '#FEF3C7',
  },
  deletedBadge: {
    backgroundColor: '#E5E7EB',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  suspendedBadgeText: {
    color: '#92400E',
  },
  deletedBadgeText: {
    color: '#4B5563',
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
  // Notes List Styles
  notesList: {
    marginTop: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
  },
  notesListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  noteItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  noteContent: {
    flex: 1,
  },
  noteText: {
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 4,
  },
  noteMeta: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  noteDeleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  // Disabled button styles
  disabledButton: {
    opacity: 0.5,
  },
  disabledButtonText: {
    color: '#9CA3AF',
  },
  // Danger outline button
  dangerOutlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dangerOutlineButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
  },
  // Statement Override styles
  overrideSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  overrideTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  overrideDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  currentOverrideBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  currentOverrideText: {
    fontSize: 13,
    color: '#1E40AF',
  },
  overrideValue: {
    fontWeight: '700',
  },
  overrideInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  overrideInput: {
    flex: 1,
    minWidth: 120,
  },
  overrideButton: {
    paddingHorizontal: 16,
    minWidth: 120,
  },
  dangerButton: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default UserSearchTab;
