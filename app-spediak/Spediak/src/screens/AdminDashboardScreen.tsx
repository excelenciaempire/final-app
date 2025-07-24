import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator, Alert, Modal as RNModal } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useAuth } from '@clerk/clerk-expo';
import { format } from 'date-fns';
import { TextInput } from 'react-native-gesture-handler';
import api from '../../config/api';
import AllInspections from './AllInspections';
import AllUsers from './AllUsers';

const Tab = createMaterialTopTabNavigator();

// --- Interfaces for our data ---
interface Prompt {
    id: number;
    prompt_name: string;
    prompt_content: string;
    is_locked: boolean;
    locked_by: string | null;
    username: string | null;
    locked_at: string | null;
}

interface PromptVersion {
    id: number;
    version: number;
    prompt_content: string;
    updated_by_username: string;
    created_at: string;
}

const PromptEditor = () => {
    const { getToken, userId } = useAuth();
    const [prompts, setPrompts] = useState<Prompt[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLockedForEditing, setIsLockedForEditing] = useState(false);
    const [lockedByOther, setLockedByOther] = useState<string | null>(null);

    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [selectedPromptHistory, setSelectedPromptHistory] = useState<PromptVersion[]>([]);
    const [selectedPromptForHistory, setSelectedPromptForHistory] = useState<Prompt | null>(null);

    const checkLockStatus = useCallback(async () => {
        try {
            const token = await getToken();
            const response = await api.get('/admin/prompts', { headers: { Authorization: `Bearer ${token}` } });
            const serverPrompts: Prompt[] = response.data;
            
            const aPromptIsLocked = serverPrompts.some(p => p.is_locked);
            const lockedByMe = serverPrompts.some(p => p.is_locked && p.locked_by === userId);
            const lockedPrompt = serverPrompts.find(p => p.is_locked && p.locked_by !== userId);
            
            setIsLockedForEditing(aPromptIsLocked);

            if (!lockedByMe && lockedPrompt) {
                setLockedByOther(lockedPrompt.username);
            } else {
                setLockedByOther(null);
            }
            // Only update prompts if they are not being actively edited by the user to avoid losing changes
            if (!lockedByMe) {
                setPrompts(serverPrompts);
            }

        } catch (err) {
            setError('Failed to check lock status.');
        }
    }, [getToken, userId]);


    useEffect(() => {
        fetchPrompts();
        const lockInterval = setInterval(checkLockStatus, 5000); // Poll every 5 seconds
        return () => clearInterval(lockInterval);
    }, [checkLockStatus]);

    const fetchPrompts = async () => {
        setIsLoading(true);
        try {
            const token = await getToken();
            const response = await api.get('/admin/prompts', { headers: { Authorization: `Bearer ${token}` } });
            setPrompts(response.data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch prompts. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLockToggle = async (value: boolean) => {
        const action = value ? 'lock' : 'unlock';
        const promptToToggle = prompts[0] || prompts[1]; // Use any available prompt
        if (!promptToToggle) return;

        try {
            const token = await getToken();
            // We lock/unlock ALL prompts in one go. We use the first prompt's ID as the representative.
            // The backend logic should be designed to handle this, e.g., locking all prompts.
            // For this implementation, we will lock/unlock each one.
            const lockPromises = prompts.map(p => 
                api.post(`/admin/prompts/${p.id}/${action}`, {}, { headers: { Authorization: `Bearer ${token}` } })
            );
            await Promise.all(lockPromises);
            await fetchPrompts();
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || `Failed to ${action} prompts.`);
            await fetchPrompts();
        }
    };
    
    const onSave = async () => {
        setIsSaving(true);
        try {
            const token = await getToken();
            const updatePromises = prompts.map(p => 
                api.post('/admin/prompts/update', { id: p.id, prompt_content: p.prompt_content }, { headers: { Authorization: `Bearer ${token}` } })
            );
            await Promise.all(updatePromises);
            Alert.alert('Success', 'All prompts have been saved.');
            // After saving, unlock the prompts
            await handleLockToggle(false);
        } catch (err) {
            setError('Failed to save prompts.');
            Alert.alert('Error', 'An error occurred while saving.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleContentChange = (text: string, id: number) => {
        setPrompts(currentPrompts =>
            currentPrompts.map(p => (p.id === id ? { ...p, prompt_content: text } : p))
        );
    };

    const viewHistory = async (prompt: Prompt) => {
        try {
            const token = await getToken();
            const response = await api.get(`/admin/prompts/${prompt.id}/history`, { headers: { Authorization: `Bearer ${token}` } });
            setSelectedPromptHistory(response.data);
            setSelectedPromptForHistory(prompt);
            setHistoryModalVisible(true);
        } catch (err) {
            Alert.alert('Error', 'Failed to fetch prompt history.');
        }
    };

    const restoreVersion = async (versionId: number) => {
        if (!selectedPromptForHistory) return;
        try {
            const token = await getToken();
            await api.post('/admin/prompts/restore', {
                prompt_id: selectedPromptForHistory.id,
                version_id: versionId
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            Alert.alert('Success', 'Prompt has been restored.');
            setHistoryModalVisible(false);
            fetchPrompts();
        } catch (err) {
            Alert.alert('Error', 'Failed to restore prompt version.');
        }
    };

    if (isLoading) return <ActivityIndicator size="large" style={{ marginTop: 20 }} />;
    if (error) return <Text style={styles.errorText}>{error}</Text>;

    const isLockedByMe = prompts.some(p => p.is_locked && p.locked_by === userId);
    const canEdit = isLockedByMe;

    return (
        <ScrollView style={styles.container}>
            <View style={styles.lockContainer}>
                <Text style={styles.lockLabel}>Lock for Editing</Text>
                <Switch
                    value={isLockedForEditing}
                    onValueChange={handleLockToggle}
                    disabled={!!lockedByOther}
                />
            </View>
            {lockedByOther && <Text style={styles.lockedByText}>Locked by: {lockedByOther}</Text>}

            {prompts.map(prompt => (
                <View key={prompt.id} style={styles.promptCard}>
                    <Text style={styles.promptTitle}>{prompt.prompt_name.replace(/_/g, ' ').replace('prompt', 'Prompt')}</Text>
                    <TextInput
                        style={[styles.textInput, !canEdit && styles.disabledInput]}
                        value={prompt.prompt_content}
                        onChangeText={(text) => handleContentChange(text, prompt.id)}
                        multiline
                        editable={canEdit}
                    />
                    <TouchableOpacity style={styles.historyButton} onPress={() => viewHistory(prompt)}>
                        <Text style={styles.historyButtonText}>View History</Text>
                    </TouchableOpacity>
                </View>
            ))}

            <TouchableOpacity
                style={[styles.saveButton, (!canEdit || isSaving) && styles.disabledButton]}
                onPress={onSave}
                disabled={!canEdit || isSaving}
            >
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
            </TouchableOpacity>

            <HistoryModal 
                visible={historyModalVisible}
                onClose={() => setHistoryModalVisible(false)}
                history={selectedPromptHistory}
                onRestore={restoreVersion}
                promptName={selectedPromptForHistory?.prompt_name || ''}
            />
        </ScrollView>
    );
};

const HistoryModal = ({ visible, onClose, history, onRestore, promptName }: { visible: boolean, onClose: () => void, history: PromptVersion[], onRestore: (versionId: number) => void, promptName: string }) => {
    return (
        <RNModal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <Text style={styles.modalTitle}>History for {promptName.replace(/_/g, ' ')}</Text>
                    <ScrollView>
                        {history.map(item => (
                            <View key={item.id} style={styles.historyItem}>
                                <Text style={styles.historyVersion}>Version {item.version}</Text>
                                <Text style={styles.historyUser}>By: {item.updated_by_username} on {format(new Date(item.created_at), 'MMM d, yyyy - h:mm a')}</Text>
                                <Text style={styles.historyContent}>{item.prompt_content}</Text>
                                <TouchableOpacity style={styles.restoreButton} onPress={() => onRestore(item.id)}>
                                    <Text style={styles.restoreButtonText}>Restore this Version</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </RNModal>
    );
}

const AdminDashboardScreen = () => {
    const { getToken, userId } = useAuth();
    const [isPromptEditorLocked, setIsPromptEditorLocked] = useState(false);
    const [promptLocker, setPromptLocker] = useState<string | null>(null);

    const checkLockStatusForTabs = useCallback(async () => {
        try {
            const token = await getToken();
            const response = await api.get('/admin/prompts', { headers: { Authorization: `Bearer ${token}` } });
            const serverPrompts: Prompt[] = response.data;
            const aPromptIsLocked = serverPrompts.some(p => p.is_locked);
            
            if (aPromptIsLocked) {
                const lockedPrompt = serverPrompts.find(p => p.is_locked);
                if (lockedPrompt && lockedPrompt.locked_by !== userId) {
                    setIsPromptEditorLocked(true);
                    setPromptLocker(lockedPrompt.username);
                } else {
                    setIsPromptEditorLocked(false);
                    setPromptLocker(null);
                }
            } else {
                setIsPromptEditorLocked(false);
                setPromptLocker(null);
            }
        } catch (error) {
            console.error("Could not check prompt lock status for tabs:", error);
        }
    }, [getToken, userId]);

    useEffect(() => {
        checkLockStatusForTabs();
        const interval = setInterval(checkLockStatusForTabs, 7000);
        return () => clearInterval(interval);
    }, [checkLockStatusForTabs]);

    return (
        <Tab.Navigator
            screenOptions={{
                tabBarActiveTintColor: '#007AFF',
                tabBarInactiveTintColor: 'gray',
                tabBarIndicatorStyle: { backgroundColor: '#007AFF', height: 2 },
                tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
            }}
        >
            <Tab.Screen name="All Inspections" component={AllInspections} />
            <Tab.Screen name="All Users" component={AllUsers} />
            <Tab.Screen 
                name="Prompt Editor" 
                component={PromptEditor}
                options={{
                    tabBarLabel: isPromptEditorLocked ? `Prompt Editor (Locked)` : 'Prompt Editor',
                }}
                listeners={{
                    tabPress: (e: { preventDefault: () => void }) => {
                        if (isPromptEditorLocked) {
                            e.preventDefault();
                            Alert.alert('Locked', `The prompt editor is currently being edited by ${promptLocker}.`);
                        }
                    }
                }}
            />
        </Tab.Navigator>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#f8f9fa' },
    lockContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#dee2e6' },
    lockLabel: { fontSize: 18, fontWeight: '600' },
    lockedByText: { textAlign: 'center', color: 'red', marginBottom: 16, fontWeight: 'bold' },
    promptCard: { marginBottom: 20, backgroundColor: '#ffffff', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#e9ecef' },
    promptTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#343a40' },
    textInput: { height: 200, borderWidth: 1, borderColor: '#ced4da', borderRadius: 4, padding: 10, textAlignVertical: 'top', backgroundColor: '#fff', fontSize: 14, marginBottom: 12 },
    disabledInput: { backgroundColor: '#e9ecef' },
    saveButton: { backgroundColor: '#28a745', paddingVertical: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 40 },
    disabledButton: { backgroundColor: '#6c757d' },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    errorText: { color: 'red', textAlign: 'center', marginTop: 20 },
    historyButton: { backgroundColor: '#007bff', padding: 10, borderRadius: 5, alignItems: 'center' },
    historyButtonText: { color: '#fff', fontWeight: 'bold' },
    centeredView: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: { margin: 20, backgroundColor: "white", borderRadius: 20, padding: 35, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, width: '90%', maxHeight: '80%' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
    historyItem: { borderBottomWidth: 1, borderBottomColor: '#ccc', paddingVertical: 10, width: '100%' },
    historyVersion: { fontSize: 16, fontWeight: 'bold' },
    historyUser: { fontStyle: 'italic', color: '#555', marginBottom: 5 },
    historyContent: { color: '#333' },
    restoreButton: { backgroundColor: '#ffc107', padding: 8, borderRadius: 5, marginTop: 10, alignItems: 'center' },
    restoreButtonText: { color: '#000', fontWeight: 'bold' },
    closeButton: { backgroundColor: '#dc3545', padding: 12, borderRadius: 10, marginTop: 20 },
    closeButtonText: { color: 'white', fontWeight: 'bold' }
});

export default AdminDashboardScreen;