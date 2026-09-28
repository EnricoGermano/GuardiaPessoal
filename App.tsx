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

  if (!state.isReady) {
    return <View style={styles.container} />;
  }

  if (state.mode === 'setup') {
    return <SetupScreen />;
  }

  if (state.mode === 'locked') {
    return <LockScreen />;
  }

  return (
    <VaultProvider>
      <HomeScreen />
    </VaultProvider>
  );
}

export default function App() {
  ScreenCapture.usePreventScreenCapture();

  React.useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View style={styles.container}>
          <StatusBar style="dark" />
          <AppContent />
        </View>
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
