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
import { Upload, FileText, Check, Plus, Trash2, History, ChevronDown, X, File, Eye } from 'lucide-react-native';
import { US_STATES } from '../../context/GlobalStateContext';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useAppNavigation } from '../../context/AppNavigationContext';

// Helper function to read file as base64 (works on both web and native)
const readFileAsBase64 = async (fileUri: string, mimeType?: string): Promise<string> => {
  if (Platform.OS === 'web') {
    // On web, fetch the file and convert to base64
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
    // On native, use expo-file-system
    return await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
};

// Default organizations - can be extended by admin
const DEFAULT_ORGANIZATIONS = ['ASHI', 'InterNACHI'];

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

const SopManagementTab: React.FC = () => {
  const { getToken } = useAuth();
  const navigation = useNavigation<any>();
  const { navigateTo, isWebDesktop } = useAppNavigation();
  
  // State SOP Management
  const [selectedState, setSelectedState] = useState<string>('NC');
  const [stateDocumentFile, setStateDocumentFile] = useState<any>(null);
  const [stateDocumentName, setStateDocumentName] = useState('');
  const [uploadingStateDoc, setUploadingStateDoc] = useState(false);
  const [assigningState, setAssigningState] = useState(false);
  
  // Organization SOP Management
  const [organizations, setOrganizations] = useState<string[]>(DEFAULT_ORGANIZATIONS);
  const [newOrgName, setNewOrgName] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<string>('ASHI');
  const [orgDocumentFile, setOrgDocumentFile] = useState<any>(null);
  const [orgDocumentName, setOrgDocumentName] = useState('');
  const [uploadingOrgDoc, setUploadingOrgDoc] = useState(false);
  const [assigningOrg, setAssigningOrg] = useState(false);
  
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

  useEffect(() => {
    fetchData();
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const token = await getToken();
      if (!token) {
        setOrganizations(DEFAULT_ORGANIZATIONS);
        return;
      }
      
      // Load organizations from backend
      const response = await axios.get(`${BASE_URL}/api/admin/sop/organizations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const backendOrgs = (response.data.organizations || []).map((o: any) => o.name);
      
      // Merge with defaults in case backend fails
      const allOrgs = [...new Set([...DEFAULT_ORGANIZATIONS, ...backendOrgs])];
      setOrganizations(allOrgs);
      
      if (allOrgs.length > 0 && !allOrgs.includes(selectedOrg)) {
        setSelectedOrg(allOrgs[0]);
      }
    } catch (error) {
      console.log('Using default organizations');
      setOrganizations(DEFAULT_ORGANIZATIONS);
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
      const assignments = response.data.assignments || [];
      setSopAssignments(assignments);
      
      // Update organizations list from assignments
      const orgAssignments = assignments.filter((a: any) => a.assignment_type === 'organization');
      const uniqueOrgs = [...new Set(orgAssignments.map((a: any) => a.assignment_value))] as string[];
      setOrganizations([...new Set([...DEFAULT_ORGANIZATIONS, ...uniqueOrgs])]);
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
      .slice(0, 5);
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

  // Upload state document
  const handleUploadStateDocument = async () => {
    if (!stateDocumentFile) {
      Alert.alert('Error', 'Please select a document first');
      return;
    }

    try {
      setUploadingStateDoc(true);
      const token = await getToken();
      if (!token) return;

      // Use platform-specific base64 reading
      const base64 = await readFileAsBase64(stateDocumentFile.uri, stateDocumentFile.mimeType);

      const response = await axios.post(`${BASE_URL}/api/admin/sop/upload`, {
        documentName: stateDocumentName || stateDocumentFile.name,
        documentType: 'state',
        fileBase64: base64
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const uploadedDoc = response.data.document;
      setLastUploadedStateDocId(uploadedDoc.id);
      
      // Auto-assign to the selected state
      await handleAssignToStateInternal(uploadedDoc.id);
    } catch (error: any) {
      console.error('Error uploading document:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to upload document');
      setUploadingStateDoc(false);
    }
  };

  // Internal function to assign to state (called after upload)
  const handleAssignToStateInternal = async (documentId: number) => {
    try {
      setAssigningState(true);
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/sop/assign-state`, {
        documentId: documentId,
        state: selectedState
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', `SOP uploaded and assigned to ${selectedState} successfully`);
      setStateDocumentFile(null);
      setStateDocumentName('');
      setLastUploadedStateDocId(null);
      fetchSopAssignments();
      fetchSopDocuments();
    } catch (error: any) {
      console.error('Error assigning SOP:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to assign SOP');
    } finally {
      setAssigningState(false);
      setUploadingStateDoc(false);
    }
  };

  // Assign document to state
  const handleAssignToState = async () => {
    if (!lastUploadedStateDocId) {
      Alert.alert('Error', 'Please upload a document first');
      return;
    }

    try {
      setAssigningState(true);
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/sop/assign-state`, {
        documentId: lastUploadedStateDocId,
        state: selectedState
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', `SOP assigned to ${selectedState} successfully`);
      setStateDocumentFile(null);
      setStateDocumentName('');
      setLastUploadedStateDocId(null);
      fetchSopAssignments();
    } catch (error: any) {
      console.error('Error assigning SOP:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to assign SOP');
    } finally {
      setAssigningState(false);
    }
  };

  // Add new organization
  const handleAddOrganization = async () => {
    const trimmedName = newOrgName.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Please enter an organization name');
      return;
    }

    if (organizations.includes(trimmedName)) {
      Alert.alert('Error', 'Organization already exists');
      return;
    }

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      
      // Save to backend
      await axios.post(`${BASE_URL}/api/admin/sop/organizations`, 
        { name: trimmedName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const newOrgList = [...organizations, trimmedName];
      setOrganizations(newOrgList);
      setSelectedOrg(trimmedName);
      setNewOrgName('');
      
      Alert.alert('Success', `Organization "${trimmedName}" added. You can now upload a SOP document for it.`);
    } catch (error: any) {
      console.error('Error adding organization:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to add organization');
    }
  };

  // Delete organization
  const handleDeleteOrganization = async (orgName: string) => {
    if (DEFAULT_ORGANIZATIONS.includes(orgName)) {
      Alert.alert('Error', 'Cannot delete default organizations (ASHI, InterNACHI)');
      return;
    }

    const doDelete = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Not authenticated');
        
        // Find org ID from backend
        const response = await axios.get(`${BASE_URL}/api/admin/sop/organizations`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const orgs = response.data.organizations || [];
        const org = orgs.find((o: any) => o.name === orgName);
        
        if (org) {
          await axios.delete(`${BASE_URL}/api/admin/sop/organizations/${org.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
        
        // Update local state
        const newOrgList = organizations.filter(o => o !== orgName);
        setOrganizations(newOrgList);
        if (selectedOrg === orgName) {
          setSelectedOrg(newOrgList[0] || 'ASHI');
        }
        
        Alert.alert('Success', 'Organization deleted');
      } catch (error: any) {
        console.error('Error deleting organization:', error);
        Alert.alert('Error', error.response?.data?.message || 'Failed to delete organization');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${orgName}"? This will also remove any SOP assignments.`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Organization',
        `Are you sure you want to delete "${orgName}"? This will also remove any SOP assignments.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete }
        ]
      );
    }
  };

  // Delete SOP Document
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);
  
  const handleDeleteDocument = async (docId: number, docName: string) => {
    const doDelete = async () => {
      try {
        setDeletingDocId(docId);
        const token = await getToken();
        if (!token) throw new Error('Not authenticated');
        
        await axios.delete(`${BASE_URL}/api/admin/sop/documents/${docId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Refresh data
        await fetchSopData();
        
        if (Platform.OS === 'web') {
          alert(`Document "${docName}" deleted successfully`);
        } else {
          Alert.alert('Success', `Document "${docName}" deleted`);
        }
      } catch (error: any) {
        console.error('Error deleting document:', error);
        if (Platform.OS === 'web') {
          alert(error.response?.data?.message || 'Failed to delete document');
        } else {
          Alert.alert('Error', error.response?.data?.message || 'Failed to delete document');
        }
      } finally {
        setDeletingDocId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${docName}"? This will also remove any assignments using this document.`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Document',
        `Are you sure you want to delete "${docName}"? This will also remove any assignments using this document.`,
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

  // Upload organization document
  const handleUploadOrgDocument = async () => {
    if (!orgDocumentFile) {
      Alert.alert('Error', 'Please select a document first');
      return;
    }

    try {
      setUploadingOrgDoc(true);
      const token = await getToken();
      if (!token) return;

      // Use platform-specific base64 reading
      const base64 = await readFileAsBase64(orgDocumentFile.uri, orgDocumentFile.mimeType);

      const response = await axios.post(`${BASE_URL}/api/admin/sop/upload`, {
        documentName: orgDocumentName || orgDocumentFile.name,
        documentType: 'organization',
        fileBase64: base64
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const uploadedDoc = response.data.document;
      setLastUploadedOrgDocId(uploadedDoc.id);
      
      // Auto-assign to the selected organization
      await handleAssignToOrgInternal(uploadedDoc.id);
    } catch (error: any) {
      console.error('Error uploading document:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to upload document');
      setUploadingOrgDoc(false);
    }
  };

  // Internal function to assign to organization (called after upload)
  const handleAssignToOrgInternal = async (documentId: number) => {
    try {
      setAssigningOrg(true);
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/sop/assign-org`, {
        documentId: documentId,
        organization: selectedOrg
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', `SOP uploaded and assigned to ${selectedOrg} successfully`);
      setOrgDocumentFile(null);
      setOrgDocumentName('');
      setLastUploadedOrgDocId(null);
      fetchSopAssignments();
      fetchSopDocuments();
    } catch (error: any) {
      console.error('Error assigning SOP:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to assign SOP');
    } finally {
      setAssigningOrg(false);
      setUploadingOrgDoc(false);
    }
  };

  // Assign document to organization
  const handleAssignToOrganization = async () => {
    if (!lastUploadedOrgDocId) {
      Alert.alert('Error', 'Please upload a document first');
      return;
    }

    try {
      setAssigningOrg(true);
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/sop/assign-org`, {
        documentId: lastUploadedOrgDocId,
        organization: selectedOrg
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', `SOP assigned to ${selectedOrg} successfully`);
      setOrgDocumentFile(null);
      setOrgDocumentName('');
      setLastUploadedOrgDocId(null);
      fetchSopAssignments();
    } catch (error: any) {
      console.error('Error assigning SOP:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to assign SOP');
    } finally {
      setAssigningOrg(false);
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

      Alert.alert('Success', `Existing document assigned to ${selectedState} successfully`);
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

      Alert.alert('Success', `Existing document assigned to ${selectedOrg} successfully`);
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
      // Use AppNavigationContext for cross-platform navigation
      navigateTo('SopHistory');
    } catch (error) {
      console.error('Error navigating to SOP History:', error);
      Alert.alert('Navigation Error', 'Could not navigate to SOP History page');
    }
  };

  // View document in browser
  const handleViewDocument = async (fileUrl: string) => {
    try {
      if (Platform.OS === 'web') {
        // Use Google Docs viewer for PDFs to view in-browser
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
  const [removingAssignmentId, setRemovingAssignmentId] = useState<number | null>(null);
  
  const handleRemoveAssignment = async (assignmentId: number, assignmentValue: string) => {
    const confirmMessage = Platform.OS === 'web' 
      ? `Are you sure you want to remove the SOP assignment for ${assignmentValue}?`
      : `Remove SOP assignment for ${assignmentValue}?`;

    const doRemove = async () => {
      try {
        setRemovingAssignmentId(assignmentId);
        const token = await getToken();
        await axios.delete(`${BASE_URL}/admin/sop/assignments/${assignmentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Refresh assignments
        await fetchSopData();
        
        if (Platform.OS === 'web') {
          alert('SOP assignment removed successfully');
        } else {
          Alert.alert('Success', 'SOP assignment removed successfully');
        }
      } catch (error) {
        console.error('Error removing SOP assignment:', error);
        if (Platform.OS === 'web') {
          alert('Failed to remove SOP assignment');
        } else {
          Alert.alert('Error', 'Failed to remove SOP assignment');
        }
      } finally {
        setRemovingAssignmentId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        await doRemove();
      }
    } else {
      Alert.alert(
        'Confirm Removal',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: doRemove }
        ]
      );
    }
  };

  const currentStateAssignment = getStateAssignment(selectedState);
  const recentStateAssignments = getRecentStateAssignments();

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
          Upload and assign state-specific Standards of Practice. These assignments will be used by Spediak AI when generating statements for that state.
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
        <Text style={styles.currentStateText}>Current state: {selectedState}</Text>

        {/* Show current assignment for this state */}
        {currentStateAssignment ? (
          <View style={styles.currentAssignment}>
            <Check size={16} color="#10B981" />
            <Text style={styles.currentAssignmentText}>
              Document assigned: {currentStateAssignment.document_name || 'SOP Document'}
            </Text>
            {currentStateAssignment.file_url && (
              <TouchableOpacity 
                style={styles.viewButton}
                onPress={() => handleViewDocument(currentStateAssignment.file_url)}
              >
                <Eye size={14} color={COLORS.primary} />
                <Text style={styles.viewButtonText}>View</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.noAssignmentBanner}>
            <Text style={styles.noAssignmentText}>No SOP document assigned to {selectedState} yet</Text>
          </View>
        )}

        {/* Step 2: Upload / Name Document */}
        <Text style={styles.stepLabel}>2) Upload / name a document, then assign it to the selected state.</Text>
        
        {/* Document Name Input */}
        <TextInput
          style={styles.textInput}
          placeholder="Document name (optional)"
          value={stateDocumentName}
          onChangeText={setStateDocumentName}
          placeholderTextColor="#9CA3AF"
        />

        {/* Selected File Display */}
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

        {/* Upload / Assign Buttons Row */}
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.primaryButton, styles.buttonHalf]} 
            onPress={handlePickStateDocument}
          >
            <Upload size={16} color="#fff" />
            <Text style={styles.primaryButtonText}>Select Document</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.outlineButton, 
              styles.buttonHalf,
              (!stateDocumentFile && !lastUploadedStateDocId) && styles.buttonDisabled
            ]} 
            onPress={stateDocumentFile ? handleUploadStateDocument : handleAssignToState}
            disabled={(!stateDocumentFile && !lastUploadedStateDocId) || uploadingStateDoc || assigningState}
          >
            {(uploadingStateDoc || assigningState) ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.outlineButtonText}>
                {stateDocumentFile && !lastUploadedStateDocId ? 'Upload & Assign' : 'Assign Document'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Status Message */}
        <Text style={styles.statusMessage}>
          {lastUploadedStateDocId 
            ? 'Document uploaded. Click "Assign to selected state" to assign it.'
            : 'No document uploaded for assignment yet.'}
        </Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Assign Existing Document Section */}
        <Text style={styles.stepLabel}>OR assign an existing document to {selectedState}</Text>
        {sopDocuments.length > 0 ? (
          <View>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedExistingDocForState}
                onValueChange={(value) => setSelectedExistingDocForState(value)}
                style={styles.picker}
              >
                <Picker.Item label="Select existing document..." value={null} />
                {sopDocuments.map((doc) => (
                  <Picker.Item 
                    key={doc.id} 
                    label={`${doc.document_name} (${doc.document_type})`} 
                    value={doc.id} 
                  />
                ))}
              </Picker>
              <ChevronDown size={20} color={COLORS.textSecondary} style={styles.pickerIcon} />
            </View>
            <TouchableOpacity 
              style={[
                styles.primaryButton,
                !selectedExistingDocForState && styles.buttonDisabled
              ]} 
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
          <Text style={styles.noDataText}>No documents uploaded yet. Upload one above.</Text>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* All Uploaded Documents */}
        <Text style={styles.sectionTitle}>All Uploaded Documents</Text>
        {sopDocuments.length > 0 ? (
          sopDocuments.map((doc) => (
            <View key={doc.id} style={styles.assignmentItemRow}>
              <View style={styles.assignmentItemInfo}>
                <Text style={styles.assignmentState}>{doc.document_name}</Text>
                <Text style={styles.assignmentDoc} numberOfLines={1}>
                  — {doc.document_type} | {doc.extraction_status}
                </Text>
              </View>
              <View style={styles.assignmentActions}>
                {doc.file_url && (
                  <TouchableOpacity 
                    style={styles.assignmentActionBtn}
                    onPress={() => handleViewDocument(doc.file_url)}
                  >
                    <Eye size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  style={styles.assignmentActionBtn}
                  onPress={() => handleDeleteDocument(doc.id, doc.document_name)}
                  disabled={deletingDocId === doc.id}
                >
                  {deletingDocId === doc.id ? (
                    <ActivityIndicator size="small" color={COLORS.error} />
                  ) : (
                    <Trash2 size={16} color={COLORS.error} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noDataText}>No documents uploaded yet.</Text>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* States with SOP Assigned */}
        <Text style={styles.sectionTitle}>States with SOP assigned</Text>
        {recentStateAssignments.length > 0 ? (
          recentStateAssignments.map((assignment, idx) => (
            <View key={idx} style={styles.assignmentItemRow}>
              <View style={styles.assignmentItemInfo}>
                <Text style={styles.assignmentState}>{assignment.assignment_value}</Text>
                <Text style={styles.assignmentDoc} numberOfLines={1}>
                  — {assignment.document_name || 'Document'}
                </Text>
              </View>
              <View style={styles.assignmentActions}>
                {assignment.file_url && (
                  <TouchableOpacity 
                    style={styles.assignmentActionBtn}
                    onPress={() => handleViewDocument(assignment.file_url!)}
                  >
                    <Eye size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  style={styles.assignmentActionBtn}
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
          ))
        ) : (
          <Text style={styles.noDataText}>No state SOP assignments yet.</Text>
        )}

        {/* View History Button */}
        <TouchableOpacity style={styles.historyButton} onPress={handleViewHistory}>
          <History size={16} color={COLORS.primary} />
          <Text style={styles.historyButtonText}>View SOP Change History</Text>
        </TouchableOpacity>
      </View>

      {/* ============== ORGANIZATION SOP DOCUMENTS ============== */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Organization SOP Documents</Text>
        <Text style={styles.cardDescription}>
          Manage organization-level SOP documents (e.g., InterNACHI, ASHI) and assign them for use alongside or instead of state SOPs.
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
            style={styles.addOrgButton}
            onPress={handleAddOrganization}
          >
            <Text style={styles.addOrgButtonText}>Add organization</Text>
          </TouchableOpacity>
        </View>

        {/* Select Organization */}
        <Text style={styles.stepLabel}>Assign document to organization</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedOrg}
            onValueChange={(value) => setSelectedOrg(value)}
            style={styles.picker}
          >
            {organizations.map((org) => (
              <Picker.Item key={org} label={org} value={org} />
            ))}
          </Picker>
          <ChevronDown size={20} color={COLORS.textSecondary} style={styles.pickerIcon} />
        </View>

        {/* Selected Org File Display */}
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

        {/* Upload / Assign Buttons Row */}
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.primaryButton, styles.buttonHalf]} 
            onPress={handlePickOrgDocument}
          >
            <Upload size={16} color="#fff" />
            <Text style={styles.primaryButtonText}>Select Document</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.outlineButton, 
              styles.buttonHalf,
              (!orgDocumentFile && !lastUploadedOrgDocId) && styles.buttonDisabled
            ]} 
            onPress={orgDocumentFile ? handleUploadOrgDocument : handleAssignToOrganization}
            disabled={(!orgDocumentFile && !lastUploadedOrgDocId) || uploadingOrgDoc || assigningOrg}
          >
            {(uploadingOrgDoc || assigningOrg) ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.outlineButtonText}>
                {orgDocumentFile && !lastUploadedOrgDocId ? 'Upload & Assign' : 'Assign Document'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Status Message */}
        <Text style={styles.statusMessage}>
          {lastUploadedOrgDocId 
            ? 'Document uploaded. Click "Assign to organization" to assign it.'
            : 'No organization document uploaded for assignment yet.'}
        </Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Assign Existing Document Section for Organizations */}
        <Text style={styles.stepLabel}>OR assign an existing document to {selectedOrg}</Text>
        {sopDocuments.length > 0 ? (
          <View>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedExistingDocForOrg}
                onValueChange={(value) => setSelectedExistingDocForOrg(value)}
                style={styles.picker}
              >
                <Picker.Item label="Select existing document..." value={null} />
                {sopDocuments.map((doc) => (
                  <Picker.Item 
                    key={doc.id} 
                    label={`${doc.document_name} (${doc.document_type})`} 
                    value={doc.id} 
                  />
                ))}
              </Picker>
              <ChevronDown size={20} color={COLORS.textSecondary} style={styles.pickerIcon} />
            </View>
            <TouchableOpacity 
              style={[
                styles.primaryButton,
                !selectedExistingDocForOrg && styles.buttonDisabled
              ]} 
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
          <Text style={styles.noDataText}>No documents uploaded yet. Upload one above.</Text>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Only show organizations WITH documents assigned */}
        <Text style={styles.sectionTitle}>Organizations with SOP assigned</Text>
        {(() => {
          const assignedOrgs = organizations.filter(org => getOrgAssignment(org));
          if (assignedOrgs.length === 0) {
            return <Text style={styles.noDataText}>No organization SOP assignments yet.</Text>;
          }
          return assignedOrgs.map((org) => {
            const assignment = getOrgAssignment(org);
            return (
              <View key={org} style={styles.orgAssignmentItem}>
                <View style={styles.orgAssignmentLeft}>
                  <Text style={styles.orgName}>{org}</Text>
                  <Text style={styles.orgStatus}>
                    — {assignment?.document_name || 'Document assigned'}
                  </Text>
                </View>
                <View style={styles.orgAssignmentActions}>
                  <TouchableOpacity 
                    style={styles.viewHistoryLink}
                    onPress={handleViewHistory}
                  >
                    <Text style={styles.viewHistoryLinkText}>View history</Text>
                  </TouchableOpacity>
                  {!DEFAULT_ORGANIZATIONS.includes(org) && (
                    <TouchableOpacity 
                      style={styles.deleteOrgButton}
                      onPress={() => handleDeleteOrganization(org)}
                    >
                      <Text style={styles.deleteOrgButtonText}>Delete org</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          });
        })()}
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
    color: '#374151',
    marginBottom: 8,
    marginTop: 8,
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 48,
    justifyContent: 'center',
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
  currentStateText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  currentAssignment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  currentAssignmentText: {
    fontSize: 14,
    color: '#065F46',
    flex: 1,
  },
  noAssignmentBanner: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
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
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  outlineButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  statusMessage: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  assignmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  assignmentItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  assignmentItemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  assignmentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assignmentActionBtn: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
  },
  assignmentState: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    width: 50,
  },
  assignmentDoc: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
    textAlign: 'right',
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
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
  },
  addOrgButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  orgAssignmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexWrap: 'wrap',
  },
  orgAssignmentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    gap: 4,
  },
  orgName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  orgStatus: {
    fontSize: 13,
    color: '#6B7280',
  },
  orgAssignmentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewHistoryLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewHistoryLinkText: {
    fontSize: 13,
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  deleteOrgButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  deleteOrgButtonText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginLeft: 'auto',
    gap: 4,
  },
  viewButtonText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
});

export default SopManagementTab;
