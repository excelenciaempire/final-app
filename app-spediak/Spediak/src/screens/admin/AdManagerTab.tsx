import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  ActivityIndicator, 
  Image,
  Modal,
  Dimensions,
  Platform,
  PanResponder,
  Animated
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { BASE_URL } from '../../config/api';
import { COLORS } from '../../styles/colors';
import { 
  Plus, 
  Trash2, 
  ExternalLink, 
  Image as ImageIcon, 
  Upload, 
  X, 
  Check,
  Crop,
  AlertCircle,
  Info,
  Move
} from 'lucide-react-native';

interface Ad {
  id: number;
  title: string;
  subtitle?: string;
  destination_url: string;
  image_url?: string;
  is_active: boolean;
  created_at: string;
}

// Recommended ad dimensions
const AD_WIDTH = 500;
const AD_HEIGHT = 120;
const AD_ASPECT_RATIO = AD_WIDTH / AD_HEIGHT;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AdManagerTab: React.FC = () => {
  const { getToken } = useAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // New ad form
  const [newAd, setNewAd] = useState({
    title: '',
    subtitle: '',
    destinationUrl: '',
    imageUrl: ''
  });

  // Image cropping state
  const [showCropModal, setShowCropModal] = useState(false);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  // Preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fetchAds = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await axios.get(`${BASE_URL}/api/admin/ads`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });
      setAds(response.data.ads || []);
    } catch (error: any) {
      console.error('Error fetching ads:', error);
      // Don't show alert on every error - just log it
      setAds([]);
    } finally {
      setIsLoading(false);
    }
  }, []); // Remove getToken to prevent loops

  useEffect(() => {
    fetchAds();
  }, []); // Only run once on mount

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // We'll handle editing ourselves
        quality: 0.9,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setOriginalImage(`data:image/jpeg;base64,${asset.base64}`);
        
        // Get image dimensions
        const imgWidth = asset.width;
        const imgHeight = asset.height;
        setImageSize({ width: imgWidth, height: imgHeight });
        
        // Calculate display size (fit in modal)
        const maxDisplayWidth = Math.min(SCREEN_WIDTH - 60, 500);
        const displayScale = maxDisplayWidth / imgWidth;
        const displayWidth = imgWidth * displayScale;
        const displayHeight = imgHeight * displayScale;
        setDisplaySize({ width: displayWidth, height: displayHeight });
        
        // Initialize crop area to center with correct aspect ratio
        const cropHeight = Math.min(imgHeight, imgWidth / AD_ASPECT_RATIO);
        const cropWidth = cropHeight * AD_ASPECT_RATIO;
        const cropX = (imgWidth - cropWidth) / 2;
        const cropY = (imgHeight - cropHeight) / 2;
        setCropArea({ x: cropX, y: cropY, width: cropWidth, height: cropHeight });
        
        setShowCropModal(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadCroppedImage = async () => {
    if (!originalImage) return;
    
    try {
      setIsUploading(true);
      const token = await getToken();
      if (!token) return;

      // For web, we'll create a canvas to crop the image
      // For native, we'll send crop coordinates to the server
      
      const response = await axios.post(`${BASE_URL}/api/upload/ad-image`, {
        image: originalImage,
        crop: cropArea,
        originalSize: imageSize
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const imageUrl = response.data.url;
      setNewAd({ ...newAd, imageUrl });
      setPreviewUrl(imageUrl);
      setShowCropModal(false);
      setOriginalImage(null);
      
      Alert.alert('Success', 'Image uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateAd = async () => {
    if (!newAd.title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }
    if (!newAd.destinationUrl.trim()) {
      Alert.alert('Error', 'Destination URL is required');
      return;
    }

    try {
      setIsSaving(true);
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/ads`, {
        title: newAd.title,
        subtitle: newAd.subtitle,
        destination_url: newAd.destinationUrl,
        image_url: newAd.imageUrl || previewUrl
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', 'Ad created successfully');
      setNewAd({ title: '', subtitle: '', destinationUrl: '', imageUrl: '' });
      setPreviewUrl(null);
      fetchAds();
    } catch (error: any) {
      console.error('Error creating ad:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to create ad');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAd = async (adId: number) => {
    Alert.alert(
      'Delete Ad',
      'Are you sure you want to delete this ad?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              if (!token) return;

              await axios.delete(`${BASE_URL}/api/admin/ads/${adId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });

              Alert.alert('Success', 'Ad deleted successfully');
              fetchAds();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete ad');
            }
          }
        }
      ]
    );
  };

  const handleToggleAdStatus = async (adId: number, currentStatus: boolean) => {
    try {
      const token = await getToken();
      if (!token) return;

      await axios.put(`${BASE_URL}/api/admin/ads/${adId}`, {
        is_active: !currentStatus
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      fetchAds();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update ad status');
    }
  };

  const handleClearAllAds = async () => {
    Alert.alert(
      'Clear All Ads',
      'Are you sure you want to delete all ads? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              if (!token) return;

              for (const ad of ads) {
                await axios.delete(`${BASE_URL}/api/admin/ads/${ad.id}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
              }

              Alert.alert('Success', 'All ads deleted');
              fetchAds();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to clear ads');
            }
          }
        }
      ]
    );
  };

  const createTestAd = async () => {
    try {
      setIsSaving(true);
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/ads`, {
        title: '🚀 Upgrade to Pro Today!',
        subtitle: 'Get unlimited statements and remove all ads',
        destination_url: 'https://spediak.com/upgrade',
        image_url: 'https://res.cloudinary.com/demo/image/upload/v1/samples/landscapes/nature-mountains'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', 'Test ad created');
      fetchAds();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to create test ad');
    } finally {
      setIsSaving(false);
    }
  };

  // Simple crop area adjustment
  const adjustCropArea = (direction: 'left' | 'right' | 'up' | 'down', amount: number = 20) => {
    setCropArea(prev => {
      let newX = prev.x;
      let newY = prev.y;
      
      switch (direction) {
        case 'left':
          newX = Math.max(0, prev.x - amount);
          break;
        case 'right':
          newX = Math.min(imageSize.width - prev.width, prev.x + amount);
          break;
        case 'up':
          newY = Math.max(0, prev.y - amount);
          break;
        case 'down':
          newY = Math.min(imageSize.height - prev.height, prev.y + amount);
          break;
      }
      
      return { ...prev, x: newX, y: newY };
    });
  };

  // Zoom crop area
  const zoomCropArea = (zoomIn: boolean) => {
    setCropArea(prev => {
      const scaleFactor = zoomIn ? 0.9 : 1.1;
      const newWidth = Math.max(100, Math.min(imageSize.width, prev.width * scaleFactor));
      const newHeight = newWidth / AD_ASPECT_RATIO;
      
      // Keep it within bounds
      if (newHeight > imageSize.height) {
        return prev;
      }
      
      // Center the new crop area relative to the old one
      const centerX = prev.x + prev.width / 2;
      const centerY = prev.y + prev.height / 2;
      const newX = Math.max(0, Math.min(imageSize.width - newWidth, centerX - newWidth / 2));
      const newY = Math.max(0, Math.min(imageSize.height - newHeight, centerY - newHeight / 2));
      
      return { x: newX, y: newY, width: newWidth, height: newHeight };
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading ads...</Text>
      </View>
    );
  }

  // Calculate crop overlay position for display
  const cropDisplayX = (cropArea.x / imageSize.width) * displaySize.width;
  const cropDisplayY = (cropArea.y / imageSize.height) * displaySize.height;
  const cropDisplayWidth = (cropArea.width / imageSize.width) * displaySize.width;
  const cropDisplayHeight = (cropArea.height / imageSize.height) * displaySize.height;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Dimensions Info */}
      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Info size={18} color="#3B82F6" />
          <Text style={styles.infoTitle}>Recommended Ad Dimensions</Text>
        </View>
        <Text style={styles.infoText}>
          For best results, use images with dimensions: <Text style={styles.infoBold}>{AD_WIDTH}px × {AD_HEIGHT}px</Text>
        </Text>
        <Text style={styles.infoText}>
          Aspect ratio: <Text style={styles.infoBold}>{AD_ASPECT_RATIO.toFixed(2)}:1</Text> (wide banner format)
        </Text>
        <View style={styles.dimensionPreview}>
          <View style={styles.dimensionBox}>
            <Text style={styles.dimensionLabel}>{AD_WIDTH}px</Text>
          </View>
          <Text style={styles.dimensionHeight}>{AD_HEIGHT}px</Text>
        </View>
      </View>

      {/* Create New Ad */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create New Ad</Text>
        <Text style={styles.cardDescription}>
          Create ads to display to free-plan users. Ads encourage upgrades and can feature affiliate products.
        </Text>

        {/* Image Upload Section */}
        <View style={styles.imageUploadSection}>
          <Text style={styles.label}>Ad Image</Text>
          
          {previewUrl || newAd.imageUrl ? (
            <View style={styles.imagePreviewContainer}>
              <Image 
                source={{ uri: previewUrl || newAd.imageUrl }} 
                style={styles.imagePreview}
                resizeMode="cover"
              />
              <TouchableOpacity 
                style={styles.removeImageButton}
                onPress={() => {
                  setPreviewUrl(null);
                  setNewAd({ ...newAd, imageUrl: '' });
                }}
              >
                <X size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
              <Upload size={24} color={COLORS.primary} />
              <Text style={styles.uploadButtonText}>Upload Image</Text>
              <Text style={styles.uploadHint}>Click to select an image from your device</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.orText}>— or paste image URL —</Text>
          <TextInput
            style={styles.input}
            placeholder="https://example.com/image.jpg"
            value={newAd.imageUrl}
            onChangeText={(text) => {
              setNewAd({ ...newAd, imageUrl: text });
              setPreviewUrl(null);
            }}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>

        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Upgrade to Pro!"
          value={newAd.title}
          onChangeText={(text) => setNewAd({ ...newAd, title: text })}
        />

        <Text style={styles.label}>Subtitle</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Get unlimited statements"
          value={newAd.subtitle}
          onChangeText={(text) => setNewAd({ ...newAd, subtitle: text })}
        />

        <Text style={styles.label}>Destination URL *</Text>
        <TextInput
          style={styles.input}
          placeholder="https://example.com"
          value={newAd.destinationUrl}
          onChangeText={(text) => setNewAd({ ...newAd, destinationUrl: text })}
          autoCapitalize="none"
          keyboardType="url"
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.createButton, isSaving && styles.buttonDisabled]} 
            onPress={handleCreateAd}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Plus size={18} color="#fff" />
                <Text style={styles.createButtonText}>Create Ad</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.testButton} 
            onPress={createTestAd}
            disabled={isSaving}
          >
            <Text style={styles.testButtonText}>Create Test Ad</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Current Ads */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Current Ads ({ads.length})</Text>
          {ads.length > 0 && (
            <TouchableOpacity style={styles.clearAllButton} onPress={handleClearAllAds}>
              <Trash2 size={14} color={COLORS.error} />
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {ads.length === 0 ? (
          <View style={styles.emptyState}>
            <ImageIcon size={48} color="#ccc" />
            <Text style={styles.emptyText}>No ads configured</Text>
            <Text style={styles.emptySubtext}>Create an ad above to display to free users</Text>
          </View>
        ) : (
          ads.map((ad) => (
            <View key={ad.id} style={styles.adItem}>
              {ad.image_url ? (
                <Image source={{ uri: ad.image_url }} style={styles.adThumbnail} />
              ) : (
                <View style={styles.adThumbnailPlaceholder}>
                  <ImageIcon size={24} color="#999" />
                </View>
              )}
              <View style={styles.adInfo}>
                <View style={styles.adTitleRow}>
                  <Text style={styles.adTitle} numberOfLines={1}>{ad.title}</Text>
                  <View style={[styles.statusBadge, ad.is_active ? styles.statusActive : styles.statusInactive]}>
                    <Text style={styles.statusText}>{ad.is_active ? 'Active' : 'Inactive'}</Text>
                  </View>
                </View>
                {ad.subtitle && <Text style={styles.adSubtitle} numberOfLines={1}>{ad.subtitle}</Text>}
                <View style={styles.adUrlRow}>
                  <ExternalLink size={12} color={COLORS.primary} />
                  <Text style={styles.adUrl} numberOfLines={1}>{ad.destination_url}</Text>
                </View>
              </View>
              <View style={styles.adActions}>
                <TouchableOpacity 
                  style={styles.toggleButton}
                  onPress={() => handleToggleAdStatus(ad.id, ad.is_active)}
                >
                  <Text style={styles.toggleButtonText}>
                    {ad.is_active ? 'Disable' : 'Enable'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.deleteAdButton}
                  onPress={() => handleDeleteAd(ad.id)}
                >
                  <Trash2 size={18} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Image Crop Modal */}
      <Modal
        visible={showCropModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCropModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cropModal}>
            <View style={styles.cropModalHeader}>
              <Text style={styles.cropModalTitle}>Crop Ad Image</Text>
              <TouchableOpacity onPress={() => setShowCropModal(false)}>
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.cropInstructions}>
              Use the controls below to position and size the crop area. The ad will use the highlighted region.
            </Text>

            <View style={styles.cropDimensionInfo}>
              <AlertCircle size={14} color="#F59E0B" />
              <Text style={styles.cropDimensionText}>
                Output: {AD_WIDTH} × {AD_HEIGHT}px (aspect ratio {AD_ASPECT_RATIO.toFixed(1)}:1)
              </Text>
            </View>

            {/* Image with crop overlay */}
            <View style={styles.cropImageContainer}>
              {originalImage && (
                <View style={{ width: displaySize.width, height: displaySize.height }}>
                  <Image 
                    source={{ uri: originalImage }} 
                    style={{ width: displaySize.width, height: displaySize.height }}
                    resizeMode="contain"
                  />
                  
                  {/* Dark overlay */}
                  <View style={[styles.cropOverlay, { width: displaySize.width, height: displaySize.height }]}>
                    {/* Top dark area */}
                    <View style={[styles.cropDark, { 
                      top: 0, 
                      left: 0, 
                      right: 0, 
                      height: cropDisplayY 
                    }]} />
                    {/* Bottom dark area */}
                    <View style={[styles.cropDark, { 
                      top: cropDisplayY + cropDisplayHeight, 
                      left: 0, 
                      right: 0, 
                      bottom: 0 
                    }]} />
                    {/* Left dark area */}
                    <View style={[styles.cropDark, { 
                      top: cropDisplayY, 
                      left: 0, 
                      width: cropDisplayX, 
                      height: cropDisplayHeight 
                    }]} />
                    {/* Right dark area */}
                    <View style={[styles.cropDark, { 
                      top: cropDisplayY, 
                      left: cropDisplayX + cropDisplayWidth, 
                      right: 0, 
                      height: cropDisplayHeight 
                    }]} />
                    
                    {/* Crop frame */}
                    <View style={[styles.cropFrame, {
                      top: cropDisplayY,
                      left: cropDisplayX,
                      width: cropDisplayWidth,
                      height: cropDisplayHeight
                    }]}>
                      <View style={[styles.cropCorner, styles.cropCornerTL]} />
                      <View style={[styles.cropCorner, styles.cropCornerTR]} />
                      <View style={[styles.cropCorner, styles.cropCornerBL]} />
                      <View style={[styles.cropCorner, styles.cropCornerBR]} />
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Crop Controls */}
            <View style={styles.cropControls}>
              <Text style={styles.cropControlLabel}>Position</Text>
              <View style={styles.cropControlRow}>
                <TouchableOpacity style={styles.cropControlButton} onPress={() => adjustCropArea('left')}>
                  <Text style={styles.cropControlButtonText}>← Left</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cropControlButton} onPress={() => adjustCropArea('up')}>
                  <Text style={styles.cropControlButtonText}>↑ Up</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cropControlButton} onPress={() => adjustCropArea('down')}>
                  <Text style={styles.cropControlButtonText}>↓ Down</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cropControlButton} onPress={() => adjustCropArea('right')}>
                  <Text style={styles.cropControlButtonText}>Right →</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.cropControlLabel}>Zoom</Text>
              <View style={styles.cropControlRow}>
                <TouchableOpacity style={[styles.cropControlButton, styles.zoomButton]} onPress={() => zoomCropArea(true)}>
                  <Text style={styles.cropControlButtonText}>+ Zoom In</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.cropControlButton, styles.zoomButton]} onPress={() => zoomCropArea(false)}>
                  <Text style={styles.cropControlButtonText}>- Zoom Out</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.cropModalActions}>
              <TouchableOpacity 
                style={styles.cancelCropButton}
                onPress={() => {
                  setShowCropModal(false);
                  setOriginalImage(null);
                }}
              >
                <Text style={styles.cancelCropText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.applyCropButton, isUploading && styles.buttonDisabled]}
                onPress={uploadCroppedImage}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Check size={18} color="#fff" />
                    <Text style={styles.applyCropText}>Apply & Upload</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  infoCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E40AF',
  },
  infoText: {
    fontSize: 13,
    color: '#3B82F6',
    marginBottom: 4,
  },
  infoBold: {
    fontWeight: '700',
    color: '#1E40AF',
  },
  dimensionPreview: {
    marginTop: 12,
    alignItems: 'center',
  },
  dimensionBox: {
    width: '100%',
    maxWidth: 250,
    height: 60,
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dimensionLabel: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '600',
  },
  dimensionHeight: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 4,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E3A5F',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  imageUploadSection: {
    marginBottom: 16,
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 32,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 8,
  },
  uploadHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  imagePreview: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginVertical: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
    minHeight: 48,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  createButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  testButton: {
    flex: 1,
    backgroundColor: '#F0F4F8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  testButtonText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  clearAllText: {
    fontSize: 13,
    color: COLORS.error,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  adItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  adThumbnail: {
    width: 80,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
    marginRight: 12,
  },
  adThumbnailPlaceholder: {
    width: 80,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adInfo: {
    flex: 1,
  },
  adTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  adTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusActive: {
    backgroundColor: '#DCFCE7',
  },
  statusInactive: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#166534',
  },
  adSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  adUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  adUrl: {
    fontSize: 11,
    color: COLORS.primary,
    flex: 1,
  },
  adActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toggleButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  deleteAdButton: {
    padding: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cropModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
  },
  cropModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cropModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E3A5F',
  },
  cropInstructions: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  cropDimensionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  cropDimensionText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
  cropImageContainer: {
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 10,
  },
  cropOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  cropDark: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cropFrame: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#3B82F6',
    backgroundColor: 'transparent',
  },
  cropCorner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: '#fff',
    borderWidth: 3,
  },
  cropCornerTL: {
    top: -2,
    left: -2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cropCornerTR: {
    top: -2,
    right: -2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cropCornerBL: {
    bottom: -2,
    left: -2,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cropCornerBR: {
    bottom: -2,
    right: -2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  cropControls: {
    marginBottom: 16,
  },
  cropControlLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  cropControlRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  cropControlButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  zoomButton: {
    flex: 1,
    alignItems: 'center',
  },
  cropControlButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  cropModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelCropButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
  },
  cancelCropText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  applyCropButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
  },
  applyCropText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});

export default AdManagerTab;
