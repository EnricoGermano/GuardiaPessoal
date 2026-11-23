import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { VaultProvider } from './src/context/VaultContext';
import { SetupScreen } from './src/screens/auth/SetupScreen';
import { LockScreen } from './src/screens/auth/LockScreen';
import { HomeScreen } from './src/screens/passwords/PasswordListScreen';

import * as ScreenCapture from 'expo-screen-capture';

function AppContent() {
  const { state } = useAuth();

  React.useEffect(() => {
    if (state.config.screenProtectionEnabled !== false) {
      ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    } else {
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    }
  }, [state.config.screenProtectionEnabled]);

  const bgColor = state.config.highContrast ? '#000000' : '#FBF9F5';

  if (!state.isReady) {
    return <View style={[styles.container, { backgroundColor: bgColor }]} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar style={state.config.highContrast ? 'light' : 'dark'} />
      {state.mode === 'setup' ? (
        <SetupScreen />
      ) : state.mode === 'locked' ? (
        <LockScreen />
      ) : (
        <VaultProvider>
          <HomeScreen />
        </VaultProvider>
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF9F5',
  },
});
