import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    ScrollView,
    Platform,
    TextInput
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { Camera, CheckCircle } from 'lucide-react-native';
import { COLORS } from '../styles/colors'; // Assuming you have a colors file

// Define the states available for selection (Format for DropDownPicker)
// Note: value cannot be null for DropDownPicker, use a placeholder object if needed
// or handle initial null state carefully.
const stateItems = [
    // { label: 'Select State...', value: null }, // Placeholder can be handled by component prop
    { label: 'North Carolina', value: 'NC' },
    { label: 'South Carolina', value: 'SC' },
    // Add other states as needed
];

// Simple navigation prop type for reload logic
// In a real app, you might use a more specific type or context/state management
type WelcomeScreenProps = {
    // Potentially add navigation prop if needed later
};

const WelcomeScreen: React.FC<WelcomeScreenProps> = () => {
    const { isLoaded, isSignedIn, user } = useUser();

    // State for selections
    const [open, setOpen] = useState(false); // State for dropdown open/closed
    const [selectedState, setSelectedState] = useState<string | null>(null); // Keep this for the value
    const [items, setItems] = useState(stateItems); // Items for the dropdown
    const [selectedOrganization, setSelectedOrganization] = useState<string | null>(null);
    const [companyName, setCompanyName] = useState<string>('');

    const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
    const [profileImageBase64, setProfileImageBase64] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Image Picker Logic (copied and adapted from ProfileSettingsScreen)
    const pickImage = async () => {
        if (Platform.OS === 'web') {
            // Web: Directly launch library, skip permissions and camera option
            try {
                let result = await ImagePicker.launchImageLibraryAsync({
                   mediaTypes: ImagePicker.MediaTypeOptions.Images,
                   allowsEditing: true,
                   aspect: [1, 1],
                   quality: 0.7, // Keep original quality setting for this screen
                   base64: true,
               });
               handleImageResult(result);
           } catch (error) {
               handleImageError(error);
           }
        } else {
            // Native: Request permissions and show options alert
            // ... (Permission requests remain the same) ...
            const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
            const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (cameraPermission.status !== 'granted' || libraryPermission.status !== 'granted') {
                Alert.alert('Permission required', 'Camera and Media Library permissions are needed.');
                return;
            }

            // ... (Alert for source choice remains the same) ...
            Alert.alert(
                "Select Image Source",
                "Choose where to get the image from:",
                [
                    {
                        text: "Take Photo",
                        onPress: async () => {
                            try {
                                let result = await ImagePicker.launchCameraAsync({
                                    allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
                                });
                                handleImageResult(result);
                            } catch (imgErr) { handleImageError(imgErr); }
                        }
                    },
                    {
                        text: "Choose from Library",
                        onPress: async () => {
                             try {
                                let result = await ImagePicker.launchImageLibraryAsync({
                                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                    allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
                                });
                                 handleImageResult(result);
                             } catch (imgErr) { handleImageError(imgErr); }
                        }
                    },
                    { text: "Cancel", style: "cancel" }
                ]
            );
        }
    };
    const handleImageResult = (result: ImagePicker.ImagePickerResult) => {
        if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            setProfileImageUri(asset.uri);
            setProfileImageBase64(asset.base64 ?? null);
        }
    };
    const handleImageError = (error: any) => {
        console.error("ImagePicker Error: ", error);
        Alert.alert('Error', 'Could not load the image.');
    };
    // --- End Image Picker Logic ---


    // Continue Button Logic
    const handleContinue = async () => {
        if (!user) return;
        if (!selectedState) {
            Alert.alert("State Required", "Please select your inspection state to continue.");
            return;
        }

        setIsLoading(true);
        setError(null);
        let imageUpdateSuccess = true;

        try {
            // --- Step 1: Handle Optional Profile Image Update ---
            if (profileImageBase64) {
                console.log("Profile image selected, attempting update...");
                try {
                    // Re-use base64 approach (assuming MIME type determination if needed)
                    let mimeType = 'image/jpeg';
                    if (profileImageUri) {
                        const extension = profileImageUri.split('.').pop()?.toLowerCase();
                         if (extension === 'png') mimeType = 'image/png';
                         // Add other types if needed
                    }
                    const dataUri = `data:${mimeType};base64,${profileImageBase64}`;
                    await user.setProfileImage({ file: dataUri });
                    console.log("Profile image updated successfully on Clerk.");
                } catch (imgErr: any) {
                    console.error("Error updating profile image during welcome:", imgErr);
                    // Don't block continuation for optional image failure, but notify user
                    Alert.alert("Image Upload Issue", `Could not update profile image: ${imgErr.errors?.[0]?.message || imgErr.message}. You can try again later in Profile Settings.`);
                    imageUpdateSuccess = false;
                }
            }

            // --- Step 2: Update Clerk Metadata ---
            const metadataUpdate: any = { inspectionState: selectedState };
            if (selectedOrganization) {
                metadataUpdate.organization = selectedOrganization;
            }
            if (companyName.trim()) {
                metadataUpdate.companyName = companyName.trim();
            }

            console.log(`Updating user metadata:`, metadataUpdate);
            await user.update({
                unsafeMetadata: { ...user.unsafeMetadata, ...metadataUpdate }
            });
            console.log("User metadata updated.");

            // --- Step 3: Reload User & Trigger Navigation ---
            console.log("Reloading user data...");
            await user.reload();
            console.log("User data reloaded.");

        } catch (err: any) {
            console.error("Error saving welcome screen data:", err);
            setError(`Failed to save settings: ${err.message || 'Unknown error'}`);
            Alert.alert("Error", `Failed to save settings: ${err.message || 'Please try again.'}`);
        } finally {
            if (!error) {
                 setIsLoading(false);
            }
        }
    };

    if (!isLoaded) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    }
     if (!isSignedIn || !user) {
        // Should ideally not happen if rendered conditionally after sign-in
        return <View style={styles.loadingContainer}><Text>Error: User not found.</Text></View>;
    }

    return (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Welcome to Spediak!</Text>
            <Text style={styles.subtitle}>Let's get your profile ready.</Text>

            {/* Optional Profile Picture (Moved Up) */}
             <Text style={styles.label}>Profile Picture (Optional):</Text>
             <TouchableOpacity onPress={pickImage} style={styles.profileImageContainer}>
                 <Image
                     source={{ uri: profileImageUri || 'https://via.placeholder.com/150' }} // Use a generic placeholder
                     style={styles.profileImage}
                 />
                 <View style={styles.cameraOverlay}>
                     <Camera size={24} color="#fff" />
                 </View>
             </TouchableOpacity>

            {/* State Picker */}
            <Text style={styles.label}>Select Inspection State (Required):</Text>
            <View style={styles.pickerContainer}>
                <Picker
                    selectedValue={selectedState}
                    onValueChange={(itemValue, itemIndex) => setSelectedState(itemValue)}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                >
                    <Picker.Item label="Select State..." value={null} style={styles.pickerPlaceholder} />
                    <Picker.Item label="North Carolina" value="NC" />
                    <Picker.Item label="South Carolina" value="SC" />
                </Picker>
            </View>

            {/* Organization Picker */}
            <Text style={styles.label}>Organization (Optional):</Text>
            <View style={styles.pickerContainer}>
                <Picker
                    selectedValue={selectedOrganization}
                    onValueChange={(itemValue) => setSelectedOrganization(itemValue)}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                >
                    <Picker.Item label="Select Organization..." value={null} style={styles.pickerPlaceholder} />
                    <Picker.Item label="ASHI" value="ASHI" />
                    <Picker.Item label="InterNACHI" value="InterNACHI" />
                </Picker>
            </View>

            {/* Company Name Input */}
            <Text style={styles.label}>Company Name (Optional):</Text>
            <TextInput
                style={styles.textInput}
                placeholder="Enter your company name"
                value={companyName}
                onChangeText={setCompanyName}
                autoCapitalize="words"
            />

             {error && <Text style={styles.errorText}>{error}</Text>}

             {/* Continue Button */}
             <TouchableOpacity
                  style={[styles.button, styles.continueButton, (!selectedState || isLoading) && styles.buttonDisabled]}
                  onPress={handleContinue}
                  disabled={!selectedState || isLoading} >
                  {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
              </TouchableOpacity>

        </ScrollView>
    );
}

// Add Styles similar to ProfileSettingsScreen but adapted
const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
    },
     scrollView: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    container: {
        flexGrow: 1,
        alignItems: 'center',
        padding: 30, // More padding
        paddingTop: 60,
    },
     title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 18,
        color: '#6c757d',
        marginBottom: 40,
        textAlign: 'center',
    },
    label: {
        fontSize: 16,
        color: '#495057',
        alignSelf: 'flex-start',
        marginBottom: 8,
        fontWeight: '500',
        width: '100%', // Ensure label takes full width for alignment
        paddingLeft: 5, // Slight indent
    },
    /* Remove old Picker styles
    pickerContainer: { ... },
    picker: { ... },
    pickerPlaceholder: { ... },
    */

    // --- New Styles for Picker Container ---
    pickerContainer: {
        width: '100%', // Match text input width
        height: 50, // Match text input height
        backgroundColor: '#ffffff', // Match text input background
        borderRadius: 8, // Match text input border radius
        borderWidth: 1,
        borderColor: '#ced4da',
        marginBottom: 30, // Spacing below
        justifyContent: 'center', // Center picker content vertically
    },
    picker: {
        width: '100%',
        height: '100%',
        color: '#333', // Text color
        // Note: Direct styling of Picker appearance (like removing underline) is limited
        // and platform-dependent. Styling the container is the primary approach.
        // On web, some default browser styles might still apply.
        ...(Platform.OS === 'web' && {
             borderWidth: 0, // Try removing web border
             backgroundColor: 'transparent', // Try making background transparent
             appearance: 'none', // Try hiding default dropdown arrow on web
             paddingLeft: 15, // Indent text like TextInput
             fontSize: 16,
        })
    },
    pickerPlaceholder: {
        color: '#a0a0a0',
     },
    pickerItem: {
        // Optional styling for items in the dropdown list if needed
    },
    // --- End Picker Container Styles ---

    profileImageContainer: {
        marginBottom: 30,
        marginTop: 10, // Add some margin top
        position: 'relative',
        alignSelf: 'center', // Center the image picker
    },
    profileImage: {
        width: 150,
        height: 150,
        borderRadius: 75,
        borderWidth: 3,
        borderColor: '#007bff',
        backgroundColor: '#e0e0e0', // Placeholder bg
    },
    cameraOverlay: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: 8,
        borderRadius: 20,
    },
     button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14, // Slightly larger button
        paddingHorizontal: 30,
        borderRadius: 25,
        width: '90%', // Wider button
        marginTop: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    continueButton: {
        backgroundColor: COLORS.primary, // Use primary color
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: 'bold',
    },
     buttonDisabled: {
        backgroundColor: '#a0a0a0', // Grey out when disabled
        opacity: 0.7,
    },
    errorText: {
        color: 'red',
        marginTop: 15,
        textAlign: 'center',
        fontSize: 14,
    },
    textInput: {
        width: '100%',
        height: 50,
        backgroundColor: '#ffffff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ced4da',
        marginBottom: 30,
        paddingHorizontal: 15,
        fontSize: 16,
        color: '#333',
    },
});

export default WelcomeScreen; 