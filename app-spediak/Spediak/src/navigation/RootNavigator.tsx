import React, { useState, useEffect, useMemo } from 'react';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
  DrawerItem,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity, Platform, useWindowDimensions, Modal, ScrollView } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/colors';
import { useGlobalState, US_STATES } from '../context/GlobalStateContext';
import { Picker } from '@react-native-picker/picker';
import SafeComponent from '../components/SafeComponent';

// Import Screens
import NewInspectionScreen from '../../app/(tabs)/newInspection';
import NewInspectionSimple from '../../app/(tabs)/newInspectionSimple';
import InspectionHistoryScreen from '../screens/InspectionHistoryScreen';
import ProfileSettingsScreen from '../screens/ProfileSettingsScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import SopScreen from '../screens/SopScreen';
import DiscordScreen from '../screens/DiscordScreen';
import PlanSelectionScreen from '../screens/PlanSelectionScreen';
import SopHistoryScreen from '../screens/SopHistoryScreen';

// Define Drawer Param List
export type RootDrawerParamList = {
  Home: { userState?: string };
  NewStatement: { userState?: string };
  InspectionHistory: undefined;
  SOP: undefined;
  Discord: undefined;
  ProfileSettings: undefined;
  PlanSelection: undefined;
  // AdminDashboard and SopHistory are not direct routes in drawer for mobile
};

const Drawer = createDrawerNavigator<RootDrawerParamList>();

// --- Custom Header Title Component with State Selector ---
const CustomHeaderTitleInner: React.FC = () => {
  const { selectedState, setSelectedState } = useGlobalState();
  const [showStatePicker, setShowStatePicker] = useState(false);

  // Don't render state selector until context is ready
  if (!setSelectedState) {
    return (
      <View style={styles.customHeaderContainer}>
        <Image 
          source={require('../../assets/logo_header.png')} 
          style={styles.headerLogo}
        />
      </View>
    );
  }

  return (
    <View style={styles.customHeaderContainer}>
      <Image 
        source={require('../../assets/logo_header.png')} 
        style={styles.headerLogo}
      />
      <TouchableOpacity 
        style={styles.stateSelector}
        onPress={() => setShowStatePicker(true)}
      >
        <Text style={styles.headerStateText}>
          {selectedState || 'NC'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={COLORS.white} />
      </TouchableOpacity>

      {/* State Picker Modal */}
      <Modal
        visible={showStatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStatePicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatePicker(false)}
        >
          <View style={styles.statePickerContainer}>
            <Text style={styles.statePickerTitle}>Select State</Text>
            <ScrollView style={styles.statePickerScroll}>
              {US_STATES.map((state) => (
                <TouchableOpacity
                  key={state.value}
                  style={[
                    styles.statePickerItem,
                    selectedState === state.value && styles.statePickerItemActive
                  ]}
                  onPress={() => {
                    setSelectedState(state.value);
                    setShowStatePicker(false);
                  }}
                >
                  <Text style={[
                    styles.statePickerItemText,
                    selectedState === state.value && styles.statePickerItemTextActive
                  ]}>
                    {state.value} - {state.label}
                  </Text>
                  {selectedState === state.value && (
                    <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.closePickerButton}
              onPress={() => setShowStatePicker(false)}
            >
              <Text style={styles.closePickerButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// Wrapped version with error boundary
const CustomHeaderTitle: React.FC = () => {
  return (
    <SafeComponent 
      componentName="CustomHeaderTitle"
      fallback={
        <View style={styles.customHeaderContainer}>
          <Image 
            source={require('../../assets/logo_header.png')} 
            style={styles.headerLogo}
          />
        </View>
      }
    >
      <CustomHeaderTitleInner />
    </SafeComponent>
  );
};

// --- Reusable Sidebar/Drawer Content ---
interface SidebarContentProps {
  onNavigate: (screen: keyof RootDrawerParamList | 'AdminDashboard') => void;
  activeScreen?: keyof RootDrawerParamList | 'AdminDashboard';
  isAdmin?: boolean;
}

const SidebarContent: React.FC<SidebarContentProps> = ({ onNavigate, activeScreen, isAdmin }) => {
  const { signOut } = useAuth();
  const { user, isLoaded } = useUser();
  const sidebarUserStateDisplay = user?.unsafeMetadata?.inspectionState as string || 'North Carolina';

  if (!isLoaded) {
    return <ActivityIndicator style={{ marginTop: 20 }} color={COLORS.primary} />;
  }

  const drawerItems: { name: keyof RootDrawerParamList | 'AdminDashboard' | 'SopHistory'; label: string; icon: keyof typeof Ionicons.glyphMap, adminOnly?: boolean }[] = [
    { name: 'Home', label: 'Home', icon: 'home-outline' },
    { name: 'InspectionHistory', label: 'Statement History', icon: 'time-outline' },
    { name: 'SOP', label: 'SOP', icon: 'document-text-outline' },
    { name: 'Discord', label: 'Discord', icon: 'logo-discord' },
    { name: 'ProfileSettings', label: 'Profile', icon: 'person-circle-outline' },
    { name: 'AdminDashboard', label: 'Admin', icon: 'shield-checkmark-outline', adminOnly: true },
    { name: 'SopHistory', label: 'SOP History', icon: 'git-commit-outline', adminOnly: true },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      {/* Header */}
      <View style={styles.drawerHeader}>
        <Image
          source={user?.imageUrl ? { uri: user.imageUrl } : require('../../assets/icon.png')}
          style={styles.profileImage}
        />
        <Text style={styles.userName}>{user?.fullName || 'User Name'}</Text>
        <Text style={styles.userEmail}>{user?.primaryEmailAddress?.emailAddress || 'Email Address'}</Text>
        <Text style={styles.userState}>{`State: ${sidebarUserStateDisplay}`}</Text>
      </View>

      {/* Navigation Items */}
      <View style={styles.drawerListContainer}>
        {drawerItems.filter(item => !item.adminOnly || (Platform.OS === 'web' && isAdmin)).map((item) => (
          <TouchableOpacity
            key={item.name}
            style={[
              styles.sidebarItem,
              activeScreen === item.name && styles.sidebarItemActive, // Highlight active item
            ]}
            onPress={() => onNavigate(item.name)}
          >
            <Ionicons name={item.icon} size={22} color={activeScreen === item.name ? COLORS.primary : COLORS.darkText} />
            <Text style={[
              styles.sidebarLabel,
              activeScreen === item.name && styles.sidebarLabelActive,
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Footer (Logout) */}
      <View style={styles.drawerFooter}>
        <TouchableOpacity
          style={styles.sidebarItem} // Reuse style
          onPress={() => signOut()}
        >
          <Ionicons name="log-out-outline" color={COLORS.primary} size={22} />
          <Text style={[styles.sidebarLabel, styles.logoutLabel]}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// --- Original Custom Drawer Content (Now uses SidebarContent) ---
const CustomDrawerContent: React.FC<DrawerContentComponentProps> = (props) => {
  // Extract active route name for potential highlighting (less critical in drawer)
  const activeRouteName = props.state?.routes[props.state.index]?.name as keyof RootDrawerParamList | undefined;
  const { user } = useUser(); // Get user here to pass state if needed, or let CustomHeaderTitle fetch it
  const isAdmin = useMemo(() => user?.unsafeMetadata?.role === 'admin', [user]);

  return (
    <DrawerContentScrollView {...props}>
       <SidebarContent
         onNavigate={(screenName) => {
            // For NewStatement, we might pass the userState, though CustomHeaderTitle can also fetch it
            // if (screenName === 'NewStatement' && user?.unsafeMetadata?.inspectionState) {
            //   props.navigation.navigate(screenName, { userState: user.unsafeMetadata.inspectionState as string });
            // } else {
            props.navigation.navigate(screenName as keyof RootDrawerParamList); // Type assertion
            // }
         }}
         activeScreen={activeRouteName}
         isAdmin={isAdmin} // Pass isAdmin to SidebarContent
       />
    </DrawerContentScrollView>
  );
};

// --- Root Navigator Setup (Conditional Logic) ---
const RootNavigator: React.FC = () => {
  const { user, isLoaded } = useUser();
  const { width } = useWindowDimensions(); // Use hook for dynamic width
  const [activeScreen, setActiveScreen] = useState<keyof RootDrawerParamList | 'AdminDashboard'>('NewStatement');

  // Check for admin role using unsafeMetadata for frontend visibility
  const isAdmin = useMemo(() => user?.unsafeMetadata?.role === 'admin', [user]);

  // Determine if it's a large web screen (desktop-like)
  const isWebLarge = useMemo(() => {
    if (Platform.OS === 'web') {
      // Check for iPad user agent string to force mobile view for iPads
      const userAgent = Platform.OS === 'web' && typeof window !== 'undefined' && window.navigator ? window.navigator.userAgent : '';
      const isIPad = Platform.OS === 'web' && typeof document !== 'undefined' && /iPad|Macintosh/.test(userAgent) && 'ontouchend' in document;
      // Consider it large web if not an iPad and width is greater than a threshold
      if (isIPad) return false; // Force mobile view for iPads
      return width > 768; 
    }
    return false; // Not web, so not large web view
  }, [width]);

  // Loading State
  if (!isLoaded) {
    return (
        <View style={styles.loadingContainer}>
             <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
    );
  }

  // Welcome Screen Logic
  const needsStateSelection = !user?.unsafeMetadata?.inspectionState;
  if (needsStateSelection && user) {
    console.log("User state metadata missing, rendering WelcomeScreen.");
    return <WelcomeScreen />;
  }

  // --- Web Dashboard Layout (Large Screens) ---
  if (isWebLarge) {
    let CurrentScreenComponent: React.ComponentType<any> | null = null;

    if (activeScreen === 'Home' || activeScreen === 'NewStatement') {
        CurrentScreenComponent = NewInspectionSimple; // Using simplified version for testing
    } else if (activeScreen === 'InspectionHistory') {
        CurrentScreenComponent = InspectionHistoryScreen;
    } else if (activeScreen === 'SOP') {
        CurrentScreenComponent = SopScreen;
    } else if (activeScreen === 'Discord') {
        CurrentScreenComponent = DiscordScreen;
    } else if (activeScreen === 'ProfileSettings') {
        CurrentScreenComponent = ProfileSettingsScreen;
    } else if (activeScreen === 'PlanSelection') {
        CurrentScreenComponent = PlanSelectionScreen;
    } else if (activeScreen === 'AdminDashboard') {
        const AdminDashboardScreen = require('../screens/AdminDashboardScreen').default;
        CurrentScreenComponent = AdminDashboardScreen;
    } else if (activeScreen === 'SopHistory') {
        CurrentScreenComponent = SopHistoryScreen;
    }

    return (
        <View style={{ flex: 1, flexDirection: 'row' }}>
            <View style={styles.webSidebar}>
                 <SidebarContent onNavigate={setActiveScreen} activeScreen={activeScreen} isAdmin={isAdmin} />
            </View>
            <View style={styles.webContent}>
                 {CurrentScreenComponent ? <CurrentScreenComponent /> : <Text>Select an option</Text>}
            </View>
        </View>
    );
  }

  // --- Mobile/Small Web Drawer Layout ---
  return (
    <Drawer.Navigator
        initialRouteName="Home"
        drawerContent={(props: DrawerContentComponentProps) => <CustomDrawerContent {...props} />}
        screenOptions={({ navigation, route }) => ({
            headerStyle: { backgroundColor: COLORS.primary },
            headerTintColor: COLORS.white,
            headerTitleAlign: 'center',
            headerLeft: () => (
              <TouchableOpacity onPress={() => navigation.navigate('Home' as any)}>
                <Image
                  source={require('../../assets/logo_header.png')}
                  style={styles.headerLeftLogo}
                />
              </TouchableOpacity>
            ),
            headerTitle: () => <CustomHeaderTitle />,
            headerRight: () => (
              <TouchableOpacity onPress={() => navigation.toggleDrawer()} style={{ marginRight: 15 }}>
                <Ionicons name="menu" size={28} color={COLORS.white} />
              </TouchableOpacity>
            ),
            drawerActiveTintColor: COLORS.primary,
            drawerInactiveTintColor: COLORS.darkText,
            drawerLabelStyle: { marginLeft: -20, fontSize: 16 }
        })}
        >
        {/* Regular Screens */}
         <Drawer.Screen name="Home" component={NewInspectionSimple} options={{ title: 'Home' }} />
         <Drawer.Screen name="InspectionHistory" component={InspectionHistoryScreen} options={{ title: 'Statement History' }} />
         <Drawer.Screen name="SOP" component={SopScreen} options={{ title: 'SOP' }} />
         <Drawer.Screen name="Discord" component={DiscordScreen} options={{ title: 'Discord' }} />
         <Drawer.Screen name="ProfileSettings" component={ProfileSettingsScreen} options={{ title: 'Profile' }} />
         <Drawer.Screen name="PlanSelection" component={PlanSelectionScreen} options={{ title: 'Plans' }} />
    </Drawer.Navigator>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.white,
    },
    customHeaderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        flex: 1,
    },
    headerLogo: {
        width: 30,
        height: 30,
        resizeMode: 'contain',
        marginLeft: Platform.OS === 'ios' ? 0 : -5,
    },
    headerStateText: {
        flex: 1,
        textAlign: 'center',
        color: COLORS.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
    drawerHeader: {
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        backgroundColor: COLORS.secondary,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
        alignItems: 'center',
    },
    profileImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
        marginBottom: 10,
        backgroundColor: '#ccc',
    },
    userName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.darkText,
        marginBottom: 2,
    },
    userEmail: {
        fontSize: 14,
        color: COLORS.darkText,
        marginBottom: 4,
    },
    userState: {
        fontSize: 14,
        color: COLORS.darkText,
        fontStyle: 'italic',
    },
    drawerListContainer: {
       flex: 1,
       paddingTop: 10,
    },
    drawerFooter: {
       borderTopWidth: 1,
       borderTopColor: '#ddd',
       paddingBottom: Platform.OS === 'ios' ? 20 : 10,
       paddingTop: 10,
    },
    sidebarItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        marginBottom: 5,
    },
    sidebarItemActive: {
        backgroundColor: COLORS.primary + '1A',
        borderLeftWidth: 3,
        borderLeftColor: COLORS.primary,
        paddingLeft: 17,
    },
    sidebarLabel: {
        marginLeft: 15,
        fontSize: 16,
        fontWeight: '500',
        color: COLORS.darkText,
    },
    sidebarLabelActive: {
       color: COLORS.primary,
       fontWeight: 'bold',
    },
    logoutLabel: {
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    webSidebar: {
        width: 280,
        borderRightWidth: 1,
        borderRightColor: '#ddd',
        backgroundColor: COLORS.white,
    },
    webContent: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    headerLeftLogo: {
        width: 30,
        height: 30,
        resizeMode: 'contain',
        marginLeft: 15,
    },
    headerTitleTextCentral: {
        textAlign: 'center',
        color: COLORS.white,
        fontWeight: 'bold',
        fontSize: 16,
    },
    stateSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        marginLeft: 10,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statePickerContainer: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        width: '80%',
        maxWidth: 400,
        maxHeight: '70%',
        padding: 20,
    },
    statePickerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.darkText,
        marginBottom: 15,
        textAlign: 'center',
    },
    statePickerScroll: {
        maxHeight: 400,
    },
    statePickerItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    statePickerItemActive: {
        backgroundColor: COLORS.secondary,
    },
    statePickerItemText: {
        fontSize: 16,
        color: COLORS.darkText,
    },
    statePickerItemTextActive: {
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    closePickerButton: {
        marginTop: 15,
        padding: 12,
        backgroundColor: COLORS.primary,
        borderRadius: 8,
        alignItems: 'center',
    },
    closePickerButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default RootNavigator; 