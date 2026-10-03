import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { PasswordStrengthBar, calculatePinStrength } from '../../components/PasswordStrengthBar';

type Step = 'pin' | 'confirm' | 'emergency';

const STEPS: Step[] = ['pin', 'confirm', 'emergency'];

export function SetupScreen() {
  const { setupVault } = useAuth();

  const [step, setStep] = useState<Step>('pin');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [emergencyPin, setEmergencyPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePinInput = (text: string, setter: (v: string) => void) => {
    const clean = text.replace(/[^0-9]/g, '').substring(0, 4);
    setter(clean);
  };

  const nextStep = () => {
    switch (step) {
      case 'pin':
        if (pin.length < 4) return Alert.alert('Erro', 'Digite 4 digitos.');
        if (calculatePinStrength(pin) <= 1) {
          return Alert.alert(
            'PIN muito fraco',
            'Evite digitos repetidos ou sequencias (ex: 0000, 1234, 1122).',
          );
        }
        setConfirmPin('');
        setStep('confirm');
        break;
      case 'confirm':
        if (confirmPin !== pin) return Alert.alert('Erro', 'Os PINs nao conferem.');
        setStep('emergency');
        break;
      case 'emergency':
        if (emergencyPin.length < 4) return Alert.alert('Erro', 'Digite 4 digitos.');
        if (emergencyPin === pin) return Alert.alert('Erro', 'Deve ser diferente do PIN principal.');
        if (calculatePinStrength(emergencyPin) <= 1) {
          return Alert.alert(
            'PIN de emergencia muito fraco',
            'Evite digitos repetidos ou sequencias (ex: 0000, 1111, 1234, 1122).'
          );
        }
        finishSetup();
        break;
    }
  };

  const finishSetup = async () => {
    setLoading(true);
    // Deixa a UI mostrar "Configurando..." antes do PBKDF2 (sincrono).
    await new Promise(resolve => setTimeout(resolve, 50));
    try {
      await setupVault(pin, emergencyPin);
    } catch (e) {
      Alert.alert('Erro', 'Falha ao configurar o cofre.');
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'pin':
        return (
          <>
            <Text style={styles.title}>Criar Senha Mestra</Text>
            <Text style={styles.subtitle}>Escolha um PIN de 4 digitos</Text>
            <TextInput
              style={styles.pinInput}
              value={pin}
              onChangeText={t => handlePinInput(t, setPin)}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="••••"
              placeholderTextColor="#A8A199"
              autoFocus
            />
            {pin.length > 0 && <PasswordStrengthBar score={calculatePinStrength(pin)} />}
          </>
        );
      case 'confirm':
        return (
          <>
            <Text style={styles.title}>Confirmar PIN</Text>
            <Text style={styles.subtitle}>Digite o PIN novamente</Text>
            <TextInput
              style={styles.pinInput}
              value={confirmPin}
              onChangeText={t => handlePinInput(t, setConfirmPin)}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="••••"
              placeholderTextColor="#A8A199"
              autoFocus
            />
          </>
        );
      case 'emergency':
        return (
          <>
            <Text style={styles.title}>PIN de Emergencia</Text>
            <Text style={styles.subtitle}>
              Se voce digitar esse PIN, todos os dados serao apagados imediatamente.
              Use em situacoes de coacao.
            </Text>
            <TextInput
              style={styles.pinInput}
              value={emergencyPin}
              onChangeText={t => handlePinInput(t, setEmergencyPin)}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="••••"
              placeholderTextColor="#A8A199"
              autoFocus
            />
            {emergencyPin.length > 0 && <PasswordStrengthBar score={calculatePinStrength(emergencyPin)} />}
          </>
        );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.appName}>Guardiao Pessoal</Text>
            <Text style={styles.stepIndicator}>
              Passo {STEPS.indexOf(step) + 1} de {STEPS.length}
            </Text>
          </View>

          <View style={styles.card}>
            {renderStep()}
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={nextStep}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Configurando...' : step === 'emergency' ? 'Finalizar' : 'Continuar'}
            </Text>
          </TouchableOpacity>

          {step !== 'pin' && !loading && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                const idx = STEPS.indexOf(step);
                if (idx > 0) setStep(STEPS[idx - 1]);
              }}
            >
              <Text style={styles.backText}>Voltar</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF9F5' },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 32 },
  appName: { color: '#1E1E1E', fontSize: 26, fontWeight: '700' },
  stepIndicator: { color: '#B5824C', fontSize: 13, marginTop: 6, fontWeight: '600' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E6DFD5',
  },
  title: { color: '#1E1E1E', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#756F68', fontSize: 14, marginBottom: 20, lineHeight: 20 },
  pinInput: {
    backgroundColor: '#F3EFE8',
    color: '#1E1E1E',
    fontSize: 28,
    textAlign: 'center',
    padding: 16,
    borderRadius: 12,
    letterSpacing: 14,
    borderWidth: 1,
    borderColor: '#E6DFD5',
  },
  textInput: {
    backgroundColor: '#F3EFE8',
    color: '#1E1E1E',
    fontSize: 15,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6DFD5',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#B5824C',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  backButton: { alignItems: 'center', marginTop: 16 },
  backText: { color: '#756F68', fontSize: 14 },
});
