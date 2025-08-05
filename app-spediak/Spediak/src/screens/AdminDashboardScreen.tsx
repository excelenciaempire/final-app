import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Alert, Image, SafeAreaView, TouchableOpacity, Platform, TextInput, Modal as RNModal, Dimensions, ScrollView, Switch, Linking } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-expo';
import { BASE_URL } from '../config/api';
import { COLORS } from '../styles/colors';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Search, Eye, UserCircle, Download, Trash2, X as XIcon, Save, History, Upload, FileText, BrainCircuit } from 'lucide-react-native';
import DdidModal from '../components/DdidModal';
import { useDebounce } from '../hooks/useDebounce';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { format } from 'date-fns';

const api = axios.create({
    baseURL: BASE_URL + '/api'
});

// --- Interfaces ---
interface AdminInspectionData { id: string; user_id: string; image_url: string | null; description: string; ddid: string; state: string | null; created_at: string; userName: string; userEmail: string; userState: string | null; userProfilePhoto: string | null; }
interface UserData { id: string; name: string; email: string; username: string | null; createdAt: string | Date; state: string | null; profilePhoto: string | null; inspectionCount: number; }
interface PaginatedResponse<T> { totalCount: number; page: number; limit: number; totalPages: number; inspections?: T[]; users?: T[]; }
interface Prompt { id: number; prompt_name: string; prompt_content: string; is_locked: boolean; locked_by: string | null; username: string | null; locked_at: string | null; }
interface PromptVersion { id: number; version: number; prompt_content: string; updated_by_username: string; created_at: string; }
interface KnowledgeDocument {
    id: number;
    file_name: string;
    file_type: string;
    uploaded_at: string;
    status: 'pending' | 'processing' | 'complete' | 'error';
    error_message?: string;
    file_url?: string;
}

// Helper function to get optimized Cloudinary image URL
const getOptimizedImageUrl = (url: string | null | undefined, width: number, height: number): string | undefined => {
    if (!url || !url.includes('cloudinary.com')) return url || undefined;
    try {
        const parts = url.split('/upload/');
        if (parts.length === 2) return `${parts[0]}/upload/w_${width},h_${height},c_pad,q_auto/${parts[1]}`;
    } catch (e) { console.warn("Error constructing optimized image URL:", e); }
    return url;
};

// --- All Inspections Component ---
const AllInspections: React.FC = () => {
    // States and hooks from original component...
    const [inspections, setInspections] = useState<AdminInspectionData[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalInspectionsCount, setTotalInspectionsCount] = useState<number>(0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [selectedInspection, setSelectedInspection] = useState<AdminInspectionData | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const { getToken } = useAuth();
    const debouncedSearchQuery = useDebounce(searchQuery, 500);
    const [mediaLibraryPermission, requestMediaLibraryPermission] = MediaLibrary.usePermissions();
    const [fullScreenImageUrl, setFullScreenImageUrl] = useState<string | null>(null);
    const [isFullImageModalVisible, setIsFullImageModalVisible] = useState(false);

    // Fetch data function from original component...
    const fetchData = useCallback(async (page = 1, search = debouncedSearchQuery, sortCol = sortBy, sortDir = sortOrder, refreshing = false) => {
        if (!refreshing && page === 1) setIsLoading(true);
        if (page > 1) setIsLoadingMore(true);
        setError(null);
        try {
            const token = await getToken();
            const response = await axios.get<PaginatedResponse<AdminInspectionData>>(`${BASE_URL}/api/admin/all-inspections`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { page, limit: 15, search, sortBy: sortCol, sortOrder: sortDir }
            });
            const { inspections: fetchedInspections = [], totalPages: fetchedTotalPages, page: fetchedPage, totalCount } = response.data;
            setInspections(prev => (page === 1 ? fetchedInspections : [...prev, ...fetchedInspections]));
            setTotalPages(fetchedTotalPages);
            setCurrentPage(fetchedPage);
            if (totalCount !== undefined) setTotalInspectionsCount(totalCount);
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to fetch inspection data.");
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
            if (refreshing) setIsRefreshing(false);
        }
    }, [getToken, debouncedSearchQuery, sortBy, sortOrder]);

    useEffect(() => {
        if (Platform.OS !== 'web') {
            requestMediaLibraryPermission();
        }
        fetchData(1);
    }, []);

    useEffect(() => {
        if (debouncedSearchQuery !== undefined || sortBy !== 'created_at' || sortOrder !== 'desc') {
            fetchData(1);
        }
    }, [debouncedSearchQuery, sortBy, sortOrder]);


    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchData(1, searchQuery, sortBy, sortOrder, true);
    }, [fetchData, searchQuery, sortBy, sortOrder]);

    const handleLoadMore = () => {
        if (!isLoadingMore && currentPage < totalPages) {
            fetchData(currentPage + 1);
        }
    };

    // Other handlers (handleSortChange, handleDownloadImage, etc.) from original component...
    const handleSortChange = (newSortCol: string) => {
        const newSortOrder = sortBy === newSortCol ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'desc';
        setSortBy(newSortCol);
        setSortOrder(newSortOrder);
    };

    const handleDownloadImage = async (imageUrl: string | null) => {
        if (!imageUrl) return Alert.alert("Error", "No image URL.");
        const id = selectedInspection?.id || 'unknown';
        if (Platform.OS === 'web') {
            try {
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `spediak_inspection_${id}.jpg`;
                link.click();
                window.URL.revokeObjectURL(url);
            } catch (error) { Alert.alert("Error", "Failed to download image."); }
        } else {
            try {
                const { status } = await requestMediaLibraryPermission();
                if (status !== 'granted') return Alert.alert("Permission Denied", "Storage permission is required.");
                const fileUri = FileSystem.documentDirectory + `spediak_inspection_${id}.jpg`;
                const { uri } = await FileSystem.downloadAsync(imageUrl, fileUri);
                await MediaLibrary.saveToLibraryAsync(uri);
                Alert.alert("Success", "Image saved to gallery!");
            } catch (error) { Alert.alert("Error", "Failed to save image."); }
        }
    };
    
    // JSX Rendering for All Inspections...
    const renderInspectionItem = ({ item }: { item: AdminInspectionData }) => (
            <View style={styles.cardContainer}>
                <View style={styles.cardHeaderInfo}>
                    <View style={styles.userInfoRow}>
                    {item.userProfilePhoto ? <Image source={{ uri: item.userProfilePhoto }} style={styles.userImageSmall} /> : <View style={styles.userImagePlaceholderSmall}><UserCircle size={20} color={COLORS.secondary} /></View>}
                        <View style={styles.userInfoTextContainer}>
                        <Text style={styles.cardUserText}>{item.userName || 'Unknown'}</Text>
                        <Text style={styles.cardDetailText}>{item.userEmail} {item.userState ? `(${item.userState})` : ''}</Text>
                        </View>
                    </View>
                    <Text style={styles.cardDateText}>{new Date(item.created_at).toLocaleString()}</Text>
                </View>
                <View style={styles.inspectionDetailsContainer}>
                <TouchableOpacity onPress={() => { setFullScreenImageUrl(item.image_url); setSelectedInspection(item); setIsFullImageModalVisible(true); }}>
                    <Image source={{ uri: getOptimizedImageUrl(item.image_url, 80, 80) }} style={styles.cardImage} />
                            </TouchableOpacity>
                    <View style={styles.inspectionTextContainer}>
                        <Text style={styles.cardDescriptionLabel}>Description:</Text>
                        <Text style={styles.cardDescriptionText} numberOfLines={1}>{item.description}</Text>
                    <TouchableOpacity style={styles.viewReportButton} onPress={() => { setSelectedInspection(item); setIsModalVisible(true); }}>
                                <Eye size={16} color={COLORS.primary} />
                        <Text style={styles.viewReportButtonText}>View</Text>
                            </TouchableOpacity>
                    </View>
                </View>
            </View>
        );

    if (isLoading && currentPage === 1) return <ActivityIndicator size="large" style={styles.loader} />;
    if (error) return <Text style={styles.errorText}>{error}</Text>;

    return (
        <View style={{ flex: 1 }}>
            <View style={styles.controlsContainer}>
                <Text style={styles.totalCountText}>Total: {totalInspectionsCount}</Text>
                <View style={styles.searchWrapper}>
                     <Search size={18} color="#888" style={styles.searchIcon} />
                    <TextInput style={styles.searchInput} placeholder="Search..." value={searchQuery} onChangeText={setSearchQuery} />
                </View>
                <TouchableOpacity onPress={() => handleSortChange('created_at')} style={styles.sortButton}>
                    <Text style={styles.sortButtonText}>Date {sortBy === 'created_at' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</Text>
                </TouchableOpacity>
            </View>
            <FlatList data={inspections} renderItem={renderInspectionItem} keyExtractor={item => item.id} onEndReached={handleLoadMore} onEndReachedThreshold={0.5} ListFooterComponent={isLoadingMore ? <ActivityIndicator /> : null} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />} />
            {selectedInspection && <DdidModal visible={isModalVisible} onClose={() => setIsModalVisible(false)} ddidText={selectedInspection.ddid} imageUri={selectedInspection.image_url || undefined} />}
            {isFullImageModalVisible && <RNModal visible={isFullImageModalVisible} transparent={true} onRequestClose={() => setIsFullImageModalVisible(false)}><View style={styles.fullImageModalContainer}><TouchableOpacity style={styles.fullImageCloseButton} onPress={() => setIsFullImageModalVisible(false)}><XIcon size={30} color="#fff" /></TouchableOpacity><Image source={{ uri: fullScreenImageUrl ?? undefined }} style={styles.fullImage} resizeMode="contain" /><TouchableOpacity style={styles.downloadButtonFloating} onPress={() => handleDownloadImage(fullScreenImageUrl)}><Download size={24} color="#fff" /></TouchableOpacity></View></RNModal>}
        </View>
    );
};

// --- All Users Component ---
const AllUsers: React.FC = () => {
    // States and hooks from original component...
    const [users, setUsers] = useState<UserData[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsersCount, setTotalUsersCount] = useState<number>(0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const { getToken } = useAuth();
    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    // Fetch users function from original component...
    const fetchUsers = useCallback(async (page = 1, search = debouncedSearchQuery, refreshing = false) => {
        if (!refreshing && page === 1) setIsLoading(true);
        if (page > 1) setIsLoadingMore(true);
        setError(null);
        try {
            const token = await getToken();
            const response = await axios.get<PaginatedResponse<UserData>>(`${BASE_URL}/api/admin/all-users`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { page, limit: 15, search }
            });
            const { users: fetchedUsers = [], totalPages: fetchedTotalPages, page: fetchedPage, totalCount } = response.data;
            setUsers(prev => (page === 1 ? fetchedUsers : [...prev, ...fetchedUsers]));
            setTotalPages(fetchedTotalPages);
            setCurrentPage(fetchedPage);
            if (totalCount !== undefined) setTotalUsersCount(totalCount);
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to fetch user data.");
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
            if (refreshing) setIsRefreshing(false);
        }
    }, [getToken, debouncedSearchQuery]);

    useEffect(() => {
        fetchUsers(1);
    }, [debouncedSearchQuery]);

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchUsers(1, searchQuery, true);
    }, [fetchUsers, searchQuery]);

    const handleLoadMore = () => {
        if (!isLoadingMore && currentPage < totalPages) {
            fetchUsers(currentPage + 1);
        }
    };
    
    const handleDeleteUser = async (userId: string) => {
        Alert.alert("Confirm Deletion", "Are you sure you want to delete this user?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
        try {
            const token = await getToken();
                    await axios.delete(`${BASE_URL}/api/admin/delete-user/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
                    Alert.alert("Success", "User deleted.");
                    fetchUsers(1);
                } catch (err: any) {
                    Alert.alert("Error", err.response?.data?.message || "Failed to delete user.");
                }
            }}
        ]);
    };
    
    // JSX Rendering for All Users...
    const renderUserItem = ({ item }: { item: UserData }) => (
        <View style={styles.userCard}>
            <View style={styles.userCardContent}>
                {item.profilePhoto ? <Image source={{ uri: item.profilePhoto }} style={styles.userImage} /> : <View style={styles.userImagePlaceholder}><UserCircle size={40} color={COLORS.secondary} /></View>}
                <View style={styles.userInfo}>
                    <Text style={styles.userNameText}>{item.name || 'N/A'}</Text>
                    <Text style={styles.userEmailText}>{item.email}</Text>
                    <Text style={styles.userMetaText}>Inspections: {item.inspectionCount || 0}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteUser(item.id)} style={styles.deleteButton}><Trash2 size={24} color={COLORS.danger} /></TouchableOpacity>
            </View>
        </View>
    );

    if (isLoading && currentPage === 1) return <ActivityIndicator size="large" style={styles.loader} />;
    if (error) return <Text style={styles.errorText}>{error}</Text>;
    
    return (
        <View style={{ flex: 1 }}>
            <View style={styles.userControlsContainer}>
                <Text style={styles.totalCountText}>Total: {totalUsersCount}</Text>
                <View style={styles.searchWrapperUsers}>
                    <Search size={18} color="#888" style={styles.searchIcon} />
                    <TextInput style={styles.searchInput} placeholder="Search..." value={searchQuery} onChangeText={setSearchQuery} />
                </View>
            </View>
            <FlatList data={users} renderItem={renderUserItem} keyExtractor={item => item.id} onEndReached={handleLoadMore} onEndReachedThreshold={0.5} ListFooterComponent={isLoadingMore ? <ActivityIndicator /> : null} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />} />
        </View>
    );
};

// --- Prompt Editor Component (NEW) ---
const PromptEditor = () => {
    // States and hooks from new implementation...
    const { getToken, userId } = useAuth();
    const [prompts, setPrompts] = useState<Prompt[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLockedForEditing, setIsLockedForEditing] = useState(false);
    const [lockedByOther, setLockedByOther] = useState<string | null>(null);
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [selectedPromptHistory, setSelectedPromptHistory] = useState<PromptVersion[]>([]);
    const [selectedPromptForHistory, setSelectedPromptForHistory] = useState<Prompt | null>(null);
    
    // Functions (fetchPrompts, handleLockToggle, etc.) from new implementation...
    const fetchPromptsData = useCallback(async (isPolling = false) => {
        if (!isPolling) setIsLoading(true);
        try {
            const token = await getToken();
            const response = await api.get('/admin/prompts', { headers: { Authorization: `Bearer ${token}` } });
            const serverPrompts = response.data as Prompt[];

            // If we are polling, we don't want to overwrite local changes if the user is editing.
            const isCurrentlyLockedByMe = prompts.some(p => p.is_locked && p.locked_by === userId);
            if (isPolling && isCurrentlyLockedByMe) {
                const lockedPrompt = serverPrompts.find(p => p.is_locked);
                // Only update lock status from polling, not content
                setIsLockedForEditing(!!lockedPrompt);
                setLockedByOther(lockedPrompt && lockedPrompt.locked_by !== userId ? lockedPrompt.username : null);
            } else {
                // Full update on initial load or if not editing
                setPrompts(serverPrompts);
                const lockedPrompt = serverPrompts.find(p => p.is_locked);
                setIsLockedForEditing(!!lockedPrompt);
                setLockedByOther(lockedPrompt && lockedPrompt.locked_by !== userId ? lockedPrompt.username : null);
            }
            setError(null);
        } catch (err) {
            setError('Failed to fetch prompts.');
        } finally {
            if (!isPolling) setIsLoading(false);
        }
    }, [getToken, userId, prompts]);


    // Initial fetch
    useEffect(() => {
        fetchPromptsData(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Polling for lock status
    useEffect(() => {
        const interval = setInterval(() => fetchPromptsData(true), 5000);
        return () => clearInterval(interval);
    }, [fetchPromptsData]);


    const handleLockToggle = async (value: boolean) => {
        const action = value ? 'lock' : 'unlock';
        try {
            const token = await getToken();
            const promises = prompts.map(p => api.post(`/admin/prompts/${p.id}/${action}`, {}, { headers: { Authorization: `Bearer ${token}` } }));
            await Promise.all(promises);
            fetchPromptsData(false); // Re-fetch to update lock status
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || `Failed to ${action} prompts.`);
            fetchPromptsData(false);
        }
    };
    
    const onSave = async () => {
        setIsSaving(true);
        try {
            const token = await getToken();
            // Use Promise.all to send all updates concurrently
            const promises = prompts.map(p => 
                api.post('/admin/prompts/update', { id: p.id, prompt_content: p.prompt_content }, { 
                    headers: { Authorization: `Bearer ${token}` } 
                })
            );
            await Promise.all(promises);
            
            Alert.alert('Success', 'Prompts saved successfully.');

            // After a successful save, we can unlock the prompts
            await handleLockToggle(false); 
            
            // The fetchPromptsData will be called by handleLockToggle, no need to call it again here.
            
        } catch (err: any) {
            // Provide more specific error feedback
            Alert.alert('Error', err.response?.data?.message || 'Failed to save prompts. Please try again.');
            // Re-fetch data on error to ensure UI is in sync with the server
            fetchPromptsData(false);
        } finally {
            setIsSaving(false);
        }
    };

    const handleContentChange = (text: string, id: number) => {
        setPrompts(current => current.map(p => (p.id === id ? { ...p, prompt_content: text } : p)));
    };

    const viewHistory = async (prompt: Prompt) => {
        try {
            const token = await getToken();
            const response = await api.get(`/admin/prompts/${prompt.id}/history`, { headers: { Authorization: `Bearer ${token}` } });
            setSelectedPromptHistory(response.data as PromptVersion[]);
            setSelectedPromptForHistory(prompt);
            setHistoryModalVisible(true);
        } catch (err) {
            Alert.alert('Error', 'Failed to fetch history.');
        }
    };

    const restoreVersion = async (versionId: number) => {
        if (!selectedPromptForHistory) return;
        try {
            const token = await getToken();
            await api.post('/admin/prompts/restore', { prompt_id: selectedPromptForHistory.id, version_id: versionId }, { headers: { Authorization: `Bearer ${token}` } });
            Alert.alert('Success', 'Version restored.');
            setHistoryModalVisible(false);
            fetchPromptsData(false);
        } catch (err) {
            Alert.alert('Error', 'Failed to restore version.');
        }
    };
    
    // JSX Rendering for Prompt Editor...
    if (isLoading) return <ActivityIndicator size="large" style={styles.loader} />;
    if (error) return <Text style={styles.errorText}>{error}</Text>;

    const isLockedByMe = prompts.some(p => p.is_locked && p.locked_by === userId);
    
    return (
        <ScrollView style={styles.promptEditorContainer}>
            <View style={styles.lockContainer}>
                <Text style={styles.lockLabel}>Lock for Editing</Text>
                <Switch value={isLockedByMe} onValueChange={handleLockToggle} disabled={!!lockedByOther && !isLockedByMe} />
            </View>
            {lockedByOther && !isLockedByMe && <Text style={styles.lockedByText}>Locked by: {lockedByOther}</Text>}
            
            {prompts.map(prompt => (
                <View key={prompt.id} style={styles.promptCard}>
                    <View style={styles.promptHeader}>
                        <Text style={styles.promptTitle}>{prompt.prompt_name.replace(/_/g, ' ').toUpperCase()}</Text>
                        <TouchableOpacity style={styles.historyIconButton} onPress={() => viewHistory(prompt)}>
                            <History size={20} color={COLORS.primary} />
                        </TouchableOpacity>
                    </View>
                    <TextInput 
                        style={[styles.textInput, !isLockedByMe && styles.disabledInput]} 
                        value={prompt.prompt_content} 
                        onChangeText={text => handleContentChange(text, prompt.id)} 
                        multiline 
                        editable={isLockedByMe} 
                    />
                </View>
            ))}

            <TouchableOpacity 
                style={[styles.saveButton, (!isLockedByMe || isSaving) && styles.disabledButton]} 
                onPress={onSave} 
                disabled={!isLockedByMe || isSaving}>
                <Save size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
            </TouchableOpacity>

            {historyModalVisible && <HistoryModal visible={historyModalVisible} onClose={() => setHistoryModalVisible(false)} history={selectedPromptHistory} onRestore={restoreVersion} promptName={selectedPromptForHistory?.prompt_name || ''} />}
        </ScrollView>
    );
};

// --- History Modal Component ---
const HistoryModal = ({ visible, onClose, history, onRestore, promptName }: { visible: boolean, onClose: () => void, history: PromptVersion[], onRestore: (versionId: number) => void, promptName: string }) => (
    <RNModal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
        <View style={styles.centeredView}>
            <View style={styles.modalView}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>History for {promptName.replace(/_/g, ' ')}</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <XIcon size={24} color={COLORS.darkText} />
                    </TouchableOpacity>
                </View>
                <ScrollView style={styles.historyScrollView}>
                    {history.length > 0 ? history.map(item => (
                        <View key={item.id} style={styles.historyItem}>
                            <View style={styles.historyItemHeader}>
                                <Text style={styles.historyVersionText}>Version {item.version}</Text>
                                <Text style={styles.historyMetaText}>by {item.updated_by_username} on {format(new Date(item.created_at), 'Pp')}</Text>
                            </View>
                            <Text style={styles.historyContentText} selectable>{item.prompt_content}</Text>
                            <TouchableOpacity style={styles.restoreButton} onPress={() => onRestore(item.id)}>
                                <Text style={styles.restoreButtonText}>Restore This Version</Text>
                            </TouchableOpacity>
                        </View>
                    )) : <Text style={styles.noHistoryText}>No history found.</Text>}
                </ScrollView>
            </View>
        </View>
    </RNModal>
);

// --- NEW: Knowledge Base Component ---
const KnowledgeManager = () => {
    const { getToken } = useAuth();
    const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const fetchDocuments = useCallback(async () => {
        if (isLoading) {
            setError(null);
        }
        try {
            const token = await getToken();
            if (!token) {
                setError("Authentication token not found. Please log in again.");
                setIsLoading(false);
                return;
            }
            const response = await axios.get(`${BASE_URL}/api/admin/knowledge`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.status === 200) {
                 const sortedDocs = (response.data as KnowledgeDocument[]).sort((a, b) =>
                    new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
                 );
                 setDocuments(sortedDocs);
            } else {
                setError(`Failed to fetch documents. Status: ${response.status}`);
            }
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message || 'An unexpected error occurred while fetching documents.';
            setError(errorMessage);
            console.error('Fetch documents error:', err);
        } finally {
            if (isLoading) {
                setIsLoading(false);
            }
        }
    }, [getToken, isLoading]);

    const handleUpload = async () => {
        if (!selectedFile) return;
        setIsUploading(true);
        setError(null);
        const formData = new FormData();
        formData.append('document', selectedFile);

        try {
            const token = await getToken();
            await axios.post(`${BASE_URL}/api/admin/knowledge/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`,
                },
            });
            setSelectedFile(null); // Clear file input
        } catch (err: any)
        {
            const errorMessage = err.response?.data?.message || err.message || 'An error occurred during upload.';
            setError(errorMessage);
            console.error(err);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (docId: number) => {
        Alert.alert('Confirm Deletion', 'Are you sure you want to delete this document? This action cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const token = await getToken();
                        if (!token) {
                            setError('Authentication error.');
                            return;
                        }
                        await axios.delete(`${BASE_URL}/api/admin/knowledge/${docId}`, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== docId));
                    } catch (err: any) {
                        setError('Failed to delete document.');
                        console.error(err);
                    }
                },
            },
        ]);
    };

    useEffect(() => {
        if (isLoading) {
            fetchDocuments();
        }
        const interval = setInterval(() => {
            fetchDocuments();
        }, 5000);
        return () => clearInterval(interval);
    }, [fetchDocuments, isLoading]);


    const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setSelectedFile(event.target.files[0]);
        }
    };

    if (isLoading) {
        return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />;
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <View style={styles.uploadCard}>
                <Text style={styles.cardTitle}>Upload New Document</Text>
                <Text style={styles.cardSubtitle}>Accepted formats: PDF, TXT, MD</Text>
                <View style={styles.fileInputContainer}>
                     <input type="file" onChange={onFileChange} accept=".pdf,.txt,.md" />
                     {selectedFile && <Text style={{ marginLeft: 10 }}>{selectedFile.name}</Text>}
                </View>
                <TouchableOpacity
                    style={[styles.button, styles.uploadButton, (isUploading || !selectedFile) && styles.disabledButton]}
                    onPress={handleUpload}
                    disabled={isUploading || !selectedFile}
                >
                    <Text style={styles.buttonText}>{isUploading ? 'Uploading...' : 'Upload Document'}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.documentsCard}>
                <Text style={styles.cardTitle}>Uploaded Documents</Text>
                {documents.map(doc => (
                    <View key={doc.id} style={styles.documentItem}>
                        <FileText size={24} color={COLORS.primary} />
                        <View style={styles.documentInfo}>
                            <Text style={styles.documentName}>{doc.file_name}</Text>
                            <Text style={styles.documentMeta}>Uploaded: {format(new Date(doc.uploaded_at), 'Pp')}</Text>
                            <Text style={styles.documentMeta}>Status: {doc.status}</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleDelete(doc.id)} style={styles.deleteButton}>
                            <Trash2 size={24} color={COLORS.danger} />
                        </TouchableOpacity>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
};


// --- Main Admin Dashboard Screen ---
const Tab = createMaterialTopTabNavigator();
const AdminDashboardScreen = () => {
    // Hooks for tab locking...
    const { getToken, userId } = useAuth();
    const [isPromptEditorLocked, setIsPromptEditorLocked] = useState(false);
    const [promptLocker, setPromptLocker] = useState<string | null>(null);

    const checkLockStatusForTabs = useCallback(async () => {
        try {
            const token = await getToken();
            const response = await api.get('/admin/prompts', { headers: { Authorization: `Bearer ${token}` } });
            const serverPrompts = response.data as Prompt[];
            const lockedPrompt = serverPrompts.find(p => p.is_locked);
            if (lockedPrompt && lockedPrompt.locked_by !== userId) {
                setIsPromptEditorLocked(true);
                setPromptLocker(lockedPrompt.username);
            } else {
                setIsPromptEditorLocked(false);
                setPromptLocker(null);
            }
        } catch (error) { console.error("Could not check prompt lock status for tabs:", error); }
    }, [getToken, userId]);

    useEffect(() => {
        checkLockStatusForTabs();
        const interval = setInterval(checkLockStatusForTabs, 7000);
        return () => clearInterval(interval);
    }, [checkLockStatusForTabs]);

    return (
        <Tab.Navigator screenOptions={{ tabBarActiveTintColor: COLORS.primary, tabBarInactiveTintColor: 'gray' }}>
            <Tab.Screen name="All Inspections" component={AllInspections} />
            <Tab.Screen name="All Users" component={AllUsers} />
            <Tab.Screen name="Prompt Editor" component={PromptEditor} listeners={{ tabPress: (e: any) => { if (isPromptEditorLocked) { e.preventDefault(); Alert.alert('Locked', `Locked by ${promptLocker}.`); } } }} options={{ tabBarLabel: isPromptEditorLocked ? `Prompt Editor (Locked)` : 'Prompt Editor' }} />
            <Tab.Screen name="Knowledge" component={KnowledgeManager} options={{ tabBarLabel: 'Knowledge Base' }} />
        </Tab.Navigator>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { color: 'red', textAlign: 'center', margin: 20 },
    // All Inspections & All Users Styles...
    cardContainer: { backgroundColor: '#fff', borderRadius: 8, marginVertical: 8, padding: 16 },
    cardHeaderInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    userInfoRow: { flexDirection: 'row', alignItems: 'center' },
    userImageSmall: { width: 30, height: 30, borderRadius: 15, marginRight: 8 },
    userImagePlaceholderSmall: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
    userInfoTextContainer: { flex: 1 },
    cardUserText: { fontWeight: 'bold' },
    cardDetailText: { fontSize: 12, color: 'gray' },
    cardDateText: { fontSize: 12, color: 'gray' },
    inspectionDetailsContainer: { flexDirection: 'row', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#eee' },
    cardImage: { width: 80, height: 80, borderRadius: 4, marginRight: 12 },
    inspectionTextContainer: { flex: 1 },
    cardDescriptionLabel: { fontSize: 12, color: 'gray' },
    cardDescriptionText: {},
    viewReportButton: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
    viewReportButtonText: { marginLeft: 4, color: COLORS.primary },
    controlsContainer: { flexDirection: 'row', padding: 16, alignItems: 'center' },
    totalCountText: { marginRight: 16 },
    searchWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 8 },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, height: 40 },
    sortButton: { marginLeft: 16 },
    sortButtonText: { color: COLORS.primary },
    fullImageModalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
    fullImageCloseButton: { position: 'absolute', top: 40, right: 20, zIndex: 1 },
    fullImage: { width: '90%', height: '90%' },
    downloadButtonFloating: { position: 'absolute', bottom: 40, right: 20, zIndex: 1 },
    userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, marginVertical: 8, padding: 16 },
    userCardContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    userImage: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
    userImagePlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    userInfo: { flex: 1 },
    userNameText: { fontWeight: 'bold' },
    userEmailText: { color: 'gray' },
    userMetaText: { color: 'gray' },
    deleteButton: {},
    userControlsContainer: { flexDirection: 'row', padding: 16, alignItems: 'center' },
    searchWrapperUsers: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 8 },
    // Prompt Editor Styles...
    promptEditorContainer: { flex: 1, padding: 16 },
    lockContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 8, marginBottom: 16 },
    lockLabel: { fontSize: 18, fontWeight: 'bold' },
    lockedByText: { textAlign: 'center', color: 'red', marginBottom: 16 },
    promptCard: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 16 },
    promptHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    promptTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.darkText,
        letterSpacing: 0.5,
    },
    textInput: {
        height: 200, // Increased height for more content visibility
        textAlignVertical: 'top', // Start text from the top
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        padding: 12, // Increased padding
        marginBottom: 8,
        fontSize: 14,
        lineHeight: 20,
    },
    disabledInput: { backgroundColor: '#f0f0f0' },
    historyIconButton: {
        padding: 8,
    },
    historyButton: { alignItems: 'center', padding: 8, backgroundColor: '#007bff', borderRadius: 4 },
    historyButtonText: { color: '#fff' },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: COLORS.success, // Use a success color
        borderRadius: 8,
        marginTop: 10,
    },
    saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    disabledButton: { backgroundColor: 'gray' },
    // History Modal Styles...
    centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: { width: '90%', backgroundColor: 'white', borderRadius: 8, padding: 16 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    historyItem: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    closeButton: {
        padding: 8,
    },
    historyScrollView: {
        maxHeight: Dimensions.get('window').height * 0.6,
    },
    historyItemHeader: {
        marginBottom: 8,
    },
    historyVersionText: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    historyMetaText: {
        fontSize: 12,
        color: 'gray',
    },
    historyContentText: {
        fontSize: 14,
        marginBottom: 8,
    },
    restoreButton: {
        alignSelf: 'flex-start',
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: COLORS.primary,
        borderRadius: 4,
    },
    restoreButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    noHistoryText: {
        textAlign: 'center',
        color: 'gray',
        marginTop: 20,
    },
    // Knowledge Base Styles
    container: {
        flex: 1,
        padding: 16,
    },
     errorContainer: {
        backgroundColor: '#ffdddd',
        padding: 10,
        borderRadius: 8,
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    contentContainer: {
        flexGrow: 1,
    },
    uploadCard: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    cardSubtitle: {
        fontSize: 12,
        color: 'gray',
        marginBottom: 16,
    },
    fileInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    uploadButton: {
        backgroundColor: COLORS.primary,
    },
    documentsCard: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 16,
    },
    documentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    documentInfo: {
        flex: 1,
        marginLeft: 12,
    },
    documentName: {
        fontWeight: 'bold',
        color: COLORS.darkText,
    },
    documentMeta: {
        fontSize: 12,
        color: 'gray',
    },
     documentError: {
        fontSize: 12,
        color: COLORS.danger,
        marginTop: 4,
        fontStyle: 'italic',
    },
});

export default AdminDashboardScreen;