// src/navigation/AppNavigator.tsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';
import { useSocketEvents } from '../hooks/useSocket';
import { COLORS, SIZES } from '../utils/constants';
import { Badge } from '../components/common';
import { useChatStore } from '../store/chatStore';
// Auth
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Main
import ConversationsScreen from '../screens/main/ConversationsScreen';
import ChatScreen from '../screens/main/ChatScreen';
import ContactsScreen from '../screens/main/ContactsScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import NewConversationScreen from '../screens/main/NewConversationScreen';
import GroupInfoScreen from '../screens/groups/GroupInfoScreen';

// Calls
import CallHistoryScreen from '../screens/calls/CallHistoryScreen';
import IncomingCallScreen from '../screens/calls/IncomingCallScreen';
import OutgoingCallScreen from '../screens/calls/OutgoingCallScreen';
import ActiveCallScreen from '../screens/calls/ActiveCallScreen';

// Admin
import AdminScreen from '../screens/admin/AdminScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ── Onglets principaux ────────────────────────────────────────────
const TabIcon = ({
  iconName, label, focused, badge,
}: { iconName: string; label: string; focused: boolean; badge?: number }) => (
  <View style={tabStyles.iconWrap}>
    <View>
      <Icon 
        name={iconName} 
        size={26} 
        color={focused ? COLORS.primary : COLORS.gray400} 
      />
      {badge && badge > 0 ? (
        <View style={tabStyles.badgeWrap}>
          <Badge count={badge} />
        </View>
      ) : null}
    </View>
    <Text style={[tabStyles.label, focused && tabStyles.labelFocused]}>{label}</Text>
  </View>
);

const MainTabs = () => {
  const totalUnread = useChatStore((s) =>
    s.conversations.reduce((sum, c) => sum + c.unreadCount, 0)
  );

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: tabStyles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Conversations"
        component={ConversationsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon iconName="message-text" label="Messages" focused={focused} badge={totalUnread} />
          ),
        }}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon iconName="account-group" label="Contacts" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="CallHistory"
        component={CallHistoryScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon iconName="phone" label="Appels" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon iconName="account" label="Profil" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// ── App principale ────────────────────────────────────────────────
const AppContent = () => {
  const { isAuthenticated, isLoading, loadFromStorage } = useAuthStore();
  const { status: callStatus } = useCallStore();
  const { loadConversations } = useChatStore();

  // Charger la session au démarrage
  useEffect(() => { loadFromStorage(); }, []);

  // ✅ Dès que l'utilisateur est authentifié (login ou session restaurée),
  // charger les conversations. Ça couvre le cas où socket:connected
  // s'est déclenché avant que useSocketEvents soit monté.
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations().catch(() => {});
    }
  }, [isAuthenticated]);

  // Activer les événements socket en temps réel
  useSocketEvents();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      {!isAuthenticated ? (
        // Auth stack
        <Stack.Group>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Group>
      ) : (
        // App stack
        <Stack.Group>
          <Stack.Screen name="Tabs" component={MainTabs} />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="NewConversation"
            component={NewConversationScreen}
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="GroupInfo"
            component={GroupInfoScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="OutgoingCall"
            component={OutgoingCallScreen}
            options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="IncomingCall"
            component={IncomingCallScreen}
            options={{ presentation: 'fullScreenModal', animation: 'fade' }}
          />
          <Stack.Screen
            name="ActiveCall"
            component={ActiveCallScreen}
            options={{ presentation: 'fullScreenModal', animation: 'fade' }}
          />
          <Stack.Screen
            name="Admin"
            component={AdminScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
};

const AppNavigator = () => {
  const { status: callStatus } = useCallStore();

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppContent />
        {/* Floating incoming call indicator (quand l'appel arrive hors de l'écran dédié) */}
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

const tabStyles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.white,
    borderTopColor: COLORS.gray200,
    borderTopWidth: 1,
    height: 72,
    paddingBottom: 8,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    position: 'relative',
  },
  label: { fontSize: 10, color: COLORS.gray400, marginTop: 2 },
  labelFocused: { color: COLORS.primary, fontWeight: '600' },
  badgeWrap: { position: 'absolute', top: -4, right: -8 },
});

export default AppNavigator;
