import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVault } from '../../context/VaultContext';
import { useAuth } from '../../context/AuthContext';
import { evaluateStrength } from '../../crypto/generator';
import { useThemeColors } from '../../theme/useThemeColors';
import {
  checkPasswordBreach,
  auditVaultBreaches,
  type VaultBreachItem,
} from '../../utils/breachCheck';

interface SecurityDashboardModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenLogs: () => void;
}

export const SecurityDashboardModal: React.FC<SecurityDashboardModalProps> = ({
  visible,
  onClose,
  onOpenLogs,
}) => {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0);
  const colors = useThemeColors();
  const { state } = useAuth();
  const { vault } = useVault();

  const [testPassword, setTestPassword] = useState('');
  const [breachResult, setBreachResult] = useState<{ text: string; compromised: boolean } | null>(null);
  const [checkingSingle, setCheckingSingle] = useState(false);

  const [auditingVault, setAuditingVault] = useState(false);
  const [vaultBreaches, setVaultBreaches] = useState<VaultBreachItem[] | null>(null);

  const stats = useMemo(() => {
    if (!vault || vault.passwords.length === 0) {
      return {
        score: 100,
        strong: 0,
        medium: 0,
        weak: 0,
        reused: 0,
        total: 0,
        weakItems: [] as { id: string; service: string; username: string; length: number }[],
        reusedGroups: [] as { count: number; services: string[] }[],
      };
    }

    const passwords = vault.passwords;
    let strong = 0;
    let medium = 0;
    let weak = 0;
    const weakItems: { id: string; service: string; username: string; length: number }[] = [];

    const seen = new Map<string, string[]>();
    passwords.forEach(p => {
      const s = evaluateStrength(p.password);
      if (s >= 3) strong++;
      else if (s === 2) medium++;
      else {
        weak++;
        weakItems.push({
          id: p.id,
          service: p.service,
          username: p.username,
          length: p.password.length,
        });
      }

      const list = seen.get(p.password) || [];
      list.push(p.service);
      seen.set(p.password, list);
    });

    let reused = 0;
    const reusedGroups: { count: number; services: string[] }[] = [];
    seen.forEach(services => {
      if (services.length > 1) {
        reused += services.length;
        reusedGroups.push({ count: services.length, services });
      }
    });

    const total = passwords.length;
    const rawScore = (strong * 100 + medium * 50 + weak * 10) / total;
    const penalty = (reused / total) * 30;
    const finalScore = Math.max(0, Math.min(100, Math.round(rawScore - penalty)));

    return { score: finalScore, strong, medium, weak, reused, total, weakItems, reusedGroups };
  }, [vault]);

  const handleCheckBreach = async () => {
    if (!testPassword) return;
    setCheckingSingle(true);
    try {
      const res = await checkPasswordBreach(testPassword, state.config.offlineOnly);
      setBreachResult({ text: res.message, compromised: res.compromised });
    } finally {
      setCheckingSingle(false);
    }
  };

  const handleAuditVault = async () => {
    if (!vault) return;
    setAuditingVault(true);
    try {
      const found = await auditVaultBreaches(vault.passwords, state.config.offlineOnly);
      setVaultBreaches(found);
    } finally {
      setAuditingVault(false);
    }
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
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>Painel de Segurança</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.scoreTitle, { color: colors.textSecondary }]}>Índice de Saúde do Cofre</Text>
            <Text style={[styles.scoreValue, { color: colors.accent }]}>{stats.score}%</Text>
            <Text
              style={[
                styles.scoreStatus,
                { color: stats.score >= 80 ? colors.success : stats.score >= 50 ? colors.warning : colors.danger },
              ]}
            >
              {stats.score >= 80 ? 'Excelente proteção' : stats.score >= 50 ? 'Atenção recomendada' : 'Vulnerável'}
            </Text>
          </View>

          <View style={styles.metricsGrid}>
            <View style={[styles.metricItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.metricNumber, { color: colors.success }]}>{stats.strong}</Text>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Fortes</Text>
            </View>
            <View style={[styles.metricItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.metricNumber, { color: colors.warning }]}>{stats.medium}</Text>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Médias</Text>
            </View>
            <View style={[styles.metricItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.metricNumber, { color: colors.danger }]}>{stats.weak}</Text>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Fracas</Text>
            </View>
            <View style={[styles.metricItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.metricNumber, { color: colors.accent }]}>{stats.reused}</Text>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Repetidas</Text>
            </View>
          </View>

          {/* Alertas detalhados de senhas fracas e reutilizadas (US20) */}
          {(stats.weakItems.length > 0 || stats.reusedGroups.length > 0) && (
            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.danger }]}>
              <Text style={[styles.sectionTitle, { color: colors.danger }]}>Alertas de Segurança</Text>
              {stats.weakItems.length > 0 && (
                <View style={styles.alertBlock}>
                  <Text style={[styles.alertHeading, { color: colors.text }]}>
                    Senhas Fracas ({stats.weakItems.length}):
                  </Text>
                  {stats.weakItems.map(item => (
                    <Text key={item.id} style={[styles.alertItem, { color: colors.textSecondary }]}>
                      • {item.service} ({item.username}) — {item.length} caracteres
                    </Text>
                  ))}
                </View>
              )}

              {stats.reusedGroups.length > 0 && (
                <View style={[styles.alertBlock, stats.weakItems.length > 0 && { marginTop: 10 }]}>
                  <Text style={[styles.alertHeading, { color: colors.text }]}>
                    Senhas Reutilizadas ({stats.reusedGroups.length} grupo(s)):
                  </Text>
                  {stats.reusedGroups.map((g, idx) => (
                    <Text key={idx} style={[styles.alertItem, { color: colors.textSecondary }]}>
                      • Mesma senha usada em {g.count} serviços: {g.services.join(', ')}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Verificador de Senhas Vazadas (US26 + US28) */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Verificador de Vazamentos</Text>
              <View style={[styles.modeBadge, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]}>
                <Text style={[styles.modeBadgeText, { color: colors.accent }]}>
                  {state.config.offlineOnly ? '100% Offline' : 'Online k-Anon'}
                </Text>
              </View>
            </View>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
              {state.config.offlineOnly
                ? 'Modo 100% offline ativo: a checagem usa apenas a base local do aparelho, sem envio de dados.'
                : 'Checa a base local e consulta o HaveIBeenPwned via k-Anonymity (apenas 5 dígitos do hash SHA-1).'}
            </Text>

            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong, color: colors.text }]}
              placeholder="Digite uma senha para checar"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              value={testPassword}
              onChangeText={setTestPassword}
            />

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]}
              onPress={handleCheckBreach}
              disabled={checkingSingle}
            >
              {checkingSingle ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={[styles.actionBtnText, { color: colors.accent }]}>Verificar Senha</Text>
              )}
            </TouchableOpacity>

            {breachResult && (
              <View
                style={[
                  styles.resultBox,
                  {
                    backgroundColor: breachResult.compromised ? colors.dangerBg : colors.successBg,
                    borderColor: breachResult.compromised ? colors.danger : colors.success,
                  },
                ]}
              >
                <Text style={[styles.resultText, { color: colors.text }]}>{breachResult.text}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, { marginTop: 10, backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong }]}
              onPress={handleAuditVault}
              disabled={auditingVault || stats.total === 0}
            >
              {auditingVault ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={[styles.actionBtnText, { color: colors.text }]}>
                  Auditar Todas as Credenciais ({stats.total})
                </Text>
              )}
            </TouchableOpacity>

            {vaultBreaches !== null && (
              <View
                style={[
                  styles.resultBox,
                  {
                    backgroundColor: vaultBreaches.length > 0 ? colors.dangerBg : colors.successBg,
                    borderColor: vaultBreaches.length > 0 ? colors.danger : colors.success,
                  },
                ]}
              >
                {vaultBreaches.length === 0 ? (
                  <Text style={[styles.resultText, { color: colors.text }]}>
                    Nenhuma credencial salva apresentou exposição nos registros verificados.
                  </Text>
                ) : (
                  <View>
                    <Text style={[styles.alertHeading, { color: colors.danger }]}>
                      {vaultBreaches.length} credencial(is) com alerta:
                    </Text>
                    {vaultBreaches.map(b => (
                      <Text key={b.id} style={[styles.alertItem, { color: colors.text }]}>
                        • {b.service} ({b.username}): {b.result.message}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.logNavBtn, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}
            onPress={onOpenLogs}
          >
            <Text style={[styles.logNavBtnText, { color: colors.accent }]}>Ver Histórico de Acessos e Auditoria</Text>
          </TouchableOpacity>
        </ScrollView>
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
  scoreCard: {
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 16,
  },
  scoreTitle: { fontSize: 13, marginBottom: 6 },
  scoreValue: { fontSize: 44, fontWeight: '800' },
  scoreStatus: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  metricsGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  metricItem: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  metricNumber: { fontSize: 18, fontWeight: '700' },
  metricLabel: { fontSize: 11, marginTop: 4 },
  sectionCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  sectionDesc: { fontSize: 12, marginBottom: 14, lineHeight: 17 },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  modeBadgeText: { fontSize: 10, fontWeight: '700' },
  alertBlock: { marginTop: 4 },
  alertHeading: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  alertItem: { fontSize: 12, lineHeight: 18, marginLeft: 4 },
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
    paddingVertical: 11,
    alignItems: 'center',
  },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  resultBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  resultText: { fontSize: 12, lineHeight: 18 },
  logNavBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 8,
  },
  logNavBtnText: { fontSize: 14, fontWeight: '700' },
});
