import React from 'react';
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
    Image
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { X, Copy } from 'lucide-react-native';
import Markdown from 'react-native-markdown-display'; // For rendering bold text etc.
import { COLORS } from '../styles/colors'; // Import COLORS if needed for styling

interface DdidModalProps {
    visible: boolean;
    onClose: () => void;
    ddidText: string;
    imageUrl?: string;
    description?: string;
    userName?: string;
    userEmail?: string;
}

const { width, height } = Dimensions.get('window');

const DdidModal: React.FC<DdidModalProps> = ({ 
    visible, 
    onClose, 
    ddidText, 
    imageUrl, 
    description,
    userName,
    userEmail
}) => {

    console.log(`[DdidModal] Received imageUrl: ${imageUrl}`);

    const handleCopy = async () => {
        // Remove potential markdown formatting before copying
        const plainText = ddidText.replace(/\*\*/g, ''); // Remove **

        try {
            await Clipboard.setStringAsync(plainText);
            // Optionally provide feedback (e.g., a temporary message or toast)
            Alert.alert("Copied", "Statement copied to clipboard.");
        } catch (e) {
            console.error("Failed to copy text: ", e);
            Alert.alert("Error", "Could not copy text to clipboard.");
        }
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose} // Handle back button on Android
        >
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <View style={styles.modalHeader}>
                        <View style={styles.headerUserInfo}>
                           <Text style={styles.headerUserName} numberOfLines={1}>{userName || 'Inspection'} Report</Text>
                           {userEmail && <Text style={styles.headerUserEmail} numberOfLines={1}>{userEmail}</Text>}
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color="#6c757d" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
                        {imageUrl && (
                            <Image source={{ uri: imageUrl }} style={styles.modalImage} resizeMode="contain" />
                        )}
                        <View style={styles.sectionContainer}>
                             <Text style={styles.sectionTitle}>Generated Statement:</Text>
                             <Markdown style={markdownStyles}>
                                {ddidText || 'No content available.'}
                             </Markdown>
                        </View>
                    </ScrollView>

                    <View style={styles.modalFooter}>
                         <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
                             <Copy size={18} color="#fff" style={styles.copyIcon} />
                             <Text style={styles.copyButtonText}>Copy Statement</Text>
                         </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)', // Dimmed background
    },
    modalView: {
        width: width * 0.9, // 90% of screen width
        maxHeight: height * 0.8, // 80% of screen height
        margin: 20,
        backgroundColor: 'white',
        borderRadius: 15, // More rounded corners
        padding: 0, // Padding handled internally by sections
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        overflow: 'hidden', // Ensure children conform to rounded corners
    },
    modalHeader: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerUserInfo: {
        flex: 1, // Allow text to take space
        marginRight: 10,
    },
    headerUserName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    headerUserEmail: {
        fontSize: 13,
        color: '#555',
    },
    closeButton: {
         padding: 5, // Increase tappable area
    },
    scrollView: {
        width: '100%',
    },
    scrollViewContent: {
         padding: 20, // Add padding around scroll content
    },
    modalImage: { 
        width: '100%', // Use full width within padding
        height: 200, // Increase height slightly
        borderRadius: 8,
        marginBottom: 20, // More space
        backgroundColor: '#eee',
        alignSelf: 'center',
    },
    sectionContainer: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 4,
    },
    descriptionText: {
        fontSize: 15,
        lineHeight: 22,
        color: '#333',
    },
    modalFooter: {
        width: '100%',
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        alignItems: 'center',
        backgroundColor: '#f8f9fa' // Slight background differentiation
    },
    copyButton: {
        flexDirection: 'row',
        backgroundColor: '#2c3e50',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    copyButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    copyIcon: {
        marginRight: 8,
    }
});

const markdownStyles = StyleSheet.create({
    body: {
        fontSize: 15, // Match descriptionText
        color: '#333',
        lineHeight: 22,
    },
    heading1: {
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 10,
        marginBottom: 5,
        color: '#0056b3',
    },
    heading2: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 8,
        marginBottom: 4,
        color: '#0056b3',
    },
    strong: {
        fontWeight: 'bold',
    },
    em: {
        fontStyle: 'italic',
    },
    list_item: {
        marginVertical: 4,
    },
    bullet_list: {
        marginLeft: 15, // Indent list
    },
    ordered_list: {
         marginLeft: 15, // Indent list
    },
    // Add other markdown element styles as needed
});

export default DdidModal; 