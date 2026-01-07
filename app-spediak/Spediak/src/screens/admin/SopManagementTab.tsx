import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth, useUser } from '@clerk/clerk-expo';
import axios from 'axios';
import { BASE_URL } from '../../config/api';
import { COLORS } from '../../styles/colors';
import { Upload, FileText, Check } from 'lucide-react-native';
import { US_STATES } from '../../context/GlobalStateContext';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

const ORGANIZATIONS = ['ASHI', 'InterNACHI'];

const SopManagementTab: React.FC = () => {
  const { getToken, userId } = useAuth();
  const { user } = useUser();
  
  // State SOP
  const [selectedState, setSelectedState] = useState<string>('NC');
  const [sopDocuments, setSopDocuments] = useState<any[]>([]);
  const [sopAssignments, setSopAssignments] = useState<any[]>([]);
  const [isLoadingSops, setIsLoadingSops] = useState(false);
  const [selectedSopFile, setSelectedSopFile] = useState<DocumentPicker.DocumentPickerResult | null>(null);
  const [uploadingSop, setUploadingSop] = useState(false);
  const [newSopDocName, setNewSopDocName] = useState('');
  
  // Organization SOP
  const [selectedOrg, setSelectedOrg] = useState<string>('ASHI');

  useEffect(() => {
    fetchSopDocuments();
    fetchSopAssignments();
  }, []);

  const fetchSopDocuments = async () => {
    try {
      setIsLoadingSops(true);
      const token = await getToken();
      if (!token) return;

      // Use the admin endpoint if available, or list all docs
      const response = await axios.get(`${BASE_URL}/api/sop/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSopDocuments(response.data.documents || []);
    } catch (error: any) {
      console.log('No SOP documents found or error:', error.message);
      setSopDocuments([]);
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
      console.log('No SOP assignments found or error:', error.message);
      setSopAssignments([]);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain'],
        copyToCacheDirectory: true
      });

      if (result.type === 'success') {
        setSelectedSopFile(result);
        if (!newSopDocName) {
          setNewSopDocName(result.name.replace(/\.[^/.]+$/, ''));
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleUploadStateSop = async () => {
    if (!selectedSopFile || selectedSopFile.type !== 'success') {
      Alert.alert('Error', 'Please select a document first');
      return;
    }

    try {
      setUploadingSop(true);
      const token = await getToken();
      if (!token) return;

      const base64 = await FileSystem.readAsStringAsync(selectedSopFile.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await axios.post(`${BASE_URL}/api/admin/sop/upload`, {
        documentName: newSopDocName || selectedSopFile.name,
        documentType: 'state',
        fileBase64: base64,
        state: selectedState
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', `SOP uploaded for ${selectedState}`);
      setSelectedSopFile(null);
      setNewSopDocName('');
      fetchSopDocuments();
      fetchSopAssignments();
    } catch (error: any) {
      console.error('Error uploading SOP:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to upload SOP');
    } finally {
      setUploadingSop(false);
    }
  };

  const handleUploadOrgSop = async () => {
    if (!selectedSopFile || selectedSopFile.type !== 'success') {
      Alert.alert('Error', 'Please select a document first');
      return;
    }

    try {
      setUploadingSop(true);
      const token = await getToken();
      if (!token) return;

      const base64 = await FileSystem.readAsStringAsync(selectedSopFile.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await axios.post(`${BASE_URL}/api/admin/sop/upload`, {
        documentName: newSopDocName || selectedSopFile.name,
        documentType: 'organization',
        fileBase64: base64,
        organization: selectedOrg
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', `SOP uploaded for ${selectedOrg}`);
      setSelectedSopFile(null);
      setNewSopDocName('');
      fetchSopDocuments();
      fetchSopAssignments();
    } catch (error: any) {
      console.error('Error uploading SOP:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to upload SOP');
    } finally {
      setUploadingSop(false);
    }
  };

  const getStateAssignment = (state: string) => {
    return sopAssignments.find(a => a.assignment_type === 'state' && a.assignment_value === state);
  };

  const getOrgAssignment = (org: string) => {
    return sopAssignments.find(a => a.assignment_type === 'organization' && a.assignment_value === org);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* State SOP Management */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>State SOP Documents</Text>
        <Text style={styles.cardDescription}>
          Upload and manage state-specific Standards of Practice documents.
        </Text>

        <Text style={styles.label}>Select State</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedState}
            onValueChange={(value) => setSelectedState(value)}
            style={styles.picker}
          >
            {US_STATES.map((state) => (
              <Picker.Item key={state.value} label={`${state.value} - ${state.label}`} value={state.value} />
            ))}
          </Picker>
        </View>

        {/* Current Assignment */}
        {getStateAssignment(selectedState) && (
          <View style={styles.currentAssignment}>
            <Check size={16} color="#10B981" />
            <Text style={styles.currentAssignmentText}>
              Currently assigned: {getStateAssignment(selectedState)?.document_name || 'Document'}
            </Text>
          </View>
        )}

        {/* File Selection */}
        {selectedSopFile && selectedSopFile.type === 'success' && (
          <View style={styles.selectedFile}>
            <FileText size={16} color={COLORS.primary} />
            <Text style={styles.selectedFileName} numberOfLines={1}>
              {selectedSopFile.name}
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.pickButton} onPress={handlePickDocument}>
          <Upload size={18} color={COLORS.primary} />
          <Text style={styles.pickButtonText}>Select PDF Document</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.uploadButton, uploadingSop && styles.buttonDisabled]} 
          onPress={handleUploadStateSop}
          disabled={uploadingSop || !selectedSopFile}
        >
          {uploadingSop ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Upload size={18} color="#fff" />
              <Text style={styles.uploadButtonText}>Upload SOP Document</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Organization SOP Management */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Organization SOP Documents</Text>
        <Text style={styles.cardDescription}>
          Manage organization-specific SOPs.
        </Text>

        <Text style={styles.label}>Select Organization</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedOrg}
            onValueChange={(value) => setSelectedOrg(value)}
            style={styles.picker}
          >
            {ORGANIZATIONS.map((org) => (
              <Picker.Item key={org} label={org} value={org} />
            ))}
          </Picker>
        </View>

        {/* Current Assignment */}
        {getOrgAssignment(selectedOrg) && (
          <View style={styles.currentAssignment}>
            <Check size={16} color="#10B981" />
            <Text style={styles.currentAssignmentText}>
              Currently assigned: {getOrgAssignment(selectedOrg)?.document_name || 'Document'}
            </Text>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.uploadButton, uploadingSop && styles.buttonDisabled]} 
          onPress={handleUploadOrgSop}
          disabled={uploadingSop || !selectedSopFile}
        >
          {uploadingSop ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Upload size={18} color="#fff" />
              <Text style={styles.uploadButtonText}>Upload SOP Document</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.recentTitle}>Recent Assignments</Text>
        {sopAssignments.length > 0 ? (
          sopAssignments.slice(0, 5).map((assignment, idx) => (
            <View key={idx} style={styles.assignmentItem}>
              <Text style={styles.assignmentType}>
                {assignment.assignment_type === 'state' ? '🏛️' : '🏢'} {assignment.assignment_value}
              </Text>
              <Text style={styles.assignmentDoc} numberOfLines={1}>
                {assignment.document_name}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.noAssignments}>No assignments yet</Text>
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
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  pickerContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
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
    fontSize: 13,
    color: '#065F46',
    flex: 1,
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
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F4F8',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  pickButtonText: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '600',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '700',
  },
  recentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 20,
    marginBottom: 12,
  },
  assignmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  assignmentType: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  assignmentDoc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  noAssignments: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
});

export default SopManagementTab;
