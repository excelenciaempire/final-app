import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Alert, Image, SafeAreaView, TouchableOpacity, Platform, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-expo';
import { BASE_URL } from '../config/api';
import { COLORS } from '../styles/colors';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Search, Eye, UserCircle } from 'lucide-react-native';
import DdidModal from '../components/DdidModal';
import { useDebounce } from '../hooks/useDebounce';

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

    const renderInspectionItem = ({ item }: { item: AdminInspectionData }) => (
        <View style={styles.cardContainer}>
            <View style={styles.cardContent}>
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
                        {item.image_url ? (
                            <Image source={{ uri: item.image_url }} style={styles.cardImage} resizeMode="cover"/>
                        ) : (
                            <View style={styles.cardImagePlaceholder}><Text style={styles.placeholderText}>No image</Text></View>
                        )}
                    </View>
                    <View style={styles.inspectionTextContainer}>
                        <Text style={styles.cardDescriptionLabel}>Description:</Text>
                        <Text style={styles.cardDescriptionText} numberOfLines={1}>{item.description}</Text>
                        <TouchableOpacity
                            style={styles.viewReportButton}
                            onPress={() => {
                                setSelectedInspection(item);
                                setIsModalVisible(true);
                            }}
                        >
                            <Eye size={16} color={COLORS.primary} />
                            <Text style={styles.viewReportButtonText}>View Report</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );

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
                        Total Inspections: {totalInspectionsCount}
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
                    <Text style={styles.sortButtonText}>Date {sortBy === 'created_at' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleSortChange('userName')} style={styles.sortButton}>
                    <Text style={styles.sortButtonText}>User {sortBy === 'userName' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={inspections}
                renderItem={renderInspectionItem}
                keyExtractor={(item) => `insp-${item.id}`}
                style={styles.list}
                contentContainerStyle={{ paddingHorizontal: 5, paddingBottom: 20 }}
                ListEmptyComponent={<Text style={styles.emptyText}>No inspections found.</Text>}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderFooter}
            />
             <DdidModal
                 visible={isModalVisible}
                 onClose={() => setIsModalVisible(false)}
                 ddidText={selectedInspection?.ddid || ''}
                 imageUrl={selectedInspection?.image_url || undefined}
                 description={selectedInspection?.description}
                 userName={selectedInspection?.userName}
                 userEmail={selectedInspection?.userEmail}
            />
        </View>
    );
};

// Component for the User List
const UserList: React.FC = () => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [userSearchQuery, setUserSearchQuery] = useState<string>('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [totalUsers, setTotalUsers] = useState(0);
    const { getToken } = useAuth();
    const debouncedUserSearch = useDebounce(userSearchQuery, 500);

    const fetchUsers = useCallback(async (page = 1, search = debouncedUserSearch, refreshing = false) => {
        console.log(`[AdminUsers] Fetching page ${page}, search: '${search}'`);
        if (!refreshing && page === 1) setIsLoading(true);
        if (page > 1) setIsLoadingMore(true);
        setError(null);

        try {
            const token = await getToken();
            if (!token) throw new Error("User not authenticated");

            const params = { page, limit: 20, search }; // Increased limit slightly for users

            const response = await axios.get<PaginatedResponse<UserData>>(`${BASE_URL}/api/admin/all-users`, {
                headers: { Authorization: `Bearer ${token}` },
                params
            });

            const { users: fetchedUsers = [], totalPages: fetchedTotalPages, page: fetchedPage, totalCount } = response.data;

            setUsers(prev => (page === 1 ? fetchedUsers : [...prev, ...fetchedUsers]));
            setTotalPages(fetchedTotalPages);
            setCurrentPage(fetchedPage);
            setTotalUsers(totalCount);

        } catch (err: any) {
            console.error("[AdminUsers] Error fetching data:", err);
            let errorMessage = "Failed to fetch user data.";
            if (err.response) { errorMessage = err.response.data?.message || errorMessage; }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
            if (refreshing) setIsRefreshing(false);
        }
    }, [getToken, debouncedUserSearch]);

    useEffect(() => {
        fetchUsers(1);
    }, []);

    useEffect(() => {
        if (debouncedUserSearch !== undefined) {
            setCurrentPage(1);
            fetchUsers(1);
        }
    }, [debouncedUserSearch]);

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        setCurrentPage(1);
        fetchUsers(1, userSearchQuery, true);
    }, [fetchUsers, userSearchQuery]);

    const handleLoadMore = () => {
        if (!isLoadingMore && currentPage < totalPages) {
            console.log('[AdminUsers] Loading more...', currentPage + 1);
            fetchUsers(currentPage + 1);
        } else {
            console.log('[AdminUsers] No more pages or already loading.');
        }
    };

    const renderUserItem = ({ item }: { item: UserData }) => (
        <TouchableOpacity style={styles.userItemContainer} onPress={() => Alert.alert('User Profile', `User ID: ${item.id}`)}>
            <View style={styles.userItemContent}>
                 <View style={styles.userListImageContainer}>
                    {item.profilePhoto ? (
                        <Image source={{ uri: item.profilePhoto }} style={styles.userListImage} />
                    ) : (
                         <View style={styles.userListImagePlaceholder}>
                            <UserCircle size={32} color={COLORS.secondary} />
                         </View>
                    )}
                </View>
                <View style={styles.userInfoContainer}>
                    <Text style={styles.userNameText}>{item.name || 'Unknown Name'}</Text>
                    <Text style={styles.userEmailText}>{item.email}</Text>
                    <Text style={styles.userDetailText}>Username: {item.username || 'N/A'}</Text>
                    <Text style={styles.userDetailText}>State: {item.state || 'N/A'}</Text>
                </View>
             </View>
         </TouchableOpacity>
    );

    const renderFooter = () => {
        if (!isLoadingMore) return null;
        return <ActivityIndicator style={{ marginVertical: 20 }} size="large" color={COLORS.primary} />;
    };

    if (isLoading && currentPage === 1 && !isRefreshing) return <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />;
    if (error && users.length === 0) return <Text style={styles.errorText}>{error}</Text>;

    return (
        <View style={{flex: 1}}>
            {/* Search Input for Users */}
            <View style={styles.userSearchContainer}> 
                <Search size={18} color="#888" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or email..."
                    value={userSearchQuery}
                    onChangeText={setUserSearchQuery}
                    placeholderTextColor="#999"
                />
            </View>

            <FlatList
                data={users}
                renderItem={renderUserItem}
                keyExtractor={(item: UserData) => `user-${item.id}`}
                style={styles.list}
                contentContainerStyle={{ padding: 15, paddingTop: 0 }}
                ListHeaderComponent={<Text style={styles.totalCountText}>Total Users: {totalUsers}</Text>}
                ListEmptyComponent={<Text style={styles.emptyText}>{userSearchQuery ? 'No matching users found.' : 'No users found.'}</Text>}
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
             <Text style={styles.headerTitle}>Admin Dashboard</Text>
             {/* TODO: Add totals here? */}
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
        backgroundColor: 'white', // Give header a background
        borderBottomColor: '#eee',
        borderBottomWidth: 1,
    },
    loader: { marginTop: 50 },
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
        flexDirection: 'column', // Keep as column
    },
    cardContent: { // Contains everything now
        flex: 1,
        padding: 12, // Use slightly more padding
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
        width: '100%',
        height: '100%',
        borderRadius: 4,
    },
    cardImagePlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#f0f2f5',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 4,
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
        color: '#aaa',
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
        color: '#555',
        marginBottom: 3, 
    },
    userDetailText: { // Style for State and Inspection Count
        fontSize: 13,
        color: '#777',
        marginTop: 2, // Add small space between detail lines
    },
    userSearchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 8,
        marginHorizontal: 15,
        marginTop: 15, // Add space above search
        marginBottom: 15, // Add space below search
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#ddd',
    },
});

export default AdminDashboardScreen; 