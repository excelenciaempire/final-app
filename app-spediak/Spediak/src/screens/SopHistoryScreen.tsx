import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, FlatList, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@clerk/clerk-expo';
import axios from 'axios';
import { BASE_URL } from '../config/api';
import { COLORS } from '../styles/colors';
import { Search, Download, Link as LinkIcon, Filter } from 'lucide-react-native';
import { format } from 'date-fns';
import { US_STATES } from '../context/GlobalStateContext';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const ORGANIZATIONS = ['All', 'ASHI', 'InterNACHI'];

interface SopHistoryEntry {
  id: number;
  action_type: string;
  sop_document_name?: string;
  assignment_type?: string;
  assignment_value?: string;
  changed_by_email: string;
  created_at: string;
  change_details?: any;
}

const SopHistoryScreen: React.FC = () => {
  const { getToken } = useAuth();
  const [history, setHistory] = useState<SopHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [scopeFilter, setScopeFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('All');
  const [orgFilter, setOrgFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Pagination
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      
      if (!token) {
        setIsLoading(false);
        return;
      }

      const params: any = { limit, offset };
      
      if (scopeFilter !== 'all') params.scope = scopeFilter;
      if (actionFilter !== 'all') params.actionType = actionFilter;
      if (stateFilter !== 'All') params.state = stateFilter;
      if (orgFilter !== 'All') params.organization = orgFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const response = await axios.get(`${BASE_URL}/api/admin/sop/history`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      setHistory(response.data.history);
      setTotalCount(response.data.total);
    } catch (err: any) {
      console.error('Error fetching SOP history:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch history');
    } finally {
      setIsLoading(false);
    }
  }, [getToken, scopeFilter, actionFilter, stateFilter, orgFilter, searchQuery, limit, offset]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleFilterChange = () => {
    setOffset(0); // Reset to first page when filters change
  };

  useEffect(() => {
    handleFilterChange();
  }, [scopeFilter, actionFilter, stateFilter, orgFilter, searchQuery]);

  const handleCopyLink = () => {
    // In a real app, this would generate a shareable URL with current filters
    Alert.alert('Copy Link', 'Link to current filters copied to clipboard (feature placeholder)');
  };

  const handleExportCsv = async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) return;

      // Build query params from current filters
      const params: any = {};
      if (scopeFilter !== 'all') params.scope = scopeFilter;
      if (actionFilter !== 'all') params.actionType = actionFilter;
      if (stateFilter !== 'All') params.state = stateFilter;
      if (orgFilter !== 'All') params.organization = orgFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const response = await axios.get(`${BASE_URL}/api/admin/sop/history/export-csv`, {
        params,
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'text',
      });

      if (Platform.OS === 'web') {
        // Web: Trigger download
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `sop_history_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        Alert.alert('Success', 'CSV file downloaded');
      } else {
        // Mobile: Save and share
        const filename = `sop_history_${new Date().toISOString().split('T')[0]}.csv`;
        const fileUri = FileSystem.documentDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, response.data, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert('Success', `CSV saved to ${fileUri}`);
        }
      }
    } catch (error: any) {
      console.error('Error exporting CSV:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to export CSV');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (offset + limit < totalCount) {
      setOffset(offset + limit);
    }
  };

  const handleLoadPrevious = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit));
    }
  };

  const renderHistoryItem = ({ item }: { item: SopHistoryEntry }) => {
    const date = new Date(item.created_at);
    const formattedDate = format(date, 'MMM dd, yyyy');
    const formattedTime = format(date, 'hh:mm a');

    return (
      <View style={styles.historyItem}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyDate}>{formattedDate} at {formattedTime}</Text>
          <View style={[styles.actionBadge, getActionBadgeStyle(item.action_type)]}>
            <Text style={styles.actionBadgeText}>{item.action_type.toUpperCase()}</Text>
          </View>
        </View>
        
        <Text style={styles.historyAdmin}>Admin: {item.changed_by_email || 'Unknown'}</Text>
        
        {item.sop_document_name && (
          <Text style={styles.historyDocument}>Document: {item.sop_document_name}</Text>
        )}
        
        {item.assignment_type && item.assignment_value && (
          <Text style={styles.historyAssignment}>
            {item.assignment_type === 'state' ? 'State' : 'Organization'}: {item.assignment_value}
          </Text>
        )}
      </View>
    );
  };

  const getActionBadgeStyle = (actionType: string) => {
    switch (actionType) {
      case 'assigned':
        return { backgroundColor: '#4CAF50' };
      case 'replaced':
        return { backgroundColor: '#FFA500' };
      case 'removed':
        return { backgroundColor: '#F44336' };
      default:
        return { backgroundColor: '#9E9E9E' };
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SOP Change History</Text>
      <Text style={styles.description}>
        Track all SOP assignments, replacements, and removals across states and organizations.
      </Text>

      {/* Filter Chips */}
      <View style={styles.filterChipsContainer}>
        <Text style={styles.filterLabel}>Scope:</Text>
        <View style={styles.chipGroup}>
          <TouchableOpacity
            style={[styles.chip, scopeFilter === 'all' && styles.chipActive]}
            onPress={() => setScopeFilter('all')}
          >
            <Text style={[styles.chipText, scopeFilter === 'all' && styles.chipTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, scopeFilter === 'state' && styles.chipActive]}
            onPress={() => setScopeFilter('state')}
          >
            <Text style={[styles.chipText, scopeFilter === 'state' && styles.chipTextActive]}>State</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, scopeFilter === 'organization' && styles.chipActive]}
            onPress={() => setScopeFilter('organization')}
          >
            <Text style={[styles.chipText, scopeFilter === 'organization' && styles.chipTextActive]}>Org</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filterChipsContainer}>
        <Text style={styles.filterLabel}>Action:</Text>
        <View style={styles.chipGroup}>
          <TouchableOpacity
            style={[styles.chip, actionFilter === 'all' && styles.chipActive]}
            onPress={() => setActionFilter('all')}
          >
            <Text style={[styles.chipText, actionFilter === 'all' && styles.chipTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, actionFilter === 'assigned' && styles.chipActive]}
            onPress={() => setActionFilter('assigned')}
          >
            <Text style={[styles.chipText, actionFilter === 'assigned' && styles.chipTextActive]}>Assigned</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, actionFilter === 'replaced' && styles.chipActive]}
            onPress={() => setActionFilter('replaced')}
          >
            <Text style={[styles.chipText, actionFilter === 'replaced' && styles.chipTextActive]}>Replaced</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, actionFilter === 'removed' && styles.chipActive]}
            onPress={() => setActionFilter('removed')}
          >
            <Text style={[styles.chipText, actionFilter === 'removed' && styles.chipTextActive]}>Removed</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Dropdown Filters */}
      <View style={styles.dropdownFiltersRow}>
        <View style={styles.dropdownContainer}>
          <Text style={styles.dropdownLabel}>State</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={stateFilter}
              onValueChange={(value) => setStateFilter(value)}
              style={styles.picker}
            >
              <Picker.Item label="All States" value="All" />
              {US_STATES.map((state) => (
                <Picker.Item key={state} label={state} value={state} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.dropdownContainer}>
          <Text style={styles.dropdownLabel}>Organization</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={orgFilter}
              onValueChange={(value) => setOrgFilter(value)}
              style={styles.picker}
            >
              {ORGANIZATIONS.map((org) => (
                <Picker.Item key={org} label={org} value={org} />
              ))}
            </Picker>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search document names..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={handleCopyLink}>
          <LinkIcon size={16} color={COLORS.primary} />
          <Text style={styles.actionButtonText}>Copy Link</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleExportCsv}>
          <Download size={16} color={COLORS.primary} />
          <Text style={styles.actionButtonText}>Export CSV</Text>
        </TouchableOpacity>
      </View>

      {/* History List */}
      {isLoading && offset === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchHistory}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No SOP history found with current filters</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={history}
            renderItem={renderHistoryItem}
            keyExtractor={(item) => item.id.toString()}
            style={styles.historyList}
            contentContainerStyle={styles.historyListContent}
          />

          {/* Pagination */}
          <View style={styles.paginationContainer}>
            <TouchableOpacity
              style={[styles.paginationButton, offset === 0 && styles.paginationButtonDisabled]}
              onPress={handleLoadPrevious}
              disabled={offset === 0}
            >
              <Text style={styles.paginationButtonText}>Previous</Text>
            </TouchableOpacity>
            
            <Text style={styles.paginationInfo}>
              {offset + 1} - {Math.min(offset + limit, totalCount)} of {totalCount}
            </Text>
            
            <TouchableOpacity
              style={[styles.paginationButton, offset + limit >= totalCount && styles.paginationButtonDisabled]}
              onPress={handleLoadMore}
              disabled={offset + limit >= totalCount}
            >
              <Text style={styles.paginationButtonText}>Next</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  filterChipsContainer: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dropdownFiltersRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dropdownContainer: {
    flex: 1,
  },
  dropdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  actionButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorContainer: {
    padding: 20,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  historyList: {
    flex: 1,
  },
  historyListContent: {
    paddingBottom: 16,
  },
  historyItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  actionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  actionBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  historyAdmin: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  historyDocument: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  historyAssignment: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  paginationButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  paginationButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  paginationInfo: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});

export default SopHistoryScreen;

