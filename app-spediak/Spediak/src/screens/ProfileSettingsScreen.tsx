import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Image, Button, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Platform, SafeAreaView } from 'react-native';
import { useUser, useAuth, useClerk, isClerkAPIResponseError } from '@clerk/clerk-expo';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { Pencil, X, Camera, LogOut } from 'lucide-react-native';
import { COLORS } from '../styles/colors';
import { Check, Edit2, Upload } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Define the states available for selection
const availableStates = [
    { label: 'North Carolina', value: 'NC' },
    { label: 'South Carolina', value: 'SC' },
    // Add other states as needed
];

const ProfileSettingsScreen: React.FC = () => {
    const { isLoaded, isSignedIn, user } = useUser();
    const { signOut, getToken } = useAuth();
    const clerk = useClerk();
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
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // States for email change
    const [newEmail, setNewEmail] = useState('');
    const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [emailChangeError, setEmailChangeError] = useState<string | null>(null);
    const [emailChangeSuccess, setEmailChangeSuccess] = useState<string | null>(null);

    const [isClientMounted, setIsClientMounted] = useState(false); // New state for client mount

    const { user: clerkUser, isLoaded: clerkIsLoaded } = useUser();

    // Initialize form fields (just use user data, no auto-edit)
    useEffect(() => {
        setIsClientMounted(true); // Set client mounted state
        if (clerkUser) {
            setFirstName(clerkUser.firstName || '');
            setLastName(clerkUser.lastName || '');
            setSelectedState(clerkUser.unsafeMetadata?.inspectionState as string || null);
            if (!newImageUri) { // Only set from clerkUser if no new image is staged
                setProfileImageUri(clerkUser.imageUrl || null);
                setInitialImageUri(clerkUser.imageUrl || null);
            }
            setProfileImageBase64(null); // Ensure base64 is cleared on load/mode switch
        }
    }, [clerkUser]); // Removed isEditing dependency, should fetch on clerkUser change primarily

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
        if (!clerkUser) return;

        // Keep validation, but message is less critical now
        if (!firstName || !lastName || !selectedState) {
            //  Alert.alert("Missing Information", "Please ensure First Name, Last Name, and State are provided.");
            setError("Please ensure First Name, Last Name, and State are provided.");
             return;
        }

        setIsLoading(true); 
        setError(null);
        setSuccessMessage(null); 
        setEmailChangeError(null);
        setEmailChangeSuccess(null); // Clear all messages
        let imageUpdateSuccess = true; 

        try {
            // --- Step 1: Handle Profile Image Update ---
            if (newImageBlob) {
                console.log("Profile image changed, attempting update with blob...");
                await clerkUser.setProfileImage({
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

                if (firstName !== clerkUser.firstName) updates.firstName = firstName;
                if (lastName !== clerkUser.lastName) updates.lastName = lastName;
                if (selectedState !== clerkUser.unsafeMetadata?.inspectionState) {
                    updates.unsafeMetadata = { ...clerkUser.unsafeMetadata, inspectionState: selectedState };
                }

                if (Object.keys(updates).length > 0) {
                    console.log("Updating user profile metadata/name with:", updates);
                    await clerkUser.update(updates);
                    Alert.alert("Success", "Profile updated successfully!");
                 } else if (!newImageBlob) {
                    console.log("No changes detected to save.");
                 } else {
                     Alert.alert("Success", "Profile image updated successfully!");
                 }
                setIsEditing(false); // Exit edit mode on success
            }

            setSuccessMessage('Profile updated successfully!'); // Corrected to use setSuccessMessage
            // setError(null); // Already cleared above
            // setEmailChangeError(null); // Already cleared above
            // setEmailChangeSuccess(null); // Already cleared above

        } catch (err: any) {
            // Catch errors from user.update()
            console.error("Error saving profile metadata/name:", err);
            const errMessage = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || "Failed to save profile details.";
            setError(errMessage); 
            // Alert.alert("Error", `Failed to save profile details: ${errMessage}`); // Error state is shown
        } finally {
            setIsLoading(false); // Clear loading for main save
        }
    };

    // Function to initiate email change
    const handleInitiateEmailChange = async () => {
        if (!clerkUser) return;
        
        const trimmedEmail = newEmail.trim();
        console.log("Attempting to initiate email change for:", trimmedEmail);

        // Add more detailed logging before the regex test
        console.log(`Validating email: '${trimmedEmail}', Length: ${trimmedEmail.length}, Regex test result: ${/^\S+@\S+\.\S+$/.test(trimmedEmail)}`);

        if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) { 
            setEmailChangeError("Please enter a valid new email address.");
            console.log("Email validation failed for:", trimmedEmail); 
            return;
        }
        
        setError(null);
        setSuccessMessage(null);
        setEmailChangeError(null);
        setEmailChangeSuccess(null);
        setIsLoading(true);

        try {
            const createdEmailAddress = await clerkUser.createEmailAddress({ email: trimmedEmail });
            await createdEmailAddress.prepareVerification({ strategy: 'email_code' });
            setIsVerifyingEmail(true);
            setEmailChangeSuccess(`A verification code has been sent to ${trimmedEmail}. Please enter it below.`);
        } catch (err: unknown) { // Use unknown for better type safety in catch
            console.error("Error initiating email change:", JSON.stringify(err, null, 2));
            if (isClerkAPIResponseError(err)) {
                const reverificationError = err.errors.find(e => e.code === 'session_reverification_required');
                if (reverificationError) {
                    setEmailChangeError(reverificationError.longMessage || "Please re-authenticate to change your email. You might need to complete an additional verification step.");
                    Alert.alert(
                        "Re-authentication Required",
                        reverificationError.longMessage || "Changing your email is a sensitive action. Please complete any re-authentication steps prompted by the application. If no prompt appears, you might need to sign out and sign back in to refresh your session's security before trying again."
                    );
                } else {
                    const firstError = err.errors[0];
                    setEmailChangeError(firstError?.longMessage || firstError?.message || "An error occurred. Please try again.");
                }
            } else if (err instanceof Error) {
                 setEmailChangeError(err.message || "An unexpected error occurred. Please try again.");
            } else {
                setEmailChangeError("An unexpected error occurred. Please try again.");
            }
            setIsVerifyingEmail(false);
        } finally {
            setIsLoading(false);
        }
    };

    // Function to attempt email verification
    const handleAttemptEmailVerification = async () => {
        if (!clerkUser || !newEmail.trim()) return; 
        if (!verificationCode.trim()) {
            setEmailChangeError("Please enter the verification code.");
            return;
        }
        
        setError(null);
        setSuccessMessage(null);
        setEmailChangeError(null);
        setEmailChangeSuccess(null);
        setIsLoading(true); // General loading for this operation

        try {
            const emailAddressToVerify = clerkUser.emailAddresses.find(
                (ea) => ea.emailAddress === newEmail && ea.verification.status !== 'verified'
            );

            if (!emailAddressToVerify) {
                setEmailChangeError("Could not find the email address to verify. Please try initiating the change again.");
                setIsVerifyingEmail(false);
                setIsLoading(false);
                return;
            }

            const verifiedEmailAddress = await emailAddressToVerify.attemptVerification({ code: verificationCode });

            if (verifiedEmailAddress.verification.status === 'verified') {
                const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'; 
                const token = await getToken(); // Get token using useAuth

                const response = await fetch(`${backendUrl}/api/user/set-primary-email`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` // Use the obtained token
                    },
                    body: JSON.stringify({ newEmailAddressId: verifiedEmailAddress.id }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to set new email as primary.');
                }

                setEmailChangeSuccess('Email address changed and verified successfully! It is now your primary email.');
                setIsVerifyingEmail(false);
                setNewEmail('');
                setVerificationCode('');
                await clerkUser.reload();
            } else {
                setEmailChangeError("Verification failed. Please check the code and try again.");
            }
        } catch (err: any) {
            console.error("Error verifying email:", JSON.stringify(err, null, 2));
            const errMsg = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || (err.message || "Verification failed. Please try again.");
            setEmailChangeError(errMsg);
        } finally {
            setIsLoading(false); // Clear general loading
        }
    };

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

    if (!isClientMounted || !clerkIsLoaded) {
        return <ActivityIndicator style={styles.loader} size="large" color="#003366" />;
    }

    if (!isSignedIn || !clerkUser) {
        return <View style={styles.safeArea}><Text>Please sign in to view your profile.</Text></View>;
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView 
                style={styles.safeArea}
                contentContainerStyle={styles.scrollContentContainer}
                keyboardShouldPersistTaps="handled"
            >
                <TouchableOpacity onPress={pickImage} style={styles.profileImageContainer} disabled={isLoading}>
                    <Image
                    source={{ uri: newImageUri || profileImageUri || 'https://dummyimage.com/150x150/ccc/000.png&text=Profile' }} 
                    style={styles.avatar}
                    />
                <View style={styles.editIconOverlay}> 
                    <Edit2 size={16} color={COLORS.white} />
                    </View>
                </TouchableOpacity>
                {/* Display Username */}
                {clerkUser.username && (
                    <Text style={styles.usernameText}>@{clerkUser.username}</Text>
                )}

                <Text style={styles.title}>Edit Profile</Text>
                <Text style={styles.description}>Update your details below.</Text>

                <View style={styles.inputContainer}>
                    <Ionicons name="person-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                    <TextInput
                        placeholder="First Name"
                        value={firstName}
                        onChangeText={setFirstName}
                        style={styles.input}
                        placeholderTextColor={COLORS.darkText}
                        editable={!isLoading} // Disable if any loading
                    />
                </View>
                <View style={styles.inputContainer}>
                    <Ionicons name="person-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                    <TextInput
                        placeholder="Last Name"
                        value={lastName}
                        onChangeText={(text) => {
                            setLastName(text);
                            setError(null);
                            setSuccessMessage(null);
                        }}
                        style={styles.input}
                        placeholderTextColor={COLORS.darkText}
                        editable={!isLoading} // Disable if any loading
                    />
                </View>
                
                <View style={styles.inputContainer}> 
                    <Ionicons name="map-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                        <Picker
                        selectedValue={selectedState}
                            onValueChange={(itemValue) => setSelectedState(itemValue)}
                        style={styles.input}
                        dropdownIconColor={COLORS.primary}
                        enabled={!isLoading} // Disable if any loading
                        >
                        <Picker.Item label="Select State..." value={null} />
                            {availableStates.map(state => (
                                <Picker.Item key={state.value} label={state.label} value={state.value} />
                            ))}
                        </Picker>
                     </View>

                {/* Moved Save Changes Button and general messages UP */}
                <TouchableOpacity
                    style={[styles.button, isLoading && styles.buttonDisabled, {marginTop: 20}] } 
                    onPress={handleSaveChanges}
                    disabled={isLoading} // Simply disable if isLoading is true
                >
                    {isLoading && !isVerifyingEmail ? ( // Show spinner if general save, not email verify
                        <ActivityIndicator color={COLORS.white} />
                    ) : (
                        <><Check size={20} color={COLORS.white} style={{marginRight: 8}} /><Text style={styles.buttonText}>Save Profile Changes</Text></> 
                    )}
                </TouchableOpacity>

                {error && <Text style={styles.errorText}>{error}</Text>}
                {successMessage && !emailChangeSuccess && !emailChangeError && <Text style={styles.successText}>{successMessage}</Text>}

                {/* --- Change Email Section --- */}
                <Text style={styles.sectionTitle}>Change Email</Text>

                {!isVerifyingEmail ? (
                    <>
                        <Text style={styles.inputLabel}>New Email Address</Text>
                        <View style={styles.inputContainer}>
                            <MaterialCommunityIcons name="email-outline" size={20} color="#666" style={styles.icon} />
                            <TextInput
                                value={newEmail}
                                onChangeText={(text) => {
                                    setNewEmail(text);
                                    setEmailChangeError(null); 
                                    setEmailChangeSuccess(null);
                                }}
                                placeholder="Enter new email"
                                style={styles.input}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                editable={!isLoading} // Disable if any loading
                            />
                        </View>
                        {emailChangeError && !isVerifyingEmail && <Text style={styles.errorText}>{emailChangeError}</Text>}
                        <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleInitiateEmailChange} disabled={isLoading}>
                            <Text style={styles.buttonText}>{isLoading && isVerifyingEmail === false ? 'Sending...' : 'Send Verification Code'}</Text> 
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <Text style={styles.inputLabel}>Verification Code</Text>
                        <View style={styles.inputContainer}>
                            <MaterialCommunityIcons name="numeric" size={20} color="#666" style={styles.icon} />
                            <TextInput
                                value={verificationCode}
                                onChangeText={(text) => {
                                    setVerificationCode(text);
                                    setEmailChangeError(null); 
                                }}
                                placeholder="Enter verification code"
                                style={styles.input}
                                keyboardType="number-pad"
                                editable={!isLoading} // Disable if any loading
                            />
                        </View>
                        {emailChangeError && isVerifyingEmail && <Text style={styles.errorText}>{emailChangeError}</Text>}
                        {emailChangeSuccess && <Text style={styles.successText}>{emailChangeSuccess}</Text>}
                        <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleAttemptEmailVerification} disabled={isLoading}>
                            <Text style={styles.buttonText}>{isLoading && isVerifyingEmail === true ? 'Verifying...' : 'Verify and Update Email'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.button, styles.cancelButton, isLoading && styles.buttonDisabled]} 
                            onPress={() => {
                                setIsVerifyingEmail(false);
                                setNewEmail('');
                                setVerificationCode('');
                                setEmailChangeError(null);
                                setEmailChangeSuccess(null);
                                setError(null); 
                                setSuccessMessage(null); 
                            }}
                            disabled={isLoading} 
                        >
                            <Text style={styles.buttonText}>Cancel</Text>
                        </TouchableOpacity>
                    </>
                )}
                {/* End of Change Email Section */}
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
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
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
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        paddingHorizontal: 10,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        paddingVertical: Platform.OS === 'ios' ? 15 : 12,
        fontSize: 16,
        color: '#333',
    },
    button: {
        backgroundColor: '#003366',
        paddingVertical: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 10,
    },
    buttonDisabled: {
        backgroundColor: '#a0a0a0',
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    errorText: {
        color: 'red',
        marginBottom: 10,
        textAlign: 'center',
    },
    successText: {
        color: 'green',
        marginBottom: 10,
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 20,
        marginBottom: 15,
    },
    cancelButton: {
        backgroundColor: '#888',
        marginTop: 5,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#444',
        marginBottom: 8,
        marginLeft: 2,
    },
    icon: {
        marginRight: 10,
    },
    usernameText: { // Style for the username
        fontSize: 16,
        fontWeight: '600',
        color: '#888888',
        textAlign: 'center',
        marginBottom: 20,
    },
}); 

export default ProfileSettingsScreen; 