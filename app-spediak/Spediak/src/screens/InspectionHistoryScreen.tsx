import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  FlatList, 
  ActivityIndicator, 
  TouchableOpacity, 
  Image, 
  Alert, 
  Platform, 
  RefreshControl, 
  ScrollView,
  Modal,
  Dimensions,
  useWindowDimensions
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { Search, Trash2, Copy, Download, X, ChevronDown, ChevronUp } from 'lucide-react-native';
import { BASE_URL } from '../config/api';
import { COLORS } from '../styles/colors';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import StatementUsageCard from '../components/StatementUsageCard';
import AdBanner from '../components/AdBanner';
import { useImpersonation } from '../context/ImpersonationContext';
import ImpersonationBanner from '../components/ImpersonationBanner';

interface Inspection {
  id: string;
  image_url: string;
  description: string;
  created_at: string;
  ddid: string;
}

// Helper function to get optimized Cloudinary image URL
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
  return url;
};

// Get first meaningful sentence/title from description or DDID
const getStatementTitle = (description: string, ddid: string): string => {
  // Try to get a meaningful title from description first
  if (description) {
    // Look for first sentence or line
    const firstLine = description.split(/[.\n]/)[0].trim();
    if (firstLine && firstLine.length > 10) {
      return firstLine.length > 60 ? firstLine.substring(0, 57) + '...' : firstLine;
    }
  }
  // Fallback to DDID
  if (ddid) {
    const firstLine = ddid.split(/[.\n]/)[0].trim();
    if (firstLine) {
      return firstLine.length > 60 ? firstLine.substring(0, 57) + '...' : firstLine;
    }
  }
  return 'Inspection Statement';
};

// Get preview text (truncated)
const getPreviewText = (ddid: string, maxLength: number = 80): string => {
  if (!ddid) return 'No statement available...';
  const clean = ddid.replace(/\*\*/g, '').trim();
  return clean.length > maxLength ? clean.substring(0, maxLength) + '...' : clean;
};

// Expandable Inspection Card Component
const InspectionCard = React.memo(({ 
  item, 
  isExpanded, 
  onToggleExpand, 
  onDeleteItem,
  onCopy,
  onViewImage
}: {
  item: Inspection;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDeleteItem: (id: string) => void;
  onCopy: (text: string) => void;
  onViewImage: (url: string) => void;
}) => {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  
  const displayDate = item.created_at 
    ? new Date(item.created_at).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : 'Date not available';
  const thumbnailUrl = getOptimizedImageUrl(item.image_url, 60, 60);
  const statementTitle = getStatementTitle(item.description, item.ddid);
  const previewText = getPreviewText(item.ddid);

  return (
    <View style={[styles.cardContainer, isExpanded && styles.cardContainerExpanded]}>
      {/* Header Row - Always visible */}
      <TouchableOpacity 
        style={styles.cardHeader} 
        onPress={onToggleExpand} 
        activeOpacity={0.7}
      >
        {/* Thumbnail */}
        <TouchableOpacity 
          style={styles.thumbnailContainer}
          onPress={() => item.image_url && onViewImage(item.image_url)}
          activeOpacity={0.8}
        >
          {thumbnailUrl ? (
            <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Text style={styles.thumbnailPlaceholderText}>No Image</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Title & Date */}
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {statementTitle}
          </Text>
          <Text style={styles.cardDate}>{displayDate}</Text>
          {!isExpanded && (
            <Text style={styles.cardPreview} numberOfLines={1}>
              {previewText}
            </Text>
          )}
        </View>

        {/* Expand Indicator */}
        <View style={styles.expandButton}>
          {isExpanded ? (
            <ChevronUp size={20} color={COLORS.primary} />
          ) : (
            <ChevronDown size={20} color={COLORS.textSecondary} />
          )}
        </View>
      </TouchableOpacity>

      {/* Expanded Content */}
      {isExpanded && (
        <View style={styles.expandedContent}>
          {/* Full Statement */}
          <ScrollView 
            style={styles.statementScrollView} 
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
          >
            <Text style={styles.fullStatementText}>
              {item.ddid || 'No statement available.'}
            </Text>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.copyStatementBtn}
              onPress={() => onCopy(item.ddid)}
            >
              <Copy size={16} color={COLORS.primary} />
              <Text style={styles.copyStatementText}>Copy statement</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => onDeleteItem(item.id)}
            >
              <Trash2 size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
});

// Full Image Modal Component
const ImageModal = ({ 
  visible, 
  imageUrl, 
  onClose, 
  onDownload 
}: { 
  visible: boolean; 
  imageUrl: string | null; 
  onClose: () => void; 
  onDownload: () => void;
}) => {
  const { width, height } = useWindowDimensions();
  const isLargeScreen = width > 768;

  if (!imageUrl) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxWidth: isLargeScreen ? 800 : width * 0.95 }]}>
          {/* Close Button */}
          <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
            <X size={24} color="#fff" />
          </TouchableOpacity>

          {/* Image */}
          <Image 
            source={{ uri: imageUrl }} 
            style={[styles.modalImage, { maxHeight: height * 0.7 }]}
            resizeMode="contain"
          />

          {/* Download Button */}
          <TouchableOpacity style={styles.modalDownloadBtn} onPress={onDownload}>
            <Download size={20} color="#fff" />
            <Text style={styles.modalDownloadText}>Download Image</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function InspectionHistoryScreen() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const ITEMS_PER_PAGE = 10;

  // Image modal state
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);

  const { getToken } = useAuth();
  const navigation = useNavigation();
  const [mediaLibraryPermission, requestMediaLibraryPermission] = MediaLibrary.usePermissions();
  
  // Impersonation context - for admin viewing user's history
  const { isImpersonating, impersonatedUser } = useImpersonation();

  // Request Media Library permission on mount if not granted
  useEffect(() => {
    if (Platform.OS !== 'web' && (!mediaLibraryPermission || mediaLibraryPermission.status !== MediaLibrary.PermissionStatus.GRANTED)) {
      requestMediaLibraryPermission();
    }
  }, [mediaLibraryPermission]);

  // Fetch inspections (or impersonated user's inspections)
  const fetchInspections = useCallback(async (pageToFetch = 1, isRefreshingData = false) => {
    if (pageToFetch === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    if (isRefreshingData) {
      setInspections([]);
    }
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("User not authenticated");

      // If impersonating, use admin endpoint to fetch user's inspections
      let apiUrl = `${BASE_URL}/api/inspections?page=${pageToFetch}&limit=${ITEMS_PER_PAGE}`;
      
      if (isImpersonating && impersonatedUser?.clerk_id) {
        apiUrl = `${BASE_URL}/api/admin/users/${impersonatedUser.clerk_id}/inspections?page=${pageToFetch}&limit=${ITEMS_PER_PAGE}`;
      }

      const response = await axios.get<{ items: Inspection[], totalPages: number, currentPage: number }>(
        apiUrl, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const responseData = response.data;
      const items = responseData && Array.isArray(responseData.items) ? responseData.items : [];
      const newTotalPages = (responseData && typeof responseData.totalPages === 'number') ? responseData.totalPages : 1;
      const newCurrentPage = (responseData && typeof responseData.currentPage === 'number') ? responseData.currentPage : 1;
      
      if (pageToFetch === 1 || isRefreshingData) {
        setInspections(items);
      } else {
        setInspections(prevInspections => [...prevInspections, ...items]);
      }
      setTotalPages(newTotalPages);
      setCurrentPage(newCurrentPage);

    } catch (err: any) {
      console.error("[fetchInspections] Error:", err);
      const errorMessage = err.response?.data?.message || err.message || "Failed to fetch inspections";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      if (isRefreshingData) setIsRefreshing(false);
    }
  }, [getToken, ITEMS_PER_PAGE, isImpersonating, impersonatedUser]);

  // Fetch data on mount, focus, and impersonation change
  useEffect(() => {
    fetchInspections(1, true);

    const unsubscribe = navigation.addListener('focus', () => {
      setCurrentPage(1);
      fetchInspections(1, true);
    });

    return unsubscribe;
  }, [navigation, isImpersonating, impersonatedUser?.clerk_id]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setCurrentPage(1);
    await fetchInspections(1, true);
  }, [fetchInspections]);

  // Load more (pagination)
  const handleLoadMore = () => {
    if (!isLoadingMore && currentPage < totalPages) {
      fetchInspections(currentPage + 1);
    }
  };

  // Delete inspection (disabled in impersonation mode)
  const handleDeleteInspection = async (id: string) => {
    // Prevent deletion in impersonation mode (read-only)
    if (isImpersonating) {
      Alert.alert("Read-Only Mode", "You cannot delete statements while in impersonation mode.");
      return;
    }

    const deleteConfirmedAction = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("User not authenticated");

        await axios.delete(`${BASE_URL}/api/inspections/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        Alert.alert("Success", "Statement deleted successfully.");
        await fetchInspections(1, true);

      } catch (err: any) {
        console.error(`Error deleting inspection ID ${id}:`, err);
        const errorMessage = err.response?.data?.message || err.message || "Failed to delete";
        Alert.alert("Error", errorMessage);
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm("Are you sure you want to delete this statement?")) {
        await deleteConfirmedAction();
      }
    } else {
      Alert.alert(
        "Confirm Deletion",
        "Are you sure you want to delete this statement?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: deleteConfirmedAction },
        ]
      );
    }
  };

  // View image in modal
  const handleViewImage = (imageUrl: string) => {
    const fullUrl = getOptimizedImageUrl(imageUrl, 1200, 900);
    setSelectedImageUrl(fullUrl || imageUrl);
    // Find the inspection id for this image
    const inspection = inspections.find(i => i.image_url === imageUrl);
    setSelectedInspectionId(inspection?.id || null);
    setImageModalVisible(true);
  };

  // Download image
  const handleDownloadImage = async () => {
    if (!selectedImageUrl) {
      Alert.alert("Error", "No image to download.");
      return;
    }

    if (Platform.OS === 'web') {
      try {
        const response = await fetch(selectedImageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image`);
        }
        
        if (typeof window === 'undefined' || typeof document === 'undefined') {
          throw new Error('Download not supported');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `spediak_statement_${selectedInspectionId || Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        Alert.alert("Success", "Image download started.");
      } catch (error: any) {
        console.error("[handleDownloadImage Web] Error:", error);
        Alert.alert("Error", error.message || "Failed to download image.");
      }
    } else {
      // Native download
      if (!mediaLibraryPermission || mediaLibraryPermission.status !== MediaLibrary.PermissionStatus.GRANTED) {
        const { status } = await requestMediaLibraryPermission();
        if (status !== MediaLibrary.PermissionStatus.GRANTED) {
          Alert.alert("Permission Denied", "Storage permission is required to save the image.");
          return;
        }
      }

      try {
        const fileName = `spediak_statement_${selectedInspectionId || Date.now()}.jpg`;
        const fileUri = FileSystem.documentDirectory + fileName;

        const downloadResult = await FileSystem.downloadAsync(selectedImageUrl, fileUri);

        if (downloadResult.status !== 200) {
          throw new Error(`Failed to download image`);
        }

        const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
        await MediaLibrary.createAlbumAsync('Spediak', asset, false);
        Alert.alert("Success", "Image saved to your gallery!");
      } catch (error: any) {
        console.error("[handleDownloadImage Native] Error:", error);
        Alert.alert("Error", error.message || "Failed to download image.");
      }
    }
  };

  // Copy to clipboard
  const handleCopyToClipboard = async (textToCopy: string) => {
    if (!textToCopy) {
      Alert.alert("Error", "No text to copy.");
      return;
    }
    const plainText = textToCopy.replace(/\*\*/g, '');
    try {
      await Clipboard.setStringAsync(plainText);
      Alert.alert("Copied!", "Statement copied to clipboard.");
    } catch (e) {
      console.error("Failed to copy:", e);
      Alert.alert("Error", "Could not copy to clipboard.");
    }
  };

  // Filter by search query
  const filteredInspections = useMemo(() => {
    return inspections.filter(inspection =>
      (inspection.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (inspection.ddid?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );
  }, [inspections, searchQuery]);

  // Toggle expanded
  const toggleExpanded = (itemId: string) => {
    setExpandedItemId(expandedItemId === itemId ? null : itemId);
  };

  // Render item
  const renderItem = ({ item }: { item: Inspection }) => (
    <InspectionCard 
      item={item}
      isExpanded={expandedItemId === item.id}
      onToggleExpand={() => toggleExpanded(item.id)}
      onDeleteItem={handleDeleteInspection}
      onCopy={handleCopyToClipboard}
      onViewImage={handleViewImage}
    />
  );

  // Render footer (loading indicator)
  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={{ paddingVertical: 20 }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  };

  const { width: screenWidth } = useWindowDimensions();
  const isLargeScreen = screenWidth > 768;
  const contentMaxWidth = isLargeScreen ? 900 : screenWidth;

  return (
    <View style={styles.container}>
      <View style={[styles.contentWrapper, { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }]}>
        <Text style={styles.headerTitle}>
          {isImpersonating && impersonatedUser 
            ? `Statement History - ${impersonatedUser.email}` 
            : 'Statement History'}
        </Text>
        
        {/* Impersonation indicator */}
        {isImpersonating && impersonatedUser && (
          <View style={styles.impersonationIndicator}>
            <Text style={styles.impersonationText}>
              👁️ Viewing as: {impersonatedUser.email} (Read-Only)
            </Text>
          </View>
        )}
        
        {/* Usage & Ad Banner for free users */}
        <View style={styles.promoContainer}>
          <StatementUsageCard />
          <AdBanner />
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Search size={20} color="#6c757d" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search statements..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#6c757d"
          />
        </View>

        {/* List */}
        {isLoading && <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />}
        {error && <Text style={styles.errorText}>{error}</Text>}
        {!isLoading && !error && (
          filteredInspections.length === 0 ? (
            <Text style={styles.emptyText}>
              {searchQuery ? 'No matching statements found.' : 'No statement history found.'}
            </Text>
          ) : (
            <FlatList
              data={filteredInspections}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              style={styles.list}
              contentContainerStyle={[styles.listContent, isLargeScreen && { paddingHorizontal: 24 }]}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={onRefresh}
                  colors={[COLORS.primary]}
                  tintColor={COLORS.primary}
                />
              }
              ListFooterComponent={renderFooter}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
            />
          )
        )}

        {/* Image Modal */}
        <ImageModal
          visible={imageModalVisible}
          imageUrl={selectedImageUrl}
          onClose={() => setImageModalVisible(false)}
          onDownload={handleDownloadImage}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: Platform.OS === 'web' ? 20 : 0,
  },
  promoContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  impersonationIndicator: {
    backgroundColor: '#7C3AED',
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  impersonationText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    minHeight: 48,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
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

  // Card Styles
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  cardContainerExpanded: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  thumbnailContainer: {
    marginRight: 12,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  thumbnailPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#e8ecf0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailPlaceholderText: {
    fontSize: 9,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
    lineHeight: 20,
  },
  cardDate: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
    marginBottom: 4,
  },
  cardPreview: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  expandButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f4f8',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // Expanded Content
  expandedContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  statementScrollView: {
    maxHeight: 200,
    marginVertical: 14,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8ecf0',
  },
  fullStatementText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },

  // Action Buttons
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  copyStatementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f4fd',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 8,
  },
  copyStatementText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '95%',
    alignItems: 'center',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: -50,
    right: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalImage: {
    width: '100%',
    minHeight: 300,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
  modalDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 20,
    gap: 10,
  },
  modalDownloadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
