import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch, ActivityIndicator, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth, useUser } from '@clerk/clerk-expo';
import axios from 'axios';
import { BASE_URL } from '../../config/api';
import { COLORS } from '../../styles/colors';
import { Upload, Trash2, Eye, Copy, Check, X, FileText, Users, Settings as SettingsIcon } from 'lucide-react-native';
import { US_STATES } from '../../context/GlobalStateContext';

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
  
  // User Search
  const [userSearchEmail, setUserSearchEmail] = useState('');
  const [searchedUser, setSearchedUser] = useState<any>(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);

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

  const handleUploadSop = () => {
    Alert.alert(
      'Upload SOP',
      'SOP document upload integration with file picker will be available soon. For now, please provide the document URL.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Enter URL',
          onPress: () => {
            // In a real implementation, this would open a file picker or URL input modal
            Alert.alert('Feature Coming Soon', 'File upload integration is in progress');
          }
        }
      ]
    );
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
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    try {
      setIsSearchingUser(true);
      const token = await getToken();
      if (!token) return;

      // This would need a new endpoint in the backend
      // For now, showing placeholder
      Alert.alert('Feature Coming Soon', 'User search integration is in progress');
      setSearchedUser(null);
    } catch (error: any) {
      console.error('Error searching user:', error);
      Alert.alert('Error', 'Failed to search user');
    } finally {
      setIsSearchingUser(false);
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
                <Picker.Item key={state} label={state} value={state} />
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
        <Text style={styles.cardTitle}>User Search</Text>
        <Text style={styles.cardSubtitle}>Find and manage user accounts</Text>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Enter user email..."
            value={userSearchEmail}
            onChangeText={setUserSearchEmail}
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
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

        {searchedUser && (
          <View style={styles.userCard}>
            <Text style={styles.userName}>{searchedUser.name}</Text>
            <Text style={styles.userEmail}>{searchedUser.email}</Text>
            <View style={styles.userActions}>
              <TouchableOpacity style={styles.userActionButton}>
                <Text style={styles.userActionButtonText}>View Inspections</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.userActionButton}>
                <Text style={styles.userActionButtonText}>Manage Subscription</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

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
});

export default SopManagementTab;

