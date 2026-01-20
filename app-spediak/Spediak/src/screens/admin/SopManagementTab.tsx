import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  ActivityIndicator, 
  Platform,
  Linking
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { BASE_URL } from '../../config/api';
import { COLORS } from '../../styles/colors';
import { Upload, FileText, Check, Plus, Trash2, History, ChevronDown, X, Eye } from 'lucide-react-native';
import { US_STATES } from '../../context/GlobalStateContext';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useAppNavigation } from '../../context/AppNavigationContext';

// Helper function to read file as base64
const readFileAsBase64 = async (fileUri: string, mimeType?: string): Promise<string> => {
  if (Platform.OS === 'web') {
    try {
      const response = await fetch(fileUri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error reading file on web:', error);
      throw error;
    }
  } else {
    return await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
};

interface SopAssignment {
  id: number;
  document_id: number;
  assignment_type: 'state' | 'organization';
  assignment_value: string;
  document_name?: string;
  file_url?: string;
  created_at?: string;
}

interface SopDocument {
  id: number;
  document_name: string;
  document_type: string;
  file_url: string;
  extraction_status: string;
  created_at: string;
}

interface Organization {
  id: number;
  name: string;
  created_at: string;
}

interface DefaultSopSettings {
  id?: number;
  defaultDocumentId: number | null;
  documentName: string | null;
  excludedStates: string[];
}

const SopManagementTab: React.FC = () => {
  const { getToken } = useAuth();
  const navigation = useNavigation<any>();
  const { navigateTo, isWebDesktop } = useAppNavigation();
  
  // Default SOP Settings
  const [defaultSopSettings, setDefaultSopSettings] = useState<DefaultSopSettings>({
    defaultDocumentId: null,
    documentName: null,
    excludedStates: []
  });
  const [savingDefaultSop, setSavingDefaultSop] = useState(false);
  const [selectedDefaultDoc, setSelectedDefaultDoc] = useState<number | null>(null);
  
  // State SOP Management
  const [selectedState, setSelectedState] = useState<string>('NC');
  const [stateDocumentFile, setStateDocumentFile] = useState<any>(null);
  const [stateDocumentName, setStateDocumentName] = useState('');
  const [uploadingStateDoc, setUploadingStateDoc] = useState(false);
  const [assigningState, setAssigningState] = useState(false);
  
  // Organization SOP Management
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [newOrgName, setNewOrgName] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [orgDocumentFile, setOrgDocumentFile] = useState<any>(null);
  const [orgDocumentName, setOrgDocumentName] = useState('');
  const [uploadingOrgDoc, setUploadingOrgDoc] = useState(false);
  const [assigningOrg, setAssigningOrg] = useState(false);
  const [addingOrg, setAddingOrg] = useState(false);
  
  // Data
  const [sopDocuments, setSopDocuments] = useState<SopDocument[]>([]);
  const [sopAssignments, setSopAssignments] = useState<SopAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Last uploaded document IDs for assignment
  const [lastUploadedStateDocId, setLastUploadedStateDocId] = useState<number | null>(null);
  const [lastUploadedOrgDocId, setLastUploadedOrgDocId] = useState<number | null>(null);
  
  // Assign existing document feature
  const [selectedExistingDocForState, setSelectedExistingDocForState] = useState<number | null>(null);
  const [selectedExistingDocForOrg, setSelectedExistingDocForOrg] = useState<number | null>(null);
  const [assigningExistingState, setAssigningExistingState] = useState(false);
  const [assigningExistingOrg, setAssigningExistingOrg] = useState(false);

  // Deleting states
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);
  const [removingAssignmentId, setRemovingAssignmentId] = useState<number | null>(null);
  const [deletingOrgId, setDeletingOrgId] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
    fetchOrganizations();
    fetchDefaultSopSettings();
  }, []);

  const fetchDefaultSopSettings = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      
      const response = await axios.get(`${BASE_URL}/api/admin/sop/default-settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const settings = response.data;
      setDefaultSopSettings(settings);
      setSelectedDefaultDoc(settings.defaultDocumentId);
    } catch (error) {
      console.log('Error fetching default SOP settings:', error);
    }
  };

  const handleSaveDefaultSop = async () => {
    try {
      setSavingDefaultSop(true);
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      
      await axios.put(`${BASE_URL}/api/admin/sop/default-settings`, {
        defaultDocumentId: selectedDefaultDoc,
        excludedStates: defaultSopSettings.excludedStates
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      await fetchDefaultSopSettings();
      Alert.alert('Success', 'Default SOP settings saved');
    } catch (error: any) {
      console.error('Error saving default SOP:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to save default SOP settings');
    } finally {
      setSavingDefaultSop(false);
    }
  };

  const toggleStateExclusion = (stateCode: string) => {
    const currentExcluded = defaultSopSettings.excludedStates || [];
    if (currentExcluded.includes(stateCode)) {
      setDefaultSopSettings({
        ...defaultSopSettings,
        excludedStates: currentExcluded.filter(s => s !== stateCode)
      });
    } else {
      setDefaultSopSettings({
        ...defaultSopSettings,
        excludedStates: [...currentExcluded, stateCode]
      });
    }
  };

  const fetchOrganizations = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      
      const response = await axios.get(`${BASE_URL}/api/admin/sop/organizations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const orgs = response.data.organizations || [];
      setOrganizations(orgs);
      
      // Set first org as selected if none selected
      if (orgs.length > 0 && !selectedOrg) {
        setSelectedOrg(orgs[0].name);
      }
    } catch (error) {
      console.log('Error fetching organizations:', error);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    await Promise.all([fetchSopDocuments(), fetchSopAssignments()]);
    setIsLoading(false);
  };

  const fetchSopDocuments = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/api/sop/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSopDocuments(response.data.documents || []);
    } catch (error: any) {
      console.log('Error fetching SOP documents:', error.message);
      setSopDocuments([]);
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
      console.log('Error fetching SOP assignments:', error.message);
      setSopAssignments([]);
    }
  };

  // Get current assignment for a state
  const getStateAssignment = (state: string): SopAssignment | undefined => {
    return sopAssignments.find(a => a.assignment_type === 'state' && a.assignment_value === state);
  };

  // Get current assignment for an organization
  const getOrgAssignment = (org: string): SopAssignment | undefined => {
    return sopAssignments.find(a => a.assignment_type === 'organization' && a.assignment_value === org);
  };

  // Get recent state assignments (max 5)
  const getRecentStateAssignments = (): SopAssignment[] => {
    return sopAssignments
      .filter(a => a.assignment_type === 'state')
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 10);
  };

  // Pick document for state SOP
  const handlePickStateDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain'],
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setStateDocumentFile(file);
        if (!stateDocumentName) {
          setStateDocumentName(file.name.replace(/\.[^/.]+$/, ''));
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  // Upload and assign state document
  const handleUploadStateDocument = async () => {
    if (!stateDocumentFile) {
      Alert.alert('Error', 'Please select a document first');
      return;
    }

    try {
      setUploadingStateDoc(true);
      const token = await getToken();
      if (!token) return;

      const base64 = await readFileAsBase64(stateDocumentFile.uri, stateDocumentFile.mimeType);

      const response = await axios.post(`${BASE_URL}/api/admin/sop/upload`, {
        documentName: stateDocumentName || stateDocumentFile.name,
        documentType: 'state',
        fileBase64: base64
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const uploadedDoc = response.data.document;
      
      // Auto-assign to the selected state
      await axios.post(`${BASE_URL}/api/admin/sop/assign-state`, {
        documentId: uploadedDoc.id,
        state: selectedState
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', `SOP uploaded and assigned to ${selectedState}`);
      setStateDocumentFile(null);
      setStateDocumentName('');
      fetchData();
    } catch (error: any) {
      console.error('Error uploading document:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploadingStateDoc(false);
    }
  };

  // Add new organization
  const handleAddOrganization = async () => {
    const trimmedName = newOrgName.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Please enter an organization name');
      return;
    }

    const exists = organizations.some(o => o.name.toLowerCase() === trimmedName.toLowerCase());
    if (exists) {
      Alert.alert('Error', 'Organization already exists');
      return;
    }

    try {
      setAddingOrg(true);
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      
      const response = await axios.post(`${BASE_URL}/api/admin/sop/organizations`, 
        { name: trimmedName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh organizations from backend
      await fetchOrganizations();
      setSelectedOrg(trimmedName);
      setNewOrgName('');
      
      Alert.alert('Success', `Organization "${trimmedName}" added`);
    } catch (error: any) {
      console.error('Error adding organization:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to add organization');
    } finally {
      setAddingOrg(false);
    }
  };

  // Delete organization
  const handleDeleteOrganization = async (org: Organization) => {
    const doDelete = async () => {
      try {
        setDeletingOrgId(org.id);
        const token = await getToken();
        if (!token) throw new Error('Not authenticated');
        
        await axios.delete(`${BASE_URL}/api/admin/sop/organizations/${org.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        await fetchOrganizations();
        await fetchSopAssignments();
        
        if (selectedOrg === org.name) {
          setSelectedOrg(organizations[0]?.name || '');
        }
        
        Alert.alert('Success', 'Organization deleted');
      } catch (error: any) {
        console.error('Error deleting organization:', error);
        Alert.alert('Error', error.response?.data?.message || 'Failed to delete organization');
      } finally {
        setDeletingOrgId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${org.name}"? This will also remove any SOP assignments.`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Organization',
        `Delete "${org.name}"? This will also remove any SOP assignments.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete }
        ]
      );
    }
  };

  // Delete SOP Document
  const handleDeleteDocument = async (docId: number, docName: string) => {
    const doDelete = async () => {
      try {
        setDeletingDocId(docId);
        const token = await getToken();
        if (!token) throw new Error('Not authenticated');
        
        await axios.delete(`${BASE_URL}/api/admin/sop/documents/${docId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        await fetchData();
        Alert.alert('Success', `Document "${docName}" deleted`);
      } catch (error: any) {
        console.error('Error deleting document:', error);
        Alert.alert('Error', error.response?.data?.message || 'Failed to delete document');
      } finally {
        setDeletingDocId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${docName}"? This will also remove any assignments.`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Document',
        `Delete "${docName}"? This will also remove any assignments.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete }
        ]
      );
    }
  };

  // Pick document for organization SOP
  const handlePickOrgDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain'],
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setOrgDocumentFile(file);
        if (!orgDocumentName) {
          setOrgDocumentName(file.name.replace(/\.[^/.]+$/, ''));
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  // Upload and assign organization document
  const handleUploadOrgDocument = async () => {
    if (!orgDocumentFile) {
      Alert.alert('Error', 'Please select a document first');
      return;
    }
    if (!selectedOrg) {
      Alert.alert('Error', 'Please select or add an organization first');
      return;
    }

    try {
      setUploadingOrgDoc(true);
      const token = await getToken();
      if (!token) return;

      const base64 = await readFileAsBase64(orgDocumentFile.uri, orgDocumentFile.mimeType);

      const response = await axios.post(`${BASE_URL}/api/admin/sop/upload`, {
        documentName: orgDocumentName || orgDocumentFile.name,
        documentType: 'organization',
        fileBase64: base64
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const uploadedDoc = response.data.document;
      
      // Auto-assign to the selected organization
      await axios.post(`${BASE_URL}/api/admin/sop/assign-org`, {
        documentId: uploadedDoc.id,
        organization: selectedOrg
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', `SOP uploaded and assigned to ${selectedOrg}`);
      setOrgDocumentFile(null);
      setOrgDocumentName('');
      fetchData();
    } catch (error: any) {
      console.error('Error uploading document:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploadingOrgDoc(false);
    }
  };

  // Assign existing document to state
  const handleAssignExistingToState = async () => {
    if (!selectedExistingDocForState) {
      Alert.alert('Error', 'Please select a document first');
      return;
    }

    try {
      setAssigningExistingState(true);
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/sop/assign-state`, {
        documentId: selectedExistingDocForState,
        state: selectedState
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', `Document assigned to ${selectedState}`);
      setSelectedExistingDocForState(null);
      fetchSopAssignments();
    } catch (error: any) {
      console.error('Error assigning existing SOP to state:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to assign document');
    } finally {
      setAssigningExistingState(false);
    }
  };

  // Assign existing document to organization
  const handleAssignExistingToOrg = async () => {
    if (!selectedExistingDocForOrg) {
      Alert.alert('Error', 'Please select a document first');
      return;
    }
    if (!selectedOrg) {
      Alert.alert('Error', 'Please select an organization first');
      return;
    }

    try {
      setAssigningExistingOrg(true);
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/sop/assign-org`, {
        documentId: selectedExistingDocForOrg,
        organization: selectedOrg
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', `Document assigned to ${selectedOrg}`);
      setSelectedExistingDocForOrg(null);
      fetchSopAssignments();
    } catch (error: any) {
      console.error('Error assigning existing SOP to org:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to assign document');
    } finally {
      setAssigningExistingOrg(false);
    }
  };

  // View SOP history
  const handleViewHistory = () => {
    try {
      navigateTo('SopHistory');
    } catch (error) {
      console.error('Error navigating to SOP History:', error);
    }
  };

  // View document in browser
  const handleViewDocument = async (fileUrl: string) => {
    try {
      if (Platform.OS === 'web') {
        const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
        window.open(viewerUrl, '_blank');
      } else {
        const canOpen = await Linking.canOpenURL(fileUrl);
        if (canOpen) {
          await Linking.openURL(fileUrl);
        } else {
          Alert.alert('Error', 'Cannot open this file URL');
        }
      }
    } catch (error) {
      console.error('Error opening document:', error);
      Alert.alert('Error', 'Failed to open document');
    }
  };

  // Remove SOP assignment
  const handleRemoveAssignment = async (assignmentId: number, assignmentValue: string) => {
    const doRemove = async () => {
      try {
        setRemovingAssignmentId(assignmentId);
        const token = await getToken();
        await axios.delete(`${BASE_URL}/api/admin/sop/assignments/${assignmentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        await fetchData();
        Alert.alert('Success', 'Assignment removed');
      } catch (error) {
        console.error('Error removing SOP assignment:', error);
        Alert.alert('Error', 'Failed to remove assignment');
      } finally {
        setRemovingAssignmentId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Remove SOP assignment for ${assignmentValue}?`)) {
        await doRemove();
      }
    } else {
      Alert.alert(
        'Confirm Removal',
        `Remove SOP assignment for ${assignmentValue}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: doRemove }
        ]
      );
    }
  };

  const currentStateAssignment = getStateAssignment(selectedState);
  const recentStateAssignments = getRecentStateAssignments();
  
  // Check if state is excluded from default
  const isStateExcludedFromDefault = defaultSopSettings.excludedStates?.includes(selectedState);
  
  // Get default SOP info for display
  const hasDefaultSop = defaultSopSettings.defaultDocumentId && !isStateExcludedFromDefault;
  const defaultSopName = defaultSopSettings.documentName;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading SOP data...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* ============== STATE SOP DOCUMENTS ============== */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>State SOP Documents</Text>
        <Text style={styles.cardDescription}>
          Upload and assign state-specific Standards of Practice.
        </Text>

        {/* Step 1: Select State */}
        <Text style={styles.stepLabel}>1) Select state to manage</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedState}
            onValueChange={(value) => setSelectedState(value)}
            style={styles.picker}
          >
            {US_STATES.map((state) => (
              <Picker.Item key={state.value} label={state.value} value={state.value} />
            ))}
          </Picker>
          <ChevronDown size={20} color={COLORS.textSecondary} style={styles.pickerIcon} />
        </View>

        {/* Show current assignments for this state */}
        <View style={styles.assignmentsForState}>
          {/* Default SOP (if applicable) */}
          {hasDefaultSop && (
            <View style={styles.defaultAssignmentBanner}>
              <Text style={styles.defaultAssignmentLabel}>Default:</Text>
              <Text style={styles.defaultAssignmentText} numberOfLines={1}>
                {defaultSopName}
              </Text>
            </View>
          )}
          
          {/* Manual Assignment */}
          {currentStateAssignment ? (
            <View style={styles.currentAssignment}>
              <Text style={styles.manualAssignmentLabel}>State-specific:</Text>
              <Text style={styles.currentAssignmentText} numberOfLines={1}>
                {currentStateAssignment.document_name || 'Document assigned'}
              </Text>
              {currentStateAssignment.file_url && (
                <TouchableOpacity 
                  style={styles.viewButton}
                  onPress={() => handleViewDocument(currentStateAssignment.file_url!)}
                >
                  <Eye size={14} color={COLORS.primary} />
                  <Text style={styles.viewButtonText}>View</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : !hasDefaultSop ? (
            <View style={styles.noAssignmentBanner}>
              <Text style={styles.noAssignmentText}>No SOP assigned to {selectedState}</Text>
            </View>
          ) : null}
        </View>

        {/* Step 2: Upload / Name Document */}
        <Text style={styles.stepLabel}>2) Upload a new document</Text>
        
        <TextInput
          style={styles.textInput}
          placeholder="Document name (optional)"
          value={stateDocumentName}
          onChangeText={setStateDocumentName}
          placeholderTextColor="#9CA3AF"
        />

        {stateDocumentFile && (
          <View style={styles.selectedFile}>
            <FileText size={16} color={COLORS.primary} />
            <Text style={styles.selectedFileName} numberOfLines={1}>
              {stateDocumentFile.name}
            </Text>
            <TouchableOpacity onPress={() => { setStateDocumentFile(null); setStateDocumentName(''); }}>
              <X size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.primaryButton, styles.buttonHalf]} 
            onPress={handlePickStateDocument}
          >
            <Upload size={16} color="#fff" />
            <Text style={styles.primaryButtonText}>Select PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.successButton, 
              styles.buttonHalf,
              !stateDocumentFile && styles.buttonDisabled
            ]} 
            onPress={handleUploadStateDocument}
            disabled={!stateDocumentFile || uploadingStateDoc}
          >
            {uploadingStateDoc ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.successButtonText}>Upload & Assign</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Assign Existing Document */}
        <Text style={styles.stepLabel}>OR assign an existing document</Text>
        {sopDocuments.length > 0 ? (
          <View>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedExistingDocForState}
                onValueChange={(value) => setSelectedExistingDocForState(value)}
                style={styles.picker}
              >
                <Picker.Item label="Select document..." value={null} />
                {sopDocuments.map((doc) => (
                  <Picker.Item 
                    key={doc.id} 
                    label={doc.document_name} 
                    value={doc.id} 
                  />
                ))}
              </Picker>
              <ChevronDown size={20} color={COLORS.textSecondary} style={styles.pickerIcon} />
            </View>
            <TouchableOpacity 
              style={[styles.primaryButton, !selectedExistingDocForState && styles.buttonDisabled]} 
              onPress={handleAssignExistingToState}
              disabled={!selectedExistingDocForState || assigningExistingState}
            >
              {assigningExistingState ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Assign to {selectedState}</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.noDataText}>No documents uploaded yet.</Text>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* All Uploaded Documents - IMPROVED LAYOUT */}
        <Text style={styles.sectionTitle}>All Uploaded Documents</Text>
        {sopDocuments.length > 0 ? (
          <View style={styles.documentList}>
            {sopDocuments.map((doc) => (
              <View key={doc.id} style={styles.documentItem}>
                <View style={styles.documentInfo}>
                  <Text style={styles.documentName} numberOfLines={1}>{doc.document_name}</Text>
                  <View style={styles.documentMeta}>
                    <View style={[
                      styles.documentTypeBadge, 
                      doc.document_type === 'state' ? styles.stateBadge : styles.orgBadge
                    ]}>
                      <Text style={styles.documentTypeBadgeText}>
                        {doc.document_type === 'state' ? 'STATE' : 'ORG'}
                      </Text>
                    </View>
                    <View style={[
                      styles.statusBadge,
                      doc.extraction_status === 'completed' ? styles.statusCompleted : 
                      doc.extraction_status === 'processing' ? styles.statusProcessing : 
                      styles.statusPending
                    ]}>
                      <Text style={styles.statusBadgeText}>{doc.extraction_status}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.documentActions}>
                  {doc.file_url && (
                    <TouchableOpacity 
                      style={styles.iconButton}
                      onPress={() => handleViewDocument(doc.file_url)}
                    >
                      <Eye size={18} color={COLORS.primary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    style={styles.iconButton}
                    onPress={() => handleDeleteDocument(doc.id, doc.document_name)}
                    disabled={deletingDocId === doc.id}
                  >
                    {deletingDocId === doc.id ? (
                      <ActivityIndicator size="small" color={COLORS.error} />
                    ) : (
                      <Trash2 size={18} color={COLORS.error} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noDataText}>No documents uploaded yet.</Text>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* States with SOP Assigned */}
        <Text style={styles.sectionTitle}>States with SOP assigned</Text>
        {recentStateAssignments.length > 0 ? (
          <View style={styles.assignmentList}>
            {recentStateAssignments.map((assignment, idx) => (
              <View key={idx} style={styles.assignmentItem}>
                <View style={styles.assignmentInfo}>
                  <Text style={styles.assignmentState}>{assignment.assignment_value}</Text>
                  <Text style={styles.assignmentDoc} numberOfLines={1}>
                    {assignment.document_name || 'Document'}
                  </Text>
                </View>
                <View style={styles.assignmentActions}>
                  {assignment.file_url && (
                    <TouchableOpacity 
                      style={styles.iconButton}
                      onPress={() => handleViewDocument(assignment.file_url!)}
                    >
                      <Eye size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    style={styles.iconButton}
                    onPress={() => handleRemoveAssignment(assignment.id, assignment.assignment_value)}
                    disabled={removingAssignmentId === assignment.id}
                  >
                    {removingAssignmentId === assignment.id ? (
                      <ActivityIndicator size="small" color={COLORS.error} />
                    ) : (
                      <Trash2 size={16} color={COLORS.error} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noDataText}>No state SOP assignments yet.</Text>
        )}

        {/* View History Button */}
        <TouchableOpacity style={styles.historyButton} onPress={handleViewHistory}>
          <History size={16} color={COLORS.primary} />
          <Text style={styles.historyButtonText}>View SOP Change History</Text>
        </TouchableOpacity>
      </View>

      {/* ============== DEFAULT SOP SETTINGS ============== */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Default SOP for All States</Text>
        <Text style={styles.cardDescription}>
          This document applies to all 50 US states by default. States with manually assigned SOPs will have both documents.
        </Text>

        {/* Current Default */}
        {defaultSopSettings.documentName ? (
          <View style={styles.currentDefaultBanner}>
            <Check size={16} color="#10B981" />
            <Text style={styles.currentDefaultText}>
              Current: <Text style={{ fontWeight: '700' }}>{defaultSopSettings.documentName}</Text>
            </Text>
          </View>
        ) : (
          <View style={styles.noAssignmentBanner}>
            <Text style={styles.noAssignmentText}>No default SOP configured</Text>
          </View>
        )}

        {/* Select Default Document */}
        <Text style={styles.stepLabel}>Select default document</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedDefaultDoc}
            onValueChange={(value) => setSelectedDefaultDoc(value)}
            style={styles.picker}
          >
            <Picker.Item label="Select document..." value={null} />
            {sopDocuments.map((doc) => (
              <Picker.Item key={doc.id} label={doc.document_name} value={doc.id} />
            ))}
          </Picker>
          <ChevronDown size={20} color={COLORS.textSecondary} style={styles.pickerIcon} />
        </View>

        {/* Excluded States */}
        <Text style={styles.stepLabel}>Exclude states from default</Text>
        <Text style={styles.hintText}>
          These states will NOT receive the default SOP (only manually assigned ones)
        </Text>
        <View style={styles.stateChipsContainer}>
          {US_STATES.map((state) => {
            const isExcluded = defaultSopSettings.excludedStates?.includes(state.value);
            return (
              <TouchableOpacity
                key={state.value}
                style={[
                  styles.stateChip,
                  isExcluded && styles.stateChipExcluded
                ]}
                onPress={() => toggleStateExclusion(state.value)}
              >
                <Text style={[
                  styles.stateChipText,
                  isExcluded && styles.stateChipTextExcluded
                ]}>
                  {state.value}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {defaultSopSettings.excludedStates?.length > 0 && (
          <Text style={styles.excludedCountText}>
            {defaultSopSettings.excludedStates.length} state(s) excluded
          </Text>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.successButton, savingDefaultSop && styles.buttonDisabled]}
          onPress={handleSaveDefaultSop}
          disabled={savingDefaultSop}
        >
          {savingDefaultSop ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.successButtonText}>Save Default SOP Settings</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ============== ORGANIZATION SOP DOCUMENTS ============== */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Organization SOP Documents</Text>
        <Text style={styles.cardDescription}>
          Manage organization-level SOP documents (e.g., InterNACHI, ASHI).
        </Text>

        {/* Add New Organization */}
        <Text style={styles.stepLabel}>Add new organization</Text>
        <View style={styles.addOrgRow}>
          <TextInput
            style={[styles.textInput, styles.addOrgInput]}
            placeholder="e.g., InterNACHI"
            value={newOrgName}
            onChangeText={setNewOrgName}
            placeholderTextColor="#9CA3AF"
          />
          <TouchableOpacity 
            style={[styles.addOrgButton, addingOrg && styles.buttonDisabled]}
            onPress={handleAddOrganization}
            disabled={addingOrg}
          >
            {addingOrg ? (
              <ActivityIndicator size="small" color="#374151" />
            ) : (
              <>
                <Plus size={16} color="#374151" />
                <Text style={styles.addOrgButtonText}>Add</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Select Organization */}
        <Text style={styles.stepLabel}>Select organization to manage</Text>
        {organizations.length > 0 ? (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedOrg}
              onValueChange={(value) => setSelectedOrg(value)}
              style={styles.picker}
            >
              {organizations.map((org) => (
                <Picker.Item key={org.id} label={org.name} value={org.name} />
              ))}
            </Picker>
            <ChevronDown size={20} color={COLORS.textSecondary} style={styles.pickerIcon} />
          </View>
        ) : (
          <Text style={styles.noDataText}>No organizations yet. Add one above.</Text>
        )}

        {/* Upload org document */}
        {selectedOrg && (
          <>
            <Text style={styles.stepLabel}>Upload document for {selectedOrg}</Text>
            
            {orgDocumentFile && (
              <View style={styles.selectedFile}>
                <FileText size={16} color={COLORS.primary} />
                <Text style={styles.selectedFileName} numberOfLines={1}>
                  {orgDocumentFile.name}
                </Text>
                <TouchableOpacity onPress={() => { setOrgDocumentFile(null); setOrgDocumentName(''); }}>
                  <X size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.primaryButton, styles.buttonHalf]} 
                onPress={handlePickOrgDocument}
              >
                <Upload size={16} color="#fff" />
                <Text style={styles.primaryButtonText}>Select PDF</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.successButton, 
                  styles.buttonHalf,
                  !orgDocumentFile && styles.buttonDisabled
                ]} 
                onPress={handleUploadOrgDocument}
                disabled={!orgDocumentFile || uploadingOrgDoc}
              >
                {uploadingOrgDoc ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.successButtonText}>Upload & Assign</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Assign Existing Document */}
            <View style={styles.divider} />
            <Text style={styles.stepLabel}>OR assign an existing document to {selectedOrg}</Text>
            {sopDocuments.length > 0 ? (
              <View>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedExistingDocForOrg}
                    onValueChange={(value) => setSelectedExistingDocForOrg(value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select document..." value={null} />
                    {sopDocuments.map((doc) => (
                      <Picker.Item 
                        key={doc.id} 
                        label={doc.document_name} 
                        value={doc.id} 
                      />
                    ))}
                  </Picker>
                  <ChevronDown size={20} color={COLORS.textSecondary} style={styles.pickerIcon} />
                </View>
                <TouchableOpacity 
                  style={[styles.primaryButton, !selectedExistingDocForOrg && styles.buttonDisabled]} 
                  onPress={handleAssignExistingToOrg}
                  disabled={!selectedExistingDocForOrg || assigningExistingOrg}
                >
                  {assigningExistingOrg ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Assign to {selectedOrg}</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.noDataText}>No documents uploaded yet.</Text>
            )}
          </>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Organizations List with Delete Option */}
        <Text style={styles.sectionTitle}>All Organizations</Text>
        {organizations.length > 0 ? (
          <View style={styles.orgList}>
            {organizations.map((org) => {
              const assignment = getOrgAssignment(org.name);
              return (
                <View key={org.id} style={styles.orgItem}>
                  <View style={styles.orgInfo}>
                    <Text style={styles.orgName}>{org.name}</Text>
                    <Text style={styles.orgStatus}>
                      {assignment ? `✓ ${assignment.document_name}` : 'No document assigned'}
                    </Text>
                  </View>
                  <View style={styles.orgActions}>
                    {assignment?.file_url && (
                      <TouchableOpacity 
                        style={styles.iconButton}
                        onPress={() => handleViewDocument(assignment.file_url!)}
                      >
                        <Eye size={16} color={COLORS.primary} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                      style={styles.iconButton}
                      onPress={() => handleDeleteOrganization(org)}
                      disabled={deletingOrgId === org.id}
                    >
                      {deletingOrgId === org.id ? (
                        <ActivityIndicator size="small" color={COLORS.error} />
                      ) : (
                        <Trash2 size={16} color={COLORS.error} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.noDataText}>No organizations yet.</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
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
  defaultSopCard: {
    borderWidth: 2,
    borderColor: '#10B981',
    backgroundColor: '#FAFFFC',
  },
  currentDefaultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  currentDefaultText: {
    fontSize: 14,
    color: '#065F46',
    flex: 1,
  },
  hintText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  stateChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  stateChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  stateChipExcluded: {
    backgroundColor: '#FEE2E2',
    borderColor: '#F87171',
  },
  stateChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  stateChipTextExcluded: {
    color: '#DC2626',
  },
  excludedCountText: {
    fontSize: 12,
    color: '#DC2626',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 48,
    justifyContent: 'center',
  },
  picker: {
    height: 48,
    color: '#1F2937',
    // @ts-ignore - Cross-browser compatible styles (Chrome, Safari, Firefox)
    ...(Platform.OS === 'web' && {
      WebkitAppearance: 'none',
      MozAppearance: 'none',
      appearance: 'none',
      backgroundColor: 'transparent',
      border: 'none',
      outline: 'none',
      width: '100%',
      fontSize: 15,
      paddingLeft: 14,
      paddingRight: 36,
      cursor: 'pointer',
    }),
  },
  pickerIcon: {
    position: 'absolute',
    right: 12,
    top: 14,
    pointerEvents: 'none',
  },
  assignmentsForState: {
    marginBottom: 16,
  },
  defaultAssignmentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  defaultAssignmentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4338CA',
  },
  defaultAssignmentText: {
    fontSize: 13,
    color: '#4338CA',
    flex: 1,
  },
  manualAssignmentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
    marginRight: 4,
  },
  currentAssignment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  currentAssignmentText: {
    fontSize: 13,
    color: '#065F46',
    flex: 1,
  },
  noAssignmentBanner: {
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  noAssignmentText: {
    fontSize: 13,
    color: '#92400E',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
    marginBottom: 12,
    minHeight: 48,
  },
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  selectedFileName: {
    fontSize: 13,
    color: COLORS.primary,
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  buttonHalf: {
    flex: 1,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  successButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  successButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  // Document List Styles - IMPROVED
  documentList: {
    gap: 8,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  documentInfo: {
    flex: 1,
    marginRight: 12,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  documentTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stateBadge: {
    backgroundColor: '#DBEAFE',
  },
  orgBadge: {
    backgroundColor: '#E0E7FF',
  },
  documentTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E40AF',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusCompleted: {
    backgroundColor: '#D1FAE5',
  },
  statusProcessing: {
    backgroundColor: '#FEF3C7',
  },
  statusPending: {
    backgroundColor: '#F3F4F6',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'capitalize',
  },
  documentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  // Assignment List Styles
  assignmentList: {
    gap: 8,
  },
  assignmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  assignmentInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  assignmentState: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    minWidth: 40,
  },
  assignmentDoc: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },
  assignmentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noDataText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  historyButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  addOrgRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  addOrgInput: {
    flex: 1,
    marginBottom: 0,
  },
  addOrgButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  addOrgButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
    gap: 4,
  },
  viewButtonText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  // Organization List
  orgList: {
    gap: 8,
  },
  orgItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  orgInfo: {
    flex: 1,
  },
  orgName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  orgStatus: {
    fontSize: 12,
    color: '#6B7280',
  },
  orgActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});

export default SopManagementTab;
