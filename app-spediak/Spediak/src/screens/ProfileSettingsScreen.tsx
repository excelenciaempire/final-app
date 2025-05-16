import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Image, Button, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Platform, SafeAreaView } from 'react-native';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { Pencil, X, Camera, LogOut } from 'lucide-react-native';
import { COLORS } from '../styles/colors';
import { Check, Edit2, Upload } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';

// Define the states available for selection
const availableStates = [
    { label: 'North Carolina', value: 'NC' },
    { label: 'South Carolina', value: 'SC' },
    // Add other states as needed
];

const ProfileSettingsScreen: React.FC = () => {
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
    const [newImageUri, setNewImageUri] = useState<string | null>(null); // URI of newly selected image
    const [newImageBlob, setNewImageBlob] = useState<Blob | null>(null); // Blob for upload

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize form fields (just use user data, no auto-edit)
    useEffect(() => {
        if (user) {
            setFirstName(user.firstName || '');
            setLastName(user.lastName || '');
            setSelectedState(user.unsafeMetadata?.inspectionState as string || null);
            setProfileImageUri(user.imageUrl || null);
            setInitialImageUri(user.imageUrl || null);
            setProfileImageBase64(null); // Ensure base64 is cleared on load/mode switch
        }
    }, [user, isEditing]); // Rerun when user loads OR when switching to edit mode

    // --- Updated Image Picker Logic ---
    const pickImage = async () => {
        const permissions = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissions.granted) {
            Alert.alert('Permission required', 'Media Library permission is needed to select an image.');
                return;
            }

                                let result = await ImagePicker.launchImageLibraryAsync({
                                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                    allowsEditing: true,
                                    aspect: [1, 1],
                                    quality: 0.7,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            setNewImageUri(asset.uri);
            // Fetch the blob data needed for Clerk upload
            try {
                const response = await fetch(asset.uri);
                const blob = await response.blob();
                setNewImageBlob(blob);
            } catch (fetchError) {
                console.error("Error fetching image blob:", fetchError);
                Alert.alert("Error", "Could not prepare image for upload.");
                setNewImageUri(null);
                setNewImageBlob(null);
            }
        }
    };

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
            if (newImageBlob) {
                console.log("Profile image changed, attempting update with blob...");
                await user.setProfileImage({
                    file: newImageBlob,
                });
                console.log("Profile image updated successfully on Clerk (using blob).");
                setInitialImageUri(newImageUri); // Update initial URI tracker on success
                setNewImageUri(null); // Clear temporary states after successful upload
                setNewImageBlob(null);
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
                 } else if (!newImageBlob) {
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
        return <ActivityIndicator style={styles.loader} size="large" color={COLORS.primary} />;
    }

    if (!isSignedIn || !user) {
        // This shouldn't happen if navigation is set up correctly, but good practice
        return <View style={styles.container}><Text>Please sign in.</Text></View>;
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView 
                style={styles.safeArea}
                contentContainerStyle={styles.scrollContentContainer}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.title}>Edit Profile</Text>
                <Text style={styles.description}>Update your details below.</Text>

                    <TouchableOpacity onPress={pickImage} style={styles.profileImageContainer}>
                        <Image
                        source={{ uri: newImageUri || user.imageUrl || 'https://via.placeholder.com/150' }}
                        style={styles.avatar}
                        />
                    <View style={styles.editIconOverlay}> 
                        <Edit2 size={16} color={COLORS.white} />
                        </View>
                    </TouchableOpacity>

                <View style={styles.inputContainer}>
                    <Ionicons name="person-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                    <TextInput
                        placeholder="First Name"
                        value={firstName}
                        onChangeText={setFirstName}
                        style={styles.input}
                        placeholderTextColor={COLORS.darkText}
                    />
                </View>
                <View style={styles.inputContainer}>
                    <Ionicons name="person-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                    <TextInput
                        placeholder="Last Name"
                        value={lastName}
                        onChangeText={setLastName}
                        style={styles.input}
                        placeholderTextColor={COLORS.darkText}
                    />
                </View>
                
                <View style={styles.inputContainer}> 
                    <Ionicons name="map-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                        <Picker
                        selectedValue={selectedState}
                            onValueChange={(itemValue) => setSelectedState(itemValue)}
                        style={styles.input}
                        dropdownIconColor={COLORS.primary}
                        >
                        <Picker.Item label="Select State..." value={null} />
                            {availableStates.map(state => (
                                <Picker.Item key={state.value} label={state.label} value={state.value} />
                            ))}
                        </Picker>
                     </View>

                {error && <Text style={styles.errorText}>{error}</Text>}

                    <TouchableOpacity
                    style={[styles.button, isLoading && styles.buttonDisabled]}
                         onPress={handleSaveChanges}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color={COLORS.white} />
                    ) : (
                        <><Check size={20} color={COLORS.white} style={{marginRight: 8}} /><Text style={styles.buttonText}>Save Changes</Text></>
                    )}
                     </TouchableOpacity>

        </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    scrollContentContainer: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingBottom: 30,
        paddingTop: 30,
        width: '100%',
        maxWidth: 500,
        alignSelf: 'center',
    },
    loader: { marginTop: 50 },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.darkText,
        textAlign: 'center',
        marginBottom: 10,
    },
    description: {
        fontSize: 16,
        color: COLORS.darkText,
        textAlign: 'center',
        marginBottom: 30,
    },
    profileImageContainer: {
        marginBottom: 30,
        position: 'relative',
        alignSelf: 'center',
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        borderColor: COLORS.primary, 
    },
    editIconOverlay: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        backgroundColor: COLORS.primary,
        padding: 6,
        borderRadius: 15,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.secondary,
        borderRadius: 10,
        marginBottom: 15,
        paddingHorizontal: 15,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        height: 50,
        color: COLORS.darkText,
        fontSize: 16,
    },
    button: {
        flexDirection: 'row',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 20,
    },
    buttonDisabled: {
        backgroundColor: '#a0a0a0',
    },
    buttonText: {
        color: COLORS.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
        marginBottom: 15,
        fontSize: 14,
        paddingHorizontal: 10,
    },
}); 

export default ProfileSettingsScreen; 