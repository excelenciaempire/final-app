import React, { useState, useEffect, useMemo } from 'react';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
  DrawerItem,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/colors';

// Import Screens
import NewInspectionScreen from '../../app/(tabs)/newInspection';
import InspectionHistoryScreen from '../screens/InspectionHistoryScreen';
import ProfileSettingsScreen from '../screens/ProfileSettingsScreen';
import WelcomeScreen from '../screens/WelcomeScreen';

// Define Drawer Param List
export type RootDrawerParamList = {
  NewInspection: undefined;
  InspectionHistory: undefined;
  ProfileSettings: undefined;
};

const Drawer = createDrawerNavigator<RootDrawerParamList>();

// --- Reusable Sidebar/Drawer Content ---
interface SidebarContentProps {
  onNavigate: (screen: keyof RootDrawerParamList | 'AdminDashboard') => void;
  activeScreen?: keyof RootDrawerParamList | 'AdminDashboard';
  isAdmin?: boolean;
}

const SidebarContent: React.FC<SidebarContentProps> = ({ onNavigate, activeScreen, isAdmin }) => {
  const { signOut } = useAuth();
  const { user, isLoaded } = useUser();
  const userState = user?.unsafeMetadata?.inspectionState as string || 'North Carolina';

  if (!isLoaded) {
    return <ActivityIndicator style={{ marginTop: 20 }} color={COLORS.primary} />;
  }

  const drawerItems: { name: keyof RootDrawerParamList | 'AdminDashboard'; label: string; icon: keyof typeof Ionicons.glyphMap, adminOnly?: boolean }[] = [
    { name: 'NewInspection', label: 'New Inspection', icon: 'add-circle-outline' },
    { name: 'InspectionHistory', label: 'Inspection History', icon: 'time-outline' },
    { name: 'ProfileSettings', label: 'Profile', icon: 'person-circle-outline' },
    { name: 'AdminDashboard', label: 'Admin Dashboard', icon: 'shield-checkmark-outline', adminOnly: true },
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
        <Text style={styles.userState}>{`State: ${userState}`}</Text>
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

  return (
    <DrawerContentScrollView {...props}>
       <SidebarContent
         onNavigate={(screen) => props.navigation.navigate(screen)}
         activeScreen={activeRouteName}
       />
    </DrawerContentScrollView>
  );
};

// --- Root Navigator Setup (Conditional Logic) ---
const RootNavigator: React.FC = () => {
  const { user, isLoaded } = useUser();
  const { width } = useWindowDimensions(); // Use hook for dynamic width
  const [activeScreen, setActiveScreen] = useState<keyof RootDrawerParamList | 'AdminDashboard'>('NewInspection');

  // Check for admin role using unsafeMetadata for frontend visibility
  const isAdmin = useMemo(() => user?.unsafeMetadata?.role === 'admin', [user]);

  const isWebLarge = Platform.OS === 'web' && width > 768;

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
    let CurrentScreenComponent: React.ComponentType<any> | null = null; // Initialize as null

    if (activeScreen === 'NewInspection') {
        CurrentScreenComponent = NewInspectionScreen;
    } else if (activeScreen === 'InspectionHistory') {
        CurrentScreenComponent = InspectionHistoryScreen;
    } else if (activeScreen === 'ProfileSettings') {
        CurrentScreenComponent = ProfileSettingsScreen;
    } else if (activeScreen === 'AdminDashboard') { // No need to check isAdmin here
        // Load component only when needed and on web
        const AdminDashboardScreen = require('../screens/AdminDashboardScreen').default;
        CurrentScreenComponent = AdminDashboardScreen;
    }

    return (
        <View style={{ flex: 1, flexDirection: 'row' }}>
            <View style={styles.webSidebar}>
                 <SidebarContent onNavigate={setActiveScreen} activeScreen={activeScreen} isAdmin={isAdmin} />
            </View>
            <View style={styles.webContent}>
                 {/* Render only if component is found */}
                 {CurrentScreenComponent ? <CurrentScreenComponent /> : <Text>Select an option</Text>}
            </View>
        </View>
    );
  }

  // --- Mobile/Small Web Drawer Layout ---
  return (
    <Drawer.Navigator
        initialRouteName="NewInspection"
        drawerContent={(props: DrawerContentComponentProps) => <CustomDrawerContent {...props} />}
        screenOptions={({ navigation }) => ({ // Keep hamburger menu for drawer
            headerStyle: { backgroundColor: COLORS.primary },
            headerTintColor: COLORS.white,
            headerTitleStyle: { fontWeight: 'bold' },
            headerLeft: () => (
              <TouchableOpacity onPress={() => navigation.toggleDrawer()} style={{ marginLeft: 15 }}>
                <Ionicons name="menu" size={28} color={COLORS.white} />
              </TouchableOpacity>
            ),
            drawerActiveTintColor: COLORS.primary,
            drawerInactiveTintColor: COLORS.darkText,
            drawerLabelStyle: { marginLeft: -20, fontSize: 16 } // Adjust label style if needed
        })}
        >
        {/* Regular Screens */}
         <Drawer.Screen name="NewInspection" component={NewInspectionScreen} options={{ title: 'New Inspection' }} />
         <Drawer.Screen name="InspectionHistory" component={InspectionHistoryScreen} options={{ title: 'Inspection History' }} />
         <Drawer.Screen name="ProfileSettings" component={ProfileSettingsScreen} options={{ title: 'Profile Settings' }} />
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
    // Styles for SidebarContent (used by both Drawer and Web Sidebar)
    drawerHeader: {
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 50 : 20, // Adjust top padding for notch
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
       paddingBottom: Platform.OS === 'ios' ? 20 : 10, // Safe area padding bottom
       paddingTop: 10,
    },
    // Style for individual items in SidebarContent
    sidebarItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        marginBottom: 5,
    },
    sidebarItemActive: {
        backgroundColor: COLORS.primary + '1A', // Light primary color for active background
        borderLeftWidth: 3,
        borderLeftColor: COLORS.primary,
        paddingLeft: 17,
    },
    sidebarLabel: {
        marginLeft: 15, // Space between icon and text
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
    // Styles specific to Web Dashboard Layout
    webSidebar: {
        width: 280, // Fixed width for the sidebar
        borderRightWidth: 1,
        borderRightColor: '#ddd',
        backgroundColor: COLORS.white, // Or another suitable background
    },
    webContent: {
        flex: 1, // Takes remaining space
        // Add padding or background as needed for the content area
         backgroundColor: '#f8f9fa', // Match the app background
    },
});

export default RootNavigator; 