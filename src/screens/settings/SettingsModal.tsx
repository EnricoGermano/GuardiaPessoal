import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useVault } from '../../context/VaultContext';
import { calculatePinStrength } from '../../components/PasswordStrengthBar';
import { FaceAuthModal } from '../../components/FaceAuthModal';
import { hasFaceTemplate, setFaceTemplate } from '../../storage/secureStorage';
import { useThemeColors } from '../../theme/useThemeColors';
import { getConfiguredSafeZones, getCurrentCoordinates, geocodeAddress } from '../../utils/locationGuard';
import {
  exportEncryptedBackup,
  pickBackupFileContent,
  decryptBackupContent,
  exportStrengthReportPlaintext,
} from '../../utils/backup';
import type { SafeZone } from '../../types/auth';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const RADIUS_OPTIONS = [100, 300, 500, 1000] as const;

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0);
  const colors = useThemeColors();
  const { state, changeMasterPin, changeEmergencyPin, updateConfig, wipeAll } = useAuth();
  const { vault, replaceVault } = useVault();

  // PIN Mestre
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');

  // PIN de Emergencia (US21)
  const [masterForEmergency, setMasterForEmergency] = useState('');
  const [newEmergencyPin, setNewEmergencyPin] = useState('');

  // Biometria Facial
  const [faceEnrolled, setFaceEnrolled] = useState(false);
  const [faceEnrollModalVisible, setFaceEnrollModalVisible] = useState(false);

  // Zonas Seguras GPS (US18)
  const [zoneMode, setZoneMode] = useState<'current' | 'address'>('current');
  const [zoneName, setZoneName] = useState('');
  const [zoneAddress, setZoneAddress] = useState('');
  const [zoneRadius, setZoneRadius] = useState<number>(300);
  const [addingZone, setAddingZone] = useState(false);

  // Backup Criptografado (US24) & Relatorio (US25)
  const [backupPassword, setBackupPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [busyBackup, setBusyBackup] = useState(false);

  const safeZones = getConfiguredSafeZones(state.config);

  const refreshFaceStatus = useCallback(async () => {
    const enrolled = await hasFaceTemplate();
    setFaceEnrolled(enrolled);
  }, []);

  useEffect(() => {
    if (visible) {
      refreshFaceStatus();
    }
  }, [visible, refreshFaceStatus]);

  const handleToggleFaceRecognition = async (val: boolean) => {
    updateConfig({ faceRecognitionEnabled: val });
    if (val) {
      const enrolled = await hasFaceTemplate();
      if (!enrolled) {
        setFaceEnrollModalVisible(true);
      }
    }
  };

  const handleRemoveFace = () => {
    Alert.alert(
      'Remover Rosto Cadastrado',
      'Deseja remover o perfil facial salvo no aplicativo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            await setFaceTemplate(null);
            setFaceEnrolled(false);
          },
        },
      ]
    );
  };

  const handleAddSafeZone = async () => {
    setAddingZone(true);
    try {
      let coords: { latitude: number; longitude: number };
      let finalName = zoneName.trim();
      let usedAddress: string | undefined = undefined;

      if (zoneMode === 'address') {
        if (state.config.offlineOnly) {
          Alert.alert(
            'Modo 100% Offline Ativo',
            'A busca por endereço requer conexão com a internet. Use "Local Atual (GPS)" ou desative temporariamente o Modo 100% Offline.'
          );
          setAddingZone(false);
          return;
        }
        const cleanAddress = zoneAddress.trim();
        if (!cleanAddress) {
          Alert.alert('Atenção', 'Digite um endereço para cadastrar a zona segura (ex: Av. Paulista, 1000 - São Paulo).');
          setAddingZone(false);
          return;
        }
        coords = await geocodeAddress(cleanAddress, state.config.offlineOnly);
        usedAddress = cleanAddress;
        if (!finalName) {
          finalName = `Local Seguro ${safeZones.length + 1}`;
        }
      } else {
        coords = await getCurrentCoordinates();
        if (!finalName) {
          finalName = `Zona Atual ${safeZones.length + 1}`;
        }
      }

      const newZone: SafeZone = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: finalName,
        address: usedAddress,
        latitude: coords.latitude,
        longitude: coords.longitude,
        radiusMeters: zoneRadius,
        createdAt: Date.now(),
      };
      const updated = [...safeZones, newZone];
      await updateConfig({
        safeZones: updated,
        locationLockEnabled: true,
      });
      setZoneName('');
      setZoneAddress('');
      Alert.alert(
        'Zona Segura Adicionada',
        `"${newZone.name}" cadastrada com raio de ${newZone.radiusMeters}m.`
      );
    } catch (err: any) {
      Alert.alert('Erro ao definir local', err?.message || 'Não foi possível obter as coordenadas.');
    } finally {
      setAddingZone(false);
    }
  };

  const handleRemoveSafeZone = (id: string) => {
    const updated = safeZones.filter(z => z.id !== id);
    updateConfig({
      safeZones: updated,
      ...(updated.length === 0 ? { locationLockEnabled: false, safeLatitude: undefined, safeLongitude: undefined } : {}),
    });
  };

  const handleChangePin = async () => {
    const cleanOld = oldPin.replace(/[^0-9]/g, '');
    const cleanNew = newPin.replace(/[^0-9]/g, '');
    if (cleanOld.length !== 4) {
      Alert.alert('Atenção', 'Informe o PIN atual de 4 dígitos.');
      return;
    }
    if (cleanNew.length !== 4) {
      Alert.alert('Atenção', 'O novo PIN deve ter exatamente 4 dígitos numéricos.');
      return;
    }
    if (calculatePinStrength(cleanNew) <= 1) {
      Alert.alert(
        'PIN muito fraco',
        'Evite dígitos repetidos ou sequências (ex: 0000, 1234, 1122).'
      );
      return;
    }
    const res = await changeMasterPin(cleanOld, cleanNew);
    if (res === 'ok') {
      Alert.alert('Sucesso', 'PIN mestre alterado com sucesso!');
      setOldPin('');
      setNewPin('');
    } else if (res === 'same_as_emergency') {
      Alert.alert('Erro', 'O novo PIN mestre não pode ser igual ao PIN de emergência.');
    } else if (res === 'same_as_old') {
      Alert.alert('Atenção', 'O novo PIN deve ser diferente do PIN atual.');
    } else {
      Alert.alert('Erro', 'PIN atual incorreto.');
    }
  };

  const handleChangeEmergencyPin = async () => {
    const cleanMaster = masterForEmergency.replace(/[^0-9]/g, '');
    const cleanEmerg = newEmergencyPin.replace(/[^0-9]/g, '');
    if (cleanMaster.length !== 4 || cleanEmerg.length !== 4) {
      Alert.alert('Atenção', 'Informe o PIN mestre atual e o novo PIN de emergência (4 dígitos cada).');
      return;
    }
    if (calculatePinStrength(cleanEmerg) <= 1) {
      Alert.alert('PIN muito fraco', 'Evite dígitos repetidos ou sequências no PIN de emergência.');
      return;
    }
    const res = await changeEmergencyPin(cleanMaster, cleanEmerg);
    if (res === 'ok') {
      Alert.alert('Sucesso', 'PIN de emergência atualizado com sucesso!');
      setMasterForEmergency('');
      setNewEmergencyPin('');
    } else if (res === 'same_as_master') {
      Alert.alert('Erro', 'O PIN de emergência deve ser diferente do PIN mestre.');
    } else {
      Alert.alert('Erro', 'PIN mestre incorreto.');
    }
  };

  const handleExportBackup = async () => {
    if (!vault) return;
    if (backupPassword.length < 4) {
      Alert.alert('Atenção', 'Defina uma senha de backup com pelo menos 4 caracteres.');
      return;
    }
    setBusyBackup(true);
    try {
      const filename = await exportEncryptedBackup(vault, backupPassword);
      setBackupPassword('');
      Alert.alert('Backup Exportado', `Arquivo criptografado gerado: ${filename}`);
    } catch (err: any) {
      Alert.alert('Erro na Exportação', err?.message || 'Não foi possível exportar o backup.');
    } finally {
      setBusyBackup(false);
    }
  };

  const handleImportBackup = async () => {
    if (importPassword.length < 4) {
      Alert.alert('Atenção', 'Digite a senha do backup antes de selecionar o arquivo.');
      return;
    }
    setBusyBackup(true);
    try {
      const picked = await pickBackupFileContent();
      if (!picked) {
        setBusyBackup(false);
        return;
      }
      const importedVault = decryptBackupContent(picked.content, importPassword);
      Alert.alert(
        'Confirmar Importação',
        `Arquivo "${picked.name}" descriptografado (${importedVault.passwords.length} senhas, ${importedVault.notes.length} notas). Deseja substituir os dados atuais do cofre?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Importar e Substituir',
            style: 'destructive',
            onPress: async () => {
              try {
                await replaceVault(importedVault);
                setImportPassword('');
                Alert.alert('Sucesso', 'Cofre restaurado a partir do backup criptografado!');
              } catch (saveErr: any) {
                Alert.alert('Erro na Restauração', saveErr?.message || 'Não foi possível salvar os dados importados.');
              }
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Erro na Importação', err?.message || 'Não foi possível importar o backup.');
    } finally {
      setBusyBackup(false);
    }
  };

  const handleExportPlaintextReport = () => {
    if (!vault) return;
    Alert.alert(
      'Aviso de Segurança (Texto Simples)',
      'Este relatório será exportado em texto simples (.txt) sem criptografia para análise de força das credenciais. Deseja continuar explicitamente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Exportar Relatório',
          onPress: async () => {
            try {
              const filename = await exportStrengthReportPlaintext(vault);
              Alert.alert('Relatório Gerado', `Arquivo exportado: ${filename}`);
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Falha ao gerar relatório.');
            }
          },
        },
      ]
    );
  };

  const handleWipe = () => {
    Alert.alert(
      'PERIGO: Limpeza Completa',
      'Esta operação irá apagar permanentemente todas as senhas, notas e chaves do aparelho. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'APAGAR TUDO',
          style: 'destructive',
          onPress: async () => {
            await wipeAll();
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.safeArea, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { paddingTop: Math.max(topPad, 12) + 6, backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            activeOpacity={0.7}
          >
            <Text style={[styles.closeText, { color: colors.textSecondary }]}>Voltar</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>Configurações de Segurança</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Timeout de Inatividade (US19) */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Bloqueio por Inatividade</Text>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
              Tempo sem atividade no aplicativo antes de trancar o cofre automaticamente.
            </Text>
            <View style={styles.chipsRow}>
              {([1, 5, 15] as const).map(min => (
                <TouchableOpacity
                  key={min}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong },
                    state.config.autoLockMinutes === min && { backgroundColor: colors.accentBg, borderColor: colors.accent },
                  ]}
                  onPress={() => updateConfig({ autoLockMinutes: min })}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.textSecondary },
                      state.config.autoLockMinutes === min && { color: colors.accent, fontWeight: '700' },
                    ]}
                  >
                    {min} min
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Zonas Seguras GPS (US18) */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.rowBetween}>
              <View style={styles.toggleLabelCol}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Zonas Seguras (GPS)</Text>
                <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
                  Bloqueia o acesso ao cofre fora das áreas autorizadas
                </Text>
              </View>
              <Switch
                value={state.config.locationLockEnabled}
                onValueChange={val => {
                  if (val && safeZones.length === 0) {
                    Alert.alert('Cadastre um local', 'Adicione pelo menos uma zona segura abaixo antes de ativar o bloqueio.');
                    return;
                  }
                  updateConfig({ locationLockEnabled: val });
                }}
                trackColor={{ false: colors.borderStrong, true: colors.accent }}
              />
            </View>

            <View style={{ marginTop: 12 }}>
              <View style={[styles.chipsRow, { marginBottom: 12 }]}>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong },
                    zoneMode === 'current' && { backgroundColor: colors.accentBg, borderColor: colors.accent },
                  ]}
                  onPress={() => setZoneMode('current')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.textSecondary },
                      zoneMode === 'current' && { color: colors.accent, fontWeight: '700' },
                    ]}
                  >
                    Local Atual (GPS)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.chip,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong },
                    zoneMode === 'address' && { backgroundColor: colors.accentBg, borderColor: colors.accent },
                  ]}
                  onPress={() => setZoneMode('address')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.textSecondary },
                      zoneMode === 'address' && { color: colors.accent, fontWeight: '700' },
                    ]}
                  >
                    Digitar Endereço
                  </Text>
                </TouchableOpacity>
              </View>

              {zoneMode === 'address' ? (
                <>
                  {state.config.offlineOnly && (
                    <Text style={[styles.sectionDesc, { color: colors.warning, marginBottom: 8 }]}>
                      Modo 100% Offline ativo: busca por endereço bloqueada. Use "Local Atual (GPS)" ou desative o modo offline abaixo.
                    </Text>
                  )}
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong, color: colors.text }]}
                    placeholder="Endereço (ex: Av. Paulista, 1000, São Paulo)"
                    placeholderTextColor={colors.placeholder}
                    value={zoneAddress}
                    onChangeText={setZoneAddress}
                    editable={!state.config.offlineOnly}
                  />
                </>
              ) : null}

              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong, color: colors.text }]}
                placeholder="Nome do local (ex: Casa, Trabalho)"
                placeholderTextColor={colors.placeholder}
                value={zoneName}
                onChangeText={setZoneName}
              />

              <Text style={[styles.subLabel, { color: colors.textSecondary }]}>Raio de tolerância:</Text>
              <View style={[styles.chipsRow, { marginBottom: 10 }]}>
                {RADIUS_OPTIONS.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong },
                      zoneRadius === r && { backgroundColor: colors.accentBg, borderColor: colors.accent },
                    ]}
                    onPress={() => setZoneRadius(r)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: colors.textSecondary },
                        zoneRadius === r && { color: colors.accent, fontWeight: '700' },
                      ]}
                    >
                      {r}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]}
                onPress={handleAddSafeZone}
                disabled={addingZone}
              >
                {addingZone ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Text style={[styles.actionBtnText, { color: colors.accent }]}>
                    {zoneMode === 'address' ? 'Buscar e Salvar Endereço Seguro' : 'Adicionar Local Atual (GPS)'}
                  </Text>
                )}
              </TouchableOpacity>

              {safeZones.map(zone => (
                <View key={zone.id} style={[styles.zoneRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, { color: colors.text }]}>{zone.name}</Text>
                    {zone.address ? (
                      <Text style={[styles.itemSubtitle, { color: colors.textSecondary, marginBottom: 2 }]} numberOfLines={2}>
                        Endereço: {zone.address}
                      </Text>
                    ) : null}
                    <Text style={[styles.itemSubtitle, { color: colors.textMuted }]}>
                      Raio: {zone.radiusMeters}m • {zone.latitude.toFixed(4)}, {zone.longitude.toFixed(4)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.removeFaceBtn, { backgroundColor: colors.dangerBg }]}
                    onPress={() => handleRemoveSafeZone(zone.id)}
                  >
                    <Text style={[styles.removeFaceBtnText, { color: colors.danger }]}>Remover</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          {/* Biometria e Facial (US09 e US10) */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Biometria e Reconhecimento</Text>
            <View style={styles.rowBetween}>
              <View style={styles.toggleLabelCol}>
                <Text style={[styles.itemTitle, { color: colors.text }]}>Impressão Digital</Text>
                <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>Desbloqueio rápido via sensor biométrico nativo</Text>
              </View>
              <Switch
                value={state.config.biometricsEnabled}
                onValueChange={val => updateConfig({ biometricsEnabled: val })}
                trackColor={{ false: colors.borderStrong, true: colors.accent }}
              />
            </View>

            <View style={[styles.rowBetween, { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderColor: colors.border }]}>
              <View style={styles.toggleLabelCol}>
                <Text style={[styles.itemTitle, { color: colors.text }]}>Reconhecimento Facial (Câmera)</Text>
                <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
                  {faceEnrolled
                    ? 'Status: Rosto cadastrado no cofre'
                    : 'Status: Nenhum rosto cadastrado no cofre'}
                </Text>
              </View>
              <Switch
                value={state.config.faceRecognitionEnabled}
                onValueChange={handleToggleFaceRecognition}
                trackColor={{ false: colors.borderStrong, true: colors.accent }}
              />
            </View>

            <View style={[styles.faceActionsRow, { marginTop: 12 }]}>
              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1, marginTop: 0, backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]}
                onPress={() => setFaceEnrollModalVisible(true)}
              >
                <Text style={[styles.actionBtnText, { color: colors.accent }]}>
                  {faceEnrolled ? 'Recadastrar Rosto' : 'Cadastrar Rosto pela Câmera'}
                </Text>
              </TouchableOpacity>

              {faceEnrolled && (
                <TouchableOpacity
                  style={[styles.removeFaceBtn, { backgroundColor: colors.dangerBg }]}
                  onPress={handleRemoveFace}
                >
                  <Text style={[styles.removeFaceBtnText, { color: colors.danger }]}>Remover</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Modo Seguro, 100% Offline (US28) e Alto Contraste (US27) */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Privacidade, Rede e Acessibilidade</Text>

            <View style={styles.rowBetween}>
              <View style={styles.toggleLabelCol}>
                <Text style={[styles.itemTitle, { color: colors.text }]}>Modo Seguro (Bloqueio de Print)</Text>
                <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
                  {state.config.screenProtectionEnabled !== false
                    ? 'Prints e gravações bloqueados pelo sistema'
                    : 'Permite tirar print e compartilhar tela'}
                </Text>
              </View>
              <Switch
                value={state.config.screenProtectionEnabled !== false}
                onValueChange={val => updateConfig({ screenProtectionEnabled: val })}
                trackColor={{ false: colors.borderStrong, true: colors.accent }}
              />
            </View>

            <View style={[styles.rowBetween, { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderColor: colors.border }]}>
              <View style={styles.toggleLabelCol}>
                <Text style={[styles.itemTitle, { color: colors.text }]}>Modo 100% Offline</Text>
                <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
                  {state.config.offlineOnly
                    ? 'Garantido: nenhum dado sai do aparelho'
                    : 'Permite consulta anônima HIBP (k-Anonymity)'}
                </Text>
              </View>
              <Switch
                value={state.config.offlineOnly}
                onValueChange={val => updateConfig({ offlineOnly: val })}
                trackColor={{ false: colors.borderStrong, true: colors.accent }}
              />
            </View>

            <View style={[styles.rowBetween, { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderColor: colors.border }]}>
              <View style={styles.toggleLabelCol}>
                <Text style={[styles.itemTitle, { color: colors.text }]}>Modo Alto Contraste</Text>
                <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
                  Melhora a legibilidade com fundo escuro e bordas destacadas
                </Text>
              </View>
              <Switch
                value={state.config.highContrast}
                onValueChange={val => updateConfig({ highContrast: val })}
                trackColor={{ false: colors.borderStrong, true: colors.accent }}
              />
            </View>
          </View>

          {/* Backup Criptografado (US24) e Relatorio (US25) */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Backup Criptografado e Relatórios</Text>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
              Exporte ou restaure todas as senhas e notas em arquivo protegido com senha de backup.
            </Text>

            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong, color: colors.text }]}
              placeholder="Senha para criptografar o backup (mín. 4 caracteres)"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              value={backupPassword}
              onChangeText={setBackupPassword}
            />
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]}
              onPress={handleExportBackup}
              disabled={busyBackup}
            >
              <Text style={[styles.actionBtnText, { color: colors.accent }]}>Exportar Backup Criptografado</Text>
            </TouchableOpacity>

            <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderColor: colors.border }}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong, color: colors.text }]}
                placeholder="Senha do arquivo de backup a importar"
                placeholderTextColor={colors.placeholder}
                secureTextEntry
                value={importPassword}
                onChangeText={setImportPassword}
              />
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong }]}
                onPress={handleImportBackup}
                disabled={busyBackup}
              >
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Importar Backup Criptografado</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderColor: colors.border }}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong }]}
                onPress={handleExportPlaintextReport}
              >
                <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>
                  Exportar Relatório de Força (.txt)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Alterar PIN Mestre (US29) */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Alterar PIN Mestre</Text>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>Digite o PIN atual e defina o novo PIN de 4 dígitos numéricos.</Text>

            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong, color: colors.text }]}
              placeholder="PIN Atual (4 dígitos)"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              value={oldPin}
              onChangeText={t => setOldPin(t.replace(/[^0-9]/g, '').substring(0, 4))}
            />

            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong, color: colors.text }]}
              placeholder="Novo PIN (4 dígitos)"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              value={newPin}
              onChangeText={t => setNewPin(t.replace(/[^0-9]/g, '').substring(0, 4))}
            />

            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]} onPress={handleChangePin}>
              <Text style={[styles.actionBtnText, { color: colors.accent }]}>Salvar Novo PIN</Text>
            </TouchableOpacity>
          </View>

          {/* Senha de Emergencia / Panico (US21) */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Senha de Emergência / Pânico</Text>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
              Ao digitar este PIN na tela de bloqueio, todos os dados do cofre são apagados imediatamente.
            </Text>

            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong, color: colors.text }]}
              placeholder="PIN Mestre Atual (4 dígitos)"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              value={masterForEmergency}
              onChangeText={t => setMasterForEmergency(t.replace(/[^0-9]/g, '').substring(0, 4))}
            />

            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong, color: colors.text }]}
              placeholder="Novo PIN de Emergência (4 dígitos)"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              value={newEmergencyPin}
              onChangeText={t => setNewEmergencyPin(t.replace(/[^0-9]/g, '').substring(0, 4))}
            />

            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]} onPress={handleChangeEmergencyPin}>
              <Text style={[styles.actionBtnText, { color: colors.accent }]}>Atualizar PIN de Emergência</Text>
            </TouchableOpacity>
          </View>

          {/* Zona de Perigo */}
          <View style={[styles.sectionCard, { borderColor: colors.danger, backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.danger }]}>Zona de Perigo</Text>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>Apague permanentemente todos os dados e chaves do aparelho.</Text>
            <TouchableOpacity style={[styles.wipeBtn, { backgroundColor: colors.dangerBg }]} onPress={handleWipe}>
              <Text style={[styles.wipeBtnText, { color: colors.danger }]}>Apagar Tudo (Wipe do Cofre)</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <FaceAuthModal
          visible={faceEnrollModalVisible}
          mode="enroll"
          onClose={() => setFaceEnrollModalVisible(false)}
          onSuccess={() => {
            setFaceEnrollModalVisible(false);
            updateConfig({ faceRecognitionEnabled: true });
            refreshFaceStatus();
            Alert.alert('Sucesso', 'Seu rosto foi cadastrado para desbloqueio pela câmera!');
          }}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  closeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  closeText: { fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  content: { padding: 16 },
  sectionCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  sectionDesc: { fontSize: 12, marginBottom: 12, lineHeight: 17 },
  subLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  chipsRow: { flexDirection: 'row', gap: 10 },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabelCol: { flex: 1, paddingRight: 12 },
  itemTitle: { fontSize: 14, fontWeight: '600' },
  itemSubtitle: { fontSize: 12, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  faceActionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    gap: 8,
  },
  removeFaceBtn: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  removeFaceBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  wipeBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  wipeBtnText: { fontSize: 13, fontWeight: '700' },
});
