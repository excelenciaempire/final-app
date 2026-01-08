import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, Button, Image, TextInput, StyleSheet, Alert, ScrollView, ActivityIndicator, TouchableOpacity, Platform, Dimensions, Modal, KeyboardAvoidingView, useWindowDimensions, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth, useUser } from "@clerk/clerk-expo";
import axios from 'axios';
import { ImagePlus, Send, BotMessageSquare, RefreshCcw, Mic, MicOff, Check, Edit3, Camera } from 'lucide-react-native';
import DdidModal from '../../src/components/DdidModal';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { BASE_URL } from '../../src/config/api'; // Import centralized BASE_URL
import { COLORS } from '../../src/styles/colors'; // Corrected import path
import * as Clipboard from 'expo-clipboard'; // Corrected import
import { useGlobalState } from '../../src/context/GlobalStateContext';
import { useSubscription } from '../../src/context/SubscriptionContext';
import AdBanner from '../../src/components/AdBanner';
import SopAlignmentCard from '../../src/components/SopAlignmentCard';
import StatementUsageCard from '../../src/components/StatementUsageCard';
import LastStatementCard from '../../src/components/LastStatementCard';
import ToolsAndCommunityCard from '../../src/components/ToolsAndCommunityCard';

// --- API Response Interfaces ---
interface UploadImageResponse {
  imageUrl: string;
}
interface GeneratePreDescriptionResponse {
  preDescription: string;
}
interface GenerateDdidResponse {
  ddid: string;
}
interface GenerateStatementResponse {
  statement: string;
  sopUsed: boolean;
  state: string;
  organization: string | null;
}
interface TranscribeAudioResponse {
  transcript: string;
}
interface ApiError {
  message: string;
}

// --- Define Base URL (Platform Specific) ---
// const YOUR_COMPUTER_IP_ADDRESS = '<YOUR-COMPUTER-IP-ADDRESS>'; // Removed
// const YOUR_BACKEND_PORT = '<PORT>'; // Removed
// const API_BASE_URL = Platform.select({...}); // Removed Old Logic

// const BASE_URL = Platform.select({...}); // <<< REMOVE THIS BLOCK >>>
// --- End Base URL Definition ---

const { width } = Dimensions.get('window'); // Get screen width
// const imageSize = width * 0.9; // Keep this if still needed for native

// --- New Component: PreDescriptionModal ---
interface PreDescriptionModalProps {
  visible: boolean;
  onClose: () => void;
  preDescription: string;
  onGenerateDdid: (finalDescription: string) => void;
}

const PreDescriptionModal: React.FC<PreDescriptionModalProps> = ({
  visible,
  onClose,
  preDescription,
  onGenerateDdid,
}: PreDescriptionModalProps) => {
  const [editableDescription, setEditableDescription] = useState(preDescription);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    // When the modal becomes visible or the initial description changes,
    // reset the editable content and exit editing mode.
    setEditableDescription(preDescription);
    setIsEditing(false); // Default to non-editing mode
  }, [preDescription, visible]);

  const handleSaveEdit = () => {
    setIsEditing(false);
  };

  const handleGenerate = () => {
    // Pass the potentially edited description to the final generation step
    onGenerateDdid(editableDescription);
  };

  const instructions = `**✅ If yes, click "Generate Statement" and I will take care of the rest.**

✍️ **Need to make a change? Click Edit. (It helps me learn)**

🔄 **To regenerate with more context, click Close, Add details, and click Analyze.**`;

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.popupOverlay}>
        <View style={styles.popupContainer}>
          <Text style={styles.popupTitle}>Preliminary Description</Text>

          {/* Scrollable Content Area */}
          <ScrollView
            style={styles.preDescScrollView}
            contentContainerStyle={styles.preDescScrollViewContent}
          >
            {isEditing ? (
            <TextInput
                style={[styles.preDescInput, styles.preDescInputEditing]}
              value={editableDescription}
              onChangeText={setEditableDescription}
              multiline
                editable={true}
                autoFocus={true} // Focus the input when editing
              />
            ) : (
              <View>
                {/* Generated Description */}
                <Text style={styles.preDescText}>
                  {editableDescription}
                </Text>

                {/* Instructions Text (Markdown-like formatting) */}
                <View style={styles.instructionsContainer}>
                   <Text style={styles.instructionText}>
                    <Text style={{fontWeight: 'bold'}}>✅ If yes, click "Generate Statement" and I will take care of the rest.</Text>
                   </Text>
                   <Text style={styles.instructionText}>
                    <Text style={{fontWeight: 'bold'}}>✍️ Need to make a change? Click Edit. (It helps me learn)</Text>
                   </Text>
                   <Text style={styles.instructionText}>
                    <Text style={{fontWeight: 'bold'}}>🔄 To regenerate with more context, click Close, Add details, and click Analyze.</Text>
                   </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Fixed Bottom Buttons */}
          <View style={styles.preDescButtonRow}>
            {!isEditing ? (
              <TouchableOpacity
                style={[styles.preDescButton, styles.editButton]}
                onPress={() => setIsEditing(true)}
              >
                <Edit3 size={18} color={COLORS.primary} />
                <Text style={[styles.preDescButtonText, styles.editButtonText]}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.preDescButton, styles.saveButton]}
                onPress={handleSaveEdit}
              >
                <Check size={18} color={COLORS.white} />
                <Text style={[styles.preDescButtonText, styles.saveButtonText]}>Save Edit</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.preDescButton,
                styles.generateButton,
                isEditing && styles.buttonDisabled, // Disable button when editing
              ]}
              onPress={handleGenerate}
              disabled={isEditing}
            >
              <Text
                style={[
                  styles.preDescButtonText,
                  styles.generateButtonText,
                  isEditing && styles.buttonDisabledText,
                ]}
              >
                Generate Statement
              </Text>
            </TouchableOpacity>
          </View>

          {/* Close Button at the very bottom */}
          <TouchableOpacity style={styles.plainCloseButton} onPress={onClose}>
            <Text style={styles.plainCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
// --- End PreDescriptionModal ---

// Revert to standard function declaration
export default function NewInspectionScreen() {
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [initialDescription, setInitialDescription] = useState<string>('');
    const [generatedDdid, setGeneratedDdid] = useState<string | null>(null);
    const [showDdidModal, setShowDdidModal] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
    const { getToken } = useAuth();
    const { user } = useUser();
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const { width } = useWindowDimensions(); // Get width for responsive logic
    const isWebLarge = Platform.OS === 'web' && width > 768; // Define isWebLarge

    // --- New States ---
    const [preDescription, setPreDescription] = useState<string>('');
    const [finalDescriptionForDdid, setFinalDescriptionForDdid] = useState<string>('');
    const [showPreDescriptionModal, setShowPreDescriptionModal] = useState<boolean>(false);
    const [isGeneratingPreDescription, setIsGeneratingPreDescription] = useState<boolean>(false);
    const [isGeneratingFinalDdid, setIsGeneratingFinalDdid] = useState<boolean>(false);
    const [cloudinaryUrl, setCloudinaryUrl] = useState<string | null>(null);
    
    // --- Image dimensions state ---
    const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

    // --- Use Global State Context for selected state and organization ---
    const { selectedState, selectedOrganization, isContentStale, clearStaleFlag } = useGlobalState();
    const { subscription, canGenerateStatement } = useSubscription();
    const userState = selectedState || user?.unsafeMetadata?.inspectionState as string || 'NC';
    const userOrganization = selectedOrganization || user?.unsafeMetadata?.organization as string || 'None';
    // --- End global state usage ---

    // --- Refactored Image Picking Logic ---
    const requestPermissions = async (): Promise<boolean> => {
        if (Platform.OS !== 'web') {
            const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
            const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (cameraPermission.status !== 'granted' || libraryPermission.status !== 'granted') {
                Alert.alert('Permission required', 'Camera and Media Library permissions are needed.');
                return false;
            }
        }
        // Web doesn't require explicit permissions via this API for library access
        return true;
    };

    const launchCamera = async () => {
        const hasPermission = await requestPermissions();
        if (!hasPermission) return;

        try {
            let result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
                base64: true,
            });
            handleImageResult(result);
        } catch (error) {
            handleImageError(error);
        }
    };

    const launchLibrary = async () => {
        // On native, ensure permissions are granted before launching library
        // On web, permissions are not needed for library access here
        if (Platform.OS !== 'web') {
             const hasPermission = await requestPermissions();
             if (!hasPermission) return;
        }

        try {
            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
                base64: true,
            });
            handleImageResult(result);
        } catch (error) {
            handleImageError(error);
        }
    };

    // --- NEW: Function to let user choose image source on native ---
    const selectImageSource = async () => {
        // Permissions are requested inside launchCamera/launchLibrary already if needed for native
        Alert.alert(
            "Select Image Source",
            "Choose an option to select your image:",
            [
                {
                    text: "Take Photo",
                    onPress: launchCamera // Call launchCamera
                },
                {
                    text: "Choose from Library",
                    onPress: launchLibrary // Call launchLibrary
                },
                {
                    text: "Cancel",
                    style: "cancel"
                }
            ]
        );
    };

    // Helper function to handle result from either picker or drag/drop
    const handleImageResult = (result: ImagePicker.ImagePickerResult | { assets: { uri: string; base64?: string; width?: number; height?: number }[] }) => {
         if (!('canceled' in result && result.canceled) && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            setImageUri(asset.uri);
            setImageBase64(asset.base64 ?? null);
            setGeneratedDdid(null);
            setPreDescription('');
            setFinalDescriptionForDdid('');
            setCloudinaryUrl(null);
            setError(null);
            
            // Get image dimensions
            if (asset.width && asset.height) {
                setImageDimensions({ width: asset.width, height: asset.height });
            } else if (Platform.OS === 'web' && asset.uri) {
                // For web, get dimensions from the image
                const img = new (window as any).Image();
                img.onload = () => {
                    setImageDimensions({ width: img.width, height: img.height });
                };
                img.src = asset.uri;
            } else {
                // Default to square if we can't get dimensions
                setImageDimensions(null);
            }
        } else {
            console.log('Image selection cancelled or failed');
        }
    };

     // Helper function to handle errors from either picker
    const handleImageError = (error: any) => {
        console.error("ImagePicker Error: ", error);
        setError('Failed to pick image. Please try again.');
        Alert.alert('Error', 'Could not load the image.');
    };

    // --- NEW: Function to upload image to backend (which uploads to Cloudinary) ---
    const uploadImageToCloudinary = async (base64Data: string): Promise<string | null> => {
        console.log("[uploadImageToCloudinary] Starting upload...");
        setIsUploading(true);
        setError(null);
        let uploadedUrl: string | null = null;
        try {
            const token = await getToken();
            if (!token) throw new Error("Authentication token not found.");

            console.log(`[uploadImageToCloudinary] Calling POST ${BASE_URL}/api/upload-image`);
            const response = await axios.post(`${BASE_URL}/api/upload-image`, { imageBase64: base64Data }, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = response.data as UploadImageResponse;

            if (data && data.imageUrl) {
                uploadedUrl = data.imageUrl;
                console.log("[uploadImageToCloudinary] Upload successful, URL:", uploadedUrl);
                setCloudinaryUrl(uploadedUrl);
                return uploadedUrl;
            } else {
                throw new Error("Invalid response from image upload endpoint.");
            }
        } catch (err: any) {
            console.error("[uploadImageToCloudinary] Error:", err);
            const errorMessage = err.response?.data?.message || err.message || "Failed to upload image";
            setError(`Image Upload Failed: ${errorMessage}`);
            Alert.alert("Image Upload Failed", `Could not upload the image to storage: ${errorMessage}`);
            setCloudinaryUrl(null);
            return null;
        } finally {
            setIsUploading(false);
            console.log("[uploadImageToCloudinary] Upload process finished.");
        }
    };
    // --- END NEW FUNCTION ---

    // Modify saveInspection to accept Cloudinary URL
    const saveInspection = async (ddid: string, cloudinaryImageUrl: string | null) => {
        console.log("[saveInspection] Attempting to save inspection with Cloudinary URL:", cloudinaryImageUrl);
        try {
            const token = await getToken();
            if (!token) throw new Error("User not authenticated");

            const payload = {
                description: initialDescription || '', // Use current notes, allow empty
                ddid,
                imageUrl: cloudinaryImageUrl,
                userState,
                state_used: userState // Include state explicitly
            };
            console.log(`[saveInspection] Preparing to POST to ${BASE_URL}/api/inspections with payload:`, JSON.stringify(payload));

            await axios.post(`${BASE_URL}/api/inspections`, payload, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 15000
            });
            console.log("[saveInspection] Inspection saved successfully via API.");

        } catch (err: any) {
            console.error("[saveInspection] Error caught during save attempt:", err);
            if (err.response) {
                 console.error("[saveInspection] Error response data:", err.response.data);
                 console.error("[saveInspection] Error response status:", err.response.status);
            }
            const errorMessage = err.response?.data?.message || err.message || "Could not save the inspection.";
            // Don't show alert for save failures - the statement was still generated successfully
            console.warn("[saveInspection] Save failed but statement was generated:", errorMessage);
        }
    };

    // --- NEW: Direct Statement Generation (streamlined flow) ---
    const handleGenerateStatement = async () => {
        console.log("[handleGenerateStatement] Function called - Direct generation flow");
        if (!imageBase64) {
            Alert.alert("Missing Image", "Please upload an image first.");
            return;
        }

        setIsGeneratingFinalDdid(true);
        setError(null);
        setGeneratedDdid(null);

        const currentCloudinaryUrl = cloudinaryUrl || await uploadImageToCloudinary(imageBase64);
        if (!currentCloudinaryUrl) {
            setIsGeneratingFinalDdid(false);
            return;
        }

        try {
            const token = await getToken();
            if (!token) throw new Error("Authentication token not found.");

            console.log(`[handleGenerateStatement] Generating statement for State: ${userState}, Organization: ${userOrganization}`);
            console.log(`[handleGenerateStatement] Calling POST ${BASE_URL}/api/generate-statement`);
            const response = await axios.post(`${BASE_URL}/api/generate-statement`, {
                imageBase64,
                notes: initialDescription,
                userState,
                organization: userOrganization,
            }, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 60000, // 60 second timeout for AI generation
            });

            const data = response.data as GenerateStatementResponse;

            if (data && data.statement) {
                console.log("[handleGenerateStatement] Statement received:", data.statement.substring(0, 100) + '...');
                setGeneratedDdid(data.statement);
                setFinalDescriptionForDdid(initialDescription);
                setShowDdidModal(true);

                // Save the inspection
                await saveInspection(data.statement, currentCloudinaryUrl);
            } else {
                throw new Error("Invalid response from statement server.");
            }
        } catch (err: any) {
            console.error("[handleGenerateStatement] Error generating statement:", err);
            const errorMessage = err.response?.data?.message || err.message || "Failed to generate statement";
            setError(errorMessage);
            Alert.alert("Generation Failed", errorMessage);
        } finally {
            setIsGeneratingFinalDdid(false);
        }
    };

    // --- Legacy: Step 1 - Handle Analyze Button Press (two-step flow) ---
    const handleAnalyze = async () => {
        console.log("[handleAnalyze] Function called");
        if (!imageBase64) {
            Alert.alert("Missing Image", "Please upload an image first.");
            return;
        }

        setIsGeneratingPreDescription(true);
        setError(null);
        setPreDescription('');

        const currentCloudinaryUrl = cloudinaryUrl || await uploadImageToCloudinary(imageBase64);
        if (!currentCloudinaryUrl) {
            setIsGeneratingPreDescription(false);
            return;
        }

        try {
            const token = await getToken();
            if (!token) throw new Error("Authentication token not found.");

            console.log(`[handleAnalyze] Calling POST ${BASE_URL}/api/generate-pre-description`);
            const response = await axios.post(`${BASE_URL}/api/generate-pre-description`, {
                imageBase64,
                description: initialDescription,
                userState,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = response.data as GeneratePreDescriptionResponse;

            if (data && data.preDescription) {
                console.log("[handleAnalyze] Pre-description received:", data.preDescription);
                setPreDescription(data.preDescription);
                setFinalDescriptionForDdid(data.preDescription);
                setShowPreDescriptionModal(true);
            } else {
                throw new Error("Invalid response from pre-description server.");
            }
        } catch (err: any) {
            console.error("[handleAnalyze] Error generating pre-description:", err);
            const errorMessage = err.response?.data?.message || err.message || "Failed to generate preliminary description";
            setError(errorMessage);
            Alert.alert("Analysis Failed", errorMessage);
        } finally {
            setIsGeneratingPreDescription(false);
        }
    };

    // --- NEW: Step 2 - Handle Final DDID Generation (Called from PreDescriptionModal) ---
    const handleGenerateFinalDdid = async (finalDescription: string) => {
        console.log("[handleGenerateFinalDdid] Generating final DDID with description:", finalDescription);
        setShowPreDescriptionModal(false);
        setIsGeneratingFinalDdid(true);
        setError(null);
        setGeneratedDdid(null);
        setFinalDescriptionForDdid(finalDescription);

        // Ensure we have the image data needed for the final, more detailed prompt
        if (!imageBase64) {
            Alert.alert("Missing Image Data", "The image data is missing. Please start over.");
            setIsGeneratingFinalDdid(false);
            return;
        }

        try {
            const token = await getToken();
            if (!token) throw new Error("Authentication token not found.");

            console.log(`[handleGenerateFinalDdid] Calling POST ${BASE_URL}/api/generate-ddid`);
            const ddidResponse = await axios.post(`${BASE_URL}/api/generate-ddid`, {
                // Pass all necessary context for the final DDID generation
                imageBase64,
                description: finalDescription,
                userState,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const ddidData = ddidResponse.data as GenerateDdidResponse;

            if (ddidData && ddidData.ddid) {
                const receivedDdid = ddidData.ddid;
                console.log("[handleGenerateFinalDdid] Final DDID received:", receivedDdid);
                setGeneratedDdid(receivedDdid);

                setIsGeneratingFinalDdid(false);

                setShowDdidModal(true);

                await saveInspection(receivedDdid, cloudinaryUrl);

            } else {
                setIsGeneratingFinalDdid(false);
                throw new Error("Invalid response structure from DDID server.");
            }

        } catch (err: any) {
            console.error("[handleGenerateFinalDdid] Error generating final DDID:", err);
            const errorMessage = err.response?.data?.message || err.message || "Failed to generate final statement";
            setError(errorMessage);
            Alert.alert("Statement Generation Failed", errorMessage);
            setIsGeneratingFinalDdid(false);
        }
    };

    async function startRecording() {
        try {
            console.log('[Audio] Requesting permissions..');
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert('Permission required', 'Audio recording permission is needed to use this feature.');
                return;
            }
            console.log('[Audio] Permissions granted.');

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                interruptionModeIOS: InterruptionModeIOS.DoNotMix,
                interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
            });

            console.log('[Audio] Starting recording instance creation...');
            const newRecording = new Audio.Recording();
            await newRecording.prepareToRecordAsync({
                android: {
                    ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
                    extension: '.amr',
                    outputFormat: Audio.AndroidOutputFormat.AMR_WB,
                    audioEncoder: Audio.AndroidAudioEncoder.AMR_WB,
                },
                ios: {
                    ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
                    extension: '.m4a',
                    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
                    audioQuality: Audio.IOSAudioQuality.MAX,
                },
                web: {
                    mimeType: 'audio/mp4',
                    bitsPerSecond: 128000,
                },
            });
            
            setRecording(newRecording);
            await newRecording.startAsync();
            setIsRecording(true);
            console.log('[Audio] Recording started successfully.');

        } catch (err) {
            console.error('[Audio] Failed to start recording', err);
            setError('Failed to start recording. Please try again.');
        }
    }

    async function stopRecording() {
        if (!recording) {
            console.warn('[Audio] stopRecording called but no recording object exists.');
            if (isRecording) setIsRecording(false);
            return;
        }

        console.log('[Audio] Stopping recording...');
        setIsRecording(false);

        try {
            await recording.stopAndUnloadAsync();
            console.log('[Audio] Recording stopped and unloaded.');
            const uri = recording.getURI();
            
            console.log('[Audio] Recording URI:', uri);
            if (uri) {
                await transcribeAudio(uri);
            } else {
                console.error('[Audio] Recording URI is null after stopping.');
                setError('Failed to get recording. Please try again.');
            }
        } catch (error) {
            console.error('[Audio] Failed to stop or transcribe recording', error);
            setError('Failed to process recording. Please try again.');
        } finally {
            setRecording(null); 
        }
    }

    async function transcribeAudio(audioUri: string) {
        setIsTranscribing(true);
        setError(null);
        console.log('[Transcribe] Starting transcription for URI:', audioUri);
        let audioBase64: string | null = null;
        let fileInfo: FileSystem.FileInfo | null = null;
        let audioMimeType: string = 'audio/mp4'; // Default mimetype, will be updated

        try {
            console.log('[Transcribe] Attempting to read audio file to Base64...');
            if (Platform.OS === 'web') {
                console.log("[Transcribe] Reading audio on web...");
                try {
                    const response = await fetch(audioUri);
                    if (!response.ok) throw new Error(`Failed to fetch blob: ${response.statusText} (Status: ${response.status})`);
                    const blob = await response.blob();

                    // Dynamically get mimetype from the blob
                    audioMimeType = blob.type || 'audio/webm';
                    console.log(`[Transcribe] Web blob detected mimetype: ${audioMimeType}, size: ${blob.size} bytes`);


                    if (blob.size === 0) {
                        throw new Error("Fetched audio blob is empty.");
                    }

                    audioBase64 = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const result = reader.result as string;
                            if (!result) {
                                reject(new Error("FileReader result is null."));
                                return;
                            }
                            const base64Marker = ';base64,';
                            const markerIndex = result.indexOf(base64Marker);
                            if (markerIndex === -1) {
                                reject(new Error("Invalid Data URL format: base64 marker not found."));
                                return;
                            }
                            resolve(result.substring(markerIndex + base64Marker.length));
                        };
                        reader.onerror = (error) => reject(new Error(`FileReader error: ${error.toString()}`));
                        reader.readAsDataURL(blob);
                    });
                    console.log("[Transcribe] Web audio read successfully.");

                } catch (fetchError) {
                    console.error("[Transcribe] Web fetch/read error:", fetchError);
                    const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
                    throw new Error(`Could not process web audio: ${message}`);
                }
            } else {
                console.log("[Transcribe] Reading audio on native...");
                try {
                     fileInfo = await FileSystem.getInfoAsync(audioUri);
                     if (!fileInfo.exists) {
                         throw new Error(`Audio file does not exist at URI: ${audioUri}`);
                     }
                     if (fileInfo.size === 0) {
                         throw new Error(`Audio file is empty at URI: ${audioUri}`);
                     }
                     console.log(`[Transcribe] Native file size: ${fileInfo.size} bytes`);
                     
                     // Determine mimetype from file extension for native platforms
                    const fileExtension = audioUri.split('.').pop()?.toLowerCase();
                    if (fileExtension === 'm4a') {
                        audioMimeType = 'audio/m4a';
                    } else if (fileExtension === 'amr') {
                        audioMimeType = 'audio/amr';
                    } else if (fileExtension) {
                        // Fallback for other extensions, e.g. mp3, wav
                        audioMimeType = `audio/${fileExtension}`;
                    }
                    console.log(`[Transcribe] Determined native mimetype as: ${audioMimeType}`);

                     audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });
                     console.log("[Transcribe] Native audio read successfully.");
                 } catch (readError) {
                    console.error("[Transcribe] Native file read error:", readError);
                    const message = readError instanceof Error ? readError.message : String(readError);
                    throw new Error(`Could not read native audio file: ${message}`);
                 }
            }

            if (!audioBase64) {
                 throw new Error("Failed to get Base64 audio data. The audio file might be invalid, empty, or inaccessible.");
            }
             console.log('[Transcribe] Audio Base64 obtained successfully (first 20 chars):', audioBase64.substring(0, 20));

            const token = await getToken();
            if (!token) throw new Error("Authentication token not found.");
            console.log(`[Transcribe] Sending audio to backend with mimetype: ${audioMimeType}...`);
            
            const response = await axios.post(`${BASE_URL}/api/transcribe`, {
                audioBase64: audioBase64,
                mimetype: audioMimeType, // Pass the determined mimetype
            }, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000,
            });
            console.log('[Transcribe] Backend response status:', response.status);

            const data = response.data as TranscribeAudioResponse;

            if (data && data.transcript) {
                console.log('[Transcribe] Transcription received:', data.transcript);
                setInitialDescription((prev: string) => prev ? `${prev} ${data.transcript}`.trim() : data.transcript);
            } else {
                 console.error('[Transcribe] Invalid response from backend:', response.data);
                 const backendError = (response.data as unknown as ApiError)?.message || "Invalid or empty response from transcription server.";
                throw new Error(backendError);
            }

        } catch (err: any) {
            console.error('[Transcribe] Full transcription process failed:', err);
            const errorMessage = err.response?.data?.message || (err instanceof Error ? err.message : String(err)) || 'Failed to transcribe audio';
            setError(`Transcription Failed: ${errorMessage}`);
            Alert.alert("Transcription Failed", `Could not transcribe audio. Please try again. Error: ${errorMessage}`);
        } finally {
            setIsTranscribing(false);
            console.log('[Transcribe] Transcription process finished.');
            if (Platform.OS !== 'web' && audioUri) {
                FileSystem.deleteAsync(audioUri, { idempotent: true })
                    .then(() => console.log(`[Transcribe] Cleaned up temporary audio file: ${audioUri}`))
                    .catch((e: Error) => console.error(`[Transcribe] Failed to clean up temporary audio file: ${audioUri}`, e));
            }
        }
    }

    const resetInspection = () => {
        setImageUri(null);
        setImageBase64(null);
        setInitialDescription('');
        setGeneratedDdid(null);
        setError(null);
        setShowDdidModal(false);
        if (recording) {
             try { recording.stopAndUnloadAsync(); } catch (e: any) { console.error("Stop rec error on reset", e); }
        }
        setIsRecording(false);
        setIsTranscribing(false);
        setPreDescription('');
        setShowPreDescriptionModal(false);
        setIsGeneratingPreDescription(false);
        setIsGeneratingFinalDdid(false);
        setFinalDescriptionForDdid('');
        setCloudinaryUrl(null);
        setImageDimensions(null);
        console.log("Inspection reset");
    };

    useEffect(() => {
        const currentRec = recording;
        return () => {
            if (currentRec) {
                console.log('Unmounting/Cleanup - stopping and unloading recording instance.');
                currentRec.stopAndUnloadAsync()
                    .then(() => console.log("Recording stopped safely on cleanup"))
                    .catch((e: Error) => console.error("Error stopping recording on cleanup:", e));
            }
        };
    }, []);

    const [isDragging, setIsDragging] = useState(false);

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

    const handleDrop = async (event: any) => {
        if (Platform.OS !== 'web' || typeof FileReader === 'undefined') {
            return;
        }
        
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        console.log('File dropped!');

        const files = event.dataTransfer?.files || event.nativeEvent?.dataTransfer?.files;
        if (files && files.length > 0) {
            const file = files[0];
            console.log('Dropped file:', file.name, file.type);

            if (file.type.startsWith('image/')) {
                try {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const uri = reader.result as string;
                        const base64 = uri.split(',')[1];
                        handleImageResult({ assets: [{ uri, base64 }] });
                    };
                    reader.onerror = (error) => {
                        console.error("Error reading dropped file:", error);
                        setError('Failed to read dropped image.');
                        Alert.alert('Error', 'Could not read the dropped image.');
                    };
                    reader.readAsDataURL(file);
                } catch (error) {
                    handleImageError(error);
                }
            } else {
                Alert.alert('Invalid File Type', 'Please drop an image file.');
            }
            if (event.dataTransfer?.clearData) {
                event.dataTransfer.clearData();
            }
        }
    };

    // --- NEW: Function to launch camera directly on WEB ---
    const launchWebCamera = () => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') {
            return;
        }
        
        // This will create a hidden file input and click it
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment'; // Prioritize back camera
        input.onchange = async (event) => {
            const target = event.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                const file = target.files[0];
                try {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const uri = reader.result as string; // data: URL
                        const base64Marker = ';base64,';
                        const markerIndex = uri.indexOf(base64Marker);
                        if (markerIndex === -1) {
                            handleImageError(new Error("Invalid Data URL from web camera."));
                            return;
                        }
                        const base64 = uri.substring(markerIndex + base64Marker.length);
                        handleImageResult({ assets: [{ uri, base64 }] });
                    };
                    reader.onerror = (error) => handleImageError(error);
                    reader.readAsDataURL(file);
                } catch (err) {
                    handleImageError(err);
                }
            }
        };
        input.click();
    };

    // --- Loading Indicator Logic ---
    const isLoading = isUploading || isGeneratingPreDescription || isGeneratingFinalDdid;
    const loadingText = isUploading ? 'Uploading Image...' :
                       isGeneratingPreDescription ? 'Analyzing...' :
                       isGeneratingFinalDdid ? 'Generating Statement...' : '';

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.contentContainer, Platform.OS === 'web' && styles.contentContainerWeb]}
            keyboardShouldPersistTaps="handled"
        >
            <KeyboardAvoidingView
                style={{ width: '100%', maxWidth: 700, alignItems: 'center' }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                enabled
            >
                {/* Statement Usage Card */}
                <StatementUsageCard />

                {/* Ad Banner (only for free users) */}
                <AdBanner />

                {/* Stale Content Warning */}
                {isContentStale && generatedDdid && (
                  <View style={styles.staleWarning}>
                    <Text style={styles.staleWarningText}>
                      ⚠️ State changed - generated content may no longer be compliant
                    </Text>
                    <TouchableOpacity onPress={clearStaleFlag}>
                      <Text style={styles.staleWarningDismiss}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.userInfoContainer}>
                    {/* State display removed from here, now handled in RootNavigator header */}
                </View>

                {Platform.OS === 'web' ? (
                    <View 
                        // @ts-ignore - web-only drag/drop events
                        onDragOver={handleDragOver} 
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop} 
                        style={[webDropZoneStyleRN, isDragging && webDropZoneDraggingStyle]}
                    >
                        <TouchableOpacity 
                            style={[
                                styles.imagePickerWebMain, 
                                imageUri && imageDimensions && { 
                                    aspectRatio: imageDimensions.width / imageDimensions.height,
                                    maxHeight: 400
                                }
                            ]} 
                            onPress={launchLibrary}
                        > 
                            {imageUri ? (
                                <Image 
                                    source={{ uri: imageUri }} 
                                    style={[
                                        styles.imagePreviewAdaptive,
                                        imageDimensions && { aspectRatio: imageDimensions.width / imageDimensions.height }
                                    ]} 
                                    resizeMode="contain"
                                />
                            ) : (
                                <View style={styles.imagePlaceholder}>
                                    <ImagePlus size={50} color="#6c757d" />
                                    <Text style={styles.imagePlaceholderText}>Tap or drop image here</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        {!isWebLarge && (
                            <TouchableOpacity style={[styles.button, styles.takePhotoButtonWeb]} onPress={launchWebCamera}>
                                <Camera size={20} color={COLORS.white} style={styles.buttonIcon} />
                                <Text style={styles.buttonText}>Take Photo</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                 ) : (
                    <TouchableOpacity 
                        style={[
                            styles.imagePicker,
                            imageUri && imageDimensions && { 
                                aspectRatio: imageDimensions.width / imageDimensions.height,
                                maxHeight: 400
                            }
                        ]} 
                        onPress={selectImageSource}
                    >
                        {imageUri ? (
                            <Image 
                                source={{ uri: imageUri }} 
                                style={[
                                    styles.imagePreviewAdaptive,
                                    imageDimensions && { aspectRatio: imageDimensions.width / imageDimensions.height }
                                ]} 
                                resizeMode="contain"
                            />
                        ) : (
                            <View style={styles.imagePlaceholder}>
                                <ImagePlus size={50} color="#6c757d" />
                                <Text style={styles.imagePlaceholderText}>Tap to select image</Text>
                            </View>
                        )}
                        <TouchableOpacity style={styles.cameraIconTouchable} onPress={launchCamera}>
                            <Camera size={28} color={COLORS.primary} />
                        </TouchableOpacity>
                    </TouchableOpacity>
                 )}

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Describe the image or record audio..."
                        value={initialDescription}
                        onChangeText={setInitialDescription}
                        multiline
                        editable={!isRecording && !isTranscribing && !isLoading}
                    />
                    <TouchableOpacity
                        style={styles.micButton}
                        onPress={isRecording ? stopRecording : startRecording}
                        disabled={isTranscribing || isLoading}
                        >
                        {isRecording ? (
                             <Mic size={24} color="#28a745" />
                        ) : isTranscribing ? (
                             <ActivityIndicator size="small" color={COLORS.primary} />
                        ) : (
                             <MicOff size={24} color={COLORS.primary} />
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                        style={[styles.button, styles.analyzeButton, styles.actionButtonHalf, (!imageBase64 || isLoading || !canGenerateStatement) && styles.buttonDisabled]}
                        onPress={handleGenerateStatement}
                        disabled={!imageBase64 || isLoading || !canGenerateStatement}
                    >
                        <Text style={styles.buttonText}>
                          {!canGenerateStatement ? 'Limit Reached' : 'Generate Statement'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.button, styles.newChatButton, styles.actionButtonHalf, isLoading && styles.buttonDisabled]}
                        onPress={resetInspection}
                        disabled={isLoading}
                    >
                        <RefreshCcw size={20} color={COLORS.darkText} style={styles.buttonIcon} />
                        <Text style={styles.buttonTextSecondary}>New Defect</Text>
                    </TouchableOpacity>
                </View>

                {error && <Text style={styles.errorText}>{error}</Text>}

                {/* SOP Alignment Card */}
                <SopAlignmentCard />

                {/* Last Statement Card */}
                <LastStatementCard />

                {/* Tools & Community Card */}
                <ToolsAndCommunityCard />

                {/* --- Send Feedback Link --- */}
                <TouchableOpacity
                    style={styles.feedbackLinkContainer}
                    onPress={() => {
                        const feedbackUrl = 'https://spediak.com/app-feedback/'; // Replace with your actual feedback page URL
                        Linking.canOpenURL(feedbackUrl).then(supported => {
                            if (supported) {
                                Linking.openURL(feedbackUrl);
                            } else {
                                Alert.alert("Error", "Could not open the feedback page.");
                                console.log(`Don't know how to open this URL: ${feedbackUrl}`);
                            }
                        }).catch(err => {
                            Alert.alert("Error", "An unexpected error occurred.");
                            console.error('An error occurred', err)
                        });
                    }}
                >
                    <Text style={styles.feedbackLinkText}>Send Feedback</Text>
                </TouchableOpacity>
            </KeyboardAvoidingView>

            <PreDescriptionModal
              visible={showPreDescriptionModal}
              onClose={() => setShowPreDescriptionModal(false)}
              preDescription={preDescription}
              onGenerateDdid={handleGenerateFinalDdid}
            />

            <DdidModal
                visible={showDdidModal}
                onClose={() => setShowDdidModal(false)}
                ddidText={generatedDdid || ''}
                imageUri={cloudinaryUrl || undefined}
             />

            <Modal
                transparent={true}
                animationType="fade"
                visible={isLoading}
                onRequestClose={() => {}}
            >
                <View style={styles.popupOverlay}>
                    <View style={styles.loadingPopupContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={styles.loadingPopupText}>{loadingText}</Text>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const webDropZoneStyleRN = {
    width: '100%' as const,
    maxWidth: 500,
    marginBottom: 20,
    alignSelf: 'center' as const,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    borderRadius: 12,
    transition: 'all 0.2s ease',
};

const webDropZoneDraggingStyle = {
    backgroundColor: '#E8F4FD',
    borderColor: COLORS.primary,
    borderWidth: 2,
    borderStyle: 'dashed' as const,
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    contentContainer: {
        padding: 20,
    },
    contentContainerWeb: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100%',
    },
    userInfoContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        maxWidth: 500,
        alignSelf: 'center',
        marginBottom: 10,
    },
    userEmail: {
        fontSize: 16,
        color: '#555',
    },
    userState: {
        fontSize: 16,
        color: '#555',
    },
    imagePicker: {
        width: '100%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        borderStyle: 'dashed',
        maxWidth: 400,
        alignSelf: 'center',
        ...Platform.select({
             native: { width: width * 0.85, },
             web: { maxWidth: '100%', }
         }),
        position: 'relative',
    },
    imagePreview: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
    },
    imagePreviewAdaptive: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
        maxHeight: 400,
    },
    imagePlaceholder: { justifyContent: 'center', alignItems: 'center', },
    imagePlaceholderText: { marginTop: 10, color: '#6c757d', },
    inputContainer: {
        flexDirection: 'row',
        width: '100%',
        maxWidth: 500,
        marginBottom: 15,
        alignItems: 'center',
        alignSelf: 'center',
        position: 'relative'
    },
    input: {
        flex: 1, 
        borderWidth: 1, 
        borderColor: '#D1D5DB', 
        borderRadius: 10,
        padding: 15, 
        paddingRight: 50, 
        minHeight: 100, 
        fontSize: 15,
        textAlignVertical: 'top',
        backgroundColor: '#FFFFFF',
        color: COLORS.textPrimary,
    },
    micButton: {
        position: 'absolute', right: 10, top: '50%', transform: [{ translateY: -12 }],
    },
    button: {
        width: '100%', 
        maxWidth: 500, 
        paddingVertical: 14, 
        borderRadius: 10,
        alignItems: 'center', 
        justifyContent: 'center', 
        marginBottom: 10,
        alignSelf: 'center', 
        flexDirection: 'row',
        minHeight: 48,
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', },
    analyzeButton: {
        backgroundColor: COLORS.primary,
    },
    newChatButton: {
        backgroundColor: '#FFFFFF', 
        borderWidth: 1, 
        borderColor: '#D1D5DB',
    },
    buttonIcon: { marginRight: 8, },
    buttonTextSecondary: { color: COLORS.darkText, fontSize: 17, fontWeight: '600', },
    buttonDisabled: { backgroundColor: '#adb5bd', },
    buttonDisabledText: { color: '#e9ecef'},
    errorText: {
        color: '#dc3545', marginTop: 15, marginBottom: 10, textAlign: 'center',
        width: '90%', alignSelf: 'center', fontSize: 14, fontWeight: '500',
    },
    popupOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingVertical: 20, // Add padding to avoid screen edges
    },
    popupContainer: {
        width: Platform.OS === 'web' ? '80%' : '90%', // Use more width
        maxWidth: 550, // Set a max-width for web
        height: '75%', // Increased height
        maxHeight: 600, // Set a max-height
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        justifyContent: 'space-between', // Push title to top, buttons to bottom
    },
    popupTitle: {
        fontSize: 22, // Slightly larger title
        fontWeight: 'bold',
        color: COLORS.primary,
        textAlign: 'center',
        marginBottom: 15,
        flexShrink: 0, // Ensure title doesn't shrink
    },
    popupText: { marginTop: 15, fontSize: 16, color: '#333', },
    loadingPopupContainer: {
        width: 200,
        height: 150,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingPopupText: {
        marginTop: 20,
        fontSize: 16,
        color: '#333',
        textAlign: 'center',
    },
    preDescScrollView: {
       flex: 1, // Allow scroll view to take up available space
       marginBottom: 15,
       borderWidth: 1,
       borderColor: '#e0e0e0',
       borderRadius: 8,
    },
    preDescScrollViewContent: {
        padding: 15, // Apply padding inside the scroll content
    },
    preDescText: { // New style for non-editable text
        fontSize: 17,
        lineHeight: 25, // Improved line height
        color: '#333',
        marginBottom: 20, // Space between description and instructions
    },
    preDescInput: {
        fontSize: 17, // Match the text style
        lineHeight: 25,
        color: '#333',
        textAlignVertical: 'top',
        minHeight: 250, // Set a minimum height to make it larger
    },
    preDescInputEditing: {
        backgroundColor: '#fff',
        // No need for border here if the ScrollView has it
    },
    instructionsContainer: { // New container for instruction block
        marginTop: 'auto', // Push instructions to the bottom of their container
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    instructionText: { // New style for each instruction line
        fontSize: 14,
        color: '#555',
        lineHeight: 22,
        marginBottom: 8,
    },
    preDescButtonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 5, // Reduced margin
        flexShrink: 0, // Ensure buttons don't shrink
    },
    preDescButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 5,
        flex: 1,
        marginHorizontal: 5,
        justifyContent: 'center',
    },
    preDescButtonText: {
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '600',
    },
    editButton: {
        backgroundColor: '#e9ecef',
        borderWidth: 1,
        borderColor: '#ced4da',
    },
    editButtonText: {
        color: COLORS.primary,
    },
    saveButton: {
        backgroundColor: '#28a745',
    },
    saveButtonText: {
        color: COLORS.white,
    },
    generateButton: {
         backgroundColor: COLORS.primary,
    },
    generateButtonText: {
        color: COLORS.white,
    },
    plainCloseButton: {
         marginTop: 0, // No extra margin needed
         padding: 10,
         alignSelf: 'center',
         flexShrink: 0, // Ensure close button doesn't shrink
    },
    plainCloseButtonText: {
        color: COLORS.darkText,
        fontSize: 15,
        textAlign: 'center',
        textDecorationLine: 'underline',
    },
    cameraIconTouchable: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        padding: 8,
        borderRadius: 50,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
    },
    imagePickerWebMain: {
        width: '100%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f2f5',
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#ddd',
        borderStyle: 'dashed',
    },
    takePhotoButtonWeb: {
        backgroundColor: COLORS.primary,
        marginTop: 10,
        width: '100%',
        maxWidth: 400,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        maxWidth: 500,
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 10,
    },
    actionButtonHalf: {
        flex: 1,
        marginHorizontal: 5,
    },
    feedbackLinkContainer: {
        marginTop: 20,
        marginBottom: 10, // Add some margin at the bottom
        alignSelf: 'center',
    },
    feedbackLinkText: {
        color: COLORS.primary,
        fontSize: 15,
        textDecorationLine: 'underline',
    },
    staleWarning: {
        backgroundColor: '#fff3cd',
        borderWidth: 1,
        borderColor: '#ffc107',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        maxWidth: 500,
    },
    staleWarningText: {
        flex: 1,
        fontSize: 14,
        color: '#856404',
        fontWeight: '600',
    },
    staleWarningDismiss: {
        fontSize: 14,
        color: COLORS.primary,
        fontWeight: 'bold',
        textDecorationLine: 'underline',
    },
});