import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as LocalAuthentication from 'expo-local-authentication';

interface FaceAuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type AuthStatus = 'idle' | 'requesting_permission' | 'scanning' | 'success' | 'failed' | 'not_enrolled';

export const FaceAuthModal: React.FC<FaceAuthModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<AuthStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const isAuthenticating = useRef(false);

  const startAuthentication = useCallback(async () => {
    if (isAuthenticating.current) return;
    isAuthenticating.current = true;
    setStatus('scanning');
    setErrorMessage('');

    try {
      // 1. Verifica disponibilidade de hardware biométrico
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        setStatus('not_enrolled');
        setErrorMessage(
          !hasHardware
            ? 'Este aparelho não possui hardware biométrico disponível.'
            : 'Nenhuma biometria cadastrada no aparelho. Configure nas configurações do Android.'
        );
        isAuthenticating.current = false;
        return;
      }

      // 2. Chama a biometria nativa do Android
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Reconhecimento Facial / Biometria',
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar PIN',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setStatus('success');
        setTimeout(() => {
          isAuthenticating.current = false;
          onSuccess();
        }, 500);
      } else {
        setStatus('failed');
        setErrorMessage('Autenticação não reconhecida ou cancelada.');
        isAuthenticating.current = false;
      }
    } catch {
      setStatus('failed');
      setErrorMessage('Erro ao executar validação biométrica.');
      isAuthenticating.current = false;
    }
  }, [onSuccess]);

  useEffect(() => {
    if (visible) {
      setStatus('idle');
      setErrorMessage('');
      isAuthenticating.current = false;

      if (!permission?.granted) {
        requestPermission().then(res => {
          if (res?.granted) {
            startAuthentication();
          } else {
            startAuthentication();
          }
        });
      } else {
        startAuthentication();
      }
    } else {
      isAuthenticating.current = false;
    }
  }, [visible, permission?.granted, requestPermission, startAuthentication]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>Reconhecimento Facial</Text>
          <Text style={styles.subtitle}>
            {status === 'success'
              ? 'Rosto validado com sucesso!'
              : status === 'failed'
              ? 'Falha no reconhecimento'
              : status === 'not_enrolled'
              ? 'Biometria não configurada'
              : 'Olhe para a câmera para desbloquear'}
          </Text>

          {/* Moldura circular com preview da câmera frontal */}
          <View
            style={[
              styles.viewfinder,
              status === 'success' && styles.viewfinderSuccess,
              status === 'failed' && styles.viewfinderFailed,
            ]}
          >
            {permission?.granted ? (
              <CameraView style={styles.camera} facing="front" />
            ) : (
              <View style={styles.noCameraFallback}>
                <Text style={styles.cameraIcon}>👤</Text>
              </View>
            )}

            {/* Overlay com animação / scanner */}
            {status === 'scanning' && (
              <View style={styles.scannerOverlay}>
                <View style={styles.scanTarget} />
                <ActivityIndicator size="small" color="#996515" style={styles.loader} />
              </View>
            )}

            {status === 'success' && (
              <View style={styles.statusOverlay}>
                <Text style={styles.checkmark}>✓</Text>
              </View>
            )}

            {status === 'failed' && (
              <View style={styles.statusOverlay}>
                <Text style={styles.errorIcon}>✕</Text>
              </View>
            )}
          </View>

          {/* Mensagem descritiva de status */}
          <Text
            style={[
              styles.statusText,
              status === 'success' && styles.statusTextSuccess,
              status === 'failed' && styles.statusTextFailed,
              status === 'not_enrolled' && styles.statusTextWarning,
            ]}
          >
            {status === 'scanning' && 'Validando dados biométricos...'}
            {status === 'success' && 'Identidade confirmada! Abrindo...'}
            {status === 'failed' && (errorMessage || 'Rosto não autorizado.')}
            {status === 'not_enrolled' && errorMessage}
          </Text>

          {/* Botões de Ação */}
          <View style={styles.actions}>
            {(status === 'failed' || status === 'not_enrolled') && (
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={startAuthentication}
                activeOpacity={0.8}
              >
                <Text style={styles.retryText}>Tentar Novamente</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Cancelar e Usar PIN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1E1E',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#7A7265',
    marginBottom: 18,
    textAlign: 'center',
  },
  viewfinder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
    borderColor: '#B5824C',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#F7F4EE',
  },
  viewfinderSuccess: {
    borderColor: '#4A7C59',
  },
  viewfinderFailed: {
    borderColor: '#D9534F',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  noCameraFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF9EE',
  },
  cameraIcon: {
    fontSize: 52,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(181, 130, 76, 0.08)',
  },
  scanTarget: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1.5,
    borderColor: '#B5824C',
    borderStyle: 'dashed',
  },
  loader: {
    position: 'absolute',
  },
  statusOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  checkmark: {
    fontSize: 54,
    color: '#4A7C59',
    fontWeight: 'bold',
  },
  errorIcon: {
    fontSize: 50,
    color: '#D9534F',
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#996515',
    marginBottom: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  statusTextSuccess: {
    color: '#4A7C59',
  },
  statusTextFailed: {
    color: '#D9534F',
  },
  statusTextWarning: {
    color: '#D9822B',
  },
  actions: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  retryBtn: {
    backgroundColor: '#B5824C',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: 13,
    color: '#8A8175',
    fontWeight: '600',
  },
});
