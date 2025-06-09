import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Alert, Image, SafeAreaView, TouchableOpacity, Platform, TextInput, Modal as RNModal, Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-expo';
import { BASE_URL } from '../config/api';
import { COLORS } from '../styles/colors';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Search, Eye, UserCircle, Download, Trash2, X as XIcon } from 'lucide-react-native';
import DdidModal from '../components/DdidModal';
import { useDebounce } from '../hooks/useDebounce';
import * as FileSystem from 'expo-file-system'; // For native download
import * as MediaLibrary from 'expo-media-library'; // For saving to gallery on native

// Helper function to get optimized Cloudinary image URL (copied from InspectionHistoryScreen)
const getOptimizedImageUrl = (url: string | null | undefined, width: number, height: number): string | undefined => {
    if (!url || !url.includes('cloudinary.com')) return url || undefined;
    try {
        const parts = url.split('/upload/');
        if (parts.length === 2) {
            return `${parts[0]}/upload/w_${width},h_${height},c_pad,q_auto/${parts[1]}`;
        }
    } catch (e) {
        console.warn("Error constructing optimized image URL:", e);
    }
    return url; // Fallback to original URL if manipulation fails
};

// Interface for the combined data expected from the admin endpoint
interface AdminInspectionData {
    id: string;
    user_id: string;
    image_url: string | null;
    description: string;
    ddid: string;
    state: string | null; // Inspection state
    created_at: string;
    userName: string;
    userEmail: string;
    userState: string | null; // Added back
    userProfilePhoto: string | null; // Added back
}

interface UserData {
    id: string;
    name: string;
    email: string;
    username: string | null; // Add username field
    createdAt: string | Date;
    state: string | null;
    profilePhoto: string | null;
    inspectionCount: number;
}

// API Response Interfaces
interface PaginatedResponse<T> {
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
    inspections?: T[]; // Use specific keys based on endpoint
    users?: T[];
}

// Component for the Inspection List
const InspectionList: React.FC = () => {
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

    // State for full image preview modal
    const [fullScreenImageUrl, setFullScreenImageUrl] = useState<string | null>(null);
    const [isFullImageModalVisible, setIsFullImageModalVisible] = useState(false);

    const fetchData = useCallback(async (page = 1, search = debouncedSearchQuery, sortCol = sortBy, sortDir = sortOrder, refreshing = false) => {
        console.log(`[AdminInspections] Fetching page ${page}, search: '${search}', sort: ${sortCol} ${sortDir}`);
        if (!refreshing && page === 1) setIsLoading(true);
        if (page > 1) setIsLoadingMore(true);
        setError(null);

        try {
            const token = await getToken();
            if (!token) throw new Error("User not authenticated");

            const params = {
                page,
                limit: 15, // Keep limit consistent
                search,
                sortBy: sortCol,
                sortOrder: sortDir
            };

            const response = await axios.get<PaginatedResponse<AdminInspectionData>>(`${BASE_URL}/api/admin/all-inspections`, {
                headers: { Authorization: `Bearer ${token}` },
                params
            });

            const { inspections: fetchedInspections = [], totalPages: fetchedTotalPages, page: fetchedPage, totalCount: fetchedTotalCount } = response.data;

            setInspections(prev => (page === 1 ? fetchedInspections : [...prev, ...fetchedInspections]));
            setTotalPages(fetchedTotalPages);
            setCurrentPage(fetchedPage);
            if (fetchedTotalCount !== undefined) {
                setTotalInspectionsCount(fetchedTotalCount);
            }

        } catch (err: any) {
             console.error("[AdminInspections] Error fetching data:", err);
            let errorMessage = "Failed to fetch inspection data.";
            if (err.response) { errorMessage = err.response.data?.message || errorMessage; }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
            if (refreshing) setIsRefreshing(false);
        }
    }, [getToken, debouncedSearchQuery, sortBy, sortOrder]);

    useEffect(() => {
        fetchData(1);
    }, []);

    useEffect(() => {
        if (debouncedSearchQuery !== undefined || sortBy !== 'created_at' || sortOrder !== 'desc') {
            setCurrentPage(1);
            fetchData(1);
        }
    }, [debouncedSearchQuery, sortBy, sortOrder]);

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        setCurrentPage(1);
        fetchData(1, searchQuery, sortBy, sortOrder, true);
    }, [fetchData, searchQuery, sortBy, sortOrder]);

    const handleLoadMore = () => {
        if (!isLoadingMore && currentPage < totalPages) {
            console.log('[AdminInspections] Loading more...', currentPage + 1);
            fetchData(currentPage + 1);
        } else {
            console.log('[AdminInspections] No more pages or already loading.');
        }
    };

    const handleSortChange = (newSortCol: string) => {
        const newSortOrder = sortBy === newSortCol ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'desc';
        setSortBy(newSortCol);
        setSortOrder(newSortOrder);
    };

    const renderInspectionItem = ({ item }: { item: AdminInspectionData }): JSX.Element => {
        const optimizedCardImageUrl = getOptimizedImageUrl(item.image_url, 80, 80);

        return (
            <View style={styles.cardContainer}>
                <View style={styles.cardHeaderInfo}>
                    {/* User Info with Photo */}
                    <View style={styles.userInfoRow}>
                        {item.userProfilePhoto ? (
                            <Image source={{ uri: item.userProfilePhoto }} style={styles.userImageSmall} />
                        ) : (
                            <View style={styles.userImagePlaceholderSmall}>
                                <UserCircle size={20} color={COLORS.secondary} />
                            </View>
                        )}
                        <View style={styles.userInfoTextContainer}>
                            <Text style={styles.cardUserText} numberOfLines={1}>{item.userName || 'Unknown User'}</Text>
                            <Text style={styles.cardDetailText} numberOfLines={1}>
                                {item.userEmail} {item.userState ? `(${item.userState})` : ''}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.cardDateText}>{new Date(item.created_at).toLocaleString()}</Text>
                </View>

                {/* Inspection Details Section */}
                <View style={styles.inspectionDetailsContainer}>
                    <View style={styles.inspectionImageContainer}>
                        {optimizedCardImageUrl ? (
                            <TouchableOpacity onPress={() => {
                                setFullScreenImageUrl(item.image_url); // Use original for full screen
                                setIsFullImageModalVisible(true);
                            }}>
                                <Image source={{ uri: optimizedCardImageUrl }} style={styles.cardImage} resizeMode="cover" />
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.cardImagePlaceholder}><Text style={styles.placeholderText}>No image</Text></View>
                        )}
                    </View>
                    <View style={styles.inspectionTextContainer}>
                        <Text style={styles.cardDescriptionLabel}>Description:</Text>
                        <Text style={styles.cardDescriptionText} numberOfLines={1}>{item.description}</Text>
                        <View style={styles.inspectionActionsRow}>
                            <TouchableOpacity
                                style={styles.viewReportButton}
                                onPress={() => {
                                    setSelectedInspection(item);
                                    setIsModalVisible(true);
                                }}
                            >
                                <Eye size={16} color={COLORS.primary} />
                                <Text style={styles.viewReportButtonText}>View Statement</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    const renderFooter = () => {
        if (!isLoadingMore) return null;
        return <ActivityIndicator style={{ marginVertical: 20 }} size="large" color={COLORS.primary} />;
    };

    if (isLoading && currentPage === 1 && !isRefreshing) return <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />;
    if (error && inspections.length === 0) return <Text style={styles.errorText}>{error}</Text>;

    return (
        <View style={{flex: 1}}>
            <View style={styles.controlsContainer}>
                {/* Display Total Inspections Count */}
                {(!isLoading || isRefreshing) && ( // Show when not in initial load or when refreshing
                    <Text style={styles.totalCountText}>
                        Total Statements: {totalInspectionsCount}
                    </Text>
                )}
                <View style={styles.searchWrapper}>
                     <Search size={18} color="#888" style={styles.searchIcon} />
                     <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name, email, description..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#999"
                     />
                </View>
                <TouchableOpacity onPress={() => handleSortChange('created_at')} style={styles.sortButton}>
                    <Text style={styles.sortButtonText}>Date {sortBy === 'created_at' && (sortOrder === 'asc' ? '▲' : '▼')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleSortChange('userName')} style={styles.sortButton}>
                    <Text style={styles.sortButtonText}>User {sortBy === 'userName' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={inspections}
                renderItem={renderInspectionItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContainer}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderFooter}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />}
                ListEmptyComponent={<Text style={styles.emptyListText}>No inspections found.</Text>}
            />

            {selectedInspection && (
                <DdidModal
                    visible={isModalVisible}
                    onClose={() => setIsModalVisible(false)}
                    ddidText={selectedInspection.ddid}
                    imageUri={selectedInspection.image_url}
                />
            )}

             {/* Full-screen Image Preview Modal */}
            <RNModal
                visible={isFullImageModalVisible}
                transparent={true}
                onRequestClose={() => setIsFullImageModalVisible(false)}
                animationType="fade"
            >
                <View style={styles.fullImageModalContainer}>
                    <TouchableOpacity
                        style={styles.fullImageCloseButton}
                        onPress={() => setIsFullImageModalVisible(false)}
                    >
                        <XIcon size={30} color="#fff" />
                    </TouchableOpacity>
                    <Image
                        source={{ uri: fullScreenImageUrl || undefined }}
                        style={styles.fullImage}
                        resizeMode="contain"
                    />
                </View>
            </RNModal>
        </View>
    );
};

// Component for the User List
const UserList: React.FC = () => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsersCount, setTotalUsersCount] = useState<number>(0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const { getToken } = useAuth();
    const debouncedSearchQuery = useDebounce(searchQuery, 500);
    const [isExporting, setIsExporting] = useState<boolean>(false);

    const fetchUsers = useCallback(async (page = 1, search = debouncedSearchQuery, sortCol = sortBy, sortDir = sortOrder, refreshing = false) => {
        console.log(`[AdminUsers] Fetching page ${page}, search: '${search}', sort: ${sortCol} ${sortDir}`);
        if (!refreshing && page === 1) setIsLoading(true);
        if (page > 1) setIsLoadingMore(true);
        setError(null);

        try {
            const token = await getToken();
            if (!token) throw new Error("User not authenticated");

            const params = {
                page,
                limit: 15,
                search,
                sortBy: sortCol,
                sortOrder: sortDir
            };

            const response = await axios.get<PaginatedResponse<UserData>>(`${BASE_URL}/api/admin/all-users`, {
                headers: { Authorization: `Bearer ${token}` },
                params
            });

            const { users: fetchedUsers = [], totalPages: fetchedTotalPages, page: fetchedPage, totalCount: fetchedTotalCount } = response.data;

            setUsers(prev => (page === 1 ? fetchedUsers : [...prev, ...fetchedUsers]));
            setTotalPages(fetchedTotalPages);
            setCurrentPage(fetchedPage);
            if (fetchedTotalCount !== undefined) {
                setTotalUsersCount(fetchedTotalCount);
            }

        } catch (err: any) {
            console.error("[AdminUsers] Error fetching users:", err);
            let errorMessage = "Failed to fetch user data.";
            if (err.response) { errorMessage = err.response.data?.message || errorMessage; }
            else if (err.message) { errorMessage = err.message; }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
            if (refreshing) setIsRefreshing(false);
        }
    }, [getToken, debouncedSearchQuery, sortBy, sortOrder]);

    useEffect(() => {
        fetchUsers(1);
    }, []);

    useEffect(() => {
        if (debouncedSearchQuery !== undefined || sortBy !== 'createdAt' || sortOrder !== 'desc') {
             setCurrentPage(1);
             fetchUsers(1);
        }
    }, [debouncedSearchQuery, sortBy, sortOrder]);

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        setCurrentPage(1);
        fetchUsers(1, searchQuery, sortBy, sortOrder, true);
    }, [fetchUsers, searchQuery, sortBy, sortOrder]);

    const handleLoadMore = () => {
        if (!isLoadingMore && currentPage < totalPages) {
            console.log('[AdminUsers] Loading more users...', currentPage + 1);
            fetchUsers(currentPage + 1);
        } else {
            console.log('[AdminUsers] No more user pages or already loading.');
        }
    };

    const handleExportUsers = async () => {
        setIsExporting(true);
        console.log('[AdminExportUsers] DEBUG: Bypassing alert, attempting export directly.'); // Debug log

        // Temporarily bypass Alert for debugging
        try {
            const token = await getToken();
            if (!token) {
                Alert.alert("Authentication Error", "Could not get authentication token.");
                setIsExporting(false);
                return;
            }
            console.log('[AdminExportUsers] Requesting CSV from:', `${BASE_URL}/api/admin/export-users-csv`);

            if (Platform.OS === 'web') {
                const response = await axios.get(`${BASE_URL}/api/admin/export-users-csv`, {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob',
                });

                const blob = new Blob([response.data], { type: response.headers['content-type'] });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', 'users.csv');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                console.log('[AdminExportUsers] Users CSV download initiated.');
            } else {
                Alert.alert("Export Not Supported", "User export is currently supported on the web version only.");
            }
        } catch (err: any) {
            console.error('[AdminExportUsers] Error exporting users CSV:', err);
            const errorMessage = err.response?.data?.message || err.message || "Failed to export users.";
            Alert.alert("Export Failed", errorMessage);
        } finally {
            setIsExporting(false);
        }
    };

    const performUserDeletion = async (userId: string) => {
        console.log('[AdminDashboard] performUserDeletion called for userId:', userId);
        try {
            const token = await getToken();
            console.log('[AdminDashboard] Token for delete:', token);
            if (!token) {
                console.error('[AdminDashboard] Admin not authenticated for user deletion');
                Alert.alert("Error", "Admin authentication failed.");
                return; 
            }

            console.log(`[AdminDashboard] Attempting to delete user ID: ${userId} via API.`);
            const response = await axios.delete(`${BASE_URL}/api/admin/users/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('[AdminDashboard] API delete call successful, response:', response.data);

            Alert.alert("Success", "User deleted successfully.");
            console.log('[AdminDashboard] Refreshing user list after deletion...');
            fetchUsers(1, searchQuery, sortBy, sortOrder, true); 
        } catch (err: any) {
            console.error(`[AdminDashboard] Error in performUserDeletion for user ID ${userId}:`, err);
            if (err.response) {
                console.error('[AdminDashboard] Error response data:', err.response.data);
                console.error('[AdminDashboard] Error response status:', err.response.status);
            }
            const errorMessage = err.response?.data?.message || err.message || "Failed to delete user";
            Alert.alert("Error", errorMessage);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        console.log('[AdminDashboard] handleDeleteUser called with userId:', userId);
        if (!userId || typeof userId !== 'string') {
            console.error('[AdminDashboard] Invalid or missing userId for deletion:', userId);
            Alert.alert("Error", "Cannot delete user: Invalid User ID.");
            return;
        }

        const confirmationMessage = `Are you sure you want to delete this user (${userId})? This action will also remove them from Clerk and cannot be undone.`;

        if (Platform.OS === 'web') {
            console.log('[AdminDashboard] Using window.confirm for web.');
            if (window.confirm(confirmationMessage)) {
                console.log('[AdminDashboard] window.confirm returned true, calling performUserDeletion for:', userId);
                performUserDeletion(userId);
            } else {
                console.log('[AdminDashboard] User deletion cancelled via window.confirm.');
            }
        } else {
            console.log('[AdminDashboard] Using Alert.alert for native.');
            Alert.alert(
                "Confirm Deletion",
                confirmationMessage, 
                [
                    { text: "Cancel", style: "cancel", onPress: () => console.log('[AdminDashboard] User deletion cancelled via Alert.alert.') },
                    {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                            console.log('[AdminDashboard] Alert.alert Delete button pressed, calling performUserDeletion for:', userId);
                            performUserDeletion(userId);
                        }
                    },
                ]
            );
        }
    };

    const handleSortChange = (newSortCol: string) => {
        const newSortOrder = sortBy === newSortCol ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'desc';
        setSortBy(newSortCol);
        setSortOrder(newSortOrder);
    };

    const renderUserItem = ({ item }: { item: UserData }) => (
        <View style={styles.userCard}>
            <View style={styles.userCardContent}>
                {item.profilePhoto ? (
                    <Image source={{ uri: item.profilePhoto }} style={styles.userImage} />
                ) : (
                    <View style={styles.userImagePlaceholder}>
                        <UserCircle size={40} color={COLORS.secondary} />
                    </View>
                )}
                <View style={styles.userInfo}>
                    <Text style={styles.userNameText}>{item.name || 'N/A'}</Text>
                    <Text style={styles.userEmailText}>{item.email}</Text>
                    <Text style={styles.userMetaText}>Username: {item.username || 'N/A'}</Text>
                    <Text style={styles.userMetaText}>State: {item.state || 'N/A'}</Text>
                    <Text style={styles.userMetaText}>Joined: {new Date(item.createdAt).toLocaleDateString()}</Text>
                    <Text style={styles.userMetaText}>Inspections: {item.inspectionCount || 0}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteUser(item.id)} style={styles.deleteButton}>
                    <Trash2 size={24} color={COLORS.danger} />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderFooter = () => {
        if (!isLoadingMore) return null;
        return <ActivityIndicator style={{ marginVertical: 20 }} size="large" color={COLORS.primary} />;
    };

    if (isLoading && currentPage === 1 && !isRefreshing) return <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />;
    if (error && users.length === 0) return <Text style={styles.errorText}>{error}</Text>;

    return (
        <View style={{flex: 1}}>
            {/* Search Input and Export Button for Users */}
            <View style={styles.userControlsContainer}> 
                <View style={styles.searchWrapperUsers}> 
                <Search size={18} color="#888" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#999"
                />
                </View>
                <TouchableOpacity 
                    style={[styles.exportButton, isExporting && styles.buttonDisabled]} 
                    onPress={handleExportUsers}
                    disabled={isExporting}
                >
                    {isExporting ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                        <Download size={18} color={COLORS.white} />
                    )}
                    <Text style={styles.exportButtonText}>{isExporting ? 'Exporting...' : 'Export Users'}</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={users}
                renderItem={renderUserItem}
                keyExtractor={(item) => item.id.toString()}
                style={styles.list}
                contentContainerStyle={{ padding: 15, paddingTop: 0 }}
                ListHeaderComponent={<Text style={styles.totalCountText}>Total Users: {totalUsersCount}</Text>}
                ListEmptyComponent={<Text style={styles.emptyText}>{searchQuery ? 'No matching users found.' : 'No users found.'}</Text>}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderFooter}
            />
        </View>
    );
};

// Navegador de Pestañas Principal del Dashboard
const Tab = createMaterialTopTabNavigator();

const AdminDashboardScreen = () => {
    return (
        <SafeAreaView style={styles.safeAreaContainer}>
             <View style={styles.headerContainer}> 
             <Text style={styles.headerTitle}>Admin Dashboard</Text>
             </View>
             <Tab.Navigator
                 screenOptions={{
                    tabBarActiveTintColor: COLORS.primary,
                    tabBarInactiveTintColor: 'gray',
                    tabBarIndicatorStyle: { backgroundColor: COLORS.primary },
                    tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
                    tabBarStyle: { backgroundColor: 'white' },
                 }}
             >
                 <Tab.Screen name="All Inspections" component={InspectionList} />
                 <Tab.Screen name="All Users" component={UserList} />
             </Tab.Navigator>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeAreaContainer: {
        flex: 1,
        backgroundColor: '#f0f2f5',
    },
    container: {
        flex: 1,
        // Removed padding as it's handled by list/header
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 10 : 20, // Adjust top padding
        paddingBottom: 15,
        color: COLORS.primary,
        // backgroundColor: 'white', // Removed to allow headerContainer to manage background
        // borderBottomColor: '#eee',
        // borderBottomWidth: 1,
        flex: 1, // Allow title to take space
    },
    headerContainer: { // New style for the header row
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white',
        borderBottomColor: '#eee',
        borderBottomWidth: 1,
        // paddingHorizontal: 20, // Already in headerTitle, adjust as needed
        // paddingTop: Platform.OS === 'ios' ? 10 : 20, // Already in headerTitle
        // paddingBottom: 15, // Already in headerTitle
    },
    buttonDisabled: {
        backgroundColor: '#adb5bd',
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 20,
    },
    errorText: { color: 'red', textAlign: 'center', marginTop: 20, paddingHorizontal: 15 },
    list: { flex: 1 },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#6c757d', fontSize: 16 },
    totalCountText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#555',
        marginRight: 15, // Add some space to the right
        alignSelf: 'center', // Vertically align in the row
    },
    controlsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: 15,
        paddingBottom: 10,
        backgroundColor: 'white',
        borderBottomColor: '#eee',
        borderBottomWidth: 1,
    },
    searchWrapper: {
        flex: 0.6,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#ddd',
        marginRight: 10,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: 40,
        fontSize: 14,
    },
    sortButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: COLORS.primary,
        marginLeft: 5,
    },
    sortButtonText: {
        color: COLORS.primary,
        fontWeight: '500',
    },
    cardContainer: {
        backgroundColor: '#fff',
        borderRadius: 8,
        marginBottom: 15,
        marginHorizontal: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2.5,
        elevation: 2,
        flexDirection: 'column',
    },
    cardContent: { // Contains everything now
        flex: 1,
        paddingVertical: 12, // Keep vertical padding
        paddingHorizontal: 20, // Increased horizontal padding from 12 to 20
    },
    cardHeaderInfo: { 
        marginBottom: 10, 
        paddingBottom: 8,
    },
    userInfoRow: { // New style for horizontal layout of image and text
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4, // Space below user info row before date
    },
    userImageSmall: {
        width: 30, // Smaller image for inspection card header
        height: 30,
        borderRadius: 15,
        marginRight: 8,
    },
    userImagePlaceholderSmall: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#f0f2f5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    userInfoTextContainer: { // Container for Name/Email/State text
        flex: 1, // Allow text to take available space
    },
    cardUserText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.darkText,
        // Remove margin bottom as spacing is handled by userInfoTextContainer
    },
    cardDetailText: { // For email & state
        fontSize: 12,
        color: '#555',
        // Remove margin bottom
    },
    cardDateText: {
        fontSize: 10,
        color: '#777',
        marginTop: 0, // Reset margin top
        textAlign: 'right', // Align date to the right below user info
    },
    inspectionDetailsContainer: {
        flexDirection: 'row',
        marginTop: 0, // Remove margin top, handled by header spacing
    },
    inspectionImageContainer: {
        width: 80,
        height: 80,
        marginRight: 10,
    },
    cardImage: {
        width: 80, 
        height: 80,
        borderRadius: 4,
        backgroundColor: '#e0e0e0', // Placeholder color
    },
    cardImagePlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 4,
        backgroundColor: '#e0e0e0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    inspectionTextContainer: {
        flex: 1,
        justifyContent: 'space-between',
    },
    cardDescriptionLabel: { 
        fontSize: 11, // Make labels smaller
        fontWeight: '600', // Bolder labels
        color: '#666', // Darker gray label
        marginBottom: 2, // Less space below label
        marginTop: 5, // Add space above labels (except first)
    },
    cardDescriptionText: { 
        fontSize: 13,
        color: '#444',
        lineHeight: 18,
        marginBottom: 5, // Space below text block
    },
    placeholderText: {
        fontSize: 12,
        color: '#757575',
    },
    viewReportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: COLORS.primary + '15',
        borderRadius: 5,
        alignSelf: 'flex-start',
        marginTop: 'auto',
    },
    viewReportButtonText: {
        color: COLORS.primary,
        fontSize: 13,
        fontWeight: '500',
        marginLeft: 5,
    },
    userItemContainer: {
        backgroundColor: '#fff',
        marginBottom: 10,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e8e8e8',
        paddingHorizontal: 15, 
        paddingVertical: 10, 
    },
    userItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userListImageContainer: {
        marginRight: 15, 
    },
    userListImage: {
        width: 50,
        height: 50,
        borderRadius: 25, 
    },
    userListImagePlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#f0f2f5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    userInfoContainer: {
        flex: 1, 
        marginRight: 10,
    },
    userNameText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.darkText,
        marginBottom: 3,
    },
    userEmailText: {
        fontSize: 14,
        color: COLORS.textSeco,
        marginBottom: 4,
    },
    userMetaText: {
        fontSize: 13,
        color: COLORS.textMuted,
        marginBottom: 1,
    },
    userDetailText: { // Style for State and Inspection Count
        fontSize: 13,
        color: '#777',
        marginTop: 2, // Add small space between detail lines
    },
    userControlsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        marginTop: 15,
        marginBottom: 15,
    },
    searchWrapperUsers: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#ddd',
        marginRight: 10,
        height: 40,
    },
    exportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#28a745',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5,
        height: 40,
    },
    exportButtonText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 8,
    },
    userCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        marginVertical: 8,
        marginHorizontal: Platform.OS === 'web' ? 10 : 2, // Slight horizontal margin for web
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#e8e8e8',
    },
    userCardContent: {
        flexDirection: 'row',
        alignItems: 'flex-start', // Align items to the top to accommodate varying text lengths
    },
    userImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    userImagePlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
        backgroundColor: '#f0f2f5',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e8e8e8',
    },
    userInfo: {
        flex: 1, // Take remaining space
    },
    deleteButton: {
        padding: 8, // Make it easier to tap
        marginLeft: 10, // Space from user info
        justifyContent: 'center', // Center icon vertically if needed
        alignItems: 'center',
    },
    inspectionActionsRow: { // New style for View Report and Download buttons
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 'auto', // Pushes to the bottom of inspectionTextContainer
    },
    downloadIconButton: { // Style for the new download icon button
        padding: 6, // Make it easy to tap
        marginLeft: 10, // Space from the view report button
        // backgroundColor: COLORS.secondary + '80', // Optional: light background
        // borderRadius: 20, // Optional: make it circular
    },
    // Styles for Full Image Modal
    fullImageModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullScreenImage: {
        width: Dimensions.get('window').width * 0.9, // 90% of screen width
        height: Dimensions.get('window').height * 0.8, // 80% of screen height
    },
    fullImageCloseButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 20, // Adjust for status bar
        right: 20,
        zIndex: 10, // Ensure it's above the image
        padding: 10, // Make it easier to tap
    },
    // Add a style for the modal content
    modalContent: {
        width: '80%', // Or a fixed width like 500
        maxWidth: 600,
        maxHeight: '80%',
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 20,
        alignItems: 'stretch', // Changed from center
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    // Add a style for the modal backdrop
    modalBackdrop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    listContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 20,
    },
    emptyListText: {
        textAlign: 'center',
        marginTop: 50,
        color: COLORS.textMuted,
        fontSize: 16,
    },
    cardUserText: {
        fontWeight: 'bold',
        fontSize: 14,
        color: COLORS.text,
        flexShrink: 1,
    },
    cardDetailText: {
        fontSize: 12,
        color: COLORS.textMuted,
        flexShrink: 1,
    },
    cardDateText: {
        fontSize: 12,
        color: COLORS.textMuted,
        textAlign: 'right',
        minWidth: 120, // Ensure date doesn't wrap awkwardly
    },
    inspectionDetailsContainer: {
        flexDirection: 'row',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    inspectionImageContainer: {
        marginRight: 15,
    },
    inspectionTextContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    cardImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
    },
    cardImagePlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        color: '#999',
        fontSize: 12,
    },
    cardDescriptionLabel: {
        fontSize: 12,
        color: COLORS.textMuted,
        marginBottom: 2,
    },
    cardDescriptionText: {
        fontSize: 14,
        color: COLORS.text,
        marginBottom: 8,
    },
    inspectionActionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        marginTop: 'auto', // Push to bottom
    },
    viewReportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#E9E9E9',
        borderRadius: 20,
    },
    viewReportButtonText: {
        marginLeft: 6,
        color: COLORS.primary,
        fontWeight: '600',
        fontSize: 13,
    },
    // User List Styles
    userCardContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 15,
        marginHorizontal: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
        flexDirection: 'row',
        alignItems: 'center',
    },
    userContentContainer: {
        flex: 1,
        marginLeft: 15,
    },
     userImageLarge: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    userImagePlaceholderLarge: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    userName: {
        fontWeight: 'bold',
        fontSize: 16,
        color: COLORS.text,
    },
    userDetails: {
        fontSize: 14,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    userActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        padding: 8,
        marginLeft: 8,
    },

    // Full Screen Image Modal
    fullImageModalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullImage: {
        width: '90%',
        height: '90%',
    },
    fullImageCloseButton: {
        position: 'absolute',
        top: Platform.OS === 'web' ? 20 : 50,
        right: 20,
        zIndex: 10,
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 50,
    },


});

export default AdminDashboardScreen;