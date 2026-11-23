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
import {
  analyzeFaceImage,
  cosineSimilarity,
  verifyFaceEmbedding,
} from '../crypto/faceRecognition';
import { getFaceTemplate, setFaceTemplate } from '../storage/secureStorage';

interface FaceAuthModalProps {
  visible: boolean;
  mode?: 'unlock' | 'enroll';
  onClose: () => void;
  onSuccess: () => void;
}

type AuthStatus =
  | 'idle'
  | 'requesting_permission'
  | 'ready'
  | 'scanning'
  | 'success'
  | 'failed'
  | 'not_enrolled';

const TOTAL_ENROLL_SAMPLES = 3;

export const FaceAuthModal: React.FC<FaceAuthModalProps> = ({
  visible,
  mode = 'unlock',
  onClose,
  onSuccess,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<AuthStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [statusHint, setStatusHint] = useState<string>('');
  const [enrollSamples, setEnrollSamples] = useState<number[][]>([]);
  const [systemBioAvailable, setSystemBioAvailable] = useState<boolean>(false);

  const cameraRef = useRef<CameraView | null>(null);
  const cameraReadyRef = useRef(false);
  const isBusyRef = useRef(false);
  const visibleRef = useRef(visible);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    visibleRef.current = visible;
    onSuccessRef.current = onSuccess;
  });

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const waitForCameraReady = async (maxWaitMs = 2500) => {
    const start = Date.now();
    while (!cameraReadyRef.current && Date.now() - start < maxWaitMs) {
      await sleep(100);
    }
    // Pequena pausa para estabilizar exposição automática da câmera frontal
    await sleep(350);
  };

  const runUnlockScan = useCallback(async () => {
    if (isBusyRef.current || !visibleRef.current) return;
    isBusyRef.current = true;
    setStatus('scanning');
    setErrorMessage('');
    setStatusHint('Analisando rosto pela câmera...');

    try {
      const templates = await getFaceTemplate();
      if (!templates || templates.length === 0) {
        const hasHw = await LocalAuthentication.hasHardwareAsync();
        const enrolledSys = hasHw ? await LocalAuthentication.isEnrolledAsync() : false;
        setSystemBioAvailable(enrolledSys);
        setStatus('not_enrolled');
        setErrorMessage(
          'Nenhum rosto cadastrado no Guardião Pessoal. Entre com seu PIN ou Digital e cadastre seu rosto em Ajustes → Reconhecimento Facial.'
        );
        isBusyRef.current = false;
        return;
      }

      await waitForCameraReady();

      let lastFailureMsg = 'Rosto não reconhecido. Centralize o rosto com boa iluminação.';

      for (let attempt = 1; attempt <= 3; attempt++) {
        if (!visibleRef.current) {
          isBusyRef.current = false;
          return;
        }

        if (!cameraRef.current) {
          await sleep(250);
          continue;
        }

        setStatusHint(
          attempt === 1
            ? 'Analisando rosto pela câmera...'
            : `Ajustando leitura facial (tentativa ${attempt}/3)...`
        );

        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.75,
          skipProcessing: true,
        });

        if (!photo?.uri) {
          await sleep(300);
          continue;
        }

        const analysis = await analyzeFaceImage(photo.uri);
        if (analysis.status !== 'ok' || !analysis.embedding) {
          lastFailureMsg = analysis.message || 'Centralize seu rosto na moldura.';
          await sleep(350);
          continue;
        }

        const verification = verifyFaceEmbedding(analysis.embedding, templates);
        if (verification.matched) {
          setStatus('success');
          setStatusHint('Identidade confirmada! Abrindo cofre...');
          setTimeout(() => {
            isBusyRef.current = false;
            if (visibleRef.current) {
              onSuccessRef.current();
            }
          }, 450);
          return;
        } else {
          lastFailureMsg =
            'Rosto não corresponde ao perfil cadastrado. Tente novamente com boa luz ou use o PIN.';
          await sleep(300);
        }
      }

      setStatus('failed');
      setErrorMessage(lastFailureMsg);
      isBusyRef.current = false;
    } catch {
      setStatus('failed');
      setErrorMessage('Não foi possível capturar a imagem da câmera. Tente novamente.');
      isBusyRef.current = false;
    }
  }, []);

  const handleCaptureEnrollSample = useCallback(async () => {
    if (isBusyRef.current || !visibleRef.current) return;
    isBusyRef.current = true;
    setStatus('scanning');
    setErrorMessage('');
    setStatusHint(`Capturando amostra ${enrollSamples.length + 1} de ${TOTAL_ENROLL_SAMPLES}...`);

    try {
      await waitForCameraReady(1500);
      if (!cameraRef.current) {
        setStatus('failed');
        setErrorMessage('Câmera ainda não está pronta. Aguarde um instante e tente novamente.');
        isBusyRef.current = false;
        return;
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });

      if (!photo?.uri) {
        setStatus('failed');
        setErrorMessage('Falha ao capturar foto da câmera.');
        isBusyRef.current = false;
        return;
      }

      const analysis = await analyzeFaceImage(photo.uri);
      if (analysis.status !== 'ok' || !analysis.embedding) {
        setStatus('failed');
        setErrorMessage(analysis.message || 'Centralize seu rosto na moldura com boa luz.');
        isBusyRef.current = false;
        return;
      }

      // Garante que todas as amostras do cadastro pertencem à mesma pessoa
      if (enrollSamples.length > 0) {
        const sim = cosineSimilarity(analysis.embedding, enrollSamples[0]);
        if (sim < 0.52) {
          setStatus('failed');
          setErrorMessage(
            'A leitura ficou muito diferente da primeira amostra. Mantenha o mesmo rosto centralizado.'
          );
          isBusyRef.current = false;
          return;
        }
      }

      const nextSamples = [...enrollSamples, analysis.embedding];
      setEnrollSamples(nextSamples);

      if (nextSamples.length >= TOTAL_ENROLL_SAMPLES) {
        await setFaceTemplate(nextSamples);
        setStatus('success');
        setStatusHint('Rosto cadastrado com sucesso no cofre!');
        setTimeout(() => {
          isBusyRef.current = false;
          if (visibleRef.current) {
            onSuccessRef.current();
          }
        }, 600);
      } else {
        setStatus('ready');
        setStatusHint(
          `Amostra ${nextSamples.length}/${TOTAL_ENROLL_SAMPLES} salva! Toque abaixo para capturar a próxima.`
        );
        isBusyRef.current = false;
      }
    } catch {
      setStatus('failed');
      setErrorMessage('Erro ao processar captura facial. Tente novamente.');
      isBusyRef.current = false;
    }
  }, [enrollSamples]);

  const handleFallbackSystemBiometric = useCallback(async () => {
    if (isBusyRef.current) return;
    isBusyRef.current = true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Biometria do Sistema',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: false,
      });
      if (result.success) {
        setStatus('success');
        setTimeout(() => {
          isBusyRef.current = false;
          if (visibleRef.current) onSuccessRef.current();
        }, 400);
        return;
      }
    } catch {
      // ignora
    }
    isBusyRef.current = false;
  }, []);

  useEffect(() => {
    if (!visible) {
      isBusyRef.current = false;
      cameraReadyRef.current = false;
      return;
    }

    setStatus('idle');
    setErrorMessage('');
    setStatusHint('');
    setEnrollSamples([]);
    isBusyRef.current = false;
    cameraReadyRef.current = false;

    (async () => {
      let granted = permission?.granted ?? false;
      if (!granted) {
        setStatus('requesting_permission');
        try {
          const res = await requestPermission();
          granted = res?.granted ?? false;
        } catch {
          granted = false;
        }
      }

      if (!granted) {
        setStatus('failed');
        setErrorMessage(
          'Permissão de câmera negada. Conceda acesso à câmera para usar o reconhecimento facial.'
        );
        return;
      }

      if (mode === 'enroll') {
        setStatus('ready');
        setStatusHint(
          `Posicione seu rosto na moldura e capture ${TOTAL_ENROLL_SAMPLES} amostras.`
        );
      } else {
        await runUnlockScan();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mode]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>
            {mode === 'enroll' ? 'Cadastrar Rosto (Câmera)' : 'Reconhecimento Facial'}
          </Text>
          <Text style={styles.subtitle}>
            {status === 'success'
              ? mode === 'enroll'
                ? 'Perfil facial salvo com segurança!'
                : 'Rosto validado com sucesso!'
              : status === 'failed'
              ? 'Não foi possível validar'
              : status === 'not_enrolled'
              ? 'Rosto ainda não cadastrado'
              : mode === 'enroll'
              ? `Etapa ${Math.min(enrollSamples.length + 1, TOTAL_ENROLL_SAMPLES)} de ${TOTAL_ENROLL_SAMPLES}`
              : 'Olhe de frente para a câmera'}
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
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="front"
                onCameraReady={() => {
                  cameraReadyRef.current = true;
                }}
              />
            ) : (
              <View style={styles.noCameraFallback}>
                <Text style={styles.cameraIconText}>Câmera</Text>
              </View>
            )}

            {status === 'scanning' && (
              <View style={styles.scannerOverlay}>
                <View style={styles.scanTarget} />
                <ActivityIndicator size="small" color="#996515" style={styles.loader} />
              </View>
            )}

            {status === 'success' && (
              <View style={styles.statusOverlay}>
                <Text style={styles.checkmark}>OK</Text>
              </View>
            )}

            {status === 'failed' && (
              <View style={styles.statusOverlay}>
                <Text style={styles.errorIcon}>!</Text>
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
            {(status === 'scanning' || status === 'ready' || status === 'success') && statusHint}
            {status === 'failed' && (errorMessage || 'Rosto não reconhecido.')}
            {status === 'not_enrolled' && errorMessage}
          </Text>

          {/* Botões de Ação */}
          <View style={styles.actions}>
            {mode === 'enroll' && status !== 'success' && (
              <TouchableOpacity
                style={[styles.retryBtn, status === 'scanning' && styles.btnDisabled]}
                onPress={handleCaptureEnrollSample}
                disabled={status === 'scanning'}
                activeOpacity={0.8}
              >
                <Text style={styles.retryText}>
                  {status === 'scanning'
                    ? 'Processando...'
                    : `Capturar Amostra (${enrollSamples.length + 1}/${TOTAL_ENROLL_SAMPLES})`}
                </Text>
              </TouchableOpacity>
            )}

            {mode === 'unlock' && status === 'failed' && (
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={runUnlockScan}
                activeOpacity={0.8}
              >
                <Text style={styles.retryText}>Escanear Novamente</Text>
              </TouchableOpacity>
            )}

            {mode === 'unlock' && status === 'not_enrolled' && systemBioAvailable && (
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={handleFallbackSystemBiometric}
                activeOpacity={0.8}
              >
                <Text style={styles.retryText}>Usar Biometria do Sistema</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelText}>
                {mode === 'enroll' ? 'Cancelar' : 'Cancelar e Usar PIN'}
              </Text>
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
    padding: 22,
    width: '100%',
    maxWidth: 340,
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
    marginBottom: 10,
    textAlign: 'center',
  },
  securityNoticeBox: {
    backgroundColor: '#FFF9EE',
    borderWidth: 1,
    borderColor: '#EED8A1',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 14,
    width: '100%',
  },
  securityNoticeText: {
    fontSize: 11,
    color: '#996515',
    textAlign: 'center',
    lineHeight: 15,
  },
  viewfinder: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: '#B5824C',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
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
  cameraIconText: {
    fontSize: 13,
    color: '#8A8175',
    fontWeight: '600',
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
    width: 116,
    height: 116,
    borderRadius: 58,
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
    fontSize: 32,
    color: '#4A7C59',
    fontWeight: 'bold',
  },
  errorIcon: {
    fontSize: 36,
    color: '#D9534F',
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#996515',
    marginBottom: 16,
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
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
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
