import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, MAX_FAILED_ATTEMPTS } from '../../context/AuthContext';

export function LockScreen() {
  const { state, unlockWithPin } = useAuth();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const busyRef = useRef(false);

  // Contagem regressiva derivada do timestamp persistido (state.lockoutUntil).
  // Quando o tempo acaba, o desbloqueio volta a funcionar automaticamente.
  useEffect(() => {
    if (state.lockoutUntil <= Date.now()) return;
    setNow(Date.now());
    const interval = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= state.lockoutUntil) clearInterval(interval);
    }, 250);
    return () => clearInterval(interval);
  }, [state.lockoutUntil]);

  const lockCountdown = Math.max(0, Math.ceil((state.lockoutUntil - now) / 1000));
  const isLocked = lockCountdown > 0;

  const submitPin = async (inputPin: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);

    // Deixa a UI desenhar o 4o ponto antes do PBKDF2 (sincrono) rodar.
    await new Promise(resolve => setTimeout(resolve, 50));

    let result;
    try {
      result = await unlockWithPin(inputPin);
    } catch {
      result = 'wrong' as const;
    } finally {
      busyRef.current = false;
      setBusy(false);
      setPin('');
    }

    switch (result) {
      case 'unlocked':
        return;
      case 'emergency':
        Alert.alert('Dados apagados', 'Todos os dados foram removidos.');
        return;
      case 'wiped':
        Alert.alert(
          'Cofre apagado',
          `Foram ${MAX_FAILED_ATTEMPTS} tentativas incorretas. Por seguranca, todos os dados foram removidos.`,
        );
        return;
      case 'locked':
        setNow(Date.now());
        return;
      case 'wrong': {
        Vibration.vibrate(200);
        const remaining = MAX_FAILED_ATTEMPTS - (state.failedAttempts + 1);
        if (remaining > 0 && remaining <= 3) {
          Alert.alert('PIN incorreto', `Restam ${remaining} tentativa(s) antes de apagar tudo.`);
        }
      }
    }
  };

  const handleKeyPress = (val: string) => {
    if (isLocked || busy || !val) return;
    if (val === '<') {
      setPin(prev => prev.slice(0, -1));
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
    ['', '0', '<'],
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.appName}>Guardiao Pessoal</Text>
        <Text style={styles.subtitle}>
          {busy ? 'Verificando...' : 'Digite seu PIN de 4 digitos'}
        </Text>

        {renderDots()}

        {isLocked && (
          <Text style={styles.lockText}>
            Bloqueado por {lockCountdown}s
          </Text>
        )}

        {state.failedAttempts > 0 && !isLocked && (
          <Text style={styles.errorText}>
            {state.failedAttempts} tentativa(s) incorreta(s)
          </Text>
        )}

        <View style={styles.keypad}>
          {keypadRows.map((row, rIdx) => (
            <View key={rIdx} style={styles.keypadRow}>
              {row.map((val, cIdx) =>
                val === '' ? (
                  <View key={`empty-${cIdx}`} style={styles.keyPlaceholder} />
                ) : (
                  <TouchableOpacity
                    key={val}
                    style={[styles.keyButton, (isLocked || busy) && styles.keyDisabled]}
                    onPress={() => handleKeyPress(val)}
                    disabled={isLocked || busy}
                  >
                    <Text style={styles.keyText}>{val}</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          ))}
        </View>
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
  keyDisabled: { opacity: 0.4 },
  keyPlaceholder: { width: 70, height: 70 },
  keyText: { color: '#1E1E1E', fontSize: 22, fontWeight: '600' },
});
