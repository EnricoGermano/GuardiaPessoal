import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAccessLogs } from '../../storage/vaultStorage';
import type { AccessLog } from '../../types/auth';
import { useThemeColors } from '../../theme/useThemeColors';

interface AccessLogsModalProps {
  visible: boolean;
  onClose: () => void;
}

type LogFilter = 'all' | 'success' | 'failed';

function formatMethod(method: AccessLog['method']): string {
  switch (method) {
    case 'pin':
      return 'PIN Mestre';
    case 'face':
      return 'Reconhecimento Facial';
    case 'biometric':
      return 'Biometria';
    case 'fallback':
      return 'Alternativo';
    case 'duress':
      return 'Emergência / Pânico';
  }
}

export const AccessLogsModal: React.FC<AccessLogsModalProps> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0);
  const colors = useThemeColors();
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [filter, setFilter] = useState<LogFilter>('all');

  useEffect(() => {
    if (visible) {
      (async () => {
        const data = await getAccessLogs();
        setLogs([...data].reverse());
      })();
    }
  }, [visible]);

  const filteredLogs = useMemo(() => {
    if (filter === 'success') return logs.filter(l => l.success);
    if (filter === 'failed') return logs.filter(l => !l.success);
    return logs;
  }, [logs, filter]);

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
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>Histórico de Acessos</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={[styles.infoBanner, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]}>
          <Text style={[styles.infoBannerText, { color: colors.accent }]}>
            Registros criptografados localmente com expiração automática após 7 dias.
          </Text>
        </View>

        <View style={styles.filterRow}>
          {([
            { id: 'all', label: `Todos (${logs.length})` },
            { id: 'success', label: `Sucesso (${logs.filter(l => l.success).length})` },
            { id: 'failed', label: `Falhas (${logs.filter(l => !l.success).length})` },
          ] as const).map(item => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.filterChip,
                { backgroundColor: colors.surface, borderColor: colors.borderStrong },
                filter === item.id && { backgroundColor: colors.accentBg, borderColor: colors.accent },
              ]}
              onPress={() => setFilter(item.id)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: colors.textSecondary },
                  filter === item.id && { color: colors.accent, fontWeight: '700' },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={filteredLogs}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={[styles.logCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.logHeader}>
                <Text style={[styles.logMethod, { color: colors.text }]}>
                  Método: {formatMethod(item.method)}
                </Text>
                <Text
                  style={[
                    styles.logStatus,
                    { color: item.success ? colors.success : colors.danger },
                  ]}
                >
                  {item.success ? 'Sucesso' : 'Falha'}
                </Text>
              </View>
              <Text style={[styles.logDate, { color: colors.textMuted }]}>
                {new Date(item.timestamp).toLocaleString('pt-BR')}
              </Text>
              {item.detail && <Text style={[styles.logDetail, { color: colors.accent }]}>{item.detail}</Text>}
            </View>
          )}
          contentContainerStyle={styles.content}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Nenhum registro de acesso recente.</Text>
            </View>
          }
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
  infoBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  infoBannerText: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterText: { fontSize: 12, fontWeight: '500' },
  content: { padding: 16 },
  logCard: {
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  logMethod: { fontSize: 13, fontWeight: '700' },
  logStatus: { fontSize: 12, fontWeight: '700' },
  logDate: { fontSize: 12 },
  logDetail: { fontSize: 11, marginTop: 4 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 14 },
});
