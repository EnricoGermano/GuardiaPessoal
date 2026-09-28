import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '../../context/AuthContext';
import { useVault } from '../../context/VaultContext';
import { encryptData, decryptData } from '../../crypto/aes';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const { state, changeMasterPin, updateConfig, wipeAll } = useAuth();
  const { vault, reload } = useVault();

  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [backupPassword, setBackupPassword] = useState('');
  const [importText, setImportText] = useState('');

  const handleChangePin = async () => {
    if (newPin.length !== 4) {
      Alert.alert('Atencao', 'O novo PIN deve ter exatamente 4 digitos numericos.');
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

  const handleExportBackup = async () => {
    if (!backupPassword || backupPassword.length < 6) {
      Alert.alert('Atencao', 'Defina uma senha de no minimo 6 caracteres para criptografar o backup.');
      return;
    }
    if (!vault) return;

    try {
      const json = JSON.stringify(vault);
      const bundle = await encryptData(json, backupPassword);
      const payload = JSON.stringify({
        format: 'guardiao_backup_v1',
        timestamp: Date.now(),
        bundle,
      });

      const path = `${FileSystem.documentDirectory}backup_${Date.now()}.guardiao`;
      await FileSystem.writeAsStringAsync(path, payload);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: 'application/octet-stream',
          dialogTitle: 'Exportar Backup Seguro (.guardiao)',
        });
      } else {
        Alert.alert('Backup Criado', `Arquivo salvo em: ${path}`);
      }
      setBackupPassword('');
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Falha ao gerar backup.');
    }
  };

  const handleImportBackup = async () => {
    if (!backupPassword || !importText.trim()) {
      Alert.alert('Atencao', 'Cole o texto do backup (.guardiao) e digite a senha.');
      return;
    }

    try {
      const parsed = JSON.parse(importText.trim());
      if (!parsed.bundle) throw new Error('Formato de arquivo invalido.');
      const decrypted = decryptData(parsed.bundle, backupPassword);
      const restoredVault = JSON.parse(decrypted);

      if (!restoredVault.passwords || !Array.isArray(restoredVault.passwords)) {
        throw new Error('Cofre invalido.');
      }

      // Restored! Save to local vault
      const { saveVault } = await import('../../storage/vaultStorage');
      const { getSessionSecret } = await import('../../storage/secureStorage');
      const secret = await getSessionSecret();
      if (secret) {
        await saveVault(restoredVault, secret);
        await reload();
        Alert.alert('Sucesso', 'Backup restaurado com sucesso!');
        setImportText('');
        setBackupPassword('');
        onClose();
      }
    } catch (err: any) {
      Alert.alert('Erro na Restauracao', 'Senha incorreta ou conteudo do backup corrompido.');
    }
  };

  const handleExportPlainTextReport = () => {
    if (!vault) return;
    Alert.alert(
      'Exportar Relatorio de Diagnostico',
      'Deseja exportar um relatorio dos nomes de servicos cadastrados e saude das senhas (as senhas reais NÃO serao exibidas)?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Exportar',
          onPress: async () => {
            const report = [
              '=== RELATÓRIO DE AUDITORIA - GUARDIÃO PESSOAL ===',
              `Data: ${new Date().toLocaleString('pt-BR')}`,
              `Total de Contas: ${vault.passwords.length}`,
              `Total de Notas: ${vault.notes.length}`,
              '--------------------------------------------------',
              ...vault.passwords.map(p => `• [${p.importance.toUpperCase()}] ${p.service} (${p.username})`),
              '--------------------------------------------------',
              'Status: Armazenamento 100% Offline e Criptografado.',
            ].join('\n');

            const path = `${FileSystem.documentDirectory}relatorio_seguranca.txt`;
            await FileSystem.writeAsStringAsync(path, report);
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(path);
            } else {
              Alert.alert('Relatório', report);
            }
          },
        },
      ]
    );
  };

  const handleWipe = () => {
    Alert.alert(
      'PERIGO: Limpeza Completa',
      'Esta operacao ira apagar permanentemente todas as senhas, notas e chaves do aparelho. Deseja continuar?',
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Fechar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Configuracoes</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Timeout de Inatividade */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Bloqueio por Inatividade</Text>
            <Text style={styles.sectionDesc}>Tempo sem uso antes de trancar o cofre automaticamente.</Text>
            <View style={styles.chipsRow}>
              {[1, 5, 15].map(min => (
                <TouchableOpacity
                  key={min}
                  style={[
                    styles.chip,
                    state.config.autoLockMinutes === min && styles.chipActive,
                  ]}
                  onPress={() => updateConfig({ autoLockMinutes: min as (1 | 5 | 15) })}
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

          {/* Alterar PIN Mestre */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Alterar PIN Mestre</Text>
            <Text style={styles.sectionDesc}>Digite o PIN atual e defina o novo PIN de 4 digitos.</Text>

            <TextInput
              style={styles.input}
              placeholder="PIN Atual"
              placeholderTextColor="#A8A199"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              value={oldPin}
              onChangeText={setOldPin}
            />

            <TextInput
              style={styles.input}
              placeholder="Novo PIN (4 digitos)"
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

          {/* Backup e Restauração Criptografada */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Backup Criptografado (.guardiao)</Text>
            <Text style={styles.sectionDesc}>
              Exporte seus dados protegidos com AES-256 e uma senha dedicada de exportacao.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Senha de protecao do backup"
              placeholderTextColor="#A8A199"
              secureTextEntry
              value={backupPassword}
              onChangeText={setBackupPassword}
            />

            <TouchableOpacity style={styles.actionBtn} onPress={handleExportBackup}>
              <Text style={styles.actionBtnText}>Gerar e Compartilhar Backup</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <Text style={styles.subTitle}>Restaurar Backup</Text>
            <TextInput
              style={[styles.input, { height: 70 }]}
              placeholder="Cole o conteudo do arquivo .guardiao aqui"
              placeholderTextColor="#A8A199"
              multiline
              value={importText}
              onChangeText={setImportText}
            />

            <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleImportBackup}>
              <Text style={styles.actionBtnText}>Restaurar Cofre</Text>
            </TouchableOpacity>
          </View>

          {/* Exportar Relatório */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Relatorio de Diagnostico</Text>
            <Text style={styles.sectionDesc}>
              Gera relatorio em texto puro contendo a lista de servicos para conferir contas salvas sem expor senhas.
            </Text>
            <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleExportPlainTextReport}>
              <Text style={styles.actionBtnText}>Exportar Relatorio TXT</Text>
            </TouchableOpacity>
          </View>

          {/* Acessibilidade e Alto Contraste */}
          <View style={styles.sectionCard}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.sectionTitle}>Alto Contraste</Text>
                <Text style={styles.sectionDesc}>Melhora legibilidade de fontes e icones.</Text>
              </View>
              <Switch
                value={state.config.highContrast}
                onValueChange={val => updateConfig({ highContrast: val })}
                trackColor={{ false: '#E6DFD5', true: '#B5824C' }}
              />
            </View>
          </View>

          {/* Privacidade LGPD e Operação Offline */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Privacidade e LGPD</Text>
            <Text style={styles.infoText}>
              • Operacao 100% Offline: Nenhum dado, senha ou nota e transmitido para a internet.{'\n'}
              • Criptografia de Ponta a Ponta: AES-256 com derivacao PBKDF2.{'\n'}
              • Em conformidade com as diretrizes da LGPD para protecao total de dados pessoais.
            </Text>
          </View>

          {/* Zona de Perigo */}
          <View style={[styles.sectionCard, styles.dangerCard]}>
            <Text style={[styles.sectionTitle, { color: '#D9534F' }]}>Zona de Perigo</Text>
            <Text style={styles.sectionDesc}>Apague permanentemente todos os dados do cofre.</Text>
            <TouchableOpacity style={styles.wipeBtn} onPress={handleWipe}>
              <Text style={styles.wipeBtnText}>Apagar Tudo (Wipe)</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#EFEAE2',
    backgroundColor: '#FFFFFF',
  },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 14, color: '#8A8175', fontWeight: '600' },
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E6DFD5',
    backgroundColor: '#FDFBF9',
  },
  chipActive: { backgroundColor: '#FFF9EE', borderColor: '#996515' },
  chipText: { fontSize: 13, color: '#6A6255' },
  chipTextActive: { color: '#996515', fontWeight: '700' },
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
    paddingVertical: 11,
    alignItems: 'center',
  },
  actionBtnSecondary: {
    backgroundColor: '#FDFBF9',
    borderWidth: 1,
    borderColor: '#E6DFD5',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  actionBtnText: { color: '#996515', fontSize: 13, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#EFEAE2', marginVertical: 14 },
  subTitle: { fontSize: 13, fontWeight: '600', color: '#1E1E1E', marginBottom: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoText: { fontSize: 12, color: '#4A4237', lineHeight: 20 },
  dangerCard: { borderColor: '#FBEAE5' },
  wipeBtn: {
    backgroundColor: '#FBEAE5',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  wipeBtnText: { color: '#D9534F', fontSize: 14, fontWeight: '700' },
});
