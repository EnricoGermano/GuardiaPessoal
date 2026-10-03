import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useVault } from '../../context/VaultContext';
import { useClipboardTimer } from '../../hooks/useClipboardTimer';
import { useInactivityTimer } from '../../hooks/useInactivityTimer';
import { PrivacyShield } from '../../components/PrivacyShield';
import { PasswordFormScreen } from './PasswordFormScreen';
import type { PasswordItem } from '../../types/vault';

type Tab = 'passwords' | 'add';
type SortMode = 'nome' | 'data' | 'importancia';

const MASK = '••••••••';
/** Tempo (ms) que a senha revelada fica visivel antes de ser ocultada de novo. */
const REVEAL_TIMEOUT_MS = 15000;

export function HomeScreen() {
  const { state, lock } = useAuth();
  const { vault, loading, error, deletePassword, reload } = useVault();
  const { copyWithTimer } = useClipboardTimer();

  const [tab, setTab] = useState<Tab>('passwords');
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('nome');
  const [editingItem, setEditingItem] = useState<PasswordItem | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [shieldVisible, setShieldVisible] = useState(false);

  const { resetTimer } = useInactivityTimer(
    state.config.autoLockMinutes,
    lock,
    state.mode === 'unlocked'
  );

  // Qualquer toque na tela conta como atividade (sem consumir o toque).
  const handleTouchCapture = useCallback(() => {
    resetTimer();
    return false;
  }, [resetTimer]);

  // Revelacao temporaria: oculta a senha automaticamente.
  useEffect(() => {
    if (!revealedId) return;
    const t = setTimeout(() => setRevealedId(null), REVEAL_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [revealedId]);

  const filteredPasswords = useMemo(() => {
    if (!vault) return [];
    const q = search.toLowerCase();
    let items = vault.passwords.filter(p => !p.isHidden);
    if (q) {
      items = items.filter(p =>
        p.service.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q) ||
        (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
      );
    }
    return items.sort((a, b) => {
      if (sortMode === 'nome') {
        return a.service.localeCompare(b.service);
      }
      if (sortMode === 'data') {
        return b.createdAt - a.createdAt;
      }
      const impMap = { alta: 3, media: 2, baixa: 1 };
      return impMap[b.importance] - impMap[a.importance];
    });
  }, [vault, search, sortMode]);

  const handleCopy = async (text: string, label: string) => {
    try {
      await copyWithTimer(text, 30);
      Alert.alert('Copiado', `${label} copiado. Sera limpo em 30s.`);
    } catch {
      Alert.alert('Erro', 'Nao foi possivel copiar.');
    }
  };

  const handleDelete = (item: PasswordItem) => {
    Alert.alert(
      'Excluir senha',
      `Tem certeza que deseja excluir "${item.service}"? Esta acao nao pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePassword(item.id);
              if (revealedId === item.id) setRevealedId(null);
            } catch (e: any) {
              Alert.alert('Erro', e?.message || 'Nao foi possivel excluir.');
            }
          },
        },
      ]
    );
  };

  const importanceBadge = (level: string) => {
    if (level === 'alta') {
      return { bg: '#FBEAE5', text: '#D9534F', label: 'Alta' };
    }
    if (level === 'media') {
      return { bg: '#FFF9EE', text: '#D9822B', label: 'Media' };
    }
    return { bg: '#EAF2EC', text: '#4A7C59', label: 'Baixa' };
  };

  const renderPasswordItem = ({ item }: { item: PasswordItem }) => {
    const badge = importanceBadge(item.importance);
    const revealed = revealedId === item.id;

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemService} numberOfLines={1}>{item.service}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <Text style={styles.itemUser}>{item.username}</Text>

        <View style={styles.passwordRow}>
          <Text style={styles.passwordText} selectable={false} numberOfLines={1}>
            {revealed ? item.password : MASK}
          </Text>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setRevealedId(revealed ? null : item.id)}
          >
            <Text style={styles.actionText}>{revealed ? 'Ocultar' : 'Mostrar'}</Text>
          </TouchableOpacity>
        </View>

        {item.warning && (
          <Text style={styles.warningText}>{item.warning}</Text>
        )}

        <View style={styles.itemActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleCopy(item.username, 'Usuario')}
          >
            <Text style={styles.actionText}>Copiar usuario</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleCopy(item.password, 'Senha')}
          >
            <Text style={styles.actionText}>Copiar senha</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => { setRevealedId(null); setEditingItem(item); setTab('add'); }}
          >
            <Text style={styles.actionText}>Editar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => handleDelete(item)}
          >
            <Text style={styles.deleteText}>Excluir</Text>
          </TouchableOpacity>
        </View>

        {item.hint && (
          <Text style={styles.hintText}>Dica: {item.hint}</Text>
        )}
      </View>
    );
  };

  if (tab === 'add') {
    return (
      <View style={styles.container} onStartShouldSetResponderCapture={handleTouchCapture}>
        <PasswordFormScreen
          editingItem={editingItem}
          onActivity={resetTimer}
          onDone={() => {
            setEditingItem(null);
            setTab('passwords');
          }}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} onStartShouldSetResponderCapture={handleTouchCapture}>
      <PrivacyShield visible={shieldVisible} onDismiss={() => setShieldVisible(false)} />

      <Pressable
        style={styles.header}
        onLongPress={() => setShieldVisible(true)}
      >
        <Text style={styles.headerTitle}>Guardiao Pessoal</Text>
        <TouchableOpacity style={styles.lockButton} onPress={lock}>
          <Text style={styles.lockButtonText}>Trancar</Text>
        </TouchableOpacity>
      </Pressable>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar credencial..."
          placeholderTextColor="#A8A199"
          value={search}
          onChangeText={t => { resetTimer(); setSearch(t); }}
        />
      </View>

      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Ordenar:</Text>
        <TouchableOpacity
          style={[styles.sortChip, sortMode === 'nome' && styles.sortChipActive]}
          onPress={() => setSortMode('nome')}
        >
          <Text style={[styles.sortText, sortMode === 'nome' && styles.sortTextActive]}>Nome</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortChip, sortMode === 'data' && styles.sortChipActive]}
          onPress={() => setSortMode('data')}
        >
          <Text style={[styles.sortText, sortMode === 'data' && styles.sortTextActive]}>Data</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortChip, sortMode === 'importancia' && styles.sortChipActive]}
          onPress={() => setSortMode('importancia')}
        >
          <Text style={[styles.sortText, sortMode === 'importancia' && styles.sortTextActive]}>Prioridade</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={[styles.actionBtn, styles.retryBtn]} onPress={reload}>
            <Text style={styles.actionText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredPasswords}
          renderItem={renderPasswordItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          onScrollBeginDrag={resetTimer}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {search ? 'Nenhuma credencial encontrada' : 'Nenhuma senha salva'}
              </Text>
            </View>
          }
        />
      )}

      {!error && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            setRevealedId(null);
            setEditingItem(null);
            setTab('add');
          }}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF9F5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: { color: '#1E1E1E', fontSize: 22, fontWeight: '700' },
  lockButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFF9EE',
    borderWidth: 1,
    borderColor: '#EED8A1',
  },
  lockButtonText: { color: '#996515', fontSize: 13, fontWeight: '700' },
  searchContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchInput: {
    backgroundColor: '#FFFFFF',
    color: '#1E1E1E',
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E6DFD5',
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  sortLabel: { color: '#756F68', fontSize: 12, fontWeight: '500' },
  sortChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6DFD5',
  },
  sortChipActive: {
    backgroundColor: '#FFF9EE',
    borderColor: '#B5824C',
  },
  sortText: { color: '#756F68', fontSize: 12 },
  sortTextActive: { color: '#996515', fontWeight: '700' },
  list: { padding: 16, paddingBottom: 80 },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E6DFD5',
    shadowColor: '#1E1E1E',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemService: { color: '#1E1E1E', fontSize: 16, fontWeight: '700', flex: 1 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  itemUser: { color: '#756F68', fontSize: 13, marginBottom: 8 },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7F5F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EFEBE4',
  },
  passwordText: {
    color: '#1E1E1E',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
    letterSpacing: 1.5,
  },
  warningText: { color: '#D9822B', fontSize: 12, marginBottom: 8, fontWeight: '500' },
  hintText: { color: '#A8A199', fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  itemActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EED8A1',
    backgroundColor: '#FFF9EE',
  },
  actionText: { color: '#996515', fontSize: 12, fontWeight: '600' },
  deleteBtn: {
    borderColor: '#FBEAE5',
    backgroundColor: '#FBEAE5',
  },
  deleteText: { color: '#D9534F', fontSize: 12, fontWeight: '600' },
  retryBtn: { marginTop: 12, alignSelf: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { color: '#756F68' },
  emptyText: { color: '#A8A199', fontSize: 14 },
  errorText: { color: '#D9534F', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#B5824C',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#B5824C',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  fabText: { color: '#FFFFFF', fontSize: 28, fontWeight: '300', marginTop: -2 },
});
