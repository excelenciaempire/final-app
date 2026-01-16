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
  EyeOff,
  Clock,
  Settings
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

interface AdSettings {
  rotation_interval: number; // in seconds
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Crop interaction modes
type CropMode = 'none' | 'drawing' | 'moving' | 'resizing';
type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 'none';

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
  
  // Interactive crop state
  const [cropMode, setCropMode] = useState<CropMode>('none');
  const [activeHandle, setActiveHandle] = useState<ResizeHandle>('none');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialCrop, setInitialCrop] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const cropContainerRef = useRef<View>(null);
  const [containerOffset, setContainerOffset] = useState({ x: 0, y: 0 });

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

  // Ad settings state
  const [adSettings, setAdSettings] = useState<AdSettings>({ rotation_interval: 10 });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

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
    fetchAdSettings();
  }, []); // Only run once on mount

  // Fetch ad settings
  const fetchAdSettings = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/api/admin/ads/settings`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });

      if (response.data.settings) {
        setAdSettings(response.data.settings);
      }
    } catch (error) {
      console.log('No ad settings found, using defaults');
    }
  };

  // Save ad settings
  const handleSaveAdSettings = async () => {
    setIsSavingSettings(true);
    try {
      const token = await getToken();
      if (!token) return;

      await axios.post(`${BASE_URL}/api/admin/ads/settings`, {
        rotation_interval: adSettings.rotation_interval
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });

      if (Platform.OS === 'web') {
        alert('Ad settings saved successfully!');
      } else {
        Alert.alert('Success', 'Ad settings saved successfully!');
      }
    } catch (error: any) {
      console.error('Error saving ad settings:', error);
      const errorMsg = error.response?.data?.message || 'Failed to save settings';
      if (Platform.OS === 'web') {
        alert('Error: ' + errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setIsSavingSettings(false);
    }
  };

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

  // Clear/Delete promotion
  const handleClearPromotion = async (promoId?: number) => {
    const doClear = async () => {
      setIsSavingPromo(true);
      try {
        const token = await getToken();
        if (!token) return;

        await axios.post(`${BASE_URL}/api/admin/promotions/clear`, {
          promoId: promoId || promotion?.id
        }, {
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
          alert('Promotion deleted successfully.');
        } else {
          Alert.alert('Success', 'Promotion deleted');
        }
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || 'Failed to delete promotion';
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
      if (window.confirm('Are you sure you want to delete this promotion? New sign-ups will no longer receive bonus statements.')) {
        doClear();
      }
    } else {
      Alert.alert('Delete Promotion', 'Are you sure you want to delete this promotion?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doClear }
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
        const maxDisplayWidth = Math.min(SCREEN_WIDTH - 60, 600);
        const maxDisplayHeight = 400;
        const scaleByWidth = maxDisplayWidth / imgWidth;
        const scaleByHeight = maxDisplayHeight / imgHeight;
        const displayScale = Math.min(scaleByWidth, scaleByHeight);
        const displayWidth = imgWidth * displayScale;
        const displayHeight = imgHeight * displayScale;
        setDisplaySize({ width: displayWidth, height: displayHeight });
        
        // Initialize with no selection - user will draw it
        setCropArea({ x: 0, y: 0, width: 0, height: 0 });
        setCropMode('none');
        
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
    
    const maxDisplayWidth = Math.min(SCREEN_WIDTH - 60, 600);
    const maxDisplayHeight = 400;
    const scaleByWidth = maxDisplayWidth / width;
    const scaleByHeight = maxDisplayHeight / height;
    const displayScale = Math.min(scaleByWidth, scaleByHeight);
    const displayWidth = width * displayScale;
    const displayHeight = height * displayScale;
    setDisplaySize({ width: displayWidth, height: displayHeight });
    
    // Initialize with no selection - user will draw it
    setCropArea({ x: 0, y: 0, width: 0, height: 0 });
    setCropMode('none');
    
    setShowCropModal(true);
  };

  // Convert display coordinates to image coordinates
  const displayToImageCoords = (displayX: number, displayY: number) => {
    const scale = imageSize.width / displaySize.width;
    return {
      x: displayX * scale,
      y: displayY * scale
    };
  };

  // Convert image coordinates to display coordinates
  const imageToDisplayCoords = (imgX: number, imgY: number) => {
    const scale = displaySize.width / imageSize.width;
    return {
      x: imgX * scale,
      y: imgY * scale
    };
  };

  // Get mouse position relative to crop container
  const getRelativePosition = (event: any) => {
    if (Platform.OS === 'web') {
      const rect = event.currentTarget?.getBoundingClientRect?.();
      if (rect) {
        return {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        };
      }
      return { x: event.nativeEvent?.offsetX || 0, y: event.nativeEvent?.offsetY || 0 };
    }
    return { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
  };

  // Check if point is inside crop area
  const isInsideCrop = (x: number, y: number) => {
    const displayCrop = imageToDisplayCoords(cropArea.x, cropArea.y);
    const displayCropSize = imageToDisplayCoords(cropArea.width, cropArea.height);
    return (
      x >= displayCrop.x &&
      x <= displayCrop.x + displayCropSize.x &&
      y >= displayCrop.y &&
      y <= displayCrop.y + displayCropSize.y
    );
  };

  // Check which resize handle is at position
  const getHandleAtPosition = (x: number, y: number): ResizeHandle => {
    const handleSize = 20;
    const displayCrop = imageToDisplayCoords(cropArea.x, cropArea.y);
    const displayCropSize = imageToDisplayCoords(cropArea.width, cropArea.height);
    
    const left = displayCrop.x;
    const top = displayCrop.y;
    const right = left + displayCropSize.x;
    const bottom = top + displayCropSize.y;

    // Top-left
    if (x >= left - handleSize && x <= left + handleSize && y >= top - handleSize && y <= top + handleSize) return 'tl';
    // Top-right
    if (x >= right - handleSize && x <= right + handleSize && y >= top - handleSize && y <= top + handleSize) return 'tr';
    // Bottom-left
    if (x >= left - handleSize && x <= left + handleSize && y >= bottom - handleSize && y <= bottom + handleSize) return 'bl';
    // Bottom-right
    if (x >= right - handleSize && x <= right + handleSize && y >= bottom - handleSize && y <= bottom + handleSize) return 'br';
    
    return 'none';
  };

  // Mouse/touch handlers for crop interaction
  const handleCropMouseDown = (event: any) => {
    const pos = getRelativePosition(event);
    
    // Check if clicking on a resize handle
    const handle = getHandleAtPosition(pos.x, pos.y);
    if (handle !== 'none' && cropArea.width > 0) {
      setCropMode('resizing');
      setActiveHandle(handle);
      setDragStart(pos);
      setInitialCrop({ ...cropArea });
      return;
    }
    
    // Check if clicking inside existing crop (to move it)
    if (cropArea.width > 0 && isInsideCrop(pos.x, pos.y)) {
      setCropMode('moving');
      setDragStart(pos);
      setInitialCrop({ ...cropArea });
      return;
    }
    
    // Otherwise, start drawing new crop
    const imgCoords = displayToImageCoords(pos.x, pos.y);
    setCropMode('drawing');
    setDragStart(pos);
    setCropArea({ x: imgCoords.x, y: imgCoords.y, width: 0, height: 0 });
  };

  const handleCropMouseMove = (event: any) => {
    if (cropMode === 'none') return;
    
    const pos = getRelativePosition(event);
    const scale = imageSize.width / displaySize.width;
    
    if (cropMode === 'drawing') {
      const startImgCoords = displayToImageCoords(dragStart.x, dragStart.y);
      const currentImgCoords = displayToImageCoords(pos.x, pos.y);
      
      const x = Math.min(startImgCoords.x, currentImgCoords.x);
      const y = Math.min(startImgCoords.y, currentImgCoords.y);
      const width = Math.abs(currentImgCoords.x - startImgCoords.x);
      const height = Math.abs(currentImgCoords.y - startImgCoords.y);
      
      // Clamp to image bounds
      setCropArea({
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: Math.min(width, imageSize.width - x),
        height: Math.min(height, imageSize.height - y)
      });
    } else if (cropMode === 'moving') {
      const deltaX = (pos.x - dragStart.x) * scale;
      const deltaY = (pos.y - dragStart.y) * scale;
      
      let newX = initialCrop.x + deltaX;
      let newY = initialCrop.y + deltaY;
      
      // Clamp to bounds
      newX = Math.max(0, Math.min(newX, imageSize.width - initialCrop.width));
      newY = Math.max(0, Math.min(newY, imageSize.height - initialCrop.height));
      
      setCropArea({ ...initialCrop, x: newX, y: newY });
    } else if (cropMode === 'resizing') {
      const deltaX = (pos.x - dragStart.x) * scale;
      const deltaY = (pos.y - dragStart.y) * scale;
      
      let newCrop = { ...initialCrop };
      
      switch (activeHandle) {
        case 'tl':
          newCrop.x = Math.max(0, initialCrop.x + deltaX);
          newCrop.y = Math.max(0, initialCrop.y + deltaY);
          newCrop.width = initialCrop.width - (newCrop.x - initialCrop.x);
          newCrop.height = initialCrop.height - (newCrop.y - initialCrop.y);
          break;
        case 'tr':
          newCrop.y = Math.max(0, initialCrop.y + deltaY);
          newCrop.width = Math.min(initialCrop.width + deltaX, imageSize.width - initialCrop.x);
          newCrop.height = initialCrop.height - (newCrop.y - initialCrop.y);
          break;
        case 'bl':
          newCrop.x = Math.max(0, initialCrop.x + deltaX);
          newCrop.width = initialCrop.width - (newCrop.x - initialCrop.x);
          newCrop.height = Math.min(initialCrop.height + deltaY, imageSize.height - initialCrop.y);
          break;
        case 'br':
          newCrop.width = Math.min(initialCrop.width + deltaX, imageSize.width - initialCrop.x);
          newCrop.height = Math.min(initialCrop.height + deltaY, imageSize.height - initialCrop.y);
          break;
      }
      
      // Ensure minimum size
      if (newCrop.width >= 50 && newCrop.height >= 30) {
        setCropArea(newCrop);
      }
    }
  };

  const handleCropMouseUp = () => {
    setCropMode('none');
    setActiveHandle('none');
  };

  // Select entire image
  const selectEntireImage = () => {
    setCropArea({ x: 0, y: 0, width: imageSize.width, height: imageSize.height });
  };

  // Clear selection
  const clearSelection = () => {
    setCropArea({ x: 0, y: 0, width: 0, height: 0 });
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
      if (Platform.OS === 'web') {
        alert('Please upload an ad image');
      } else {
        Alert.alert('Error', 'Please upload an ad image');
      }
      return;
    }
    if (!newAd.destinationUrl.trim()) {
      if (Platform.OS === 'web') {
        alert('Destination URL is required');
      } else {
        Alert.alert('Error', 'Destination URL is required');
      }
      return;
    }

    // Normalize URL - add https:// if not present
    let urlToUse = newAd.destinationUrl.trim();
    if (!urlToUse.startsWith('http://') && !urlToUse.startsWith('https://')) {
      urlToUse = 'https://' + urlToUse;
    }

    try {
      setIsSaving(true);
      const token = await getToken();
      if (!token) {
        if (Platform.OS === 'web') {
          alert('Authentication required');
        } else {
          Alert.alert('Error', 'Authentication required');
        }
        return;
      }

      const adTitle = newAd.title.trim() || 'Ad';
      const adSubtitle = newAd.subtitle.trim() || '';

      console.log('[AdManager] Creating ad with:', { 
        title: adTitle, 
        subtitle: adSubtitle,
        destination_url: urlToUse, 
        image_url: imageUrlToUse 
      });

      const response = await axios.post(`${BASE_URL}/api/admin/ads`, {
        title: adTitle,
        subtitle: adSubtitle,
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
      
      if (Platform.OS === 'web') {
        alert('Ad created successfully!');
      } else {
        Alert.alert('Success', 'Ad created successfully');
      }
    } catch (error: any) {
      console.error('[AdManager] Error creating ad:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create ad';
      if (Platform.OS === 'web') {
        alert('Error: ' + errorMessage);
      } else {
        Alert.alert('Error', errorMessage);
      }
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

        if (Platform.OS === 'web') {
          alert('Ad deleted successfully');
        } else {
          Alert.alert('Success', 'Ad deleted successfully');
        }
        fetchAds();
      } catch (error: any) {
        if (Platform.OS === 'web') {
          alert('Error: Failed to delete ad');
        } else {
          Alert.alert('Error', 'Failed to delete ad');
        }
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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading ads...</Text>
      </View>
    );
  }

  // Calculate crop overlay position for display
  const cropDisplayX = imageSize.width > 0 ? (cropArea.x / imageSize.width) * displaySize.width : 0;
  const cropDisplayY = imageSize.height > 0 ? (cropArea.y / imageSize.height) * displaySize.height : 0;
  const cropDisplayWidth = imageSize.width > 0 ? (cropArea.width / imageSize.width) * displaySize.width : 0;
  const cropDisplayHeight = imageSize.height > 0 ? (cropArea.height / imageSize.height) * displaySize.height : 0;
  const hasSelection = cropArea.width > 0 && cropArea.height > 0;

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

      {/* Ad Rotation Settings */}
      <View style={styles.settingsCard}>
        <View style={styles.settingsHeader}>
          <View style={styles.settingsTitleRow}>
            <Clock size={18} color={COLORS.primary} />
            <Text style={styles.settingsTitle}>Ad Rotation</Text>
          </View>
          <TouchableOpacity
            style={[styles.saveSettingsButtonSmall, isSavingSettings && { opacity: 0.5 }]}
            onPress={handleSaveAdSettings}
            disabled={isSavingSettings}
          >
            {isSavingSettings ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveSettingsTextSmall}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.rotationSettingRow}>
          <Text style={styles.rotationLabel}>Rotate ads every</Text>
          <View style={styles.rotationInputRow}>
            <TouchableOpacity 
              style={styles.rotationButton}
              onPress={() => setAdSettings({ ...adSettings, rotation_interval: Math.max(1, adSettings.rotation_interval - 1) })}
            >
              <Text style={styles.rotationButtonText}>−</Text>
            </TouchableOpacity>
            {Platform.OS === 'web' ? (
              // @ts-ignore - web-only input
              <input
                type="number"
                min="1"
                max="120"
                value={adSettings.rotation_interval}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= 120) {
                    setAdSettings({ ...adSettings, rotation_interval: val });
                  }
                }}
                style={{
                  width: 60,
                  textAlign: 'center',
                  fontSize: 18,
                  fontWeight: '700',
                  color: COLORS.primary,
                  border: '1px solid #E5E7EB',
                  borderRadius: 8,
                  padding: '8px 4px',
                  backgroundColor: '#F9FAFB',
                }}
              />
            ) : (
              <TextInput
                style={styles.rotationInput}
                value={String(adSettings.rotation_interval)}
                onChangeText={(text) => {
                  const val = parseInt(text, 10);
                  if (!isNaN(val) && val >= 1 && val <= 120) {
                    setAdSettings({ ...adSettings, rotation_interval: val });
                  }
                }}
                keyboardType="numeric"
                maxLength={3}
              />
            )}
            <TouchableOpacity 
              style={styles.rotationButton}
              onPress={() => setAdSettings({ ...adSettings, rotation_interval: Math.min(120, adSettings.rotation_interval + 1) })}
            >
              <Text style={styles.rotationButtonText}>+</Text>
            </TouchableOpacity>
            <Text style={styles.rotationUnit}>seconds</Text>
          </View>
        </View>
        <Text style={styles.rotationHint}>Min: 1s • Max: 120s</Text>
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
          value={newAd.destinationUrl}
          onChangeText={(text) => setNewAd({ ...newAd, destinationUrl: text })}
          autoCapitalize="none"
          keyboardType="url"
        />

        {/* Optional Title & Description */}
        <View style={styles.optionalSection}>
          <Text style={styles.optionalLabel}>✨ Optional: Add text overlay</Text>
          <Text style={styles.optionalHint}>
            Add a catchy title and description that will appear on the ad banner
          </Text>
          
          <View style={styles.optionalInputGroup}>
            <Text style={styles.smallLabel}>Ad Title</Text>
            <TextInput
              style={[styles.input, styles.optionalInput]}
              value={newAd.title}
              onChangeText={(text) => setNewAd({ ...newAd, title: text })}
              maxLength={40}
            />
            <Text style={styles.charCount}>{newAd.title.length}/40</Text>
          </View>

          <View style={styles.optionalInputGroup}>
            <Text style={styles.smallLabel}>Ad Description</Text>
            <TextInput
              style={[styles.input, styles.optionalInput, styles.textArea]}
              value={newAd.subtitle}
              onChangeText={(text) => setNewAd({ ...newAd, subtitle: text })}
              maxLength={100}
              multiline
              numberOfLines={2}
            />
            <Text style={styles.charCount}>{newAd.subtitle.length}/100</Text>
          </View>
        </View>

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
            <View style={styles.promoHeader}>
              <View style={styles.promoStatusBadge}>
                <Check size={14} color="#059669" />
                <Text style={styles.promoStatusText}>Active Promotion</Text>
              </View>
              <TouchableOpacity 
                style={[styles.deletePromoButton, isSavingPromo && { opacity: 0.5 }]}
                onPress={() => handleClearPromotion(promotion.id)}
                disabled={isSavingPromo}
              >
                <Trash2 size={16} color="#DC2626" />
              </TouchableOpacity>
            </View>
            <View style={styles.promoDetails}>
              <Text style={styles.promoInfoText}>
                <Text style={styles.promoLabel}>Name: </Text>
                <Text style={styles.promoInfoValue}>{promotion.promoName || 'Sign-up Promotion'}</Text>
              </Text>
              <Text style={styles.promoInfoText}>
                <Text style={styles.promoLabel}>Start: </Text>
                <Text style={styles.promoInfoValue}>{promotion.startDate}</Text>
              </Text>
              <Text style={styles.promoInfoText}>
                <Text style={styles.promoLabel}>End: </Text>
                <Text style={styles.promoInfoValue}>{promotion.endDate}</Text>
              </Text>
              <Text style={styles.promoInfoText}>
                <Text style={styles.promoLabel}>Bonus: </Text>
                <Text style={styles.promoInfoValue}>{promotion.freeStatements} statements</Text>
              </Text>
            </View>
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
              <View>
                <Text style={styles.cropModalTitle}>Crop Ad Image</Text>
                <Text style={styles.cropModalSubtitle}>
                  {hasSelection 
                    ? '✓ Drag to move, use corners to resize'
                    : 'Click and drag to select the area'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowCropModal(false)} style={styles.cropModalClose}>
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.cropModalContent} showsVerticalScrollIndicator={false}>
              {/* Image Container with Crop Overlay */}
              <View style={styles.cropImageWrapper}>
                <View style={styles.cropImageContainer}>
                  {originalImage && (
                    <View 
                      style={[styles.cropInteractiveArea, { width: displaySize.width, height: displaySize.height }]}
                      // @ts-ignore - web events
                      onMouseDown={Platform.OS === 'web' ? handleCropMouseDown : undefined}
                      onMouseMove={Platform.OS === 'web' ? handleCropMouseMove : undefined}
                      onMouseUp={Platform.OS === 'web' ? handleCropMouseUp : undefined}
                      onMouseLeave={Platform.OS === 'web' ? handleCropMouseUp : undefined}
                      onTouchStart={Platform.OS !== 'web' ? handleCropMouseDown : undefined}
                      onTouchMove={Platform.OS !== 'web' ? handleCropMouseMove : undefined}
                      onTouchEnd={Platform.OS !== 'web' ? handleCropMouseUp : undefined}
                    >
                      <Image 
                        source={{ uri: originalImage }} 
                        style={{ width: displaySize.width, height: displaySize.height }}
                        resizeMode="contain"
                      />
                      
                      {/* Dark overlay for non-selected areas */}
                      {hasSelection && (
                        <View style={[styles.cropOverlay, { width: displaySize.width, height: displaySize.height }]} pointerEvents="none">
                          {/* Top dark area */}
                          <View style={[styles.cropDark, { 
                            top: 0, left: 0, right: 0, 
                            height: cropDisplayY 
                          }]} />
                          {/* Bottom dark area */}
                          <View style={[styles.cropDark, { 
                            top: cropDisplayY + cropDisplayHeight, 
                            left: 0, right: 0, bottom: 0 
                          }]} />
                          {/* Left dark area */}
                          <View style={[styles.cropDark, { 
                            top: cropDisplayY, left: 0, 
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
                          
                          {/* Crop frame with handles */}
                          <View style={[styles.cropFrame, {
                            top: cropDisplayY,
                            left: cropDisplayX,
                            width: cropDisplayWidth,
                            height: cropDisplayHeight
                          }]}>
                            {/* Corner handles */}
                            <View style={[styles.cropHandle, styles.handleTL]} />
                            <View style={[styles.cropHandle, styles.handleTR]} />
                            <View style={[styles.cropHandle, styles.handleBL]} />
                            <View style={[styles.cropHandle, styles.handleBR]} />
                            
                            {/* Center move icon */}
                            <View style={styles.cropMoveHint}>
                              <Move size={20} color="rgba(255,255,255,0.8)" />
                            </View>
                          </View>
                        </View>
                      )}
                      
                      {/* Drawing hint when no selection */}
                      {!hasSelection && (
                        <View style={[styles.cropDrawHint, { width: displaySize.width, height: displaySize.height }]} pointerEvents="none">
                          <Text style={styles.cropDrawHintText}>Click & Drag to Select</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>

              {/* Real-time Live Preview - Shows exactly what will appear as ad */}
              <View style={styles.livePreviewSection}>
                <Text style={styles.livePreviewLabel}>📱 Live Ad Preview</Text>
                <View style={styles.livePreviewCard}>
                  <View style={styles.livePreviewAdContainer}>
                    {hasSelection && originalImage ? (
                      <View style={styles.livePreviewCroppedImage}>
                        {/* Show exactly the cropped area - matching ad banner dimensions */}
                        <View style={styles.livePreviewImageWrapper}>
                          <Image 
                            source={{ uri: originalImage }} 
                            style={{
                              width: (displaySize.width / cropDisplayWidth) * 400,
                              height: (displaySize.height / cropDisplayHeight) * 130,
                              marginLeft: -(cropDisplayX / cropDisplayWidth) * 400,
                              marginTop: -(cropDisplayY / cropDisplayHeight) * 130,
                            }}
                            resizeMode="cover"
                          />
                        </View>
                        {/* Text overlay matching AdBanner style */}
                        {(newAd.title || newAd.subtitle) && (
                          <View style={styles.livePreviewTextOverlay}>
                            {newAd.title && <Text style={styles.livePreviewTitle}>{newAd.title}</Text>}
                            {newAd.subtitle && <Text style={styles.livePreviewSubtitle}>{newAd.subtitle}</Text>}
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={styles.livePreviewPlaceholder}>
                        <Text style={styles.livePreviewPlaceholderText}>
                          Select an area to see preview
                        </Text>
                      </View>
                    )}
                  </View>
                  {hasSelection && (
                    <Text style={styles.livePreviewHint}>
                      Selection: {Math.round(cropArea.width)} × {Math.round(cropArea.height)}px
                    </Text>
                  )}
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions - Separated from preview */}
            <View style={styles.cropModalActionsContainer}>
              <View style={styles.cropModalActions}>
              <TouchableOpacity 
                style={styles.cancelCropButton}
                onPress={() => {
                  setShowCropModal(false);
                  setOriginalImage(null);
                  setCropArea({ x: 0, y: 0, width: 0, height: 0 });
                }}
              >
                <Text style={styles.cancelCropText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.applyCropButton, (!hasSelection || isUploading) && styles.buttonDisabled]}
                onPress={uploadCroppedImage}
                disabled={!hasSelection || isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Check size={18} color="#fff" />
                    <Text style={styles.applyCropText}>{hasSelection ? 'Apply & Upload' : 'Select an area first'}</Text>
                  </>
                )}
              </TouchableOpacity>
              </View>
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
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E3A5F',
  },
  rotationSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rotationLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  rotationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rotationButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rotationButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  rotationInput: {
    width: 60,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: '#F9FAFB',
  },
  rotationUnit: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  rotationHint: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 8,
  },
  saveSettingsButtonSmall: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveSettingsTextSmall: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
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
  optionalSection: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderStyle: 'dashed',
  },
  optionalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369A1',
    marginBottom: 4,
  },
  optionalHint: {
    fontSize: 12,
    color: '#0284C7',
    marginBottom: 12,
    opacity: 0.8,
  },
  optionalInputGroup: {
    marginBottom: 12,
  },
  smallLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  optionalInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#7DD3FC',
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  charCount: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'right',
    marginTop: 4,
    opacity: 0.7,
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
    maxWidth: 640,
    maxHeight: '95%',
  },
  cropModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cropModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E3A5F',
  },
  cropModalSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  cropModalClose: {
    padding: 4,
  },
  cropModalContent: {
    flex: 1,
  },
  cropImageWrapper: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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
  cropInteractiveArea: {
    position: 'relative',
    cursor: 'crosshair',
  },
  cropFrame: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#3B82F6',
    backgroundColor: 'transparent',
    borderStyle: 'solid',
  },
  cropHandle: {
    position: 'absolute',
    width: 14,
    height: 14,
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 2,
  },
  handleTL: {
    top: -7,
    left: -7,
    cursor: 'nwse-resize',
  },
  handleTR: {
    top: -7,
    right: -7,
    cursor: 'nesw-resize',
  },
  handleBL: {
    bottom: -7,
    left: -7,
    cursor: 'nesw-resize',
  },
  handleBR: {
    bottom: -7,
    right: -7,
    cursor: 'nwse-resize',
  },
  cropMoveHint: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -10 }, { translateY: -10 }],
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    padding: 5,
  },
  cropDrawHint: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  cropDrawHintText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  livePreviewSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  livePreviewLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  livePreviewCard: {
    alignItems: 'center',
  },
  livePreviewAdContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  livePreviewCroppedImage: {
    width: '100%',
    height: 130, // Match AdBanner height
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E5E7EB',
  },
  livePreviewImageWrapper: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  livePreviewTextOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  livePreviewPlaceholder: {
    height: 130,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  livePreviewPlaceholderText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  livePreviewTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  livePreviewSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  livePreviewHint: {
    marginTop: 10,
    fontSize: 11,
    color: COLORS.textSecondary,
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
  cropModalActionsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
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
  promoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  promoDetails: {
    gap: 6,
  },
  promoLabel: {
    fontWeight: '500',
    color: '#6B7280',
  },
  deletePromoButton: {
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
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
    gap: 20,
    marginBottom: 12,
  },
  dateField: {
    flex: 1,
    marginHorizontal: 4,
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
