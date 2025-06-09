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
    imageUri?: string;
}

const { width, height } = Dimensions.get('window');

const DdidModal: React.FC<DdidModalProps> = ({ 
    visible, 
    onClose, 
    ddidText, 
    imageUri
}) => {

    console.log(`[DdidModal] Received imageUri: ${imageUri}`);

    const handleCopy = async () => {
        const plainText = ddidText.replace(/\*\*/g, '');

        try {
            await Clipboard.setStringAsync(plainText);
            if (Platform.OS !== 'web') {
                Alert.alert("Copied", "Statement copied to clipboard.");
            } else {
                // For web, you might rely on a toast/notification library
                // as alerts can be disruptive. For now, we'll just log it.
                console.log("Statement copied to clipboard.");
                // A simple alert is fine for now for web as well.
                alert("Statement copied to clipboard.");
            }
        } catch (e) {
            console.error("Failed to copy text: ", e);
            alert("Error: Could not copy text to clipboard.");
        }
    };

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.headerTitle}>Generated Statement</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color="#6c757d" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
                        <Markdown style={markdownStyles}>
                            {ddidText || 'No content available.'}
                        </Markdown>
                    </ScrollView>

                    <View style={styles.modalFooter}>
                         <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
                             <Copy size={18} color="#fff" />
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalView: {
        width: Platform.OS === 'web' ? '50%' : '95%',
        maxWidth: 700,
        maxHeight: '85%',
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
    },
    closeButton: {
         padding: 8,
         borderRadius: 50,
         backgroundColor: 'transparent',
         marginLeft: 10,
    },
    scrollView: {
        flex: 1,
    },
    scrollViewContent: {
         paddingHorizontal: 20,
         paddingVertical: 15,
    },
    modalFooter: {
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#e9ecef',
        backgroundColor: '#f8f9fa',
    },
    copyButton: {
        flexDirection: 'row',
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    copyButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
        marginLeft: 8,
    },
});

const markdownStyles = StyleSheet.create({
    body: {
        fontSize: 15,
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
        marginLeft: 15,
    },
    ordered_list: {
         marginLeft: 15,
    },
});

export default DdidModal; 