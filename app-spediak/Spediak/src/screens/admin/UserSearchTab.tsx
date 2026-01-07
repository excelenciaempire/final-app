import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  Switch, 
  ActivityIndicator, 
  Platform,
  useWindowDimensions
} from 'react-native';
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
  Settings,
  Gift,
  RefreshCcw,
  X,
  Tag,
  AlertTriangle,
  Calendar
} from 'lucide-react-native';

// Predefined support tags
const SUPPORT_TAGS = [
  { name: 'VIP', color: '#8B5CF6' },
  { name: 'Beta Tester', color: '#06B6D4' },
  { name: 'Billing Issue', color: '#F59E0B' },
  { name: 'Fraud Check', color: '#EF4444' },
  { name: 'Support Priority', color: '#10B981' },
];

const UserSearchTab: React.FC = () => {
  const { getToken } = useAuth();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  // User Search State
  const [searchEmail, setSearchEmail] = useState('');
  const [loadedUser, setLoadedUser] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Security Flags State
  const [securityFlags, setSecurityFlags] = useState<any>(null);
  const [isLoadingFlags, setIsLoadingFlags] = useState(false);

  // Support Tags State
  const [userTags, setUserTags] = useState<any[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);

  // Notes State
  const [userNotes, setUserNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);

  // Audit Trail State
  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // User Override State
  const [overrideEmail, setOverrideEmail] = useState('');
  const [overrideAllowance, setOverrideAllowance] = useState('');
  const [currentOverride, setCurrentOverride] = useState<any>(null);
  const [isLoadingOverride, setIsLoadingOverride] = useState(false);

  // Promotion State
  const [promoStartDate, setPromoStartDate] = useState('');
  const [promoEndDate, setPromoEndDate] = useState('');
  const [promoStatements, setPromoStatements] = useState('');
  const [activePromotion, setActivePromotion] = useState<any>(null);
  const [isLoadingPromo, setIsLoadingPromo] = useState(false);

  // Gift Credits State
  const [giftAmount, setGiftAmount] = useState('5');
  const [giftReason, setGiftReason] = useState('');

  // Reset Trial State
  const [resetReason, setResetReason] = useState('');

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
        params: { email: searchEmail }
      });

      if (response.data.user) {
        setLoadedUser(response.data.user);
        // Load related data
        loadSecurityFlags(response.data.user.clerk_id);
        loadSupportTags(response.data.user.clerk_id);
        loadUserNotes(response.data.user.clerk_id);
        loadAuditTrail(response.data.user.clerk_id);
      } else {
        Alert.alert('Not Found', 'No user found with that email address');
        setLoadedUser(null);
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
    setSecurityFlags(null);
    setUserTags([]);
    setUserNotes([]);
    setAuditTrail([]);
    setSearchEmail('');
  };

  // Load security flags
  const loadSecurityFlags = async (userId: string) => {
    setIsLoadingFlags(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/api/admin/users/${userId}/security-flags`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSecurityFlags(response.data.flags);
    } catch (error) {
      console.error('Error loading security flags:', error);
    } finally {
      setIsLoadingFlags(false);
    }
  };

  // Update security flag
  const handleUpdateSecurityFlag = async (flagName: string, value: boolean) => {
    if (!loadedUser) return;

    setActionLoading(`flag-${flagName}`);
    try {
      const token = await getToken();
      if (!token) return;

      const updatedFlags = { ...securityFlags, [flagName]: value };

      await axios.put(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/security-flags`, updatedFlags, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSecurityFlags(updatedFlags);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update security flag');
    } finally {
      setActionLoading(null);
    }
  };

  // Load support tags
  const loadSupportTags = async (userId: string) => {
    setIsLoadingTags(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/api/admin/users/${userId}/tags`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserTags(response.data.tags || []);
    } catch (error) {
      console.error('Error loading tags:', error);
    } finally {
      setIsLoadingTags(false);
    }
  };

  // Add support tag
  const handleAddTag = async (tagName: string, tagColor: string) => {
    if (!loadedUser) return;

    setActionLoading(`tag-${tagName}`);
    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/tags`, 
        { tagName, tagColor },
        { headers: { Authorization: `Bearer ${token}` }}
      );

      loadSupportTags(loadedUser.clerk_id);
    } catch (error: any) {
      if (error.response?.status === 409) {
        Alert.alert('Info', 'Tag already exists for this user');
      } else {
        Alert.alert('Error', 'Failed to add tag');
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Remove support tag
  const handleRemoveTag = async (tagId: number) => {
    if (!loadedUser) return;

    setActionLoading(`remove-tag-${tagId}`);
    try {
      const token = await getToken();
      if (!token) return;

      await axios.delete(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/tags/${tagId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      loadSupportTags(loadedUser.clerk_id);
    } catch (error) {
      Alert.alert('Error', 'Failed to remove tag');
    } finally {
      setActionLoading(null);
    }
  };

  // Load user notes
  const loadUserNotes = async (userId: string) => {
    setIsLoadingNotes(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/api/admin/users/${userId}/notes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserNotes(response.data.notes || []);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setIsLoadingNotes(false);
    }
  };

  // Add note
  const handleAddNote = async () => {
    if (!loadedUser || !newNote.trim()) return;

    setActionLoading('add-note');
    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/notes`, 
        { note: newNote },
        { headers: { Authorization: `Bearer ${token}` }}
      );

      setNewNote('');
      loadUserNotes(loadedUser.clerk_id);
    } catch (error) {
      Alert.alert('Error', 'Failed to add note');
    } finally {
      setActionLoading(null);
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
      setAuditTrail(response.data.events || []);
    } catch (error) {
      console.error('Error loading audit trail:', error);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  // Gift credits
  const handleGiftCredits = async () => {
    if (!loadedUser) return;

    const amount = parseInt(giftAmount);
    if (isNaN(amount) || amount <= 0 || amount > 100) {
      Alert.alert('Error', 'Please enter a valid amount (1-100)');
      return;
    }

    setActionLoading('gift-credits');
    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/gift-credits`, 
        { credits: amount, reason: giftReason },
        { headers: { Authorization: `Bearer ${token}` }}
      );

      Alert.alert('Success', `${amount} credits gifted successfully`);
      setGiftAmount('5');
      setGiftReason('');
      handleSearchUser(); // Refresh user data
    } catch (error) {
      Alert.alert('Error', 'Failed to gift credits');
    } finally {
      setActionLoading(null);
    }
  };

  // Reset trial
  const handleResetTrial = async () => {
    if (!loadedUser) return;

    setActionLoading('reset-trial');
    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/users/${loadedUser.clerk_id}/reset-trial`, 
        { reason: resetReason },
        { headers: { Authorization: `Bearer ${token}` }}
      );

      Alert.alert('Success', 'Trial reset successfully');
      setResetReason('');
      handleSearchUser(); // Refresh user data
    } catch (error) {
      Alert.alert('Error', 'Failed to reset trial');
    } finally {
      setActionLoading(null);
    }
  };

  // Check override
  const handleCheckOverride = async () => {
    if (!overrideEmail.trim()) return;

    setIsLoadingOverride(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/api/admin/user-override`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { email: overrideEmail }
      });

      setCurrentOverride(response.data.override);
      if (response.data.override) {
        setOverrideAllowance(response.data.override.statement_allowance.toString());
      }
    } catch (error) {
      console.error('Error checking override:', error);
    } finally {
      setIsLoadingOverride(false);
    }
  };

  // Save override
  const handleSaveOverride = async () => {
    if (!overrideEmail.trim() || !overrideAllowance) {
      Alert.alert('Error', 'Email and statement allowance are required');
      return;
    }

    setActionLoading('save-override');
    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/user-override`, 
        { email: overrideEmail, statementAllowance: parseInt(overrideAllowance) },
        { headers: { Authorization: `Bearer ${token}` }}
      );

      Alert.alert('Success', 'Override saved successfully');
      handleCheckOverride();
    } catch (error) {
      Alert.alert('Error', 'Failed to save override');
    } finally {
      setActionLoading(null);
    }
  };

  // Clear override
  const handleClearOverride = async () => {
    if (!overrideEmail.trim()) return;

    setActionLoading('clear-override');
    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/user-override/clear`, 
        { email: overrideEmail },
        { headers: { Authorization: `Bearer ${token}` }}
      );

      Alert.alert('Success', 'Override cleared successfully');
      setCurrentOverride(null);
      setOverrideAllowance('');
    } catch (error) {
      Alert.alert('Error', 'Failed to clear override');
    } finally {
      setActionLoading(null);
    }
  };

  // Load active promotion
  const loadActivePromotion = useCallback(async () => {
    setIsLoadingPromo(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/api/admin/promotions/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setActivePromotion(response.data.promotion);
    } catch (error) {
      console.error('Error loading promotion:', error);
    } finally {
      setIsLoadingPromo(false);
    }
  }, [getToken]);

  // Save promotion
  const handleSavePromotion = async () => {
    if (!promoStartDate || !promoEndDate || !promoStatements) {
      Alert.alert('Error', 'All promotion fields are required');
      return;
    }

    setActionLoading('save-promo');
    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/promotions`, 
        { startDate: promoStartDate, endDate: promoEndDate, freeStatements: parseInt(promoStatements) },
        { headers: { Authorization: `Bearer ${token}` }}
      );

      Alert.alert('Success', 'Promotion saved successfully');
      loadActivePromotion();
      setPromoStartDate('');
      setPromoEndDate('');
      setPromoStatements('');
    } catch (error) {
      Alert.alert('Error', 'Failed to save promotion');
    } finally {
      setActionLoading(null);
    }
  };

  // Clear promotion
  const handleClearPromotion = async () => {
    setActionLoading('clear-promo');
    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/promotions/clear`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', 'Promotion cleared successfully');
      setActivePromotion(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to clear promotion');
    } finally {
      setActionLoading(null);
    }
  };

  // Load promotion on mount
  React.useEffect(() => {
    loadActivePromotion();
  }, [loadActivePromotion]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* User Search Section */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Search size={20} color={COLORS.primary} />
          <Text style={styles.cardTitle}>User Search</Text>
        </View>
        <Text style={styles.cardDescription}>
          Find and manage a user account. In production, enforce RBAC + audit logging server-side.
        </Text>

        <Text style={styles.label}>Search by email</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, styles.searchInput]}
            placeholder="user@example.com"
            value={searchEmail}
            onChangeText={setSearchEmail}
            keyboardType="email-address"
            autoCapitalize="none"
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
            style={[styles.button, styles.secondaryButton]} 
            onPress={handleClearUser}
          >
            <Text style={styles.secondaryButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
        
        {loadedUser ? (
          <View style={styles.userLoadedBadge}>
            <User size={16} color={COLORS.primary} />
            <Text style={styles.userLoadedText}>
              {loadedUser.name || loadedUser.email} loaded
            </Text>
          </View>
        ) : (
          <Text style={styles.noUserText}>No user loaded.</Text>
        )}
      </View>

      {/* Roles & Security Section */}
      <View style={styles.card}>
        <View style={[styles.cardHeader, !loadedUser && styles.cardHeaderDisabled]}>
          <Shield size={20} color={loadedUser ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[styles.cardTitle, !loadedUser && styles.cardTitleDisabled]}>Roles & Security</Text>
        </View>
        <Text style={styles.cardDescription}>
          Manage access flags and security controls for the selected user.
        </Text>

        {loadedUser && securityFlags ? (
          <View style={styles.flagsContainer}>
            <View style={styles.flagRow}>
              <Text style={styles.flagLabel}>Admin Access</Text>
              <Switch
                value={securityFlags.is_admin || false}
                onValueChange={(v) => handleUpdateSecurityFlag('isAdmin', v)}
                disabled={actionLoading === 'flag-isAdmin'}
              />
            </View>
            <View style={styles.flagRow}>
              <Text style={styles.flagLabel}>Beta User</Text>
              <Switch
                value={securityFlags.is_beta_user || false}
                onValueChange={(v) => handleUpdateSecurityFlag('isBetaUser', v)}
                disabled={actionLoading === 'flag-isBetaUser'}
              />
            </View>
            <View style={styles.flagRow}>
              <Text style={styles.flagLabel}>VIP Status</Text>
              <Switch
                value={securityFlags.is_vip || false}
                onValueChange={(v) => handleUpdateSecurityFlag('isVip', v)}
                disabled={actionLoading === 'flag-isVip'}
              />
            </View>
            <View style={styles.flagRow}>
              <Text style={[styles.flagLabel, styles.dangerLabel]}>Suspended</Text>
              <Switch
                value={securityFlags.is_suspended || false}
                onValueChange={(v) => handleUpdateSecurityFlag('isSuspended', v)}
                trackColor={{ true: COLORS.error }}
                disabled={actionLoading === 'flag-isSuspended'}
              />
            </View>
            <View style={styles.flagRow}>
              <Text style={[styles.flagLabel, styles.dangerLabel]}>Fraud Flag</Text>
              <Switch
                value={securityFlags.fraud_flag || false}
                onValueChange={(v) => handleUpdateSecurityFlag('fraudFlag', v)}
                trackColor={{ true: COLORS.error }}
                disabled={actionLoading === 'flag-fraudFlag'}
              />
            </View>
          </View>
        ) : (
          <Text style={styles.loadUserPrompt}>Load a user to manage roles and security.</Text>
        )}
      </View>

      {/* Usage & Billing Section */}
      <View style={styles.card}>
        <View style={[styles.cardHeader, !loadedUser && styles.cardHeaderDisabled]}>
          <CreditCard size={20} color={loadedUser ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[styles.cardTitle, !loadedUser && styles.cardTitleDisabled]}>Usage & Billing</Text>
        </View>
        <Text style={styles.cardDescription}>
          View usage stats and subscription status. Gift credits or reset trial.
        </Text>

        {loadedUser ? (
          <View style={styles.usageContainer}>
            <View style={styles.usageStats}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{loadedUser.statements_used || 0}</Text>
                <Text style={styles.statLabel}>Used</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{loadedUser.statements_limit || 5}</Text>
                <Text style={styles.statLabel}>Limit</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{loadedUser.plan_type || 'free'}</Text>
                <Text style={styles.statLabel}>Plan</Text>
              </View>
            </View>

            {/* Gift Credits */}
            <View style={styles.actionSection}>
              <Text style={styles.actionLabel}>Gift Credits</Text>
              <View style={styles.actionRow}>
                <TextInput
                  style={[styles.input, styles.smallInput]}
                  placeholder="Amount"
                  value={giftAmount}
                  onChangeText={setGiftAmount}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  placeholder="Reason (optional)"
                  value={giftReason}
                  onChangeText={setGiftReason}
                />
                <TouchableOpacity 
                  style={[styles.button, styles.successButton]} 
                  onPress={handleGiftCredits}
                  disabled={actionLoading === 'gift-credits'}
                >
                  {actionLoading === 'gift-credits' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Gift size={16} color="#fff" />
                      <Text style={styles.buttonText}>Gift</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Reset Trial */}
            <View style={styles.actionSection}>
              <Text style={styles.actionLabel}>Reset Trial</Text>
              <View style={styles.actionRow}>
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  placeholder="Reason (optional)"
                  value={resetReason}
                  onChangeText={setResetReason}
                />
                <TouchableOpacity 
                  style={[styles.button, styles.warningButton]} 
                  onPress={handleResetTrial}
                  disabled={actionLoading === 'reset-trial'}
                >
                  {actionLoading === 'reset-trial' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <RefreshCcw size={16} color="#fff" />
                      <Text style={styles.buttonText}>Reset</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <Text style={styles.loadUserPrompt}>Load a user to view usage and billing.</Text>
        )}
      </View>

      {/* Support Workflow Section */}
      <View style={styles.card}>
        <View style={[styles.cardHeader, !loadedUser && styles.cardHeaderDisabled]}>
          <MessageSquare size={20} color={loadedUser ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[styles.cardTitle, !loadedUser && styles.cardTitleDisabled]}>Support Workflow</Text>
        </View>
        <Text style={styles.cardDescription}>
          Tags and support notes help your team handle billing issues, beta users, fraud checks, etc.
        </Text>

        {loadedUser ? (
          <View style={styles.supportContainer}>
            {/* Current Tags */}
            <View style={styles.tagsSection}>
              <Text style={styles.sectionLabel}>Current Tags</Text>
              <View style={styles.tagsList}>
                {userTags.length > 0 ? userTags.map((tag) => (
                  <View key={tag.id} style={[styles.tagBadge, { backgroundColor: tag.tag_color }]}>
                    <Text style={styles.tagText}>{tag.tag_name}</Text>
                    <TouchableOpacity onPress={() => handleRemoveTag(tag.id)}>
                      <X size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )) : (
                  <Text style={styles.noTagsText}>No tags assigned</Text>
                )}
              </View>
            </View>

            {/* Add Tags */}
            <View style={styles.addTagsSection}>
              <Text style={styles.sectionLabel}>Add Tag</Text>
              <View style={styles.availableTags}>
                {SUPPORT_TAGS.map((tag) => (
                  <TouchableOpacity
                    key={tag.name}
                    style={[styles.addTagButton, { borderColor: tag.color }]}
                    onPress={() => handleAddTag(tag.name, tag.color)}
                    disabled={actionLoading === `tag-${tag.name}`}
                  >
                    <Text style={[styles.addTagText, { color: tag.color }]}>+ {tag.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Notes */}
            <View style={styles.notesSection}>
              <Text style={styles.sectionLabel}>Admin Notes ({userNotes.length})</Text>
              <View style={styles.addNoteRow}>
                <TextInput
                  style={[styles.input, styles.noteInput]}
                  placeholder="Add a note..."
                  value={newNote}
                  onChangeText={setNewNote}
                  multiline
                />
                <TouchableOpacity 
                  style={[styles.button, styles.primaryButton]} 
                  onPress={handleAddNote}
                  disabled={actionLoading === 'add-note' || !newNote.trim()}
                >
                  <Text style={styles.buttonText}>Add</Text>
                </TouchableOpacity>
              </View>
              {userNotes.slice(0, 3).map((note, idx) => (
                <View key={note.id || idx} style={styles.noteItem}>
                  <Text style={styles.noteText}>{note.note}</Text>
                  <Text style={styles.noteDate}>
                    {new Date(note.created_at).toLocaleDateString()} by {note.admin_name || 'Admin'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.loadUserPrompt}>Load a user to manage support workflow.</Text>
        )}
      </View>

      {/* Audit Trail Section */}
      <View style={styles.card}>
        <View style={[styles.cardHeader, !loadedUser && styles.cardHeaderDisabled]}>
          <History size={20} color={loadedUser ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[styles.cardTitle, !loadedUser && styles.cardTitleDisabled]}>Audit Trail</Text>
        </View>
        <Text style={styles.cardDescription}>
          Dedicated admin audit events for accountability.
        </Text>

        {loadedUser ? (
          <View style={styles.auditContainer}>
            {auditTrail.length > 0 ? auditTrail.slice(0, 5).map((event, idx) => (
              <View key={event.id || idx} style={styles.auditItem}>
                <View style={styles.auditHeader}>
                  <Text style={styles.auditAction}>{event.action_type}</Text>
                  <Text style={styles.auditDate}>
                    {new Date(event.created_at).toLocaleString()}
                  </Text>
                </View>
                <Text style={styles.auditBy}>By: {event.admin_name || event.admin_clerk_id}</Text>
              </View>
            )) : (
              <Text style={styles.noAuditText}>No audit events yet.</Text>
            )}
          </View>
        ) : (
          <Text style={styles.loadUserPrompt}>Load a user to view their audit trail.</Text>
        )}
      </View>

      {/* Admin Utilities Section */}
      <View style={[styles.card, styles.utilitiesCard]}>
        <View style={styles.cardHeader}>
          <Settings size={20} color={COLORS.primary} />
          <Text style={styles.cardTitle}>Admin Utilities</Text>
        </View>
        <Text style={styles.cardDescription}>
          Global tools for managing statement limits and promotions.
        </Text>

        {/* User Statement Overrides */}
        <View style={styles.utilitySection}>
          <Text style={styles.utilityTitle}>User statement overrides</Text>
          <Text style={styles.utilityDescription}>
            Configure extra free statements or reset the monthly counter for a specific user (by email).
          </Text>

          <Text style={styles.label}>User email</Text>
          <TextInput
            style={styles.input}
            placeholder="user@example.com"
            value={overrideEmail}
            onChangeText={(text) => {
              setOverrideEmail(text);
              setCurrentOverride(null);
            }}
            onBlur={handleCheckOverride}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Free statement allowance for this user</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 30 (for a trial)"
            value={overrideAllowance}
            onChangeText={setOverrideAllowance}
            keyboardType="numeric"
          />

          <View style={styles.utilityButtonRow}>
            <TouchableOpacity 
              style={[styles.button, styles.primaryButton, styles.utilityButton]} 
              onPress={handleSaveOverride}
              disabled={actionLoading === 'save-override'}
            >
              {actionLoading === 'save-override' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Save / update override</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.secondaryButton, styles.utilityButton]} 
              onPress={handleClearOverride}
              disabled={actionLoading === 'clear-override'}
            >
              <Text style={styles.secondaryButtonText}>Clear override for user</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.statusText}>
            {currentOverride 
              ? `Override active: ${currentOverride.statement_allowance} statements`
              : 'No user override saved yet.'
            }
          </Text>
        </View>

        <View style={styles.separator} />

        {/* Sign-up Promotion */}
        <View style={styles.utilitySection}>
          <Text style={styles.utilityTitle}>Sign-up promotion</Text>
          <Text style={styles.utilityDescription}>
            Define a promotion so that new signups between two dates receive extra free statements.
          </Text>

          <View style={styles.promoRow}>
            <View style={styles.promoField}>
              <Text style={styles.label}>Start date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={promoStartDate}
                onChangeText={setPromoStartDate}
              />
            </View>
            <View style={styles.promoField}>
              <Text style={styles.label}>End date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={promoEndDate}
                onChangeText={setPromoEndDate}
              />
            </View>
            <View style={styles.promoField}>
              <Text style={styles.label}>Free statements</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 30 or 50"
                value={promoStatements}
                onChangeText={setPromoStatements}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.utilityButtonRow}>
            <TouchableOpacity 
              style={[styles.button, styles.primaryButton, styles.utilityButton]} 
              onPress={handleSavePromotion}
              disabled={actionLoading === 'save-promo'}
            >
              {actionLoading === 'save-promo' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Save promotion</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.secondaryButton, styles.utilityButton]} 
              onPress={handleClearPromotion}
              disabled={actionLoading === 'clear-promo'}
            >
              <Text style={styles.secondaryButtonText}>Clear promotion</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.statusText}>
            {activePromotion 
              ? `Active: ${activePromotion.free_statements} statements (${activePromotion.start_date} to ${activePromotion.end_date})`
              : 'No active promotion configured.'
            }
          </Text>
        </View>
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
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  utilitiesCard: {
    borderLeftColor: '#6366F1',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  cardHeaderDisabled: {
    opacity: 0.5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cardTitleDisabled: {
    color: COLORS.textSecondary,
  },
  cardDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
  },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  successButton: {
    backgroundColor: '#10B981',
  },
  warningButton: {
    backgroundColor: '#F59E0B',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  userLoadedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  userLoadedText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  noUserText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  loadUserPrompt: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  flagsContainer: {
    gap: 12,
  },
  flagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  flagLabel: {
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  dangerLabel: {
    color: COLORS.error,
  },
  usageContainer: {
    gap: 16,
  },
  usageStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 16,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  actionSection: {
    marginTop: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  smallInput: {
    width: 80,
  },
  flexInput: {
    flex: 1,
  },
  supportContainer: {
    gap: 16,
  },
  tagsSection: {},
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  noTagsText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  addTagsSection: {},
  availableTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  addTagButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addTagText: {
    fontSize: 13,
    fontWeight: '500',
  },
  notesSection: {},
  addNoteRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  noteInput: {
    flex: 1,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  noteItem: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  noteText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  noteDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  auditContainer: {
    gap: 8,
  },
  auditItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
  },
  auditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  auditAction: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  auditDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  auditBy: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  noAuditText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  utilitySection: {
    marginBottom: 20,
  },
  utilityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  utilityDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  utilityButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  utilityButton: {
    flex: 1,
    minWidth: 150,
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 10,
    fontStyle: 'italic',
  },
  separator: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 20,
  },
  promoRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  promoField: {
    flex: 1,
    minWidth: 120,
  },
});

export default UserSearchTab;

