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
    { label: 'Alabama', value: 'AL' },
    { label: 'Alaska', value: 'AK' },
    { label: 'Arizona', value: 'AZ' },
    { label: 'Arkansas', value: 'AR' },
    { label: 'California', value: 'CA' },
    { label: 'Colorado', value: 'CO' },
    { label: 'Connecticut', value: 'CT' },
    { label: 'Delaware', value: 'DE' },
    { label: 'Florida', value: 'FL' },
    { label: 'Georgia', value: 'GA' },
    { label: 'Hawaii', value: 'HI' },
    { label: 'Idaho', value: 'ID' },
    { label: 'Illinois', value: 'IL' },
    { label: 'Indiana', value: 'IN' },
    { label: 'Iowa', value: 'IA' },
    { label: 'Kansas', value: 'KS' },
    { label: 'Kentucky', value: 'KY' },
    { label: 'Louisiana', value: 'LA' },
    { label: 'Maine', value: 'ME' },
    { label: 'Maryland', value: 'MD' },
    { label: 'Massachusetts', value: 'MA' },
    { label: 'Michigan', value: 'MI' },
    { label: 'Minnesota', value: 'MN' },
    { label: 'Mississippi', value: 'MS' },
    { label: 'Missouri', value: 'MO' },
    { label: 'Montana', value: 'MT' },
    { label: 'Nebraska', value: 'NE' },
    { label: 'Nevada', value: 'NV' },
    { label: 'New Hampshire', value: 'NH' },
    { label: 'New Jersey', value: 'NJ' },
    { label: 'New Mexico', value: 'NM' },
    { label: 'New York', value: 'NY' },
    { label: 'North Carolina', value: 'NC' },
    { label: 'North Dakota', value: 'ND' },
    { label: 'Ohio', value: 'OH' },
    { label: 'Oklahoma', value: 'OK' },
    { label: 'Oregon', value: 'OR' },
    { label: 'Pennsylvania', value: 'PA' },
    { label: 'Rhode Island', value: 'RI' },
    { label: 'South Carolina', value: 'SC' },
    { label: 'South Dakota', value: 'SD' },
    { label: 'Tennessee', value: 'TN' },
    { label: 'Texas', value: 'TX' },
    { label: 'Utah', value: 'UT' },
    { label: 'Vermont', value: 'VT' },
    { label: 'Virginia', value: 'VA' },
    { label: 'Washington', value: 'WA' },
    { label: 'West Virginia', value: 'WV' },
    { label: 'Wisconsin', value: 'WI' },
    { label: 'Wyoming', value: 'WY' },
];

// Define organizations
const organizationOptions = [
    { label: 'None', value: 'None' },
    { label: 'ASHI (American Society of Home Inspectors)', value: 'ASHI' },
    { label: 'InterNACHI (International Association of Certified Home Inspectors)', value: 'InterNACHI' },
    { label: 'Other', value: 'Other' },
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
    const [secondaryStates, setSecondaryStates] = useState<string[]>([]);
    const [organization, setOrganization] = useState<string>('None');
    const [phoneNumber, setPhoneNumber] = useState<string>('');
    const [companyName, setCompanyName] = useState<string>('');
    const [profileImageUri, setProfileImageUri] = useState<string | null>(null); // Local URI for display/upload
    const [profileImageBase64, setProfileImageBase64] = useState<string | null>(null); // Store base64
    const [initialImageUri, setInitialImageUri] = useState<string | null>(null); // To track if image changed
    const [newImageUri, setNewImageUri] = useState<string | null>(null); // URI of newly selected image
    const [newImageBlob, setNewImageBlob] = useState<Blob | null>(null); // Blob for upload
    const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

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

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

    // Load profile from backend
    const loadProfile = async () => {
        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/api/user/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.profile) {
                    setSelectedState(data.profile.primary_state || null);
                    setSecondaryStates(data.profile.secondary_states || []);
                    setOrganization(data.profile.organization || 'None');
                    setPhoneNumber(data.profile.phone_number || '');
                    setCompanyName(data.profile.company_name || '');
                }
            }
        } catch (err) {
            console.error('Error loading profile:', err);
        }
    };

    // Initialize form fields (just use user data, no auto-edit)
    useEffect(() => {
        setIsClientMounted(true); // Set client mounted state
        if (clerkUser) {
            setFirstName(clerkUser.firstName || '');
            setLastName(clerkUser.lastName || '');
            // Load state from unsafeMetadata as fallback, but prefer backend
            setSelectedState(clerkUser.unsafeMetadata?.inspectionState as string || null);
            if (!newImageUri) { // Only set from clerkUser if no new image is staged
                setProfileImageUri(clerkUser.imageUrl || null);
                setInitialImageUri(clerkUser.imageUrl || null);
            }
            setProfileImageBase64(null); // Ensure base64 is cleared on load/mode switch
            // Load profile from backend
            loadProfile();
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
            setError("Please ensure First Name, Last Name, and State are provided.");
            return;
        }

        setIsLoading(true); 
        setIsSavingProfile(true);
        setError(null);
        setSuccessMessage(null); 
        setEmailChangeError(null);
        setEmailChangeSuccess(null);
        let imageUpdateSuccess = true; 

        try {
            // --- Step 1: Handle Profile Image Update ---
            if (newImageBlob) {
                console.log("Profile image changed, attempting update with blob...");
                await clerkUser.setProfileImage({
                    file: newImageBlob,
                });
                console.log("Profile image updated successfully on Clerk (using blob).");
                setInitialImageUri(newImageUri);
                setNewImageUri(null);
                setNewImageBlob(null);
            }

            // --- Step 2: Handle Clerk Updates (name, state in metadata) ---
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
                }
            }

            // --- Step 3: Save to Backend (profile with all new fields) ---
            const token = await getToken();
            const backendResponse = await fetch(`${API_URL}/api/user/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    primaryState: selectedState,
                    secondaryStates: secondaryStates,
                    organization: organization,
                    phoneNumber: phoneNumber,
                    companyName: companyName,
                    profilePhotoUrl: clerkUser.imageUrl
                })
            });

            if (!backendResponse.ok) {
                const errorData = await backendResponse.json();
                throw new Error(errorData.message || 'Failed to save profile to backend');
            }

            setIsEditing(false);
            setSuccessMessage('Profile updated successfully!');
            Alert.alert("Success", "Profile updated successfully!");

        } catch (err: any) {
            console.error("Error saving profile:", err);
            const errMessage = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || err.message || "Failed to save profile details.";
            setError(errMessage); 
        } finally {
            setIsLoading(false);
            setIsSavingProfile(false);
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
                    const userFriendlyMessage = "This action requires enhanced security. Please sign out and sign back in to continue. If the issue persists after signing back in, please contact support.";
                    setEmailChangeError(userFriendlyMessage);
                    Alert.alert(
                        "Additional Verification Needed",
                        userFriendlyMessage
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
                
                {/* Phone Number */}
                <View style={styles.inputContainer}>
                    <Ionicons name="call-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                    <TextInput
                        placeholder="Phone Number"
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        style={styles.input}
                        placeholderTextColor={COLORS.darkText}
                        keyboardType="phone-pad"
                        editable={!isLoading}
                    />
                </View>

                {/* Company Name */}
                <View style={styles.inputContainer}>
                    <Ionicons name="business-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                    <TextInput
                        placeholder="Company Name (Optional)"
                        value={companyName}
                        onChangeText={setCompanyName}
                        style={styles.input}
                        placeholderTextColor={COLORS.darkText}
                        editable={!isLoading}
                    />
                </View>

                {/* Primary State */}
                <Text style={styles.fieldLabel}>Primary State</Text>
                <View style={styles.inputContainer}> 
                    <Ionicons name="map-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                    <Picker
                        selectedValue={selectedState}
                        onValueChange={(itemValue) => setSelectedState(itemValue)}
                        style={styles.input}
                        dropdownIconColor={COLORS.primary}
                        enabled={!isLoading}
                    >
                        <Picker.Item label="Select Primary State..." value={null} />
                        {availableStates.map(state => (
                            <Picker.Item key={state.value} label={state.label} value={state.value} />
                        ))}
                    </Picker>
                </View>

                {/* Secondary States */}
                <Text style={styles.fieldLabel}>Secondary States (up to 3)</Text>
                <Text style={styles.fieldHint}>Select additional states where you perform inspections</Text>
                <View style={styles.secondaryStatesContainer}>
                    {[0, 1, 2].map((index) => (
                        <View key={index} style={styles.secondaryStatePickerWrapper}>
                            <Picker
                                selectedValue={secondaryStates[index] || ''}
                                onValueChange={(itemValue) => {
                                    const newSecondaryStates = [...secondaryStates];
                                    if (itemValue) {
                                        newSecondaryStates[index] = itemValue;
                                    } else {
                                        newSecondaryStates.splice(index, 1);
                                    }
                                    setSecondaryStates(newSecondaryStates.filter(Boolean));
                                }}
                                style={styles.secondaryStatePicker}
                                dropdownIconColor={COLORS.primary}
                                enabled={!isLoading}
                            >
                                <Picker.Item label={`State ${index + 1} (Optional)`} value="" />
                                {availableStates
                                    .filter(s => s.value !== selectedState && !secondaryStates.includes(s.value))
                                    .map(state => (
                                        <Picker.Item key={state.value} label={state.label} value={state.value} />
                                    ))}
                                {secondaryStates[index] && (
                                    <Picker.Item 
                                        label={availableStates.find(s => s.value === secondaryStates[index])?.label || secondaryStates[index]} 
                                        value={secondaryStates[index]} 
                                    />
                                )}
                            </Picker>
                        </View>
                    ))}
                </View>

                {/* Organization */}
                <Text style={styles.fieldLabel}>Professional Organization</Text>
                <View style={styles.inputContainer}> 
                    <Ionicons name="ribbon-outline" size={20} color={COLORS.darkText} style={styles.inputIcon} />
                    <Picker
                        selectedValue={organization}
                        onValueChange={(itemValue) => setOrganization(itemValue)}
                        style={styles.input}
                        dropdownIconColor={COLORS.primary}
                        enabled={!isLoading}
                    >
                        {organizationOptions.map(org => (
                            <Picker.Item key={org.value} label={org.label} value={org.value} />
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
                                    // setEmailChangeSuccess(null); // Keep success message until next action
                                }}
                                placeholder="Enter new email"
                                style={styles.input}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                editable={!isLoading} // Disable if any loading
                            />
                        </View>
                        {/* Display success message here if it exists */}
                        {emailChangeSuccess && <Text style={styles.successText}>{emailChangeSuccess}</Text>} 
                        {/* Display error message here if it exists (and no success message) */}
                        {emailChangeError && !isVerifyingEmail && !emailChangeSuccess && <Text style={styles.errorText}>{emailChangeError}</Text>}
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
                        {/* THIS ERROR IS FINE HERE AS IT PERTAINS TO THE CURRENT VERIFICATION ATTEMPT */}
                        {emailChangeError && isVerifyingEmail && <Text style={styles.errorText}>{emailChangeError}</Text>}
                        {/* SUCCESS MESSAGE DURING VERIFICATION IS NO LONGER THE PRIMARY ONE */}
                        {/* {emailChangeSuccess && <Text style={styles.successText}>{emailChangeSuccess}</Text>} */}
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
    fieldLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.darkText,
        marginBottom: 8,
        marginTop: 10,
    },
    fieldHint: {
        fontSize: 12,
        color: '#888',
        marginBottom: 8,
    },
    secondaryStatesContainer: {
        marginBottom: 15,
    },
    secondaryStatePickerWrapper: {
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    secondaryStatePicker: {
        height: 50,
        color: '#333',
    },
}); 

export default ProfileSettingsScreen; 