import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { authenticateWithBiometrics, isBiometricAvailable } from '../../hooks/useBiometrics';
import { FaceAuthModal } from '../../components/FaceAuthModal';

export function LockScreen() {
  const { state, verifyPin, unlock, unlockDaily, wipeAll } = useAuth();
  const [pin, setPin] = useState('');
  const [biometricReady, setBiometricReady] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(0);
  const [faceModalVisible, setFaceModalVisible] = useState(false);

  useEffect(() => {
    (async () => {
      if (state.config.biometricsEnabled) {
        const available = await isBiometricAvailable();
        setBiometricReady(available);
        if (available) {
          tryBiometric();
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (state.lockoutSeconds > 0) {
      setLockCountdown(state.lockoutSeconds);
      const interval = setInterval(() => {
        setLockCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.lockoutSeconds]);

  const tryBiometric = useCallback(async () => {
    const result = await authenticateWithBiometrics('Desbloqueie o Guardiao Pessoal');
    if (result.success) {
      await unlock('biometric');
    }
  }, [unlock]);

  const handleKeyPress = (val: string) => {
    if (lockCountdown > 0) return;
    if (val === '<') {
      setPin(prev => prev.slice(0, -1));
      return;
    }
    if (val === 'face') {
      setFaceModalVisible(true);
      return;
    }
    if (pin.length < 4) {
      const nextPin = pin + val;
      setPin(nextPin);
      if (nextPin.length === 4) {
        submitPin(nextPin);
      }
    }
  };

  const submitPin = async (inputPin: string) => {
    const result = await verifyPin(inputPin);
    setPin('');

    if (result === 'emergency') {
      await wipeAll();
      Alert.alert('Dados apagados', 'Todos os dados foram removidos.');
      return;
    }

    if (result === 'master') {
      await unlock(inputPin, false);
      return;
    }

    if (result === 'daily') {
      const ok = await unlockDaily(inputPin);
      if (ok) return;
      await unlock(inputPin, false);
      return;
    }

    Vibration.vibrate(200);
    const remaining = 10 - (state.failedAttempts + 1);
    if (remaining > 0 && remaining <= 3) {
      Alert.alert('PIN incorreto', `Restam ${remaining} tentativas antes de apagar tudo.`);
    }
  };

  const renderDots = () => (
    <View style={styles.dotsRow}>
      {[0, 1, 2, 3].map(i => (
        <View
          key={i}
          style={[styles.dot, i < pin.length && styles.dotFilled]}
        />
      ))}
    </View>
  );

  const keypadRows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['face', '0', '<'],
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.appName}>Guardiao Pessoal</Text>
        <Text style={styles.subtitle}>Digite seu PIN de 4 digitos</Text>

        {renderDots()}

        {lockCountdown > 0 && (
          <Text style={styles.lockText}>
            Bloqueado por {lockCountdown}s
          </Text>
        )}

        {state.failedAttempts > 0 && lockCountdown === 0 && (
          <Text style={styles.errorText}>
            {state.failedAttempts} tentativa(s) incorreta(s)
          </Text>
        )}

        <View style={styles.keypad}>
          {keypadRows.map((row, rIdx) => (
            <View key={rIdx} style={styles.keypadRow}>
              {row.map(val => (
                <TouchableOpacity
                  key={val}
                  style={styles.keyButton}
                  onPress={() => handleKeyPress(val)}
                  disabled={lockCountdown > 0}
                >
                  <Text style={[styles.keyText, val === 'face' && styles.faceText]}>
                    {val === 'face' ? 'Face' : val}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>

        {biometricReady && (
          <TouchableOpacity style={styles.bioButton} onPress={tryBiometric}>
            <Text style={styles.bioText}>Usar Impressao Digital</Text>
          </TouchableOpacity>
        )}

        <FaceAuthModal
          visible={faceModalVisible}
          onClose={() => setFaceModalVisible(false)}
          onSuccess={async () => {
            setFaceModalVisible(false);
            await unlock('facial');
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF9F5' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  appName: { color: '#1E1E1E', fontSize: 26, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: '#756F68', fontSize: 14, marginBottom: 28 },
  dotsRow: { flexDirection: 'row', gap: 16, marginBottom: 32 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#E6DFD5',
    backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: '#B5824C', borderColor: '#B5824C' },
  lockText: { color: '#D9534F', fontSize: 14, marginBottom: 12, fontWeight: '600' },
  errorText: { color: '#D9822B', fontSize: 13, marginBottom: 12, fontWeight: '600' },
  keypad: { width: '100%', maxWidth: 280, gap: 14, marginBottom: 24 },
  keypadRow: { flexDirection: 'row', justifyContent: 'space-between' },
  keyButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#B5824C',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#1E1E1E',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  keyText: { color: '#1E1E1E', fontSize: 22, fontWeight: '600' },
  faceText: { fontSize: 13, color: '#756F68' },
  bioButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#B5824C',
  },
  bioText: { color: '#B5824C', fontSize: 14, fontWeight: '600' },
});
