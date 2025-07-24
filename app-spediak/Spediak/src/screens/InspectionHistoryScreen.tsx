import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, ActivityIndicator, TouchableOpacity, Image, Alert, Platform, RefreshControl, Modal, ScrollView, Dimensions } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native'; // Import useNavigation
import axios from 'axios';
import { Search, Trash2, Eye, Copy, Download, X } from 'lucide-react-native'; // Added X icon
import DdidModal from '../components/DdidModal'; // Step 41: Import Modal
import { BASE_URL } from '../config/api'; // Import centralized BASE_URL
import { COLORS } from '../styles/colors'; // Corrected path to styles
import Markdown from 'react-native-markdown-display'; // Import Markdown display
import * as Clipboard from 'expo-clipboard'; // Import Clipboard
import * as FileSystem from 'expo-file-system'; // For native download
import * as MediaLibrary from 'expo-media-library'; // For saving to gallery on native

// --- Define Base URL (Platform Specific) ---
// const YOUR_COMPUTER_IP_ADDRESS = '<YOUR-COMPUTER-IP-ADDRESS>'; // Removed
// const YOUR_BACKEND_PORT = '<PORT>'; // Removed
// const API_BASE_URL = Platform.select({...}); // Removed Old Logic

// const BASE_URL = Platform.select({...}); // <<< REMOVE THIS BLOCK >>>
// --- End Base URL Definition ---

// Placeholder for Inspection type - define based on your actual API response
interface Inspection {
    id: string; // Or number, depending on your backend
    image_url: string; // Or uri
    description: string;
    created_at: string; // Corrected property name
    ddid: string; // Full DDID text
    // Add other relevant fields like userState, etc.
}

// Helper function to get optimized Cloudinary image URL
const getOptimizedImageUrl = (url: string | null | undefined, width: number, height: number): string | undefined => {
    if (!url || !url.includes('cloudinary.com')) return url || undefined;
    // Example: w_300,h_200,c_fill,q_auto:good
    // Using c_pad to maintain aspect ratio and pad if necessary, q_auto for quality.
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

// Memoized Inspection Item Component
const InspectionItem = React.memo(({ item, onSelectItem, onDeleteItem }: {
    item: Inspection;
    onSelectItem: (inspection: Inspection) => void;
    onDeleteItem: (id: string) => void;
}) => {
    const displayDate = item.created_at ? new Date(item.created_at).toLocaleString() : 'Date not available';
    const optimizedImageUrl = getOptimizedImageUrl(item.image_url, 80, 80); // Optimize for list item size

    return (
        <View style={styles.itemContainer}>
            {optimizedImageUrl ? (
                <Image source={{ uri: optimizedImageUrl }} style={styles.itemImage} />
            ) : (
                <View style={styles.itemImagePlaceholder}>
                    <Text style={styles.itemImagePlaceholderText}>No Image</Text>
                </View>
            )}
            <View style={styles.itemContent}>
                <Text style={styles.itemDescription} numberOfLines={2} ellipsizeMode="tail">
                    <Text style={styles.boldText}>Description:</Text> {item.description || 'N/A'}
                </Text>
                <Text style={styles.itemDate}><Text style={styles.boldText}>Date:</Text> {displayDate}</Text>

                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.viewButton]}
                        onPress={() => onSelectItem(item)}
                    >
                        <Eye size={16} color={COLORS.primary} />
                        <Text style={[styles.actionButtonText, styles.viewButtonText]}>View</Text>
                    </TouchableOpacity>
                </View>
            </View>
            <TouchableOpacity
                style={styles.deleteIconContainer}
                onPress={() => onDeleteItem(item.id)}
            >
                <Trash2 size={20} color={COLORS.danger} />
            </TouchableOpacity>
        </View>
    );
});

export default function InspectionHistoryScreen() {
    // Step 37: State Variables
    const [inspections, setInspections] = useState<Inspection[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false); // State for RefreshControl
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedInspectionDdid, setSelectedInspectionDdid] = useState<string | null>(null);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
    const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
    const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const ITEMS_PER_PAGE = 10; // Or your preferred limit

    const { getToken } = useAuth();
    const navigation = useNavigation(); // Get navigation object
    const [mediaLibraryPermission, requestMediaLibraryPermission] = MediaLibrary.usePermissions(); // For saving to gallery

    // Request Media Library permission on mount if not granted
    useEffect(() => {
        if (Platform.OS !== 'web' && (!mediaLibraryPermission || mediaLibraryPermission.status !== MediaLibrary.PermissionStatus.GRANTED)) {
            requestMediaLibraryPermission();
        }
    }, [mediaLibraryPermission]);

    // Step 38: Data Fetching
    const fetchInspections = useCallback(async (pageToFetch = 1, isRefreshingData = false) => {
        console.log(`[fetchInspections] Fetching inspections for page: ${pageToFetch}, isRefreshing: ${isRefreshingData}`);
        if (pageToFetch === 1) {
            setIsLoading(true); // Full screen loader for first page or refresh
        } else {
            setIsLoadingMore(true); // Footer loader for subsequent pages
        }
        if (isRefreshingData) {
            setInspections([]); // Clear existing inspections if refreshing
        }
        setError(null);

        try {
            const token = await getToken();
            if (!token) throw new Error("User not authenticated");

            console.log(`[fetchInspections] Calling GET ${BASE_URL}/api/inspections?page=${pageToFetch}&limit=${ITEMS_PER_PAGE}`);
            const response = await axios.get<{ items: Inspection[], totalPages: number, currentPage: number }>(`${BASE_URL}/api/inspections?page=${pageToFetch}&limit=${ITEMS_PER_PAGE}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("[fetchInspections] API call successful, status:", response.status);
            console.log("[fetchInspections] Received data:", JSON.stringify(response.data, null, 2));
            
            // Defensive coding: Check the structure of the response data
            const responseData = response.data;
            const items = responseData && Array.isArray(responseData.items) ? responseData.items : [];
            const newTotalPages = (responseData && typeof responseData.totalPages === 'number') ? responseData.totalPages : 1;
            const newCurrentPage = (responseData && typeof responseData.currentPage === 'number') ? responseData.currentPage : 1;

            console.log("[fetchInspections] Setting inspections state with count:", items.length);
            
            if (pageToFetch === 1 || isRefreshingData) {
                setInspections(items);
            } else {
                setInspections(prevInspections => [...prevInspections, ...items]);
            }
            setTotalPages(newTotalPages);
            setCurrentPage(newCurrentPage);

        } catch (err: any) {
            console.error("[fetchInspections] Error caught:", err);
            if (err.response) {
                console.error("[fetchInspections] Error response data:", err.response.data);
                console.error("[fetchInspections] Error response status:", err.response.status);
            }
            const errorMessage = err.response?.data?.message || err.message || "Failed to fetch inspections";
            console.log("[fetchInspections] Setting error state:", errorMessage);
            setError(errorMessage);
        } finally {
            console.log("[fetchInspections] Setting loading states to false in finally block");
            setIsLoading(false);
            setIsLoadingMore(false);
            if (isRefreshingData) setIsRefreshing(false); // Also turn off pull-to-refresh indicator
        }
    }, [getToken, ITEMS_PER_PAGE]);

    // --- Fetch data on initial mount AND on screen focus using event listener ---
    useEffect(() => {
        console.log("[useEffect Mount] Fetching initial inspections...");
        fetchInspections(1, true); // Fetch page 1 and indicate it's a refresh/initial load

        const unsubscribe = navigation.addListener('focus', () => {
            console.log("[navigation Listener] Screen focused, fetching inspections...");
            // Reset and fetch if you always want fresh data on focus, 
            // or implement more sophisticated cache-invalidation logic.
            // For now, let's re-fetch page 1 as a refresh.
            setCurrentPage(1); // Reset page on focus if desired
            fetchInspections(1, true);
        });

        return unsubscribe;
    }, [navigation, fetchInspections]); // Removed fetchInspections from dependency array to avoid re-triggering on its own change

    // --- Pull to Refresh Logic ---
    const onRefresh = useCallback(async () => {
        console.log("[onRefresh] Starting refresh...");
        setIsRefreshing(true);
        setCurrentPage(1); // Reset to page 1 on pull-to-refresh
        await fetchInspections(1, true); // Pass page 1 and isRefreshing=true
        //setIsRefreshing(false); // fetchInspections will handle this in its finally block
        console.log("[onRefresh] Refresh finished call initiated.");
    }, [fetchInspections]);

    // --- Handle Load More --- 
    const handleLoadMore = () => {
        if (!isLoadingMore && currentPage < totalPages) {
            console.log(`[handleLoadMore] Loading more inspections, current page: ${currentPage}, total pages: ${totalPages}`);
            fetchInspections(currentPage + 1);
        } else if (isLoadingMore) {
            console.log("[handleLoadMore] Already loading more or no more pages.");
        }
    };

    // Step 42: Delete Logic
    const handleDeleteInspection = async (id: string) => {
        const deleteConfirmedAction = async () => {
            try {
                const token = await getToken();
                if (!token) throw new Error("User not authenticated");

                console.log(`Attempting to delete inspection ID: ${id}`);

                // Use BASE_URL
                await axios.delete(`${BASE_URL}/api/inspections/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                Alert.alert("Success", "Inspection deleted."); // Give feedback

                // Refresh list from server after successful deletion
                await fetchInspections();

            } catch (err: any) {
                console.error(`Error deleting inspection ID ${id}:`, err);
                const errorMessage = err.response?.data?.message || err.message || "Failed to delete inspection";
                Alert.alert("Error", errorMessage);
            }
        };

        if (Platform.OS === 'web') {
            // Web: Use window.confirm
            if (window.confirm("Are you sure you want to delete this inspection?")) {
                await deleteConfirmedAction();
            }
        } else {
            // Native: Use Alert.alert
            Alert.alert(
                "Confirm Deletion",
                "Are you sure you want to delete this inspection?",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Delete",
                        style: "destructive",
                        onPress: deleteConfirmedAction, // Call the shared action
                    },
                ]
            );
        }
    };

    // New Function: Handle Image Download
    const handleDownloadImage = async (imageUrl: string, inspectionId: string) => {
        if (!imageUrl) {
            Alert.alert("Error", "No image URL available for download.");
            return;
        }
        console.log(`[handleDownloadImage] Attempting to download image: ${imageUrl}`);

        if (Platform.OS === 'web') {
            try {
                // Fetch the image as a blob
                const response = await fetch(imageUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch image. Status: ${response.status} ${response.statusText}`);
                }
                const blob = await response.blob();
                
                // Create an object URL for the blob
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `spediak_inspection_${inspectionId}_${Date.now()}.jpg`; 
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url); // Clean up the object URL
                Alert.alert("Success", "Image download started.");
            } catch (error: any) {
                console.error("[handleDownloadImage Web] Error:", error);
                Alert.alert("Error", error.message || "Failed to download image on web.");
            }
        } else {
            // Native: Download using FileSystem and save to MediaLibrary
            if (!mediaLibraryPermission || mediaLibraryPermission.status !== MediaLibrary.PermissionStatus.GRANTED) {
                const { status } = await requestMediaLibraryPermission();
                if (status !== MediaLibrary.PermissionStatus.GRANTED) {
                    Alert.alert("Permission Denied", "Storage permission is required to save the image.");
                    return;
                }
            }

            try {
                const fileName = `spediak_inspection_${inspectionId}_${Date.now()}.jpg`;
                const fileUri = FileSystem.documentDirectory + fileName;

                console.log(`[handleDownloadImage Native] Downloading to URI: ${fileUri}`);
                const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);
                console.log('[handleDownloadImage Native] Download result:', downloadResult);

                if (downloadResult.status !== 200) {
                    throw new Error(`Failed to download image. Status: ${downloadResult.status}`);
                }

                const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
                await MediaLibrary.createAlbumAsync('Spediak Inspections', asset, false);
                Alert.alert("Success", "Image saved to your gallery in 'Spediak Inspections' album!");
            } catch (error: any) {
                console.error("[handleDownloadImage Native] Error:", error);
                Alert.alert("Error", error.message || "Failed to download and save image.");
            }
        }
    };

    // Step 40: Filter Logic
    const filteredInspections = useMemo(() => {
        return inspections.filter(inspection =>
            (inspection.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (inspection.ddid?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (inspection.created_at?.toLowerCase() || '').includes(searchQuery.toLowerCase())
        );
    }, [inspections, searchQuery]);

    // Render Footer for FlatList (Loading Indicator for pagination)
    const renderFooter = () => {
        if (!isLoadingMore) return null;
        return (
            <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator animating size="large" color={COLORS.primary} />
            </View>
        );
    };

    // Step 39: Render Item Function - Now uses the memoized component
    const renderItem = ({ item }: { item: Inspection }) => {
        return (
            <InspectionItem 
                item={item} 
                onSelectItem={(selectedItem) => {
                    setSelectedInspection(selectedItem);
                    setShowDetailModal(true); // Assuming this state controls your modal
                }}
                onDeleteItem={handleDeleteInspection}
            />
        );
    };

    // --- NEW: Handle Copy within History Modal ---
    const handleCopyToClipboard = async (textToCopy: string) => {
        if (!textToCopy) return;
        // Remove potential markdown formatting before copying
        const plainText = textToCopy.replace(/\*\*/g, '');
        try {
            await Clipboard.setStringAsync(plainText);
            Alert.alert("Copied", "Statement copied to clipboard.");
        } catch (e) {
            console.error("Failed to copy text from history: ", e);
            Alert.alert("Error", "Could not copy text to clipboard.");
        }
    };

    return (
        <View style={styles.container}>
            {/* CHANGE 1: Update Header Title */}
            <Text style={styles.headerTitle}>Statement History</Text>

            {/* Step 36: Search Input */}
            <View style={styles.searchContainer}>
                 <Search size={20} color="#6c757d" style={styles.searchIcon} />
                 <TextInput
                    style={styles.searchInput}
                    placeholder="Search statements..."
                    value={searchQuery}
                    onChangeText={setSearchQuery} // Step 40
                    placeholderTextColor="#6c757d"
                />
            </View>

            {/* Step 36 & 39 & 40: FlatList using filtered data */}
            {isLoading && <ActivityIndicator size="large" color="#007bff" style={styles.loader} />}
            {error && <Text style={styles.errorText}>{error}</Text>}
            {!isLoading && !error && (
                 // Explicit check for empty data after loading
                 filteredInspections.length === 0 ? (
                    <Text style={styles.emptyText}>{searchQuery ? 'No matching inspections found.' : 'No inspection history found.'}</Text>
                 ) : (
                    <FlatList
                        data={filteredInspections} // Use filtered data (Step 40)
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        style={styles.list}
                        // --- Add RefreshControl ---
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={onRefresh}
                                colors={["#007bff"]} // Optional: spinner color
                                tintColor={"#007bff"} // Optional: spinner color for iOS
                            />
                        }
                        // --- End RefreshControl ---
                        // ListEmptyComponent can still be used as a fallback, but the check above is more direct
                        // ListEmptyComponent={<Text style={styles.emptyText}>{searchQuery ? 'No matching inspections found.' : 'No inspections found.'}</Text>}
                        ListFooterComponent={renderFooter} // Added for pagination
                        onEndReached={handleLoadMore} // Added for pagination
                        onEndReachedThreshold={0.5} // Trigger onEndReached when half a screen away from the end
                    />
                 )
            )}

            {/* Modal to display full DDID with Copy Button */}
            {selectedInspection && (
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={!!selectedInspection}
                    onRequestClose={() => setSelectedInspection(null)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <TouchableOpacity onPress={() => setSelectedInspection(null)} style={styles.modalCloseIconContainer}>
                                <X size={24} color={COLORS.darkText} />
                            </TouchableOpacity>
                            {/* Optional: Display image */}
                            {selectedInspection.image_url && (
                                <Image source={{ uri: selectedInspection.image_url }} style={styles.historyModalImage} resizeMode="contain" />
                            )}
                            <Text style={styles.modalTitle}>Inspection Statement</Text>
                            <ScrollView style={styles.modalScrollView}>
                                <Markdown style={markdownStyles}>{selectedInspection.ddid || 'No statement available.'}</Markdown>
                            </ScrollView>
                            {/* Action Buttons Row */}
                            <View style={styles.modalActionsRow}>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.copyHistoryButton]}
                                    onPress={() => handleCopyToClipboard(selectedInspection.ddid)}
                                >
                                    <Copy size={18} color={COLORS.white} style={styles.modalButtonIcon} />
                                    <Text style={styles.modalButtonText}>Copy Statement</Text>
                                </TouchableOpacity>
                                
                                {selectedInspection.image_url && ( // Ensure download button only shows if there's an image
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.downloadImageButton]} // New style for download button
                                    onPress={() => handleDownloadImage(selectedInspection.image_url!, selectedInspection.id)}
                                >
                                    <Download size={18} color={COLORS.white} style={styles.modalButtonIcon} />
                                    <Text style={styles.modalButtonText}>Download Image</Text> 
                                </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
}

// Step 36, 39, 42: Styles (Updated)
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 10 : 20,
        paddingBottom: 10,
        // Match sidebar header style maybe?
        // color: COLORS.primary, 
        // backgroundColor: 'white',
        // borderBottomColor: '#eee',
        // borderBottomWidth: 1,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 8,
        marginHorizontal: 20,
        marginBottom: 15,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#ced4da',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: 45, // Increased height
        fontSize: 16,
        color: '#333',
    },
    list: {
        flex: 1,
        // Remove paddingHorizontal from here if adding to container
    },
    itemContainer: {
        backgroundColor: COLORS.white,
        padding: 15,
        borderRadius: 8,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, // Softer shadow
        shadowRadius: 2,
        elevation: 2,
        flexDirection: 'row', // Align image and content side-by-side
    },
    itemImage: {
        width: 80, // Fixed width for image
        height: 80, // Fixed height for image
        borderRadius: 6,
        marginRight: 15,
    },
    itemImagePlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 6,
        marginRight: 15,
        backgroundColor: COLORS.secondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemImagePlaceholderText: {
        fontSize: 12,
        color: COLORS.textMuted,
    },
    itemContent: {
        flex: 1, // Allow content to take remaining space
        justifyContent: 'center', // Vertically center content if needed
        marginRight: 5, // Add some space before the delete icon if it were inline
    },
    itemDescription: {
        fontSize: 14,
        marginBottom: 5, // Space between description and date
        color: COLORS.darkText, // Use darkText for better readability
    },
    boldText: {
        fontWeight: 'bold',
        color: COLORS.primary, // Make bold text primary color for emphasis
    },
    itemDate: {
        fontSize: 12,
        color: COLORS.textSeco, // Use textSeco for date
        marginBottom: 10, // Add space before action buttons
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-start', // Align buttons to the start
        alignItems: 'center', // Align items vertically
        marginTop: 10, // Add some space above the buttons
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5,
        marginRight: 10, // Space between buttons
        // minWidth: 90, // Ensure buttons have a decent width
        justifyContent: 'center',
    },
    actionButtonText: {
        marginLeft: 6,
        fontSize: 13,
        fontWeight: '500',
    },
    viewButton: {
        backgroundColor: COLORS.secondary, // Light gray for view
    },
    viewButtonText: {
        color: COLORS.primary, // Primary color text for view
    },
    deleteButton: {
        backgroundColor: COLORS.danger, // Danger color for delete
    },
    deleteButtonText: {
        color: COLORS.white,
    },
    deleteIconContainer: { // New style for the delete icon's touchable area
        padding: 10, // Make it easier to tap
        justifyContent: 'center',
        alignItems: 'center',
        // Removed marginLeft as it's positioned by flex in itemContainer or absolutely
    },
    loader: {
        marginTop: 50,
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
        marginTop: 20,
        marginHorizontal: 20,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        color: '#6c757d',
        fontSize: 16,
    },
    // --- Modal Styles ---
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)', // Darker overlay
    },
    modalContent: {
        width: '90%',
        maxWidth: 500, // Max width for larger screens
        backgroundColor: COLORS.white, // Use white background
        borderRadius: 10, // Rounded corners
        padding: 20, // Consistent padding
        alignItems: 'stretch', // Stretch children to fill width
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    modalCloseIconContainer: { // Style for the X icon container
        position: 'absolute',
        top: 10,
        right: 10,
        padding: 5, // Add some padding for easier tapping
        zIndex: 10, // Ensure it's above other content
    },
    historyModalImage: {
        width: '100%', // Make image responsive
        height: 150, // Adjust height as needed
        borderRadius: 8,
        marginBottom: 15,
        backgroundColor: '#eee',
        alignSelf: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        color: COLORS.primary,
        textAlign: 'center',
    },
    modalScrollView: {
        marginBottom: 20, // Space before action buttons
        // Adjust max height based on content
    },
    modalActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between', // Distribute space for main buttons
        alignItems: 'center', // Vertically align all items in the row
        marginTop: 10, // Add margin above buttons
    },
    modalButton: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1, // Allow buttons to grow
        marginHorizontal: 5, // Space between buttons
    },
    modalButtonIcon: {
        marginRight: 8,
    },
    modalButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    copyHistoryButton: {
        backgroundColor: COLORS.primary, // Or another distinct color
        marginRight: 'auto', // Push other items to the right if only copy and close
        flexShrink: 1, // Allow button to shrink if needed
    },
    modalDownloadButton: { // Style for the old download icon button (now unused but kept for reference if needed)
        padding: 10,
        marginLeft: 'auto', 
    },
    downloadImageButton: { // New style for the prominent Download Image button
        backgroundColor: COLORS.success, // Or another distinct color like a blue
        marginLeft: 10,
        flexShrink: 1, // Allow button to shrink if needed
    },
    closeButton: { // This style is now effectively replaced by downloadImageButton or the X icon
        backgroundColor: '#6c757d', 
        marginLeft: 10, 
    },
});

// Add markdown styles if needed
const markdownStyles = {
    body: {
        fontSize: 16,
        color: '#333',
    },
    // Add other markdown element styles if necessary
}; 