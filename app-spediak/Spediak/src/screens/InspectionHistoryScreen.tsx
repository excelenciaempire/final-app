import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, ActivityIndicator, TouchableOpacity, Image, Alert, Platform, RefreshControl, Modal, ScrollView, Dimensions } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native'; // Import useNavigation
import axios from 'axios';
import { Search, Trash2, Eye, Copy, Download } from 'lucide-react-native'; // Added Trash2, Eye, Copy, and Download
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
    const fetchInspections = useCallback(async () => {
        console.log("[fetchInspections] Fetching inspections..."); // Log start
        setIsLoading(true);
        setError(null);
        try {
            const token = await getToken();
            if (!token) throw new Error("User not authenticated");

            console.log(`[fetchInspections] Calling GET ${BASE_URL}/api/inspections`);
            const response = await axios.get(`${BASE_URL}/api/inspections`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("[fetchInspections] API call successful, status:", response.status);
            // Log the actual data received more clearly
            console.log("[fetchInspections] Received data:", JSON.stringify(response.data, null, 2));
            const inspectionsData = Array.isArray(response.data) ? response.data : [];
            console.log("[fetchInspections] Setting inspections state with count:", inspectionsData.length);
            setInspections(inspectionsData);

            // --- Placeholder Data (Remove/Comment out) ---
            // await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
            // const placeholderInspections: Inspection[] = [
            //     { id: '1', imageUrl: '...', description: '...', created_at: '...', ddid: '...' },
            // ];
            // setInspections(placeholderInspections);
            // --- End Placeholder ---

        } catch (err: any) {
            console.error("[fetchInspections] Error caught:", err);
            if (err.response) {
                console.error("[fetchInspections] Error response data:", err.response.data);
                console.error("[fetchInspections] Error response status:", err.response.status);
            }
            const errorMessage = err.response?.data?.message || err.message || "Failed to fetch inspections";
            console.log("[fetchInspections] Setting error state:", errorMessage); // Log error set
            setError(errorMessage);
        } finally {
            console.log("[fetchInspections] Setting isLoading = false in finally block"); // Log finally
            setIsLoading(false);
        }
    }, [getToken]);

    // --- Fetch data on initial mount AND on screen focus using event listener ---
    useEffect(() => {
        // Fetch data initially when the component mounts
        console.log("[useEffect Mount] Fetching initial inspections...");
        fetchInspections();

        // Subscribe to focus events
        const unsubscribe = navigation.addListener('focus', () => {
            console.log("[navigation Listener] Screen focused, fetching inspections...");
            fetchInspections();
        });

        // Return the function to unsubscribe from the event so it gets removed on unmount
        return unsubscribe;
    }, [navigation]); // ONLY depend on navigation. fetchInspections is called from parent scope.
    // --- End event listener logic ---

    // --- Pull to Refresh Logic ---
    const onRefresh = useCallback(async () => {
        console.log("[onRefresh] Starting refresh...");
        setIsRefreshing(true);
        // Use the original fetchInspections here, as it's needed for standalone refresh
        await fetchInspections();
        setIsRefreshing(false);
        console.log("[onRefresh] Refresh finished.");
    }, [fetchInspections]);
    // --- End Pull to Refresh Logic ---

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
                // For web, create a link and trigger download
                const link = document.createElement('a');
                link.href = imageUrl;
                // Suggest a filename (browser might override)
                link.download = `spediak_inspection_${inspectionId}_${Date.now()}.jpg`; 
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                Alert.alert("Success", "Image download started.");
            } catch (error) {
                console.error("[handleDownloadImage Web] Error:", error);
                Alert.alert("Error", "Failed to download image on web.");
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
        if (!searchQuery) {
            return inspections;
        }
        const lowerCaseQuery = searchQuery.toLowerCase();
        return inspections.filter(inspection =>
            inspection.description.toLowerCase().includes(lowerCaseQuery) ||
            (inspection.created_at && new Date(inspection.created_at).toLocaleDateString().includes(lowerCaseQuery)) ||
            (inspection.ddid && inspection.ddid.toLowerCase().includes(lowerCaseQuery)) // Optionally search DDID text too
        );
    }, [inspections, searchQuery]);

    // Step 39 & 41: FlatList Render Item (Completed Design)
    const renderItem = ({ item }: { item: Inspection }) => {
        let dateTimeString = 'N/A';
        if (item.created_at) {
            const dateObj = new Date(item.created_at);
            const formattedDate = dateObj.toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric'
            });
            const formattedTime = dateObj.toLocaleTimeString(undefined, {
                hour: 'numeric', minute: '2-digit' //, hour12: true // Optional: force 12-hour format
            });
            dateTimeString = `${formattedDate} at ${formattedTime}`;
        }

        // Use correct property name for logging
        console.log(`[renderItem] Rendering item ID: ${item.id}, Image URL: ${item.image_url}`);

        return (
            <View style={styles.itemContainer}>
                <Image source={{ uri: item.image_url || 'https://via.placeholder.com/60' }} style={styles.itemThumbnail} />
                <View style={styles.itemTextContainer}>
                    <Text style={styles.itemDescriptionLabel}>Description:</Text>
                    <Text style={styles.itemDescriptionText} numberOfLines={2}>{item.description || 'No description'}</Text>
                    <Text style={styles.itemDateText}>{dateTimeString}</Text>
                </View>
                <View style={styles.itemActionsContainer}> 
                    <TouchableOpacity
                        style={[styles.actionButton, styles.viewButton]} 
                        onPress={() => {
                            setSelectedInspection(item);
                            setShowDetailModal(true);
                        }}
                    >
                        <Eye size={18} color={COLORS.primary} />
                        <Text style={styles.actionButtonText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.actionButton, styles.downloadButton]} 
                        onPress={() => handleDownloadImage(item.image_url, item.id)}
                        disabled={!item.image_url} // Disable if no image URL
                    >
                        <Download size={18} color={item.image_url ? COLORS.white : COLORS.textMuted} /> 
                        <Text style={[styles.actionButtonText, { color: item.image_url ? COLORS.white : COLORS.textMuted }]}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.actionButton, styles.deleteButton]} 
                        onPress={() => handleDeleteInspection(item.id)}
                    >
                        <Trash2 size={18} color={COLORS.danger} />
                        <Text style={[styles.actionButtonText, { color: COLORS.danger }]}>Delete</Text>
                    </TouchableOpacity>
                </View>
            </View>
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
                                {/* CHANGE 2: Apply updated style to Close button */}
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.closeButton]} 
                                    onPress={() => setSelectedInspection(null)}
                                >
                                    {/* Keep text white for contrast on grey */}
                                    <Text style={styles.modalButtonText}>Close</Text> 
                                </TouchableOpacity>
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
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
        marginHorizontal: 20, // Add horizontal margin instead of list padding
        marginBottom: 8, // Add space between items
        borderRadius: 8, // Add slight rounding
        // Added elevation for a subtle shadow on Android
        elevation: 1,
        // Added shadow for iOS
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 }, // Small shadow at the bottom
        shadowOpacity: 0.05, // Very subtle opacity
        shadowRadius: 1.5, // Soften the shadow
    },
    itemThumbnail: {
        width: 60,
        height: 60,
        borderRadius: 8, // Softer corners for the thumbnail
        marginRight: 15,
        backgroundColor: '#e9ecef', // Light placeholder color
    },
    itemTextContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    itemDescriptionLabel: {
        fontSize: 12,
        color: '#6c757d', // Muted color for the label
        marginBottom: 2,
        fontWeight: '500',
    },
    itemDescriptionText: {
        fontSize: 14, // Slightly larger for better readability
        color: '#343a40', // Darker text for description
        marginBottom: 4, // Space between description and date
    },
    itemDateText: {
        fontSize: 12,
        color: '#6c757d',
    },
    // Action buttons styling
    itemActionsContainer: { // Holds all action buttons horizontally
        flexDirection: 'column', // Changed to column for vertical stack
        justifyContent: 'space-around', // Distribute space for vertical stack
        alignItems: 'center', // Center items in the column
        marginLeft: 10, // Give some space from the text container
        // width: 80, // Fixed width for the actions column if needed, or remove for auto-width
    },
    actionButton: {
        flexDirection: 'row', // Icon and text side-by-side
        alignItems: 'center', // Vertically align icon and text
        paddingVertical: 6, // Vertical padding
        paddingHorizontal: 10, // Horizontal padding
        borderRadius: 5,
        // marginBottom: 8, // Space between vertical buttons
        minWidth: 80, // Ensure buttons have a decent tap area
        justifyContent: 'center', // Center content within the button
    },
    viewButton: {
        backgroundColor: COLORS.primary + '15', // Light primary background
        marginBottom: 8, // Space between vertical buttons
    },
    downloadButton: {
        backgroundColor: COLORS.success, // Green for download/save
        marginBottom: 8, // Space between vertical buttons
    },
    deleteButton: {
        backgroundColor: COLORS.danger + '15', // Light danger background
    },
    actionButtonText: {
        marginLeft: 5, // Space between icon and text
        fontSize: 13,
        fontWeight: '500',
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
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    modalContent: {
        width: '90%',
        maxWidth: 600,
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 20,
        maxHeight: '85%', // Increased max height slightly
    },
    historyModalImage: { // Optional image style for history modal
        width: '100%',
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
        justifyContent: 'space-around', // Space buttons evenly
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
    },
    closeButton: {
        // CHANGE 2: Update close button background color
        backgroundColor: '#6c757d', // Bootstrap secondary/gray color
        // Optionally change text color if needed for contrast, but white should be ok
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