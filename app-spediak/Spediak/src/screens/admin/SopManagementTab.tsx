import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch, ActivityIndicator, Platform, Modal } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth, useUser } from '@clerk/clerk-expo';
import axios from 'axios';
import { BASE_URL } from '../../config/api';
import { COLORS } from '../../styles/colors';
import { Upload, Trash2, Eye, Copy, Check, X, FileText, Users, Settings as SettingsIcon } from 'lucide-react-native';
import { US_STATES } from '../../context/GlobalStateContext';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

const ORGANIZATIONS = ['ASHI', 'InterNACHI'];

const SopManagementTab: React.FC = () => {
  const { getToken, userId } = useAuth();
  const { user } = useUser();
  
  // Admin Diagnostics
  const [adminName, setAdminName] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('NC');
  const [dbCounts, setDbCounts] = useState<any>(null);
  
  // Ad Manager
  const [ads, setAds] = useState<any[]>([]);
  const [newAd, setNewAd] = useState({ title: '', subtitle: '', destinationUrl: '', imageUrl: '' });
  const [isLoadingAds, setIsLoadingAds] = useState(false);
  
  // SOP Documents
  const [sopDocuments, setSopDocuments] = useState<any[]>([]);
  const [sopAssignments, setSopAssignments] = useState<any[]>([]);
  const [selectedStateSop, setSelectedStateSop] = useState<string>('NC');
  const [selectedOrgSop, setSelectedOrgSop] = useState<string>('ASHI');
  const [isLoadingSops, setIsLoadingSops] = useState(false);
  const [selectedSopFile, setSelectedSopFile] = useState<DocumentPicker.DocumentPickerResult | null>(null);
  const [uploadingSop, setUploadingSop] = useState(false);
  const [newSopDocName, setNewSopDocName] = useState('');
  const [newSopDocType, setNewSopDocType] = useState<'state' | 'organization'>('state');
  
  // User Search & Management
  const [userSearchEmail, setUserSearchEmail] = useState('');
  const [searchedUser, setSearchedUser] = useState<any>(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUserForAction, setSelectedUserForAction] = useState<any>(null);
  const [giftCreditsAmount, setGiftCreditsAmount] = useState('5');
  const [giftCreditsReason, setGiftCreditsReason] = useState('');
  const [resetTrialReason, setResetTrialReason] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [userNotes, setUserNotes] = useState<any[]>([]);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);

  useEffect(() => {
    if (user) {
      setAdminName(user.fullName || user.emailAddresses[0]?.emailAddress || 'Admin');
    }
    fetchInitialData();
  }, [user]);

  const fetchInitialData = async () => {
    await Promise.all([
      fetchAds(),
      fetchSopDocuments(),
      fetchSopAssignments()
    ]);
  };

  // Ad Manager Functions
  const fetchAds = async () => {
    try {
      setIsLoadingAds(true);
      const token = await getToken();
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/api/admin/ads`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAds(response.data.ads || []);
    } catch (error: any) {
      console.error('Error fetching ads:', error);
    } finally {
      setIsLoadingAds(false);
    }
  };

  const handleCreateAd = async () => {
    if (!newAd.title || !newAd.destinationUrl) {
      Alert.alert('Error', 'Title and Destination URL are required');
      return;
    }

    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/ads`, newAd, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', 'Ad created successfully');
      setNewAd({ title: '', subtitle: '', destinationUrl: '', imageUrl: '' });
      fetchAds();
    } catch (error: any) {
      console.error('Error creating ad:', error);
      Alert.alert('Error', 'Failed to create ad');
    }
  };

  const handleToggleAdStatus = async (adId: number, currentStatus: string) => {
    try {
      const token = await getToken();
      if (!token) return;

      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await axios.put(`${BASE_URL}/api/admin/ads/${adId}`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      fetchAds();
    } catch (error: any) {
      console.error('Error toggling ad status:', error);
      Alert.alert('Error', 'Failed to update ad status');
    }
  };

  const handleDeleteAd = async (adId: number) => {
    Alert.alert(
      'Delete Ad',
      'Are you sure you want to delete this ad?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              if (!token) return;

              await axios.delete(`${BASE_URL}/api/admin/ads/${adId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });

              Alert.alert('Success', 'Ad deleted successfully');
              fetchAds();
            } catch (error: any) {
              console.error('Error deleting ad:', error);
              Alert.alert('Error', 'Failed to delete ad');
            }
          }
        }
      ]
    );
  };

  // SOP Management Functions
  const fetchSopDocuments = async () => {
    try {
      setIsLoadingSops(true);
      const token = await getToken();
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/api/sop/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSopDocuments(response.data.documents || []);
    } catch (error: any) {
      console.error('Error fetching SOP documents:', error);
    } finally {
      setIsLoadingSops(false);
    }
  };

  const fetchSopAssignments = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/api/admin/sop/assignments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSopAssignments(response.data.assignments || []);
    } catch (error: any) {
      console.error('Error fetching SOP assignments:', error);
    }
  };

  const handlePickSopDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      
      if (result.type === 'success') {
        setSelectedSopFile(result);
        Alert.alert('File Selected', `${result.name} ready to upload`);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleUploadSop = async () => {
    if (!selectedSopFile || selectedSopFile.type !== 'success' || !newSopDocName || !newSopDocType) {
      Alert.alert('Error', 'Please select a file, enter document name, and select type');
      return;
    }

    try {
      setUploadingSop(true);
      const token = await getToken();
      if (!token) return;

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(selectedSopFile.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await axios.post(`${BASE_URL}/api/admin/sop/upload`, {
        documentName: newSopDocName,
        documentType: newSopDocType,
        fileBase64: base64,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', 'SOP document uploaded successfully!');
      setSelectedSopFile(null);
      setNewSopDocName('');
      fetchSopDocuments();
    } catch (error: any) {
      console.error('Error uploading SOP:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to upload SOP');
    } finally {
      setUploadingSop(false);
    }
  };

  const handleAssignStateSop = async (documentId: number) => {
    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/sop/assign-state`, {
        documentId,
        state: selectedStateSop
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', `SOP assigned to ${selectedStateSop}`);
      fetchSopAssignments();
    } catch (error: any) {
      console.error('Error assigning state SOP:', error);
      Alert.alert('Error', 'Failed to assign SOP');
    }
  };

  const handleAssignOrgSop = async (documentId: number) => {
    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/sop/assign-org`, {
        documentId,
        organization: selectedOrgSop
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', `SOP assigned to ${selectedOrgSop}`);
      fetchSopAssignments();
    } catch (error: any) {
      console.error('Error assigning org SOP:', error);
      Alert.alert('Error', 'Failed to assign SOP');
    }
  };

  // User Search Function
  const handleSearchUser = async () => {
    if (!userSearchEmail.trim()) {
      Alert.alert('Error', 'Please enter search query (name or email)');
      return;
    }

    try {
      setIsSearchingUser(true);
      const token = await getToken();
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/api/admin/all-users`, {
        params: { search: userSearchEmail, limit: 10 },
        headers: { Authorization: `Bearer ${token}` }
      });

      setSearchResults(response.data.users || []);
      if (response.data.users.length === 0) {
        Alert.alert('No Results', 'No users found matching your search');
      }
    } catch (error: any) {
      console.error('Error searching user:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to search users');
    } finally {
      setIsSearchingUser(false);
    }
  };

  // Select user for management actions
  const handleSelectUserForAction = async (user: any) => {
    setSelectedUserForAction(user);
    setShowUserModal(true);
    // Fetch user details and notes
    try {
      const token = await getToken();
      if (!token) return;

      const [detailsRes, notesRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/admin/users/${user.id}/details`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BASE_URL}/api/admin/users/${user.id}/notes`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setSelectedUserForAction({ ...user, ...detailsRes.data.user, adminInfo: detailsRes.data.adminInfo });
      setUserNotes(notesRes.data.notes || []);
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  // Gift Credits Function
  const handleGiftCredits = async () => {
    if (!selectedUserForAction || !giftCreditsAmount) {
      Alert.alert('Error', 'Please enter credits amount');
      return;
    }

    const credits = parseInt(giftCreditsAmount);
    if (isNaN(credits) || credits <= 0 || credits > 100) {
      Alert.alert('Error', 'Credits must be between 1 and 100');
      return;
    }

    try {
      setIsActionLoading(true);
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/users/${selectedUserForAction.id}/gift-credits`, {
        credits,
        reason: giftCreditsReason || undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', `${credits} credits gifted to ${selectedUserForAction.name || selectedUserForAction.email}`);
      setGiftCreditsAmount('5');
      setGiftCreditsReason('');
      // Refresh user details
      handleSelectUserForAction(selectedUserForAction);
    } catch (error: any) {
      console.error('Error gifting credits:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to gift credits');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Reset Trial Function
  const handleResetTrial = async () => {
    if (!selectedUserForAction) return;

    Alert.alert(
      'Reset Trial',
      `This will reset the usage counter for ${selectedUserForAction.name || selectedUserForAction.email}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            try {
              setIsActionLoading(true);
              const token = await getToken();
              if (!token) return;

              await axios.post(`${BASE_URL}/api/admin/users/${selectedUserForAction.id}/reset-trial`, {
                reason: resetTrialReason || undefined
              }, {
                headers: { Authorization: `Bearer ${token}` }
              });

              Alert.alert('Success', 'Trial usage reset successfully');
              setResetTrialReason('');
              handleSelectUserForAction(selectedUserForAction);
            } catch (error: any) {
              console.error('Error resetting trial:', error);
              Alert.alert('Error', error.response?.data?.message || 'Failed to reset trial');
            } finally {
              setIsActionLoading(false);
            }
          }
        }
      ]
    );
  };

  // Add Admin Note Function
  const handleAddNote = async () => {
    if (!selectedUserForAction || !adminNote.trim()) {
      Alert.alert('Error', 'Please enter a note');
      return;
    }

    try {
      setIsActionLoading(true);
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/users/${selectedUserForAction.id}/notes`, {
        note: adminNote.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', 'Note added successfully');
      setAdminNote('');
      // Refresh notes
      const notesRes = await axios.get(`${BASE_URL}/api/admin/users/${selectedUserForAction.id}/notes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserNotes(notesRes.data.notes || []);
    } catch (error: any) {
      console.error('Error adding note:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to add note');
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Admin Diagnostics */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Admin Diagnostics</Text>
        <View style={styles.diagnosticRow}>
          <Text style={styles.diagnosticLabel}>Admin:</Text>
          <Text style={styles.diagnosticValue}>{adminName}</Text>
        </View>
        <View style={styles.diagnosticRow}>
          <Text style={styles.diagnosticLabel}>Selected State:</Text>
          <Text style={styles.diagnosticValue}>{selectedState}</Text>
        </View>
        <View style={styles.diagnosticRow}>
          <Text style={styles.diagnosticLabel}>User ID:</Text>
          <Text style={styles.diagnosticValue}>{userId?.substring(0, 20)}...</Text>
        </View>
      </View>

      {/* Ad Manager */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ad Manager</Text>
        <Text style={styles.cardSubtitle}>Create and manage advertisement banners</Text>

        {/* Create New Ad */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Create New Ad</Text>
          <TextInput
            style={styles.input}
            placeholder="Ad Title *"
            value={newAd.title}
            onChangeText={(text) => setNewAd({ ...newAd, title: text })}
            placeholderTextColor={COLORS.textSecondary}
          />
          <TextInput
            style={styles.input}
            placeholder="Subtitle (optional)"
            value={newAd.subtitle}
            onChangeText={(text) => setNewAd({ ...newAd, subtitle: text })}
            placeholderTextColor={COLORS.textSecondary}
          />
          <TextInput
            style={styles.input}
            placeholder="Destination URL *"
            value={newAd.destinationUrl}
            onChangeText={(text) => setNewAd({ ...newAd, destinationUrl: text })}
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Image URL (optional)"
            value={newAd.imageUrl}
            onChangeText={(text) => setNewAd({ ...newAd, imageUrl: text })}
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.button} onPress={handleCreateAd}>
            <Text style={styles.buttonText}>Create Ad</Text>
          </TouchableOpacity>
        </View>

        {/* Current Ads */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Ads ({ads.length})</Text>
          {isLoadingAds ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : ads.length === 0 ? (
            <Text style={styles.emptyText}>No ads created yet</Text>
          ) : (
            ads.map((ad) => (
              <View key={ad.id} style={styles.adItem}>
                <View style={styles.adItemHeader}>
                  <Text style={styles.adItemTitle}>{ad.title}</Text>
                  <View style={styles.adItemActions}>
                    <Switch
                      value={ad.status === 'active'}
                      onValueChange={() => handleToggleAdStatus(ad.id, ad.status)}
                      trackColor={{ false: '#E0E0E0', true: COLORS.primary }}
                    />
                    <TouchableOpacity onPress={() => handleDeleteAd(ad.id)}>
                      <Trash2 size={20} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                </View>
                {ad.subtitle && <Text style={styles.adItemSubtitle}>{ad.subtitle}</Text>}
                <Text style={styles.adItemUrl}>{ad.destination_url}</Text>
              </View>
            ))
          )}
        </View>
      </View>

      {/* State SOP Documents */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>State SOP Documents</Text>
        <Text style={styles.cardSubtitle}>Manage state-specific SOPs</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Select State</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedStateSop}
              onValueChange={(value) => setSelectedStateSop(value)}
              style={styles.picker}
            >
              {US_STATES.map((state) => (
                <Picker.Item key={state.value} label={`${state.value} - ${state.label}`} value={state.value} />
              ))}
            </Picker>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleUploadSop}>
            <Upload size={16} color="#FFFFFF" />
            <Text style={styles.buttonText}>Upload SOP Document</Text>
          </TouchableOpacity>

          {sopDocuments.length > 0 && (
            <View style={styles.documentsList}>
              <Text style={styles.sectionTitle}>Available Documents</Text>
              {sopDocuments.slice(0, 5).map((doc) => (
                <View key={doc.id} style={styles.documentItem}>
                  <FileText size={16} color={COLORS.primary} />
                  <Text style={styles.documentName}>{doc.document_name}</Text>
                  <TouchableOpacity onPress={() => handleAssignStateSop(doc.id)}>
                    <Text style={styles.assignButton}>Assign to {selectedStateSop}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Organization SOP Documents */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Organization SOP Documents</Text>
        <Text style={styles.cardSubtitle}>Manage organization-specific SOPs</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Select Organization</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedOrgSop}
              onValueChange={(value) => setSelectedOrgSop(value)}
              style={styles.picker}
            >
              {ORGANIZATIONS.map((org) => (
                <Picker.Item key={org} label={org} value={org} />
              ))}
            </Picker>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleUploadSop}>
            <Upload size={16} color="#FFFFFF" />
            <Text style={styles.buttonText}>Upload SOP Document</Text>
          </TouchableOpacity>

          {sopDocuments.length > 0 && (
            <View style={styles.documentsList}>
              <Text style={styles.sectionTitle}>Available Documents</Text>
              {sopDocuments.slice(0, 5).map((doc) => (
                <View key={doc.id} style={styles.documentItem}>
                  <FileText size={16} color={COLORS.primary} />
                  <Text style={styles.documentName}>{doc.document_name}</Text>
                  <TouchableOpacity onPress={() => handleAssignOrgSop(doc.id)}>
                    <Text style={styles.assignButton}>Assign to {selectedOrgSop}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Recent Assignments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Assignments</Text>
          {sopAssignments.length === 0 ? (
            <Text style={styles.emptyText}>No assignments yet</Text>
          ) : (
            sopAssignments.slice(0, 5).map((assignment, index) => (
              <View key={index} style={styles.assignmentItem}>
                <Text style={styles.assignmentText}>
                  {assignment.document_name} → {assignment.assignment_type === 'state' ? 'State' : 'Org'}: {assignment.assignment_value}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      {/* User Search */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>User Management</Text>
        <Text style={styles.cardSubtitle}>Find and manage user accounts, gift credits, reset trials</Text>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email..."
            value={userSearchEmail}
            onChangeText={setUserSearchEmail}
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
          />
          <TouchableOpacity 
            style={styles.searchButton} 
            onPress={handleSearchUser}
            disabled={isSearchingUser}
          >
            {isSearchingUser ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <View style={styles.searchResultsList}>
            <Text style={styles.sectionTitle}>Search Results ({searchResults.length})</Text>
            {searchResults.map((user) => (
              <TouchableOpacity 
                key={user.id} 
                style={styles.userResultItem}
                onPress={() => handleSelectUserForAction(user)}
              >
                <View style={styles.userResultInfo}>
                  <Text style={styles.userResultName}>{user.name || 'No Name'}</Text>
                  <Text style={styles.userResultEmail}>{user.email}</Text>
                  <Text style={styles.userResultMeta}>
                    Inspections: {user.inspectionCount || 0} | State: {user.state || 'N/A'}
                  </Text>
                </View>
                <Text style={styles.manageButton}>Manage →</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* User Management Modal */}
      <Modal
        visible={showUserModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUserModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView style={styles.modalScroll}>
              {selectedUserForAction && (
                <>
                  {/* User Header */}
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                      {selectedUserForAction.name || 'User'}
                    </Text>
                    <Text style={styles.modalSubtitle}>{selectedUserForAction.email}</Text>
                    <TouchableOpacity 
                      style={styles.modalCloseBtn}
                      onPress={() => setShowUserModal(false)}
                    >
                      <X size={24} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  {/* User Stats */}
                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <Text style={styles.statValue}>{selectedUserForAction.statements_used || 0}</Text>
                      <Text style={styles.statLabel}>Used</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statValue}>{selectedUserForAction.statements_limit || 5}</Text>
                      <Text style={styles.statLabel}>Limit</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statValue}>{selectedUserForAction.plan_type || 'free'}</Text>
                      <Text style={styles.statLabel}>Plan</Text>
                    </View>
                  </View>

                  {/* Gift Credits */}
                  <View style={styles.actionSection}>
                    <Text style={styles.actionTitle}>Gift Credits</Text>
                    <View style={styles.actionRow}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder="Amount (1-100)"
                        value={giftCreditsAmount}
                        onChangeText={setGiftCreditsAmount}
                        keyboardType="numeric"
                        placeholderTextColor={COLORS.textSecondary}
                      />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Reason (optional)"
                      value={giftCreditsReason}
                      onChangeText={setGiftCreditsReason}
                      placeholderTextColor={COLORS.textSecondary}
                    />
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.giftBtn]}
                      onPress={handleGiftCredits}
                      disabled={isActionLoading}
                    >
                      <Text style={styles.actionBtnText}>
                        {isActionLoading ? 'Processing...' : 'Gift Credits'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Reset Trial */}
                  <View style={styles.actionSection}>
                    <Text style={styles.actionTitle}>Reset Trial</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Reason (optional)"
                      value={resetTrialReason}
                      onChangeText={setResetTrialReason}
                      placeholderTextColor={COLORS.textSecondary}
                    />
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.resetBtn]}
                      onPress={handleResetTrial}
                      disabled={isActionLoading}
                    >
                      <Text style={styles.actionBtnText}>Reset Usage to 0</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Admin Notes */}
                  <View style={styles.actionSection}>
                    <Text style={styles.actionTitle}>Admin Notes ({userNotes.length})</Text>
                    <TextInput
                      style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                      placeholder="Add a note about this user..."
                      value={adminNote}
                      onChangeText={setAdminNote}
                      multiline
                      placeholderTextColor={COLORS.textSecondary}
                    />
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.noteBtn]}
                      onPress={handleAddNote}
                      disabled={isActionLoading}
                    >
                      <Text style={styles.actionBtnText}>Add Note</Text>
                    </TouchableOpacity>

                    {/* Notes List */}
                    {userNotes.length > 0 && (
                      <View style={styles.notesList}>
                        {userNotes.slice(0, 5).map((note: any) => (
                          <View key={note.id} style={styles.noteItem}>
                            <Text style={styles.noteText}>{note.note}</Text>
                            <Text style={styles.noteMeta}>
                              {note.admin_email} - {new Date(note.created_at).toLocaleDateString()}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Admin Utilities */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Admin Utilities</Text>
        <Text style={styles.cardSubtitle}>Advanced administrative tools</Text>

        <TouchableOpacity style={[styles.button, styles.utilityButton]}>
          <Text style={styles.buttonText}>Reset Usage Counters</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.utilityButton]}>
          <Text style={styles.buttonText}>View Audit Trail</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.utilityButton]}>
          <Text style={styles.buttonText}>Export User Data</Text>
        </TouchableOpacity>
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
  card: {
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
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  diagnosticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  diagnosticLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  diagnosticValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: '#FFFFFF',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  utilityButton: {
    marginTop: 8,
    backgroundColor: '#757575',
  },
  adItem: {
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 8,
  },
  adItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  adItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
  adItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adItemSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  adItemUrl: {
    fontSize: 12,
    color: COLORS.primary,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  picker: {
    height: 50,
  },
  documentsList: {
    marginTop: 16,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 8,
  },
  documentName: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  assignButton: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  assignmentItem: {
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    marginBottom: 8,
  },
  assignmentText: {
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: '#FFFFFF',
  },
  searchButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  userCard: {
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  userActions: {
    flexDirection: 'row',
    gap: 12,
  },
  userActionButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  userActionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  // New styles for user management
  searchResultsList: {
    marginTop: 16,
  },
  userResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 8,
  },
  userResultInfo: {
    flex: 1,
  },
  userResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  userResultEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  userResultMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  manageButton: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalScroll: {
    padding: 20,
  },
  modalHeader: {
    marginBottom: 20,
    position: 'relative',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    paddingVertical: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
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
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  giftBtn: {
    backgroundColor: '#28a745',
  },
  resetBtn: {
    backgroundColor: '#dc3545',
  },
  noteBtn: {
    backgroundColor: COLORS.primary,
  },
  notesList: {
    marginTop: 16,
  },
  noteItem: {
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 8,
  },
  noteText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  noteMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default SopManagementTab;

