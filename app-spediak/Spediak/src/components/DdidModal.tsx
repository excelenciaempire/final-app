import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    Platform,
    Dimensions,
    TextInput,
    KeyboardAvoidingView
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { X, Copy, Edit3, Check } from 'lucide-react-native';
import { COLORS } from '../styles/colors';

interface DdidModalProps {
    visible: boolean;
    onClose: () => void;
    ddidText: string;
    imageUri?: string;
}

const { width, height } = Dimensions.get('window');

const DdidModal: React.FC<DdidModalProps> = ({ 
    visible, 
    onClose, 
    ddidText, 
    imageUri
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editableText, setEditableText] = useState(ddidText);

    // Reset editable text when ddidText changes
    useEffect(() => {
        setEditableText(ddidText);
        setIsEditing(false);
    }, [ddidText]);

    console.log(`[DdidModal] Received imageUri: ${imageUri}`);

    const handleCopy = async () => {
        const textToCopy = editableText.replace(/\*\*/g, '');

        try {
            await Clipboard.setStringAsync(textToCopy);
            if (Platform.OS !== 'web') {
                Alert.alert("Copied", "Statement copied to clipboard.");
            } else {
                console.log("Statement copied to clipboard.");
                alert("Statement copied to clipboard.");
            }
        } catch (e) {
            console.error("Failed to copy text: ", e);
            alert("Error: Could not copy text to clipboard.");
        }
    };

    const handleToggleEdit = () => {
        if (isEditing) {
            // Exiting edit mode
            setIsEditing(false);
        } else {
            // Entering edit mode
            setIsEditing(true);
        }
    };

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardAvoidingView}
            >
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.headerTitle}>Generated Statement</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <X size={24} color="#6c757d" />
                            </TouchableOpacity>
                        </View>

                        {/* Edit hint */}
                        <Text style={styles.editHint}>
                            {isEditing ? '✏️ Editing mode - make your changes below' : '💡 Tap "Edit" to modify the statement before copying'}
                        </Text>

                        <ScrollView 
                            style={styles.scrollView} 
                            contentContainerStyle={styles.scrollViewContent}
                            nestedScrollEnabled={true}
                        >
                            {isEditing ? (
                                <TextInput
                                    style={styles.editableInput}
                                    value={editableText}
                                    onChangeText={setEditableText}
                                    multiline
                                    autoFocus
                                    textAlignVertical="top"
                                />
                            ) : (
                                <Text style={styles.statementText}>
                                    {editableText || 'No content available.'}
                                </Text>
                            )}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity 
                                style={[styles.editButton, isEditing && styles.editButtonActive]} 
                                onPress={handleToggleEdit}
                            >
                                {isEditing ? (
                                    <>
                                        <Check size={18} color="#fff" />
                                        <Text style={styles.editButtonTextActive}>Done</Text>
                                    </>
                                ) : (
                                    <>
                                        <Edit3 size={18} color={COLORS.primary} />
                                        <Text style={styles.editButtonText}>Edit</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                            
                            <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
                                <Copy size={18} color="#fff" />
                                <Text style={styles.copyButtonText}>Copy Statement</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    keyboardAvoidingView: {
        flex: 1,
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingVertical: 20,
    },
    modalView: {
        width: Platform.OS === 'web' ? '80%' : '98%',
        maxWidth: 600,
        maxHeight: '95%',
        backgroundColor: 'white',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 10,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
        backgroundColor: '#f8f9fa',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#343a40',
        flexShrink: 1,
    },
    closeButton: {
         padding: 8,
         borderRadius: 50,
         backgroundColor: 'transparent',
         marginLeft: 10,
    },
    editHint: {
        fontSize: 13,
        color: COLORS.textSecondary,
        backgroundColor: '#F0F4F8',
        paddingHorizontal: 16,
        paddingVertical: 10,
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollViewContent: {
         paddingHorizontal: 20,
         paddingVertical: 16,
    },
    statementText: {
        fontSize: 16,
        color: '#333',
        lineHeight: 26,
    },
    editableInput: {
        fontSize: 16,
        color: '#333',
        lineHeight: 26,
        backgroundColor: '#FEFCE8',
        borderWidth: 2,
        borderColor: '#FCD34D',
        borderRadius: 8,
        padding: 12,
        minHeight: 200,
        textAlignVertical: 'top',
    },
    modalFooter: {
        flexDirection: 'row',
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#e9ecef',
        backgroundColor: '#f8f9fa',
        gap: 12,
    },
    editButton: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.primary,
        gap: 8,
    },
    editButtonActive: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
    },
    editButtonText: {
        color: COLORS.primary,
        fontWeight: 'bold',
        fontSize: 15,
    },
    editButtonTextActive: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 15,
    },
    copyButton: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    copyButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

export default DdidModal;
