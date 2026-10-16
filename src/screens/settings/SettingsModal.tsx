import React, { useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0);
  const { state, changeMasterPin, updateConfig, wipeAll } = useAuth();

  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');

  const handleChangePin = async () => {
    if (oldPin.length !== 4) {
      Alert.alert('Atenção', 'Informe o PIN atual de 4 dígitos.');
      return;
    }
    if (newPin.length !== 4) {
      Alert.alert('Atenção', 'O novo PIN deve ter exatamente 4 dígitos numéricos.');
      return;
    }
    const res = await changeMasterPin(oldPin, newPin);
    if (res) {
      Alert.alert('Sucesso', 'PIN mestre alterado com sucesso!');
      setOldPin('');
      setNewPin('');
    } else {
      Alert.alert('Erro', 'PIN atual incorreto.');
    }
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
      <View style={styles.safeArea}>
        <View style={[styles.header, { paddingTop: Math.max(topPad, 12) + 6 }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            activeOpacity={0.7}
          >
            <Text style={styles.closeText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Configurações de Segurança</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Timeout de Inatividade (US19) */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Bloqueio por Inatividade</Text>
            <Text style={styles.sectionDesc}>
              Tempo sem atividade no aplicativo antes de trancar o cofre automaticamente.
            </Text>
            <View style={styles.chipsRow}>
              {([1, 5, 15] as const).map(min => (
                <TouchableOpacity
                  key={min}
                  style={[
                    styles.chip,
                    state.config.autoLockMinutes === min && styles.chipActive,
                  ]}
                  onPress={() => updateConfig({ autoLockMinutes: min })}
                >
                  <Text
                    style={[
                      styles.chipText,
                      state.config.autoLockMinutes === min && styles.chipTextActive,
                    ]}
                  >
                    {min} min
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Biometria e Facial (US09 e US10) */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Biometria e Reconhecimento</Text>
            <View style={styles.rowBetween}>
              <View style={styles.toggleLabelCol}>
                <Text style={styles.itemTitle}>Impressão Digital</Text>
                <Text style={styles.itemSubtitle}>Desbloqueio rápido via sensor biométrico nativo</Text>
              </View>
              <Switch
                value={state.config.biometricsEnabled}
                onValueChange={val => updateConfig({ biometricsEnabled: val })}
                trackColor={{ false: '#E6DFD5', true: '#B5824C' }}
              />
            </View>

            <View style={[styles.rowBetween, { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderColor: '#F5EFE6' }]}>
              <View style={styles.toggleLabelCol}>
                <Text style={styles.itemTitle}>Reconhecimento Facial</Text>
                <Text style={styles.itemSubtitle}>Alternativa biométrica pela câmera frontal</Text>
              </View>
              <Switch
                value={state.config.faceRecognitionEnabled}
                onValueChange={val => updateConfig({ faceRecognitionEnabled: val })}
                trackColor={{ false: '#E6DFD5', true: '#B5824C' }}
              />
            </View>
          </View>

          {/* Modo Seguro / Bloqueio de Print */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Modo Seguro (Bloqueio de Captura)</Text>
            <Text style={styles.sectionDesc}>
              Impede prints de tela, gravações e pré-visualizações do app nas tarefas recentes (FLAG_SECURE).
            </Text>
            <View style={styles.rowBetween}>
              <View style={styles.toggleLabelCol}>
                <Text style={styles.itemTitle}>
                  {state.config.screenProtectionEnabled !== false ? 'Modo Seguro Ativado' : 'Modo Seguro Desativado'}
                </Text>
                <Text style={styles.itemSubtitle}>
                  {state.config.screenProtectionEnabled !== false
                    ? 'Prints e gravações bloqueados pelo sistema'
                    : 'Permite tirar print e compartilhar tela livremente'}
                </Text>
              </View>
              <Switch
                value={state.config.screenProtectionEnabled !== false}
                onValueChange={val => {
                  updateConfig({ screenProtectionEnabled: val });
                }}
                trackColor={{ false: '#E6DFD5', true: '#B5824C' }}
              />
            </View>
          </View>

          {/* Alterar PIN Mestre (US29) */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Alterar PIN Mestre</Text>
            <Text style={styles.sectionDesc}>Digite o PIN atual e defina o novo PIN de 4 dígitos numéricos.</Text>

            <TextInput
              style={styles.input}
              placeholder="PIN Atual (4 dígitos)"
              placeholderTextColor="#A8A199"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              value={oldPin}
              onChangeText={setOldPin}
            />

            <TextInput
              style={styles.input}
              placeholder="Novo PIN (4 dígitos)"
              placeholderTextColor="#A8A199"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              value={newPin}
              onChangeText={setNewPin}
            />

            <TouchableOpacity style={styles.actionBtn} onPress={handleChangePin}>
              <Text style={styles.actionBtnText}>Salvar Novo PIN</Text>
            </TouchableOpacity>
          </View>

          {/* Privacidade LGPD e Operação Offline */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Privacidade e Armazenamento 100% Offline</Text>
            <Text style={styles.infoText}>
              • Operação 100% Offline: Nenhum dado, senha ou nota é transmitido para servidores ou internet.{'\n'}
              • Criptografia Robusta: Todos os dados protegidos com AES-256 e derivação segura PBKDF2.{'\n'}
              • Proteção Visual: Capturas de tela e visualizações recentes são bloqueadas pelo sistema.
            </Text>
          </View>

          {/* Zona de Perigo */}
          <View style={[styles.sectionCard, styles.dangerCard]}>
            <Text style={[styles.sectionTitle, { color: '#D9534F' }]}>Zona de Perigo</Text>
            <Text style={styles.sectionDesc}>Apague permanentemente todos os dados e chaves do aparelho.</Text>
            <TouchableOpacity style={styles.wipeBtn} onPress={handleWipe}>
              <Text style={styles.wipeBtnText}>Apagar Tudo (Wipe do Cofre)</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FBF9F5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: '#EFEAE2',
    backgroundColor: '#FFFFFF',
  },
  closeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  closeText: { fontSize: 15, color: '#756F68', fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1E1E1E' },
  content: { padding: 16 },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEAE2',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1E1E1E', marginBottom: 4 },
  sectionDesc: { fontSize: 12, color: '#756F68', marginBottom: 12 },
  chipsRow: { flexDirection: 'row', gap: 10 },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E6DFD5',
    backgroundColor: '#FDFBF9',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#FFF9EE',
    borderColor: '#996515',
  },
  chipText: { fontSize: 13, color: '#6A6255', fontWeight: '500' },
  chipTextActive: { color: '#996515', fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabelCol: { flex: 1, paddingRight: 12 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#1E1E1E' },
  itemSubtitle: { fontSize: 12, color: '#756F68', marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: '#E6DFD5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E1E1E',
    backgroundColor: '#FDFBF9',
    marginBottom: 10,
  },
  actionBtn: {
    backgroundColor: '#FFF9EE',
    borderWidth: 1,
    borderColor: '#EED8A1',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  actionBtnText: { color: '#996515', fontSize: 13, fontWeight: '700' },
  infoText: { fontSize: 12, color: '#5C5449', lineHeight: 18 },
  dangerCard: { borderColor: '#FBEAE5', backgroundColor: '#FFFDFD' },
  wipeBtn: {
    backgroundColor: '#FBEAE5',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  wipeBtnText: { color: '#D9534F', fontSize: 13, fontWeight: '700' },
});
