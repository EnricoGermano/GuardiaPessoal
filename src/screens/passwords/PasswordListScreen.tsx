import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, Pressable, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useVault } from '../../context/VaultContext';
import { useClipboardTimer } from '../../hooks/useClipboardTimer';
import { useInactivityTimer } from '../../hooks/useInactivityTimer';
import { PrivacyShield } from '../../components/PrivacyShield';
import { PasswordFormScreen } from './PasswordFormScreen';
import { NoteFormModal } from '../notes/NoteFormModal';
import { SecurityDashboardModal } from '../settings/SecurityDashboardModal';
import { SettingsModal } from '../settings/SettingsModal';
import { AccessLogsModal } from '../settings/AccessLogsModal';
import type { PasswordItem, NoteItem } from '../../types/vault';

type Tab = 'passwords' | 'notes' | 'add';
type SortMode = 'nome' | 'data' | 'importancia';

export function HomeScreen() {
  const { state, lock } = useAuth();
  const { vault, loading, deletePassword, deleteNote } = useVault();
  const { copyWithTimer } = useClipboardTimer();

  const [tab, setTab] = useState<Tab>('passwords');
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('nome');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [editingItem, setEditingItem] = useState<PasswordItem | null>(null);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [securityModalVisible, setSecurityModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [shieldVisible, setShieldVisible] = useState(false);

  const { resetTimer } = useInactivityTimer(
    state.config.autoLockMinutes,
    lock,
    state.mode === 'unlocked'
  );

  const handleTouch = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  const categories = [
    { id: 'todas', name: 'Todas' },
    { id: '1', name: 'Pessoal' },
    { id: '2', name: 'Trabalho' },
    { id: '3', name: 'Financeiro' },
  ];

  const filteredPasswords = useMemo(() => {
    if (!vault) return [];
    const q = search.toLowerCase();
    let items = vault.passwords.filter(p => !p.isHidden);

    if (selectedCategory !== 'todas') {
      items = items.filter(p => p.category === selectedCategory);
    }

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
  }, [vault, search, sortMode, selectedCategory]);

  const filteredNotes = useMemo(() => {
    if (!vault) return [];
    const q = search.toLowerCase();
    const now = Date.now();
    // Exclude expired auto-destruct notes
    let notes = vault.notes.filter(n => !n.isHidden && (!n.expiresAt || n.expiresAt > now));

    if (q) {
      notes = notes.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        (n.observations && n.observations.toLowerCase().includes(q))
      );
    }

    return notes.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
  }, [vault, search]);

  const handleCopy = async (text: string, label: string) => {
    await copyWithTimer(text, 30);
    Alert.alert('Copiado', `${label} copiado. Sera limpo em 30s.`);
  };

  const handleDeletePassword = (item: PasswordItem) => {
    Alert.alert(
      'Excluir senha',
      `Tem certeza que deseja excluir "${item.service}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => deletePassword(item.id) },
      ]
    );
  };

  const handleDeleteNote = (item: NoteItem) => {
    Alert.alert(
      'Excluir nota',
      `Tem certeza que deseja excluir "${item.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => deleteNote(item.id) },
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

    return (
      <Pressable style={styles.itemCard} onPress={handleTouch}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemService} numberOfLines={1}>{item.service}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <Text style={styles.itemUser}>{item.username}</Text>

        {item.warning && (
          <Text style={styles.warningText}>{item.warning}</Text>
        )}

        <View style={styles.itemActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setRevealedId(revealedId === item.id ? null : item.id)}
          >
            <Text style={styles.actionText}>
              {revealedId === item.id ? item.password : 'Mostrar'}
            </Text>
          </TouchableOpacity>

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
            onPress={() => { setEditingItem(item); setTab('add'); }}
          >
            <Text style={styles.actionText}>Editar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => handleDeletePassword(item)}
          >
            <Text style={styles.deleteText}>Excluir</Text>
          </TouchableOpacity>
        </View>

        {item.hint && (
          <Text style={styles.hintText}>Dica: {item.hint}</Text>
        )}
      </Pressable>
    );
  };

  if (tab === 'add') {
    return (
      <PasswordFormScreen
        editingItem={editingItem}
        onDone={() => {
          setEditingItem(null);
          setTab('passwords');
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <PrivacyShield visible={shieldVisible} onDismiss={() => setShieldVisible(false)} />

      <Pressable
        style={styles.header}
        onLongPress={() => setShieldVisible(true)}
      >
        <Text style={styles.headerTitle}>Guardiao Pessoal</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerNavBtn}
            onPress={() => setSecurityModalVisible(true)}
          >
            <Text style={styles.headerNavText}>Saude</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerNavBtn}
            onPress={() => setSettingsModalVisible(true)}
          >
            <Text style={styles.headerNavText}>Ajustes</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.lockButton} onPress={lock}>
            <Text style={styles.lockButtonText}>Trancar</Text>
          </TouchableOpacity>
        </View>
      </Pressable>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setTab('passwords')}
        >
          <Text style={[styles.tabText, tab === 'passwords' && styles.tabTextActive]}>Senhas</Text>
          {tab === 'passwords' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setTab('notes')}
        >
          <Text style={[styles.tabText, tab === 'notes' && styles.tabTextActive]}>Notas</Text>
          {tab === 'notes' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar credencial ou nota..."
          placeholderTextColor="#A8A199"
          value={search}
          onChangeText={setSearch}
          onFocus={handleTouch}
        />
      </View>

      {/* Category Pills (US16) */}
      {tab === 'passwords' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryBar}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                selectedCategory === cat.id && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === cat.id && styles.categoryChipTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {tab === 'passwords' && (
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
      )}

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      ) : tab === 'passwords' ? (
        <FlatList
          data={filteredPasswords}
          renderItem={renderPasswordItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Nenhuma senha salva</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredNotes}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.itemCard}
              onPress={() => {
                setEditingNote(item);
                setNoteModalVisible(true);
              }}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemService}>{item.title}</Text>
                {item.isFavorite && (
                  <View style={[styles.badge, { backgroundColor: '#FFF9EE' }]}>
                    <Text style={[styles.badgeText, { color: '#996515' }]}>Favorita</Text>
                  </View>
                )}
              </View>
              <Text style={styles.itemUser} numberOfLines={3}>{item.content}</Text>
              {item.observations ? (
                <Text style={styles.hintText}>Obs: {item.observations}</Text>
              ) : null}
              {item.autoDestructDays ? (
                <Text style={styles.warningText}>Auto-destruicao: {item.autoDestructDays}d</Text>
              ) : null}
              <View style={[styles.itemActions, { marginTop: 10 }]}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    setEditingNote(item);
                    setNoteModalVisible(true);
                  }}
                >
                  <Text style={styles.actionText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn]}
                  onPress={() => handleDeleteNote(item)}
                >
                  <Text style={styles.deleteText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Nenhuma nota confidencial salva</Text>
            </View>
          }
        />
      )}

      {/* FAB Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          if (tab === 'notes') {
            setEditingNote(null);
            setNoteModalVisible(true);
          } else {
            setEditingItem(null);
            setTab('add');
          }
        }}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Modais Integrados */}
      <NoteFormModal
        visible={noteModalVisible}
        editingItem={editingNote}
        onClose={() => {
          setNoteModalVisible(false);
          setEditingNote(null);
        }}
      />

      <SecurityDashboardModal
        visible={securityModalVisible}
        onClose={() => setSecurityModalVisible(false)}
        onOpenLogs={() => {
          setSecurityModalVisible(false);
          setLogsModalVisible(true);
        }}
      />

      <SettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
      />

      <AccessLogsModal
        visible={logsModalVisible}
        onClose={() => setLogsModalVisible(false)}
      />
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
  headerTitle: { color: '#1E1E1E', fontSize: 20, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerNavBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6DFD5',
  },
  headerNavText: { color: '#4A4237', fontSize: 12, fontWeight: '600' },
  lockButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFF9EE',
    borderWidth: 1,
    borderColor: '#EED8A1',
  },
  lockButtonText: { color: '#996515', fontSize: 12, fontWeight: '700' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 20, marginTop: 4 },
  tab: { paddingVertical: 8, position: 'relative' },
  tabText: { color: '#756F68', fontSize: 15, fontWeight: '500' },
  tabTextActive: { color: '#1E1E1E', fontWeight: '700' },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: '#B5824C',
    borderRadius: 2,
  },
  searchContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  searchInput: {
    backgroundColor: '#FFFFFF',
    color: '#1E1E1E',
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E6DFD5',
  },
  categoryBar: { paddingHorizontal: 16, paddingVertical: 6, gap: 8 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6DFD5',
  },
  categoryChipActive: { backgroundColor: '#FFF9EE', borderColor: '#B5824C' },
  categoryChipText: { fontSize: 12, color: '#756F68' },
  categoryChipTextActive: { color: '#996515', fontWeight: '700' },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 4,
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
  warningText: { color: '#D9822B', fontSize: 12, marginBottom: 8, fontWeight: '500' },
  hintText: { color: '#A8A199', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { color: '#756F68' },
  emptyText: { color: '#A8A199', fontSize: 14 },
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
