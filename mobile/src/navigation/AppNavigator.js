// mobile/src/navigation/AppNavigator.js
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import useAuthStore from '../store/authStore';
import useSocketStore from '../store/socketStore';
import AuthNavigator from './AuthNavigator';
import TabNavigator from './TabNavigator';

// Modals globaux appels
import IncomingCallModal from '../components/calls/IncomingCallModal';
import OutgoingCallModal from '../components/calls/OutgoingCallModal';
import ActiveCallBar from '../components/calls/ActiveCallBar';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { isAuthenticated, isInitialized, initialize, accessToken } =
    useAuthStore();
  const { connect } = useSocketStore();

  // Lire SecureStore au démarrage
  useEffect(() => {
    initialize();
  }, []);

  // Connecter le socket quand authentifié
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      connect(accessToken);
    }
  }, [isAuthenticated, accessToken]);

  // Écran de chargement pendant l'initialisation
  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#16a34a' }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={TabNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>

      {/* Modals globaux d'appel — affichés par-dessus toutes les vues */}
      {isAuthenticated && (
        <>
          <IncomingCallModal />
          <OutgoingCallModal />
          <ActiveCallBar />
        </>
      )}
    </NavigationContainer>
  );
}