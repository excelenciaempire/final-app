import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Image, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Platform, SafeAreaView, useWindowDimensions } from 'react-native';
import { useUser, useAuth, isClerkAPIResponseError } from '@clerk/clerk-expo';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../styles/colors';
import { Check, Edit2, User, Phone, Building, MapPin, Award, Mail, ChevronDown } from 'lucide-react-native';
import StatementUsageCard from '../components/StatementUsageCard';
import AdBanner from '../components/AdBanner';
import { useGlobalState } from '../context/GlobalStateContext';

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

// Define organizations - multi-select options
const organizationOptions = [
    { label: 'ASHI (American Society of Home Inspectors)', value: 'ASHI' },
    { label: 'InterNACHI (International Association of Certified Home Inspectors)', value: 'InterNACHI' },
    { label: 'Inspector Nation', value: 'Inspector Nation' },
    { label: 'NAHI (National Association of Home Inspectors)', value: 'NAHI' },
    { label: 'CREIA (California Real Estate Inspection Association)', value: 'CREIA' },
    { label: 'TPREIA (Texas Professional Real Estate Inspectors Association)', value: 'TPREIA' },
    { label: 'Other', value: 'Other' },
];

const ProfileSettingsScreen: React.FC = () => {
    const { isLoaded, isSignedIn, user } = useUser();
    const { signOut, getToken } = useAuth();
    const { width } = useWindowDimensions();
    const { 
        selectedState: globalState, 
        setSelectedState: setGlobalState, 
        selectedOrganization: globalOrganization,
        setSelectedOrganization: setGlobalOrganization 
    } = useGlobalState();

    // State for editable fields
    const [firstName, setFirstName] = useState<string>('');
    const [lastName, setLastName] = useState<string>('');
    const [selectedState, setSelectedState] = useState<string | null>(globalState);
    const [secondaryStates, setSecondaryStates] = useState<string[]>([]);
    const [organizations, setOrganizations] = useState<string[]>([]);
    const [phoneNumber, setPhoneNumber] = useState<string>('');
    const [companyName, setCompanyName] = useState<string>('');
    const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
    const [newImageUri, setNewImageUri] = useState<string | null>(null);
    const [newImageBlob, setNewImageBlob] = useState<Blob | null>(null);
    const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [stateSopInfo, setStateSopInfo] = useState<{ hasSpecificSop: boolean; sopName: string | null; isDefault: boolean; isLoading: boolean }>({ hasSpecificSop: false, sopName: null, isDefault: false, isLoading: true });

    // States for email change
    const [newEmail, setNewEmail] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
    const [emailChangeError, setEmailChangeError] = useState<string | null>(null);
    const [emailChangeSuccess, setEmailChangeSuccess] = useState<string | null>(null);
    const [useDirectChange, setUseDirectChange] = useState(false); // Fallback when 2FA blocks verification

    const [isClientMounted, setIsClientMounted] = useState(false);
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
                    // Handle both array and string formats for organizations
                    const orgData = data.profile.organizations || data.profile.organization;
                    if (Array.isArray(orgData)) {
                        setOrganizations(orgData);
                    } else if (orgData && orgData !== 'None') {
                        setOrganizations([orgData]);
                    } else {
                        setOrganizations([]);
                    }
                    setPhoneNumber(data.profile.phone_number || '');
                    setCompanyName(data.profile.company_name || '');
                }
            }
        } catch (err) {
            console.error('Error loading profile:', err);
        }
    };

    // Initialize form fields
    useEffect(() => {
        setIsClientMounted(true);
        if (clerkUser) {
            setFirstName(clerkUser.firstName || '');
            setLastName(clerkUser.lastName || '');
            // Only set from Clerk if globalState is not available
            if (!globalState) {
                setSelectedState(clerkUser.unsafeMetadata?.inspectionState as string || null);
            }
            if (!newImageUri) {
                setProfileImageUri(clerkUser.imageUrl || null);
            }
            loadProfile();
        }
    }, [clerkUser]);

    // Sync local state with global state when sidebar changes
    useEffect(() => {
        if (globalState && globalState !== selectedState) {
            setSelectedState(globalState);
        }
    }, [globalState]);

    // Fetch SOP info for the selected state
    useEffect(() => {
        const fetchStateSopInfo = async () => {
            if (!selectedState) {
                setStateSopInfo({ hasSpecificSop: false, sopName: null, isDefault: false, isLoading: false });
                return;
            }
            setStateSopInfo(prev => ({ ...prev, isLoading: true }));
            try {
                const token = await getToken();
                const response = await fetch(`${API_URL}/api/sop/active?state=${selectedState}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.stateSop) {
                        setStateSopInfo({
                            hasSpecificSop: !data.stateSop.isDefault,
                            sopName: data.stateSop.documentName,
                            isDefault: data.stateSop.isDefault || false,
                            isLoading: false
                        });
                    } else {
                        setStateSopInfo({ hasSpecificSop: false, sopName: null, isDefault: false, isLoading: false });
                    }
                } else {
                    setStateSopInfo(prev => ({ ...prev, isLoading: false }));
                }
            } catch (err) {
                console.error('Error fetching SOP info:', err);
                setStateSopInfo(prev => ({ ...prev, isLoading: false }));
            }
        };
        fetchStateSopInfo();
    }, [selectedState, getToken]);

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

    const handleSaveChanges = async () => {
        if (!clerkUser) return;

        if (!firstName || !lastName || !selectedState) {
            setError("Please ensure First Name, Last Name, and State are provided.");
            return;
        }

        setIsLoading(true);
        setIsSavingProfile(true);
        setError(null);
        setSuccessMessage(null);

        try {
            // Handle Profile Image Update
            if (newImageBlob) {
                await clerkUser.setProfileImage({ file: newImageBlob });
                setNewImageUri(null);
                setNewImageBlob(null);
            }

            // Handle Clerk Updates
            const updates: any = {};
            if (firstName !== clerkUser.firstName) updates.firstName = firstName;
            if (lastName !== clerkUser.lastName) updates.lastName = lastName;
            if (selectedState !== clerkUser.unsafeMetadata?.inspectionState) {
                updates.unsafeMetadata = { ...clerkUser.unsafeMetadata, inspectionState: selectedState };
            }
            if (Object.keys(updates).length > 0) {
                await clerkUser.update(updates);
            }

            // Save to Backend
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
                    organizations: organizations,
                    organization: organizations.length > 0 ? organizations[0] : null, // For backward compatibility
                    phoneNumber: phoneNumber,
                    companyName: companyName,
                    profilePhotoUrl: clerkUser.imageUrl
                })
            });

            if (!backendResponse.ok) {
                const errorData = await backendResponse.json();
                throw new Error(errorData.message || 'Failed to save profile to backend');
            }

            // Sync with global state so sidebar and other screens update immediately
            if (selectedState) {
                setGlobalState(selectedState);
            }
            if (organizations.length > 0) {
                setGlobalOrganization(organizations[0]);
            }

            setSuccessMessage('Profile updated successfully!');
            Alert.alert("Success", "Profile updated successfully!");

        } catch (err: any) {
            console.error("Error saving profile:", err);
            setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || err.message || "Failed to save profile details.");
        } finally {
            setIsLoading(false);
            setIsSavingProfile(false);
        }
    };

    // Step 1: Send verification code to new email
    const handleSendVerificationCode = async () => {
        if (!clerkUser) return;
        const trimmedEmail = newEmail.trim().toLowerCase();
        
        if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
            setEmailChangeError("Please enter a valid email address.");
            return;
        }

        // Check if same as current
        if (trimmedEmail === clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase()) {
            setEmailChangeError("This is already your current email address.");
            return;
        }

        setEmailChangeError(null);
        setEmailChangeSuccess(null);
        setIsLoading(true);

        try {
            // Try standard verification flow first
            const createdEmailAddress = await clerkUser.createEmailAddress({ email: trimmedEmail });
            await createdEmailAddress.prepareVerification({ strategy: 'email_code' });
            
            setIsVerifyingEmail(true);
            setEmailChangeSuccess(`Verification code sent to ${trimmedEmail}. Please check your inbox.`);
            
        } catch (err: unknown) {
            console.error("Error sending verification code:", err);
            
            if (isClerkAPIResponseError(err)) {
                const firstError = err.errors[0];
                const errorCode = firstError?.code;
                const errorMessage = firstError?.longMessage || firstError?.message || "";
                
                if (errorCode === 'form_identifier_exists' || errorMessage.includes('already exists')) {
                    setEmailChangeError("This email address is already registered to another account.");
                } else if (errorMessage.includes('additional verification') || errorCode === 'verification_required') {
                    // 2FA is blocking - offer direct change as alternative
                    setUseDirectChange(true);
                    setEmailChangeError("Your account has additional security. Click 'Change Email Directly' to proceed without verification code.");
                } else {
                    setEmailChangeError(errorMessage || "Could not send verification code.");
                }
            } else if (err instanceof Error) {
                setEmailChangeError(err.message);
            } else {
                setEmailChangeError("An unexpected error occurred.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Step 2: Verify the code and complete email change
    const handleVerifyAndChangeEmail = async () => {
        if (!clerkUser || !newEmail.trim()) return;
        
        if (!verificationCode.trim()) {
            setEmailChangeError("Please enter the verification code.");
            return;
        }

        setEmailChangeError(null);
        setIsLoading(true);

        try {
            const emailAddressToVerify = clerkUser.emailAddresses.find(
                (ea) => ea.emailAddress.toLowerCase() === newEmail.trim().toLowerCase() && 
                        ea.verification.status !== 'verified'
            );

            if (!emailAddressToVerify) {
                setEmailChangeError("Could not find the email address to verify. Please try again.");
                setIsVerifyingEmail(false);
                setIsLoading(false);
                return;
            }

            const verifiedEmailAddress = await emailAddressToVerify.attemptVerification({ 
                code: verificationCode 
            });

            if (verifiedEmailAddress.verification.status === 'verified') {
                // Get the old email before changing primary
                const oldEmailAddress = clerkUser.primaryEmailAddress;
                const oldEmailString = oldEmailAddress?.emailAddress;
                const oldEmailId = oldEmailAddress?.id;
                
                // Set as primary email
                await clerkUser.update({ 
                    primaryEmailAddressId: verifiedEmailAddress.id 
                });

                // CRITICAL: Use backend API to cleanup old emails - more reliable than frontend destroy()
                try {
                    const token = await getToken();
                    
                    // First sync with backend
                    await fetch(`${API_URL}/api/user/sync-email`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ 
                            newEmail: newEmail.trim(),
                            oldEmail: oldEmailString
                        }),
                    });

                    // Then cleanup old emails from Clerk via backend (more reliable)
                    const cleanupResponse = await fetch(`${API_URL}/api/user/cleanup-emails`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    const cleanupData = await cleanupResponse.json();
                    console.log('[ProfileSettings] Email cleanup result:', cleanupData);
                    
                    if (cleanupData.deletedEmails?.length > 0) {
                        console.log('[ProfileSettings] Old emails deleted:', cleanupData.deletedEmails);
                    }
                } catch (syncError) {
                    console.warn('[ProfileSettings] Backend cleanup error:', syncError);
                    // Fallback: try frontend destroy as backup
                    if (oldEmailId && oldEmailId !== verifiedEmailAddress.id) {
                        try {
                            await oldEmailAddress?.destroy();
                            console.log('[ProfileSettings] Old email deleted via frontend:', oldEmailString);
                        } catch (deleteErr) {
                            console.warn('[ProfileSettings] Frontend delete also failed:', deleteErr);
                        }
                    }
                }

                setEmailChangeSuccess('Email changed successfully! You can no longer use your old email to log in.');
                setIsVerifyingEmail(false);
                setNewEmail('');
                setVerificationCode('');
                await clerkUser.reload();
            } else {
                setEmailChangeError("Invalid verification code. Please try again.");
            }
        } catch (err: any) {
            console.error("Error verifying email:", err);
            if (err.errors?.[0]?.code === 'form_code_incorrect') {
                setEmailChangeError("Invalid verification code. Please check and try again.");
            } else {
                setEmailChangeError(err.errors?.[0]?.message || err.message || "Verification failed.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Direct change (fallback when 2FA blocks verification)
    // This uses the backend Admin API which is more reliable for email changes
    const handleDirectEmailChange = async () => {
        if (!clerkUser) return;
        const trimmedEmail = newEmail.trim().toLowerCase();
        
        setEmailChangeError(null);
        setEmailChangeSuccess(null);
        setIsLoading(true);

        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/api/user/change-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ newEmail: trimmedEmail }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to change email');
            }

            // Show detailed success message
            let successMsg = `Email changed successfully to: ${trimmedEmail}`;
            if (data.deletedEmails && data.deletedEmails.length > 0) {
                successMsg += `\n\nOld email(s) removed: ${data.deletedEmails.join(', ')}`;
            }
            if (data.warning) {
                successMsg += `\n\n⚠️ ${data.warning}`;
            }

            setEmailChangeSuccess(successMsg);
            setNewEmail('');
            setUseDirectChange(false);
            await clerkUser.reload();
            
        } catch (err: any) {
            console.error("Error changing email directly:", err);
            setEmailChangeError(err.message || "Failed to change email.");
        } finally {
            setIsLoading(false);
        }
    };

    // Cancel email change
    const handleCancelEmailChange = () => {
        setIsVerifyingEmail(false);
        setNewEmail('');
        setVerificationCode('');
        setEmailChangeError(null);
        setEmailChangeSuccess(null);
        setUseDirectChange(false);
    };

    if (!isClientMounted || !clerkIsLoaded) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    if (!isSignedIn || !clerkUser) {
        return (
            <View style={styles.safeArea}>
                <Text>Please sign in to view your profile.</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContentContainer}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Usage & Ad Banner for free users */}
                <StatementUsageCard />
                <AdBanner />
                
                {/* Profile Image */}
                <TouchableOpacity onPress={pickImage} style={styles.profileImageContainer} disabled={isLoading}>
                    <Image
                        source={{ uri: newImageUri || profileImageUri || 'https://dummyimage.com/150x150/ccc/000.png&text=Profile' }}
                        style={styles.avatar}
                    />
                    <View style={styles.editIconOverlay}>
                        <Edit2 size={14} color="#fff" />
                    </View>
                </TouchableOpacity>

                {clerkUser.username && (
                    <Text style={styles.usernameText}>@{clerkUser.username}</Text>
                )}

                <Text style={styles.title}>Edit Profile</Text>
                <Text style={styles.description}>Update your details below.</Text>

                {/* First Name */}
                <View style={styles.inputWrapper}>
                    <User size={18} color={COLORS.primary} style={styles.inputIcon} />
                    <TextInput
                        placeholder="First Name"
                        value={firstName}
                        onChangeText={setFirstName}
                        style={styles.input}
                        placeholderTextColor="#999"
                        editable={!isLoading}
                    />
                </View>

                {/* Last Name */}
                <View style={styles.inputWrapper}>
                    <User size={18} color={COLORS.primary} style={styles.inputIcon} />
                    <TextInput
                        placeholder="Last Name"
                        value={lastName}
                        onChangeText={setLastName}
                        style={styles.input}
                        placeholderTextColor="#999"
                        editable={!isLoading}
                    />
                </View>

                {/* Phone Number */}
                <View style={styles.inputWrapper}>
                    <Phone size={18} color={COLORS.primary} style={styles.inputIcon} />
                    <TextInput
                        placeholder="Phone Number"
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        style={styles.input}
                        placeholderTextColor="#999"
                        keyboardType="phone-pad"
                        editable={!isLoading}
                    />
                </View>

                {/* Company Name */}
                <View style={styles.inputWrapper}>
                    <Building size={18} color={COLORS.primary} style={styles.inputIcon} />
                    <TextInput
                        placeholder="Company Name (Optional)"
                        value={companyName}
                        onChangeText={setCompanyName}
                        style={styles.input}
                        placeholderTextColor="#999"
                        editable={!isLoading}
                    />
                </View>

                {/* Primary State */}
                <Text style={styles.fieldLabel}>Primary State</Text>
                <View style={styles.pickerWrapper}>
                    <MapPin size={18} color={COLORS.primary} style={styles.inputIcon} />
                    <Picker
                        selectedValue={selectedState}
                        onValueChange={(itemValue) => {
                            setSelectedState(itemValue);
                            // Immediately sync with global state (which auto-saves to backend)
                            if (itemValue) {
                                setGlobalState(itemValue);
                            }
                        }}
                        style={styles.picker}
                        dropdownIconColor={COLORS.primary}
                        enabled={!isLoading}
                    >
                        <Picker.Item label="Select Primary State..." value={null} />
                        {availableStates.map(state => (
                            <Picker.Item key={state.value} label={state.label} value={state.value} />
                        ))}
                    </Picker>
                </View>

                {/* Standards of Practice Notice - Dynamic based on state SOP */}
                {selectedState && !stateSopInfo.isLoading && (
                    <View style={[styles.sopNoticeContainer, stateSopInfo.hasSpecificSop && styles.sopNoticeContainerState]}>
                        <Award size={18} color={stateSopInfo.hasSpecificSop ? "#059669" : "#0369A1"} />
                        <View style={styles.sopNoticeTextContainer}>
                            <Text style={styles.sopNoticeTitle}>Standards of Practice Notice</Text>
                            <Text style={styles.sopNoticeText}>
                                {stateSopInfo.hasSpecificSop ? (
                                    <>
                                        Your reports will use <Text style={styles.sopNoticeHighlight}>{stateSopInfo.sopName}</Text> as 
                                        the reference for {availableStates.find(s => s.value === selectedState)?.label || selectedState}. 
                                        This is a state-specific standard.
                                    </>
                                ) : (
                                    <>
                                        Your reports will use <Text style={styles.sopNoticeHighlight}>{stateSopInfo.sopName || 'InterNACHI Standards of Practice'}</Text> as 
                                        the default reference for {availableStates.find(s => s.value === selectedState)?.label || selectedState}. 
                                        {!organizations.includes('InterNACHI') && ' If you belong to InterNACHI, select it below to ensure your membership is on record.'}
                                    </>
                                )}
                            </Text>
                        </View>
                    </View>
                )}

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

                {/* Organizations - Multi-select */}
                <Text style={styles.fieldLabel}>Professional Organizations</Text>
                <Text style={styles.fieldHint}>Select all organizations you belong to</Text>
                <View style={styles.organizationsContainer}>
                    {organizationOptions.map(org => {
                        const isSelected = organizations.includes(org.value);
                        return (
                            <TouchableOpacity
                                key={org.value}
                                style={[
                                    styles.organizationChip,
                                    isSelected && styles.organizationChipSelected
                                ]}
                                onPress={() => {
                                    if (isSelected) {
                                        setOrganizations(organizations.filter(o => o !== org.value));
                                    } else {
                                        setOrganizations([...organizations, org.value]);
                                    }
                                }}
                                disabled={isLoading}
                            >
                                <View style={[
                                    styles.checkbox,
                                    isSelected && styles.checkboxSelected
                                ]}>
                                    {isSelected && <Check size={12} color="#fff" />}
                                </View>
                                <Text style={[
                                    styles.organizationChipText,
                                    isSelected && styles.organizationChipTextSelected
                                ]}>
                                    {org.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                {organizations.length > 0 && (
                    <Text style={styles.selectedOrgsText}>
                        Selected: {organizations.join(', ')}
                    </Text>
                )}

                {/* Save Button */}
                <TouchableOpacity
                    style={[styles.saveButton, isLoading && styles.buttonDisabled]}
                    onPress={handleSaveChanges}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Check size={20} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.saveButtonText}>Save Profile Changes</Text>
                        </>
                    )}
                </TouchableOpacity>

                {error && <Text style={styles.errorText}>{error}</Text>}
                {successMessage && <Text style={styles.successText}>{successMessage}</Text>}

                {/* Change Email Section */}
                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>Change Email</Text>
                <Text style={styles.helperText}>
                  A verification code will be sent to your new email address for security.
                </Text>

                <Text style={styles.inputLabel}>Current Email</Text>
                <View style={[styles.inputWrapper, styles.disabledInput]}>
                    <Mail size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
                    <Text style={styles.currentEmailText}>
                        {clerkUser.primaryEmailAddress?.emailAddress || 'No email set'}
                    </Text>
                </View>

                {!isVerifyingEmail ? (
                    <>
                        <Text style={styles.inputLabel}>New Email Address</Text>
                        <View style={styles.inputWrapper}>
                            <Mail size={18} color={COLORS.primary} style={styles.inputIcon} />
                            <TextInput
                                value={newEmail}
                                onChangeText={(text) => {
                                    setNewEmail(text);
                                    setEmailChangeError(null);
                                    setEmailChangeSuccess(null);
                                    setUseDirectChange(false);
                                }}
                                placeholder="Enter new email address"
                                style={styles.input}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                editable={!isLoading}
                            />
                        </View>
                        
                        {emailChangeSuccess && <Text style={styles.successText}>{emailChangeSuccess}</Text>}
                        {emailChangeError && <Text style={styles.errorText}>{emailChangeError}</Text>}
                        
                        <TouchableOpacity
                            style={[styles.secondaryButton, (isLoading || !newEmail.trim()) && styles.buttonDisabled]}
                            onPress={handleSendVerificationCode}
                            disabled={isLoading || !newEmail.trim()}
                        >
                            {isLoading ? (
                                <ActivityIndicator color={COLORS.primary} size="small" />
                            ) : (
                                <Text style={styles.secondaryButtonText}>Send Verification Code</Text>
                            )}
                        </TouchableOpacity>

                        {useDirectChange && (
                            <TouchableOpacity
                                style={[styles.saveButton, { marginTop: 10 }, isLoading && styles.buttonDisabled]}
                                onPress={handleDirectEmailChange}
                                disabled={isLoading || !newEmail.trim()}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.saveButtonText}>Change Email Directly</Text>
                                )}
                            </TouchableOpacity>
                        )}
                    </>
                ) : (
                    <>
                        <Text style={styles.inputLabel}>Verification Code</Text>
                        <Text style={styles.helperText}>
                          Enter the 6-digit code sent to {newEmail}
                        </Text>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                value={verificationCode}
                                onChangeText={(text) => {
                                    setVerificationCode(text.replace(/[^0-9]/g, '').slice(0, 6));
                                    setEmailChangeError(null);
                                }}
                                placeholder="Enter 6-digit code"
                                style={[styles.input, { textAlign: 'center', letterSpacing: 8, fontSize: 20 }]}
                                keyboardType="number-pad"
                                maxLength={6}
                                editable={!isLoading}
                            />
                        </View>
                        
                        {emailChangeError && <Text style={styles.errorText}>{emailChangeError}</Text>}
                        
                        <TouchableOpacity
                            style={[styles.saveButton, (isLoading || verificationCode.length !== 6) && styles.buttonDisabled]}
                            onPress={handleVerifyAndChangeEmail}
                            disabled={isLoading || verificationCode.length !== 6}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.saveButtonText}>Verify & Change Email</Text>
                            )}
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            style={[styles.cancelButton, isLoading && styles.buttonDisabled]}
                            onPress={handleCancelEmailChange}
                            disabled={isLoading}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            style={styles.resendButton}
                            onPress={handleSendVerificationCode}
                            disabled={isLoading}
                        >
                            <Text style={styles.resendButtonText}>Resend Code</Text>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    scrollView: {
        flex: 1,
    },
    scrollContentContainer: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: 20,
        width: '100%',
        maxWidth: 500,
        alignSelf: 'center',
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.textPrimary,
        textAlign: 'center',
        marginBottom: 6,
    },
    description: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    profileImageContainer: {
        marginBottom: 16,
        position: 'relative',
        alignSelf: 'center',
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
        borderColor: COLORS.primary,
        backgroundColor: '#E2E8F0',
    },
    editIconOverlay: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: COLORS.primary,
        padding: 6,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#fff',
    },
    usernameText: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: 16,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingHorizontal: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        minHeight: 48,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        paddingVertical: Platform.OS === 'ios' ? 14 : 12,
        fontSize: 15,
        color: COLORS.textPrimary,
    },
    pickerWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingLeft: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        overflow: 'hidden',
        minHeight: 48,
    },
    picker: {
        flex: 1,
        height: 48,
        color: COLORS.textPrimary,
        // @ts-ignore - Cross-browser compatible styles (Chrome, Safari, Firefox)
        ...(Platform.OS === 'web' && {
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            appearance: 'none',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            width: '100%',
            fontSize: 15,
            paddingLeft: 14,
            paddingRight: 36,
            cursor: 'pointer',
        }),
    },
    fieldLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 8,
        marginTop: 8,
    },
    fieldHint: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 10,
    },
    secondaryStatesContainer: {
        marginBottom: 12,
    },
    secondaryStatePickerWrapper: {
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        overflow: 'hidden',
    },
    secondaryStatePicker: {
        height: 50,
        color: COLORS.textPrimary,
        // @ts-ignore - Cross-browser compatible styles (Chrome, Safari, Firefox)
        ...(Platform.OS === 'web' && {
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            appearance: 'none',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            width: '100%',
            fontSize: 15,
            paddingLeft: 14,
            paddingRight: 36,
            cursor: 'pointer',
        }),
    },
    organizationsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    organizationChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 4,
    },
    organizationChipSelected: {
        backgroundColor: '#EFF6FF',
        borderColor: COLORS.primary,
    },
    organizationChipText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginLeft: 8,
        flexShrink: 1,
    },
    organizationChipTextSelected: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    checkbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    selectedOrgsText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        fontStyle: 'italic',
        marginBottom: 8,
    },
    saveButton: {
        flexDirection: 'row',
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 3,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    secondaryButton: {
        backgroundColor: '#fff',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.primary,
        marginTop: 8,
    },
    secondaryButtonText: {
        color: COLORS.primary,
        fontSize: 15,
        fontWeight: '600',
    },
    cancelButton: {
        backgroundColor: '#F1F5F9',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 8,
    },
    cancelButtonText: {
        color: COLORS.textSecondary,
        fontSize: 15,
        fontWeight: '600',
    },
    errorText: {
        color: '#DC2626',
        fontSize: 13,
        marginTop: 8,
        textAlign: 'center',
    },
    successText: {
        color: '#059669',
        fontSize: 13,
        marginTop: 8,
        textAlign: 'center',
    },
    helperText: {
        color: '#64748B',
        fontSize: 12,
        marginTop: 4,
        marginBottom: 12,
        lineHeight: 18,
    },
    divider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: COLORS.textSecondary,
        marginBottom: 6,
    },
    disabledInput: {
        backgroundColor: '#F1F5F9',
        borderColor: '#E2E8F0',
    },
    currentEmailText: {
        flex: 1,
        paddingVertical: Platform.OS === 'ios' ? 14 : 12,
        fontSize: 15,
        color: COLORS.textSecondary,
    },
    resendButton: {
        marginTop: 16,
        alignItems: 'center',
    },
    resendButtonText: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: '500',
        textDecorationLine: 'underline',
    },
    sopNoticeContainer: {
        flexDirection: 'row',
        backgroundColor: '#F0F9FF',
        borderRadius: 10,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#BAE6FD',
        alignItems: 'flex-start',
        gap: 12,
    },
    sopNoticeContainerState: {
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
    },
    sopNoticeTextContainer: {
        flex: 1,
    },
    sopNoticeTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0369A1',
        marginBottom: 4,
    },
    sopNoticeText: {
        fontSize: 13,
        color: '#0C4A6E',
        lineHeight: 18,
    },
    sopNoticeHighlight: {
        fontWeight: '700',
        color: '#0369A1',
    },
});

export default ProfileSettingsScreen;
