import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { Loading } from './src/components/ui';
import { AppProvider, useApp } from './src/context/AppContext';
import LoginScreen from './src/screens/LoginScreen';
import { colors } from './src/theme';
import HomeScreen from './src/screens/HomeScreen';
import QualityScreen from './src/screens/QualityScreen';
import OutagesScreen from './src/screens/OutagesScreen';
import PaymentsScreen from './src/screens/PaymentsScreen';
import ProceduresScreen from './src/screens/ProceduresScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';

const Tab = createBottomTabNavigator();

function Root() {
  const { user, ready, logout } = useApp();
  if (!ready) return <Loading />;
  if (!user) return <LoginScreen />;
  return (
    <NavigationContainer>
        <StatusBar style="light" />
        <Tab.Navigator
          screenOptions={{
            headerRight: () => (
              <Text accessibilityRole="button" onPress={logout} style={{ color: '#fff', marginRight: 14 }}>
                Salir
              </Text>
            ),
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: '#fff',
            tabBarActiveTintColor: colors.primary,
            tabBarLabelStyle: { fontSize: 11 },
            tabBarIconStyle: { display: 'none' },
            sceneStyle: { backgroundColor: colors.bg },
          }}
        >
          <Tab.Screen name="Inicio" component={HomeScreen} options={{ title: 'EMAPA Ibarra' }} />
          <Tab.Screen name="Calidad" component={QualityScreen} options={{ title: 'Calidad del agua' }} />
          <Tab.Screen name="Cortes" component={OutagesScreen} options={{ title: 'Cortes y fallas' }} />
          <Tab.Screen name="Pagos" component={PaymentsScreen} options={{ title: 'Mis facturas' }} />
          <Tab.Screen name="Trámites" component={ProceduresScreen} />
          <Tab.Screen name="Avisos" component={NotificationsScreen} options={{ title: 'Notificaciones' }} />
        </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  );
}
