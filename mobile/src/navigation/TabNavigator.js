// mobile/src/navigation/TabNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../store/authStore';

// Screens
import ChatScreen from '../screens/ChatScreen';
import ConversationScreen from '../screens/ConversationScreen';
import CallsScreen from '../screens/CallsScreen';
import DirectoryScreen from '../screens/DirectoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AdminScreen from '../screens/AdminScreen';

const Tab = createBottomTabNavigator();
const ChatStack = createNativeStackNavigator();

// ── Stack Chat (liste + conversation) ───────────────────────────
function ChatStackNavigator() {
  return (
    <ChatStack.Navigator screenOptions={{ headerShown: false }}>
      <ChatStack.Screen name="ChatList" component={ChatScreen} />
      <ChatStack.Screen name="Conversation" component={ConversationScreen} />
    </ChatStack.Navigator>
  );
}

// ── Tabs principale ──────────────────────────────────────────────
export default function TabNavigator() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#16a34a',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
          borderTopWidth: 1,
          paddingBottom: 6,
          paddingTop: 6,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Chat:      focused ? 'chatbubbles'          : 'chatbubbles-outline',
            Calls:     focused ? 'call'                  : 'call-outline',
            Directory: focused ? 'book'                  : 'book-outline',
            Profile:   focused ? 'person'                : 'person-outline',
            Admin:     focused ? 'shield-checkmark'      : 'shield-checkmark-outline',
          };
          return (
            <Ionicons
              name={icons[route.name] || 'ellipse-outline'}
              size={22}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Chat"
        component={ChatStackNavigator}
        options={{ tabBarLabel: 'Messages' }}
      />
      <Tab.Screen
        name="Calls"
        component={CallsScreen}
        options={{ tabBarLabel: 'Appels' }}
      />
      <Tab.Screen
        name="Directory"
        component={DirectoryScreen}
        options={{ tabBarLabel: 'Annuaire' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profil' }}
      />
      {isAdmin && (
        <Tab.Screen
          name="Admin"
          component={AdminScreen}
          options={{ tabBarLabel: 'Admin' }}
        />
      )}
    </Tab.Navigator>
  );
}