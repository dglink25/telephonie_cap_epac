// src/navigation/AppNavigator.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';
import { useSocketEvents } from '../hooks/useSocket';
import { COLORS, SIZES } from '../utils/constants';
import { Badge } from '../components/common';
import { NetworkStatus } from '../components/common/NetworkStatus';
import { useChatStore } from '../store/chatStore';
import { useNotificationStore } from '../store/notificationStore';
import { notificationsAPI } from '../services/api';
import {
  startCallNotificationService,
  stopCallNotificationService,
  onIncomingCallFromService,
  onCallEndedFromService,
} from '../services/callNotificationService';
import {
  requestAllPermissions,
  requestNotificationPermission,
} from '../services/permissionsService';

// Auth
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Main
import ConversationsScreen from '../screens/main/ConversationsScreen';
import ChatScreen from '../screens/main/ChatScreen';
import ContactsScreen from '../screens/main/ContactsScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import NewConversationScreen from '../screens/main/NewConversationScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import GroupInfoScreen from '../screens/groups/GroupInfoScreen';

// Calls
import CallHistoryScreen from '../screens/calls/CallHistoryScreen';
import IncomingCallScreen from '../screens/calls/IncomingCallScreen';
import OutgoingCallScreen from '../screens/calls/OutgoingCallScreen';
import ActiveCallScreen from '../screens/calls/ActiveCallScreen';

// Meeting — visioconférence
import MeetingScreen    from '../screens/meeting/MeetingScreen';
import NewMeetingScreen from '../screens/meeting/NewMeetingScreen';

// Admin
import AdminScreen from '../screens/admin/AdminScreen';

// ✅ Ref navigation globale — accessible depuis n'importe où (useSocket, etc.)
export const navigationRef = createNavigationContainerRef<any>();

export function navigate(name: string, params?: object) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as never, params as never);
  }
}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ── Onglet icon avec badge ────────────────────────────────────────
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

// ── Onglets principaux ────────────────────────────────────────────
const MainTabs = () => {
  const totalUnread = useChatStore((s) =>
    s.conversations.reduce((sum, c) => sum + c.unreadCount, 0)
  );
  const notifUnread = useNotificationStore((s) => s.unreadCount);

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
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon iconName="bell" label="Notifs" focused={focused} badge={notifUnread} />
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
  const { isAuthenticated, loadFromStorage } = useAuthStore();
  const { status: callStatus } = useCallStore();
  const { loadConversations } = useChatStore();
  const { setNotifications } = useNotificationStore();
  const prevCallStatus = useRef<string>('idle');

  // Charger la session au démarrage + demander les permissions Android
  useEffect(() => {
    loadFromStorage();
    // Demander toutes les permissions dès le lancement (Android 13/14/15/16+)
    requestAllPermissions().catch(() => {});
  }, []);

  // ✅ Démarrer/arrêter le service de notifications d'appels en arrière-plan
  useEffect(() => {
    if (isAuthenticated) {
      // Demander permission notification (obligatoire Android 13+ pour que le service fonctionne)
      requestNotificationPermission().then(() => {
        startCallNotificationService();
      });

      // Écouter les appels reçus quand l'app était fermée/en arrière-plan
      // CES événements viennent de MainActivity (Intent Android) via NativeEventEmitter
      const unsubIncoming = onIncomingCallFromService((data) => {
        const { setActiveCall, setStatus, setPendingOffer } = useCallStore.getState();
        setPendingOffer(null);
        setActiveCall({
          callId:      data.callId,
          callerId:    data.callerId,
          callerName:  data.callerName,
          callerAvatar: data.callerAvatar || null,
          type:        data.type as any,
          isGroupCall: data.isGroupCall,
        });
        setStatus('incoming');
        // Naviguer directement vers IncomingCall avec le flag openedFromNotification=true
        // pour éviter le doublon de sonnerie (le service natif joue déjà la sonnerie)
        if (navigationRef.isReady()) {
          navigationRef.navigate('IncomingCall' as never, { openedFromNotification: true } as never);
        }
      });

      const unsubEnded = onCallEndedFromService((_data) => {
        const { endCall } = useCallStore.getState();
        endCall();
      });

      return () => {
        unsubIncoming();
        unsubEnded();
      };
    } else {
      // Déconnexion → arrêter le service
      stopCallNotificationService();
    }
  }, [isAuthenticated]);

  // ✅ Dès que l'utilisateur est authentifié, charger conversations + notifications
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations().catch(() => {});
      notificationsAPI.getAll()
        .then((resp) => setNotifications(resp.data.data.notifications || []))
        .catch(() => {});
    }
  }, [isAuthenticated]);
  // ✅ FIX: IncomingCallScreen gère sa propre navigation vers ActiveCall
  // Ce useEffect gère uniquement: incoming → IncomingCall et idle → retour aux Tabs
  useEffect(() => {
    if (!navigationRef.isReady()) return;

    const prev = prevCallStatus.current;
    prevCallStatus.current = callStatus;

    if (callStatus === 'incoming' && prev !== 'incoming') {
      // Appel entrant → afficher l'écran IncomingCall par-dessus tout
      navigationRef.navigate('IncomingCall' as never);
    } else if (callStatus === 'idle' && (prev === 'active' || prev === 'connecting' || prev === 'calling' || prev === 'incoming')) {
      // Appel terminé/annulé/rejeté → retour aux tabs
      const current = navigationRef.getCurrentRoute?.()?.name;
      if (current === 'ActiveCall' || current === 'IncomingCall' || current === 'OutgoingCall') {
        navigationRef.navigate('Tabs' as never);
      }
    }
    // ⚠️ Ne pas gérer 'connecting' ici — IncomingCallScreen et OutgoingCallScreen
    // naviguent eux-mêmes vers ActiveCall pour éviter la double navigation
  }, [callStatus]);

  // Activer les événements socket en temps réel
  useSocketEvents();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      {!isAuthenticated ? (
        <Stack.Group>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Group>
      ) : (
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
            initialParams={{ openedFromNotification: false }}
          />
          <Stack.Screen
            name="ActiveCall"
            component={ActiveCallScreen}
            options={{ presentation: 'fullScreenModal', animation: 'fade' }}
          />
          <Stack.Screen
            name="NewMeeting"
            component={NewMeetingScreen}
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="Meeting"
            component={MeetingScreen}
            options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
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

const AppNavigator = () => (
  <SafeAreaProvider>
    <NavigationContainer ref={navigationRef}>
      <AppContent />
      {/* Bandeau réseau visible sur toutes les pages */}
      <NetworkStatus />
    </NavigationContainer>
  </SafeAreaProvider>
);

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
