import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, FlatList, Platform, useWindowDimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@clerk/clerk-expo';
import axios from 'axios';
import { BASE_URL } from '../config/api';
import { COLORS } from '../styles/colors';
import { Search, Download, Link as LinkIcon, Filter, ChevronDown, X, LayoutGrid, Clock, RefreshCcw } from 'lucide-react-native';
import { format } from 'date-fns';
import { US_STATES } from '../context/GlobalStateContext';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';

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
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  
  const [history, setHistory] = useState<SopHistoryEntry[]>([]);
  const [organizations, setOrganizations] = useState<string[]>(['ASHI', 'InterNACHI']);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // View mode: 'cards' or 'timeline'
  const [viewMode, setViewMode] = useState<'cards' | 'timeline'>('cards');
  
  // Filters
  const [scopeFilter, setScopeFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('last7');
  const [stateFilter, setStateFilter] = useState<string>('All');
  const [orgFilter, setOrgFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Pagination
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Load organizations from assignments
  const loadOrganizations = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      
      const response = await axios.get(`${BASE_URL}/api/admin/sop/assignments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const assignments = response.data.assignments || [];
      const orgAssignments = assignments.filter((a: any) => a.assignment_type === 'organization');
      const uniqueOrgs = [...new Set(orgAssignments.map((a: any) => a.assignment_value))] as string[];
      
      if (uniqueOrgs.length > 0) {
        setOrganizations([...new Set(['ASHI', 'InterNACHI', ...uniqueOrgs])]);
      }
    } catch (error) {
      console.log('Error loading organizations:', error);
    }
  };

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
      if (timeFilter !== 'all') params.timeframe = timeFilter;
      if (stateFilter !== 'All') params.state = stateFilter;
      if (orgFilter !== 'All') params.organization = orgFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const response = await axios.get(`${BASE_URL}/api/admin/sop/history`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      setHistory(response.data.history || []);
      setTotalCount(response.data.total || 0);
    } catch (err: any) {
      console.error('Error fetching SOP history:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch history');
    } finally {
      setIsLoading(false);
    }
  }, [getToken, scopeFilter, actionFilter, timeFilter, stateFilter, orgFilter, searchQuery, limit, offset]);

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleFilterChange = () => {
    setOffset(0);
  };

  useEffect(() => {
    handleFilterChange();
  }, [scopeFilter, actionFilter, timeFilter, stateFilter, orgFilter, searchQuery]);

  const handleClearFilters = () => {
    setScopeFilter('all');
    setActionFilter('all');
    setTimeFilter('last7');
    setStateFilter('All');
    setOrgFilter('All');
    setSearchQuery('');
    setOffset(0);
  };

  const handleCopyLink = async () => {
    // Generate URL with current filters
    const params = new URLSearchParams();
    if (scopeFilter !== 'all') params.set('scope', scopeFilter);
    if (actionFilter !== 'all') params.set('action', actionFilter);
    if (timeFilter !== 'all') params.set('time', timeFilter);
    if (stateFilter !== 'All') params.set('state', stateFilter);
    if (orgFilter !== 'All') params.set('org', orgFilter);
    if (searchQuery) params.set('search', searchQuery);
    
    const link = `spediak://sop-history?${params.toString()}`;
    
    try {
      await Clipboard.setStringAsync(link);
      Alert.alert('Success', 'Link copied to clipboard');
    } catch (error) {
      Alert.alert('Info', 'Link to current filters: ' + link);
    }
  };

  const handleExportCsv = async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) return;

      const params: any = {};
      if (scopeFilter !== 'all') params.scope = scopeFilter;
      if (actionFilter !== 'all') params.actionType = actionFilter;
      if (timeFilter !== 'all') params.timeframe = timeFilter;
      if (stateFilter !== 'All') params.state = stateFilter;
      if (orgFilter !== 'All') params.organization = orgFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const response = await axios.get(`${BASE_URL}/api/admin/sop/history/export-csv`, {
        params,
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'text',
      });

      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
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

  const getActionBadgeStyle = (actionType: string) => {
    switch (actionType?.toLowerCase()) {
      case 'assigned':
        return { backgroundColor: '#10B981', borderColor: '#059669' };
      case 'replaced':
        return { backgroundColor: '#F59E0B', borderColor: '#D97706' };
      case 'removed':
        return { backgroundColor: '#EF4444', borderColor: '#DC2626' };
      case 'created':
      case 'uploaded':
        return { backgroundColor: '#3B82F6', borderColor: '#2563EB' };
      default:
        return { backgroundColor: '#6B7280', borderColor: '#4B5563' };
    }
  };

  const formatActionType = (actionType: string) => {
    if (!actionType) return 'Unknown';
    return actionType.charAt(0).toUpperCase() + actionType.slice(1).toLowerCase();
  };

  const renderHistoryItem = ({ item }: { item: SopHistoryEntry }) => {
    const date = new Date(item.created_at);
    const formattedDate = format(date, 'MMM d, yyyy');
    const formattedTime = format(date, 'hh:mm a');
    
    const isStateChange = item.assignment_type === 'state';
    const isOrgChange = item.assignment_type === 'organization';
    
    const changeTitle = isStateChange 
      ? `State SOP change` 
      : isOrgChange 
        ? `Organization SOP change` 
        : `SOP Document ${formatActionType(item.action_type)}`;

    return (
      <View style={styles.historyCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>{changeTitle}</Text>
            <View style={[styles.actionBadge, getActionBadgeStyle(item.action_type)]}>
              <Text style={styles.actionBadgeText}>{formatActionType(item.action_type)}</Text>
            </View>
          </View>
          <Text style={styles.cardDate}>
            {formattedDate}, {formattedTime} — {item.assignment_type === 'organization' ? 'Organization' : item.assignment_type === 'state' ? 'State' : ''} {item.assignment_value || ''}
          </Text>
        </View>
        
        <View style={styles.cardBody}>
          <Text style={styles.cardDocumentLabel}>Document:</Text>
          <Text style={styles.cardDocument}>
            {item.sop_document_name || '(no document name)'}
          </Text>
        </View>
        
        <View style={styles.cardFooter}>
          <Text style={styles.cardAdmin}>By: {item.changed_by_email || 'Prototype Admin'}</Text>
        </View>
      </View>
    );
  };

  const FilterChip = ({ 
    label, 
    isActive, 
    onPress 
  }: { 
    label: string; 
    isActive: boolean; 
    onPress: () => void; 
  }) => (
    <TouchableOpacity
      style={[styles.filterChip, isActive && styles.filterChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>SOP Change History</Text>
        <Text style={styles.description}>
          This log shows when state or organization SOP assignments were created, updated, or removed in the SOP Admin panel.
        </Text>
        <Text style={styles.hint}>
          Use the filters, chips, and search bar to quickly find specific SOP changes.
        </Text>
      </View>

      {/* View Mode Toggle & Action Buttons */}
      <View style={styles.actionRow}>
        <View style={styles.viewModeToggle}>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'cards' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('cards')}
          >
            <LayoutGrid size={16} color={viewMode === 'cards' ? '#fff' : COLORS.textPrimary} />
            <Text style={[styles.viewModeText, viewMode === 'cards' && styles.viewModeTextActive]}>Cards</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'timeline' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('timeline')}
          >
            <Clock size={16} color={viewMode === 'timeline' ? '#fff' : COLORS.textPrimary} />
            <Text style={[styles.viewModeText, viewMode === 'timeline' && styles.viewModeTextActive]}>Timeline</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.outlineButton} onPress={handleCopyLink}>
            <LinkIcon size={14} color={COLORS.textPrimary} />
            <Text style={styles.outlineButtonText}>Copy link to current filters</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={handleExportCsv}>
            <Download size={14} color="#fff" />
            <Text style={styles.primaryButtonText}>Export CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scope Filter Chips */}
      <View style={styles.filterSection}>
        <View style={styles.filterChipRow}>
          <FilterChip label="All" isActive={scopeFilter === 'all'} onPress={() => setScopeFilter('all')} />
          <FilterChip label="State" isActive={scopeFilter === 'state'} onPress={() => setScopeFilter('state')} />
          <FilterChip label="Org" isActive={scopeFilter === 'organization'} onPress={() => setScopeFilter('organization')} />
        </View>
      </View>

      {/* Action Filter Chips */}
      <View style={styles.filterSection}>
        <View style={styles.filterChipRow}>
          <FilterChip label="All actions" isActive={actionFilter === 'all'} onPress={() => setActionFilter('all')} />
          <FilterChip label="Assigned" isActive={actionFilter === 'assigned'} onPress={() => setActionFilter('assigned')} />
          <FilterChip label="Replaced" isActive={actionFilter === 'replaced'} onPress={() => setActionFilter('replaced')} />
          <FilterChip label="Removed" isActive={actionFilter === 'removed'} onPress={() => setActionFilter('removed')} />
          <FilterChip label="Created" isActive={actionFilter === 'created'} onPress={() => setActionFilter('created')} />
        </View>
      </View>

      {/* Time Filter Chips */}
      <View style={styles.filterSection}>
        <View style={styles.filterChipRow}>
          <FilterChip label="Last 7 days" isActive={timeFilter === 'last7'} onPress={() => setTimeFilter('last7')} />
          <FilterChip label="Last 30 days" isActive={timeFilter === 'last30'} onPress={() => setTimeFilter('last30')} />
          <FilterChip label="All time" isActive={timeFilter === 'all'} onPress={() => setTimeFilter('all')} />
          <TouchableOpacity style={styles.clearFiltersButton} onPress={handleClearFilters}>
            <Text style={styles.clearFiltersText}>Clear filters</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Dropdown Filters */}
      <View style={[styles.dropdownRow, isLargeScreen && styles.dropdownRowLarge]}>
        <View style={styles.dropdownContainer}>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={stateFilter}
              onValueChange={setStateFilter}
              style={styles.picker}
            >
              <Picker.Item label="All states" value="All" />
              {US_STATES.map((state) => (
                <Picker.Item key={state.value} label={state.value} value={state.value} />
              ))}
            </Picker>
            <ChevronDown size={18} color={COLORS.textSecondary} style={styles.pickerIcon} />
          </View>
        </View>

        <View style={styles.dropdownContainer}>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={orgFilter}
              onValueChange={setOrgFilter}
              style={styles.picker}
            >
              <Picker.Item label="All organizations" value="All" />
              {organizations.map((org) => (
                <Picker.Item key={org} label={org} value={org} />
              ))}
            </Picker>
            <ChevronDown size={18} color={COLORS.textSecondary} style={styles.pickerIcon} />
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by state, organization, action, document name, or admin..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9CA3AF"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Results */}
      {isLoading && offset === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchHistory}>
            <RefreshCcw size={16} color="#fff" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No SOP changes found with current filters.</Text>
          <TouchableOpacity style={styles.clearFiltersButtonLarge} onPress={handleClearFilters}>
            <Text style={styles.clearFiltersTextLarge}>Clear all filters</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* History List */}
          <FlatList
            data={history}
            renderItem={renderHistoryItem}
            keyExtractor={(item) => item.id.toString()}
            style={styles.historyList}
            contentContainerStyle={styles.historyListContent}
            scrollEnabled={false}
          />

          {/* Results Count */}
          <Text style={styles.resultsCount}>
            Showing {Math.min(offset + 1, totalCount)} to {Math.min(offset + history.length, totalCount)} of {totalCount} matching changes.
          </Text>

          {/* Pagination */}
          {totalCount > limit && (
            <View style={styles.paginationContainer}>
              <TouchableOpacity
                style={[styles.paginationButton, offset === 0 && styles.paginationButtonDisabled]}
                onPress={handleLoadPrevious}
                disabled={offset === 0}
              >
                <Text style={[styles.paginationButtonText, offset === 0 && styles.paginationButtonTextDisabled]}>
                  Previous
                </Text>
              </TouchableOpacity>
              
              <Text style={styles.paginationInfo}>
                Page {Math.floor(offset / limit) + 1} of {Math.ceil(totalCount / limit)}
              </Text>
              
              <TouchableOpacity
                style={[styles.paginationButton, offset + limit >= totalCount && styles.paginationButtonDisabled]}
                onPress={handleLoadMore}
                disabled={offset + limit >= totalCount}
              >
                <Text style={[styles.paginationButtonText, offset + limit >= totalCount && styles.paginationButtonTextDisabled]}>
                  Next
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
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
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E3A5F',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  viewModeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  viewModeText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  viewModeTextActive: {
    color: '#fff',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  outlineButtonText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  primaryButtonText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  filterSection: {
    marginBottom: 12,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  clearFiltersButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearFiltersText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
  dropdownRow: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 16,
  },
  dropdownRowLarge: {
    flexDirection: 'row',
  },
  dropdownContainer: {
    flex: 1,
  },
  pickerWrapper: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    padding: 24,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  clearFiltersButtonLarge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  clearFiltersTextLarge: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  historyList: {
    flex: 1,
  },
  historyListContent: {
    gap: 12,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A5F',
    flex: 1,
  },
  actionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  actionBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  cardDate: {
    fontSize: 13,
    color: '#6B7280',
  },
  cardBody: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cardDocumentLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  cardDocument: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  cardFooter: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cardAdmin: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  resultsCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 8,
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  paginationButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  paginationButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  paginationButtonTextDisabled: {
    color: '#9CA3AF',
  },
  paginationInfo: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});

export default SopHistoryScreen;
