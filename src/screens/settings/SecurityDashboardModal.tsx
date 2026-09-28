import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useVault } from '../../context/VaultContext';
import { evaluateStrength } from '../../crypto/generator';

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
  const { vault } = useVault();
  const [testPassword, setTestPassword] = useState('');
  const [breachResult, setBreachResult] = useState<string | null>(null);

  const stats = useMemo(() => {
    if (!vault || vault.passwords.length === 0) {
      return { score: 100, strong: 0, medium: 0, weak: 0, reused: 0, total: 0 };
    }

    const passwords = vault.passwords;
    let strong = 0;
    let medium = 0;
    let weak = 0;

    const seen = new Map<string, number>();
    passwords.forEach(p => {
      const s = evaluateStrength(p.password);
      if (s >= 3) strong++;
      else if (s === 2) medium++;
      else weak++;

      seen.set(p.password, (seen.get(p.password) || 0) + 1);
    });

    let reused = 0;
    seen.forEach(count => {
      if (count > 1) reused += count;
    });

    // Score calculation
    const total = passwords.length;
    const rawScore = ((strong * 100) + (medium * 50) + (weak * 10)) / total;
    const penalty = (reused / total) * 30;
    const finalScore = Math.max(0, Math.min(100, Math.round(rawScore - penalty)));

    return { score: finalScore, strong, medium, weak, reused, total };
  }, [vault]);

  const handleCheckBreach = () => {
    if (!testPassword) return;

    const commonLeaked = [
      '123456', 'password', '12345678', 'qwerty', '123456789', '12345',
      '1234', '111111', '1234567', 'dragon', 'admin', 'welcome', 'login',
      'senha', 'senha123', 'brasil', 'futebol', 'master', 'iloveyou'
    ];

    if (commonLeaked.includes(testPassword.toLowerCase())) {
      setBreachResult('ALERTA CRÍTICO: Esta senha foi encontrada em vazamentos globais públicos conhecidos! Nunca a utilize.');
    } else if (testPassword.length < 8) {
      setBreachResult('AVISO: Senha muito curta. Facilmente vulnerável a ataques de força bruta.');
    } else {
      setBreachResult('Nenhuma ocorrência encontrada em bases públicas locais de vazamentos.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Fechar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Painel de Seguranca</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreTitle}>Indice de Saude do Cofre</Text>
            <Text style={styles.scoreValue}>{stats.score}%</Text>
            <Text style={styles.scoreStatus}>
              {stats.score >= 80 ? 'Excelente protecao' : stats.score >= 50 ? 'Atencao recomendada' : 'Vulneravel'}
            </Text>
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricNumber, { color: '#4A7C59' }]}>{stats.strong}</Text>
              <Text style={styles.metricLabel}>Fortes</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricNumber, { color: '#D9822B' }]}>{stats.medium}</Text>
              <Text style={styles.metricLabel}>Medias</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricNumber, { color: '#D9534F' }]}>{stats.weak}</Text>
              <Text style={styles.metricLabel}>Fracas</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricNumber, { color: '#B5824C' }]}>{stats.reused}</Text>
              <Text style={styles.metricLabel}>Repetidas</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Verificador de Senhas Vazadas</Text>
            <Text style={styles.sectionDesc}>
              Consulte se uma combinacao consta em registros de exposicao publica conhecida.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Digite a senha para checar"
              placeholderTextColor="#A8A199"
              secureTextEntry
              value={testPassword}
              onChangeText={setTestPassword}
            />

            <TouchableOpacity style={styles.actionBtn} onPress={handleCheckBreach}>
              <Text style={styles.actionBtnText}>Verificar Senha</Text>
            </TouchableOpacity>

            {breachResult && (
              <View style={styles.resultBox}>
                <Text style={styles.resultText}>{breachResult}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.logNavBtn} onPress={onOpenLogs}>
            <Text style={styles.logNavBtnText}>Ver Historico de Acessos e Auditoria</Text>
          </TouchableOpacity>
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
  scoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEAE2',
    marginBottom: 16,
  },
  scoreTitle: { fontSize: 13, color: '#756F68', marginBottom: 6 },
  scoreValue: { fontSize: 44, fontWeight: '800', color: '#996515' },
  scoreStatus: { fontSize: 13, color: '#4A7C59', fontWeight: '600', marginTop: 4 },
  metricsGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  metricItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEAE2',
  },
  metricNumber: { fontSize: 18, fontWeight: '700' },
  metricLabel: { fontSize: 11, color: '#8A8175', marginTop: 4 },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEAE2',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1E1E1E', marginBottom: 4 },
  sectionDesc: { fontSize: 12, color: '#756F68', marginBottom: 14 },
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
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionBtnText: { color: '#996515', fontSize: 13, fontWeight: '700' },
  resultBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FDFBF9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EED8A1',
  },
  resultText: { fontSize: 12, color: '#4A4237', lineHeight: 18 },
  logNavBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E6DFD5',
    marginTop: 8,
  },
  logNavBtnText: { color: '#996515', fontSize: 14, fontWeight: '700' },
});
