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
  NewStatement: { userState?: string };
  InspectionHistory: undefined;
  ProfileSettings: undefined;
  // AdminDashboard is not a direct route in this navigator for mobile/small screens
};

const Drawer = createDrawerNavigator<RootDrawerParamList>();

// --- Custom Header Title Component ---
const CustomHeaderTitle: React.FC = () => {
  const { user } = useUser();
  const userState = user?.unsafeMetadata?.inspectionState as string || 'N/A';

  return (
    <View style={styles.customHeaderContainer}>
      <Image 
        source={require('../../assets/logo_header.png')} 
        style={styles.headerLogo}
      />
      <Text style={styles.headerStateText}>State: {userState}</Text>
    </View>
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

  const drawerItems: { name: keyof RootDrawerParamList | 'AdminDashboard'; label: string; icon: keyof typeof Ionicons.glyphMap, adminOnly?: boolean }[] = [
    { name: 'NewStatement', label: 'New Statement', icon: 'add-circle-outline' },
    { name: 'InspectionHistory', label: 'Statement History', icon: 'time-outline' },
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

    if (activeScreen === 'NewStatement') {
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
        initialRouteName="NewStatement"
        drawerContent={(props: DrawerContentComponentProps) => <CustomDrawerContent {...props} />}
        screenOptions={({ navigation, route }) => ({
            headerStyle: { backgroundColor: COLORS.primary },
            headerTintColor: COLORS.white,
            headerTitleAlign: 'center',
            headerLeft: () => (
              <Image
                source={require('../../assets/logo_header.png')}
                style={styles.headerLeftLogo}
              />
            ),
            headerTitle: () => {
                const { user } = useUser();
                const userState = user?.unsafeMetadata?.inspectionState as string || 'N/A';
                return (
                    <Text style={styles.headerTitleTextCentral}>State: {userState}</Text>
                );
            },
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
         <Drawer.Screen name="NewStatement" component={NewInspectionScreen} options={{ title: 'New Statement' }} />
         <Drawer.Screen name="InspectionHistory" component={InspectionHistoryScreen} options={{ title: 'Statement History' }} />
         <Drawer.Screen name="ProfileSettings" component={ProfileSettingsScreen} options={{ title: 'Profile Settings' }} />
         {/* Admin Dashboard screen conditionally added for web by the web layout part */}
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
});

export default RootNavigator; 