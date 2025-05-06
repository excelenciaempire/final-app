import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Image, Button, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { Pencil, X, Camera, LogOut } from 'lucide-react-native';

// Define the states available for selection
const availableStates = [
    { label: 'North Carolina', value: 'NC' },
    { label: 'South Carolina', value: 'SC' },
    // Add other states as needed
];

export default function ProfileSettingsScreen() {
    const { isLoaded, isSignedIn, user } = useUser();
    const { signOut } = useAuth();
    const [isEditing, setIsEditing] = useState<boolean>(false);

    // State for editable fields
    const [firstName, setFirstName] = useState<string>('');
    const [lastName, setLastName] = useState<string>('');
    const [selectedState, setSelectedState] = useState<string | null>(null);
    const [profileImageUri, setProfileImageUri] = useState<string | null>(null); // Local URI for display/upload
    const [profileImageBase64, setProfileImageBase64] = useState<string | null>(null); // Store base64
    const [initialImageUri, setInitialImageUri] = useState<string | null>(null); // To track if image changed

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize form fields (just use user data, no auto-edit)
    useEffect(() => {
        if (user) {
            setFirstName(user.firstName || '');
            setLastName(user.lastName || '');

            let stateToSet: string | null = null;
            const inspectionStateFromMeta = user.unsafeMetadata?.inspectionState;
            if (typeof inspectionStateFromMeta === 'string' && availableStates.some(s => s.value === inspectionStateFromMeta)) {
                stateToSet = inspectionStateFromMeta;
            } else {
                 // Default to first available state if not set or invalid
                 stateToSet = availableStates.length > 1 ? availableStates[1].value : null; // Assuming first is placeholder
            }
            setSelectedState(stateToSet);

            const initialUri = user.imageUrl || null;
            setProfileImageUri(initialUri);
            setInitialImageUri(initialUri);
            setProfileImageBase64(null); // Ensure base64 is cleared on load/mode switch
        }
    }, [user, isEditing]); // Rerun when user loads OR when switching to edit mode

    // --- Updated Image Picker Logic ---
    const pickImage = async () => {
        if (Platform.OS === 'web') {
             // Web: Directly launch library, skip permissions and camera option
             try {
                 let result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.7,
                    base64: true,
                });
                handleImageResult(result);
            } catch (error) {
                handleImageError(error);
            }
        } else {
            // Native: Request permissions and show options alert
            const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
            const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (cameraPermission.status !== 'granted' || libraryPermission.status !== 'granted') {
                Alert.alert('Permission required', 'Camera and Media Library permissions are needed to select an image.');
                return;
            }

            // Ask user for source
            Alert.alert(
                "Select Image Source",
                "Choose where to get the image from:",
                [
                    {
                        text: "Take Photo",
                        onPress: async () => {
                            try {
                                let result = await ImagePicker.launchCameraAsync({
                                    allowsEditing: true,
                                    aspect: [1, 1],
                                    quality: 0.7,
                                    base64: true, // Request base64 again
                                });
                                handleImageResult(result);
                            } catch (error) {
                                handleImageError(error);
                            }
                        }
                    },
                    {
                        text: "Choose from Library",
                        onPress: async () => {
                            try {
                                let result = await ImagePicker.launchImageLibraryAsync({
                                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                    allowsEditing: true,
                                    aspect: [1, 1],
                                    quality: 0.7,
                                    base64: true, // Request base64 again
                                });
                                handleImageResult(result);
                            } catch (error) {
                                handleImageError(error);
                            }
                        }
                    },
                    {
                        text: "Cancel",
                        style: "cancel"
                    }
                ]
            );
        }
    };

    // Helper function to handle result from either picker
    const handleImageResult = (result: ImagePicker.ImagePickerResult) => {
        if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            setProfileImageUri(asset.uri); // Update local display URI
            setProfileImageBase64(asset.base64 ?? null); // Store base64
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
    // --- End Updated Image Picker Logic ---

    // --- Updated Save Changes Logic ---
    const handleSaveChanges = async () => {
        if (!user) return;

        // Keep validation, but message is less critical now
        if (!firstName || !lastName || !selectedState) {
             Alert.alert("Missing Information", "Please ensure First Name, Last Name, and State are provided.");
             return;
        }

        setIsLoading(true);
        setError(null);
        let imageUpdateSuccess = true; // Flag to track image upload success

        try {
            // --- Step 1: Handle Profile Image Update ---
            if (profileImageBase64) { // If we have new base64 data
                console.log("Profile image changed, attempting update with base64...");
                try {
                    // --- Determine MIME Type (Still useful for potential future backend upload) ---
                    let mimeType = 'image/jpeg'; // Default
                    if (profileImageUri) { // Get extension from URI if available
                         const extension = profileImageUri.split('.').pop()?.toLowerCase();
                         if (extension === 'png') mimeType = 'image/png';
                         else if (extension === 'jpg' || extension === 'jpeg') mimeType = 'image/jpeg';
                         else if (extension === 'gif') mimeType = 'image/gif';
                         else if (extension === 'webp') mimeType = 'image/webp';
                         console.log(`Determined MIME type: ${mimeType} for extension: ${extension}`);
                    } else {
                         console.warn("Cannot determine exact MIME type without URI, defaulting to image/jpeg");
                    }

                    /* // Remove ArrayBuffer/Blob approach
                    // Fetch the image data as an ArrayBuffer
                    const response = await fetch(profileImageUri);
                    const imageBuffer = await response.arrayBuffer();
                    // Create a new Blob with the correct MIME type
                    const typedBlob = new Blob([imageBuffer], { type: mimeType });
                    */

                    // Try using the base64 string directly with setProfileImage
                    // Prepend the data URI scheme which might be required by some APIs
                    // Note: Clerk might *still* not support this directly from client.
                    const dataUri = `data:${mimeType};base64,${profileImageBase64}`;
                    console.log(`Attempting to upload image with data URI prefix (length: ${dataUri.length})`);

                    // *** This is speculative - Clerk might reject this format ***
                    await user.setProfileImage({ file: dataUri });
                    console.log("Profile image updated successfully on Clerk (using base64/data URI).");
                    setInitialImageUri(profileImageUri); // Update initial URI tracker on success
                    setProfileImageBase64(null); // Clear base64 after successful upload attempt

                } catch (imgErr: any) {
                    console.error("Error updating profile image:", imgErr);
                    setError(`Failed to update profile image: ${imgErr.errors?.[0]?.message || imgErr.message || 'Unknown error'}`); // Try to get detailed Clerk error
                    Alert.alert("Image Update Error", `Failed to update profile image: ${imgErr.errors?.[0]?.message || imgErr.message || 'Please try again.'}`);
                    imageUpdateSuccess = false; // Mark image update as failed
                    // Don't clear base64 on failure, user might retry
                }
            }

            // --- Step 2: Handle Text Field Updates ---
            if (imageUpdateSuccess) {
                const updates: any = {};

                if (firstName !== user.firstName) updates.firstName = firstName;
                if (lastName !== user.lastName) updates.lastName = lastName;
                if (selectedState !== user.unsafeMetadata?.inspectionState) {
                    updates.unsafeMetadata = { ...user.unsafeMetadata, inspectionState: selectedState };
                }

                if (Object.keys(updates).length > 0) {
                    console.log("Updating user profile metadata/name with:", updates);
                    await user.update(updates);
                    Alert.alert("Success", "Profile updated successfully!");
                 } else if (!profileImageBase64) {
                    console.log("No changes detected to save.");
                 } else {
                     Alert.alert("Success", "Profile image updated successfully!");
                 }
                setIsEditing(false); // Exit edit mode on success
            }

        } catch (err: any) {
            // Catch errors from user.update()
            console.error("Error saving profile metadata/name:", err);
            setError(`Failed to save profile details: ${err.message || 'Unknown error'}`);
            Alert.alert("Error", `Failed to save profile details: ${err.message || 'Please try again.'}`);
        } finally {
            setIsLoading(false);
        }
    };
    // --- End Updated Save Changes Logic ---

    // Step 52: Log Out Logic
    const handleLogout = async () => {
        setIsLoading(true);
        try {
            await signOut();
            // Navigation should automatically handle redirecting to login screen via RootLayout/ClerkProvider
        } catch (err: any) {
            console.error("Error signing out: ", err);
            Alert.alert("Logout Error", err.errors?.[0]?.message || "An unexpected error occurred during logout.");
            setIsLoading(false); // Only stop loading if sign out failed
        }
        // No finally block, as successful signout unmounts the component
    };


    if (!isLoaded) {
        return <View style={styles.container}><ActivityIndicator size="large" color="#007bff" /></View>;
    }

    if (!isSignedIn || !user) {
        // This shouldn't happen if navigation is set up correctly, but good practice
        return <View style={styles.container}><Text>Please sign in.</Text></View>;
    }

    return (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Profile</Text>
                {/* Always show Edit/Close icon */}
                 <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={styles.iconButton}>
                     {isEditing ? <X size={24} color="#333" /> : <Pencil size={24} color="#333" />}
                 </TouchableOpacity>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            {/* Step 45 & 46: Conditional Rendering */}
            {isEditing ? (
                // --- Edit Mode UI (Step 46) ---
                <View style={styles.content}>
                    <TouchableOpacity onPress={pickImage} style={styles.profileImageContainer}>
                        <Image
                            source={{ uri: profileImageUri || 'https://via.placeholder.com/150' }}
                            style={styles.profileImage}
                        />
                        <View style={styles.cameraOverlay}>
                            <Camera size={24} color="#fff" />
                        </View>
                    </TouchableOpacity>

                    <TextInput
                        style={styles.input}
                        placeholder="First Name"
                        value={firstName}
                        onChangeText={setFirstName}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Last Name"
                        value={lastName}
                        onChangeText={setLastName}
                    />

                    {/* State Picker */}
                    <Text style={styles.label}>Inspection State:</Text>
                    {/* Wrap Picker in the styled View */}
                     <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={selectedState ?? availableStates[0].value}
                            onValueChange={(itemValue) => setSelectedState(itemValue)}
                            style={styles.picker} // Use existing picker style
                            itemStyle={styles.pickerItem}
                            prompt="Select Inspection State"
                        >
                            {availableStates.map(state => (
                                <Picker.Item key={state.value} label={state.label} value={state.value} />
                            ))}
                        </Picker>
                     </View>

                    <TouchableOpacity
                         style={[styles.button, styles.saveButton, isLoading && styles.buttonDisabled]}
                         onPress={handleSaveChanges}
                         disabled={isLoading} >
                         {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Changes</Text>}
                     </TouchableOpacity>

                </View>
            ) : (
                // --- View Mode UI (Step 45) ---
                <View style={styles.content}>
                    <View style={styles.profileImageContainer}>
                         <Image
                            source={{ uri: user.imageUrl || 'https://via.placeholder.com/150' }}
                            style={styles.profileImage}
                        />
                    </View>

                    <Text style={styles.nameText}>{user.fullName || 'User Name'}</Text>
                    <Text style={styles.emailText}>{user.primaryEmailAddress?.emailAddress || 'No email'}</Text>
                    <Text style={styles.infoText}>
                        Default State: {availableStates.find(s => s.value === user.unsafeMetadata?.inspectionState)?.label || 'Not Set'}
                    </Text>

                     {/* Step 52: Log Out Button */}
                     <TouchableOpacity
                         style={[styles.button, styles.logoutButton, isLoading && styles.buttonDisabled]}
                         onPress={handleLogout}
                         disabled={isLoading} >
                         {isLoading ? <ActivityIndicator color="#dc3545" /> :
                             <>
                                <LogOut size={18} color="#dc3545" style={styles.buttonIcon} />
                                <Text style={styles.logoutButtonText}>Log Out</Text>
                             </>
                         }
                     </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );
}

// Styles (Combined for View & Edit)
const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    container: {
        flexGrow: 1,
        alignItems: 'center',
        padding: 20,
    },
    header: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
        marginTop: Platform.OS === 'android' ? 10 : 0, // Adjust for status bar
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
    },
    iconButton: {
        padding: 8,
    },
    content: {
        width: '100%',
        alignItems: 'center',
    },
    profileImageContainer: {
        marginBottom: 20,
        position: 'relative', // For camera overlay positioning
    },
    profileImage: {
        width: 150,
        height: 150,
        borderRadius: 75,
        borderWidth: 3,
        borderColor: '#007bff',
    },
    cameraOverlay: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: 8,
        borderRadius: 20,
    },
    nameText: {
        fontSize: 24,
        fontWeight: '600',
        color: '#333',
        marginBottom: 5,
    },
    emailText: {
        fontSize: 16,
        color: '#6c757d',
        marginBottom: 15,
    },
    infoText: {
        fontSize: 16,
        color: '#495057',
        marginBottom: 30,
    },
    input: {
        width: '100%',
        height: 50,
        borderColor: '#ced4da',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 15,
        marginBottom: 15,
        backgroundColor: '#ffffff',
        fontSize: 16,
    },
    label: {
        fontSize: 16,
        color: '#495057',
        alignSelf: 'flex-start',
        marginBottom: 8, // Consistent spacing
        width: '100%', // Ensure label takes full width
        paddingLeft: 5, // Slight indent similar to inputs
    },
    pickerContainer: {
        width: '100%',
        height: 50,
        backgroundColor: '#ffffff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ced4da',
        marginBottom: 20, // Consistent spacing
        justifyContent: 'center',
    },
    picker: {
        width: '100%',
        height: '100%',
        color: '#333',
        ...(Platform.OS === 'web' && {
             borderWidth: 0,
             backgroundColor: 'transparent',
             appearance: 'none',
             paddingLeft: 15,
             fontSize: 16,
        })
    },
    pickerItem: {
        // Optional styling
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 25,
        width: '80%',
        marginTop: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
        elevation: 2,
    },
    saveButton: {
        backgroundColor: '#28a745', // Green for save
    },
    logoutButton: {
         marginTop: 40,
         backgroundColor: 'transparent', // Transparent background
         borderWidth: 1,
         borderColor: '#dc3545', // Red border
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    logoutButtonText: {
        color: '#dc3545', // Red text
        fontSize: 16,
        fontWeight: 'bold',
    },
     buttonIcon: {
        marginRight: 8,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    errorText: {
        color: 'red',
        marginTop: 10,
        marginBottom: 10,
        textAlign: 'center',
    },
}); 