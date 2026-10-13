import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { getAccessLogs } from '../../storage/vaultStorage';
import type { AccessLog } from '../../types/auth';

interface AccessLogsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AccessLogsModal: React.FC<AccessLogsModalProps> = ({ visible, onClose }) => {
  const [logs, setLogs] = useState<AccessLog[]>([]);

  useEffect(() => {
    if (visible) {
      (async () => {
        const data = await getAccessLogs();
        setLogs(data.reverse());
      })();
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Fechar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Historico de Acessos</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={logs}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.logCard}>
              <View style={styles.logHeader}>
                <Text style={styles.logMethod}>
                  Metodo: {item.method === 'pin' ? 'PIN Mestre' : item.method === 'face' ? 'Reconhecimento Facial' : item.method === 'biometric' ? 'Biometria' : 'Emergencia'}
                </Text>
                <Text
                  style={[
                    styles.logStatus,
                    item.success ? styles.statusSuccess : styles.statusFailed,
                  ]}
                >
                  {item.success ? 'Sucesso' : 'Falha'}
                </Text>
              </View>
              <Text style={styles.logDate}>
                {new Date(item.timestamp).toLocaleString('pt-BR')}
              </Text>
              {item.detail && <Text style={styles.logDetail}>{item.detail}</Text>}
            </View>
          )}
          contentContainerStyle={styles.content}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nenhum registro de acesso recente.</Text>
            </View>
          }
        />
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
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFEAE2',
    marginBottom: 10,
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  logMethod: { fontSize: 13, fontWeight: '700', color: '#1E1E1E' },
  logStatus: { fontSize: 12, fontWeight: '700' },
  statusSuccess: { color: '#4A7C59' },
  statusFailed: { color: '#D9534F' },
  logDate: { fontSize: 12, color: '#8A8175' },
  logDetail: { fontSize: 11, color: '#B5824C', marginTop: 4 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { color: '#8A8175', fontSize: 14 },
});
