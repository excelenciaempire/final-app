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
import { useSubscription } from '../../context/SubscriptionContext';
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
  Move,
  Eye,
  EyeOff
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
  const { adminPreviewMode, setAdminPreviewMode } = useSubscription();
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
  
  // Drag & Drop state (web only)
  const [isDragging, setIsDragging] = useState(false);

  // Promotion state
  const [promotion, setPromotion] = useState<{
    id?: number;
    promoName: string;
    startDate: string;
    endDate: string;
    freeStatements: string;
    isActive: boolean;
  } | null>(null);
  const [isLoadingPromo, setIsLoadingPromo] = useState(false);
  const [isSavingPromo, setIsSavingPromo] = useState(false);
  const [promoForm, setPromoForm] = useState({
    promoName: '',
    startDate: '',
    endDate: '',
    freeStatements: '10'
  });

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
    fetchActivePromotion();
  }, []); // Only run once on mount

  // Fetch active promotion
  const fetchActivePromotion = async () => {
    try {
      setIsLoadingPromo(true);
      const token = await getToken();
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/api/admin/promotions/active`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });

      if (response.data.promotion) {
        const promo = response.data.promotion;
        setPromotion({
          id: promo.id,
          promoName: promo.promo_name || '',
          startDate: promo.start_date?.split('T')[0] || '',
          endDate: promo.end_date?.split('T')[0] || '',
          freeStatements: String(promo.free_statements || 0),
          isActive: promo.is_active
        });
        setPromoForm({
          promoName: promo.promo_name || '',
          startDate: promo.start_date?.split('T')[0] || '',
          endDate: promo.end_date?.split('T')[0] || '',
          freeStatements: String(promo.free_statements || 0)
        });
      } else {
        setPromotion(null);
      }
    } catch (error) {
      console.log('No active promotion found');
      setPromotion(null);
    } finally {
      setIsLoadingPromo(false);
    }
  };

  // Save promotion
  const handleSavePromotion = async () => {
    if (!promoForm.startDate || !promoForm.endDate) {
      if (Platform.OS === 'web') {
        alert('Please enter start and end dates');
      } else {
        Alert.alert('Error', 'Please enter start and end dates');
      }
      return;
    }

    const statements = parseInt(promoForm.freeStatements, 10);
    if (isNaN(statements) || statements < 0) {
      if (Platform.OS === 'web') {
        alert('Please enter a valid number of statements');
      } else {
        Alert.alert('Error', 'Please enter a valid number of statements');
      }
      return;
    }

    setIsSavingPromo(true);
    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/promotions`, {
        promo_name: promoForm.promoName || 'Sign-up Promotion',
        start_date: promoForm.startDate,
        end_date: promoForm.endDate,
        free_statements: statements,
        is_active: true
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });

      if (Platform.OS === 'web') {
        alert('Promotion saved successfully!');
      } else {
        Alert.alert('Success', 'Promotion saved successfully!');
      }
      fetchActivePromotion();
    } catch (error: any) {
      console.error('Error saving promotion:', error);
      const errorMsg = error.response?.data?.message || 'Failed to save promotion';
      if (Platform.OS === 'web') {
        alert('Error: ' + errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setIsSavingPromo(false);
    }
  };

  // Clear promotion
  const handleClearPromotion = async () => {
    const doClear = async () => {
      setIsSavingPromo(true);
      try {
        const token = await getToken();
        if (!token) return;

        await axios.delete(`${BASE_URL}/api/admin/promotions`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        });

        setPromotion(null);
        setPromoForm({
          promoName: '',
          startDate: '',
          endDate: '',
          freeStatements: '10'
        });

        if (Platform.OS === 'web') {
          alert('Promotion cleared.');
        } else {
          Alert.alert('Success', 'Promotion cleared');
        }
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || 'Failed to clear promotion';
        if (Platform.OS === 'web') {
          alert('Error: ' + errorMsg);
        } else {
          Alert.alert('Error', errorMsg);
        }
      } finally {
        setIsSavingPromo(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to clear this promotion? New sign-ups will no longer receive bonus statements.')) {
        doClear();
      }
    } else {
      Alert.alert('Clear Promotion', 'Are you sure you want to clear this promotion?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: doClear }
      ]);
    }
  }

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

  // Handle image result from drag/drop or picker
  const handleImageData = (base64: string, width: number, height: number) => {
    setOriginalImage(`data:image/jpeg;base64,${base64}`);
    setImageSize({ width, height });
    
    const maxDisplayWidth = Math.min(SCREEN_WIDTH - 60, 500);
    const displayScale = maxDisplayWidth / width;
    const displayWidth = width * displayScale;
    const displayHeight = height * displayScale;
    setDisplaySize({ width: displayWidth, height: displayHeight });
    
    const cropHeight = Math.min(height, width / AD_ASPECT_RATIO);
    const cropWidth = cropHeight * AD_ASPECT_RATIO;
    const cropX = (width - cropWidth) / 2;
    const cropY = (height - cropHeight) / 2;
    setCropArea({ x: cropX, y: cropY, width: cropWidth, height: cropHeight });
    
    setShowCropModal(true);
  };

  // Drag & Drop handlers (web only)
  const handleDragOver = (event: any) => {
    if (Platform.OS !== 'web') return;
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: any) => {
    if (Platform.OS !== 'web') return;
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: any) => {
    if (Platform.OS !== 'web') return;
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(',')[1];
          
          // Get image dimensions
          const img = new (window as any).Image();
          img.onload = () => {
            handleImageData(base64, img.width, img.height);
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      } else {
        Alert.alert('Invalid File', 'Please drop an image file (JPG, PNG, etc.)');
      }
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
    const imageUrlToUse = newAd.imageUrl || previewUrl;
    
    if (!imageUrlToUse) {
      Alert.alert('Error', 'Please upload an ad image');
      return;
    }
    if (!newAd.destinationUrl.trim()) {
      Alert.alert('Error', 'Destination URL is required');
      return;
    }

    // Basic URL validation
    const urlToUse = newAd.destinationUrl.trim();
    if (!urlToUse.startsWith('http://') && !urlToUse.startsWith('https://')) {
      Alert.alert('Error', 'Please enter a valid URL starting with http:// or https://');
      return;
    }

    try {
      setIsSaving(true);
      const token = await getToken();
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      console.log('[AdManager] Creating ad with:', { 
        title: 'Ad', 
        destination_url: urlToUse, 
        image_url: imageUrlToUse 
      });

      const response = await axios.post(`${BASE_URL}/api/admin/ads`, {
        title: 'Ad',  // Simple default title for internal use
        destination_url: urlToUse,
        image_url: imageUrlToUse
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000
      });

      console.log('[AdManager] Ad created successfully:', response.data);

      // Reset form
      setNewAd({ title: '', subtitle: '', destinationUrl: '', imageUrl: '' });
      setPreviewUrl(null);
      
      // Refresh ads list
      await fetchAds();
      
      Alert.alert('Success', 'Ad created successfully');
    } catch (error: any) {
      console.error('[AdManager] Error creating ad:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create ad';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAd = async (adId: number) => {
    const deleteAction = async () => {
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
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this ad?')) {
        await deleteAction();
      }
    } else {
      Alert.alert(
        'Delete Ad',
        'Are you sure you want to delete this ad?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: deleteAction }
        ]
      );
    }
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
      {/* Admin Preview Mode Toggle */}
      <View style={styles.previewCard}>
        <View style={styles.previewHeader}>
          <View style={styles.previewTitleRow}>
            {adminPreviewMode ? (
              <Eye size={20} color="#F59E0B" />
            ) : (
              <EyeOff size={20} color="#6B7280" />
            )}
            <Text style={styles.previewTitle}>Admin Preview Mode</Text>
          </View>
          <TouchableOpacity
            style={[styles.previewToggle, adminPreviewMode && styles.previewToggleActive]}
            onPress={() => setAdminPreviewMode(!adminPreviewMode)}
          >
            <Text style={[styles.previewToggleText, adminPreviewMode && styles.previewToggleTextActive]}>
              {adminPreviewMode ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.previewDescription}>
          {adminPreviewMode 
            ? '✅ Preview mode enabled! You can now see ads and usage cards on all screens as if you were a free user. Ads will rotate automatically.'
            : 'Enable to preview how ads and statement limits appear to free-tier users across the app.'}
        </Text>
      </View>

      {/* Create New Ad */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create New Ad</Text>
        <Text style={styles.cardDescription}>
          Create ads to display to free-plan users. Ads encourage upgrades and can feature affiliate products.
        </Text>

        {/* Image Upload Section */}
        <View style={styles.imageUploadSection}>
          <Text style={styles.label}>Ad Image *</Text>
          
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
          ) : Platform.OS === 'web' ? (
            <View
              // @ts-ignore - web-only drag/drop events  
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={[styles.uploadButton, isDragging && styles.uploadButtonDragging]}
            >
              <TouchableOpacity onPress={pickImage} style={styles.uploadButtonInner}>
                <Upload size={24} color={isDragging ? '#fff' : COLORS.primary} />
                <Text style={[styles.uploadButtonText, isDragging && styles.uploadButtonTextDragging]}>
                  {isDragging ? 'Drop image here' : 'Drag & drop or click to upload'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
              <Upload size={24} color={COLORS.primary} />
              <Text style={styles.uploadButtonText}>Upload Ad Image</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.label}>Destination URL *</Text>
        <TextInput
          style={styles.input}
          placeholder="https://example.com"
          value={newAd.destinationUrl}
          onChangeText={(text) => setNewAd({ ...newAd, destinationUrl: text })}
          autoCapitalize="none"
          keyboardType="url"
        />

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

      {/* Sign-up Promotion Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sign-up Promotion</Text>
        <Text style={styles.cardDescription}>
          Define bonus statements for new users who sign up during a promotional period.
        </Text>

        {isLoadingPromo ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 20 }} />
        ) : promotion ? (
          <View style={styles.activePromoBox}>
            <View style={styles.promoStatusBadge}>
              <Check size={14} color="#059669" />
              <Text style={styles.promoStatusText}>Active Promotion</Text>
            </View>
            <Text style={styles.promoInfoText}>
              Name: <Text style={styles.promoInfoValue}>{promotion.promoName || 'Sign-up Promotion'}</Text>
            </Text>
            <Text style={styles.promoInfoText}>
              Period: <Text style={styles.promoInfoValue}>{promotion.startDate} to {promotion.endDate}</Text>
            </Text>
            <Text style={styles.promoInfoText}>
              Bonus Statements: <Text style={styles.promoInfoValue}>{promotion.freeStatements}</Text>
            </Text>
            <TouchableOpacity 
              style={[styles.clearPromoButton, isSavingPromo && { opacity: 0.5 }]}
              onPress={handleClearPromotion}
              disabled={isSavingPromo}
            >
              <Trash2 size={14} color="#DC2626" />
              <Text style={styles.clearPromoText}>Clear Promotion</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noPromoBox}>
            <Text style={styles.noPromoText}>No active promotion configured.</Text>
          </View>
        )}

        <View style={styles.promoFormContainer}>
          <Text style={styles.promoFormTitle}>
            {promotion ? 'Update Promotion' : 'Create New Promotion'}
          </Text>

          <Text style={styles.label}>Promotion Name</Text>
          <TextInput
            style={styles.input}
            value={promoForm.promoName}
            onChangeText={(text) => setPromoForm({ ...promoForm, promoName: text })}
            placeholder="e.g., New Year Special"
            placeholderTextColor="#9CA3AF"
          />

          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.label}>Start Date *</Text>
              {Platform.OS === 'web' ? (
                // @ts-ignore - web-only date input
                <input
                  type="date"
                  value={promoForm.startDate}
                  onChange={(e) => setPromoForm({ ...promoForm, startDate: e.target.value })}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                    backgroundColor: '#F9FAFB',
                    fontSize: 14,
                    width: '100%'
                  }}
                />
              ) : (
                <TextInput
                  style={styles.input}
                  value={promoForm.startDate}
                  onChangeText={(text) => setPromoForm({ ...promoForm, startDate: text })}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                />
              )}
            </View>
            
            <View style={styles.dateField}>
              <Text style={styles.label}>End Date *</Text>
              {Platform.OS === 'web' ? (
                // @ts-ignore - web-only date input
                <input
                  type="date"
                  value={promoForm.endDate}
                  onChange={(e) => setPromoForm({ ...promoForm, endDate: e.target.value })}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                    backgroundColor: '#F9FAFB',
                    fontSize: 14,
                    width: '100%'
                  }}
                />
              ) : (
                <TextInput
                  style={styles.input}
                  value={promoForm.endDate}
                  onChangeText={(text) => setPromoForm({ ...promoForm, endDate: text })}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                />
              )}
            </View>
          </View>

          <Text style={styles.label}>Bonus Statements for New Sign-ups *</Text>
          <TextInput
            style={styles.input}
            value={promoForm.freeStatements}
            onChangeText={(text) => setPromoForm({ ...promoForm, freeStatements: text })}
            placeholder="e.g., 10"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
          />

          <TouchableOpacity
            style={[styles.savePromoButton, isSavingPromo && { opacity: 0.5 }]}
            onPress={handleSavePromotion}
            disabled={isSavingPromo}
          >
            {isSavingPromo ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Check size={16} color="#fff" />
                <Text style={styles.savePromoText}>Save Promotion</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
  previewCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
  },
  previewToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  previewToggleActive: {
    backgroundColor: '#F59E0B',
  },
  previewToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  previewToggleTextActive: {
    color: '#FFFFFF',
  },
  previewDescription: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
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
  uploadButtonDragging: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
    borderWidth: 3,
  },
  uploadButtonInner: {
    alignItems: 'center',
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 8,
  },
  uploadButtonTextDragging: {
    color: '#fff',
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
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    marginTop: 16,
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
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
  // Promotion styles
  activePromoBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  promoStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  promoStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  promoInfoText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  promoInfoValue: {
    fontWeight: '600',
  },
  clearPromoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  clearPromoText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#DC2626',
  },
  noPromoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  noPromoText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  promoFormContainer: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  promoFormTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  dateField: {
    flex: 1,
  },
  savePromoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 12,
  },
  savePromoText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});

export default AdManagerTab;
